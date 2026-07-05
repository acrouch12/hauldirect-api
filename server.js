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
const rateLimit = require("express-rate-limit");
const { createClient } = require("@supabase/supabase-js");

if (process.env.NODE_ENV !== "production") require("dotenv").config();

// ── Hardcoded fallbacks so Railway never fails silently ──
if (!process.env.FMCSA_API_KEY)    process.env.FMCSA_API_KEY    = "eeb7553869b3de8e716c28bd9a8fbedc7b7a02ed";
if (!process.env.SUPABASE_URL)     process.env.SUPABASE_URL     = "https://qvusaeareoylwgkqfluw.supabase.co";
if (!process.env.SUPABASE_ANON_KEY) process.env.SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2dXNhZWFyZW95bHdna3FmbHV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5NDYxMjYsImV4cCI6MjA5ODUyMjEyNn0.e7gdCeSj-yes_NuxWQDgCso0YHVZeaQlgVcC8aRH3jA";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(cors({ origin: "*", methods: ["GET", "POST", "PUT", "DELETE", "PATCH"] }));

const verifyLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });

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
app.post("/api/auth/signup", async (req, res) => {
  try {
    const { name, email, role, company, equipmentType, truckDesc, maxWeight,
            dotNumber, mcNumber, verification, coiVerified, coiData,
            bizVerified, bizData, stripeConnected, payout, billing,
            loc, dims, lanes, eld, equipmentStatus, currentZip } = req.body;

    if (!name || !email || !role) return res.status(400).json({ error: "name, email, role required" });

    const existing = await db.getUserByEmail(email);
    if (existing) return res.status(409).json({ error: "An account with that email already exists." });

    const user = await db.createUser({
      id:               crypto.randomUUID(),
      name,
      email:            email.toLowerCase(),
      role,
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
      created_at:       new Date().toISOString(),
    });

    res.json({ user });
  } catch (err) {
    console.error("Signup error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "email required" });
    const user = await db.getUserByEmail(email);
    if (!user) return res.status(404).json({ error: "No account found with that email." });
    if (user.suspended) return res.status(403).json({ error: "This account has been suspended. Contact support." });
    res.json({ user });
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
  // Already valid column names — pass through unchanged
  name: "name", email: "email", role: "role", company: "company", dims: "dims",
  verification: "verification", payout: "payout", billing: "billing", loc: "loc",
  lanes: "lanes", eld: "eld", ratings: "ratings", suspended: "suspended",
  phone: "phone", complimentary: "complimentary", ein: "ein",
};

const USER_VALID_COLUMNS = new Set([
  "name", "email", "role", "company", "equipment_type", "truck_desc", "max_weight",
  "dims", "dot_number", "mc_number", "verification", "coi_verified", "coi_data",
  "biz_verified", "biz_data", "stripe_connected", "payout", "billing", "loc",
  "lanes", "eld", "equipment_status", "current_zip", "ratings", "operator_notes",
  "suspended", "created_at", "phone", "complimentary", "complimentary_expiry",
  "ein", "trial_started_at", "address", "billing_cycle", "requested_tier",
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
  originZip: "origin_zip", originCity: "origin_city", originState: "origin_state",
  destZip: "dest_zip", deliveryCity: "delivery_city", deliveryState: "delivery_state",
  pickupAddress: "pickup_address", deliveryAddress: "delivery_address",
  contactName: "contact_name", contactPhone: "contact_phone",
  pickupDate: "pickup_date", deliveryDate: "delivery_date",
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
  cancelHistory: "cancel_history", trailerLength: "trailer_length",
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
  "requirements", "bids", "progress", "paid", "paid_at", "quick_pay", "bol_number",
  "ratecon_sent", "delivery_status_confirmed", "posted_at", "updated_at",
  "commodity", "qty", "freight_condition", "pallets", "linear_feet", "oversize",
  "permit_required", "temp_requirement", "temp_spec", "stackable", "do_not_stack",
  "fragile", "unload_type", "appointment_required", "twic_required", "hazmat_class",
  "special", "cancelled_at", "cancelled_by", "cancel_reason", "cancel_history", "documents", "trailer_length",
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
app.post("/api/loads", async (req, res) => {
  try {
    const load = await db.createLoad({
      id:           crypto.randomUUID(),
      status:       "open",
      carrier_id:   null,
      progress:     0,
      posted_at:    new Date().toISOString(),
      paid:         false,
      ...mapLoadFields(req.body),
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
app.patch("/api/loads/:id", async (req, res) => {
  try {
    const load = await db.updateLoad(req.params.id, mapLoadFields(req.body));
    res.json({ load });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/loads/:id  (operator only)
app.delete("/api/loads/:id", async (req, res) => {
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
app.post("/api/loads/:id/bids", async (req, res) => {
  try {
    const bid = await db.createBid({
      id:         crypto.randomUUID(),
      load_id:    req.params.id,
      carrier_id: req.body.carrierId,
      amount:     req.body.amount,
      note:       req.body.note || null,
      status:     "pending",
      created_at: new Date().toISOString(),
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
app.patch("/api/bids/:id", async (req, res) => {
  try {
    const bid = await db.updateBid(req.params.id, req.body);
    res.json({ bid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================================================================
// MESSAGES ENDPOINTS
// ================================================================

// POST /api/messages
app.post("/api/messages", async (req, res) => {
  try {
    const msg = await db.sendMessage({
      id:         crypto.randomUUID(),
      load_id:    req.body.loadId,
      carrier_id: req.body.carrierId,
      sender_id:  req.body.senderId,
      role:       req.body.role,
      name:       req.body.name,
      text:       req.body.text,
      sent_at:    new Date().toISOString(),
    });
    res.json({ message: msg });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/messages/:loadId/:carrierId
app.get("/api/messages/:loadId/:carrierId", async (req, res) => {
  try {
    const messages = await db.getMessages(req.params.loadId, req.params.carrierId);
    res.json({ messages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================================================================
// DOCUMENTS ENDPOINTS
// ================================================================

// POST /api/documents
app.post("/api/documents", async (req, res) => {
  try {
    const doc = await db.saveDocument({
      id:              crypto.randomUUID(),
      load_id:         req.body.loadId,
      uploaded_by:     req.body.uploadedBy,
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
app.get("/api/documents/:loadId", async (req, res) => {
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
app.post("/api/ratings", async (req, res) => {
  try {
    const rating = await db.saveRating({
      id:             crypto.randomUUID(),
      load_id:        req.body.loadId,
      rated_user_id:  req.body.ratedUserId,
      rater_user_id:  req.body.raterUserId,
      stars:          req.body.stars,
      role:           req.body.role,
      created_at:     new Date().toISOString(),
    });
    // Update user's ratings array
    const ratings = await db.getRatingsForUser(req.body.ratedUserId);
    await db.updateUser(req.body.ratedUserId, {
      ratings: ratings.map((r) => r.stars),
    });
    res.json({ rating });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================================================================
// OPERATOR ENDPOINTS
// ================================================================

// GET /api/operator/users  (all users for operator dashboard)
app.get("/api/operator/users", async (req, res) => {
  try {
    const users = await db.getAllUsers();
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/operator/users/:id/suspend
app.patch("/api/operator/users/:id/suspend", async (req, res) => {
  try {
    const user = await db.updateUser(req.params.id, { suspended: req.body.suspended });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/operator/users/:id
app.delete("/api/operator/users/:id", async (req, res) => {
  try {
    const { error } = await supabase.from("users").delete().eq("id", req.params.id);
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
const GEOFENCE_RADIUS_MI = 1.0;
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
  const amount   = parseFloat(((billMin / 60) * DETENTION_RATE_HR).toFixed(2));
  return { dwellMs, billMin, amount };
}

app.get("/api/carrier-verify", verifyLimiter, async (req, res) => {
  const { mc, dot } = req.query;
  if (!mc && !dot) return res.status(400).json({ error: "Provide mc or dot" });
  try {
    const fmcsaData = await fetchFmcsa({ mc, dot });
    res.json(mergeCarrierData(fmcsaData, null));
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

// Detention tracking + live position tracking
const positionStore = {}; // { [loadId]: { lat, lng, updatedAt, carrierId } }

app.post("/api/tracking/ping", async (req, res) => {
  const { loadId, carrierId, lat, lng, facilityLat, facilityLng } = req.body;
  if (!loadId || lat == null || lng == null || facilityLat == null || facilityLng == null)
    return res.status(400).json({ error: "loadId, lat, lng, facilityLat, facilityLng required" });
  const now = Date.now();

  // Always record the carrier's latest real GPS position for the shipper's live map,
  // regardless of whether they're inside the detention geofence or not.
  positionStore[loadId] = { lat, lng, updatedAt: now, carrierId: carrierId || null };

  const distMiles = haversineMilesServer(lat, lng, facilityLat, facilityLng);
  const insideGeofence = distMiles <= GEOFENCE_RADIUS_MI;
  let record = detentionStore[loadId];
  if (insideGeofence && !record) {
    record = { loadId, carrierId, facilityLat, facilityLng, arrivalAt: now, departureAt: null, charged: false };
    detentionStore[loadId] = record;
  }
  if (!insideGeofence && record && !record.departureAt) {
    record.departureAt = now;
    const { amount } = calcDetention(record.arrivalAt, now);
    record.detentionAmount = amount;
    record.charged = amount > 0;
  }
  const detention = record ? calcDetention(record.arrivalAt, record.departureAt || now) : null;
  res.json({ loadId, distMiles: parseFloat(distMiles.toFixed(3)), insideGeofence, arrivalAt: record?.arrivalAt || null, departureAt: record?.departureAt || null, freeWindowExpired: record ? (now - record.arrivalAt) > FREE_WINDOW_MS : false, detentionActive: record && !record.departureAt && (now - record.arrivalAt) > FREE_WINDOW_MS, detentionMinutes: detention?.billMin || 0, detentionAmount: detention?.amount || 0, charged: record?.charged || false });
});

app.get("/api/tracking/status/:loadId", (req, res) => {
  const record = detentionStore[req.params.loadId];
  if (!record) return res.json({ loadId: req.params.loadId, tracked: false });
  const detention = calcDetention(record.arrivalAt, record.departureAt || Date.now());
  res.json({ loadId: record.loadId, tracked: true, arrivalAt: record.arrivalAt, departureAt: record.departureAt, detentionMinutes: detention.billMin, detentionAmount: detention.amount, charged: record.charged });
});

// Real-time carrier GPS position — used by shipper's live tracking map.
// Returns null/notFound until the carrier has tapped "Start tracking" at least once.
app.get("/api/tracking/position/:loadId", (req, res) => {
  const pos = positionStore[req.params.loadId];
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
app.post("/api/disputes", async (req, res) => {
  try {
    const { data, error } = await supabase.from("disputes").insert({
      id:             crypto.randomUUID(),
      load_id:        req.body.loadId,
      filed_by:       req.body.filedBy,
      filed_by_name:  req.body.filedByName,
      filed_by_role:  req.body.filedByRole,
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
app.get("/api/disputes", async (req, res) => {
  try {
    const { data } = await supabase.from("disputes").select("*").order("created_at", { ascending: false });
    res.json({ disputes: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/disputes/:id
app.patch("/api/disputes/:id", async (req, res) => {
  try {
    const { data, error } = await supabase.from("disputes").update({ ...req.body, updated_at: new Date().toISOString() }).eq("id", req.params.id).select().single();
    if (error) throw error;
    res.json({ dispute: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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
const WAITLIST_DISCOUNT    = 30; // 30% off

function generatePromoCode(position) {
  return `EARLY${String(position).padStart(3,"0")}`;
}

// POST /api/waitlist
app.post("/api/waitlist", async (req, res) => {
  const { name, email, role, company, phone } = req.body;
  if (!name || !email || !role) return res.status(400).json({ error: "name, email, role required" });

  try {
    // Check if already on waitlist
    const { data: existing } = await supabase.from("waitlist").select("*").eq("email", email.toLowerCase()).single();
    if (existing) return res.status(409).json({ error: "already_on_waitlist", position: existing.position, promoCode: existing.promo_code });

    // Get current count for position
    const { count } = await supabase.from("waitlist").select("*", { count: "exact", head: true });
    const position = (count || 0) + 1;
    const isEarlyBird = position <= WAITLIST_PROMO_LIMIT;
    const promoCode = isEarlyBird ? generatePromoCode(position) : null;

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
    const { count } = await supabase.from("waitlist").select("*", { count: "exact", head: true });
    res.json({ count: count || 0, spotsLeft: Math.max(0, WAITLIST_PROMO_LIMIT - (count || 0)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/waitlist  (operator only)
app.get("/api/waitlist", async (req, res) => {
  try {
    const { data } = await supabase.from("waitlist").select("*").order("position");
    res.json({ waitlist: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/waitlist/:id  (mark converted, promo_sent, etc)
app.patch("/api/waitlist/:id", async (req, res) => {
  try {
    const { data, error } = await supabase.from("waitlist").update(req.body).eq("id", req.params.id).select().single();
    if (error) throw error;
    res.json({ entry: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================================================================
// STRIPE WEBHOOK STUB
// ================================================================
app.post("/api/webhooks/stripe", express.raw({ type: "application/json" }), (req, res) => {
  console.log("Stripe webhook received — wire up Stripe SDK to process events");
  res.json({ received: true });
});

// ================================================================
// HEALTH CHECK
// ================================================================
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
    databaseConnected: dbConnected,
    stripeKeyConfigured: !!process.env.STRIPE_SECRET_KEY,
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`\n╔══════════════════════════════════════╗`);
  console.log(`║   HaulDirect API — port ${PORT}         ║`);
  console.log(`╚══════════════════════════════════════╝\n`);
  console.log(`✅  FMCSA key:    ${process.env.FMCSA_API_KEY ? process.env.FMCSA_API_KEY.slice(0,6) + "…" : "NOT SET"}`);
  console.log(`✅  Supabase URL: ${process.env.SUPABASE_URL}`);
  console.log(`\nHealth: http://localhost:${PORT}/api/health\n`);
});
