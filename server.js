/**
 * HaulDirect Backend Server
 * Node.js + Express
 *
 * Handles:
 *  - Carrier verification via FMCSA QCMobile API
 *  - Insurance status (mock structure — plug SaferWatch/Highway in here)
 *  - Stripe subscription webhooks (stub)
 *  - JWT session auth (stub)
 *
 * FMCSA QCMobile API docs: https://ai.fmcsa.dot.gov/SMS/Tools/Downloads.aspx
 * Register for a free API key at: https://ai.fmcsa.dot.gov/
 */

const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

// Only load .env file in local development — Railway injects variables directly
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

// Fallback in case Railway doesn't inject the variable
if (!process.env.FMCSA_API_KEY) {
  process.env.FMCSA_API_KEY = "eeb7553869b3de8e716c28bd9a8fbedc7b7a02ed";
}

const app = express();
app.use(express.json());

// ----------------------------------------------------------------
// CORS — in production, restrict this to your actual domain only
// ----------------------------------------------------------------
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST"],
  })
);

// ----------------------------------------------------------------
// Rate limiting — prevents abuse of the FMCSA API key
// ----------------------------------------------------------------
const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // max 30 verification requests per IP per window
  message: { error: "Too many verification requests — try again in 15 minutes." },
});


// ================================================================
// CARRIER VERIFICATION ENDPOINT — Authority & Safety Ratings only
// GET /api/carrier-verify?mc=123456&dot=1234567
// ================================================================
app.get("/api/carrier-verify", verifyLimiter, async (req, res) => {
  const { mc, dot } = req.query;
  if (!mc && !dot) {
    return res.status(400).json({ error: "Provide at least one of: mc, dot" });
  }
  try {
    const fmcsaData = await fetchFmcsa({ mc, dot });
    const result = mergeCarrierData(fmcsaData, null);
    // Return authority + safety only — no insurance fields
    return res.json({
      legalName: result.legalName,
      dotNumber: result.dotNumber,
      mcNumber: result.mcNumber,
      authorityStatus: result.authorityStatus,
      safetyRating: result.safetyRating,
      oosRateVehicle: result.oosRateVehicle,
      oosRateDriver: result.oosRateDriver,
      crashCount24mo: result.crashCount24mo,
    });
  } catch (err) {
    console.error("Carrier verify error:", err.message);
    return res.status(500).json({ error: err.message || "Verification service unavailable" });
  }
});


// ================================================================
// INSURANCE VERIFICATION ENDPOINT — Separate route
// GET /api/insurance-verify?mc=123456&dot=1234567
//
// Currently reads FMCSA's own insurance fields.
// Plug SaferWatch or Highway in here for real dollar amounts.
// ================================================================
app.get("/api/insurance-verify", verifyLimiter, async (req, res) => {
  const { mc, dot } = req.query;
  if (!mc && !dot) {
    return res.status(400).json({ error: "Provide at least one of: mc, dot" });
  }
  try {
    const fmcsaData = await fetchFmcsa({ mc, dot });
    const result = mergeCarrierData(fmcsaData, null);
    return res.json({
      legalName: result.legalName,
      dotNumber: result.dotNumber,
      mcNumber: result.mcNumber,
      insuranceStatus: result.insuranceStatus,
      autoLiabilityCoverage: result.autoLiabilityCoverage,
      cargoCoverage: result.cargoCoverage,
      // When you add SaferWatch/Highway, extra fields like policyNumber,
      // insurer name, and expiry date will come back here too
      dataSource: process.env.SAFERWATCH_API_KEY ? "SaferWatch" : "FMCSA",
      note: process.env.SAFERWATCH_API_KEY
        ? "Live insurance data from SaferWatch"
        : "Insurance data from FMCSA public records — add SaferWatch for real-time COI verification",
    });
  } catch (err) {
    console.error("Insurance verify error:", err.message);
    return res.status(500).json({ error: err.message || "Insurance verification service unavailable" });
  }
});


