/**
 * HaulDirect Backend Server
 * Node.js + Express + Supabase
 *
 * Handles:
 *  - Carrier verification via FMCSA QCMobile API
 *  - All database reads/writes via Supabase
 *  - User auth (signup, login, session)
 *  - Loads, bids, messages, documents
 *  - Stripe webhooks (stub — wire in when keys are ready)
 *  - Detention tracking with geofencing
 */

const express = require("express");
const cors    = require("cors");
const crypto  = require("crypto");
const rateLimit = require("express-rate-limit");
const { createClient } = require("@supabase/supabase-js");

if (process.env.NODE_ENV !== "production") require("dotenv").config();

// Stripe — real payment processing. Requires STRIPE_SECRET_KEY (and later
// STRIPE_WEBHOOK_SECRET, STRIPE_CONNECT_CLIENT_ID) set in Railway → Variables.
const stripe = process.env.STRIPE_SECRET_KEY ? require("stripe")(process.env.STRIPE_SECRET_KEY.trim()) : null;
const STRIPE_CONNECT_CLIENT_ID = process.env.STRIPE_CONNECT_CLIENT_ID?.trim() || null; // no longer needed for Express Connect — kept only for backward compatibility
const API_URL = process.env.API_URL || "https://hauldirect-api-production.up.railway.app"; // this backend's own public URL, used to build Stripe return links

// Real, server-side login codes — replaces email-only login, where anyone
// who knew a user's email could log into their full account with nothing
// else required. Reuses the same EmailJS service/template already set up
// for the frontend, called securely from the backend instead, so the code
// is generated and checked server-side, not trusted from browser state.
const emailjsNode = process.env.EMAILJS_PRIVATE_KEY ? require("@emailjs/nodejs") : null;
if (emailjsNode) {
  emailjsNode.init({
    publicKey: process.env.EMAILJS_PUBLIC_KEY,
    privateKey: process.env.EMAILJS_PRIVATE_KEY,
  });
}
const EMAILJS_SERVICE_ID = process.env.EMAILJS_SERVICE_ID || "service_1h4mak5";
const EMAILJS_VERIFY_TEMPLATE = process.env.EMAILJS_VERIFY_TEMPLATE || "template_4m5qw9o";
const EMAILJS_BAN_EVASION_TEMPLATE = process.env.EMAILJS_BAN_EVASION_TEMPLATE || "template_8uzb2r5";
const loginCodes = {}; // { [email]: { code, expiresAt } } — simple in-memory store, fine at this scale

// Operator-controlled testing toggle — lets ANY code (or none at all) work
// for login while enabled, so testing doesn't require checking real email
// every time. This is genuinely powerful and dangerous if left on by
// accident (it would mean literally anyone could log into any account), so
// it auto-expires after 1 hour rather than staying on indefinitely, and
// every toggle is logged server-side for accountability.
let verificationBypassUntil = null; // timestamp, or null if off
function isVerificationBypassActive() {
  return verificationBypassUntil !== null && Date.now() < verificationBypassUntil;
}

// Real session tokens — proves who's making each request, not just at the
// moment of login. Previously, once someone logged in, nothing carried that
// proof forward: any subsequent request (like updating a load) only needed
// to know that load's ID, with no check that the requester was actually the
// shipper or carrier involved. UUIDs make this hard to exploit blindly, but
// it's not the same as real protection. A session token is generated here
// on every successful login/signup, sent back to the frontend once, and
// required (plus checked against actual load/bid ownership) on sensitive
// requests going forward.
const sessionTokens = {}; // { [token]: { userId, expiresAt } }
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// Dispatcher pricing — a flat monthly fee scaled by how many carriers a
// dispatcher manages, not by loads booked or freight value. Kept as a
// seat/access fee deliberately, to stay clearly outside broker
// compensation under 49 U.S.C. 13102, which turns on being paid for
// arranging a specific transportation transaction.
const DISPATCHER_TIERS = {
  solo:     { label: "Solo",     maxCarriers: 1,   priceLabel: "$15/mo" },
  small:    { label: "Small",    maxCarriers: 5,   priceLabel: "$35/mo" },
  growing:  { label: "Growing",  maxCarriers: 15,  priceLabel: "$75/mo" },
  pro:      { label: "Pro",      maxCarriers: Infinity, priceLabel: "$150/mo" },
};

function issueSessionToken(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  sessionTokens[token] = { userId, expiresAt: Date.now() + SESSION_DURATION_MS };
  return token;
}

// Resolves a request's real IP to a rough region/city using a free,
// no-key IP geolocation lookup. Private/local IPs (dev environment)
// return nulls rather than a misleading result — they can't be
// meaningfully geolocated, and treating them as "no prior region" avoids
// every local test login falsely tripping impossible-travel detection.
async function geolocateIp(ip) {
  if (!ip) return { region: null, city: null };
  const cleanIp = ip.replace("::ffff:", ""); // IPv4-mapped IPv6 addresses
  if (cleanIp === "::1" || cleanIp.startsWith("127.") || cleanIp.startsWith("10.") || cleanIp.startsWith("192.168.") || cleanIp.startsWith("172.")) {
    return { region: null, city: null };
  }
  try {
    const res = await fetch(`http://ip-api.com/json/${cleanIp}?fields=status,regionName,city`);
    const data = await res.json();
    if (data.status !== "success") return { region: null, city: null };
    return { region: data.regionName || null, city: data.city || null };
  } catch (err) {
    console.warn("IP geolocation failed:", err.message);
    return { region: null, city: null };
  }
}

// Genuinely impossible to travel between US states this fast — this is
// the actual hard-block threshold. Anything slower than this but still
// same-day gets logged and flagged for an operator to glance at, not
// blocked, since real travel legitimately produces different-state
// logins hours apart.
const IMPOSSIBLE_TRAVEL_WINDOW_MS = 30 * 60 * 1000;
const SAME_DAY_FLAG_WINDOW_MS = 24 * 60 * 60 * 1000;

// Called on every successful login/signup, before a session token is
// actually issued — records where this login is coming from, and checks
// it against this account's own most recent login. A genuinely
// impossible pattern (different state, under 30 minutes) blocks the
// login outright; a merely unusual one (different state, same day) is
// logged and flagged for review, never blocked, since real travel
// produces exactly this pattern too.
async function recordLoginAndCheckImpossibleTravel(userId, req) {
  const ip = req.ip || req.connection?.remoteAddress || null;
  const { region, city } = await geolocateIp(ip);

  let user = null;
  try { user = await db.getUserById(userId); } catch (err) { /* flag still useful without this */ }

  const { data: priorLogins } = await supabase.from("login_history")
    .select("region, logged_in_at")
    .eq("user_id", userId)
    .order("logged_in_at", { ascending: false })
    .limit(1);

  const prior = priorLogins?.[0];

  if (prior && region && prior.region && prior.region !== region) {
    const gapMs = Date.now() - new Date(prior.logged_in_at).getTime();
    const gapMinutes = Math.round(gapMs / 60000);

    if (gapMs < IMPOSSIBLE_TRAVEL_WINDOW_MS) {
      try {
        await supabase.from("verification_flags").insert({
          carrier_name: user?.name || null, carrier_email: user?.email || null,
          flag_type: "impossible_travel_login_blocked", severity: "blocking",
          details: { userId, priorRegion: prior.region, attemptedRegion: region, gapMinutes },
        });
      } catch (err) {
        // Supabase's query builder is thenable (works with await) but is
        // not a real Promise instance — chaining .catch() directly onto
        // it throws "catch is not a function" rather than actually
        // catching anything. A real try/catch around the awaited call is
        // the correct fix, and this genuinely ran on every single login,
        // not just an edge case.
        console.warn("Could not save verification flag:", err.message);
      }
      return { blocked: true, priorRegion: prior.region, newRegion: region, gapMinutes };
    }

    if (gapMs < SAME_DAY_FLAG_WINDOW_MS) {
      try {
        await supabase.from("verification_flags").insert({
          carrier_name: user?.name || null, carrier_email: user?.email || null,
          flag_type: "login_location_change", severity: "review",
          details: { userId, priorRegion: prior.region, newRegion: region, gapMinutes },
        });
      } catch (err) {
        console.warn("Could not save verification flag:", err.message);
      }
    }
  }

  try {
    await supabase.from("login_history").insert({ user_id: userId, ip_address: ip, region, city });
  } catch (err) {
    console.warn("Could not save login history:", err.message);
  }

  return { blocked: false, priorRegion: prior?.region, newRegion: region };
}

function requireUserAuth(req, res, next) {
  const token = req.headers["x-session-token"];
  if (!token || !sessionTokens[token]) {
    return res.status(401).json({ error: "Not logged in, or your session has expired. Please log in again." });
  }
  if (Date.now() > sessionTokens[token].expiresAt) {
    delete sessionTokens[token];
    return res.status(401).json({ error: "Your session has expired. Please log in again." });
  }
  req.userId = sessionTokens[token].userId;
  next();
}

function generateLoginCode() {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6 digits
}
// Both your live site and test site currently share this one backend, so
// Stripe needs to know how to send people back to whichever one they
// actually started from — not just always production. This allowlist
// keeps that safe (an open redirect elsewhere would be a real security
// risk, so only these specific known origins are ever used).
const ALLOWED_FRONTEND_ORIGINS = [
  "https://directfreightco.com",
  "https://www.directfreightco.com",
  process.env.TEST_FRONTEND_URL, // set this in Railway to your test Netlify URL, e.g. https://your-test-site.netlify.app
].filter(Boolean);

function safeFrontendOrigin(candidate) {
  return ALLOWED_FRONTEND_ORIGINS.includes(candidate) ? candidate : ALLOWED_FRONTEND_ORIGINS[0];
}

// Pricing — matches the exact plan structure from the frontend. Returns the
// amount in cents for a given plan + billing cycle.
function getPlanAmountCents(planId, billingCycle) {
  const MONTHLY = {
    solo_carrier: 3000, solo_shipper: 7000,
    starter: 35000, growth: 80000, fleet: 180000, enterprise: 350000,
    dispatcher_solo: 1500, dispatcher_small: 3500, dispatcher_growing: 7500, dispatcher_pro: 15000,
  };
  const ANNUAL = {
    solo_carrier: 30000, solo_shipper: 70000,
    starter: 350000, growth: 800000, fleet: 1800000, enterprise: 3500000,
    dispatcher_solo: 15000, dispatcher_small: 35000, dispatcher_growing: 75000, dispatcher_pro: 150000,
  };
  const table = billingCycle === "annual" ? ANNUAL : MONTHLY;
  return table[planId] || null;
}

// ── Hardcoded fallbacks so Railway never fails silently ──
if (!process.env.FMCSA_API_KEY)    process.env.FMCSA_API_KEY    = "eeb7553869b3de8e716c28bd9a8fbedc7b7a02ed";
if (!process.env.SUPABASE_URL)     process.env.SUPABASE_URL     = "https://qvusaeareoylwgkqfluw.supabase.co";
if (!process.env.SUPABASE_ANON_KEY) process.env.SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2dXNhZWFyZW95bHdna3FmbHV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5NDYxMjYsImV4cCI6MjA5ODUyMjEyNn0.e7gdCeSj-yes_NuxWQDgCso0YHVZeaQlgVcC8aRH3jA";

// IMPORTANT: the backend should use the SERVICE ROLE key, not the anon key.
// The service role key is meant for trusted server-side code only — it
// safely bypasses Row Level Security (RLS), which is required once RLS is
// enabled on your tables (see supabase_schema.sql for the RLS setup).
// Get this from Supabase → Settings → API → "service_role" secret key.
// Falls back to the anon key only if the service key hasn't been set yet —
// but note that with RLS enabled, using only the anon key here will cause
// every database read/write in this file to start failing.
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

const app = express();
// Stripe webhook signature verification requires the raw, unparsed request
// body — but the global JSON parser below was consuming and parsing it on
// every request before the webhook route ever saw it, silently breaking
// every webhook event. Skipping JSON parsing specifically for that one path.
app.use((req, res, next) => {
  if (req.path === "/api/webhooks/stripe") return next();
  express.json({ limit: "10mb" })(req, res, next);
});
// CORS was wide open (origin: "*") — meaning literally any website on the
// internet could call this API directly from a visitor's browser. Restricted
// to the actual known frontend origins, reusing the same allowlist already
// built for Stripe redirects, plus localhost for local dev testing.
app.set("trust proxy", 1); // Railway sits behind a proxy — required for
// express-rate-limit to correctly identify real client IPs instead of
// throwing on every request (was flooding the logs with ValidationErrors).

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_FRONTEND_ORIGINS.includes(origin) || origin.startsWith("http://localhost")) {
      callback(null, true);
    } else {
      console.warn("CORS rejected origin:", origin, "— allowed origins are:", ALLOWED_FRONTEND_ORIGINS);
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
}));

const verifyLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });
// Real login security — separate, tighter limits since these guard actual
// account access. Previously keyed by IP address (express-rate-limit's
// default) — which meant an operator couldn't clear a limit "for this
// person" the way you'd actually want, since IP isn't necessarily even
// visible or unique to one person. Rebuilt as a simple, custom, email-keyed
// tracker instead — same protection, but genuinely clearable per-account
// from the operator dashboard when someone's in a hurry and legitimately
// needs back in sooner.
const loginRequestAttempts = {}; // { [email]: { count, windowStart } }
const loginVerifyAttempts = {};  // { [email]: { count, windowStart } }
const LOGIN_LIMIT_WINDOW_MS = 15 * 60 * 1000;

function checkAndTrackLimit(store, email, maxAttempts) {
  const key = email.toLowerCase();
  const now = Date.now();
  const record = store[key];
  if (!record || now - record.windowStart > LOGIN_LIMIT_WINDOW_MS) {
    store[key] = { count: 1, windowStart: now };
    return true;
  }
  if (record.count >= maxAttempts) return false;
  record.count += 1;
  return true;
}

function loginRequestLimiter(req, res, next) {
  const email = req.body?.email;
  if (!email) return next();
  if (!checkAndTrackLimit(loginRequestAttempts, email, 5)) {
    return res.status(429).json({ error: "Too many code requests for this email. Please wait about 15 minutes, or ask the operator to clear it for you." });
  }
  next();
}

function loginVerifyLimiter(req, res, next) {
  const email = req.body?.email;
  if (!email) return next();
  if (!checkAndTrackLimit(loginVerifyAttempts, email, 10)) {
    return res.status(429).json({ error: "Too many attempts for this email. Please wait about 15 minutes, or ask the operator to clear it for you." });
  }
  next();
}

// Real, server-side operator authentication. Previously the operator PIN
// only lived in the frontend's own JavaScript bundle — meaning it was
// visible in plain text to anyone who opened browser dev tools and searched
// the compiled code, and none of the operator-only endpoints (view all
// users, suspend/delete accounts, resolve disputes) actually checked
// anything server-side at all. Both are fixed here: the real PIN now only
// ever lives in Railway's environment variables, and every operator-only
// endpoint requires it on every single request, not just at initial unlock.
const operatorPinLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });
const signupLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 15 }); // prevent spam account creation
function requireOperatorAuth(req, res, next) {
  const providedPin = req.headers["x-operator-pin"];
  if (!process.env.OPERATOR_PIN) {
    return res.status(503).json({ error: "Operator access not configured on the server." });
  }
  if (!providedPin || providedPin !== process.env.OPERATOR_PIN) {
    return res.status(401).json({ error: "Invalid or missing operator credentials." });
  }
  next();
}

// ================================================================
// DATABASE HELPERS
// ================================================================
const db = {
  // ── USERS ──
  async createUser(user) {
    const { data, error } = await supabase.from("users").insert(user).select().single();
    if (error) throw error;
    return data;
  },
  async getUserByEmail(email) {
    const { data } = await supabase.from("users").select("*").eq("email", email.toLowerCase()).single();
    return data;
  },
  async getUserById(id) {
    const { data } = await supabase.from("users").select("*").eq("id", id).single();
    return data;
  },
  async updateUser(id, updates) {
    const { data, error } = await supabase.from("users").update(updates).eq("id", id).select().single();
    if (error) throw error;
    return data;
  },
  async getAllUsers() {
    const { data } = await supabase.from("users").select("*").order("created_at", { ascending: false });
    return data || [];
  },

  // ── LOADS ──
  async createLoad(load) {
    const { data, error } = await supabase.from("loads").insert(load).select().single();
    if (error) throw error;
    return data;
  },
  async getLoads(filters = {}) {
    let q = supabase.from("loads").select("*").order("posted_at", { ascending: false });
    if (filters.status)     q = q.eq("status", filters.status);
    if (filters.shipper_id) q = q.eq("shipper_id", filters.shipper_id);
    if (filters.carrier_id) q = q.eq("carrier_id", filters.carrier_id);
    const { data } = await q;
    return data || [];
  },
  async getLoadById(id) {
    const { data } = await supabase.from("loads").select("*").eq("id", id).single();
    return data;
  },
  async updateLoad(id, updates) {
    const { data, error } = await supabase.from("loads").update(updates).eq("id", id).select().single();
    if (error) throw error;
    return data;
  },
  async deleteLoad(id) {
    const { error } = await supabase.from("loads").delete().eq("id", id);
    if (error) throw error;
  },

  // ── BIDS ──
  async createBid(bid) {
    const { data, error } = await supabase.from("bids").insert(bid).select().single();
    if (error) throw error;
    return data;
  },
  async getBidsForLoad(loadId) {
    const { data } = await supabase.from("bids").select("*").eq("load_id", loadId).order("created_at");
    return data || [];
  },
  async updateBid(id, updates) {
    const { data, error } = await supabase.from("bids").update(updates).eq("id", id).select().single();
    if (error) throw error;
    return data;
  },

  // ── MESSAGES ──
  async sendMessage(msg) {
    const { data, error } = await supabase.from("messages").insert(msg).select().single();
    if (error) throw error;
    return data;
  },
  async getMessages(loadId, carrierId) {
    const { data } = await supabase.from("messages")
      .select("*").eq("load_id", loadId).eq("carrier_id", carrierId)
      .order("sent_at");
    return data || [];
  },

  // ── DOCUMENTS ──
  async saveDocument(doc) {
    const { data, error } = await supabase.from("documents").insert(doc).select().single();
    if (error) throw error;
    return data;
  },
  async getDocumentsForLoad(loadId) {
    const { data } = await supabase.from("documents").select("*").eq("load_id", loadId).order("uploaded_at");
    return data || [];
  },

  // ── RATINGS ──
  async saveRating(rating) {
    const { data, error } = await supabase.from("ratings").insert(rating).select().single();
    if (error) throw error;
    return data;
  },
  async getRatingsForUser(userId) {
    const { data } = await supabase.from("ratings").select("*").eq("rated_user_id", userId);
    return data || [];
  },
};

// ================================================================
// AUTH ENDPOINTS
// ================================================================

// POST /api/auth/signup
app.post("/api/auth/signup", signupLimiter, async (req, res) => {
  try {
    const { name, email, role, company, equipmentType, truckDesc, maxWeight,
            dotNumber, mcNumber, verification, coiVerified, coiData,
            bizVerified, bizData, stripeConnected, payout, billing,
            loc, dims, lanes, eld, equipmentStatus, currentZip, phone, referralCode, dispatcherTier } = req.body;

    if (!name || !email || !role) return res.status(400).json({ error: "name, email, role required" });

    const existing = await db.getUserByEmail(email);
    if (existing) return res.status(409).json({ error: "An account with that email already exists." });

    // Prevents the same real carrier from signing up a second time under a
    // different email but the same MC/DOT number — email-uniqueness alone
    // doesn't catch this, since MC/DOT numbers are the actual persistent
    // identifier, not the email address someone happens to sign up with.
    if (mcNumber || dotNumber) {
      const cleanMc = mcNumber ? String(mcNumber).replace(/\D/g, "") : null;
      const cleanDot = dotNumber ? String(dotNumber).replace(/\D/g, "") : null;
      const { data: existingByAuthority } = await supabase.from("users").select("id, email, mc_number, dot_number")
        .or([cleanMc ? `mc_number.eq.${cleanMc}` : null, cleanDot ? `dot_number.eq.${cleanDot}` : null].filter(Boolean).join(","));
      const authorityMatch = (existingByAuthority || []).find((u) =>
        (cleanMc && u.mc_number && String(u.mc_number).replace(/\D/g, "") === cleanMc) ||
        (cleanDot && u.dot_number && String(u.dot_number).replace(/\D/g, "") === cleanDot)
      );
      if (authorityMatch) {
        return res.status(409).json({ error: "An account already exists for this MC/DOT number. Each carrier authority may only have one active account — contact us directly if you believe this is an error." });
      }
    }

    // Validate the referral code up front, if one was entered — better to
    // tell the person right away than to silently drop a bad code and have
    // their referrer never actually get credit for it.
    let referredBy = null;
    if (referralCode && referralCode.trim()) {
      const { data: referrer } = await supabase.from("users").select("id, referral_code").eq("referral_code", referralCode.trim().toUpperCase()).maybeSingle();
      if (!referrer) {
        return res.status(400).json({ error: "That referral code doesn't match any account. Double-check it, or leave it blank to sign up without one." });
      }
      referredBy = referrer.referral_code;
    }

    const newUserId = crypto.randomUUID();
    const user = await db.createUser({
      id:               newUserId,
      name,
      email:            email.toLowerCase(),
      role,
      phone:            phone || null,
      company:          company || null,
      equipment_type:   equipmentType || null,
      truck_desc:       truckDesc || null,
      max_weight:       maxWeight || null,
      dims:             dims || null,
      dot_number:       dotNumber || null,
      mc_number:        mcNumber || null,
      verification:     verification || null,
      coi_verified:     coiVerified || false,
      coi_data:         coiData || null,
      biz_verified:     bizVerified || false,
      biz_data:         bizData || null,
      stripe_connected: stripeConnected || false,
      payout:           payout || null,
      billing:          billing || null,
      loc:              loc || null,
      lanes:            lanes || [],
      eld:              eld || null,
      equipment_status: equipmentStatus || "empty",
      current_zip:      currentZip || null,
      ratings:          [],
      suspended:        false,
      // Only meaningful for dispatcher accounts — explicit null for every
      // other role rather than letting the column's DB-level 'solo'
      // default apply to accounts where a dispatcher tier makes no sense.
      dispatcher_tier:  role === "dispatcher" ? (dispatcherTier || "solo") : null,
      // Each user's own referral code, for them to share — short, unique,
      // and readable enough to say out loud or type in easily.
      referral_code:    newUserId.slice(0, 8).toUpperCase(),
      referred_by:      referredBy,
      created_at:       new Date().toISOString(),
    });

    // Never blocks here — a brand-new account has no prior login to
    // compare against — but this establishes the first entry so future
    // logins have something real to check themselves against.
    await recordLoginAndCheckImpossibleTravel(user.id, req);
    res.json({ user, sessionToken: issueSessionToken(user.id) });
  } catch (err) {
    console.error("Signup error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// The old /api/auth/login (email-only, no code/password) has been removed
// entirely — it's not enough to stop the frontend from calling it, since
// anyone could still hit it directly (curl, Postman) and get a full user
// record back with nothing but a guessed or known email address. Real
// login now requires /api/auth/request-login-code followed by
// /api/auth/verify-login-code, both below.

// POST /api/auth/request-login-code — Step 1 of real login. Generates a
// real code, stores it server-side (never trusting the browser with the
// source of truth), and emails it using the same EmailJS template already
// set up, sent securely from the backend this time.
app.post("/api/auth/request-login-code", loginRequestLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "email required" });
    const user = await db.getUserByEmail(email);
    // Deliberately vague response either way — confirming whether an email
    // has an account at all is its own small information leak.
    if (!user) return res.json({ sent: true });
    if (user.suspended) return res.status(403).json({ error: "This account has been suspended. Contact support." });

    const code = generateLoginCode();
    loginCodes[email.toLowerCase()] = { code, expiresAt: Date.now() + 10 * 60 * 1000 };

    if (isVerificationBypassActive()) {
      console.log(`Verification bypass active — skipped sending real code for ${email} (any code will work).`);
    } else if (emailjsNode) {
      try {
        await emailjsNode.send(EMAILJS_SERVICE_ID, EMAILJS_VERIFY_TEMPLATE, {
          to_email: email, user_name: user.name, verify_code: code, platform_name: "Direct Freight Co",
        });
      } catch (emailErr) {
        console.error("Login code email failed to send:", JSON.stringify(emailErr), emailErr.status, emailErr.text);
      }
    } else {
      console.warn("EMAILJS_PRIVATE_KEY not set — login code generated but not emailed:", code);
    }
    res.json({ sent: true, bypassActive: isVerificationBypassActive() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/verify-login-code — Step 2. Only returns the real user
// record once the code is confirmed correct and not expired, server-side.
app.post("/api/auth/verify-login-code", loginVerifyLimiter, async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ error: "email and code are required" });
    const key = email.toLowerCase();

    if (isVerificationBypassActive()) {
      // Testing bypass active — any code works, real code check skipped.
      delete loginCodes[key];
    } else {
      const record = loginCodes[key];
      if (!record) return res.status(400).json({ error: "No login code was requested for this email, or it already expired. Request a new one." });
      if (Date.now() > record.expiresAt) { delete loginCodes[key]; return res.status(400).json({ error: "This code has expired. Request a new one." }); }
      if (record.code !== String(code).trim()) return res.status(400).json({ error: "Incorrect code. Check your email and try again." });
      delete loginCodes[key]; // one-time use
    }

    const user = await db.getUserByEmail(email);
    if (!user) return res.status(404).json({ error: "No account found with that email." });
    if (user.suspended) return res.status(403).json({ error: "This account has been suspended. Contact support." });

    const travelCheck = await recordLoginAndCheckImpossibleTravel(user.id, req);
    if (travelCheck.blocked) {
      return res.status(403).json({
        error: `This login was blocked — this account just logged in from ${travelCheck.priorRegion} and is now attempting to log in from ${travelCheck.newRegion}, ${travelCheck.gapMinutes} minutes later. That's not physically possible for one person, which usually means this account's login is being shared. Contact support if this is a genuine error.`,
      });
    }

    res.json({ user, sessionToken: issueSessionToken(user.id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/user/:id
app.get("/api/auth/user/:id", async (req, res) => {
  try {
    const user = await db.getUserById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/auth/user/:id
// Maps camelCase user fields from the frontend to the snake_case columns
// used in the Supabase `users` table. Same problem as loads — profile
// edits were being sent raw and silently failing to save.
const USER_FIELD_MAP = {
  equipmentType: "equipment_type", truckDesc: "truck_desc", maxWeight: "max_weight",
  mcNumber: "mc_number", dotNumber: "dot_number", coiVerified: "coi_verified",
  coiData: "coi_data", bizVerified: "biz_verified", bizData: "biz_data",
  stripeConnected: "stripe_connected", currentZip: "current_zip",
  equipmentStatus: "equipment_status", operatorNotes: "operator_notes",
  trialStartedAt: "trial_started_at", createdAt: "created_at",
  complimentaryExpiry: "complimentary_expiry", companyName: "company",
  billingCycle: "billing_cycle", requestedTier: "requested_tier",
  escrowWaiverAccepted: "escrow_waiver_accepted",
  factoringEnabled: "factoring_enabled", factoringCompany: "factoring_company",
  factoringEmail: "factoring_email", factoringPhone: "factoring_phone",
  factoringNoaNumber: "factoring_noa_number",
  operatesUnderLeasedAuthority: "operates_under_leased_authority", leaseVerification: "lease_verification",
  // Already valid column names — pass through unchanged
  name: "name", email: "email", role: "role", company: "company", dims: "dims",
  verification: "verification", payout: "payout", billing: "billing", loc: "loc",
  lanes: "lanes", eld: "eld", ratings: "ratings", suspended: "suspended",
  phone: "phone", complimentary: "complimentary", ein: "ein",
  operates_under_leased_authority: "operates_under_leased_authority", lease_verification: "lease_verification",
  dispatcherTier: "dispatcher_tier", dispatcher_tier: "dispatcher_tier",
};

const USER_VALID_COLUMNS = new Set([
  "name", "email", "role", "company", "equipment_type", "truck_desc", "max_weight",
  "dims", "dot_number", "mc_number", "verification", "coi_verified", "coi_data",
  "biz_verified", "biz_data", "stripe_connected", "payout", "billing", "loc",
  "lanes", "eld", "equipment_status", "current_zip", "ratings", "operator_notes",
  "suspended", "created_at", "phone", "complimentary", "complimentary_expiry",
  "ein", "trial_started_at", "address", "billing_cycle", "requested_tier",
  "factoring_enabled", "factoring_company", "factoring_email", "factoring_phone", "factoring_noa_number",
  "escrow_waiver_accepted", "operates_under_leased_authority", "lease_verification", "dispatcher_tier",
]);

function mapUserFields(body) {
  const mapped = {};
  for (const [key, value] of Object.entries(body)) {
    if (USER_VALID_COLUMNS.has(key)) {
      mapped[key] = value;
    } else if (USER_FIELD_MAP[key]) {
      mapped[USER_FIELD_MAP[key]] = value;
    }
    // Anything unrecognized (like frontend-only computed fields) is dropped
    // instead of sent raw, which previously caused the whole update to fail.
  }
  return mapped;
}

app.patch("/api/auth/user/:id", async (req, res) => {
  try {
    // This endpoint had no authentication at all — meaning anyone, logged
    // in or not, could PATCH any user's row directly by ID: change their
    // email (and then request a login code to hijack the account), mark
    // themselves as verified without real verification, remove their own
    // suspension/ban, or edit another shipper's billing. Now requires
    // either a valid operator PIN (operators legitimately edit any user's
    // profile from the dashboard) or a valid session that actually
    // belongs to the profile being edited.
    const operatorPin = req.headers["x-operator-pin"];
    const isOperator = !!process.env.OPERATOR_PIN && operatorPin === process.env.OPERATOR_PIN;
    if (!isOperator) {
      const token = req.headers["x-session-token"];
      const session = token && sessionTokens[token];
      if (!session || Date.now() > session.expiresAt) {
        return res.status(401).json({ error: "Not logged in, or your session has expired. Please log in again." });
      }
      if (session.userId !== req.params.id) {
        return res.status(403).json({ error: "You don't have permission to update this profile." });
      }
    }

    const isRemovingBilling = req.body.billing && req.body.billing.connected === false;
    if (isRemovingBilling) {
      const { data: unpaidLoads } = await supabase.from("loads")
        .select("id").eq("shipper_id", req.params.id).not("carrier_id", "is", null)
        .eq("paid", false).neq("status", "cancelled");
      if (unpaidLoads && unpaidLoads.length > 0) {
        return res.status(403).json({ error: `Cannot remove payment method — ${unpaidLoads.length} unpaid load(s) with a carrier assigned. Release payment first.` });
      }
    }
    const user = await db.updateUser(req.params.id, mapUserFields(req.body));
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================================================================
// LOADS ENDPOINTS
// ================================================================

// Maps camelCase fields from the frontend to the snake_case columns
// used in the Supabase `loads` table. Anything not in this map is
// dropped rather than sent raw — prevents "unknown column" errors
// that were silently failing every load save and update.
const LOAD_FIELD_MAP = {
  shipperId: "shipper_id", shipperName: "shipper_name",
  truckerId: "carrier_id", carrierId: "carrier_id",
  deliveredAt: "delivered_at", pickedUpAt: "picked_up_at",
  originZip: "origin_zip", originCity: "origin_city", originState: "origin_state",
  destZip: "dest_zip", deliveryCity: "delivery_city", deliveryState: "delivery_state",
  pickupAddress: "pickup_address", deliveryAddress: "delivery_address",
  contactName: "contact_name", contactPhone: "contact_phone",
  pickupDate: "pickup_date", deliveryDate: "delivery_date",
  pickupTimeEarliest: "pickup_time_earliest", pickupTimeLatest: "pickup_time_latest",
  directions: "directions", pickupNumber: "pickup_number",
  deliveryTimeEarliest: "delivery_time_earliest", deliveryTimeLatest: "delivery_time_latest",
  hazmatClass: "hazmat_class", freightCondition: "freight_condition",
  linearFeet: "linear_feet", permitRequired: "permit_required",
  tempRequirement: "temp_requirement", tempSpec: "temp_spec",
  doNotStack: "do_not_stack", unloadType: "unload_type",
  appointmentRequired: "appointment_required", twicRequired: "twic_required",
  bolNumber: "bol_number", raterconSent: "ratecon_sent",
  deliveryStatusConfirmed: "delivery_status_confirmed",
  quickPay: "quick_pay", paidAt: "paid_at",
  postedAt: "posted_at", updatedAt: "updated_at",
  cancelledAt: "cancelled_at", cancelledBy: "cancelled_by", cancelReason: "cancel_reason",
  cancelHistory: "cancel_history", trailerLength: "trailer_length", cancellationFee: "cancellation_fee",
  rateIncreaseStatus: "rate_increase_status", rateIncreaseAmount: "rate_increase_amount",
  rateIncreaseReason: "rate_increase_reason", rateIncreaseOfferedAt: "rate_increase_offered_at",
  rateIncreaseResolvedAt: "rate_increase_resolved_at",
  returnTripStatus: "return_trip_status", returnTripReason: "return_trip_reason",
  returnTripFee: "return_trip_fee", returnTripNote: "return_trip_note",
  returnTripRequestedAt: "return_trip_requested_at", returnTripResolvedAt: "return_trip_resolved_at",
  additionalPayFee: "additional_pay_fee",
  bolPackageCount: "bol_package_count", bolPackageType: "bol_package_type", bolSentAt: "bol_sent_at",
  trackingStartedAt: "tracking_started_at", dispatcherId: "dispatcher_id",
  // Already valid snake_case / single-word column names — pass through unchanged
  origin: "origin", destination: "destination", miles: "miles", weight: "weight",
  price: "price", description: "description", dims: "dims", equipmentType: "equipment_type",
  hazmat: "hazmat", ltl: "ltl", tarp: "tarp", chains: "chains", securement: "securement_details",
  requirements: "requirements", bids: "bids", progress: "progress", paid: "paid",
  status: "status", commodity: "commodity", qty: "qty", pallets: "pallets",
  oversize: "oversize", stackable: "stackable", fragile: "fragile", special: "special",
  documents: "documents",
};

// Full set of real column names on the loads table — if the frontend
// already sends a correct snake_case key, pass it straight through.
const LOAD_VALID_COLUMNS = new Set([
  "shipper_id", "shipper_name", "carrier_id", "status", "origin", "destination",
  "origin_zip", "dest_zip", "origin_city", "origin_state", "delivery_city", "delivery_state",
  "pickup_address", "delivery_address", "contact_name", "contact_phone",
  "miles", "weight", "price", "description", "dims", "equipment_type",
  "hazmat", "ltl", "tarp", "chains", "securement", "securement_details", "pickup_date", "delivery_date",
  "pickup_time_earliest", "pickup_time_latest", "delivery_time_earliest", "delivery_time_latest",
  "directions", "pickup_number",
  "requirements", "bids", "progress", "paid", "paid_at", "quick_pay", "bol_number",
  "ratecon_sent", "delivery_status_confirmed", "posted_at", "updated_at", "delivered_at", "picked_up_at",
  "commodity", "qty", "freight_condition", "pallets", "linear_feet", "oversize",
  "permit_required", "temp_requirement", "temp_spec", "stackable", "do_not_stack",
  "fragile", "unload_type", "appointment_required", "twic_required", "hazmat_class",
  "special", "cancelled_at", "cancelled_by", "cancel_reason", "cancel_history", "documents", "trailer_length", "cancellation_fee",
  "rate_increase_status", "rate_increase_amount", "rate_increase_reason", "rate_increase_offered_at", "rate_increase_resolved_at",
  "return_trip_status", "return_trip_reason", "return_trip_fee", "return_trip_note",
  "return_trip_requested_at", "return_trip_resolved_at", "additional_pay_fee",
  "bol_package_count", "bol_package_type", "bol_sent_at",
  "tracking_started_at", "dispatcher_id",
]);

function mapLoadFields(body) {
  const mapped = {};
  for (const [key, value] of Object.entries(body)) {
    if (LOAD_VALID_COLUMNS.has(key)) {
      mapped[key] = value; // already correct snake_case column name
    } else if (LOAD_FIELD_MAP[key]) {
      mapped[LOAD_FIELD_MAP[key]] = value; // translate camelCase -> snake_case
    }
    // Anything not recognized is dropped instead of sent raw, which
    // previously caused the whole insert/update to silently fail.
  }
  return mapped;
}

// POST /api/loads
app.post("/api/loads", requireUserAuth, async (req, res) => {
  try {
    // Server-controlled fields go AFTER the spread so they always win,
    // regardless of what the frontend sends — previously this was reversed,
    // meaning a raw Date.now() number from the frontend (e.g. 1784680773527)
    // would silently overwrite the correct ISO date string here, causing
    // "date/time field value out of range" and the whole insert to fail.
    // shipper_id is now also forced to the authenticated user, not
    // whatever the request claimed — without this, anyone logged in could
    // post a load under a different shipper's identity entirely.
    const load = await db.createLoad({
      ...mapLoadFields(req.body),
      id:           crypto.randomUUID(),
      shipper_id:   req.userId,
      status:       "open",
      carrier_id:   null,
      progress:     0,
      posted_at:    new Date().toISOString(),
      paid:         false,
    });
    res.json({ load });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/loads
app.get("/api/loads", async (req, res) => {
  try {
    const loads = await db.getLoads(req.query);
    res.json({ loads });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/loads/:id
app.get("/api/loads/:id", async (req, res) => {
  try {
    const load = await db.getLoadById(req.params.id);
    if (!load) return res.status(404).json({ error: "Load not found" });
    res.json({ load });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/loads/:id
app.patch("/api/loads/:id", requireUserAuth, async (req, res) => {
  try {
    const existing = await db.getLoadById(req.params.id);
    if (!existing) return res.status(404).json({ error: "Load not found." });

    const isOwningShipper = existing.shipper_id === req.userId;
    const isAssignedCarrier = existing.carrier_id === req.userId;
    // A carrier claiming a currently-open load (no carrier assigned yet) is
    // legitimate — but only if they're assigning themselves, not someone
    // else, UNLESS the requester is a dispatcher genuinely linked to the
    // carrier named in onBehalfOfCarrierId (verified against the real
    // dispatcher_links table, never trusted from the request alone).
    // claimedId checks both field names since the frontend has historically
    // sent this as truckerId, not carrierId — a past version of this check
    // only looked at carrierId and silently rejected every real claim as a
    // result. Checking both is what actually keeps this working.
    const claimedId = req.body.truckerId ?? req.body.carrierId;
    let isClaimingOpenLoad = !existing.carrier_id && claimedId === req.userId;
    if (!isClaimingOpenLoad && !existing.carrier_id && req.body.onBehalfOfCarrierId) {
      const linked = await verifyDispatcherLink(req.userId, req.body.onBehalfOfCarrierId);
      isClaimingOpenLoad = linked && claimedId === req.body.onBehalfOfCarrierId;
    }

    if (!isOwningShipper && !isAssignedCarrier && !isClaimingOpenLoad) {
      return res.status(403).json({ error: "You don't have permission to update this load." });
    }

    const load = await db.updateLoad(req.params.id, mapLoadFields(req.body));
    res.json({ load });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/loads/:id  (operator only)
app.delete("/api/loads/:id", requireOperatorAuth, async (req, res) => {
  try {
    await db.deleteLoad(req.params.id);
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================================================================
// BIDS ENDPOINTS
// ================================================================

// POST /api/loads/:id/bids
app.post("/api/loads/:id/bids", requireUserAuth, async (req, res) => {
  try {
    // carrier_id is forced to the authenticated user by default — without
    // this, anyone logged in could submit a bid under a different
    // carrier's identity. The one real exception: a dispatcher acting on
    // behalf of a carrier who has genuinely added them. That's never
    // trusted from the request body alone — verifyDispatcherLink checks
    // the actual dispatcher_links table before the bid is allowed to be
    // placed under the carrier's identity instead of the dispatcher's own.
    let carrierId = req.userId;
    if (req.body.onBehalfOfCarrierId) {
      const linked = await verifyDispatcherLink(req.userId, req.body.onBehalfOfCarrierId);
      if (!linked) {
        return res.status(403).json({ error: "You're not currently linked as a dispatcher for that carrier." });
      }
      carrierId = req.body.onBehalfOfCarrierId;
    }
    const bid = await db.createBid({
      id:         crypto.randomUUID(),
      load_id:    req.params.id,
      carrier_id: carrierId,
      amount:     req.body.amount,
      note:       req.body.note || null,
      status:     "pending",
      created_at: new Date().toISOString(),
      placed_by_dispatcher_id: req.body.onBehalfOfCarrierId ? req.userId : null,
    });
    res.json({ bid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/loads/:id/bids
app.get("/api/loads/:id/bids", async (req, res) => {
  try {
    const bids = await db.getBidsForLoad(req.params.id);
    res.json({ bids });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/bids/:id
app.patch("/api/bids/:id", requireUserAuth, async (req, res) => {
  try {
    // No authentication or ownership check existed here — meaning anyone
    // logged in could accept, reject, or counter any bid on any load, not
    // just their own. Now verifies the requester is either the shipper who
    // owns the load this bid is on, the carrier who placed the bid, or a
    // dispatcher genuinely linked to that carrier (checked against the
    // real dispatcher_links table, never trusted from anything the client
    // claims).
    const { data: bid } = await supabase.from("bids").select("id, load_id, carrier_id").eq("id", req.params.id).single();
    if (!bid) return res.status(404).json({ error: "Bid not found." });
    const load = await db.getLoadById(bid.load_id);
    const isOwningShipper = load && load.shipper_id === req.userId;
    const isBiddingCarrier = bid.carrier_id === req.userId;
    const requester = await db.getUserById(req.userId);
    const isLinkedDispatcher = requester?.role === "dispatcher" && await verifyDispatcherLink(req.userId, bid.carrier_id);
    if (!isOwningShipper && !isBiddingCarrier && !isLinkedDispatcher) {
      return res.status(403).json({ error: "You don't have permission to update this bid." });
    }
    const bidResult = await db.updateBid(req.params.id, req.body);
    res.json({ bid: bidResult });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================================================================
// REVIEWS / FEEDBACK — previously only stored in a plain in-browser array,
// never the real database, meaning reviews were lost on every refresh and
// invisible across different devices or sessions.
// ================================================================

// POST /api/feedback — open to anyone submitting a review, no auth required
app.post("/api/feedback", async (req, res) => {
  try {
    const { data, error } = await supabase.from("reviews").insert({
      user_name: req.body.userName, user_email: req.body.userEmail, user_role: req.body.userRole,
      stars: req.body.stars, what_to_add: req.body.whatToAdd, easier: req.body.easier,
      problems: req.body.problems, general: req.body.general,
    }).select().single();
    if (error) throw error;
    res.json({ review: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/feedback — operator only, since it includes names/emails
app.get("/api/feedback", requireOperatorAuth, async (req, res) => {
  try {
    const { data, error } = await supabase.from("reviews").select("*").order("submitted_at", { ascending: false });
    if (error) throw error;
    res.json({ reviews: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/feedback/:id — operator only
app.delete("/api/feedback/:id", requireOperatorAuth, async (req, res) => {
  try {
    const { error } = await supabase.from("reviews").delete().eq("id", req.params.id);
    if (error) throw error;
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================================================================
// DISPATCHERS — a real, separate account type that can act on behalf
// of one or more truckers, but only ever truckers who've explicitly
// added them. A dispatcher has zero access to anyone who hasn't done
// this — there's no code to guess, no way to self-link to a carrier.
// ================================================================

// Reusable check: is this dispatcher genuinely, currently linked to this
// carrier? Used before letting a dispatcher touch anything on a carrier's
// behalf — bidding, viewing loads, etc. Never trust a carrierId passed in
// the request body alone; this is the actual authorization check.
async function verifyDispatcherLink(dispatcherId, carrierId) {
  const { data } = await supabase.from("dispatcher_links")
    .select("id").eq("dispatcher_id", dispatcherId).eq("carrier_id", carrierId).eq("status", "active").maybeSingle();
  return !!data;
}

// POST /api/dispatcher/add — a carrier adds a dispatcher by email.
// Carrier-initiated on purpose: the carrier is the one whose account and
// money are on the line, so they're the one who should have to take the
// deliberate step of granting access, not a dispatcher self-adding.
app.post("/api/dispatcher/add", requireUserAuth, async (req, res) => {
  try {
    const carrier = await db.getUserById(req.userId);
    // Dispatchers are restricted to Company tier accounts (role === "corp")
    // — a solo owner-operator ("trucker") dispatches themselves; dispatch
    // services are for fleets managing multiple trucks/drivers at once.
    if (!carrier || carrier.role !== "corp") {
      return res.status(403).json({ error: "Only Company tier accounts can add a dispatcher. Individual carrier accounts dispatch their own loads." });
    }
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Dispatcher email is required." });

    const dispatcher = await db.getUserByEmail(email);
    if (!dispatcher) {
      return res.status(404).json({ error: "No account found with that email. The dispatcher needs to create a Direct Freight Co dispatcher account first." });
    }
    if (dispatcher.role !== "dispatcher") {
      return res.status(400).json({ error: "That email belongs to an account that isn't registered as a dispatcher." });
    }

    const { data: existing } = await supabase.from("dispatcher_links")
      .select("id, status").eq("dispatcher_id", dispatcher.id).eq("carrier_id", req.userId).maybeSingle();

    if (existing?.status === "active") {
      return res.status(409).json({ error: "This dispatcher is already linked to your account." });
    }

    // Enforce the dispatcher's own tier limit — checked here, not on the
    // dispatcher's side, since it's the carrier's add action that would
    // push them over. A re-activation of a previously revoked link still
    // counts against the limit the same as a brand new one.
    // A complimentary dispatcher (granted by an operator, via the same
    // flag that already bypasses the trial paywall) skips this limit
    // entirely — a comp account shouldn't still be boxed in at whatever
    // tier they happen to be stored at.
    const isComplimentaryActive = dispatcher.complimentary && (!dispatcher.complimentary_expiry || Date.now() < new Date(dispatcher.complimentary_expiry).getTime());
    if ((!existing || existing.status !== "active") && !isComplimentaryActive) {
      const tier = DISPATCHER_TIERS[dispatcher.dispatcher_tier] || DISPATCHER_TIERS.solo;
      const { count: activeCount } = await supabase.from("dispatcher_links")
        .select("*", { count: "exact", head: true })
        .eq("dispatcher_id", dispatcher.id).eq("status", "active");
      if ((activeCount || 0) >= tier.maxCarriers) {
        return res.status(403).json({
          error: `This dispatcher is already at their plan's limit of ${tier.maxCarriers} carrier${tier.maxCarriers === 1 ? "" : "s"} (${tier.label} plan). They'll need to upgrade their own plan before they can be added by another carrier.`,
        });
      }
    }

    let link;
    if (existing) {
      // Re-adding someone previously revoked — reactivate the same row
      // rather than creating a duplicate.
      const { data, error } = await supabase.from("dispatcher_links")
        .update({ status: "active", added_at: new Date().toISOString(), revoked_at: null })
        .eq("id", existing.id).select().single();
      if (error) throw error;
      link = data;
    } else {
      const { data, error } = await supabase.from("dispatcher_links")
        .insert({ dispatcher_id: dispatcher.id, carrier_id: req.userId }).select().single();
      if (error) throw error;
      link = data;
    }
    res.json({ link, dispatcherName: dispatcher.name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/dispatcher/revoke — carrier revokes a dispatcher's access.
// The carrier can always do this unilaterally, immediately — a dispatcher
// never has a way to prevent or delay their own removal.
app.patch("/api/dispatcher/revoke", requireUserAuth, async (req, res) => {
  try {
    const { dispatcherId } = req.body;
    const { data, error } = await supabase.from("dispatcher_links")
      .update({ status: "revoked", revoked_at: new Date().toISOString() })
      .eq("dispatcher_id", dispatcherId).eq("carrier_id", req.userId).select().single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: "No active link found for that dispatcher." });
    res.json({ revoked: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dispatcher/my-dispatchers — carrier views who currently has
// access to act on their behalf.
app.get("/api/dispatcher/my-dispatchers", requireUserAuth, async (req, res) => {
  try {
    const { data, error } = await supabase.from("dispatcher_links")
      .select("id, dispatcher_id, status, added_at, users:dispatcher_id(name, email)")
      .eq("carrier_id", req.userId).eq("status", "active");
    if (error) throw error;
    res.json({ dispatchers: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dispatcher/my-carriers — dispatcher views which carriers have
// added them, so they know who they can currently act on behalf of.
app.get("/api/dispatcher/my-carriers", requireUserAuth, async (req, res) => {
  try {
    const dispatcher = await db.getUserById(req.userId);
    if (!dispatcher || dispatcher.role !== "dispatcher") {
      return res.status(403).json({ error: "This endpoint is only for dispatcher accounts." });
    }
    const { data, error } = await supabase.from("dispatcher_links")
      .select("id, carrier_id, added_at, users:carrier_id(id, name, email, equipment_type, max_weight, mc_number, dot_number, lanes, verification, payout)")
      .eq("dispatcher_id", req.userId).eq("status", "active");
    if (error) throw error;
    res.json({ carriers: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================================================================
// DRIVERS — a real, separate login for each driver on a Company carrier
// account, rather than a shared login switching between internal
// profile records. A driver only ever gets access to a company that has
// explicitly added them — same authorization model as dispatchers.
// ================================================================

async function verifyDriverLink(driverId, corpId) {
  const { data } = await supabase.from("driver_links")
    .select("id").eq("driver_id", driverId).eq("corp_id", corpId).eq("status", "active").maybeSingle();
  return !!data;
}

// POST /api/driver/add — the corp admin adds a driver by email. Same
// admin-initiated pattern as dispatchers: the account whose authority
// and insurance are on the line is the one who has to take the
// deliberate step of granting access.
app.post("/api/driver/add", requireUserAuth, async (req, res) => {
  try {
    const admin = await db.getUserById(req.userId);
    if (!admin || admin.role !== "corp") {
      return res.status(403).json({ error: "Only Company accounts can add drivers." });
    }
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Driver email is required." });

    const driver = await db.getUserByEmail(email);
    if (!driver) {
      return res.status(404).json({ error: "No account found with that email. The driver needs to create a Direct Freight Co driver account first." });
    }
    if (driver.role !== "driver") {
      return res.status(400).json({ error: "That email belongs to an account that isn't registered as a driver." });
    }

    const { data: existing } = await supabase.from("driver_links")
      .select("id, status").eq("driver_id", driver.id).eq("corp_id", req.userId).maybeSingle();

    if (existing?.status === "active") {
      return res.status(409).json({ error: "This driver is already linked to your account." });
    }

    let link;
    if (existing) {
      const { data, error } = await supabase.from("driver_links")
        .update({ status: "active", added_at: new Date().toISOString(), revoked_at: null })
        .eq("id", existing.id).select().single();
      if (error) throw error;
      link = data;
    } else {
      const { data, error } = await supabase.from("driver_links")
        .insert({ driver_id: driver.id, corp_id: req.userId }).select().single();
      if (error) throw error;
      link = data;
    }
    res.json({ link, driverName: driver.name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/driver/revoke — admin revokes a driver's access, immediately
// and unilaterally, same as dispatcher revocation.
app.patch("/api/driver/revoke", requireUserAuth, async (req, res) => {
  try {
    const { driverId } = req.body;
    const { data, error } = await supabase.from("driver_links")
      .update({ status: "revoked", revoked_at: new Date().toISOString() })
      .eq("driver_id", driverId).eq("corp_id", req.userId).select().single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: "No active link found for that driver." });
    // A revoked driver should no longer show as assigned on any of this
    // company's loads — clear the assignment rather than leave a
    // dangling reference to someone who no longer has access.
    await supabase.from("loads").update({ assigned_driver_id: null })
      .eq("carrier_id", req.userId).eq("assigned_driver_id", driverId);
    res.json({ revoked: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/driver/my-drivers — admin views who's currently linked.
app.get("/api/driver/my-drivers", requireUserAuth, async (req, res) => {
  try {
    const { data, error } = await supabase.from("driver_links")
      .select("id, driver_id, status, added_at, users:driver_id(name, email, phone)")
      .eq("corp_id", req.userId).eq("status", "active");
    if (error) throw error;
    res.json({ drivers: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/driver/my-companies — driver views which companies have
// added them, so they know who they're linked to.
app.get("/api/driver/my-companies", requireUserAuth, async (req, res) => {
  try {
    const driver = await db.getUserById(req.userId);
    if (!driver || driver.role !== "driver") {
      return res.status(403).json({ error: "This endpoint is only for driver accounts." });
    }
    const { data, error } = await supabase.from("driver_links")
      .select("id, corp_id, added_at, users:corp_id(name, company, email)")
      .eq("driver_id", req.userId).eq("status", "active");
    if (error) throw error;
    res.json({ companies: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/driver/my-loads — driver's own assigned loads, the real
// dashboard content for a driver's own login.
app.get("/api/driver/my-loads", requireUserAuth, async (req, res) => {
  try {
    const driver = await db.getUserById(req.userId);
    if (!driver || driver.role !== "driver") {
      return res.status(403).json({ error: "This endpoint is only for driver accounts." });
    }
    const { data, error } = await supabase.from("loads")
      .select("*").eq("assigned_driver_id", req.userId).neq("status", "cancelled")
      .order("posted_at", { ascending: false });
    if (error) throw error;
    res.json({ loads: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/loads/:id/assign-driver — admin (or a dispatcher genuinely
// linked to this carrier) assigns a specific driver to run a load the
// company has already accepted. Requires the driver to actually be
// linked to this company — assigning someone who isn't linked would
// give them visibility into a load with no real authorization behind it.
app.patch("/api/loads/:id/assign-driver", requireUserAuth, async (req, res) => {
  try {
    const load = await db.getLoadById(req.params.id);
    if (!load) return res.status(404).json({ error: "Load not found." });

    const requester = await db.getUserById(req.userId);
    // A corp's own login ID may not directly equal load.carrier_id — if
    // whoever bid/accepted the load had switched to a driver sub-profile
    // on the frontend at the time, carrier_id could be that sub-profile's
    // frontend-generated ID instead of the corp's real account ID. Check
    // both: the corp's own ID directly, and every ID inside their own
    // stored members list (in `lanes`), before deciding they don't own it.
    let isOwningCorp = load.carrier_id === req.userId;
    if (!isOwningCorp && requester?.role === "corp") {
      const memberIds = Array.isArray(requester.lanes) ? requester.lanes.map((m) => m.id) : [];
      isOwningCorp = memberIds.includes(load.carrier_id);
    }
    const isLinkedDispatcher = requester?.role === "dispatcher" && await verifyDispatcherLink(req.userId, load.carrier_id);
    if (!isOwningCorp && !isLinkedDispatcher) {
      return res.status(403).json({ error: "You don't have permission to assign a driver on this load." });
    }

    const { driverId } = req.body;
    if (driverId) {
      // A driver could be linked either to the corp's own top-level ID,
      // or in principle to whichever ID actually owns the load — check
      // against the corp's real account ID specifically, since that's
      // what driver_links are always created against.
      const corpIdForLinkCheck = requester?.role === "corp" ? req.userId : load.carrier_id;
      const linked = await verifyDriverLink(driverId, corpIdForLinkCheck);
      if (!linked) return res.status(400).json({ error: "That driver isn't linked to this company's account." });
    }

    const { data, error } = await supabase.from("loads")
      .update({ assigned_driver_id: driverId || null }).eq("id", req.params.id).select().single();
    if (error) throw error;
    res.json({ load: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================================================================
// VERIFICATION FLAGS — a real, persistent record of every carrier
// verification issue, so an operator can see this in the dashboard
// itself, not only via an email that could get missed or filtered.
// ================================================================

// POST /api/verification-flags — open, since this fires during signup
// before an account (and thus a session) necessarily exists yet.
app.post("/api/verification-flags", async (req, res) => {
  try {
    const { data, error } = await supabase.from("verification_flags").insert({
      carrier_name: req.body.carrierName || null,
      carrier_email: req.body.carrierEmail || null,
      flag_type: req.body.flagType,
      severity: req.body.severity || "warning",
      details: req.body.details || null,
    }).select().single();
    if (error) throw error;
    res.json({ flag: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/verification-flags — operator only
app.get("/api/verification-flags", requireOperatorAuth, async (req, res) => {
  try {
    const { data, error } = await supabase.from("verification_flags")
      .select("*").order("created_at", { ascending: false }).limit(200);
    if (error) throw error;
    res.json({ flags: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/verification-flags/:id — operator only, marking as reviewed
app.patch("/api/verification-flags/:id", requireOperatorAuth, async (req, res) => {
  try {
    const { data, error } = await supabase.from("verification_flags")
      .update({ reviewed: req.body.reviewed }).eq("id", req.params.id).select().single();
    if (error) throw error;
    res.json({ flag: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================================================================
// MESSAGES ENDPOINTS
// ================================================================

// POST /api/messages
app.post("/api/messages", requireUserAuth, async (req, res) => {
  try {
    // senderId, role, and name were all trusted directly from the request
    // — meaning anyone logged in could send a message impersonating a
    // different user entirely (e.g. pretending to be the shipper, telling
    // a carrier "payment's already sent, go ahead and deliver"). Now
    // derived from the authenticated user's own real profile.
    const sender = await db.getUserById(req.userId);
    const msg = await db.sendMessage({
      id:         crypto.randomUUID(),
      load_id:    req.body.loadId,
      carrier_id: req.body.carrierId,
      sender_id:  req.userId,
      role:       req.body.role, // shipper/carrier framing of the conversation, not identity
      name:       sender?.name || sender?.company || "Unknown",
      text:       req.body.text,
      sent_at:    new Date().toISOString(),
    });
    res.json({ message: msg });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/messages/:loadId/:carrierId
app.get("/api/messages/:loadId/:carrierId", requireUserAuth, async (req, res) => {
  try {
    // No access control existed here at all — anyone could read any
    // conversation between any shipper and carrier just by knowing the
    // loadId and carrierId, a real privacy exposure for potentially
    // sensitive business communications. Now verifies the requester is
    // genuinely part of this specific conversation.
    const load = await db.getLoadById(req.params.loadId);
    const isOwningShipper = load && load.shipper_id === req.userId;
    const isTheCarrier = req.params.carrierId === req.userId;
    if (!isOwningShipper && !isTheCarrier) {
      return res.status(403).json({ error: "You don't have permission to view this conversation." });
    }
    const messages = await db.getMessages(req.params.loadId, req.params.carrierId);
    res.json({ messages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/messages/inbox/:carrierId — every distinct conversation thread
// for a carrier, across all loads AND non-load-tied messages (like ones
// sent from a shipper's Nearby Capacity page). Without this, a carrier had
// no way to discover a message ever arrived unless it happened to be tied
// to a load they already knew to open — a real gap for anything sent
// outside a specific load's own chat.
app.get("/api/messages/inbox/:carrierId", requireUserAuth, async (req, res) => {
  try {
    // Same gap as the conversation endpoint above — a carrier's entire
    // inbox, every thread across every shipper, was readable by anyone
    // who knew their ID. Only the carrier themselves should see this.
    if (req.params.carrierId !== req.userId) {
      return res.status(403).json({ error: "You don't have permission to view this inbox." });
    }
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("carrier_id", req.params.carrierId)
      .order("sent_at", { ascending: false });
    if (error) throw error;

    const threads = {};
    for (const m of data) {
      if (!threads[m.load_id]) {
        threads[m.load_id] = {
          loadId: m.load_id,
          carrierId: m.carrier_id,
          isGeneral: m.load_id.startsWith("general-"),
          lastMessage: m.text,
          lastSenderName: m.name,
          lastSentAt: m.sent_at,
          messageCount: 0,
        };
      }
      threads[m.load_id].messageCount += 1;
    }
    res.json({ threads: Object.values(threads) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================================================================
// DOCUMENTS ENDPOINTS
// ================================================================

// POST /api/documents
app.post("/api/documents", requireUserAuth, async (req, res) => {
  try {
    const doc = await db.saveDocument({
      id:              crypto.randomUUID(),
      load_id:         req.body.loadId,
      uploaded_by:     req.userId,
      uploaded_by_name: req.body.uploadedByName,
      type:            req.body.type,
      filename:        req.body.filename,
      mime_type:       req.body.mimeType,
      size_bytes:      req.body.sizeBytes,
      data_url:        req.body.dataUrl,
      uploaded_at:     new Date().toISOString(),
    });
    res.json({ document: doc });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/documents/:loadId
app.get("/api/documents/:loadId", requireUserAuth, async (req, res) => {
  try {
    const documents = await db.getDocumentsForLoad(req.params.loadId);
    res.json({ documents });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================================================================
// RATINGS ENDPOINTS
// ================================================================

// POST /api/ratings
app.post("/api/ratings", requireUserAuth, async (req, res) => {
  try {
    // raterUserId was trusted directly from the request — anyone could
    // submit a rating claiming to be from a different user entirely,
    // artificially inflating or deflating someone's real rating. Now
    // derived from the authenticated session, and verified against the
    // load actually being rated.
    const load = await db.getLoadById(req.body.loadId);
    const isOwningShipper = load && load.shipper_id === req.userId;
    const isAssignedCarrier = load && load.carrier_id === req.userId;
    if (!isOwningShipper && !isAssignedCarrier) {
      return res.status(403).json({ error: "You don't have permission to rate on this load." });
    }

    const rating = await db.saveRating({
      id:             crypto.randomUUID(),
      load_id:        req.body.loadId,
      rated_user_id:  req.body.ratedUserId,
      rater_user_id:  req.userId,
      stars:          req.body.stars,
      role:           req.body.role,
      created_at:     new Date().toISOString(),
    });

    const ratedId = req.body.ratedUserId;
    const isTeamMember = typeof ratedId === "string" && ratedId.startsWith("cm");

    if (isTeamMember) {
      // Company/fleet team members live nested inside their corp's own
      // "lanes" field, not as their own row in users — so updating their
      // cached ratings means finding the parent corp and updating that
      // member's entry within the array, not a top-level user update.
      const { data: corps } = await supabase.from("users").select("id, lanes").not("lanes", "is", null);
      const parentCorp = (corps || []).find((c) => Array.isArray(c.lanes) && c.lanes.some((m) => m.id === ratedId));
      if (parentCorp) {
        const allRatingsForMember = await db.getRatingsForUser(ratedId);
        const updatedLanes = parentCorp.lanes.map((m) =>
          m.id === ratedId ? { ...m, ratings: allRatingsForMember.map((r) => r.stars) } : m
        );
        await supabase.from("users").update({ lanes: updatedLanes }).eq("id", parentCorp.id);
      } else {
        console.warn("Rating saved, but no parent corp found for team member:", ratedId);
      }
    } else {
      const ratings = await db.getRatingsForUser(ratedId);
      await db.updateUser(ratedId, { ratings: ratings.map((r) => r.stars) });
    }

    res.json({ rating });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================================================================
// OPERATOR ENDPOINTS
// ================================================================

// POST /api/operator/verify-pin — used only for the initial unlock screen.
// Rate-limited since it's a PIN-guessing surface.
app.post("/api/operator/verify-pin", operatorPinLimiter, (req, res) => {
  if (!process.env.OPERATOR_PIN) return res.status(503).json({ error: "Operator access not configured on the server." });
  const { pin } = req.body;
  res.json({ valid: pin === process.env.OPERATOR_PIN });
});

// POST /api/operator/clear-login-limit — lets you unblock a real shipper or
// carrier immediately, instead of them waiting out the full 15-minute
// window, when they're legitimately in a hurry (not being brute-forced).
app.post("/api/operator/clear-login-limit", requireOperatorAuth, (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "email is required" });
  const key = email.toLowerCase();
  delete loginRequestAttempts[key];
  delete loginVerifyAttempts[key];
  delete loginCodes[key]; // also clear any pending code so they can request a genuinely fresh one
  res.json({ cleared: true, email });
});

// POST /api/operator/toggle-verification-bypass — testing-only switch that
// lets any code work for login. Auto-expires after 1 hour regardless of
// whether anyone remembers to turn it back off, since leaving this on by
// accident would mean anyone could log into any account.
app.post("/api/operator/toggle-verification-bypass", requireOperatorAuth, (req, res) => {
  const { enabled } = req.body;
  if (enabled) {
    verificationBypassUntil = Date.now() + 60 * 60 * 1000; // 1 hour
    console.warn(`⚠️  Login verification bypass ENABLED by operator until ${new Date(verificationBypassUntil).toISOString()}`);
  } else {
    verificationBypassUntil = null;
    console.log("Login verification bypass disabled by operator.");
  }
  res.json({ active: isVerificationBypassActive(), until: verificationBypassUntil });
});

app.get("/api/operator/verification-bypass-status", requireOperatorAuth, (req, res) => {
  res.json({ active: isVerificationBypassActive(), until: verificationBypassUntil });
});

// GET /api/operator/subscription-revenue — real, confirmed subscription
// revenue actually collected via Stripe (not an estimate based on counting
// active accounts x their tier price, like the existing Growth tab MRR).
app.get("/api/operator/subscription-revenue", requireOperatorAuth, async (req, res) => {
  try {
    const { data, error } = await supabase.from("subscription_payments").select("*").order("paid_at", { ascending: false });
    if (error) throw error;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const totalRevenueCents = data.reduce((sum, p) => sum + p.amount_cents, 0);
    const thisMonthCents = data.filter((p) => p.paid_at >= startOfMonth).reduce((sum, p) => sum + p.amount_cents, 0);

    const byPlan = {};
    for (const p of data) {
      const key = p.plan_id || "unknown";
      byPlan[key] = (byPlan[key] || 0) + p.amount_cents;
    }

    res.json({
      totalRevenueCents,
      thisMonthCents,
      paymentCount: data.length,
      byPlan,
      recentPayments: data.slice(0, 20),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/operator/users  (all users for operator dashboard)
// GET /api/users/directory — the general, public-facing user list used to
// populate the site for every visitor (load board, nearby capacity, browsing
// carriers/shippers). Returns only what's needed for that, with genuinely
// sensitive fields stripped out. This used to just be /api/operator/users
// itself, serving double duty — meaning EVERY visitor was getting each
// other's full sensitive data (Stripe account IDs, business verification
// documents, operator notes) with no protection at all, before today's
// security pass. Now regular browsing uses this safe version, and the real
// operator dashboard uses the separately protected endpoint below.
// Deliberately public, no login required — called at app startup before
// login completes, to load the basic directory data the app needs
// regardless of auth status. Kept intentionally limited to the safe,
// curated field list below (no email, phone, Stripe IDs, or documents)
// specifically because it has to stay reachable pre-login.
app.get("/api/users/directory", async (req, res) => {
  try {
    const users = await db.getAllUsers();
    const safe = users.map((u) => ({
      id: u.id, name: u.name, role: u.role, company: u.company,
      equipment_type: u.equipment_type, truck_desc: u.truck_desc, max_weight: u.max_weight,
      dims: u.dims, loc: u.loc, current_zip: u.current_zip, ratings: u.ratings,
      lanes: u.lanes, equipment_status: u.equipment_status, suspended: u.suspended,
      trial_started_at: u.trial_started_at, complimentary: u.complimentary,
      complimentary_expiry: u.complimentary_expiry, stripe_connected: u.stripe_connected,
      payout: u.payout ? { connected: u.payout.connected, provider: u.payout.provider } : null,
      billing_cycle: u.billing_cycle, requested_tier: u.requested_tier,
      factoring_enabled: u.factoring_enabled, factoring_company: u.factoring_company,
      mc_number: u.mc_number, dot_number: u.dot_number, verification: u.verification,
      coi_verified: u.coi_verified, biz_verified: u.biz_verified,
    }));
    res.json({ users: safe });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/operator/users — full, unfiltered user data (Stripe account IDs,
// business/COI verification documents, operator notes, everything) — only
// for the real operator dashboard, protected below.
app.get("/api/operator/users", requireOperatorAuth, async (req, res) => {
  try {
    const users = await db.getAllUsers();
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================================================================
// Page view tracking — no auth required, since anonymous visitors are
// exactly what this is meant to capture. Rate-limited separately from
// everything else since it's a public, unauthenticated write endpoint.
// ================================================================
app.post("/api/track/view", async (req, res) => {
  try {
    const { visitorId, userId, path, referrer } = req.body;
    if (!visitorId) return res.status(400).json({ error: "visitorId is required." });
    await supabase.from("page_views").insert({
      visitor_id: visitorId,
      user_id: userId || null,
      path: path || null,
      referrer: referrer || null,
    });
    res.json({ ok: true });
  } catch (err) {
    // Tracking should never break the app for the visitor it's tracking —
    // fail silently from their perspective.
    res.status(200).json({ ok: false });
  }
});

// GET /api/operator/page-views — aggregated stats, not raw rows, since an
// operator dashboard needs "how many" and "trending which way," not a
// list of every individual hit.
app.get("/api/operator/page-views", requireOperatorAuth, async (req, res) => {
  try {
    const { data: allViews } = await supabase.from("page_views")
      .select("visitor_id, user_id, path, created_at")
      .order("created_at", { ascending: false })
      .limit(20000); // enough for real trend data without pulling an unbounded table

    // period/date are both optional — when neither is given, this behaves
    // exactly as before (all data, last 30 days shown in byDay). When
    // given, "date" is any day within the requested period — for "week"
    // and "month" it's used to find which week/month contains that day,
    // not necessarily the exact start of it.
    const { period, date } = req.query;
    let views = allViews || [];
    let rangeStart = null, rangeEnd = null;

    if (period && date) {
      const anchor = new Date(date + "T00:00:00");
      if (period === "day") {
        rangeStart = new Date(anchor);
        rangeEnd = new Date(anchor);
        rangeEnd.setDate(rangeEnd.getDate() + 1);
      } else if (period === "week") {
        rangeStart = new Date(anchor);
        rangeStart.setDate(rangeStart.getDate() - rangeStart.getDay()); // back up to Sunday
        rangeEnd = new Date(rangeStart);
        rangeEnd.setDate(rangeEnd.getDate() + 7);
      } else if (period === "month") {
        rangeStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
        rangeEnd = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1);
      }
      if (rangeStart && rangeEnd) {
        views = views.filter((v) => {
          const t = new Date(v.created_at).getTime();
          return t >= rangeStart.getTime() && t < rangeEnd.getTime();
        });
      }
    }

    const anonymous = views.filter((v) => !v.user_id);
    const loggedIn = views.filter((v) => !!v.user_id);
    const uniqueAnonymousVisitors = new Set(anonymous.map((v) => v.visitor_id)).size;
    const uniqueReturningUsers = new Set(loggedIn.map((v) => v.user_id)).size;

    // Views by day within whatever range applies — the full 30-day
    // window by default, or just the requested day/week/month.
    const byDay = {};
    for (const v of views) {
      const day = (v.created_at || "").slice(0, 10);
      if (!day) continue;
      if (!byDay[day]) byDay[day] = { anonymous: 0, loggedIn: 0 };
      if (v.user_id) byDay[day].loggedIn++; else byDay[day].anonymous++;
    }
    const sortedDays = Object.keys(byDay).sort();
    const dayEntries = (period && date) ? sortedDays : sortedDays.slice(-30);

    res.json({
      totalViews: views.length,
      anonymousViews: anonymous.length,
      loggedInViews: loggedIn.length,
      uniqueAnonymousVisitors,
      uniqueReturningUsers,
      byDay: dayEntries.map((day) => ({ day, ...byDay[day] })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/operator/recurring-visitors — anyone who's shown up more than
// once, anonymous or logged-in, sorted by whoever's visited the most.
// A logged-in user coming back is expected — that's just normal app use.
// An anonymous visitor coming back multiple times before ever signing up
// is the genuinely interesting signal here: someone who keeps checking
// the site out but hasn't converted yet, which is worth knowing about
// even though there's no name attached to reach out to directly.
app.get("/api/operator/recurring-visitors", requireOperatorAuth, async (req, res) => {
  try {
    const { data: views } = await supabase.from("page_views")
      .select("visitor_id, user_id, created_at")
      .order("created_at", { ascending: false })
      .limit(20000);

    // Group anonymous visits by visitor_id, logged-in visits by user_id —
    // two separate groupings since they mean different things and
    // shouldn't be merged into one count.
    const anonGroups = {};
    const userGroups = {};
    for (const v of views || []) {
      if (v.user_id) {
        if (!userGroups[v.user_id]) userGroups[v.user_id] = { count: 0, first: v.created_at, last: v.created_at };
        userGroups[v.user_id].count++;
        if (v.created_at < userGroups[v.user_id].first) userGroups[v.user_id].first = v.created_at;
        if (v.created_at > userGroups[v.user_id].last) userGroups[v.user_id].last = v.created_at;
      } else if (v.visitor_id) {
        if (!anonGroups[v.visitor_id]) anonGroups[v.visitor_id] = { count: 0, first: v.created_at, last: v.created_at };
        anonGroups[v.visitor_id].count++;
        if (v.created_at < anonGroups[v.visitor_id].first) anonGroups[v.visitor_id].first = v.created_at;
        if (v.created_at > anonGroups[v.visitor_id].last) anonGroups[v.visitor_id].last = v.created_at;
      }
    }

    const recurringAnonymous = Object.entries(anonGroups)
      .filter(([, g]) => g.count >= 2)
      .map(([visitorId, g]) => ({ visitorId, visitCount: g.count, firstSeen: g.first, lastSeen: g.last }))
      .sort((a, b) => b.visitCount - a.visitCount);

    const recurringUserIds = Object.entries(userGroups).filter(([, g]) => g.count >= 2).map(([userId]) => userId);
    let recurringUsers = [];
    if (recurringUserIds.length) {
      const { data: users } = await supabase.from("users").select("id, name, email, role").in("id", recurringUserIds);
      recurringUsers = (users || []).map((u) => ({
        userId: u.id, name: u.name, email: u.email, role: u.role,
        visitCount: userGroups[u.id].count, firstSeen: userGroups[u.id].first, lastSeen: userGroups[u.id].last,
      })).sort((a, b) => b.visitCount - a.visitCount);
    }

    res.json({ recurringAnonymous, recurringUsers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================================================================
// Leads (CRM) — prospects who haven't signed up yet
// ================================================================
app.get("/api/operator/leads", requireOperatorAuth, async (req, res) => {
  try {
    const { data: leads } = await supabase.from("leads").select("*").order("updated_at", { ascending: false });
    res.json({ leads: leads || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/leads/submit — public, no auth. For a visitor who isn't ready
// to create a full account yet but wants a real person to follow up.
// Lands in the exact same pipeline an operator sees when they add a lead
// manually — same stages, same activity log — just self-submitted instead
// of typed in by hand. Any message they leave becomes the first activity
// entry on the lead, so their own words are the first thing an operator
// sees, not lost.
app.post("/api/leads/submit", async (req, res) => {
  try {
    const { name, email, phone, message, roleInterest } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: "A name is required." });
    if (!phone || !phone.trim()) return res.status(400).json({ error: "A phone number is required so we can follow up." });

    const { data: lead, error } = await supabase.from("leads").insert({
      name: name.trim(),
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      role_interest: roleInterest || null,
      source: "website",
    }).select().single();
    if (error) throw error;

    if (message && message.trim()) {
      await supabase.from("activity_log").insert({
        entity_type: "lead", entity_id: lead.id,
        activity_type: "note", content: message.trim(),
      });
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/operator/leads", requireOperatorAuth, async (req, res) => {
  try {
    const { name, email, phone, company, roleInterest, source } = req.body;
    if (!name) return res.status(400).json({ error: "A name is required to add a lead." });
    const { data: lead, error } = await supabase.from("leads").insert({
      name, email: email || null, phone: phone || null, company: company || null,
      role_interest: roleInterest || null, source: source || null,
    }).select().single();
    if (error) throw error;
    res.json({ lead });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch("/api/operator/leads/:id", requireOperatorAuth, async (req, res) => {
  try {
    const allowed = ["name", "email", "phone", "company", "role_interest", "stage", "source", "converted_user_id"];
    const patch = {};
    for (const key of allowed) if (key in req.body) patch[key] = req.body[key];
    patch.updated_at = new Date().toISOString();
    const { data: lead, error } = await supabase.from("leads").update(patch).eq("id", req.params.id).select().single();
    if (error) throw error;
    res.json({ lead });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/operator/leads/:id", requireOperatorAuth, async (req, res) => {
  try {
    await supabase.from("leads").delete().eq("id", req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================================================================
// Activity log (CRM) — works for a lead or a real user, same shape
// ================================================================
app.get("/api/operator/activity/:entityType/:entityId", requireOperatorAuth, async (req, res) => {
  try {
    const { data: activity } = await supabase.from("activity_log")
      .select("*").eq("entity_type", req.params.entityType).eq("entity_id", req.params.entityId)
      .order("created_at", { ascending: false });
    res.json({ activity: activity || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/operator/activity", requireOperatorAuth, async (req, res) => {
  try {
    const { entityType, entityId, activityType, content } = req.body;
    if (!entityType || !entityId) return res.status(400).json({ error: "entityType and entityId are required." });
    const { data: entry, error } = await supabase.from("activity_log").insert({
      entity_type: entityType, entity_id: entityId,
      activity_type: activityType || "note", content: content || null,
    }).select().single();
    if (error) throw error;
    res.json({ activity: entry });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/operator/users/:id/suspend
app.patch("/api/operator/users/:id/suspend", requireOperatorAuth, async (req, res) => {
  try {
    const user = await db.updateUser(req.params.id, { suspended: req.body.suspended });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/operator/users/:id/terminate-permanently — distinct from both
// suspend (temporary) and delete (removes the row entirely). This keeps
// the account's MC/DOT number on file specifically so future signups can
// be checked against it — a hard delete would destroy the very data
// needed to catch someone trying to re-register after a permanent ban.
app.patch("/api/operator/users/:id/terminate-permanently", requireOperatorAuth, async (req, res) => {
  try {
    const user = await db.updateUser(req.params.id, {
      permanently_banned: true,
      suspended: true,
      ban_reason: req.body.reason || null,
      banned_at: new Date().toISOString(),
    });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/operator/users/:id
app.delete("/api/operator/users/:id", requireOperatorAuth, async (req, res) => {
  try {
    // Removing someone here previously only deleted their row in our own
    // database — their Stripe subscription kept running and billing them,
    // and their connected account (for carriers) stayed open, both fully
    // untouched. Manually closing those by hand in the Stripe dashboard
    // isn't reliably possible for a connected account (it requires actual
    // API access, not dashboard-level permissions), so this now handles
    // both automatically, using the platform's own API key.
    const { data: user } = await supabase.from("users").select("billing, payout").eq("id", req.params.id).single();

    if (stripe && user?.billing?.stripeSubscriptionId) {
      try {
        await stripe.subscriptions.cancel(user.billing.stripeSubscriptionId);
      } catch (subErr) {
        console.warn(`Could not cancel Stripe subscription for user ${req.params.id}:`, subErr.message);
      }
    }
    if (stripe && user?.payout?.stripeAccountId) {
      try {
        await stripe.accounts.del(user.payout.stripeAccountId);
      } catch (acctErr) {
        console.warn(`Could not close Stripe connected account for user ${req.params.id}:`, acctErr.message);
      }
    }

    const { error } = await supabase.from("users").delete().eq("id", req.params.id);
    if (error) throw error;
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/auth/account — self-service account deletion. Requires a real
// session token (proving who's asking), and only ever deletes the account
// belonging to that exact same logged-in user — never someone else's, even
// if a different ID were somehow passed in.
app.delete("/api/auth/account", requireUserAuth, async (req, res) => {
  try {
    // Same real gap as the operator's removal endpoint — deleting an
    // account here left the Stripe subscription still billing and any
    // connected account still open, both fully untouched.
    const { data: user } = await supabase.from("users").select("billing, payout").eq("id", req.userId).single();

    if (stripe && user?.billing?.stripeSubscriptionId) {
      try {
        await stripe.subscriptions.cancel(user.billing.stripeSubscriptionId);
      } catch (subErr) {
        console.warn(`Could not cancel Stripe subscription for user ${req.userId}:`, subErr.message);
      }
    }
    if (stripe && user?.payout?.stripeAccountId) {
      try {
        await stripe.accounts.del(user.payout.stripeAccountId);
      } catch (acctErr) {
        console.warn(`Could not close Stripe connected account for user ${req.userId}:`, acctErr.message);
      }
    }

    const { error } = await supabase.from("users").delete().eq("id", req.userId);
    if (error) throw error;
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================================================================
// FMCSA CARRIER VERIFICATION
// ================================================================
const FREE_WINDOW_MS     = 2 * 60 * 60 * 1000;
const DETENTION_RATE_HR  = 60;
const INCREMENT_MIN      = 15;
const DETENTION_CAP      = 300; // absolute max, regardless of how long a carrier sits — without
                                 // this, a carrier stuck at a facility for days would generate an
                                 // ever-growing, uncapped charge to a real shipper's real card
// 5 miles, not 1 — facility coordinates are derived from the origin ZIP
// code's centroid (real geocoding, not exact street address), and ZIP codes
// can span several miles, especially in less dense areas. A tight 1-mile
// radius would incorrectly reject carriers who are genuinely on-site.
const GEOFENCE_RADIUS_MI = 5.0;
const detentionStore     = {};

function haversineMilesServer(lat1, lng1, lat2, lng2) {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calcDetention(arrivalAt, departureAt) {
  const dwellMs  = (departureAt || Date.now()) - arrivalAt;
  const overMs   = Math.max(0, dwellMs - FREE_WINDOW_MS);
  const billMin  = Math.ceil((overMs / 60000) / INCREMENT_MIN) * INCREMENT_MIN;
  const amount   = Math.min(DETENTION_CAP, parseFloat(((billMin / 60) * DETENTION_RATE_HR).toFixed(2)));
  return { dwellMs, billMin, amount };
}

// Checks a newly-verified MC/DOT number against every permanently-banned
// account on file. MC/DOT numbers are persistent, real-world identifiers —
// unlike an email address, someone evading a ban can't easily get a new
// one — so an exact match here is a genuinely strong signal, not a guess.
async function checkBanEvasion(mcNumber, dotNumber) {
  const cleanMc = mcNumber ? String(mcNumber).replace(/\D/g, "") : null;
  const cleanDot = dotNumber ? String(dotNumber).replace(/\D/g, "") : null;
  if (!cleanMc && !cleanDot) return null;

  const { data: bannedUsers } = await supabase.from("users").select("id, name, company, mc_number, dot_number, ban_reason, banned_at").eq("permanently_banned", true);
  if (!bannedUsers || !bannedUsers.length) return null;

  const match = bannedUsers.find((u) =>
    (cleanMc && u.mc_number && String(u.mc_number).replace(/\D/g, "") === cleanMc) ||
    (cleanDot && u.dot_number && String(u.dot_number).replace(/\D/g, "") === cleanDot)
  );
  return match || null;
}

app.get("/api/carrier-verify", verifyLimiter, async (req, res) => {
  const { mc, dot } = req.query;
  if (!mc && !dot) return res.status(400).json({ error: "Provide mc or dot" });
  try {
    const fmcsaData = await fetchFmcsa({ mc, dot });
    const result = mergeCarrierData(fmcsaData, null);

    const banMatch = await checkBanEvasion(result.mcNumber, result.dotNumber);
    if (banMatch) {
      result.banEvasionDetected = true;
      console.warn("BAN EVASION ATTEMPT DETECTED:", { mcNumber: result.mcNumber, dotNumber: result.dotNumber, previouslyBannedAccount: banMatch.id, previousBanReason: banMatch.ban_reason });
      if (emailjsNode) {
        try {
          await emailjsNode.send(EMAILJS_SERVICE_ID, EMAILJS_BAN_EVASION_TEMPLATE, {
            to_email: "ashton@directfreightco.com",
            mc_number: result.mcNumber || "N/A",
            dot_number: result.dotNumber || "N/A",
            legal_name: result.legalName || "Unknown",
            previous_ban_reason: banMatch.ban_reason || "Not recorded",
            previous_account_id: banMatch.id,
          });
        } catch (emailErr) {
          console.error("Ban evasion alert email failed to send:", JSON.stringify(emailErr));
        }
      } else {
        console.warn("EMAILJS_PRIVATE_KEY not set — ban evasion detected but not emailed. Check server logs for details.");
      }
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/insurance-verify", verifyLimiter, async (req, res) => {
  const { mc, dot } = req.query;
  if (!mc && !dot) return res.status(400).json({ error: "Provide mc or dot" });
  try {
    const fmcsaData = await fetchFmcsa({ mc, dot });
    const result = mergeCarrierData(fmcsaData, null);
    res.json({
      legalName: result.legalName, dotNumber: result.dotNumber, mcNumber: result.mcNumber,
      insuranceStatus: result.insuranceStatus,
      autoLiabilityCoverage: result.autoLiabilityCoverage,
      cargoCoverage: result.cargoCoverage,
      dataSource: "FMCSA",
      note: "Insurance data from FMCSA public records — add SaferWatch for real-time COI verification",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function fetchFmcsa({ mc, dot }) {
  const key = process.env.FMCSA_API_KEY;
  if (!key) throw new Error("FMCSA_API_KEY not set");
  let dotNumber = dot;
  if (!dotNumber && mc) dotNumber = await resolveMcToDot(mc, key);
  if (!dotNumber) throw new Error("Could not resolve DOT number from MC number provided");
  const carrierResp = await fetch(`https://mobile.fmcsa.dot.gov/qc/services/carriers/${dotNumber}?webKey=${key}`);
  if (carrierResp.status === 401 || carrierResp.status === 403) throw new Error("FMCSA API key rejected");
  if (carrierResp.status === 404) throw new Error("No carrier found for that DOT/MC number");
  if (!carrierResp.ok) throw new Error(`FMCSA error ${carrierResp.status}`);
  const carrierJson = await carrierResp.json();
  const carrier = carrierJson?.content?.carrier;
  if (!carrier) throw new Error("FMCSA returned no carrier data");
  let safetyJson = null;
  try {
    const sr = await fetch(`https://mobile.fmcsa.dot.gov/qc/services/carriers/${dotNumber}/basics?webKey=${key}`);
    if (sr.ok) safetyJson = await sr.json();
  } catch (_) {}
  return { carrier, safety: safetyJson?.content, dotNumber };
}

async function resolveMcToDot(mc, key) {
  const mcNum = mc.replace(/\D/g, "");
  const resp = await fetch(`https://mobile.fmcsa.dot.gov/qc/services/carriers/docket-number/${mcNum}?webKey=${key}`);
  if (!resp.ok) return null;
  const json = await resp.json();
  return json?.content?.carrier?.dotNumber || null;
}

function mergeCarrierData(fmcsaResult, insuranceResult) {
  const { carrier, safety, dotNumber } = fmcsaResult;
  const rawAuth = carrier?.allowedToOperate === "Y" ? "AUTHORIZED" : carrier?.statusCode === "R" ? "REVOKED" : "NOT AUTHORIZED";
  const rawRating = carrier?.safetyRating?.toUpperCase?.() || "NOT RATED";
  const safetyRating = ["SATISFACTORY", "CONDITIONAL", "UNSATISFACTORY"].includes(rawRating) ? rawRating : "NOT RATED";
  const insuranceOnFile = carrier?.bipdInsuranceRequired === "Y" ? carrier?.bipdInsuranceOnFile === "Y" : true;
  const autoLiabilityCoverage = insuranceResult?.autoLiability ?? (insuranceOnFile ? Number(carrier?.bipdRequiredAmount) || 750000 : 0);
  const cargoCoverage = insuranceResult?.cargo ?? (insuranceOnFile ? Number(carrier?.cargoInsuranceOnFile === "Y" ? 100000 : 0) : 0);
  return {
    legalName: carrier?.legalName || carrier?.dbaName || "Unknown",
    dotNumber: String(dotNumber || carrier?.dotNumber || ""),
    mcNumber: carrier?.mcNumber ? `MC-${carrier.mcNumber}` : null,
    authorityStatus: rawAuth,
    safetyRating,
    oosRateVehicle: Math.round((safety?.vehicleInspectionOosRate ?? 0) * 100) / 100,
    oosRateDriver: Math.round((safety?.driverInspectionOosRate ?? 0) * 100) / 100,
    crashCount24mo: safety?.crashTotal ?? 0,
    insuranceStatus: insuranceOnFile && rawAuth === "AUTHORIZED" ? "ACTIVE" : "LAPSED",
    autoLiabilityCoverage,
    cargoCoverage,
  };
}

// ================================================================
// PERIODIC CARGO INSURANCE EXPIRATION REMINDERS — previously, a carrier's
// uploaded Certificate of Insurance was only ever checked once, at signup,
// with no way to know if it later expired. This runs daily and sends
// reminder emails at 30 and 7 days before the carrier's own stated
// expiration date, then flags it once actually expired.
//
// Note: this deliberately does NOT auto-check or auto-lock against FMCSA's
// Auto Liability "insurance on file" status — that data is known to lag
// behind reality (insurers don't always file updates promptly with FMCSA),
// which risks locking out carriers who are genuinely, currently insured.
// ================================================================
const COI_REMINDER_TEMPLATE = process.env.EMAILJS_COI_REMINDER_TEMPLATE || "YOUR_COI_REMINDER_TEMPLATE"; // create this template in EmailJS

async function sendInsuranceEmail(templateVars) {
  if (!emailjsNode) { console.warn("EMAILJS_PRIVATE_KEY not set — insurance alert not emailed:", templateVars); return; }
  if (COI_REMINDER_TEMPLATE === "YOUR_COI_REMINDER_TEMPLATE") { console.warn("COI reminder template not yet created in EmailJS — insurance alert not emailed:", templateVars); return; }
  try {
    await emailjsNode.send(EMAILJS_SERVICE_ID, COI_REMINDER_TEMPLATE, templateVars);
  } catch (err) {
    console.error("Insurance alert email failed to send:", err.status, err.text);
  }
}

async function checkAllCarrierInsurance() {
  console.log("Running daily insurance re-verification check…");
  try {
    const { data: carriers, error } = await supabase.from("users").select("*").eq("role", "trucker");
    if (error) throw error;

    for (const carrier of carriers) {
      // Note: automatic re-checking + auto-locking against FMCSA's Auto
      // Liability "insurance on file" status was removed — FMCSA's data
      // here is known to lag behind reality (insurers don't always file
      // updates promptly), so auto-locking real, currently-insured carriers
      // off of it was a real risk of false lockouts. The Cargo insurance
      // expiration reminders below are unaffected, since those are based
      // entirely on what the carrier themselves uploaded, not FMCSA.

      // 2. Self-reported Cargo COI expiration reminders (FMCSA doesn't track this)
      const expiryStr = carrier.coi_data?.expirationDate;
      if (expiryStr) {
        const expiryDate = new Date(expiryStr);
        if (!isNaN(expiryDate)) {
          const daysUntil = Math.ceil((expiryDate - Date.now()) / (1000 * 60 * 60 * 24));
          if (daysUntil <= 30 && daysUntil > 7 && carrier.coi_reminder_30_sent_for !== expiryStr) {
            await sendInsuranceEmail({
              to_email: carrier.email, carrier_name: carrier.name,
              alert_type: `Cargo insurance expires in ${daysUntil} days`,
              message: `Your Certificate of Insurance on file is set to expire on ${expiryStr}. Please upload a current one soon to avoid any interruption.`,
            });
            await supabase.from("users").update({ coi_reminder_30_sent_for: expiryStr }).eq("id", carrier.id);
          } else if (daysUntil <= 7 && daysUntil > 0 && carrier.coi_reminder_7_sent_for !== expiryStr) {
            await sendInsuranceEmail({
              to_email: carrier.email, carrier_name: carrier.name,
              alert_type: `Cargo insurance expires in ${daysUntil} days`,
              message: `Your Certificate of Insurance on file expires very soon, on ${expiryStr}. Please upload a current one right away.`,
            });
            await supabase.from("users").update({ coi_reminder_7_sent_for: expiryStr }).eq("id", carrier.id);
          } else if (daysUntil <= 0 && !carrier.coi_data?.isExpired) {
            await supabase.from("users").update({ coi_data: { ...carrier.coi_data, isExpired: true } }).eq("id", carrier.id);
            await sendInsuranceEmail({
              to_email: carrier.email, carrier_name: carrier.name,
              alert_type: "Cargo insurance has expired",
              message: `Your Certificate of Insurance on file expired on ${expiryStr}. Please upload a current one as soon as possible.`,
            });
          }
        }
      }
    }
  } catch (err) {
    console.error("Daily insurance check failed:", err.message);
  }
}

// Run once shortly after startup, then every 24 hours
setTimeout(checkAllCarrierInsurance, 30 * 1000);
setInterval(checkAllCarrierInsurance, 24 * 60 * 60 * 1000);

// Detention tracking + live position tracking
const positionStore = {}; // { [loadId]: { lat, lng, updatedAt, carrierId } }

// TESTING TOOL — lets an operator backdate a load's recorded arrival time,
// so the real calcDetention() logic runs against real elapsed time (just
// simulated instead of actually waited-out) — genuinely useful for
// confirming detention billing works correctly without sitting at a real
// facility for 2+ hours. Never exposed to shippers or carriers.
app.post("/api/operator/testing/simulate-detention", requireOperatorAuth, (req, res) => {
  const { loadId, hoursAgo } = req.body;
  if (!loadId || hoursAgo == null) return res.status(400).json({ error: "loadId and hoursAgo are required" });
  const arrivalAt = Date.now() - (Number(hoursAgo) * 60 * 60 * 1000);
  detentionStore[loadId] = {
    loadId, carrierId: detentionStore[loadId]?.carrierId || null,
    facilityLat: detentionStore[loadId]?.facilityLat || 0, facilityLng: detentionStore[loadId]?.facilityLng || 0,
    arrivalAt, departureAt: null, charged: false,
  };
  const detention = calcDetention(arrivalAt, Date.now());
  res.json({
    loadId, arrivalAt, simulatedHoursAgo: Number(hoursAgo),
    detentionMinutes: detention.billMin, detentionAmount: detention.amount,
    note: "This backdates the arrival timestamp for testing only — no real GPS check-in happened. Check the load's real detention display in the app to confirm it reflects this correctly.",
  });
});

app.post("/api/tracking/ping", requireUserAuth, async (req, res) => {
  const { loadId, carrierId, lat, lng, facilityLat, facilityLng } = req.body;
  if (!loadId || lat == null || lng == null || facilityLat == null || facilityLng == null)
    return res.status(400).json({ error: "loadId, lat, lng, facilityLat, facilityLng required" });
  // Detention pay is real money — without verifying who's actually
  // sending this ping, anyone could spoof a fake "arrival" at a facility
  // and trigger real detention charges without genuinely being there.
  const load = await db.getLoadById(loadId);
  if (!load || load.carrier_id !== req.userId) {
    return res.status(403).json({ error: "You don't have permission to send tracking updates for this load." });
  }
  const now = Date.now();

  // Always record the carrier's latest real GPS position for the shipper's live map,
  // regardless of whether they're inside the detention geofence or not.
  positionStore[loadId] = { lat, lng, updatedAt: now, carrierId: carrierId || null };

  const distMiles = haversineMilesServer(lat, lng, facilityLat, facilityLng);
  const insideGeofence = distMiles <= GEOFENCE_RADIUS_MI;

  // Real, persistent location history — every ping, not just the current
  // position — so a full trail exists later if it's ever needed to review
  // a dispute or question about where a carrier actually was.
  supabase.from("location_pings").insert({
    load_id: loadId, carrier_id: carrierId || null, lat, lng,
    dist_miles: parseFloat(distMiles.toFixed(3)), inside_geofence: insideGeofence,
  }).then(({ error }) => { if (error) console.warn("Location ping not saved to DB:", error.message); });

  let record = detentionStore[loadId];
  if (insideGeofence && !record) {
    record = { loadId, carrierId, facilityLat, facilityLng, arrivalAt: now, departureAt: null, charged: false, arrivalLat: lat, arrivalLng: lng };
    detentionStore[loadId] = record;
    // Persist the real arrival event to the load itself, not just memory
    supabase.from("loads").update({
      detention_arrival_at: new Date(now).toISOString(), detention_arrival_lat: lat, detention_arrival_lng: lng,
    }).eq("id", loadId).then(({ error }) => { if (error) console.warn("Detention arrival not saved to DB:", error.message); });
  }
  if (!insideGeofence && record && !record.departureAt) {
    record.departureAt = now;
    record.departureLat = lat;
    record.departureLng = lng;
    const { amount } = calcDetention(record.arrivalAt, now);
    record.detentionAmount = amount;
    record.charged = amount > 0;
    // Persist the real departure event too
    supabase.from("loads").update({
      detention_departure_at: new Date(now).toISOString(), detention_departure_lat: lat, detention_departure_lng: lng,
    }).eq("id", loadId).then(({ error }) => { if (error) console.warn("Detention departure not saved to DB:", error.message); });
  }
  const detention = record ? calcDetention(record.arrivalAt, record.departureAt || now) : null;
  res.json({ loadId, distMiles: parseFloat(distMiles.toFixed(3)), insideGeofence, arrivalAt: record?.arrivalAt || null, departureAt: record?.departureAt || null, freeWindowExpired: record ? (now - record.arrivalAt) > FREE_WINDOW_MS : false, detentionActive: record && !record.departureAt && (now - record.arrivalAt) > FREE_WINDOW_MS, detentionMinutes: detention?.billMin || 0, detentionAmount: detention?.amount || 0, charged: record?.charged || false });
});

// GET /api/operator/load-history/:loadId — the real, persisted arrival/
// departure record and full GPS trail for a load, for reviewing a
// detention dispute or any question about where a carrier actually was.
// Unlike the in-memory detentionStore, this survives server restarts.
app.get("/api/operator/load-history/:loadId", requireOperatorAuth, async (req, res) => {
  try {
    const { data: load, error: loadErr } = await supabase.from("loads")
      .select("id, detention_arrival_at, detention_arrival_lat, detention_arrival_lng, detention_departure_at, detention_departure_lat, detention_departure_lng, picked_up_at, delivered_at, tracking_started_at")
      .eq("id", req.params.loadId).single();
    if (loadErr) throw loadErr;
    const { data: pings, error: pingsErr } = await supabase.from("location_pings")
      .select("*").eq("load_id", req.params.loadId).order("created_at", { ascending: true });
    if (pingsErr) throw pingsErr;
    res.json({ load, pings: pings || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/tracking/status/:loadId", (req, res) => {
  const record = detentionStore[req.params.loadId];
  if (!record) return res.json({ loadId: req.params.loadId, tracked: false });
  const detention = calcDetention(record.arrivalAt, record.departureAt || Date.now());
  res.json({ loadId: record.loadId, tracked: true, arrivalAt: record.arrivalAt, departureAt: record.departureAt, detentionMinutes: detention.billMin, detentionAmount: detention.amount, charged: record.charged });
});

// Explicit "I'm leaving now" — lets a carrier end detention tracking
// immediately (whether they were on continuous GPS or checked in manually),
// instead of only detecting departure reactively from the next location
// ping showing them outside the geofence.
app.post("/api/tracking/checkout", (req, res) => {
  const { loadId } = req.body;
  if (!loadId) return res.status(400).json({ error: "loadId required" });
  const record = detentionStore[loadId];
  if (!record) return res.json({ loadId, tracked: false });
  if (!record.departureAt) {
    const now = Date.now();
    record.departureAt = now;
    const { amount } = calcDetention(record.arrivalAt, now);
    record.detentionAmount = amount;
    record.charged = amount > 0;
  }
  const detention = calcDetention(record.arrivalAt, record.departureAt);
  res.json({ loadId, tracked: true, arrivalAt: record.arrivalAt, departureAt: record.departureAt, detentionMinutes: detention.billMin, detentionAmount: detention.amount, charged: record.charged, insideGeofence: false, detentionActive: false });
});

// Real-time carrier GPS position — used by shipper's live tracking map.
// Returns null/notFound until the carrier has tapped "Start tracking" at least once.
app.get("/api/tracking/position/:loadId", async (req, res) => {
  let pos = positionStore[req.params.loadId];
  // Falls back to the real, persisted ping history if the in-memory cache
  // doesn't have it — e.g. right after a server restart, before any new
  // ping has come in yet to repopulate the memory-only store.
  if (!pos) {
    const { data } = await supabase.from("location_pings")
      .select("lat, lng, carrier_id, created_at")
      .eq("load_id", req.params.loadId).order("created_at", { ascending: false }).limit(1).single();
    if (data) pos = { lat: data.lat, lng: data.lng, carrierId: data.carrier_id, updatedAt: new Date(data.created_at).getTime() };
  }
  if (!pos) return res.json({ loadId: req.params.loadId, hasPosition: false });
  const ageMs = Date.now() - pos.updatedAt;
  res.json({
    loadId: req.params.loadId,
    hasPosition: true,
    lat: pos.lat,
    lng: pos.lng,
    updatedAt: pos.updatedAt,
    ageSeconds: Math.round(ageMs / 1000),
    stale: ageMs > 5 * 60 * 1000, // no ping in 5+ minutes — carrier may have stopped tracking
  });
});


// ================================================================
// DISPUTES ENDPOINTS
// ================================================================

// POST /api/disputes
app.post("/api/disputes", requireUserAuth, async (req, res) => {
  try {
    // filedBy was trusted directly from the request — anyone logged in
    // could file a dispute claiming to be a different user entirely,
    // including false accusations against a real person. Now derived from
    // the authenticated session, and verified against the actual load.
    const load = await db.getLoadById(req.body.loadId);
    const isOwningShipper = load && load.shipper_id === req.userId;
    const isAssignedCarrier = load && load.carrier_id === req.userId;
    if (!isOwningShipper && !isAssignedCarrier) {
      return res.status(403).json({ error: "You don't have permission to file a dispute on this load." });
    }
    const filer = await db.getUserById(req.userId);
    const { data, error } = await supabase.from("disputes").insert({
      id:             crypto.randomUUID(),
      load_id:        req.body.loadId,
      filed_by:       req.userId,
      filed_by_name:  filer?.name || filer?.company || "Unknown",
      filed_by_role:  isOwningShipper ? "shipper" : "carrier",
      against_id:     req.body.againstId,
      against_name:   req.body.againstName,
      type:           req.body.type,
      description:    req.body.description,
      status:         "open",
      created_at:     new Date().toISOString(),
    }).select().single();
    if (error) throw error;
    res.json({ dispute: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/disputes
app.get("/api/disputes", requireOperatorAuth, async (req, res) => {
  try {
    const { data } = await supabase.from("disputes").select("*").order("created_at", { ascending: false });
    res.json({ disputes: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/disputes/:id
app.patch("/api/disputes/:id", requireOperatorAuth, async (req, res) => {
  try {
    const { data, error } = await supabase.from("disputes").update({ ...req.body, updated_at: new Date().toISOString() }).eq("id", req.params.id).select().single();
    if (error) throw error;
    res.json({ dispute: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Note: this file previously had a
// POST /api/disputes/:id/release-payment endpoint, letting an operator
// unilaterally move real payment on a disputed load. It was deliberately
// removed — the Terms of Service state disputes are resolved directly
// between the parties, with funds releasing once both confirm resolution.
// An operator unilaterally deciding to release payment ran ahead of what
// the platform's own terms actually promise, and edged closer to acting as
// a decision-maker in user disputes rather than a technical facilitator.
// Payment release for a disputed load now only ever happens through the
// shipper's own release action, same as any other load.

// ================================================================
// SAFERWATCH INSURANCE MONITORING
// When you get a SaferWatch API key, set SAFERWATCH_API_KEY in
// Railway env vars and this endpoint will return real-time data.
// ================================================================
app.get("/api/insurance-monitor/:dotNumber", async (req, res) => {
  const key = process.env.SAFERWATCH_API_KEY;
  if (!key) {
    return res.json({
      monitored: false,
      message: "SaferWatch not configured — add SAFERWATCH_API_KEY to Railway environment variables",
      dotNumber: req.params.dotNumber,
    });
  }
  try {
    const resp = await fetch(`https://api.saferwatch.com/v1/carrier/${req.params.dotNumber}`, {
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
    });
    if (!resp.ok) throw new Error(`SaferWatch error ${resp.status}`);
    const data = await resp.json();
    res.json({ monitored: true, ...data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ================================================================
// WAITLIST ENDPOINTS
// First 100 signups get a 30% off promo code automatically
// ================================================================
const WAITLIST_PROMO_LIMIT = 100;
// Real, server-side launch cutoff — set to the actual go-live moment. The
// frontend also gates this, but a discount is a real financial promise, so
// it can't rely on client-side gating alone: anyone calling this endpoint
// directly, bypassing the UI entirely, must still be correctly refused the
// early-bird discount once launched, regardless of how many of the 100
// spots happened to be claimed before that moment.
const WAITLIST_PROMO_CUTOFF = new Date("2026-10-01T14:00:00Z"); // matches LAUNCH_DATE in the frontend — update both together
const WAITLIST_DISCOUNT    = 20; // 20% off for 3 months

// Generates a random, non-sequential promo code so codes can't be guessed
// or brute-forced (the old EARLY001-EARLY100 format was fully predictable).
// Avoids visually ambiguous characters (0/O, 1/I/L) for easy manual entry.
function generatePromoCode(position) {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[crypto.randomInt(chars.length)];
  }
  return `EARLY-${code}`;
}

// POST /api/waitlist
app.post("/api/waitlist", async (req, res) => {
  const { name, email, role, company, phone } = req.body;
  if (!name || !email || !role) return res.status(400).json({ error: "name, email, role required" });
  if (!company || !company.trim()) return res.status(400).json({ error: "Business name is required." });

  try {
    // Check if already on waitlist
    const { data: existing } = await supabase.from("waitlist").select("*").eq("email", email.toLowerCase()).single();
    if (existing) return res.status(409).json({ error: "already_on_waitlist", position: existing.position, promoCode: existing.promo_code });

    // Get current count for position
    const { count } = await supabase.from("waitlist").select("*", { count: "exact", head: true });
    const position = (count || 0) + 1;
    // Early-bird discount removed entirely — the waitlist form itself is
    // no longer part of the public site (replaced with a plain countdown
    // to the real launch date), so no new promo codes are generated going
    // forward. Existing codes already issued to earlier signups remain
    // valid and viewable in the operator dashboard as historical record.
    const isEarlyBird = false;
    const promoCode = null;

    const { data, error } = await supabase.from("waitlist").insert({
      id:         crypto.randomUUID(),
      name,
      email:      email.toLowerCase(),
      role,
      company:    company || null,
      phone:      phone || null,
      position,
      promo_code: promoCode,
      promo_sent: false,
      converted:  false,
      created_at: new Date().toISOString(),
    }).select().single();

    if (error) throw error;

    res.json({
      success:    true,
      position,
      total:      position,
      isEarlyBird,
      promoCode,
      discount:   isEarlyBird ? WAITLIST_DISCOUNT : 0,
      spotsLeft:  Math.max(0, WAITLIST_PROMO_LIMIT - position),
    });
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "already_on_waitlist" });
    res.status(500).json({ error: err.message });
  }
});

// GET /api/waitlist/count
app.get("/api/waitlist/count", async (req, res) => {
  try {
    // Deliberately never exposes the exact signup count, even to someone
    // calling this endpoint directly rather than going through the UI —
    // the frontend only ever needs to know which of three states applies
    // (sold out / almost gone / plenty left), not the real number.
    const { count } = await supabase.from("waitlist").select("*", { count: "exact", head: true });
    const spotsLeft = Math.max(0, WAITLIST_PROMO_LIMIT - (count || 0));
    const status = spotsLeft <= 0 ? "sold_out" : spotsLeft <= 20 ? "almost_gone" : "available";
    res.json({ status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/waitlist/promo/:code — validate a waitlist early-bird promo code.
// Checks it exists, hasn't already been redeemed, and returns the benefit.
// This is the real, persisted source of truth — the code stays valid
// forever until someone actually redeems it (no expiration date).
app.get("/api/waitlist/promo/:code", async (req, res) => {
  try {
    const code = req.params.code.trim().toUpperCase();
    const { data: entry } = await supabase.from("waitlist").select("*").eq("promo_code", code).single();
    if (!entry) return res.status(404).json({ valid: false, error: "Invalid promo code." });
    if (entry.promo_redeemed) return res.status(409).json({ valid: false, error: "This promo code has already been used." });
    res.json({
      valid: true,
      code,
      discountPercent: WAITLIST_DISCOUNT,
      durationMonths: 3,
      waitlistEntryId: entry.id,
      name: entry.name,
    });
  } catch (err) {
    res.status(500).json({ valid: false, error: err.message });
  }
});

// POST /api/waitlist/promo/:code/redeem — marks a waitlist promo code as
// used, tied to the user redeeming it. One-time use, enforced server-side.
app.post("/api/waitlist/promo/:code/redeem", async (req, res) => {
  try {
    const code = req.params.code.trim().toUpperCase();
    const { userId } = req.body;
    const { data: entry } = await supabase.from("waitlist").select("*").eq("promo_code", code).single();
    if (!entry) return res.status(404).json({ error: "Invalid promo code." });
    if (entry.promo_redeemed) return res.status(409).json({ error: "This promo code has already been used." });

    const { data: updated, error } = await supabase.from("waitlist").update({
      promo_redeemed: true,
      promo_redeemed_at: new Date().toISOString(),
      promo_redeemed_by_user_id: userId || null,
    }).eq("id", entry.id).select().single();
    if (error) throw error;

    res.json({ success: true, discountPercent: WAITLIST_DISCOUNT, durationMonths: 3, entry: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/waitlist  (operator only)
app.get("/api/waitlist", requireOperatorAuth, async (req, res) => {
  try {
    const { data } = await supabase.from("waitlist").select("*").order("position");
    res.json({ waitlist: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/waitlist/:id  (mark converted, promo_sent, etc)
app.patch("/api/waitlist/:id", requireOperatorAuth, async (req, res) => {
  try {
    const { data, error } = await supabase.from("waitlist").update(req.body).eq("id", req.params.id).select().single();
    if (error) throw error;
    res.json({ entry: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================================================================
// STRIPE — CONNECT (Express accounts) for carrier payouts
// Express uses Account Links, not OAuth — no Client ID needed, and it
// gives carriers a much lighter onboarding built for marketplace sellers,
// instead of the full "run your own Stripe business" Standard experience.
// ================================================================

// Carrier clicks "Connect with Stripe" → this creates (or reuses) an Express
// connected account, then sends them to Stripe's hosted onboarding link.
app.get("/api/stripe/connect/authorize", async (req, res) => {
  if (!stripe) return res.status(503).json({ error: "Stripe not configured on the server yet." });
  const { userId, corpId, email, returnOrigin } = req.query;
  if (!userId) return res.status(400).json({ error: "userId is required" });
  const origin = safeFrontendOrigin(returnOrigin);
  const targetId = corpId || userId;

  try {
    // Reuse an existing Express account for this user if one was already
    // started, instead of creating a duplicate on every retry.
    const { data: existing } = await supabase.from("users").select("payout").eq("id", targetId).single();
    let accountId = existing?.payout?.stripeAccountId;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: email || undefined,
        // Requesting transfers alone (a "recipient-only" account) requires
        // special approval from Stripe before it works — the exact error
        // seen in testing. Carriers here never actually process card
        // payments directly (the shipper's card is charged by the
        // platform, then transferred to the carrier), but requesting
        // card_payments alongside transfers avoids that approval
        // requirement entirely, without changing how payments actually work.
        capabilities: { transfers: { requested: true }, card_payments: { requested: true } },
      });
      accountId = account.id;
      await supabase.from("users").update({
        payout: { connected: false, provider: "Stripe Connect (Express)", stripeAccountId: accountId },
      }).eq("id", targetId);
    }

    const returnParams = encodeURIComponent(JSON.stringify({ userId, corpId: corpId || null, origin, accountId }));
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${API_URL}/api/stripe/connect/authorize?userId=${userId}${corpId ? `&corpId=${corpId}` : ""}&returnOrigin=${encodeURIComponent(origin)}`,
      return_url: `${API_URL}/api/stripe/connect/express-return?data=${returnParams}`,
      type: "account_onboarding",
    });
    res.redirect(accountLink.url);
  } catch (err) {
    console.error("Stripe Express Connect error:", err.message);
    res.redirect(`${origin}/?stripe_connect=error`);
  }
});

// Stripe sends the carrier back here once they finish (or leave) onboarding.
app.get("/api/stripe/connect/express-return", async (req, res) => {
  let userId = null, corpId = null, origin = ALLOWED_FRONTEND_ORIGINS[0], accountId = null;
  try {
    const parsed = JSON.parse(decodeURIComponent(req.query.data || "{}"));
    userId = parsed.userId; corpId = parsed.corpId; accountId = parsed.accountId;
    origin = safeFrontendOrigin(parsed.origin);
  } catch (_) {}

  if (!stripe || !accountId) return res.redirect(`${origin}/?stripe_connect=error`);

  try {
    // Check the REAL account status with Stripe — Account Links don't tell
    // you whether onboarding actually finished, only that they came back.
    const account = await stripe.accounts.retrieve(accountId);
    const fullyOnboarded = account.details_submitted && account.charges_enabled;
    const targetId = corpId || userId;

    await supabase.from("users").update({
      payout: { connected: fullyOnboarded, provider: "Stripe Connect (Express)", stripeAccountId: accountId },
    }).eq("id", targetId);

    res.redirect(`${origin}/?stripe_connect=${fullyOnboarded ? "success" : "incomplete"}`);
  } catch (err) {
    console.error("Stripe Express return check error:", err.message);
    res.redirect(`${origin}/?stripe_connect=error`);
  }
});

// ================================================================
// STRIPE — SUBSCRIPTION CHECKOUT (Checkout Session, hosted by Stripe)
// Real card entry happens on Stripe's own secure page — raw card numbers
// never touch this backend, satisfying PCI compliance automatically.
// ================================================================
app.post("/api/stripe/create-checkout-session", async (req, res) => {
  if (!stripe) return res.status(503).json({ error: "Stripe not configured on the server yet." });
  const { userId, email, planId, billingCycle, planLabel, returnOrigin } = req.body;
  if (!userId || !email || !planId) return res.status(400).json({ error: "userId, email, and planId are required" });

  const amountCents = getPlanAmountCents(planId, billingCycle);
  if (!amountCents) return res.status(400).json({ error: `Unknown plan: ${planId}` });
  const origin = safeFrontendOrigin(returnOrigin);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: email,
      client_reference_id: userId,
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: { name: `Direct Freight Co — ${planLabel || planId} (${billingCycle === "annual" ? "Annual" : "Monthly"})` },
          unit_amount: amountCents,
          recurring: { interval: billingCycle === "annual" ? "year" : "month" },
        },
        quantity: 1,
      }],
      subscription_data: {
        metadata: { userId, planId, billingCycle: billingCycle || "monthly" },
        // Real, Stripe-enforced trial — 60 days (2 months), matching the
        // launch offer. This is what actually controls when billing
        // starts; the UI text elsewhere must stay in sync with this
        // number, since a mismatch here means charging someone before
        // the date the app itself promised. Applies to every plan type
        // uniformly, including dispatcher tiers.
        trial_period_days: 60,
      },
      // Managed Payments is Stripe's international merchant-of-record feature
      // (indirect tax compliance across 80+ countries) — not relevant to a
      // US-only domestic subscription business, and it requires product tax
      // codes we don't need. Explicitly disabled here since some accounts
      // now enable it by default.
      managed_payments: { enabled: false },
      success_url: `${origin}/?stripe_checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?stripe_checkout=cancelled`,
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error("Checkout session error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ================================================================
// STRIPE — LOAD PAYMENT (direct charge to carrier's connected account)
// Matches your "sellers collect funds directly" Connect setup — money goes
// straight to the carrier, this platform never holds it.
// ================================================================
// Shared payment release logic — used by both the shipper's manual
// "release payment" button and the automatic release job below. Kept as
// one function specifically so there's only ever one real implementation
// of this money-moving logic to maintain, not two copies that could
// silently drift apart from each other over time.
async function releaseLoadPayment({ loadId, amountCents, quickPay, returnTrip, requestingUserId }) {
  const load = await db.getLoadById(loadId);
  if (!load) throw new Error("Load not found.");
  if (requestingUserId && load.shipper_id !== requestingUserId) {
    const err = new Error("You don't have permission to release payment on this load.");
    err.status = 403;
    throw err;
  }
  if (!load.carrier_id) {
    const err = new Error("This load shows no carrier assigned in the database, even if one appears assigned in the app. An operator can fix this directly from the operator dashboard's Loads tab using 'Edit / Fix'.");
    err.status = 400;
    throw err;
  }

  const shipper = await db.getUserById(load.shipper_id);
  const carrier = await db.getUserById(load.carrier_id);
  const shipperCustomerId = shipper?.billing?.stripeCustomerId;
  const carrierStripeAccountId = carrier?.payout?.stripeAccountId;
  if (!shipperCustomerId) { const e = new Error("No payment method on file for this shipper."); e.status = 400; throw e; }
  if (!carrierStripeAccountId) { const e = new Error("This carrier hasn't connected a payout account yet."); e.status = 400; throw e; }

  const customer = await stripe.customers.retrieve(shipperCustomerId);
  const paymentMethodId = customer.invoice_settings?.default_payment_method
    || (await stripe.paymentMethods.list({ customer: shipperCustomerId, type: "card", limit: 1 })).data[0]?.id;
  if (!paymentMethodId) { const e = new Error("This shipper has no saved card on file yet — they need to complete a Stripe Checkout session first."); e.status = 400; throw e; }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: "usd",
    customer: shipperCustomerId,
    payment_method: paymentMethodId,
    off_session: true,
    confirm: true,
    transfer_data: { destination: carrierStripeAccountId },
    metadata: { loadId, quickPay: quickPay ? "true" : "false", returnTrip: returnTrip ? "true" : "false" },
    // With Standard connected accounts, an application_fee_amount can be
    // added here later if a per-transaction platform fee is ever introduced.
    // Direct Freight Co currently charges 0% commission on loads.
  });
  return paymentIntent;
}

// ================================================================
// AUTO-RELEASE — protects carriers from a shipper who simply never
// clicks "release payment" after a real delivery. Without this, a
// carrier's only recourse was manually filing a dispute and hoping —
// there was no actual mechanism forcing money to move at all. This
// runs periodically and releases payment automatically once a load
// has been delivered for AUTO_RELEASE_DAYS, unless a dispute was
// filed on that load before the window closed. A filed dispute always
// takes priority — this never overrides an active dispute, since
// disputes are meant to resolve directly between the parties, not be
// steamrolled by an automatic timer.
// ================================================================
const AUTO_RELEASE_DAYS = 5;

async function runAutoReleaseCheck() {
  if (!stripe) return; // nothing to do if Stripe isn't configured yet
  try {
    const cutoff = new Date(Date.now() - AUTO_RELEASE_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { data: candidates, error } = await supabase.from("loads")
      .select("id, price, carrier_id, delivered_at")
      .eq("paid", false)
      .not("delivered_at", "is", null)
      .lte("delivered_at", cutoff)
      .neq("status", "cancelled");
    if (error) throw error;
    if (!candidates?.length) return;

    for (const load of candidates) {
      try {
        // A dispute filed on this load, at any point — even one already
        // marked resolved — blocks auto-release entirely. Once a human
        // dispute has been involved in a load, payment release on it
        // should only ever happen through a deliberate action by the
        // shipper or an operator, never by an automatic timer that has
        // no way to know whether "resolved" actually means paid.
        const { data: disputes } = await supabase.from("disputes")
          .select("id").eq("load_id", load.id);
        if (disputes?.length) continue;

        if (!load.carrier_id || !load.price) continue;

        const paymentIntent = await releaseLoadPayment({
          loadId: load.id,
          amountCents: Math.round(load.price * 100),
        });

        await supabase.from("loads").update({
          paid: true,
          paid_at: new Date().toISOString(),
          auto_released: true,
        }).eq("id", load.id);

        console.log(`Auto-released payment for load ${load.id} — delivered ${AUTO_RELEASE_DAYS}+ days ago, no dispute filed. PaymentIntent: ${paymentIntent.id}`);
      } catch (loadErr) {
        // One load failing (e.g. a carrier's payout account disconnected)
        // shouldn't stop the rest of the batch from being checked.
        console.error(`Auto-release failed for load ${load.id}:`, loadErr.message);
      }
    }
  } catch (err) {
    console.error("Auto-release check failed:", err.message);
  }
}

// Runs on a real interval since this is a long-running process, not a
// one-off script — checks every 6 hours, which is frequent enough that
// no load sits meaningfully past its actual release window.
setInterval(runAutoReleaseCheck, 6 * 60 * 60 * 1000);
// Also run once shortly after server startup, so a redeploy doesn't mean
// waiting up to 6 hours before the first check happens.
setTimeout(runAutoReleaseCheck, 60 * 1000);

app.post("/api/stripe/pay-load", requireUserAuth, async (req, res) => {
  if (!stripe) return res.status(503).json({ error: "Stripe not configured on the server yet." });
  const { amountCents, loadId, quickPay, returnTrip } = req.body;
  if (!amountCents || !loadId) {
    return res.status(400).json({ error: "amountCents and loadId are required" });
  }
  try {
    const paymentIntent = await releaseLoadPayment({ loadId, amountCents, quickPay, returnTrip, requestingUserId: req.userId });
    res.json({ paymentIntentId: paymentIntent.id, status: paymentIntent.status });
  } catch (err) {
    console.error("Load payment error:", err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ================================================================
// STRIPE — BILLING PORTAL (real payment method updates, invoice history,
// and subscription management, all handled by Stripe's own hosted page —
// replaces the previous "email us to update your card" placeholder).
// ================================================================
app.post("/api/stripe/create-billing-portal-session", requireUserAuth, async (req, res) => {
  if (!stripe) return res.status(503).json({ error: "Stripe not configured on the server yet." });
  const { customerId, returnOrigin } = req.body;
  if (!customerId) return res.status(400).json({ error: "customerId is required" });
  // Being logged in isn't enough on its own — without this check, any
  // logged-in user could open any other user's billing portal, just by
  // knowing or guessing their Stripe customer ID.
  const requester = await db.getUserById(req.userId);
  if (requester?.billing?.stripeCustomerId !== customerId) {
    return res.status(403).json({ error: "You don't have permission to access this billing portal." });
  }
  try {
    const origin = safeFrontendOrigin(returnOrigin);
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/`,
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error("Billing portal session error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ================================================================
// STRIPE — QUICKPAY (real instant payout on a carrier's connected account)
// The standard payout above already sends real money to the carrier's
// Stripe balance — this specifically makes an already-transferred balance
// pay out to their bank FASTER (minutes instead of Stripe's ~2 business
// day standard schedule), for the 1.5% fee already shown in the app.
// ================================================================
app.post("/api/stripe/instant-payout", requireUserAuth, async (req, res) => {
  if (!stripe) return res.status(503).json({ error: "Stripe not configured on the server yet." });
  const { carrierStripeAccountId, amountCents } = req.body;
  if (!carrierStripeAccountId || !amountCents) {
    return res.status(400).json({ error: "carrierStripeAccountId and amountCents are required" });
  }
  // Confirms the authenticated user actually owns this connected account —
  // without this, anyone could trigger an instant payout (and its 1.5% fee)
  // on a carrier's account without their consent, just by knowing their
  // Stripe account ID. This always pays out to that same account's own
  // linked bank, so it can't redirect money elsewhere, but taking an
  // unauthorized action — and cost — on someone else's account is still a
  // real problem worth closing.
  const requester = await db.getUserById(req.userId);
  if (requester?.payout?.stripeAccountId !== carrierStripeAccountId) {
    return res.status(403).json({ error: "You don't have permission to request a payout on this account." });
  }
  try {
    const payout = await stripe.payouts.create(
      { amount: amountCents, currency: "usd", method: "instant" },
      { stripeAccount: carrierStripeAccountId }
    );
    res.json({ payoutId: payout.id, status: payout.status, arrivalDate: payout.arrival_date });
  } catch (err) {
    console.error("Instant payout error:", err.message);
    // Instant payout isn't available on every card/bank — a clear, specific
    // error here (rather than a generic 500) helps the frontend explain why.
    res.status(400).json({ error: err.message });
  }
});

// ================================================================
// STRIPE WEBHOOK — real event handling, signature-verified
// ================================================================
app.post("/api/webhooks/stripe", express.raw({ type: "application/json" }), async (req, res) => {
  if (!stripe) return res.status(503).send("Stripe not configured.");
  const sig = req.headers["stripe-signature"];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.client_reference_id;
        if (userId) {
          // The card's real last4/brand/expiry were never actually being
          // fetched here — billing.connected was set true, but nothing
          // populated the fields the UI displays, which is why every
          // account showed "Card ending in ····" regardless of what card
          // was actually used.
          let cardDetails = {};
          try {
            const customer = await stripe.customers.retrieve(session.customer, {
              expand: ["invoice_settings.default_payment_method"],
            });
            let paymentMethod = customer.invoice_settings?.default_payment_method;
            if (!paymentMethod || typeof paymentMethod === "string") {
              const methods = await stripe.paymentMethods.list({ customer: session.customer, type: "card", limit: 1 });
              paymentMethod = methods.data[0] || null;
            }
            if (paymentMethod?.card) {
              cardDetails = {
                brand: paymentMethod.card.brand,
                last4: paymentMethod.card.last4,
                exp: `${String(paymentMethod.card.exp_month).padStart(2, "0")}/${String(paymentMethod.card.exp_year).slice(-2)}`,
              };
            }
          } catch (cardErr) {
            console.warn("Could not fetch real card details after checkout:", cardErr.message);
          }

          // Removed the $1 verify-then-refund charge that used to run here —
          // Stripe refunds the charge itself but keeps its own processing
          // fee (roughly 2.9% + $0.30), meaning every single new signup was
          // quietly costing the platform real money (about $0.33 each),
          // permanently, not just during testing. Not worth the ongoing
          // cost for the fraud protection it added.
          await supabase.from("users").update({
            stripe_connected: true,
            billing: { connected: true, stripeCustomerId: session.customer, stripeSubscriptionId: session.subscription, ...cardDetails },
            trial_started_at: new Date().toISOString(),
          }).eq("id", userId);
        }
        break;
      }
      case "invoice.payment_succeeded": {
        // Real, confirmed revenue — fires for both the first payment and
        // every renewal, only once Stripe has actually collected the money.
        const invoice = event.data.object;
        try {
          const subscription = invoice.subscription
            ? await stripe.subscriptions.retrieve(invoice.subscription)
            : null;
          await supabase.from("subscription_payments").upsert({
            stripe_customer_id: invoice.customer,
            stripe_invoice_id: invoice.id,
            amount_cents: invoice.amount_paid,
            plan_id: subscription?.metadata?.planId || null,
            billing_cycle: subscription?.metadata?.billingCycle || null,
            paid_at: new Date(invoice.status_transitions?.paid_at * 1000 || Date.now()).toISOString(),
          }, { onConflict: "stripe_invoice_id" });
        } catch (revErr) {
          console.error("Could not record subscription payment:", revErr.message);
        }

        // Referral reward — deliberately placed here, on the first REAL
        // payment, not at signup or checkout completion. Applying it any
        // earlier (while the person is still in their free trial) would let
        // someone refer a friend, get the reward immediately, and have that
        // friend cancel before ever actually paying anything — this waits
        // for genuine, confirmed revenue before rewarding anyone.
        //
        // Flat reward, not scaled to the referred person's own payment —
        // deliberately bigger for a shipper referral than a carrier
        // referral, made explicit rather than left as a quiet side effect
        // of shippers simply paying more. A referred Company account is
        // classified the same way the frontend already infers shipping vs.
        // trucking companies — equipment_type present means trucking.
        try {
          const referredUserId = subscription?.metadata?.userId;
          if (referredUserId) {
            const { data: referredUser } = await supabase.from("users")
              .select("id, role, equipment_type, referred_by, referral_reward_applied").eq("id", referredUserId).single();
            if (referredUser?.referred_by && !referredUser.referral_reward_applied) {
              const { data: referrer } = await supabase.from("users")
                .select("id, name, email, billing").eq("referral_code", referredUser.referred_by).maybeSingle();
              const referrerCustomerId = referrer?.billing?.stripeCustomerId;
              if (referrerCustomerId) {
                const isShipperSide = referredUser.role === "shipper" || (referredUser.role === "corp" && !referredUser.equipment_type);
                const REFERRAL_REWARD_SHIPPER_CENTS = 5000; // $50 flat — referring a shipper
                const REFERRAL_REWARD_CARRIER_CENTS = 2000; // $20 flat — referring a carrier, dispatcher, driver, or trucking company
                const rewardCents = isShipperSide ? REFERRAL_REWARD_SHIPPER_CENTS : REFERRAL_REWARD_CARRIER_CENTS;

                // Credits the referrer's Stripe balance a flat amount,
                // automatically applied against their own next real charge —
                // not a manual coupon someone has to remember to redeem.
                await stripe.customers.createBalanceTransaction(referrerCustomerId, {
                  amount: -rewardCents,
                  currency: invoice.currency,
                  description: `Referral reward — ${referredUser.id} completed their first payment (${isShipperSide ? "shipper" : "carrier"} referral)`,
                });
                await supabase.from("users").update({ referral_reward_applied: true }).eq("id", referredUserId);
                console.log(`Referral reward applied: ${referrerCustomerId} credited $${(rewardCents / 100).toFixed(2)} for referring ${referredUserId} (${isShipperSide ? "shipper" : "carrier"})`);
              }
            }
          }
        } catch (refErr) {
          console.error("Could not apply referral reward:", refErr.message);
        }
        break;
      }
      case "invoice.payment_failed": {
        console.warn("Invoice payment failed for subscription:", event.data.object.subscription);
        // Consider: flag the account, email the user, or restrict posting until resolved.
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const userId = sub.metadata?.userId;
        if (userId) await supabase.from("users").update({ stripe_connected: false }).eq("id", userId);
        break;
      }
      default:
        break; // Unhandled event types are fine to ignore for now.
    }
    res.json({ received: true });
  } catch (err) {
    console.error("Webhook handler error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ================================================================
// HEALTH CHECK
// ================================================================


// ================================================================
// AI DOCUMENT VERIFICATION — server-side proxy to Anthropic
// Used for COI (insurance) and business document verification, both
// of which send a base64 file (image or PDF) plus a prompt. Same
// reasoning as the chatbot proxy did — this can never work as a direct
// browser call to api.anthropic.com once deployed.
// ================================================================
// ================================================================
// NAIC INSURER REGISTRY — a real, genuine reference dataset pulled
// directly from NAIC's own official "Listing of Companies" publication
// (content.naic.org), covering major national insurers and all Ohio-based
// insurers. Used to cross-check a COI's stated NAIC number against the
// actual, real registry — catching a fabricated or mismatched insurer
// that an AI reading the document's format alone couldn't detect, since
// AI verification only confirms a document *looks* right, not that the
// insurer named on it genuinely exists.
//
// Honest limitation: this is a partial reference set (a few hundred of
// the several thousand entries in NAIC's full registry), so a real,
// legitimate insurer simply not being in this list is a genuine
// possibility — a "not found" result should be treated as "needs a second
// look," not automatic proof of fraud. A code that IS found but doesn't
// match the stated insurer name is a much stronger red flag.
const NAIC_REGISTRY = {"11":"MAINE EMPLOYERS MUT INS CO","18":"RESPONSE INS GRP","19":"AETNA CAS GRP","26":"COMBINED STMT OF MS & AD GRP OF C","28":"NEW YORK CENTRAL MUT FIRE INS CO","29":"PROASSURANCE CORP GRP & AFFIL","31":"ASSOC INDUSTRIES OF MA MUT INS CO","32":"NCMIC INS CO & AFFIL","37":"BUILDERS INS & AFFIL","40":"ISMIE INS GRP","42":"EASTERN ALLIANCE INS & AFFIL","47":"FIRST ACCEPTANCE INS CO INC & AFF","50":"FOUNDERS INS CO MI & AFFIL","51":"ALFA INS GRP","52":"WISCONSIN CNTY MUT & AFFIL","53":"EMPLOYERS INS GRP","54":"ALLIED WORLD ASSUR CO US INC","56":"AXIS SPECIALTY INS CO & AFFIL","57":"PARTNER REINS CO OF THE US & AFFI","59":"TUSCARORA WAYNE MUT INS CO","64":"RED SHIELD INS CO","65":"JAMES RIVER INS GRP","66":"SOMPO GRP","67":"ATAIN SPECIALTY INS CO & ITS AFFI","70":"TRAVELERS COS & AFFIL","73":"ENUMCLAW INS GRP","74":"AMERICAN INDEPENDENT COMPANIES IN","78":"FEDERATED MUT GRP","80":"FARMERS & MECHANICS INS COS","84":"ACCIDENT FUND INS CO OF AMER & AF","85":"FIDELITY NATL INS CO & SUBSIDIARI","86":"ALLSTATE INS CO GRP","87":"GEOVERA HOLDINGS INC GRP","93":"CUMIS INS SOCIETY & AFFILIATE","96":"PRIME HOLDINGS INS GRP","124":"AMERICAN INTL GRP INC","154":"LOYA INS CO & AFFIL","176":"FIRST STATE GRP","191":"ASSURANT GRP","221":"MERRIMACK MUT GRP","260":"AMERICAN HALLMARK INS CO OF TX &","280":"AMICA MUT GRP","285":"COPPERPOINT MUT INS CO & ITS AFFI","294":"DTRIC INS CO LTD & AFFIL","297":"SKYWARD SPECIALTY INS GRP INC","301":"IMT INS CO & AFFILIATE","310":"NATIONAL IND CO GRP","317":"BUILDERS MUT INS CO & AFFIL","329":"BITUMINOUS CAS GRP","337":"CALIFORNIA CAS GRP","353":"CELINA MUT GRP","361":"CENTRAL MUT OF OH GRP","377":"PURE INS CO & AFFILIATE","379":"MENDOTA INS CO & AFFILIATES","380":"PACIFIC SPECIALTY INS CO & AFFILI","381":"HISCOX INS CO INC & AFFILIATE","384":"TECHNOLOGY INS CO INC & AFFIL","399":"HARCO NATIONAL INS CO & ITS AFFIL","412":"STARR INDEMNITY AND LIABILITY CO","433":"ARCH MORTGAGE INS CO AND ITS AFFI","440":"SAFETY FIRST INS CO & ITS AFFILIA","447":"CHURCH MUT INS CO & ITS AFFILIATE","460":"BUCKEYE INS GRP","468":"JEWELERS MUT INS CO & AFFIL","473":"MINNESOTA LAWYERS MUT INS CO & IT","482":"ASMI AUTO INS CO & AFFILIATES","507":"COUNTRY MUT OF IL GRP","524":"SPINNAKER INS CO & AFFILIATES","529":"TESLA INS CO & AFFILIATES","535":"LIO INS CO & AFFILIATES","540":"CUMBERLAND INS GRP","548":"WEST BEND INS CO & AFFILIATES","554":"LOUISIANA WORKERS COMPENSATION CO","558":"AUTO CLUB INS ASSN","573":"SUNZ INS CO & AFFILIATE","620":"EMPLOYERS MUT CO OF DES MOINES","623":"CRUM & FORSTER INS","626":"ACE AMER INS CO & AFFIL","634":"OHIO MUT GRP","637":"ROCKINGHAM GRP","655":"GLOBAL","667":"EVEREST REINS CO","671":"FARM BUREAU OF MI GRP","698":"FARMERS INS GRP","712":"PALISADES INS GRP","723":"SERVICE LLOYDS GRP","727":"ARCH CAPITAL GRP INC","734":"CSAA INS EXCH AND ITS AFFILIATED","738":"FRANKENMUTH MUT INS GRP","743":"GREENWHICH INS CO & AFFILIATES","745":"AUTO CLUB ENTERPRISES INS & AFFIL","795":"MOTORS INS CORP GRP","833":"GRANGE INS ASSN & AFFIL","841":"GREAT AMER INS CO & AFFILIATES","884":"HANOVER INS CO GRP","914":"HARTFORD FIRE GRP","981":"BERKLEY CORP","1058":"MORTGAGE GUAR INS CORP & AFFIL","1112":"LIBERTY MUT GRP","1236":"SHELTER MUT INS CO & AFFILIATES","1244":"AMERISURE MUT INS CO & AFFIL","1279":"AMERICAN MODERN INS GRP INC","1406":"NATIONWIDE GRP","1503":"OLD REPUBLIC INS GRP","1554":"PROGRESSIVE CAS GRP","1694":"SENTRY INS A MUT CO GRP","1767":"STATE FARM MUT GRP","1813":"SWISS RE AMER CORP GRP","2003":"UNITED SERV AUTOMOBILE ASSN & AFF","2127":"ZURICH INS CO GRP","2135":"ERIE INS EXCH GRP","2186":"CONTINENTAL CAS GRP","2429":"SELECTIVE INS GRP","2445":"CINCINNATI INS GRP","2488":"UNITED FIRE & CAS GRP","2801":"AUTO OWNERS INS CO & AFFIL","2917":"ENCOVA MUT INS COS","3000":"HORACE MANN GRP","4731":"AMERICAN FAMILY INS GRP","6602":"MERCURY CAS GRP","7838":"RLI INS CO GRP","8427":"FARM BUREAU GRP","9229":"INSURANCE CO OF THE WEST GRP","10014":"AFFILIATED FM INS CO","10030":"WESTCHESTER FIRE INS CO","10052":"CHUBB NATL INS CO","10064":"CITIZENS PROP INS CORP","10070":"NATIONWIDE IND CO","10105":"VICTORIA SELECT INS CO","10127":"ALLIED INS CO OF AMER","10176":"CITIZENS INS CO OF OH","10192":"PROGRESSIVE SELECT INS CO","10193":"PROGRESSIVE EXPRESS INS CO","10194":"ARTISAN & TRUCKERS CAS CO","10202":"OHIO MUT INS CO","10245":"AMERICAN FEDERATION INS CO","10254":"WEST & KNOX MUT INS CO","10255":"WASHINGTON MUT INS ASSOC","10261":"WASHINGTON CO FARMERS MUT INS ASS","10264":"NORTON MUT FIRE ASSN","10266":"PARIS & WASHINGTON INS CO","10267":"PATRONS BUCKEYE MUT INS CO","10268":"PIKE MUT INS CO","10269":"RICHMOND FARMERS MUT INS CO","10270":"SANDY & BEAVER VALLEY FARMERS MUT","10271":"SONNENBERG MUT INS ASSOC","10272":"SPRINGFIELD TWP MUT INS ASSOC","10275":"UNITED MUT INS CO OF HANCOCK CO","10279":"MENNONITE MUT AID SOCIETY","10281":"MARION MUT INS ASSN","10288":"INTEGRITY SELECT INS CO","10303":"FARMERS MUT AID ASSN","10304":"FARMERS MUT INS CO","10305":"FARMERS MUT INS CO OF HARRISON CT","10306":"WYANDOT MUT INS CO","10307":"GERMAN FARMERS MUT FIRE INS CO","10309":"GERMAN FARMERS MUT OF SARDIS INS","10311":"GERMAN MUT INS CO OF DELPHOS","10322":"GRANGE IND INS CO","10330":"LUCAS CNTY MUT INS ASS OC","10331":"EASTERN OH MUT FIRE & TORNADO","10334":"GERMAN MUT INS ASSOC OF GLANDORF","10345":"COMMUNITY INS COMPANY","10396":"PERRY CNTY MUT FIRE INS CO","10397":"PUTNAM CNTY FARMERS MUT INS ASSOC","10399":"WOODVILLE MUT INS ASSOC","10645":"DRIVERS INS CO","10674":"HARLEYSVILLE INS CO OF NY","10677":"THE CINCINNATI INS CO","10719":"UNITED MUT INS CO","10723":"NATIONWIDE ASSUR CO","10739":"STATE FARM FL INS CO","10948":"NATIONWIDE INS CO OF FL","10974":"ROOT INS CO","11017":"STATE AUTO INS CO OF OH","11034":"BRISTOL W CAS INS CO","11051":"NATIONAL INTERSTATE INS CO OF HI","11136":"GRANGE INS CO OF MI","11197":"NATIONAL INDEPENDENT TRUCKERS IC","11518":"PARAMOUNT INS CO","11738":"INFINITY AUTO INS CO","11770":"UNITED FINANCIAL CAS CO","11828":"STONEWOOD INS CO","11851":"PROGRESSIVE ADVANCED INS CO","11982":"GRANGE PROP & CAS INS CO","11991":"NATIONAL CAS CO","12203":"JAMES RIVER INS CO","12302":"PROGRESSIVE FREEDOM INS CO","12475":"REPUBLIC FRANKLIN INS CO","12750":"EVERGREEN NATL IND CO","12879":"PROGRESSIVE COMMERCIAL CAS CO","12938":"FEDERAL MOTOR CARRIERS RRG INC","12986":"INTEGRITY PROP & CAS INS CO","13072":"UNITED OHIO INS CO","13331":"MOTORISTS COMMERCIAL MUT INS CO","13685":"JAMES RIVER CAS CO","13794":"MID CONTINENT EXCESS AND SURPLUS","13938":"FARMERS LLOYDS INS CO TX","13998":"UTICA NATL INS CO OF OH","14060":"GRANGE INS CO","14127":"GRANGE INS CO","14303":"INTEGRITY INS CO","14621":"MOTORISTS MUT INS CO","15380":"MID CONTINENT ASSUR CO","15580":"SCOTTSDALE IND CO","15736":"VERTI INS CO","16011":"NATIONAL TRANSPORTATION INS CO RR","16025":"TRANSPORT RISK SOLUTIONS RRG INC"};

app.get("/api/naic-lookup/:code", (req, res) => {
  const code = String(req.params.code).replace(/\D/g, "");
  const registryName = NAIC_REGISTRY[code];
  res.json({
    code,
    found: !!registryName,
    registryName: registryName || null,
  });
});

app.post("/api/ai-verify-document", async (req, res) => {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return res.status(503).json({ error: "ai_not_configured", message: "ANTHROPIC_API_KEY not set on the server yet." });
  }
  const { fileBase64, mimeType, prompt } = req.body;
  if (!fileBase64 || !mimeType || !prompt) {
    return res.status(400).json({ error: "fileBase64, mimeType, and prompt are required" });
  }

  const isImage = mimeType.startsWith("image/");
  const isPdf = mimeType === "application/pdf";
  if (!isImage && !isPdf) {
    return res.status(400).json({ error: "Only PDF, JPG, or PNG files are supported." });
  }

  const contentBlock = isPdf
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: fileBase64 } }
    : { type: "image", source: { type: "base64", media_type: mimeType, data: fileBase64 } };

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        messages: [{ role: "user", content: [contentBlock, { type: "text", text: prompt }] }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic API error:", response.status, errText);
      return res.status(502).json({ error: "anthropic_error", message: "AI verification service unavailable — please try again." });
    }

    const data = await response.json();
    const raw = (data.content || []).map((c) => c.text || "").join("");
    res.json({ raw });
  } catch (err) {
    console.error("AI document verify proxy error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Jo — a real AI chat assistant for platform questions, grounded in the
// platform's actual current facts (not left to guess or hallucinate).
// Kept current with real values elsewhere in this file — if pricing,
// trial length, or detention rate change, this system prompt needs
// updating too, or Jo starts giving wrong answers confidently.
const JO_SYSTEM_PROMPT = `You are Jo, the AI assistant for Direct Freight Co — a freight marketplace connecting shippers and carriers directly, with no broker taking a cut. Slogan: "No Brokers · No Cut · No BS."

Answer questions accurately using only the real facts below. If someone asks something you don't have a real answer for, say so honestly and suggest they contact support directly (ashton@directfreightco.com) rather than guessing.

REAL PLATFORM FACTS:
- Launch date: October 1st, 2026
- Free trial: 2 months, starting from signup — card is required at signup (so carriers can be paid for real loads), but no subscription fee is charged during the trial
- Pricing after trial: Carriers $30/mo (or $300/yr, 2 months free), Shippers $70/mo (or $700/yr), Companies from $350/mo depending on team size (Starter 5-10 profiles, Growth 11-50, Fleet 51-150, Enterprise 151-500)
- Zero commission on any load, ever — the subscription is the only fee
- No contract — month-to-month, cancel anytime
- Carrier verification: real DOT/MC and insurance checks against FMCSA, usually completed in minutes. No minimum authority age required — brand new authority is treated the same as an aged one
- Every bid shown to a shipper displays the carrier's real FMCSA safety rating (Satisfactory/Conditional/Unsatisfactory) and insurance status
- Real-time GPS tracking runs automatically on every load, pickup to delivery
- Detention pay: $60/hour, starts accruing automatically after a 2-hour free window at pickup or delivery, no claim needs to be filed
- Payment: shippers release payment manually, or it auto-releases automatically 5 days after delivery if no dispute has been filed — carriers are never left waiting indefinitely
- QuickPay: carriers can choose free standard payout (1-2 business days) or instant payout in minutes for a 1.5% fee (Stripe's real cost, not a markup) — instant payout isn't available on every bank/card (~99% qualify; prepaid cards and some smaller banks don't)
- Leased authority: supported, but only through a Company account — the authority-holding company must add the driver directly and verify them, not a self-signup process
- Dispatchers: a carrier can add a dispatcher by email from their account settings ("Manage Dispatchers"). A dispatcher can then act on that carrier's behalf — bidding on loads and booking them — once added
- Company accounts require real proof that a team member has a genuine business relationship with the company (a payroll stub, 1099, or W-2 matching the company's own EIN), and truck drivers additionally need to be a named driver on the company's Certificate of Insurance
- Disputes are resolved directly between the shipper and carrier — Direct Freight Co doesn't mediate or decide outcomes, and doesn't unilaterally move payment on a disputed load

TONE: Direct, plainspoken, genuinely helpful — matching the brand's honest, no-nonsense voice. Keep answers concise. Never invent numbers, policies, or features not listed above.`;

// Site lock — a real, operator-controlled maintenance mode. Public read
// (every visitor's browser needs to check this before rendering anything),
// operator-only write. Lets the operator test the actual live, deployed
// site without real visitors seeing it mid-test — the operator's own
// access still works while locked, through the existing hidden PIN-access
// bypass (Ctrl+Shift+O or ?opaccess=1), which was already built for
// exactly this kind of "operator gets in regardless" situation.
app.get("/api/site-status", async (req, res) => {
  try {
    const { data } = await supabase.from("site_settings").select("value").eq("key", "site_locked").maybeSingle();
    res.json({ locked: data?.value === true });
  } catch (err) {
    // Fail open, not closed — a database hiccup should never accidentally
    // lock real visitors out of a live site with no way back in.
    res.json({ locked: false });
  }
});

app.post("/api/site-lock", requireOperatorAuth, async (req, res) => {
  const { locked } = req.body;
  if (typeof locked !== "boolean") return res.status(400).json({ error: "locked (boolean) is required" });
  try {
    const { error } = await supabase.from("site_settings").upsert({ key: "site_locked", value: locked, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) throw error;
    res.json({ locked });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/chat", async (req, res) => {
  // Jo is intentionally on hold — put here on purpose, not left running
  // idle. This stops the endpoint before it ever reaches the Anthropic
  // API, so there's genuinely zero cost risk regardless of how this
  // endpoint might be reached (the frontend widget is unmounted too, but
  // this endpoint itself was never behind auth, so this guard matters on
  // its own). To bring Jo back later: delete this block, then remount
  // <JoChatWidget /> in ComingSoonScreen, ShipperApp, and TruckerApp.
  return res.status(503).json({
    error: "jo_on_hold",
    message: "Jo isn't available right now — check back once we're further along.",
  });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return res.status(503).json({ error: "ai_not_configured", message: "ANTHROPIC_API_KEY not set on the server yet." });
  }
  const { message, history } = req.body;
  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "message is required" });
  }
  // History is trusted only as prior conversation turns, capped so one
  // long-running chat can't balloon token usage — the last 12 turns is
  // plenty of real context for a support-style conversation.
  const priorTurns = Array.isArray(history) ? history.slice(-12) : [];
  const messages = [
    ...priorTurns.filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: message },
  ];

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 600,
        system: JO_SYSTEM_PROMPT,
        messages,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic API error (chat):", response.status, errText);
      return res.status(502).json({ error: "anthropic_error", message: "Jo is temporarily unavailable — please try again in a moment." });
    }

    const data = await response.json();
    const reply = (data.content || []).map((c) => c.text || "").join("");
    res.json({ reply });
  } catch (err) {
    console.error("Chat proxy error:", err.message);
    res.status(500).json({ error: err.message });
  }
});


app.get("/api/health", async (req, res) => {
  let dbConnected = false;
  try {
    const { error } = await supabase.from("users").select("id").limit(1);
    dbConnected = !error;
  } catch (_) {}
  res.json({
    status: "ok",
    fmcsaKeyConfigured: !!process.env.FMCSA_API_KEY,
    supabaseConfigured: !!process.env.SUPABASE_URL,
    supabaseUsingServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    databaseConnected: dbConnected,
    stripeKeyConfigured: !!process.env.STRIPE_SECRET_KEY,
    stripeConnectConfigured: !!stripe, // Express Connect only needs the Stripe secret key, not a Client ID
    stripeWebhookConfigured: !!process.env.STRIPE_WEBHOOK_SECRET,
    secureLoginEmailConfigured: !!emailjsNode,
    emailjsPrivateKeyDebug: process.env.EMAILJS_PRIVATE_KEY
      ? { present: true, length: process.env.EMAILJS_PRIVATE_KEY.length }
      : { present: false }, // TEMPORARY — remove once this is solved
    aiVerificationConfigured: !!process.env.ANTHROPIC_API_KEY,
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`\n╔══════════════════════════════════════╗`);
  console.log(`║   HaulDirect API — port ${PORT}         ║`);
  console.log(`╚══════════════════════════════════════╝\n`);
  console.log(`✅  FMCSA key:    ${process.env.FMCSA_API_KEY ? process.env.FMCSA_API_KEY.slice(0,6) + "…" : "NOT SET"}`);
  console.log(`✅  Supabase URL: ${process.env.SUPABASE_URL}`);
  console.log(`${process.env.SUPABASE_SERVICE_ROLE_KEY ? "✅" : "⚠️ "}  Supabase key:    ${process.env.SUPABASE_SERVICE_ROLE_KEY ? "SERVICE ROLE (bypasses RLS) — " + process.env.SUPABASE_SERVICE_ROLE_KEY.slice(0,12) + "…" : "ANON KEY ONLY — RLS will block writes! Set SUPABASE_SERVICE_ROLE_KEY in Railway."}`);
  console.log(`\nHealth: http://localhost:${PORT}/api/health\n`);
});