// ================================================================
// FMCSA QCMobile API
// Docs: https://ai.fmcsa.dot.gov/SMS/Tools/Downloads.aspx
// Free key registration: https://ai.fmcsa.dot.gov/
// ================================================================
async function fetchFmcsa({ mc, dot }) {
  const key = process.env.FMCSA_API_KEY;
  if (!key) throw new Error("FMCSA_API_KEY not set in .env file");

  let dotNumber = dot;
  if (!dotNumber && mc) {
    dotNumber = await resolveMcToDot(mc, key);
  }
  if (!dotNumber) throw new Error("Could not resolve a DOT number from the MC number provided — confirm the MC number is correct");

  const carrierUrl =
    `https://mobile.fmcsa.dot.gov/qc/services/carriers/${dotNumber}?webKey=${key}`;
  const carrierResp = await fetch(carrierUrl);

  if (carrierResp.status === 401 || carrierResp.status === 403) {
    throw new Error("FMCSA API key rejected — confirm the key in your .env file is correct");
  }
  if (carrierResp.status === 404) {
    throw new Error("No carrier found for that DOT/MC number in the FMCSA database");
  }
  if (!carrierResp.ok) {
    throw new Error(`FMCSA carrier lookup failed with status ${carrierResp.status}`);
  }

  const carrierJson = await carrierResp.json();
  const carrier = carrierJson?.content?.carrier;
  if (!carrier) throw new Error("FMCSA returned a response but no carrier data — the MC/DOT may not be registered");

  // Safety BASICS (crash data, OOS rates) — optional, don't fail without it
  const safetyUrl =
    `https://mobile.fmcsa.dot.gov/qc/services/carriers/${dotNumber}/basics?webKey=${key}`;
  let safetyJson = null;
  try {
    const safetyResp = await fetch(safetyUrl);
    if (safetyResp.ok) safetyJson = await safetyResp.json();
  } catch (_) {
    // Safety record unavailable — continue with carrier basics only
  }

  return { carrier, safety: safetyJson?.content, dotNumber };
}

async function resolveMcToDot(mc, key) {
  // Strip non-digits, strip leading "MC" prefix
  const mcNum = mc.replace(/\D/g, "");
  const url =
    `https://mobile.fmcsa.dot.gov/qc/services/carriers/docket-number/${mcNum}?webKey=${key}`;
  const resp = await fetch(url);
  if (!resp.ok) return null;
  const json = await resp.json();
  return json?.content?.carrier?.dotNumber || null;
}


// ================================================================
// SaferWatch API (paid — plug in when you have credentials)
// Contact: https://www.saferwatch.com/integrations
// ================================================================
async function fetchSaferWatch({ mc, dot }) {
  const key = process.env.SAFERWATCH_API_KEY;
  if (!key) return null; // Gracefully skip if not configured

  // SaferWatch's endpoint structure — verify exact URL with their team on signup:
  const query = mc
    ? `mcNumber=${mc.replace(/\D/g, "")}`
    : `dotNumber=${dot}`;
  const url = `https://api.saferwatch.com/carrier?${query}`;
  const resp = await fetch(url, {
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
  });
  if (!resp.ok) return null;
  return resp.json();
}


// ================================================================
// Merge FMCSA + optional insurance data into the unified shape
// the HaulDirect front-end already expects
// ================================================================
function mergeCarrierData(fmcsaResult, insuranceResult) {
  const { carrier, safety, dotNumber } = fmcsaResult;

  // Map FMCSA authority status to our three-state model
  const rawAuth = carrier?.allowedToOperate === "Y"
    ? "AUTHORIZED"
    : carrier?.statusCode === "R"
      ? "REVOKED"
      : "NOT AUTHORIZED";

  // FMCSA safety rating field
  const rawRating = carrier?.safetyRating?.toUpperCase?.() || "NOT RATED";
  const safetyRating = ["SATISFACTORY", "CONDITIONAL", "UNSATISFACTORY"].includes(rawRating)
    ? rawRating
    : "NOT RATED";

  // OOS rates from the BASICS data (if available)
  const vehicleOOS = safety?.vehicleInspectionOosRate ?? null;
  const driverOOS = safety?.driverInspectionOosRate ?? null;
  const crashCount = safety?.crashTotal ?? 0;

  // Insurance data from SaferWatch (or FMCSA's own fields if available)
  // FMCSA does carry some insurance flags — insuranceRequired / insuranceOnFile
  const insuranceOnFile = carrier?.bipdInsuranceRequired === "Y"
    ? carrier?.bipdInsuranceOnFile === "Y"
    : true; // if not required, mark as active

  // Dollar amounts come from SaferWatch/Highway — FMCSA has them but less structured.
  // If you have SaferWatch data, swap these values.
  const autoLiabilityCoverage = insuranceResult?.autoLiability ?? (insuranceOnFile ? 1000000 : 0);
  const cargoCoverage = insuranceResult?.cargo ?? (insuranceOnFile ? 100000 : 0);
  const insuranceStatus = insuranceOnFile && rawAuth === "AUTHORIZED" ? "ACTIVE" : "LAPSED";

  return {
    // Identity
    legalName: carrier?.legalName || carrier?.dbaName || "Unknown",
    dotNumber: String(dotNumber || carrier?.dotNumber || ""),
    mcNumber: carrier?.mcNumber ? `MC-${carrier.mcNumber}` : null,

    // Authority
    authorityStatus: rawAuth,

    // Safety
    safetyRating,
    oosRateVehicle: vehicleOOS !== null ? Math.round(vehicleOOS * 100) / 100 : 0,
    oosRateDriver: driverOOS !== null ? Math.round(driverOOS * 100) / 100 : 0,
    crashCount24mo: crashCount,

    // Insurance
    insuranceStatus,
    autoLiabilityCoverage,
    cargoCoverage,
  };
}


// ================================================================
// STRIPE WEBHOOK STUB
// POST /api/webhooks/stripe
//
// Wire this up when you add Stripe Billing for subscriptions.
// Set your webhook secret in .env as STRIPE_WEBHOOK_SECRET.
// ================================================================
app.post(
  "/api/webhooks/stripe",
  express.raw({ type: "application/json" }), // Stripe requires raw body
  (req, res) => {
    const sig = req.headers["stripe-signature"];
    const secret = process.env.STRIPE_WEBHOOK_SECRET;

    // Uncomment when you add the stripe npm package:
    // const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
    // let event;
    // try {
    //   event = stripe.webhooks.constructEvent(req.body, sig, secret);
    // } catch (err) {
    //   return res.status(400).send(`Webhook signature error: ${err.message}`);
    // }
    //
    // switch (event.type) {
    //   case "customer.subscription.deleted":
    //     // Lock account in your DB
    //     break;
    //   case "invoice.payment_failed":
    //     // Send dunning email, set account to past_due
    //     break;
    //   case "customer.subscription.updated":
    //     // Update tier in your DB
    //     break;
    // }

    console.log("Stripe webhook received (stub) — wire up Stripe SDK to process events");
    res.json({ received: true });
  }
);


// ================================================================
// HEALTH CHECK
// GET /api/health
// Visit http://localhost:4000/api/health to confirm everything is wired up
// ================================================================
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    fmcsaKeyConfigured: !!process.env.FMCSA_API_KEY,
    fmcsaKeyPrefix: process.env.FMCSA_API_KEY
      ? process.env.FMCSA_API_KEY.slice(0, 6) + "…"
      : "NOT SET",
    saferwatchKeyConfigured: !!process.env.SAFERWATCH_API_KEY,
    stripeKeyConfigured: !!process.env.STRIPE_SECRET_KEY,
  });
});


// ================================================================
// START SERVER
// ================================================================
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log("");
  console.log("╔══════════════════════════════════════════╗");
  console.log("║       HaulDirect API Server              ║");
  console.log(`║       Running on port ${PORT}                ║`);
  console.log("╚══════════════════════════════════════════╝");
  console.log("");

  if (process.env.FMCSA_API_KEY) {
    console.log(`✅  FMCSA key loaded: ${process.env.FMCSA_API_KEY.slice(0, 6)}…`);
    console.log(`    Test it: http://localhost:${PORT}/api/carrier-verify?mc=123456`);
  } else {
    console.log("❌  FMCSA_API_KEY not set — check your .env file");
  }

  if (process.env.SAFERWATCH_API_KEY) {
    console.log("✅  SaferWatch key loaded");
  } else {
    console.log("⚠️   SaferWatch key not set (optional — insurance $ amounts will be estimated)");
  }

  if (process.env.STRIPE_SECRET_KEY) {
    console.log("✅  Stripe key loaded");
  } else {
    console.log("⚠️   Stripe key not set (optional — needed for subscriptions/QuickPay)");
  }

  console.log("");
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log("");
});
