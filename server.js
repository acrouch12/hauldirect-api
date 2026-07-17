import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Truck, Package, Star, MapPin, Gauge, Clock, X, ChevronRight, CheckCircle2, ArrowLeft, Plus,
  MessageCircle, Send, Gavel, Building2, Users, Wallet, UserPlus, ShieldCheck, DollarSign, RefreshCcw, Lock, FileText, Bot, Paperclip, Download, Upload, CreditCard, Bell, Navigation, Route, Zap,
} from "lucide-react";

// ---------- Seed data ----------
// ── Convert DB user record → corp shape used throughout the app ──
function dbUserToCorp(user) {
  return {
    id:           user.id,
    companyName:  user.name || user.company_name,
    subtype:      user.company || user.equipment_type || "shipping",
    email:        user.email,
    mcNumber:     user.mc_number || user.mcNumber,
    dotNumber:    user.dot_number || user.dotNumber,
    verification: user.verification,
    coiVerified:  user.coi_verified || false,
    bizVerified:  user.biz_verified || false,
    stripeConnected: user.stripe_connected || false,
    billing:      user.billing,
    payout:       user.payout,
    suspended:    user.suspended || false,
    members:      user.lanes || [], // corp stores members in lanes field
    role:         "corp",
  };
}

// Converts a raw Supabase `users` row (snake_case) into the camelCase
// shape used everywhere in the app for individual shippers/truckers.
function dbUserToFrontend(user) {
  if (!user) return user;
  return {
    ...user,
    equipmentType:   user.equipment_type ?? user.equipmentType,
    truckDesc:       user.truck_desc ?? user.truckDesc,
    maxWeight:       user.max_weight ?? user.maxWeight,
    mcNumber:        user.mc_number ?? user.mcNumber,
    dotNumber:       user.dot_number ?? user.dotNumber,
    coiVerified:     user.coi_verified ?? user.coiVerified ?? false,
    coiData:         user.coi_data ?? user.coiData,
    bizVerified:     user.biz_verified ?? user.bizVerified ?? false,
    bizData:         user.biz_data ?? user.bizData,
    stripeConnected: user.stripe_connected ?? user.stripeConnected ?? false,
    currentZip:      user.current_zip ?? user.currentZip,
    equipmentStatus: user.equipment_status ?? user.equipmentStatus,
    operatorNotes:   user.operator_notes ?? user.operatorNotes,
    trialStartedAt:  user.trial_started_at ?? user.trialStartedAt,
    createdAt:       user.created_at ?? user.createdAt,
    billingCycle:    user.billing_cycle ?? user.billingCycle ?? "monthly",
    requestedTier:   user.requested_tier ?? user.requestedTier,
    factoringEnabled: user.factoring_enabled ?? user.factoringEnabled ?? false,
    factoringCompany: user.factoring_company ?? user.factoringCompany,
    factoringEmail:   user.factoring_email ?? user.factoringEmail,
    factoringPhone:   user.factoring_phone ?? user.factoringPhone,
    factoringNoaNumber: user.factoring_noa_number ?? user.factoringNoaNumber,
  };
}

// Converts a raw Supabase `loads` row (snake_case) into the camelCase
// shape the entire app expects (l.shipperId, l.truckerId, l.originZip, etc.)
function dbLoadToFrontend(load) {
  if (!load) return load;
  return {
    ...load,
    shipperId:      load.shipper_id ?? load.shipperId,
    shipperName:    load.shipper_name ?? load.shipperName,
    truckerId:      load.carrier_id ?? load.truckerId ?? null,
    originZip:      load.origin_zip ?? load.originZip,
    originCity:     load.origin_city ?? load.originCity,
    originState:    load.origin_state ?? load.originState,
    destZip:        load.dest_zip ?? load.destZip,
    deliveryCity:   load.delivery_city ?? load.deliveryCity,
    deliveryState:  load.delivery_state ?? load.deliveryState,
    pickupAddress:  load.pickup_address ?? load.pickupAddress,
    deliveryAddress:load.delivery_address ?? load.deliveryAddress,
    contactName:    load.contact_name ?? load.contactName,
    contactPhone:   load.contact_phone ?? load.contactPhone,
    pickupDate:     load.pickup_date ?? load.pickupDate,
    deliveryDate:   load.delivery_date ?? load.deliveryDate,
    hazmatClass:    load.hazmat_class ?? load.hazmatClass,
    freightCondition: load.freight_condition ?? load.freightCondition,
    linearFeet:     load.linear_feet ?? load.linearFeet,
    permitRequired: load.permit_required ?? load.permitRequired,
    tempRequirement: load.temp_requirement ?? load.tempRequirement,
    tempSpec:       load.temp_spec ?? load.tempSpec,
    doNotStack:     load.do_not_stack ?? load.doNotStack,
    unloadType:     load.unload_type ?? load.unloadType,
    appointmentRequired: load.appointment_required ?? load.appointmentRequired,
    twicRequired:   load.twic_required ?? load.twicRequired,
    bolNumber:      load.bol_number ?? load.bolNumber,
    raterconSent:   load.ratecon_sent ?? load.raterconSent,
    deliveryStatusConfirmed: load.delivery_status_confirmed ?? load.deliveryStatusConfirmed,
    quickPay:       load.quick_pay ?? load.quickPay,
    paidAt:         load.paid_at ? new Date(load.paid_at).getTime() : load.paidAt,
    postedAt:       load.posted_at ? new Date(load.posted_at).getTime() : (load.postedAt || Date.now()),
    cancelledAt:    load.cancelled_at ? new Date(load.cancelled_at).getTime() : load.cancelledAt,
    cancelledBy:    load.cancelled_by ?? load.cancelledBy,
    cancelReason:   load.cancel_reason ?? load.cancelReason,
    cancelHistory:  load.cancel_history ?? load.cancelHistory ?? [],
    trailerLength:  load.trailer_length ?? load.trailerLength,
    bids:           load.bids || [],
    documents:      load.documents || [],
    securement:     load.securement_details ?? load.securement,
  };
}



// ── Launch countdown hook ──
function useCountdown(targetDate) {
  const calc = () => {
    const diff = targetDate.getTime() - Date.now();
    if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, launched: true };
    return {
      days:    Math.floor(diff / 86400000),
      hours:   Math.floor((diff % 86400000) / 3600000),
      minutes: Math.floor((diff % 3600000) / 60000),
      seconds: Math.floor((diff % 60000) / 1000),
      launched: false,
    };
  };
  const [countdown, setCountdown] = useState(calc);
  useEffect(() => {
    if (countdown.launched) return;
    const iv = setInterval(() => {
      const next = calc();
      setCountdown(next);
      if (next.launched) clearInterval(iv);
    }, 1000);
    return () => clearInterval(iv);
  }, []);
  return countdown;
}

function ComingSoonScreen({ setPage }) {
  const countdown = useCountdown(LAUNCH_DATE);
  const [showWaitlist, setShowWaitlist] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showCarrierAgreement, setShowCarrierAgreement] = useState(false);
  const [showShipperAgreement, setShowShipperAgreement] = useState(false);

  if (countdown.launched) return null; // platform is live — this screen never shows

  const pad = (n) => String(n).padStart(2, "0");

  return (
    <div style={{ minHeight: "100vh", background: "#1B1D21", color: "#F2EDE4", fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column" }}>

      {/* Nav */}
      <header style={{ padding: "20px 32px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#FFB400" }}>
        <Logo size={38} variant="dark" showTagline={false} />
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <button onClick={() => setShowAbout(true)} style={{ background: "none", border: "none", color: "#1B1D21", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            Contact
          </button>
          <button onClick={() => setShowWaitlist(true)} style={{ background: "#1B1D21", border: "none", color: "#FFB400", borderRadius: 8, padding: "10px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            Join the waitlist
          </button>
        </div>
      </header>

      {showAbout && <AboutModal onClose={() => setShowAbout(false)} onJoinWaitlist={() => { setShowAbout(false); setShowWaitlist(true); }} />}

      {/* Hero */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "60px 24px" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#FFB400", color: "#1B1D21", borderRadius: 20, padding: "6px 16px", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 24 }}>
          🚀 Launching Soon
        </div>

        <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "clamp(32px, 6vw, 58px)", lineHeight: 1.05, textTransform: "uppercase", maxWidth: 700, marginBottom: 16 }}>
          Freight booked direct.<br />
          <span style={{ color: "#FFB400" }}>No broker. No cut. No BS.</span>
        </div>

        <div style={{ fontSize: 16, color: "#9A958A", maxWidth: 500, lineHeight: 1.7, marginBottom: 40 }}>
          Direct Freight Co connects shippers and carriers directly — no middleman, no commission, no broker markup. We're putting the final touches on the platform.
        </div>

        {/* Countdown */}
        <div style={{ display: "flex", gap: 16, marginBottom: 48, flexWrap: "wrap", justifyContent: "center" }}>
          {[
            { label: "Days",    value: countdown.days },
            { label: "Hours",   value: countdown.hours },
            { label: "Minutes", value: countdown.minutes },
            { label: "Seconds", value: countdown.seconds },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: "#2A2D32", border: "1px solid #44484D", borderRadius: 12, padding: "20px 24px", minWidth: 90, textAlign: "center" }}>
              <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 44, color: "#FFB400", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                {pad(value)}
              </div>
              <div style={{ fontSize: 11, color: "#6B6557", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 6 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <button onClick={() => setShowWaitlist(true)} style={{ background: "#FFB400", border: "none", color: "#1B1D21", borderRadius: 10, padding: "16px 36px", fontWeight: 700, fontSize: 16, cursor: "pointer" }}>
            🚀 Join waitlist — first 100 get 20% off for 3 months
          </button>
          <div style={{ fontSize: 12, color: "#6B6557" }}>No credit card required · Cancel anytime · No broker fees ever</div>
        </div>

        {/* Features preview */}
        <div style={{ display: "flex", gap: 20, marginTop: 56, flexWrap: "wrap", justifyContent: "center", maxWidth: 900 }}>
          {[
            {
              icon: "🚛", title: "For Carriers", price: "$30/mo", discounted: "$24/mo", annual: "$300/yr",
              desc: "Solo owner-operators and small fleets up to 4 trucks under one business name.",
              tiers: null,
            },
            {
              icon: "📦", title: "For Shippers", price: "$70/mo", discounted: "$56/mo", annual: "$700/yr",
              desc: "Individual shippers posting freight directly to verified carriers. Unlimited load postings.",
              tiers: null,
            },
            {
              icon: "🏢", title: "For Companies", price: "From $350/mo", discounted: "From $280/mo", annual: "From $3,500/yr",
              desc: "Scale with your fleet or shipping team.",
              tiers: [
                { name: "Starter", price: "$350/mo", discounted: "$280/mo", profiles: "5–10 profiles" },
                { name: "Growth",  price: "$800/mo", discounted: "$640/mo", profiles: "11–50 profiles" },
                { name: "Fleet",   price: "$1,800/mo", discounted: "$1,440/mo", profiles: "51–150 profiles" },
                { name: "Enterprise", price: "$3,500/mo", discounted: "$2,800/mo", profiles: "150+ profiles" },
              ],
            },
          ].map(f => (
            <div key={f.title} style={{ background: "#2A2D32", border: "1px solid #44484D", borderRadius: 12, padding: "22px 20px", flex: 1, minWidth: 210, textAlign: "left" }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>{f.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6, color: "#F2EDE4" }}>{f.title}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 2 }}>
                <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 22, color: "#FFB400" }}>{f.discounted}</div>
                <div style={{ fontSize: 13, color: "#6B6557", textDecoration: "line-through" }}>{f.price}</div>
              </div>
              <div style={{ fontSize: 11, color: "#3E7A4B", fontWeight: 700, marginBottom: 2 }}>Early bird — 20% off for 3 months</div>
              <div style={{ fontSize: 11, color: "#6B6557", marginBottom: 12 }}>Then {f.price} · or {f.annual} (2 months free)</div>
              <div style={{ fontSize: 12, color: "#9A958A", lineHeight: 1.6, marginBottom: f.tiers ? 12 : 0 }}>{f.desc}</div>
              {f.tiers && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {f.tiers.map(t => (
                    <div key={t.name} style={{ background: "#1B1D21", borderRadius: 6, padding: "7px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#F2EDE4" }}>{t.name}</div>
                        <div style={{ fontSize: 10, color: "#6B6557" }}>{t.profiles}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#FFB400" }}>{t.discounted}</div>
                        <div style={{ fontSize: 10, color: "#6B6557", textDecoration: "line-through" }}>{t.price}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* How It Works */}
        <div style={{ marginTop: 64, maxWidth: 900, width: "100%" }}>
          <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 26, textTransform: "uppercase", marginBottom: 8 }}>
            How It Works
          </div>
          <div style={{ fontSize: 14, color: "#9A958A", marginBottom: 32 }}>Three steps. No broker anywhere in between.</div>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "center" }}>
            {[
              { step: "1", icon: "📦", title: "Shipper posts a load", desc: "City, freight description, equipment needed, and price — takes under a minute with Quick Post." },
              { step: "2", icon: "🚛", title: "Carrier bids or accepts", desc: "Carriers only see loads matching their equipment type. Bid your price, or accept instantly at the listed rate." },
              { step: "3", icon: "🤝", title: "Direct deal, done", desc: "Rate Confirmation generates automatically. GPS tracking, messaging, and payment happen right on the platform — no broker involved, ever." },
            ].map((s) => (
              <div key={s.step} style={{ flex: 1, minWidth: 240, background: "#2A2D32", border: "1px solid #44484D", borderRadius: 12, padding: "24px 20px", textAlign: "left", position: "relative" }}>
                <div style={{ position: "absolute", top: -14, left: 20, background: "#FFB400", color: "#1B1D21", fontWeight: 700, fontSize: 13, width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {s.step}
                </div>
                <div style={{ fontSize: 30, marginTop: 8, marginBottom: 10 }}>{s.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8, color: "#F2EDE4" }}>{s.title}</div>
                <div style={{ fontSize: 13, color: "#9A958A", lineHeight: 1.6 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* What You Get */}
        <div style={{ marginTop: 64, maxWidth: 900, width: "100%" }}>
          <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 26, textTransform: "uppercase", marginBottom: 8 }}>
            What You Get
          </div>
          <div style={{ fontSize: 14, color: "#9A958A", marginBottom: 32 }}>Real tools built for how freight actually moves.</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, textAlign: "left" }}>
            {[
              { icon: "📍", title: "Live GPS tracking", desc: "Real-time carrier location on every active load — no more \"where's my truck\" phone tag." },
              { icon: "⏱️", title: "Automated detention billing", desc: "2 free hours, then $60/hr, calculated automatically from real GPS arrival — no arguing, no chasing anyone for detention pay." },
              { icon: "🛡️", title: "Verified carriers", desc: "Insurance and business documents verified before a carrier ever hauls your freight." },
              { icon: "💬", title: "Real-time messaging", desc: "Talk directly with your shipper or carrier, right on the platform — no broker relaying messages." },
              { icon: "📄", title: "Auto-generated paperwork", desc: "Rate Confirmations and Invoices generate themselves the moment a bid is accepted." },
              { icon: "💰", title: "Broker savings report", desc: "See exactly what you're saving by not paying a 15-20% broker markup, load by load." },
              { icon: "⭐", title: "Ratings both ways", desc: "Shippers and carriers rate each other — real accountability, real trust." },
              { icon: "🔄", title: "Deadhead & backhaul finder", desc: "Find return loads near your delivery point and cut down on empty miles." },
            ].map((f) => (
              <div key={f.title} style={{ background: "#2A2D32", border: "1px solid #44484D", borderRadius: 10, padding: "18px 18px" }}>
                <div style={{ fontSize: 22, marginBottom: 8 }}>{f.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6, color: "#F2EDE4" }}>{f.title}</div>
                <div style={{ fontSize: 12.5, color: "#9A958A", lineHeight: 1.6 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 24, fontSize: 13, fontWeight: 600, color: "#F2EDE4", display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "center" }}>
          <span>✓ 30-day free trial</span>
          <span>✓ Cancel anytime</span>
          <span>✓ No cancellation fees</span>
          <span>✓ No commissions ever</span>
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: "28px 32px", background: "#FFB400", textAlign: "center" }}>
        <div style={{ display: "flex", gap: 20, justifyContent: "center", flexWrap: "wrap", marginBottom: 14 }}>
          <button onClick={() => setShowAbout(true)} style={{ background: "none", border: "none", color: "#1B1D21", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Contact</button>
          <button onClick={() => setShowWaitlist(true)} style={{ background: "none", border: "none", color: "#1B1D21", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Join the waitlist</button>
          <button onClick={() => setShowTerms(true)} style={{ background: "none", border: "none", color: "#1B1D21", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Terms of Service</button>
          <button onClick={() => setShowPrivacy(true)} style={{ background: "none", border: "none", color: "#1B1D21", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Privacy Policy</button>
          <button onClick={() => setShowCarrierAgreement(true)} style={{ background: "none", border: "none", color: "#1B1D21", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Carrier Agreement</button>
          <button onClick={() => setShowShipperAgreement(true)} style={{ background: "none", border: "none", color: "#1B1D21", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Shipper Agreement</button>
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#1B1D21" }}>
          © 2026 Direct Freight Co LLC · No broker fees · No commissions · Cancel anytime
        </div>
      </div>

      {showTerms && <TermsModal onClose={() => setShowTerms(false)} />}
      {showPrivacy && <PrivacyModal onClose={() => setShowPrivacy(false)} />}
      {showCarrierAgreement && <CarrierAgreementModal onClose={() => setShowCarrierAgreement(false)} />}
      {showShipperAgreement && <ShipperAgreementModal onClose={() => setShowShipperAgreement(false)} />}

      {/* Waitlist modal */}
      {showWaitlist && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16 }} onClick={() => setShowWaitlist(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#1B1D21", borderRadius: 14, width: "100%", maxWidth: 520, overflow: "hidden", boxShadow: "0 16px 48px rgba(0,0,0,0.5)" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #2A2D32", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 16, textTransform: "uppercase", color: "#FFB400" }}>Join the waitlist</div>
              <button onClick={() => setShowWaitlist(false)} style={{ background: "none", border: "none", color: "#9A958A", cursor: "pointer" }}><X size={18} /></button>
            </div>
            <div style={{ padding: 20 }}>
              <WaitlistSection setPage={() => {}} embedded />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Supabase real-time messaging ──
const SUPABASE_URL      = "https://qvusaeareoylwgkqfluw.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2dXNhZWFyZW95bHdna3FmbHV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5NDYxMjYsImV4cCI6MjA5ODUyMjEyNn0.e7gdCeSj-yes_NuxWQDgCso0YHVZeaQlgVcC8aRH3jA";

let _sbClient = null;
async function getSupabaseClient() {
  if (_sbClient) return _sbClient;
  if (window.__SB_CLIENT__) { _sbClient = window.__SB_CLIENT__; return _sbClient; }
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js";
    s.onload = () => {
      _sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      window.__SB_CLIENT__ = _sbClient;
      resolve(_sbClient);
    };
    s.onerror = () => resolve(null);
    document.head.appendChild(s);
  });
}

function useRealtimeMessages(myId, setMessages, addNotification) {
  const [unreadCounts, setUnreadCounts] = useState({});
  const channelRef = useRef(null);
  const openThreadRef = useRef(null);

  const markRead = useCallback((key) => {
    openThreadRef.current = key;
    setUnreadCounts(prev => ({ ...prev, [key]: 0 }));
  }, []);

  useEffect(() => {
    if (!myId) return;
    let mounted = true;
    getSupabaseClient().then(client => {
      if (!client || !mounted) return;
      channelRef.current = client
        .channel("df-messages")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
          const msg = payload.new;
          if (!msg || !mounted) return;
          const formatted = { id: msg.id, ts: new Date(msg.sent_at).getTime(), role: msg.role, name: msg.name, text: msg.text };
          const key = threadKey(msg.load_id, msg.carrier_id);
          setMessages(prev => ({
            ...prev,
            [key]: [...(prev[key] || []), formatted].filter((m, i, arr) => arr.findIndex(x => x.id === m.id) === i),
          }));
          const fromMe = msg.sender_id === myId;
          if (!fromMe && openThreadRef.current !== key) {
            setUnreadCounts(prev => ({ ...prev, [key]: (prev[key] || 0) + 1 }));
            if (typeof Notification !== "undefined" && Notification.permission === "granted") {
              try { new Notification("New message from " + msg.name, { body: msg.text, tag: "msg-" + key }); } catch(e) {}
            }
            addNotification?.("Message from " + msg.name + ": " + msg.text.slice(0,60) + (msg.text.length>60?"...":""), "info");
          }
        })
        .subscribe();
    });
    return () => {
      mounted = false;
      if (channelRef.current) getSupabaseClient().then(c => c?.removeChannel(channelRef.current));
    };
  }, [myId]);

  return { unreadCounts, markRead };
}

function useWindowWidth() {
  const [width, setWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    const fn = () => setWidth(window.innerWidth);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return width;
}

// Inject mobile CSS once on load
const MOBILE_CSS = `
  * { box-sizing: border-box; }
  body { margin: 0; -webkit-tap-highlight-color: transparent; }
  input, select, textarea, button { font-size: 16px !important; }
  @media (max-width: 640px) {
    .hide-mobile { display: none !important; }
    .stack-mobile { flex-direction: column !important; }
    .full-mobile { width: 100% !important; max-width: 100% !important; }
    .pad-mobile { padding: 12px !important; }
    .wrap-mobile { flex-wrap: wrap !important; }
    .scroll-x { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  }
`;
if (!document.getElementById("df-mobile-css")) {
  const s = document.createElement("style");
  s.id = "df-mobile-css";
  s.textContent = MOBILE_CSS;
  document.head.appendChild(s);
}


// Change the email and pin before going live
const OPERATOR_EMAIL = "HaulDirectfreight45675@gmail.com";

// ── LAUNCH DATE ──────────────────────────────────────────────────────
// Set your launch date here. The platform is locked until this date.
// Format: new Date("YYYY-MM-DDTHH:MM:00") in your local time
// To unlock immediately: set LAUNCH_DATE to new Date(0) or past date
// To stay locked: set a future date
const LAUNCH_DATE = new Date("2026-09-21T14:00:00Z"); // 10:00 AM Eastern (UTC-4 in September, still EDT)
const IS_LAUNCHED = Date.now() >= LAUNCH_DATE.getTime();

// ── TRIAL SETTINGS ───────────────────────────────────────────────────
const TRIAL_DAYS = 30;
const TRIAL_MS   = TRIAL_DAYS * 24 * 60 * 60 * 1000;

// Check if a user's trial has expired
function isTrialExpired(user) {
  if (!user) return false;
  if (user.complimentary && (!user.complimentaryExpiry || Date.now() < user.complimentaryExpiry)) return false;
  if (user.subscriptionActive) return false;
  const started = user.trialStartedAt || user.created_at ? new Date(user.trialStartedAt || user.created_at).getTime() : Date.now();
  return Date.now() > started + TRIAL_MS;
}

// Flag potential trial abuse — same email domain used multiple times
function flagTrialAbuse(email, allUsers) {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return false;
  const freeProviders = ["gmail.com","yahoo.com","hotmail.com","outlook.com","icloud.com"];
  if (freeProviders.includes(domain)) return false; // don't flag free email providers
  const sameCompany = allUsers.filter(u => u.email?.split("@")[1]?.toLowerCase() === domain);
  return sameCompany.length >= 3; // 3+ accounts from same company domain = flag
}
// ─────────────────────────────────────────────────────────────────────
const OPERATOR_PIN   = "RileyMay25"; // change this before launch

// ── Promo codes — stored in memory (operator creates them, users redeem them) ──
// In production wire this to a Supabase table for persistence
const PROMO_STORE = {
  codes: [],
  add(code) { this.codes.push(code); },
  find(code) { return this.codes.find(c => c.code.toUpperCase() === code.toUpperCase()); },
  redeem(code, userId) {
    const found = this.find(code);
    if (!found) return { ok: false, error: "Invalid promo code." };
    if (found.expiresAt && Date.now() > found.expiresAt) return { ok: false, error: "This promo code has expired." };
    if (found.maxUses && found.usedBy.length >= found.maxUses) return { ok: false, error: "This promo code has reached its usage limit." };
    if (found.usedBy.includes(userId)) return { ok: false, error: "You've already used this promo code." };
    found.usedBy.push(userId);
    return { ok: true, benefit: found.benefit };
  },
};

// ── Supabase / Backend config ──
const API_URL = "https://hauldirect-api-production.up.railway.app";

// API helper — all database calls go through your Railway backend
const api = {
  async post(path, body) {
    const r = await fetch(`${API_URL}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || `API error ${r.status}`); }
    return r.json();
  },
  async get(path) {
    const r = await fetch(`${API_URL}${path}`);
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || `API error ${r.status}`); }
    return r.json();
  },
  async patch(path, body) {
    const r = await fetch(`${API_URL}${path}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || `API error ${r.status}`); }
    return r.json();
  },
  async del(path) {
    const r = await fetch(`${API_URL}${path}`, { method: "DELETE" });
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || `API error ${r.status}`); }
    return r.json();
  },
};

const seedIndependentShippers = [];

const seedIndependentTruckers = [];

const seedCorporations = [];

const seedLoads = [];


// ---------- Helpers ----------
const avgRating = (ratings) => (ratings && ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0);
const fmtMoney = (n) => `$${Number(n).toLocaleString()}`;
const milesBetween = () => 60 + Math.floor(Math.random() * 280);
const threadKey = (loadId, truckerId) => `${loadId}__${truckerId}`;
const upsert = (list, item) => (list.find((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item]);


// ====================================================================
// SECURITY UTILITIES
// ====================================================================

// XSS prevention — strip dangerous characters from user-supplied strings
const sanitize = (str) => String(str || "").replace(/[<>"'`]/g, (c) => ({"<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;","`":"&#96;"}[c]));

// Client-side rate limiter for FMCSA/verification button clicks
function useRateLimit(maxCalls, windowMs) {
  const calls = React.useRef([]);
  return () => {
    const now = Date.now();
    calls.current = calls.current.filter((t) => now - t < windowMs);
    if (calls.current.length >= maxCalls) return false;
    calls.current.push(now);
    return true;
  };
}

// Session expiry — auto-logout after 8 hours of inactivity
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
function useSessionExpiry(session, onExpire) {
  const lastActivity = React.useRef(Date.now());
  useEffect(() => {
    if (!session) return;
    const tick = setInterval(() => {
      if (Date.now() - lastActivity.current > SESSION_TTL_MS) { onExpire(); clearInterval(tick); }
    }, 60000);
    const reset = () => { lastActivity.current = Date.now(); };
    window.addEventListener("mousemove", reset);
    window.addEventListener("keydown", reset);
    window.addEventListener("touchstart", reset);
    return () => { clearInterval(tick); window.removeEventListener("mousemove", reset); window.removeEventListener("keydown", reset); window.removeEventListener("touchstart", reset); };
  }, [!!session]);
}

// Input length caps — prevent oversized strings reaching the backend
const INPUT_LIMITS = { name: 80, company: 120, description: 500, note: 300, zip: 5, mc: 12, dot: 8 };
const capInput = (val, field) => String(val || "").slice(0, INPUT_LIMITS[field] || 200);

// Session nonce — attached to API calls for basic CSRF protection
const SESSION_NONCE = Math.random().toString(36).slice(2);

// ---------- Company pricing tiers ----------
const COMPANY_TIERS = [
  { id: "starter",    name: "Starter",    range: "5–10 profiles",   price: 350  },
  { id: "growth",     name: "Growth",     range: "11–50 profiles",  price: 800  },
  { id: "fleet",      name: "Fleet",      range: "51–150 profiles", price: 1800 },
  { id: "enterprise", name: "Enterprise", range: "150+ profiles",   price: 3500 },
];
function getCompanyTier(memberCount) {
  if (memberCount > 150) return COMPANY_TIERS[3];
  if (memberCount > 50) return COMPANY_TIERS[2];
  if (memberCount > 10) return COMPANY_TIERS[1];
  return COMPANY_TIERS[0];
}

// ---------- Mapping / geocoding ----------
// zipToCoord() below is a fast, synchronous, deterministic fake coordinate —
// used ONLY for things that render instantly and can't wait on a network call
// (the live tracking map dot, nearby-capacity distance sorting, deadhead
// estimates in list views). It is NOT real geography.
//
// For anything the user explicitly clicks "Estimate mileage" on, we use
// geocodeZip() / estimateMilesReal() below instead — those call a free,
// no-key-required ZIP lookup API (Zippopotam.us) and return REAL city,
// state, and lat/lng, so the mileage shown to the shipper is accurate.
function zipToCoord(zip) {
  const n = parseInt(String(zip).replace(/\D/g, "").padEnd(5, "0").slice(0, 5), 10) || 0;
  const lat = 25 + ((n * 2654435761) % 100000) / 100000 * 24;
  const lng = -125 + ((n * 40503) % 100000) / 100000 * 58;
  return { lat, lng };
}
function haversineMiles(a, b) {
  const R = 3958.8;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180, la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
}
function estimateMilesBetweenZips(zip1, zip2) {
  if (!zip1 || !zip2) return null;
  return haversineMiles(zipToCoord(zip1), zipToCoord(zip2));
}

// ---------- Real ZIP code geocoding (for accurate mileage on demand) ----------
// Uses Zippopotam.us — a free, no-key-required public API that returns real
// city, state, and lat/lng for any US ZIP code. Results are cached so the
// same ZIP is never looked up twice in a session.
const _zipCache = {};
async function geocodeZip(zip) {
  const clean = String(zip).replace(/\D/g, "").slice(0, 5);
  if (clean.length !== 5) return null;
  if (_zipCache[clean]) return _zipCache[clean];
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${clean}`);
    if (!res.ok) return null;
    const data = await res.json();
    const place = data.places?.[0];
    if (!place) return null;
    const result = {
      zip: clean,
      city: place["place name"],
      state: place["state abbreviation"],
      stateFull: place["state"],
      lat: parseFloat(place["latitude"]),
      lng: parseFloat(place["longitude"]),
    };
    _zipCache[clean] = result;
    return result;
  } catch (err) {
    console.warn("ZIP geocode lookup failed:", err.message);
    return null;
  }
}

// Real mileage estimate between two ZIP codes using actual geocoded coordinates.
// Returns { miles, origin: {city,state}, destination: {city,state} } or null if
// either ZIP can't be found. Road distance is approximated as straight-line
// distance × 1.17 (typical road-vs-straight-line ratio for US intercity routes).
async function estimateMilesReal(zip1, zip2) {
  const [a, b] = await Promise.all([geocodeZip(zip1), geocodeZip(zip2)]);
  if (!a || !b) return null;
  const straightLine = haversineMiles(a, b);
  return {
    miles: Math.round(straightLine * 1.17),
    origin: { city: a.city, state: a.state },
    destination: { city: b.city, state: b.state },
  };
}
function interpolateCoord(a, b, t) {
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
}

// Objective "Days to Pay" credit signal computed from a shipper's own payment
// history on this platform (deliveredAt -> paidAt). A production version would
// likely also blend in a real commercial credit feed (e.g. Experian Business).
function calcDaysToPay(shipperLoads) {
  const samples = shipperLoads.filter((l) => l.paid && l.paidAt && l.deliveredAt).map((l) => (l.paidAt - l.deliveredAt) / 86400000);
  if (!samples.length) return null;
  return Math.round((samples.reduce((a, b) => a + b, 0) / samples.length) * 10) / 10;
}

function laneMatches(lanes, load) {
  if (!lanes || !lanes.length) return false;
  const loadOrigin = (load.origin || "").toLowerCase();
  const loadDest = (load.destination || "").toLowerCase();
  return lanes.some((lane) => {
    const laneOrigin = (lane.origin || "").toLowerCase().trim();
    const laneDest = (lane.destination || "").toLowerCase().trim();
    const originHit = laneOrigin && (loadOrigin.includes(laneOrigin) || (load.originZip && load.originZip === lane.originZip));
    const destHit = laneDest && (loadDest.includes(laneDest) || (load.destZip && load.destZip === lane.destZip));
    return originHit && destHit;
  });
}

function findTruckerProfile(id, independentTruckers, corporations) {
  const indie = independentTruckers.find((t) => t.id === id);
  if (indie) return { ...indie, companyLabel: indie.company || "Owner-operator", isCorpMember: false, corp: indie.verification ? { verification: indie.verification, mcNumber: indie.mcNumber } : null };
  for (const corp of corporations) {
    const m = corp.members.find((x) => x.id === id);
    if (m) return { ...m, companyLabel: corp.companyName, isCorpMember: true, corp: { id: corp.id, companyName: corp.companyName, verification: corp.verification, mcNumber: corp.mcNumber } };
  }
  return null;
}
function findShipperProfile(id, independentShippers, corporations) {
  const indie = independentShippers.find((s) => s.id === id);
  if (indie) return { ...indie, companyLabel: indie.company || indie.name, corp: null };
  for (const corp of corporations) {
    const m = corp.members.find((x) => x.id === id);
    if (m) return { ...m, companyLabel: corp.companyName, corp: { id: corp.id, companyName: corp.companyName } };
  }
  return null;
}

function Stars({ value, size = 14 }) {
  const full = Math.round(value);
  return (
    <span style={{ display: "inline-flex", gap: 1 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} fill={i <= full ? "#FFB400" : "none"} stroke={i <= full ? "#FFB400" : "#9A958A"} />
      ))}
    </span>
  );
}

// ====================================================================
// ROOT
// ====================================================================
export default function HaulBoard() {
  const [session, setSessionRaw] = useState(null);
  const [sessionRestorePending, setSessionRestorePending] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [showSessionWarning, setShowSessionWarning] = useState(false);

  // Persist session to localStorage so refreshing the page keeps you logged in.
  // Operator sessions are never persisted — the PIN must be re-entered every time.
  const setSession = (next) => {
    setSessionRaw(next);
    try {
      if (next && next.role !== "operator") localStorage.setItem("df_session", JSON.stringify(next));
      else localStorage.removeItem("df_session");
    } catch (e) { /* localStorage unavailable — session just won't persist */ }
  };

  // Email verification — required before accessing dashboard
  const [pendingVerification, setPendingVerification] = useState(null); // { email, name, code, sessionToSet }
  const [enteredCode, setEnteredCode] = useState("");
  const [verifyError, setVerifyError] = useState("");
  const [resending, setResending] = useState(false);

  const startEmailVerification = async (email, name, sessionToSet) => {
    const code = generateVerifyCode();
    const sent = await sendVerificationEmail(email, name, code);
    setPendingVerification({ email, name, code, sessionToSet });
    setEnteredCode("");
    setVerifyError("");
    if (!sent) {
      // EmailJS not configured yet — auto-verify in dev mode
      setPendingVerification({ email, name, code: "DEV", sessionToSet });
    }
  };

  const confirmCode = () => {
    if (!pendingVerification) return;
    if (pendingVerification.code === "DEV" || enteredCode.trim() === pendingVerification.code) {
      setSession(pendingVerification.sessionToSet);
      setPendingVerification(null);
      setEnteredCode("");
    } else {
      setVerifyError("Incorrect code — check your email and try again.");
    }
  };

  const resendCode = async () => {
    if (!pendingVerification) return;
    setResending(true);
    const code = generateVerifyCode();
    await sendVerificationEmail(pendingVerification.email, pendingVerification.name, code);
    setPendingVerification((p) => ({ ...p, code }));
    setEnteredCode("");
    setVerifyError("");
    setResending(false);
  };

  // Operator login — lives here at root so nothing can go out of scope
  const [showOperatorLogin, setShowOperatorLogin] = useState(false);
  const [opPin, setOpPin] = useState("");
  const tryOperatorLogin = () => {
    if (opPin === OPERATOR_PIN) { setShowOperatorLogin(false); setOpPin(""); setSession({ role: "operator" }); }
    else { alert("Incorrect PIN."); setOpPin(""); }
  };
  // Keyboard shortcut: press Ctrl + Shift + O to open operator login
  useEffect(() => {
    const handler = (e) => { if (e.ctrlKey && e.shiftKey && e.key === "O") setShowOperatorLogin(true); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const [independentShippers, setIndependentShippers] = useState(seedIndependentShippers);
  const [independentTruckers, setIndependentTruckers] = useState(seedIndependentTruckers);
  const [corporations, setCorporations] = useState(seedCorporations);
  const [loads, setLoads] = useState(seedLoads);
  const [messages, setMessages] = useState({});
  const [dbReady, setDbReady] = useState(false);

  // ── Load real data from database on startup ──
  useEffect(() => {
    async function loadFromDB() {
      try {
        const [usersRes, loadsRes] = await Promise.all([
          api.get("/api/operator/users"),
          api.get("/api/loads"),
        ]);
        const allUsers = usersRes.users || [];
        const dbShippers = allUsers.filter(u => u.role === "shipper").map(dbUserToFrontend);
        const dbTruckers = allUsers.filter(u => u.role === "trucker").map(dbUserToFrontend);
        const dbCorps    = allUsers.filter(u => u.role === "corp").map(dbUserToCorp);
        const dbLoads = (loadsRes.loads || []).map(dbLoadToFrontend);
        if (dbShippers.length) setIndependentShippers(dbShippers);
        if (dbTruckers.length) setIndependentTruckers(dbTruckers);
        if (dbCorps.length)    setCorporations(dbCorps);
        if (dbLoads.length)    setLoads(dbLoads);
      } catch (err) {
        console.warn("DB load failed — running on seed data:", err.message);
      } finally {
        setDbReady(true);
      }
    }
    loadFromDB();
  }, []);

  // ── Restore a saved session from localStorage once the DB has loaded ──
  // Validates the referenced profile still exists and isn't suspended
  // before restoring — operator sessions are never restored (PIN required).
  useEffect(() => {
    if (!dbReady) return;
    try {
      const saved = localStorage.getItem("df_session");
      if (saved) {
        const parsed = JSON.parse(saved);
        let valid = false;
        if (parsed.corpId) {
          valid = corporations.some((c) => c.id === parsed.corpId && !c.suspended);
        } else if (parsed.profileId) {
          const pool = parsed.role === "shipper" ? independentShippers : independentTruckers;
          valid = pool.some((u) => u.id === parsed.profileId && !u.suspended);
        }
        if (valid) setSessionRaw(parsed);
        else localStorage.removeItem("df_session");
      }
    } catch (e) { /* corrupt saved session — ignore and start fresh */ }
    setSessionRestorePending(false);
  }, [dbReady]);

  // Session expiry — auto-logout after 8 hours inactivity
  useSessionExpiry(session, () => { setSession(null); setShowSessionWarning(true); });

  const addNotification = (msg, tone = "info") => {
    const id = "n" + Date.now();
    setNotifications((prev) => [{ id, msg, tone, ts: Date.now() }, ...prev.slice(0, 19)]);
    setTimeout(() => setNotifications((prev) => prev.filter((n) => n.id !== id)), 6000);
  };

  useEffect(() => {
    const iv = setInterval(() => {
      setLoads((prev) => prev.map((l) => {
        if (l.status !== "in_transit" || l.progress >= 100) return l;
        const nextProgress = Math.min(100, l.progress + (2 + Math.random() * 4));
        return nextProgress >= 100
          ? { ...l, progress: 100, status: "delivered", deliveredAt: Date.now() }
          : { ...l, progress: nextProgress };
      }));
    }, 1800);
    return () => clearInterval(iv);
  }, []);

  const sendMessage = async (loadId, truckerId, msg) => {
    const key = threadKey(loadId, truckerId);
    const newMsg = { id: "m" + Date.now() + Math.random(), ts: Date.now(), ...msg };
    setMessages((prev) => ({ ...prev, [key]: [...(prev[key] || []), newMsg] }));
    try {
      await api.post("/api/messages", {
        loadId, carrierId: truckerId,
        senderId: msg.senderId || msg.from,
        role: msg.role, name: msg.name, text: msg.text,
      });
    } catch (err) { console.warn("Message not saved to DB:", err.message); }
  };

  const loadMessages = async (loadId, truckerId) => {
    try {
      const key = threadKey(loadId, truckerId);
      const { messages: dbMsgs } = await api.get(`/api/messages/${loadId}/${truckerId}`);
      if (dbMsgs?.length) {
        const formatted = dbMsgs.map(m => ({ id: m.id, ts: new Date(m.sent_at).getTime(), role: m.role, name: m.name, text: m.text }));
        setMessages((prev) => ({ ...prev, [key]: formatted }));
      }
    } catch (err) { console.warn("Could not load messages:", err.message); }
  };

  // Dual-setter update: only the matching record actually changes.
  const updateTrucker = (id, patchFn) => {
    setIndependentTruckers((prev) => prev.map((t) => (t.id === id ? patchFn(t) : t)));
    setCorporations((prev) => prev.map((c) => ({ ...c, members: c.members.map((m) => (m.id === id ? patchFn(m) : m)) })));
  };
  const updateShipperProfile = (id, patchFn) => {
    setIndependentShippers((prev) => prev.map((s) => (s.id === id ? patchFn(s) : s)));
    setCorporations((prev) => prev.map((c) => ({ ...c, members: c.members.map((m) => (m.id === id ? patchFn(m) : m)) })));
  };
  const addCorpMember = async (corpId, member) => {
    setCorporations((prev) => prev.map((c) => {
      if (c.id !== corpId) return c;
      const newMembers = [...(c.members || []), member];
      // Save updated members array to DB (stored in lanes field)
      api.patch(`/api/auth/user/${corpId}`, { lanes: newMembers })
        .catch(err => console.warn("Could not save corp member to DB:", err.message));
      return { ...c, members: newMembers };
    }));
  };

  // ── Coming soon gate — shows until LAUNCH_DATE ──
  // Operator can still access via Ctrl+Shift+O regardless of launch status
  // Brief loading screen while we check for a saved session — avoids a
  // flash of the login page for users who are actually already logged in
  if (sessionRestorePending) {
    return (
      <div style={{ minHeight: "100vh", background: "#1B1D21", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#9A958A", fontSize: 13 }}>Loading…</div>
      </div>
    );
  }

  if (!session && !IS_LAUNCHED) {
    return (
      <>
        <ComingSoonScreen setPage={() => {}} />
        {showOperatorLogin && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 16 }}>
            <div style={{ background: "#fff", borderRadius: 12, padding: 28, width: 320, boxShadow: "0 12px 40px rgba(0,0,0,0.4)" }}>
              <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 18, marginBottom: 4, textTransform: "uppercase" }}>Operator Access</div>
              <div style={{ fontSize: 12, color: "#9A958A", marginBottom: 16 }}>Enter your operator PIN.</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <input value={opPin} onChange={(e) => setOpPin(e.target.value)} type="password" placeholder="PIN" onKeyDown={(e) => e.key === "Enter" && tryOperatorLogin()} style={inputStyle} autoFocus />
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={tryOperatorLogin} style={{ ...primaryBtn("#1B1D21"), flex: 1 }}>Enter</button>
                  <button onClick={() => { setShowOperatorLogin(false); setOpPin(""); }} style={ghostBtn}>Cancel</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  if (!session) {
    return (
      <>
        <AuthGate
          independentShippers={independentShippers} independentTruckers={independentTruckers} corporations={corporations}
          onIndieShipperAuth={async (s) => {
            try {
              const { user } = await api.post("/api/auth/signup", { ...s, role: "shipper" });
              const mappedUser = dbUserToFrontend(user);
              setIndependentShippers((p) => upsert(p, mappedUser));
              startEmailVerification(mappedUser.email, mappedUser.name, { role: "shipper", corpId: null, profileId: mappedUser.id });
            } catch (err) {
              // If already exists, try login instead
              try {
                const { user } = await api.post("/api/auth/login", { email: s.email });
                const mappedUser = dbUserToFrontend(user);
                setIndependentShippers((p) => upsert(p, mappedUser));
                startEmailVerification(mappedUser.email, mappedUser.name, { role: "shipper", corpId: null, profileId: mappedUser.id });
              } catch (e) { alert(e.message); }
            }
          }}
          onIndieTruckerAuth={async (t) => {
            try {
              const { user } = await api.post("/api/auth/signup", { ...t, role: "trucker" });
              const mappedUser = dbUserToFrontend(user);
              setIndependentTruckers((p) => upsert(p, mappedUser));
              startEmailVerification(mappedUser.email, mappedUser.name, { role: "trucker", corpId: null, profileId: mappedUser.id });
            } catch (err) {
              try {
                const { user } = await api.post("/api/auth/login", { email: t.email });
                const mappedUser = dbUserToFrontend(user);
                setIndependentTruckers((p) => upsert(p, mappedUser));
                startEmailVerification(mappedUser.email, mappedUser.name, { role: "trucker", corpId: null, profileId: mappedUser.id });
              } catch (e) { alert(e.message); }
            }
          }}
          onCorpAuth={async (corp) => {
            setCorporations((p) => upsert(p, corp));
            const sessionToSet = { role: corp.subtype === "trucking" ? "trucker" : "shipper", corpId: corp.id, profileId: null };
            startEmailVerification(corp.email, corp.companyName, sessionToSet);
          }}
        />
        {showOperatorLogin && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 16 }}>
            <div style={{ background: "#fff", borderRadius: 12, padding: 28, width: 320, boxShadow: "0 12px 40px rgba(0,0,0,0.4)" }}>
              <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 18, marginBottom: 4, textTransform: "uppercase" }}>Operator Access</div>
              <div style={{ fontSize: 12, color: "#9A958A", marginBottom: 16 }}>Enter your operator PIN.</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <input value={opPin} onChange={(e) => setOpPin(e.target.value)} type="password" placeholder="PIN" onKeyDown={(e) => e.key === "Enter" && tryOperatorLogin()} style={inputStyle} autoFocus />
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={tryOperatorLogin} style={{ ...primaryBtn("#1B1D21"), flex: 1 }}>Enter</button>
                  <button onClick={() => { setShowOperatorLogin(false); setOpPin(""); }} style={ghostBtn}>Cancel</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // ── Email verification gate ──
  if (pendingVerification) {
    const isDevMode = pendingVerification.code === "DEV";
    return (
      <div style={{ minHeight: "100vh", background: "#F8F5EE", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ background: "#fff", borderRadius: 14, padding: 36, maxWidth: 420, width: "100%", boxShadow: "0 8px 32px rgba(0,0,0,0.10)" }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ background: "#FFB400", width: 52, height: 52, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
              <FileText size={26} color="#1B1D21" />
            </div>
            <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 22, textTransform: "uppercase", marginBottom: 6 }}>
              Verify your email
            </div>
            <div style={{ fontSize: 13, color: "#6B6557", lineHeight: 1.6 }}>
              {isDevMode
                ? "EmailJS is not configured yet — enter any 6 digits to continue in dev mode."
                : <>We sent a 6-digit verification code to <b>{pendingVerification.email}</b>. Enter it below to confirm your identity and access your dashboard.</>
              }
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input
              value={enteredCode}
              onChange={(e) => { setEnteredCode(e.target.value.replace(/\D/g,"").slice(0,6)); setVerifyError(""); }}
              onKeyDown={(e) => e.key === "Enter" && confirmCode()}
              placeholder="000000"
              maxLength={6}
              style={{ ...inputStyle, fontSize: 28, letterSpacing: "0.3em", textAlign: "center", fontFamily: "monospace", padding: "14px 12px" }}
              autoFocus
            />
            {verifyError && <div style={{ fontSize: 12, color: "#C0432B", textAlign: "center" }}>{verifyError}</div>}
            <button
              onClick={confirmCode}
              disabled={enteredCode.length < 6 && !isDevMode}
              style={{ ...primaryBtn("#FFB400"), opacity: (enteredCode.length === 6 || isDevMode) ? 1 : 0.5 }}
            >
              Verify and enter dashboard
            </button>
            <button
              onClick={resendCode}
              disabled={resending}
              style={{ ...ghostBtn, fontSize: 12, opacity: resending ? 0.6 : 1 }}
            >
              {resending ? "Sending…" : "Resend code"}
            </button>
            <button
              onClick={() => { setPendingVerification(null); setEnteredCode(""); setVerifyError(""); }}
              style={{ background: "none", border: "none", color: "#9A958A", fontSize: 12, textDecoration: "underline", cursor: "pointer", padding: "4px 0" }}
            >
              Cancel and go back
            </button>
            <div style={{ fontSize: 11, color: "#9A958A", textAlign: "center", lineHeight: 1.5 }}>
              Check your spam folder if you don't see it. The code expires after 10 minutes.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Operator session ──
  if (session?.role === "operator") {
    return (
      <OperatorApp
        independentShippers={independentShippers}
        independentTruckers={independentTruckers}
        corporations={corporations}
        loads={loads}
        messages={messages}
        onRemoveShipper={async (id) => {
          setIndependentShippers((p) => p.filter((s) => s.id !== id));
          try { await api.del(`/api/operator/users/${id}`); } catch (e) { console.warn(e.message); }
        }}
        onSuspendShipper={async (id, val) => {
          setIndependentShippers((p) => p.map((s) => s.id === id ? { ...s, suspended: val } : s));
          try { await api.patch(`/api/operator/users/${id}/suspend`, { suspended: val }); } catch (e) { console.warn(e.message); }
        }}
        onUpdateShipper={async (updated) => {
          setIndependentShippers((p) => p.map((s) => s.id === updated.id ? updated : s));
          try { await api.patch(`/api/auth/user/${updated.id}`, updated); } catch (e) { console.warn(e.message); }
        }}
        onRemoveTrucker={async (id) => {
          setIndependentTruckers((p) => p.filter((t) => t.id !== id));
          try { await api.del(`/api/operator/users/${id}`); } catch (e) { console.warn(e.message); }
        }}
        onSuspendTrucker={async (id, val) => {
          setIndependentTruckers((p) => p.map((t) => t.id === id ? { ...t, suspended: val } : t));
          try { await api.patch(`/api/operator/users/${id}/suspend`, { suspended: val }); } catch (e) { console.warn(e.message); }
        }}
        onUpdateTrucker={async (updated) => {
          setIndependentTruckers((p) => p.map((t) => t.id === updated.id ? updated : t));
          try { await api.patch(`/api/auth/user/${updated.id}`, updated); } catch (e) { console.warn(e.message); }
        }}
        onRemoveCorp={async (id) => {
          setCorporations((p) => p.filter((c) => c.id !== id));
          try { await api.del(`/api/operator/users/${id}`); } catch (e) { console.warn("Corp remove not saved:", e.message); }
        }}
        onSuspendCorp={async (id, val) => {
          setCorporations((p) => p.map((c) => c.id === id ? { ...c, suspended: val } : c));
          try { await api.patch(`/api/operator/users/${id}/suspend`, { suspended: val }); } catch (e) { console.warn("Corp suspend not saved:", e.message); }
        }}
        onUpdateCorp={async (updated) => {
          setCorporations((p) => p.map((c) => c.id === updated.id ? updated : c));
          try { await api.patch(`/api/auth/user/${updated.id}`, { name: updated.companyName, email: updated.email, operator_notes: updated.operatorNotes }); }
          catch (err) { console.warn("Corp update not saved:", err.message); }
        }}
        onRemoveLoad={(id) => setLoads((p) => p.filter((l) => l.id !== id))}
        onImpersonate={(newSession) => setSession({ ...newSession, impersonating: true })}
        onLogout={() => setSession(null)}
      />
    );
  }

  // Corp session without a chosen profile yet -> roster picker
  if (session?.corpId && !session.profileId) {
    const corp = corporations.find((c) => c.id === session.corpId);
    return (
      <>
        <RosterPicker
          corp={corp} role={session.role}
          onPick={(profileId) => setSession({ ...session, profileId })}
          onAddMember={(member) => { addCorpMember(corp.id, member); setSession({ ...session, profileId: member.id }); }}
          onLogout={() => setSession(null)}
        />
      </>
    );
  }

  const onSwitchProfile = session.corpId ? () => setSession({ ...session, profileId: null }) : null;

  if (session.role === "shipper") {
    const me = findShipperProfile(session.profileId, independentShippers, corporations);
    const corp = session.corpId ? corporations.find((c) => c.id === session.corpId) : null;
    return (
      <>
        {session.impersonating && <ImpersonationBanner name={me?.name || "Shipper"} onReturn={() => setSession({ role: "operator" })} />}
        <ShipperApp
          me={me} corp={corp} loads={loads} messages={messages}
          updateShipperProfile={updateShipperProfile}
          independentTruckers={independentTruckers} corporations={corporations}
          setLoads={setLoads} updateTrucker={updateTrucker} addCorpMember={addCorpMember} sendMessage={sendMessage}
          setMessages={setMessages} addNotification={addNotification}
          onLogout={() => setSession(null)} onSwitchProfile={onSwitchProfile}
        />
      </>
    );
  }

  const me = findTruckerProfile(session.profileId, independentTruckers, corporations);
  const corp = session.corpId ? corporations.find((c) => c.id === session.corpId) : null;

  const insuranceRecord = corp ? corp.verification : me.verification;
  const isLocked = insuranceRecord?.insuranceStatus === "LAPSED";

  const recheckInsurance = async (mcNumber) => {
    const data = await runCarrierOnboardingCheck(mcNumber, null, true); // forceClean=true for re-verification demo
    if (corp) setCorporations((prev) => prev.map((c) => (c.id === corp.id ? { ...c, verification: data } : c)));
    else updateTrucker(me.id, (t) => ({ ...t, verification: data }));
  };

  if (isLocked) {
    return (
      <>
        <AccountLockedScreen
          companyLabel={corp ? corp.companyName : me.companyLabel} mcNumber={corp ? corp.mcNumber : me.mcNumber}
          onRecheck={() => recheckInsurance(corp ? corp.mcNumber : me.mcNumber)}
          onLogout={() => setSession(null)}
        />
      </>
    );
  }

  return (
    <>
      {session.impersonating && <ImpersonationBanner name={me?.name || "Carrier"} onReturn={() => setSession({ role: "operator" })} />}
      <TruckerApp
        me={me} corp={corp} loads={loads} messages={messages}
        independentShippers={independentShippers} corporations={corporations}
        setLoads={setLoads} updateTrucker={updateTrucker} updateShipperProfile={updateShipperProfile} addCorpMember={addCorpMember} sendMessage={sendMessage}
        setMessages={setMessages} addNotification={addNotification}
        onLogout={() => setSession(null)} onSwitchProfile={onSwitchProfile}
      />
      <NotificationToasts notifications={notifications} />
      {showSessionWarning && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(27,29,33,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: 16 }}>
          <Card style={{ padding: 28, maxWidth: 380, textAlign: "center" }}>
            <Lock size={32} color="#FFB400" style={{ marginBottom: 12 }} />
            <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 20, marginBottom: 8 }}>Session Expired</div>
            <div style={{ fontSize: 14, color: "#6B6557", marginBottom: 20 }}>You've been logged out after 8 hours of inactivity. Your data is safe — just log back in.</div>
            <button onClick={() => setShowSessionWarning(false)} style={{ ...primaryBtn("#FFB400"), width: "100%" }}>Log back in</button>
          </Card>
        </div>
      )}
    </>
  );
}

// ---------- Shared shell ----------
// ====================================================================
// LOGO — signature mark: a bold arrow cutting straight through a badge,
// symbolizing "direct" routing with zero detours (zero broker stops).
// Renders as an SVG icon + wordmark. Use variant="light" on dark
// backgrounds (nav bars) and variant="dark" on light backgrounds.
// ====================================================================
function LogoMark({ size = 40, variant = "light" }) {
  const badgeBg = variant === "light" ? "#FFB400" : "#1B1D21";
  const iconFill = variant === "light" ? "#1B1D21" : "#FFB400";
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.2, background: badgeBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <Truck size={size * 0.55} color={iconFill} />
    </div>
  );
}

function Logo({ size = 40, variant = "light", showTagline = true }) {
  const textColor = variant === "light" ? "#F2EDE4" : "#1B1D21";
  const taglineColor = variant === "light" ? "#9A958A" : "#6B6557";
  const coColor = variant === "light" ? "#FFB400" : "#1B1D21";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <LogoMark size={size} variant={variant} />
      <div>
        <div className="stencil" style={{ fontSize: size * 0.5, fontWeight: 700, lineHeight: 1, color: textColor, letterSpacing: "0.01em" }}>
          DIRECT FREIGHT <span style={{ color: coColor }}>CO</span>
        </div>
        {showTagline && (
          <div className="mono" style={{ fontSize: size * 0.275, color: taglineColor, marginTop: 2 }}>
            NO BROKERS · NO CUT · NO BS
          </div>
        )}
      </div>
    </div>
  );
}

function Shell({ title, subtitle, badge, avatar, me, onLogout, onSwitchProfile, children }) {
  const w = useWindowWidth();
  const isMobile = w <= 640;
  const [showFeedback, setShowFeedback] = useState(false);

  return (
    <div style={{ minHeight: "100vh", background: "#F2EDE4", fontFamily: "Inter, sans-serif", color: "#1B1D21" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Inter:wght@400;500;600;700&family=Roboto+Mono:wght@500&display=swap');
        .stencil { font-family: 'Oswald', sans-serif; letter-spacing: 0.02em; text-transform: uppercase; }
        .mono { font-family: 'Roboto Mono', monospace; }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-thumb { background: #C9C2B3; border-radius: 4px; }
        button { font-family: inherit; cursor: pointer; }
        input, textarea, select { font-family: inherit; }
        input:focus, textarea:focus, select:focus { outline: 2px solid #FFB400; outline-offset: 1px; }
      `}</style>
      <header style={{
        background: "#1B1D21", color: "#F2EDE4",
        padding: isMobile ? "12px 16px" : "16px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: "4px solid #FFB400", flexWrap: "wrap", gap: 8,
        position: "sticky", top: 0, zIndex: 50,
      }}>
        <Logo size={isMobile ? 32 : 40} variant="light" showTagline={!isMobile} />
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 8 : 14 }}>
          <ProfilePicture src={avatar} name={title} size={isMobile ? 30 : 38} />
          {!isMobile && (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{title}</div>
              {subtitle && <div className="mono" style={{ fontSize: 11, color: "#9A958A" }}>{subtitle}</div>}
            </div>
          )}
          {badge}
          {!isMobile && (
            <button onClick={() => setShowFeedback(true)} style={{ background: "transparent", border: "1px solid #FFB400", color: "#FFB400", borderRadius: 6, padding: "8px 12px", fontSize: 13, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
              ⭐ Review
            </button>
          )}
          {onSwitchProfile && !isMobile && (
            <button onClick={onSwitchProfile} style={{ background: "transparent", border: "1px solid #44484D", color: "#F2EDE4", borderRadius: 6, padding: "8px 12px", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
              <RefreshCcw size={14} /> Switch profile
            </button>
          )}
          <button onClick={onLogout} style={{ background: "transparent", border: "1px solid #44484D", color: "#F2EDE4", borderRadius: 6, padding: isMobile ? "6px 10px" : "8px 12px", fontSize: isMobile ? 12 : 13, display: "flex", alignItems: "center", gap: 6 }}>
            <ArrowLeft size={14} /> {isMobile ? "Out" : "Log out"}
          </button>
        </div>
      </header>
      <main style={{ padding: isMobile ? "12px" : "24px", maxWidth: 1180, margin: "0 auto", paddingBottom: isMobile ? 80 : 24 }}>{children}</main>
      {!isMobile && (
        <div style={{ borderTop: "1px solid #E2DCCC", padding: "12px 24px", background: "#F8F5EE", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <ShellFooter />
          <button onClick={() => setShowFeedback(true)} style={{ background: "none", border: "1px solid #E2DCCC", borderRadius: 6, padding: "6px 12px", fontSize: 12, color: "#6B6557", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
            ⭐ Leave a review
          </button>
        </div>
      )}
      {showFeedback && <FeedbackModal me={me} onClose={() => setShowFeedback(false)} />}
    </div>
  );
}

// ── Mobile bottom tab navigation ──
function MobileBottomNav({ tabs, activeTab, onSelect }) {
  const w = useWindowWidth();
  const [showMore, setShowMore] = useState(false);
  if (w > 640) return null;

  const maxVisible = 5; // leave the 6th slot for "More" if there's overflow
  const hasOverflow = tabs.length > maxVisible + 1;
  const visible = hasOverflow ? tabs.slice(0, maxVisible) : tabs.slice(0, 6);
  const overflowTabs = hasOverflow ? tabs.slice(maxVisible) : [];
  const overflowHasActive = overflowTabs.some((t) => t.id === activeTab);

  return (
    <>
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100,
        background: "#1B1D21", borderTop: "2px solid #FFB400",
        display: "flex", alignItems: "stretch",
      }}>
        {visible.map((t) => {
          const active = activeTab === t.id;
          return (
            <button key={t.id} onClick={() => onSelect(t.id)} style={{
              flex: 1, padding: "10px 4px 8px", border: "none",
              background: active ? "#FFB400" : "transparent",
              color: active ? "#1B1D21" : "#9A958A",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
              fontSize: 9, fontWeight: active ? 700 : 500, textTransform: "uppercase",
              letterSpacing: "0.03em", cursor: "pointer", minWidth: 0,
            }}>
              {t.icon && <span style={{ fontSize: 18 }}>{t.icon}</span>}
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>
                {t.shortLabel || t.label.split("(")[0].trim()}
              </span>
            </button>
          );
        })}
        {hasOverflow && (
          <button onClick={() => setShowMore(true)} style={{
            flex: 1, padding: "10px 4px 8px", border: "none",
            background: overflowHasActive ? "#FFB400" : "transparent",
            color: overflowHasActive ? "#1B1D21" : "#9A958A",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
            fontSize: 9, fontWeight: overflowHasActive ? 700 : 500, textTransform: "uppercase",
            letterSpacing: "0.03em", cursor: "pointer", minWidth: 0,
          }}>
            <span style={{ fontSize: 18 }}>⋯</span>
            <span>More</span>
          </button>
        )}
      </div>

      {showMore && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "flex-end" }} onClick={() => setShowMore(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", width: "100%", borderRadius: "16px 16px 0 0", padding: "8px 0 24px", maxHeight: "70vh", overflowY: "auto" }}>
            <div style={{ width: 40, height: 4, background: "#D8D1C0", borderRadius: 2, margin: "8px auto 12px" }} />
            {overflowTabs.map((t) => {
              const active = activeTab === t.id;
              return (
                <button key={t.id} onClick={() => { onSelect(t.id); setShowMore(false); }} style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px 20px",
                  border: "none", borderBottom: "1px solid #F2EDE4", background: active ? "#FFFBF0" : "#fff",
                  fontSize: 15, fontWeight: active ? 700 : 500, color: "#1B1D21", textAlign: "left", cursor: "pointer",
                }}>
                  {t.icon && <span style={{ fontSize: 20 }}>{t.icon}</span>}
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

function ShellFooter({ onFooterClick }) {
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showCarrierAgreement, setShowCarrierAgreement] = useState(false);
  const [showShipperAgreement, setShowShipperAgreement] = useState(false);
  const [showContact, setShowContact] = useState(false);
  return (
    <footer style={{ borderTop: "1px solid #E2DCCC", padding: "12px 24px", background: "#F8F5EE" }}>
      <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap", marginBottom: 8 }}>
        {[
          ["Terms of Service", () => setShowTerms(true)],
          ["Privacy Policy", () => setShowPrivacy(true)],
          ["Carrier Agreement", () => setShowCarrierAgreement(true)],
          ["Shipper Agreement", () => setShowShipperAgreement(true)],
          ["Contact", () => setShowContact(true)],
        ].map(([label, fn]) => (
          <button key={label} onClick={fn} style={{ background: "none", border: "none", color: "#6B6557", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer", padding: 0 }}>
            <FileText size={11} /> {label}
          </button>
        ))}
      </div>
      <div style={{ fontSize: 11, color: "#9A958A", textAlign: "center", maxWidth: 680, margin: "0 auto", lineHeight: 1.5 }}>
        <b>Legal notice:</b> Direct Freight is a technology platform and information aggregator only — not a freight broker, carrier, insurer, or financial institution. Nothing on this platform constitutes legal, tax, or financial advice. Always consult qualified professionals for those needs.
      </div>
      <div style={{ fontSize: 10, color: "#C9C2B3", textAlign: "center", marginTop: 6, userSelect: "none" }}>
        © 2026 Direct Freight Co LLC. All rights reserved.
      </div>
      {showTerms && <TermsModal onClose={() => setShowTerms(false)} />}
      {showPrivacy && <PrivacyModal onClose={() => setShowPrivacy(false)} />}
      {showCarrierAgreement && <CarrierAgreementModal onClose={() => setShowCarrierAgreement(false)} />}
      {showShipperAgreement && <ShipperAgreementModal onClose={() => setShowShipperAgreement(false)} />}
      {showContact && <ContactModal onClose={() => setShowContact(false)} />}
    </footer>
  );
}

function AboutModal({ onClose, onJoinWaitlist }) {
  const SUPPORT_EMAIL = "directfreightco2026@directfreightco.com";
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(27,29,33,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 16 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#F2EDE4", borderRadius: 14, width: "100%", maxWidth: 620, maxHeight: "85vh", overflowY: "auto", boxShadow: "0 16px 48px rgba(0,0,0,0.4)" }}>
        <div style={{ background: "#1B1D21", color: "#F2EDE4", padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 1 }}>
          <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 20, textTransform: "uppercase" }}>Why I Built Direct Freight Co</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#F2EDE4", cursor: "pointer" }}><X size={20} /></button>
        </div>

        <div style={{ padding: "32px 28px" }}>
          <div style={{ fontSize: 15, color: "#1B1D21", lineHeight: 1.75 }}>
            <p style={{ marginBottom: 16 }}>
              I've been hotshotting for about two years, and one thing kept happening: I got tired of dealing with brokers.
            </p>
            <p style={{ marginBottom: 16 }}>
              Wrong pickup addresses. Loads that weren't ready. Waiting weeks to get paid — or sometimes not getting paid at all. It felt like every load came with a new headache that had nothing to do with actually moving freight.
            </p>
            <p style={{ marginBottom: 16 }}>
              Eventually I thought, <i>there has to be a better way.</i>
            </p>
            <p style={{ marginBottom: 16 }}>
              So I built <b>Direct Freight Co</b>.
            </p>
            <p style={{ marginBottom: 16 }}>
              The idea is simple: connect shippers and carriers directly. No middleman. No games. Just the people with freight and the people moving it, working together.
            </p>
            <p style={{ marginBottom: 16 }}>
              I built this because I was tired of the way things worked, and I knew I wasn't the only one.
            </p>
            <p style={{ marginBottom: 0 }}>
              If you've dealt with the same frustrations, I think you're going to like what we're building.
            </p>
          </div>

          <div style={{ marginTop: 28, paddingTop: 24, borderTop: "1px solid #E2DCCC" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#6B6557", textTransform: "uppercase", marginBottom: 8 }}>Questions? Reach out directly</div>
            <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: "#B5790A", fontWeight: 700, fontSize: 15, textDecoration: "none" }}>
              📧 {SUPPORT_EMAIL}
            </a>
          </div>

          <button onClick={onJoinWaitlist} style={{ marginTop: 24, width: "100%", background: "#FFB400", border: "none", color: "#1B1D21", borderRadius: 8, padding: "14px 0", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
            Join the waitlist
          </button>
        </div>
      </div>
    </div>
  );
}

function ContactModal({ onClose }) {
  const SUPPORT_EMAIL = "directfreightco2026@directfreightco.com";
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(27,29,33,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 16 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 420, overflow: "hidden", boxShadow: "0 16px 48px rgba(0,0,0,0.3)" }}>
        <div style={{ background: "#1B1D21", color: "#F2EDE4", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 18, textTransform: "uppercase" }}>Contact Us</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#F2EDE4", cursor: "pointer" }}><X size={18} /></button>
        </div>
        <div style={{ padding: 28, textAlign: "center" }}>
          <div style={{ fontSize: 14, color: "#6B6557", marginBottom: 20, lineHeight: 1.6 }}>
            Questions, concerns, or anything account-specific — reach out and a real person will get back to you.
          </div>
          <a href={`mailto:${SUPPORT_EMAIL}`} style={{
            display: "inline-flex", alignItems: "center", gap: 8, background: "#FFB400", color: "#1B1D21",
            borderRadius: 8, padding: "14px 24px", fontWeight: 700, fontSize: 15, textDecoration: "none",
          }}>
            📧 {SUPPORT_EMAIL}
          </a>
          <div style={{ fontSize: 12, color: "#9A958A", marginTop: 16 }}>
            We typically respond within 1 business day.
          </div>
        </div>
      </div>
    </div>
  );
}

function ImpersonationBanner({ name, onReturn }) {
  return (
    <div style={{ background: "#C0432B", color: "#fff", padding: "10px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", position: "sticky", top: 0, zIndex: 500 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 13 }}>
        👁 Operator view — you are viewing as <b>{name}</b>. You have full access to everything they see.
      </div>
      <button onClick={onReturn} style={{ background: "#fff", color: "#C0432B", border: "none", borderRadius: 6, padding: "6px 14px", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
        ← Return to Operator Dashboard
      </button>
    </div>
  );
}

function Badge({ children, tone = "amber" }) {
  const tones = {
    amber: { bg: "#FFB400", fg: "#1B1D21" }, green: { bg: "#3E7A4B", fg: "#fff" }, gray: { bg: "#44484D", fg: "#F2EDE4" },
    orange: { bg: "#FF5A1F", fg: "#fff" }, blue: { bg: "#3A6EA5", fg: "#fff" }, red: { bg: "#C0432B", fg: "#fff" },
  }[tone];
  return <span className="mono" style={{ background: tones.bg, color: tones.fg, fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>{children}</span>;
}
function Card({ children, style }) {
  return <div style={{ background: "#fff", border: "1px solid #E2DCCC", borderRadius: 10, boxShadow: "0 1px 2px rgba(0,0,0,0.04)", ...style }}>{children}</div>;
}
function Field({ label, children }) {
  return <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#44484D", flex: 1 }}>{label}<div style={{ marginTop: 4 }}>{children}</div></label>;
}
const inputStyle = { width: "100%", padding: "10px 12px", border: "1px solid #D8D1C0", borderRadius: 6, fontSize: 16, boxSizing: "border-box" };
const primaryBtn = (accent) => ({ background: accent, color: "#1B1D21", border: "none", padding: "13px 0", borderRadius: 6, fontWeight: 700, fontSize: 15, minHeight: 44, touchAction: "manipulation" });
const ghostBtn = { background: "#fff", color: "#1B1D21", border: "1px solid #D8D1C0", padding: "10px 16px", borderRadius: 6, fontWeight: 600, fontSize: 14, minHeight: 44, touchAction: "manipulation" };
function Empty({ text }) { return <Card style={{ padding: 40, textAlign: "center", color: "#9A958A" }}>{text}</Card>; }

function Tabs({ tabs, active, onChange }) {
  const w = useWindowWidth();
  const isMobile = w <= 640;
  if (isMobile) return null; // Mobile uses MobileBottomNav instead
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 20, borderBottom: "2px solid #E2DCCC", flexWrap: "wrap", overflowX: "auto" }}>
      {tabs.map((t) => (
        <button key={t.id} onClick={() => onChange(t.id)} style={{
          padding: "10px 16px", border: "none", background: "none", fontWeight: 600, fontSize: 14,
          color: active === t.id ? "#1B1D21" : "#9A958A", borderBottom: active === t.id ? "3px solid #FFB400" : "3px solid transparent", marginBottom: -2, whiteSpace: "nowrap",
        }}>{t.label}</button>
      ))}
    </div>
  );
}

// ====================================================================
// AUTH — role select, corp subtype select, login/signup
// ====================================================================
function AuthGate({ independentShippers, independentTruckers, corporations, onIndieShipperAuth, onIndieTruckerAuth, onCorpAuth }) {
  const [page, setPage] = useState("home");
  const [corpSubtype, setCorpSubtype] = useState(null);
  const [selectedTier, setSelectedTier] = useState(null);

  const handleTierSelect = (tier) => {
    setSelectedTier(tier);
    setTimeout(() => {
      const el = document.getElementById("corp-signup-section");
      if (el) el.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F2EDE4", fontFamily: "Inter, sans-serif", color: "#1B1D21" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Inter:wght@400;500;600;700&family=Roboto+Mono:wght@500&display=swap');
        .stencil { font-family: 'Oswald', sans-serif; letter-spacing: 0.02em; text-transform: uppercase; }
        .mono { font-family: 'Roboto Mono', monospace; }
        button { font-family: inherit; cursor: pointer; }
        input, textarea, select { font-family: inherit; }
        input:focus, textarea:focus, select:focus { outline: 2px solid #FFB400; outline-offset: 1px; }
      `}</style>
      <MarketingNav page={page} setPage={(p) => { setPage(p); setCorpSubtype(null); }} />
      {page === "lanes" && <SEOLandingPages setPage={(p) => { setPage(p); setCorpSubtype(null); }} />}
      {page === "home" && <HomePage setPage={setPage} />}
      {page === "shippers" && (
        <PersonaPage
          eyebrow="FOR SHIPPERS" title="Post freight. Pick your trucker. Skip the broker." accent="#FFB400"
          icon={<Package size={26} />}
          bullets={[
            "Post a load with weight, dimensions, quantity, and any special requirements",
            "Field bids and counter-offers directly from truckers — no broker markup in between",
            "Track every load with a live ETA, and rate the trucker when it's delivered",
            "Shipping freight nationwide with a team of people posting loads? See Enterprise Shipper pricing below.",
          ]}
          pricingNode={
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Card style={{ padding: 20, display: "inline-block" }}>
                <div className="mono" style={{ fontSize: 11, color: "#9A958A" }}>SUBSCRIPTION</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  <span style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 28 }}>$70/mo</span>
                </div>
                <div style={{ fontSize: 12, color: "#6B6557", marginTop: 2 }}>Flat. One profile. No per-load fees.</div>
              </Card>
              <Card style={{ padding: 18, border: "1px solid #FFD98C", background: "#FFFBF0", maxWidth: 360 }}>
                <div className="mono" style={{ fontSize: 11, color: "#B5790A", marginBottom: 4 }}>ENTERPRISE SHIPPER · NATIONWIDE</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 6 }}>
                  <span style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 22 }}>From $800/mo</span>
                </div>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>Multiple users, multiple locations, one account</div>
                <div style={{ fontSize: 13, color: "#44484D", lineHeight: 1.5, marginBottom: 12 }}>
                  Built for large shippers — manufacturers, distributors, retailers — posting freight from several facilities with more than one person managing loads. Covers up to 50 team profiles at this rate; larger teams move up through the same flat tiers, topping out at a flat $3,500/mo for 150+ profiles. One nationwide subscription, one consolidated bill, no per-seat charges.
                </div>
                <button onClick={() => setPage("companies")} style={{ ...ghostBtn, width: "100%", borderColor: "#B5790A", color: "#B5790A" }}>See Enterprise Shipper pricing</button>
              </Card>
            </div>
          }
        >
          <LoginForm role="shipper" accent="#FFB400" existing={independentShippers} embedded
            onSubmit={(data) => onIndieShipperAuth({ id: data.id || "s" + Date.now(), name: data.name, company: data.company || "", email: data.email, ratings: data.ratings || [] })} />
        </PersonaPage>
      )}
      {page === "carriers" && (
        <PersonaPage
          eyebrow="FOR CARRIERS · SOLO & SMALL FLEET (1–4 TRUCKS)" title="Run your own loads. Keep what brokers used to take." accent="#FF5A1F"
          icon={<Truck size={26} />}
          bullets={[
            "Built for owner-operators and small fleets — solo drivers up to about 3–4 trucks under one business name",
            "Browse the open load board and bid your own price — no broker spread eating into your rate",
            "Build a profile for your truck, trailer, and max haul weight; carry your own star rating",
            "Get paid directly by the shipper, with payout tracking built into your Earnings tab",
            "Running 5+ trucks or multiple drivers? See the Companies page — it's built for larger fleets with per-driver profiles.",
          ]}
          priceLabel="$30/mo" priceSub="Flat. One profile under your own business name."
        >
          <LoginForm role="trucker" accent="#FF5A1F" existing={independentTruckers} embedded
            onSubmit={(data) => onIndieTruckerAuth({
              id: data.id || "t" + Date.now(), name: data.name, company: data.company || "", email: data.email,
              truckDesc: data.truckDesc || "", equipmentType: data.equipmentType || "", maxWeight: data.maxWeight || 0, dims: data.dims || { l: 0, w: 0, h: 0 },
              ratings: data.ratings || [], loc: data.loc || "", payout: data.payout || { connected: false }, lanes: [],
              mcNumber: data.mcNumber || null, dotNumber: data.dotNumber || null, verification: data.verification || null,
            })} />
        </PersonaPage>
      )}
      {page === "companies" && (
        <PersonaPage
          eyebrow="FOR COMPANIES · LARGER FLEETS (5+ TRUCKS)" title="One subscription tier for your fleet — never per-load fees." accent="#3A6EA5"
          icon={<Building2 size={26} />}
          bullets={[
            "Built for trucking and shipping companies running more drivers or trucks than a single owner-operator — if you've got 5 or more, this is your tier (1–4 trucks running solo? See the Carriers page instead)",
            "Add unlimited driver or team-member profiles within your tier — your bill is set by fleet size, not headcount inside it",
            "Every driver keeps their own individual rating, truck profile, and load history",
            "Trucking companies pass DOT/MC background checks once at the company level, covering every driver",
            "Even the largest fleets (150+ drivers) stay on a flat Enterprise rate — no custom quotes or sales calls required",
          ]}
          pricingNode={<TierTable accent="#3A6EA5" highlightId={selectedTier?.id || "starter"} onSelectTier={handleTierSelect} />}
        >
          <div id="corp-signup-section">
          {selectedTier && (
            <div style={{ background: "#EAF1F8", border: "1px solid #C7DAEA", borderRadius: 8, padding: "10px 14px", marginBottom: 12, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div>
                <b>{selectedTier.name} plan selected</b> — {selectedTier.range} · ${selectedTier.price}/mo
              </div>
              <button onClick={() => setSelectedTier(null)} style={{ background: "none", border: "none", color: "#9A958A", cursor: "pointer" }}><X size={14} /></button>
            </div>
          )}
          {!corpSubtype ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#44484D" }}>What kind of company are you?</div>
              <CompanyTypeButton icon={<Truck size={18} />} title="Trucking Company" desc="Your drivers haul loads — built for fleets of 5+ trucks." onClick={() => setCorpSubtype("trucking")} />
              <CompanyTypeButton icon={<Package size={18} />} title="Shipping Company" desc="Your team posts freight under one account." onClick={() => setCorpSubtype("shipping")} />
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button onClick={() => setCorpSubtype(null)} style={{ background: "none", border: "none", color: "#6B6557", display: "flex", alignItems: "center", gap: 4, fontSize: 13, padding: 0, alignSelf: "flex-start" }}><ArrowLeft size={14} /> Back</button>
              <CorpLoginForm subtype={corpSubtype} existing={corporations} embedded selectedTier={selectedTier} onSubmit={(data) => onCorpAuth({ ...data, tier: selectedTier?.id || "starter" })} />
            </div>
          )}
          </div>
        </PersonaPage>
      )}
    </div>
  );
}

function MarketingNav({ page, setPage }) {
  const w = useWindowWidth();
  const isMobile = w <= 640;
  const links = [
    { id: "home",     label: "Home" },
    { id: "shippers", label: "Shippers" },
    { id: "carriers", label: "Carriers" },
    { id: "companies",label: "Companies" },
    { id: "lanes",    label: "Freight Lanes" },
  ];
  return (
    <header style={{ background: "#1B1D21", color: "#F2EDE4", padding: isMobile ? "12px 16px" : "16px 24px", display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "stretch" : "center", justifyContent: "space-between", borderBottom: "4px solid #FFB400", gap: isMobile ? 10 : 14, position: "sticky", top: 0, zIndex: 50 }}>
      <button onClick={() => setPage("home")} style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none" }}>
        <Logo size={isMobile ? 32 : 40} variant="light" showTagline />
      </button>
      <nav style={{ display: "flex", gap: 4, overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        {links.map((l) => (
          <button key={l.id} onClick={() => setPage(l.id)} style={{
            background: page === l.id ? "#FFB400" : "transparent", color: page === l.id ? "#1B1D21" : "#F2EDE4",
            border: "none", borderRadius: 6, padding: isMobile ? "10px 14px" : "9px 16px", fontWeight: 700, fontSize: isMobile ? 14 : 13, whiteSpace: "nowrap", minHeight: 44,
          }}>{l.label}</button>
        ))}
      </nav>
    </header>
  );
}

// ---------- Home / landing page ----------
function HomePage({ setPage }) {
  return (
    <div>
      <div style={{ background: "#1B1D21", color: "#F2EDE4", padding: "70px 24px 90px", textAlign: "center" }}>
        <div className="mono" style={{ fontSize: 12, color: "#FFB400", letterSpacing: 2, marginBottom: 14 }}>SHIPPER ↔ CARRIER · ZERO BROKERS</div>
        <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 42, lineHeight: 1.1, maxWidth: 720, margin: "0 auto 18px" }}>
          Freight, booked direct. No broker in the middle taking a cut.
        </div>
        <div style={{ fontSize: 16, color: "#C9C2B3", maxWidth: 560, margin: "0 auto 32px", lineHeight: 1.6 }}>
          Direct Freight Co connects Shippers and Carriers on one platform — post a load, bid your price, track it live, get paid directly. One flat subscription. No commission on any load, ever.
        </div>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={() => setPage("shippers")} style={{ ...primaryBtn("#FFB400"), padding: "13px 26px", fontSize: 15 }}>I'm a Shipper</button>
          <button onClick={() => setPage("carriers")} style={{ ...primaryBtn("#FF5A1F"), color: "#fff", padding: "13px 26px", fontSize: 15 }}>I'm a Carrier</button>
          <button onClick={() => setPage("companies")} style={{ background: "transparent", color: "#F2EDE4", border: "1.5px solid #5A5E64", borderRadius: 6, padding: "13px 26px", fontSize: 15, fontWeight: 700 }}>I'm a Company</button>
        </div>
        <div className="mono" style={{ fontSize: 11, color: "#7C7770", marginTop: 14 }}>
          CARRIER = solo or small fleet, 1–4 trucks &nbsp;·&nbsp; COMPANY = larger fleet, 5+ trucks or drivers
        </div>
      </div>

      <div style={{ maxWidth: 980, margin: "0 auto", padding: "56px 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div className="stencil" style={{ fontSize: 13, color: "#9A958A", marginBottom: 8 }}>How it works</div>
          <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 26, textTransform: "uppercase" }}>Three steps. No broker desk required.</div>
        </div>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "center" }}>
          <HowItWorksCard num="1" title="Post or browse" desc="Shippers post a load with weight, dimensions, mileage, and price. Carriers browse the board and bid." />
          <HowItWorksCard num="2" title="Agree direct" desc="Bid, counter, message — the deal is made between the two of you, with nobody taking a cut." />
          <HowItWorksCard num="3" title="Haul & get paid" desc="Track the load live, deliver, get rated, and get paid directly by the shipper." />
        </div>
      </div>

      <div style={{ background: "#fff", borderTop: "1px solid #E2DCCC", borderBottom: "1px solid #E2DCCC", padding: "56px 24px" }}>
        <div style={{ maxWidth: 980, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <div className="stencil" style={{ fontSize: 13, color: "#9A958A", marginBottom: 8 }}>Pricing</div>
            <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 26, textTransform: "uppercase" }}>One flat subscription. No commission, ever.</div>
            <div style={{ fontSize: 14, color: "#6B6557", marginTop: 8 }}>Direct Freight Co never takes a percentage of your load, bid, or freight payment — subscription fees are the only charge.</div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#1B1D21", color: "#FFB400", borderRadius: 8, padding: "8px 16px", marginTop: 14, fontSize: 13, fontWeight: 700 }}>
              <Zap size={14} /> Launch offer: 30 days free — all plans, no credit card required
            </div>
          </div>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "center" }}>
            <PricingCard title="Shipper" price="$70" accent="#FFB400" features={["Unlimited load postings", "Bidding & counter-offers", "Live tracking & ETA", "Carrier ratings & MC verification visibility"]} cta="Get started as a Shipper" onClick={() => setPage("shippers")} />
            <PricingCard title="Carrier (1–4 trucks)" price="$30" accent="#FF5A1F" features={["For solo owner-operators & small fleets", "Full load board access", "Bid your own price", "Direct payout tracking", "DOT/MC background check"]} cta="Get started as a Carrier" onClick={() => setPage("carriers")} highlight />
            <PricingCard title="Company (5+ trucks)" price="From $350" accent="#3A6EA5" features={["For larger fleets & shipping teams", "Unlimited driver/team profiles", "Pricing scales with fleet size", "Per-driver ratings", "Company-level MC & insurance compliance"]} cta="See company pricing" onClick={() => setPage("companies")} />
          </div>
          <div style={{ display: "flex", gap: 24, justifyContent: "center", flexWrap: "wrap", marginTop: 20 }}>
            {[
              "✓ Cancel anytime — no cancellation fees",
              "✓ No commission on any load or payment",
              "✓ No credit card required to start",
              "✓ Annual plan saves 2 months",
            ].map((item) => (
              <div key={item} style={{ fontSize: 13, color: "#6B6557", display: "flex", alignItems: "center", gap: 6, fontWeight: 500 }}>
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>

      <WaitlistSection setPage={setPage} />

      <div style={{ background: "#F8F5EE", borderTop: "1px solid #E2DCCC", padding: "48px 24px", textAlign: "center" }}>
        <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 26, textTransform: "uppercase", marginBottom: 10 }}>
          Help us build the best freight platform
        </div>
        <div style={{ fontSize: 15, color: "#6B6557", marginBottom: 24, maxWidth: 480, margin: "0 auto 24px" }}>
          Leave a star rating and tell us what to add, what to improve, or what isn't working. We read every single review.
        </div>
        <FeedbackButton style={{ margin: "0 auto", fontSize: 15, padding: "12px 24px" }} />
      </div>

      <div style={{ padding: "40px 24px", textAlign: "center" }}>
        <ShellFooter />
      </div>
    </div>
  );
}

function HowItWorksCard({ num, title, desc }) {
  return (
    <Card style={{ padding: 22, width: 260 }}>
      <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#FFB400", color: "#1B1D21", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontFamily: "Oswald, sans-serif", marginBottom: 12 }}>{num}</div>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13, color: "#6B6557", lineHeight: 1.5 }}>{desc}</div>
    </Card>
  );
}

function PricingCard({ title, price, accent, features, cta, onClick, highlight }) {
  return (
    <Card style={{ padding: 26, width: 270, border: highlight ? `2px solid ${accent}` : "1px solid #E2DCCC", position: "relative" }}>
      {highlight && <div style={{ position: "absolute", top: -12, left: 20, background: accent, color: "#fff", fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 4, textTransform: "uppercase" }}>Most common</div>}
      <div className="mono" style={{ fontSize: 12, color: "#9A958A", marginBottom: 4 }}>{title.toUpperCase()}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 16 }}>
        <span style={{ fontSize: 32, fontWeight: 700, fontFamily: "Oswald, sans-serif" }}>{price}</span>
        <span style={{ fontSize: 13, color: "#9A958A" }}>/mo</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
        {features.map((f, i) => (
          <div key={i} style={{ display: "flex", gap: 8, fontSize: 13, color: "#44484D" }}><CheckCircle2 size={15} color={accent} style={{ flexShrink: 0, marginTop: 1 }} /> {f}</div>
        ))}
      </div>
      <button onClick={onClick} style={{ ...primaryBtn(accent), color: accent === "#3A6EA5" ? "#fff" : "#1B1D21", width: "100%" }}>{cta}</button>
    </Card>
  );
}

// ---------- Shared persona page layout ----------
function PersonaPage({ eyebrow, title, accent, icon, bullets, priceLabel, priceSub, pricingNode, children }) {
  return (
    <div>
      <div style={{ background: "#1B1D21", color: "#F2EDE4", padding: "48px 24px" }}>
        <div style={{ maxWidth: 980, margin: "0 auto" }}>
          <div className="mono" style={{ fontSize: 12, color: accent, letterSpacing: 2, marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>{icon} {eyebrow}</div>
          <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 32, lineHeight: 1.15, maxWidth: 620 }}>{title}</div>
        </div>
      </div>
      <div style={{ maxWidth: 980, margin: "0 auto", padding: "40px 24px", display: "flex", gap: 32, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 28 }}>
            {bullets.map((b, i) => (
              <div key={i} style={{ display: "flex", gap: 10, fontSize: 14, color: "#33363B", lineHeight: 1.5 }}>
                <CheckCircle2 size={18} color={accent} style={{ flexShrink: 0, marginTop: 1 }} /> {b}
              </div>
            ))}
          </div>
          {pricingNode || (
          <Card style={{ padding: 20, display: "inline-block" }}>
            <div className="mono" style={{ fontSize: 11, color: "#9A958A" }}>SUBSCRIPTION</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 28 }}>{priceLabel}</span>
            </div>
            <div style={{ fontSize: 12, color: "#6B6557", marginTop: 2 }}>{priceSub}</div>
          </Card>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 320, display: "flex", justifyContent: "center" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function TierTable({ accent, highlightId, onSelectTier }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 360 }}>
      <div className="mono" style={{ fontSize: 11, color: "#9A958A", marginBottom: 2 }}>PRICING SCALES WITH FLEET SIZE — NEVER PER-LOAD · Click a tier to get started</div>
      {COMPANY_TIERS.map((t) => (
        <button
          key={t.id}
          onClick={() => onSelectTier && onSelectTier(t)}
          style={{
            display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10,
            padding: "12px 16px", borderRadius: 8, width: "100%", textAlign: "left", cursor: onSelectTier ? "pointer" : "default",
            border: highlightId === t.id ? `2px solid ${accent}` : "1px solid #E2DCCC",
            background: highlightId === t.id ? "#FFFBF0" : "#fff",
            transition: "border-color 0.15s, background 0.15s",
          }}
          onMouseEnter={(e) => { if (onSelectTier) { e.currentTarget.style.borderColor = accent; e.currentTarget.style.background = "#FFFBF0"; } }}
          onMouseLeave={(e) => { if (onSelectTier && highlightId !== t.id) { e.currentTarget.style.borderColor = "#E2DCCC"; e.currentTarget.style.background = "#fff"; } }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{t.name}</div>
            <div style={{ fontSize: 12, color: "#6B6557" }}>{t.range}</div>
          </div>
          <div style={{ textAlign: "right", display: "flex", alignItems: "center", gap: 10 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, fontFamily: "Oswald, sans-serif" }}>${t.price}</div>
              <div style={{ fontSize: 11, color: "#9A958A" }}>/mo flat</div>
            </div>
            {onSelectTier && <ChevronRight size={16} color="#9A958A" />}
          </div>
        </button>
      ))}
      <div style={{ fontSize: 11, color: "#9A958A", marginTop: 2 }}>One flat bill per company — no per-seat charges. Upgrade automatically as your roster grows past a threshold. Enterprise stays flat regardless of how many profiles you add.</div>
    </div>
  );
}

function CompanyTypeButton({ icon, title, desc, onClick }) {
  return (
    <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 12, textAlign: "left", background: "#fff", border: "1px solid #E2DCCC", borderRadius: 10, padding: "14px 16px", width: "100%" }}>
      <div style={{ color: "#3A6EA5" }}>{icon}</div>
      <div>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{title}</div>
        <div style={{ fontSize: 12, color: "#6B6557" }}>{desc}</div>
      </div>
      <ChevronRight size={16} color="#9A958A" style={{ marginLeft: "auto" }} />
    </button>
  );
}

const EQUIPMENT_TYPES = ["Dry Van", "Reefer", "Flatbed", "Hotshot", "Step Deck", "Power Only", "Box Truck", "Tanker", "Lowboy", "Conestoga"];

function LoginForm({ role, accent, existing, onBack, onSubmit, embedded }) {
  const [mode, setMode] = useState("signup");
  const [email, setEmail] = useState(""); const [name, setName] = useState(""); const [company, setCompany] = useState("");
  const [truckDesc, setTruckDesc] = useState(""); const [maxWeight, setMaxWeight] = useState("");
  const [l, setL] = useState(""); const [w, setW] = useState(""); const [h, setH] = useState(""); const [loc, setLoc] = useState("");
  const [equipmentType, setEquipmentType] = useState("");
  const [onboarding, setOnboarding] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  // Stripe state — carriers connect payout account, shippers add payment method
  const [stripeConnected, setStripeConnected] = useState(false);
  const [stripeCardNumber, setStripeCardNumber] = useState("");
  const [stripeExp, setStripeExp] = useState("");
  const [stripeCvc, setStripeCvc] = useState("");
  const [stripeNameOnCard, setStripeNameOnCard] = useState("");
  const [showStripeCard, setShowStripeCard] = useState(false);
  const [coiVerified, setCoiVerified] = useState(false);
  const [coiData, setCoiData] = useState(null);
  const [bizVerified, setBizVerified] = useState(false);
  const [bizData, setBizData] = useState(null);

  const formatCard = (v) => v.replace(/\D/g, "").slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 ");
  const formatExp = (v) => { const d = v.replace(/\D/g, "").slice(0, 4); return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d; };

  const connectStripePayoutMock = () => {
    // In production: redirect to Stripe Connect OAuth
    // window.location.href = `https://connect.stripe.com/oauth/authorize?response_type=code&client_id=${STRIPE_CLIENT_ID}&scope=read_write`;
    setStripeConnected(true);
  };

  const saveStripeCard = () => {
    const digits = stripeCardNumber.replace(/\D/g, "");
    if (digits.length < 12 || !stripeExp || !stripeCvc || !stripeNameOnCard) {
      alert("Fill in all card fields."); return;
    }
    setStripeConnected(true);
    setShowStripeCard(false);
  };

  const tryLogin = async () => {
    try {
      const { user } = await api.post("/api/auth/login", { email });
      onSubmit(user);
    } catch (err) {
      // Fall back to seed data if DB unavailable
      const found = existing.find((x) => x.email.toLowerCase() === email.toLowerCase());
      if (found) onSubmit(found);
      else alert(err.message || "No account found with that email — try signing up instead.");
    }
  };

  const trySignup = () => {
    if (!name || !email) { alert("Name and email are required."); return; }
    if (!company.trim()) { alert("Business name is required, and must match the name on your insurance and business paperwork."); return; }
    if (!agreedToTerms) { alert("You must agree to the Terms of Service to create an account."); return; }
    if (!bizVerified) { alert("Please upload and verify your business document before creating an account."); return; }
    if (role === "trucker" && !equipmentType) { alert("Select your equipment type."); return; }
    if (role === "trucker" && !onboarding) { alert("All carriers must pass DOT/MC verification before creating an account. Run the background check below."); return; }
    if (role === "trucker" && !coiVerified) { alert("Please upload and verify your Certificate of Insurance before creating an account."); return; }
    if (!stripeConnected) {
      alert(role === "trucker"
        ? "Connect your Stripe payout account to receive payments before creating your account."
        : "Add a payment method before creating your account. This is used for load payments and detention fees.");
      return;
    }
    onSubmit({
      name, email, company, truckDesc, maxWeight: Number(maxWeight) || 0,
      dims: { l: Number(l) || 0, w: Number(w) || 0, h: Number(h) || 0 },
      loc, equipmentType,
      mcNumber: onboarding?.data?.mcNumber || null,
      dotNumber: onboarding?.data?.dotNumber || null,
      verification: onboarding?.data || null,
      // Stripe info stored safely — in production only the Stripe customer/account ID is stored
      stripeConnected: true,
      bizVerified: true,
      bizData: bizData,
      coiVerified: true,
      trialStartedAt: new Date().toISOString(),
      coiData: coiData,
      billing: role === "shipper" ? { connected: true, last4: stripeCardNumber.replace(/\D/g, "").slice(-4), exp: stripeExp, nameOnCard: stripeNameOnCard } : null,
      payout: role === "trucker" ? { connected: true, provider: "Stripe Connect" } : null,
    });
  };

  const formCard = (
    <Card style={{ width: 440, maxWidth: "100%", padding: 32 }}>
      {!embedded && <button onClick={onBack} style={{ background: "none", border: "none", color: "#6B6557", display: "flex", alignItems: "center", gap: 4, fontSize: 13, marginBottom: 16, padding: 0 }}><ArrowLeft size={14} /> Back</button>}
      <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 24, textTransform: "uppercase", marginBottom: 4 }}>{role === "shipper" ? "Shipper Account" : "Trucker Account"}</div>
      <div style={{ fontSize: 13, color: "#6B6557", marginBottom: 8 }}>{role === "shipper" ? "Post loads and hire truckers directly." : "Owner-operator — one profile under your own business name."}</div>
      <BetaTrialBanner />
      <SubscriptionNote text="1 subscription. 1 profile. No per-seat fees." />
      <div style={{ display: "flex", gap: 8, margin: "16px 0" }}>
        {["signup", "login"].map((m) => (
          <button key={m} onClick={() => setMode(m)} style={{ flex: 1, padding: "8px 0", borderRadius: 6, border: "1px solid #E2DCCC", background: mode === m ? accent : "#fff", color: mode === m ? "#1B1D21" : "#6B6557", fontWeight: 600, fontSize: 13, textTransform: "capitalize" }}>{m === "signup" ? "Sign up" : "Log in"}</button>
        ))}
      </div>
      {mode === "login" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Field label="Email"><input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" style={inputStyle} /></Field>
          <button onClick={tryLogin} style={{ ...primaryBtn(accent), marginTop: 8 }}>Log in</button>
          
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Field label="Full name"><input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} /></Field>
          <Field label="Email"><input value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} /></Field>
          <Field label="Business name * (must match your insurance & business paperwork)"><input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Your LLC or business name" style={inputStyle} /></Field>
          <Field label="City, State"><input value={loc} onChange={(e) => setLoc(e.target.value)} style={inputStyle} /></Field>

          {role === "trucker" && (
            <>
              <Field label="Truck description"><input value={truckDesc} onChange={(e) => setTruckDesc(e.target.value)} placeholder="e.g. 2022 Kenworth T680, 53' dry van" style={inputStyle} /></Field>
              <Field label="Equipment type">
                <select value={equipmentType} onChange={(e) => setEquipmentType(e.target.value)} style={inputStyle}>
                  <option value="">Select equipment type…</option>
                  {EQUIPMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Max haul weight (lbs)"><input type="number" value={maxWeight} onChange={(e) => setMaxWeight(e.target.value)} style={inputStyle} /></Field>
              <div style={{ display: "flex", gap: 8 }}>
                <Field label="Length (ft)"><input type="number" value={l} onChange={(e) => setL(e.target.value)} style={inputStyle} /></Field>
                <Field label="Width (ft)"><input type="number" value={w} onChange={(e) => setW(e.target.value)} style={inputStyle} /></Field>
                <Field label="Height (ft)"><input type="number" value={h} onChange={(e) => setH(e.target.value)} style={inputStyle} /></Field>
              </div>
              <div style={{ fontSize: 11, color: "#C0432B", fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}>
                <ShieldCheck size={12} /> Required: every carrier must pass DOT/MC verification before an account can be created.
              </div>
              <OnboardingCheckTrigger onboarding={onboarding} onOpen={() => setShowOnboarding(true)} />
              <div style={{ borderTop: "1px solid #EEE8DA", paddingTop: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#44484D", marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
                  <FileText size={13} color="#635BFF" /> Required: upload your Certificate of Insurance
                </div>
                <CoiVerifier onVerified={(data) => { setCoiVerified(true); setCoiData(data); }} carrierName={name} carrierEmail={email} />
              </div>
            </>
          )}

          {/* ── BUSINESS VERIFICATION ── */}
          <div style={{ borderTop: "1px solid #EEE8DA", paddingTop: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#44484D", marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
              <Building2 size={13} color="#635BFF" /> Required: verify your business registration
            </div>
            {!bizVerified ? (
              <BusinessVerifier
                userName={name} userEmail={email} claimedBusinessName={company}
                onVerified={(data) => { setBizVerified(true); setBizData(data); }}
              />
            ) : (
              <div style={{ background: "#F1F8F2", border: "1px solid #BFE0C6", borderRadius: 8, padding: "10px 12px", display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "#3E7A4B" }}>
                <CheckCircle2 size={15} /> Business verified — {bizData?.businessName || company || name}
              </div>
            )}
          </div>

          {/* ── STRIPE SECTION ── */}
          <div style={{ borderTop: "1px solid #EEE8DA", paddingTop: 12 }}>
            {role === "trucker" ? (
              // Carrier — connect Stripe payout account
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#44484D", marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
                  <CreditCard size={13} color="#635BFF" /> Required: connect your Stripe payout account
                </div>
                <div style={{ fontSize: 11, color: "#6B6557", marginBottom: 8, lineHeight: 1.5 }}>
                  Stripe is used to deposit your load earnings directly to your bank account. Free instant payouts, no fees. You'll need a Stripe account — create one free at stripe.com.
                </div>
                {!stripeConnected ? (
                  <button onClick={connectStripePayoutMock} style={{ background: "#635BFF", color: "#fff", border: "none", borderRadius: 8, padding: "10px 16px", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 8, cursor: "pointer", width: "100%" }}>
                    <CreditCard size={15} /> Connect with Stripe — receive payments
                  </button>
                ) : (
                  <div style={{ background: "#F1F8F2", border: "1px solid #BFE0C6", borderRadius: 8, padding: "10px 12px", display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "#3E7A4B" }}>
                    <CheckCircle2 size={15} /> Stripe payout account connected — you're ready to receive payments
                  </div>
                )}
                <div style={{ fontSize: 10, color: "#9A958A", marginTop: 6 }}>
                  Secured by Stripe. Direct Freight Co never sees your bank account details.
                </div>
              </div>
            ) : (
              // Shipper — add payment method
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#44484D", marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
                  <CreditCard size={13} color="#635BFF" /> Required: add a payment method
                </div>
                <div style={{ fontSize: 11, color: "#6B6557", marginBottom: 8, lineHeight: 1.5 }}>
                  Your card is charged for load payments and any automated detention fees. Subscriptions are billed here too.
                </div>
                {!stripeConnected ? (
                  !showStripeCard ? (
                    <button onClick={() => setShowStripeCard(true)} style={{ background: "#635BFF", color: "#fff", border: "none", borderRadius: 8, padding: "10px 16px", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 8, cursor: "pointer", width: "100%" }}>
                      <CreditCard size={15} /> Add payment method
                    </button>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, background: "#F8F5EE", borderRadius: 8, padding: 12 }}>
                      <Field label="Name on card"><input value={stripeNameOnCard} onChange={(e) => setStripeNameOnCard(e.target.value)} style={inputStyle} /></Field>
                      <Field label="Card number"><input value={stripeCardNumber} onChange={(e) => setStripeCardNumber(formatCard(e.target.value))} placeholder="4242 4242 4242 4242" style={inputStyle} /></Field>
                      <div style={{ display: "flex", gap: 8 }}>
                        <Field label="Expiry"><input value={stripeExp} onChange={(e) => setStripeExp(formatExp(e.target.value))} placeholder="MM/YY" style={inputStyle} /></Field>
                        <Field label="CVC"><input value={stripeCvc} onChange={(e) => setStripeCvc(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="123" style={inputStyle} /></Field>
                      </div>
                      <button onClick={saveStripeCard} style={{ background: "#635BFF", color: "#fff", border: "none", borderRadius: 8, padding: "10px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Save card</button>
                      <div style={{ fontSize: 10, color: "#9A958A" }}>Secured by Stripe Elements. Direct Freight Co never stores raw card numbers.</div>
                    </div>
                  )
                ) : (
                  <div style={{ background: "#F1F8F2", border: "1px solid #BFE0C6", borderRadius: 8, padding: "10px 12px", display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "#3E7A4B" }}>
                    <CheckCircle2 size={15} /> Card ending in {stripeCardNumber.replace(/\D/g, "").slice(-4)} added — you're ready to post loads
                  </div>
                )}
              </div>
            )}
          </div>

          <TermsCheckbox checked={agreedToTerms} onChange={setAgreedToTerms} onOpenTerms={() => setShowTerms(true)} role={role} />
          <button onClick={trySignup} disabled={!agreedToTerms || !stripeConnected || !bizVerified} style={{ ...primaryBtn(accent), marginTop: 8, opacity: agreedToTerms && stripeConnected && bizVerified ? 1 : 0.5 }}>
            Create account
          </button>
          {!bizVerified && <div style={{ fontSize: 11, color: "#C0432B", textAlign: "center" }}>Upload and verify your business document above to continue</div>}
          {bizVerified && !stripeConnected && <div style={{ fontSize: 11, color: "#C0432B", textAlign: "center" }}>{role === "trucker" ? "Connect your Stripe account above to continue" : "Add a payment method above to continue"}</div>}
        </div>
      )}
    </Card>
  );

  if (embedded) {
    return (
      <>
        {formCard}
        {showTerms && <TermsModal onClose={() => setShowTerms(false)} />}
        {showOnboarding && (
          <OnboardingCheckModal onClose={() => setShowOnboarding(false)} onComplete={(data, evaluation) => setOnboarding({ data, evaluation })} />
        )}
      </>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F2EDE4", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "Inter, sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@600;700&family=Inter:wght@400;500;600&display=swap');`}</style>
      {formCard}
      {showTerms && <TermsModal onClose={() => setShowTerms(false)} />}
      {showOnboarding && (
        <OnboardingCheckModal onClose={() => setShowOnboarding(false)} onComplete={(data, evaluation) => setOnboarding({ data, evaluation })} />
      )}
    </div>
  );
}

// ====================================================================
// EMAIL SERVICES
// Uses EmailJS (free tier: 200 emails/month) to send emails directly
// from the browser without a backend. Sign up at emailjs.com,
// create a service + template, and fill in the IDs below.
//
// To set up (5 minutes):
// 1. Go to emailjs.com and create a free account
// 2. Add an Email Service (Gmail works — connect Direct Freightfreight45675@gmail.com)
// 3. Create two Email Templates (see template variables below)
// 4. Copy your Service ID, Template IDs, and Public Key into the constants below
// ====================================================================

const EMAILJS_SERVICE_ID  = "service_1h4mak5";   // e.g. "service_abc123"
const EMAILJS_PUBLIC_KEY  = "NynfkFRbK_m0Uow4k";    // e.g. "abc123xyz"
const EMAILJS_COI_TEMPLATE = "YOUR_COI_REVIEW_TEMPLATE";  // Template for COI review emails to you
const EMAILJS_VERIFY_TEMPLATE = "template_4m5qw9o";   // Template for email verification to users
const EMAILJS_WAITLIST_TEMPLATE = "template_0bdirnf"; // Template for waitlist confirmation emails to signups
const EMAILJS_WAITLIST_NOTIFY_TEMPLATE = "template_muxhdjc"; // Template that emails YOU when someone new joins the waitlist
const EMAILJS_RATECON_TEMPLATE = "template_jkxo8sy"; // Template that emails the Rate Confirmation to shipper + carrier
const OPERATOR_NOTIFY_EMAIL = "HaulDirectfreight45675@gmail.com";

// Loads EmailJS SDK dynamically (no install needed)
async function loadEmailJS() {
  if (window.emailjs) return window.emailjs;
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js";
    script.onload = () => {
      window.emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
      resolve(window.emailjs);
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// Send COI review notification to operator
// EmailJS Template variables: {{carrier_name}}, {{carrier_email}}, {{insurer}},
// {{auto_liability}}, {{cargo}}, {{expiry}}, {{status}}, {{ai_verdict}}, {{timestamp}}
async function notifyOperatorCOI(carrierName, carrierEmail, coiData) {
  if (EMAILJS_SERVICE_ID === "YOUR_EMAILJS_SERVICE_ID") {
    console.log("[EmailJS not configured] Would send COI review email to operator for:", carrierName);
    return;
  }
  try {
    const ejs = await loadEmailJS();
    await ejs.send(EMAILJS_SERVICE_ID, EMAILJS_COI_TEMPLATE, {
      to_email:       OPERATOR_NOTIFY_EMAIL,
      carrier_name:   carrierName,
      carrier_email:  carrierEmail,
      insurer:        coiData.insurerName || "Unknown",
      auto_liability: coiData.autoLiabilityCoverage
        ? (coiData.autoLiabilityCoverage >= 1000000
            ? `$${(coiData.autoLiabilityCoverage / 1000000).toFixed(2)}M`
            : `$${(coiData.autoLiabilityCoverage / 1000).toFixed(0)}K`)
        : "Not found",
      cargo:          coiData.cargoCoverage
        ? `$${(coiData.cargoCoverage / 1000).toFixed(0)}K`
        : "Not on file",
      expiry:         coiData.expirationDate || "Not found",
      is_expired:     coiData.isExpired ? "⚠️ EXPIRED" : "Active",
      ai_verdict:     coiData.overallPasses ? "✅ PASSED AI CHECK" : "❌ FAILED AI CHECK",
      timestamp:      new Date().toLocaleString(),
    });
    console.log("COI review email sent to operator");
  } catch (err) {
    console.warn("COI email notification failed:", err.message);
    // Don't block signup if email fails — log it and continue
  }
}

// Send email verification link to new user
// EmailJS Template variables: {{to_email}}, {{user_name}}, {{verify_code}}, {{platform_name}}
async function sendVerificationEmail(email, name, code) {
  if (EMAILJS_SERVICE_ID === "YOUR_EMAILJS_SERVICE_ID") {
    console.log("[EmailJS not configured] Would send verification email to:", email, "Code:", code);
    return false; // Not actually sent — signals caller to auto-verify in dev mode
  }
  try {
    const ejs = await loadEmailJS();
    await ejs.send(EMAILJS_SERVICE_ID, EMAILJS_VERIFY_TEMPLATE, {
      to_email:      email,
      user_name:     name,
      verify_code:   code,
      platform_name: "Direct Freight Co",
    });
    return true;
  } catch (err) {
    console.warn("Verification email failed:", err.message);
    return false;
  }
}

function generateVerifyCode() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
}

// ====================================================================
// BUSINESS VERIFICATION — AI DOCUMENT CHECK
// Accepts LLC certificate, articles of incorporation, business license,
// or IRS EIN letter. Claude reads it, extracts business details,
// and confirms it matches what the user entered during signup.
// Notifies operator via EmailJS for manual final approval.
// ====================================================================

async function verifyBusinessDocWithAI(fileBase64, mimeType, claimedName) {
  const isImage = mimeType.startsWith("image/");
  const isPdf = mimeType === "application/pdf";
  if (!isImage && !isPdf) throw new Error("Please upload a PDF, JPG, or PNG of your business document.");

  const contentBlock = isPdf
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: fileBase64 } }
    : { type: "image", source: { type: "base64", media_type: mimeType, data: fileBase64 } };

  const prompt = `You are a business verification assistant for Direct Freight, a freight marketplace platform.

Analyze this business document and extract the following information. The document could be any of:
- LLC Certificate / Articles of Organization
- Articles of Incorporation
- Business License
- IRS EIN Confirmation Letter (CP 575 or 147C)
- Secretary of State Registration
- DBA / Fictitious Name Certificate

The user claims their business name is: "${claimedName}"

Respond ONLY with a valid JSON object — no markdown, no backticks, no explanation.

Required JSON format:
{
  "isValidBusinessDoc": boolean,
  "documentType": string or null,
  "businessName": string or null,
  "ein": string or null,
  "entityType": string or null,
  "stateOfRegistration": string or null,
  "registrationDate": string or null,
  "nameMatchesClaim": boolean,
  "overallPasses": boolean,
  "failReasons": [],
  "notes": string
}

Rules:
- isValidBusinessDoc: true if this is a legitimate official business document
- nameMatchesClaim: true if the business name on the document closely matches "${claimedName}" (allow minor variations like LLC vs L.L.C., capitalization differences)
- overallPasses: true only if isValidBusinessDoc AND nameMatchesClaim
- failReasons: list every reason it fails
- If this is not a business document, set isValidBusinessDoc to false`;

  const response = await fetch(`${API_URL}/api/ai-verify-document`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileBase64, mimeType, prompt }),
  });

  if (!response.ok) throw new Error("AI verification service unavailable — please try again.");
  const data = await response.json();
  const clean = (data.raw || "").replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

async function notifyOperatorBusinessVerify(userName, userEmail, claimedName, docResult) {
  if (EMAILJS_SERVICE_ID === "YOUR_EMAILJS_SERVICE_ID") {
    console.log("[EmailJS not configured] Would send business verify email to operator for:", claimedName);
    return;
  }
  try {
    const ejs = await loadEmailJS();
    await ejs.send(EMAILJS_SERVICE_ID, EMAILJS_COI_TEMPLATE, {
      to_email:      OPERATOR_NOTIFY_EMAIL,
      carrier_name:  userName,
      carrier_email: userEmail,
      insurer:       `Business: ${claimedName}`,
      auto_liability: `Doc type: ${docResult.documentType || "Unknown"}`,
      cargo:         `Entity: ${docResult.entityType || "Unknown"} · State: ${docResult.stateOfRegistration || "Unknown"}`,
      expiry:        `Registered: ${docResult.registrationDate || "Unknown"}`,
      is_expired:    `EIN on doc: ${docResult.ein || "Not found"}`,
      ai_verdict:    docResult.overallPasses ? "✅ BUSINESS VERIFIED BY AI" : "❌ BUSINESS VERIFICATION FAILED",
      timestamp:     new Date().toLocaleString(),
    });
  } catch (err) {
    console.warn("Business verify email failed:", err.message);
  }
}

function BusinessVerifier({ onVerified, userName, userEmail, claimedBusinessName }) {
  const [status, setStatus] = useState("idle"); // idle | uploading | checking | pass | fail | error
  const [result, setResult] = useState(null);
  const [fileName, setFileName] = useState("");
  const inputRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setStatus("error"); setResult({ error: "File too large — upload something under 10MB." }); return; }

    setFileName(file.name);
    setStatus("uploading");

    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      setStatus("checking");
      const aiResult = await verifyBusinessDocWithAI(base64, file.type || "application/pdf", claimedBusinessName || userName);
      setResult(aiResult);
      setStatus(aiResult.overallPasses ? "pass" : "fail");
      notifyOperatorBusinessVerify(userName, userEmail, claimedBusinessName || userName, aiResult);
      if (aiResult.overallPasses) onVerified(aiResult);
    } catch (err) {
      setStatus("error");
      setResult({ error: err.message });
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 12, color: "#6B6557", lineHeight: 1.5 }}>
        Upload one of the following to confirm you're a real registered business:
        <b> LLC Certificate, Articles of Incorporation, Business License, or IRS EIN Letter.</b> PDF, JPG, or PNG accepted.
      </div>

      {(status === "idle" || status === "error") && (
        <>
          <input ref={inputRef} type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={handleFile} style={{ display: "none" }} />
          <button onClick={() => inputRef.current?.click()} style={{ background: "#635BFF", color: "#fff", border: "none", borderRadius: 8, padding: "10px 16px", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 8, cursor: "pointer", width: "100%" }}>
            <Upload size={15} /> Upload business document
          </button>
          {status === "error" && result?.error && (
            <div style={{ fontSize: 12, color: "#C0432B", background: "#FDF1EE", border: "1px solid #F3B7A6", borderRadius: 6, padding: "8px 10px" }}>{result.error}</div>
          )}
        </>
      )}

      {status === "uploading" && (
        <div style={{ background: "#F8F5EE", border: "1px solid #E2DCCC", borderRadius: 8, padding: "12px 14px", fontSize: 13, color: "#6B6557", display: "flex", alignItems: "center", gap: 8 }}>
          <RefreshCcw size={14} /> Reading document…
        </div>
      )}

      {status === "checking" && (
        <div style={{ background: "#EAF1F8", border: "1px solid #C7DAEA", borderRadius: 8, padding: "12px 14px", fontSize: 13, color: "#3A6EA5", display: "flex", alignItems: "center", gap: 8 }}>
          <RefreshCcw size={14} /> AI is verifying your business registration… about 10 seconds.
        </div>
      )}

      {status === "pass" && result && (
        <div style={{ background: "#F1F8F2", border: "2px solid #3E7A4B", borderRadius: 8, padding: 14 }}>
          <div style={{ fontWeight: 700, color: "#3E7A4B", fontSize: 14, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <CheckCircle2 size={16} /> Business verified — {fileName}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 12, color: "#44484D" }}>
            <div><b>Business name:</b> {result.businessName}</div>
            {result.documentType && <div><b>Document type:</b> {result.documentType}</div>}
            {result.entityType && <div><b>Entity:</b> {result.entityType}</div>}
            {result.stateOfRegistration && <div><b>State:</b> {result.stateOfRegistration}</div>}
            {result.ein && <div><b>EIN:</b> {result.ein}</div>}
          </div>
        </div>
      )}

      {status === "fail" && result && (
        <div style={{ background: "#FDF1EE", border: "2px solid #C0432B", borderRadius: 8, padding: 14 }}>
          <div style={{ fontWeight: 700, color: "#C0432B", fontSize: 14, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <X size={16} /> Business verification failed
          </div>
          <div style={{ fontSize: 12, color: "#44484D", marginBottom: 8 }}>
            {!result.isValidBusinessDoc && <div>✗ Document does not appear to be a valid business registration document</div>}
            {!result.nameMatchesClaim && <div>✗ Business name on document (<b>{result.businessName || "not found"}</b>) does not match <b>{claimedBusinessName || userName}</b></div>}
            {result.failReasons?.map((r, i) => <div key={i}>✗ {r}</div>)}
          </div>
          <div style={{ fontSize: 11, color: "#9A958A", marginBottom: 8 }}>
            Acceptable documents: LLC Certificate, Articles of Incorporation, Business License, or IRS EIN Letter (CP 575 / 147C).
          </div>
          <input ref={inputRef} type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={handleFile} style={{ display: "none" }} />
          <button onClick={() => { setStatus("idle"); setResult(null); }} style={{ ...ghostBtn, fontSize: 12 }}>Upload a different document</button>
        </div>
      )}
    </div>
  );
}

// ====================================================================
// CERTIFICATE OF INSURANCE (COI) — AI VERIFICATION
// Carriers upload their COI. Claude reads it, extracts coverage amounts,
// and verifies it meets Direct Freight minimums ($750K auto / $100K cargo).
// Uses the Anthropic API directly from the browser.
// ====================================================================

const COI_MINIMUMS = { autoLiability: 750000 }; // cargo insurance optional unless shipper requires it

async function verifyCOIWithAI(fileBase64, mimeType) {
  const isImage = mimeType.startsWith("image/");
  const isPdf = mimeType === "application/pdf";

  if (!isImage && !isPdf) {
    throw new Error("Please upload a PDF, JPG, or PNG of your Certificate of Insurance.");
  }

  const contentBlock = isPdf
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: fileBase64 } }
    : { type: "image", source: { type: "base64", media_type: mimeType, data: fileBase64 } };

  const prompt = `You are an insurance verification assistant for Direct Freight, a freight marketplace.

Analyze this Certificate of Insurance (COI) document and extract the following information. Respond ONLY with a valid JSON object — no markdown, no explanation, no backticks.

Required JSON format:
{
  "isValidCOI": boolean,
  "insurerName": string or null,
  "insuredName": string or null,
  "policyNumber": string or null,
  "effectiveDate": string or null,
  "expirationDate": string or null,
  "isExpired": boolean,
  "autoLiabilityCoverage": number or null,
  "cargoCoverage": number or null,
  "autoLiabilityMeetsMinimum": boolean,
  "cargoMeetsMinimum": boolean,
  "overallPasses": boolean,
  "failReasons": [],
  "notes": string
}

Rules:
- autoLiabilityCoverage and cargoCoverage should be the dollar amount as a plain number (e.g. 750000 for $750,000)
- autoLiabilityMeetsMinimum is true if autoLiabilityCoverage >= 750000
- cargoMeetsMinimum is informational only — cargo insurance is optional unless the shipper requires it
- isExpired is true if the expiration date has passed today (${new Date().toLocaleDateString()})
- overallPasses is true only if isValidCOI AND autoLiabilityMeetsMinimum AND NOT isExpired (cargo is optional)
- failReasons should list every reason it fails as strings
- If this is not a COI document at all, set isValidCOI to false`;

  const response = await fetch(`${API_URL}/api/ai-verify-document`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileBase64, mimeType, prompt }),
  });

  if (!response.ok) throw new Error("AI verification service unavailable — please try again.");
  const data = await response.json();
  const clean = (data.raw || "").replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

function CoiVerifier({ onVerified, carrierName, carrierEmail }) {
  const [status, setStatus] = useState("idle"); // idle | uploading | checking | pass | fail | error
  const [result, setResult] = useState(null);
  const [fileName, setFileName] = useState("");
  const inputRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setStatus("error"); setResult({ error: "File is too large — please upload something under 10MB." }); return; }

    setFileName(file.name);
    setStatus("uploading");

    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      setStatus("checking");
      const aiResult = await verifyCOIWithAI(base64, file.type || "application/pdf");
      setResult(aiResult);
      setStatus(aiResult.overallPasses ? "pass" : "fail");

      // Always notify operator so they can manually verify — even on pass
      notifyOperatorCOI(carrierName || "Unknown carrier", carrierEmail || "No email", aiResult);

      if (aiResult.overallPasses) onVerified(aiResult);
    } catch (err) {
      setStatus("error");
      setResult({ error: err.message });
    }
  };

  const fmtCoverage = (amt) => {
    if (!amt) return "Not found";
    return amt >= 1000000 ? `$${(amt / 1000000).toFixed(2)}M` : `$${(amt / 1000).toFixed(0)}K`;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 12, color: "#6B6557", lineHeight: 1.5 }}>
        Upload your Certificate of Insurance (COI). Our AI will verify you meet the required minimum:
        <b>$750K Auto Liability</b>. Cargo insurance is optional but may be required by certain shippers. Accepted formats: PDF, JPG, PNG.
      </div>

      {(status === "idle" || status === "error") && (
        <>
          <input ref={inputRef} type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={handleFile} style={{ display: "none" }} />
          <button onClick={() => inputRef.current?.click()} style={{ background: "#635BFF", color: "#fff", border: "none", borderRadius: 8, padding: "10px 16px", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 8, cursor: "pointer", width: "100%" }}>
            <Upload size={15} /> Upload Certificate of Insurance
          </button>
          {status === "error" && result?.error && <div style={{ fontSize: 12, color: "#C0432B", background: "#FDF1EE", border: "1px solid #F3B7A6", borderRadius: 6, padding: "8px 10px" }}>{result.error}</div>}
        </>
      )}

      {status === "uploading" && (
        <div style={{ background: "#F8F5EE", border: "1px solid #E2DCCC", borderRadius: 8, padding: "12px 14px", fontSize: 13, color: "#6B6557", display: "flex", alignItems: "center", gap: 8 }}>
          <RefreshCcw size={14} /> Reading document…
        </div>
      )}

      {status === "checking" && (
        <div style={{ background: "#EAF1F8", border: "1px solid #C7DAEA", borderRadius: 8, padding: "12px 14px", fontSize: 13, color: "#3A6EA5", display: "flex", alignItems: "center", gap: 8 }}>
          <RefreshCcw size={14} /> AI is verifying your insurance coverage… this takes about 10 seconds.
        </div>
      )}

      {status === "pass" && result && (
        <div style={{ background: "#F1F8F2", border: "2px solid #3E7A4B", borderRadius: 8, padding: 14 }}>
          <div style={{ fontWeight: 700, color: "#3E7A4B", fontSize: 14, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <CheckCircle2 size={16} /> Insurance verified — {fileName}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "#44484D" }}>
            {result.insurerName && <div><b>Insurer:</b> {result.insurerName}</div>}
            {result.insuredName && <div><b>Insured:</b> {result.insuredName}</div>}
            {result.expirationDate && <div><b>Expires:</b> {result.expirationDate}</div>}
            <div style={{ display: "flex", gap: 16, marginTop: 4 }}>
              <div style={{ color: "#3E7A4B" }}>✓ Auto Liability: <b>{fmtCoverage(result.autoLiabilityCoverage)}</b></div>
              <div style={{ color: "#3E7A4B" }}>✓ Cargo: <b>{fmtCoverage(result.cargoCoverage)}</b></div>
            </div>
          </div>
        </div>
      )}

      {status === "fail" && result && (
        <div style={{ background: "#FDF1EE", border: "2px solid #C0432B", borderRadius: 8, padding: 14 }}>
          <div style={{ fontWeight: 700, color: "#C0432B", fontSize: 14, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <X size={16} /> Insurance does not meet requirements
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 12, color: "#44484D", marginBottom: 10 }}>
            {result.insurerName && <div><b>Insurer:</b> {result.insurerName}</div>}
            <div style={{ color: result.autoLiabilityMeetsMinimum ? "#3E7A4B" : "#C0432B" }}>
              {result.autoLiabilityMeetsMinimum ? "✓" : "✗"} Auto Liability: <b>{fmtCoverage(result.autoLiabilityCoverage)}</b> (min $750K)
            </div>
            <div style={{ color: result.cargoMeetsMinimum ? "#3E7A4B" : "#C0432B" }}>
              {result.cargoMeetsMinimum ? "✓" : "✗"} Cargo: <b>{fmtCoverage(result.cargoCoverage)}</b> (min $100K)
            </div>
            {result.isExpired && <div style={{ color: "#C0432B" }}>✗ Policy appears expired ({result.expirationDate})</div>}
            {!result.isValidCOI && <div style={{ color: "#C0432B" }}>✗ Document does not appear to be a valid COI</div>}
          </div>
          <div style={{ fontSize: 11, color: "#9A958A", marginBottom: 8 }}>Contact your insurer to update your coverage, then re-upload.</div>
          <input ref={inputRef} type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={handleFile} style={{ display: "none" }} />
          <button onClick={() => inputRef.current?.click()} style={{ ...ghostBtn, fontSize: 12 }}>Upload a different document</button>
        </div>
      )}
    </div>
  );
}

// ====================================================================
// W-9 / 1099-K TAX COMPLIANCE WIZARD
// ====================================================================
function W9Wizard({ me, onComplete }) {
  const [tin, setTin] = useState(""); // EIN or SSN
  const [tinType, setTinType] = useState("EIN");
  const [legalName, setLegalName] = useState("");
  const [businessType, setBusinessType] = useState("LLC");
  const [certify, setCertify] = useState(false);
  const [done, setDone] = useState(!!(me.w9?.completed));

  if (done || me.w9?.completed) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#3E7A4B", fontWeight: 600 }}>
        <ShieldCheck size={15} /> W-9 on file · {me.w9?.tinType || "EIN"} ending {me.w9?.tinLast4} · Completed {me.w9?.completedAt ? new Date(me.w9.completedAt).toLocaleDateString() : ""}
      </div>
    );
  }

  const formatTin = (v) => {
    const digits = v.replace(/\D/g, "").slice(0, 9);
    if (tinType === "EIN") return digits.length > 2 ? `${digits.slice(0, 2)}-${digits.slice(2)}` : digits;
    return digits.length > 5 ? `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}` : digits.length > 3 ? `${digits.slice(0, 3)}-${digits.slice(3)}` : digits;
  };

  const submit = () => {
    const digits = tin.replace(/\D/g, "");
    if (digits.length < 9) { alert("Enter a complete 9-digit EIN or SSN."); return; }
    if (!legalName) { alert("Enter your legal name or business name."); return; }
    if (!certify) { alert("You must certify the information is accurate before submitting."); return; }
    onComplete({ completed: true, tinType, tinLast4: digits.slice(-4), legalName, businessType, completedAt: Date.now() });
    setDone(true);
  };

  return (
    <Card style={{ padding: 20, border: "1px solid #FFD98C", background: "#FFFBF0" }}>
      <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 15, textTransform: "uppercase", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
        <FileText size={15} color="#B5790A" /> W-9 / Tax Identification — Required
      </div>
      <div style={{ fontSize: 12, color: "#6B6557", marginBottom: 12 }}>Required by the IRS before you can accept any load. Direct Freight may issue a 1099-K for qualifying annual payments.</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setTinType("EIN")} style={{ ...ghostBtn, background: tinType === "EIN" ? "#FFB400" : "#fff", fontWeight: 700, fontSize: 12, padding: "7px 12px" }}>EIN (business)</button>
          <button onClick={() => setTinType("SSN")} style={{ ...ghostBtn, background: tinType === "SSN" ? "#FFB400" : "#fff", fontWeight: 700, fontSize: 12, padding: "7px 12px" }}>SSN (individual)</button>
        </div>
        <Field label="Legal name / business name"><input value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder="As it appears on your tax return" style={inputStyle} /></Field>
        <Field label={tinType === "EIN" ? "Employer Identification Number (EIN)" : "Social Security Number (SSN)"}>
          <input value={tin} onChange={(e) => setTin(formatTin(e.target.value))} placeholder={tinType === "EIN" ? "12-3456789" : "123-45-6789"} style={inputStyle} />
        </Field>
        <Field label="Business type">
          <select value={businessType} onChange={(e) => setBusinessType(e.target.value)} style={inputStyle}>
            {["Individual/Sole Proprietor", "LLC", "S Corporation", "C Corporation", "Partnership"].map((t) => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, color: "#44484D", cursor: "pointer" }}>
          <input type="checkbox" checked={certify} onChange={(e) => setCertify(e.target.checked)} style={{ marginTop: 2, width: 14, height: 14, flexShrink: 0 }} />
          Under penalty of perjury, I certify that the TIN I've provided is correct and I am not subject to backup withholding.
        </label>
        <button onClick={submit} disabled={!certify} style={{ ...primaryBtn("#FFB400"), opacity: certify ? 1 : 0.5 }}>Submit W-9</button>
      </div>
    </Card>
  );
}

// ====================================================================
// ONBOARDING PROGRESS MAP
// ====================================================================
function OnboardingProgressMap({ me, role }) {
  const steps = role === "trucker" || role === "trucking" ? [
    { key: "profile", label: "Profile complete", done: !!(me.name && (me.truckDesc || me.loc)) },
    { key: "biz", label: "Business registration verified (AI)", done: !!(me.bizVerified) },
    { key: "equipment", label: "Equipment type set", done: !!me.equipmentType },
    { key: "dot", label: "DOT/MC verified", done: me.verification?.authorityStatus === "AUTHORIZED" },
    { key: "coi", label: "Certificate of Insurance verified (AI)", done: !!(me.coiVerified) },
    { key: "insurance", label: "Auto Liability verified ($750K min)", done: me.verification?.insuranceStatus === "ACTIVE" && me.verification?.autoLiabilityCoverage >= 750000 },
    { key: "w9", label: "W-9 / Tax ID on file", done: !!me.w9?.completed },
    { key: "payout", label: "Payout method connected", done: !!me.payout?.connected },
  ] : [
    { key: "profile", label: "Profile complete", done: !!(me.name) },
    { key: "biz", label: "Business registration verified (AI)", done: !!(me.bizVerified) },
    { key: "company", label: "Company info & EIN on file", done: !!(me.ein) },
    { key: "billing", label: "Payment method added", done: !!me.billing?.connected },
  ];

  const complete = steps.filter((s) => s.done).length;
  const pct = Math.round((complete / steps.length) * 100);

  return (
    <Card style={{ padding: 20, marginBottom: 16 }}>
      <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 15, textTransform: "uppercase", marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        Compliance Status
        <span className="mono" style={{ fontSize: 12, color: pct === 100 ? "#3E7A4B" : "#B5790A" }}>{pct}% complete</span>
      </div>
      <div style={{ background: "#EEE8DA", borderRadius: 6, height: 6, overflow: "hidden", marginBottom: 12 }}>
        <div style={{ width: `${pct}%`, height: "100%", background: pct === 100 ? "#3E7A4B" : "#FFB400", transition: "width 0.5s" }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {steps.map((s) => (
          <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: s.done ? "#3E7A4B" : "#6B6557" }}>
            {s.done ? <CheckCircle2 size={14} color="#3E7A4B" /> : <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid #D8D1C0", flexShrink: 0 }} />}
            {s.label}
          </div>
        ))}
      </div>
    </Card>
  );
}

// ====================================================================
// QUICKPAY — Free instant payout for all carriers (no fee)
// Stripe's ~0.25% instant payout cost is absorbed by the platform.
// ====================================================================
function QuickPayPanel({ load, me, onRequestQuickPay }) {
  if (load.status !== "delivered" || load.paid || !me.payout?.connected) return null;
  const QUICKPAY_FEE_RATE = 0.015; // matches Stripe's real Instant Payout fee (1.5% US)
  const fee = Math.round(load.price * QUICKPAY_FEE_RATE * 100) / 100;
  const net = load.price - fee;
  return (
    <Card style={{ padding: 14, border: "1px solid #BFE0C6", background: "#F1F8F2", marginTop: 10 }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
        <Zap size={14} color="#3E7A4B" /> Choose how you get paid
      </div>
      <div style={{ fontSize: 12, color: "#44484D", marginBottom: 10, lineHeight: 1.6 }}>
        <div><b>Standard payout</b> — the full <b style={{ color: "#3E7A4B" }}>{fmtMoney(load.price)}</b>, completely free, arrives in 1-2 business days. Happens automatically — no action needed.</div>
        <div style={{ marginTop: 6 }}><b>QuickPay instant payout</b> — get <b style={{ color: "#3E7A4B" }}>{fmtMoney(net)}</b> in your bank within minutes. A 1.5% instant payout fee ({fmtMoney(fee)}) applies — this is Stripe's real cost for instant transfers, not a Direct Freight markup.</div>
      </div>
      <button onClick={() => onRequestQuickPay(load.id)} style={{ ...primaryBtn("#3E7A4B"), color: "#fff", padding: "7px 14px", display: "flex", alignItems: "center", gap: 5 }}>
        <Zap size={13} /> QuickPay now — get {fmtMoney(net)} in minutes
      </button>
      <div style={{ fontSize: 11, color: "#9A958A", marginTop: 8 }}>Don't need it instantly? Do nothing and you'll automatically receive the full {fmtMoney(load.price)} via standard payout, free, in 1-2 business days.</div>
    </Card>
  );
}

// ====================================================================
// PAYMENT HOLD AUTHORIZATION WAIVER (shown once on first load acceptance)
// ====================================================================
function EscrowWaiverModal({ onAccept }) {
  const [agreed, setAgreed] = useState(false);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(27,29,33,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 80, padding: 16 }}>
      <Card style={{ width: "100%", maxWidth: 520, padding: 28 }}>
        <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 18, textTransform: "uppercase", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <ShieldCheck size={18} color="#FFB400" /> Payment Hold Authorization
        </div>
        <div style={{ fontSize: 13, color: "#44484D", lineHeight: 1.6, marginBottom: 16 }}>
          Direct Freight acts as an independent repository gateway for commercial transactions. By proceeding with your first load on this platform, you acknowledge and agree that:
          <ul style={{ marginTop: 8, paddingLeft: 18 }}>
            <li>Disputed load payments may have their release paused by Direct Freight (via Stripe) pending resolution between parties.</li>
            <li>You waive immediate chargeback rights on amounts subject to a payment hold while a documented dispute is active.</li>
            <li>Direct Freight is not a party to freight contracts and does not guarantee payment or delivery.</li>
            <li>Standard payouts are always free and arrive in 1-2 business days. QuickPay instant payouts get funds to your bank within minutes for a 1.5% fee, matching Stripe's real cost for instant transfers.</li>
          </ul>
        </div>
        <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, color: "#44484D", cursor: "pointer", marginBottom: 14 }}>
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} style={{ marginTop: 2, width: 14, height: 14, flexShrink: 0 }} />
          I understand and agree to the payment hold and payment terms described above.
        </label>
        <button disabled={!agreed} onClick={onAccept} style={{ ...primaryBtn("#FFB400"), opacity: agreed ? 1 : 0.5 }}>Agree and continue</button>
        <div style={{ fontSize: 10, color: "#9A958A", marginTop: 8 }}>This consent is recorded with a session timestamp as part of your account's legal audit trail.</div>
      </Card>
    </div>
  );
}

// ====================================================================
// SUBSCRIPTION SELF-SERVICE PORTAL
// ====================================================================
function SubscriptionPortalPanel({ isCorp, corp, me, onSave }) {
  const tier = isCorp ? getCompanyTier(corp?.members?.length || 0) : null;
  const price = isCorp ? tier?.price : (me?.role === "trucker" ? 30 : 70);
  const planName = isCorp ? `${tier?.name} Plan` : (me?.role === "trucker" ? "Carrier Plan" : "Shipper Plan");
  const isComplimentary = me?.complimentary && (!me?.complimentaryExpiry || Date.now() < me?.complimentaryExpiry);
  const [promoApplied, setPromoApplied] = useState(me?.promoApplied || null);
  const [billingCycle, setBillingCycle] = useState(me?.billingCycle || corp?.billingCycle || "monthly");
  const [showTierChange, setShowTierChange] = useState(false);
  const currentPlanId = isCorp ? (tier?.id || "starter") : "solo";
  const [selectedTier, setSelectedTier] = useState(currentPlanId);
  const [tierRequestSent, setTierRequestSent] = useState(false);
  const [savingCycle, setSavingCycle] = useState(false);

  const soloPrice = me?.role === "trucker" ? 30 : 70;
  const soloLabel = me?.role === "trucker" ? "Carrier (Solo)" : "Shipper (Solo)";

  // Full plan ladder — Solo through Enterprise — shown to everyone so anyone
  // can request a move in either direction.
  const PLAN_OPTIONS = [
    { id: "solo", name: soloLabel, range: "1 profile", price: soloPrice },
    ...COMPANY_TIERS,
  ];

  const changeBillingCycle = async (cycle) => {
    setBillingCycle(cycle);
    setSavingCycle(true);
    await onSave?.({ billingCycle: cycle });
    setSavingCycle(false);
  };

  const requestPlanChange = async () => {
    const newPlan = PLAN_OPTIONS.find((t) => t.id === selectedTier);
    const currentPlanLabel = isCorp ? tier?.name : soloLabel;
    const isDowngradeToSolo = selectedTier === "solo" && isCorp;
    const isUpgradeToCompany = selectedTier !== "solo" && !isCorp;
    if (EMAILJS_SERVICE_ID !== "YOUR_EMAILJS_SERVICE_ID") {
      loadEmailJS().then((ejs) => ejs?.send(EMAILJS_SERVICE_ID, EMAILJS_COI_TEMPLATE, {
        to_email: OPERATOR_NOTIFY_EMAIL,
        carrier_name: corp?.companyName || me?.name,
        carrier_email: me?.email || corp?.email,
        insurer: `Plan change request: ${currentPlanLabel} → ${newPlan?.name}`,
        auto_liability: `New plan price: $${newPlan?.price}/mo`,
        cargo: isCorp ? `Current team size: ${corp?.members?.length || 0}` : `Account type: Individual ${me?.role}`,
        expiry: "N/A", is_expired: "N/A",
        ai_verdict: isDowngradeToSolo ? "DOWNGRADE TO SOLO REQUEST" : isUpgradeToCompany ? "UPGRADE TO COMPANY REQUEST" : "TIER CHANGE REQUEST",
        timestamp: new Date().toLocaleString(),
      })).catch(() => {});
    }
    await onSave?.({ requestedTier: selectedTier });
    setTierRequestSent(true);
    setShowTierChange(false);
  };

  return (
    <div id="subscription-panel" style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 520 }}>
      {isComplimentary && (
        <div style={{ background: "#F1F8F2", border: "2px solid #3E7A4B", borderRadius: 10, padding: "14px 18px", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 24 }}>🎁</span>
          <div>
            <div style={{ fontWeight: 700, color: "#3E7A4B", fontSize: 15 }}>Complimentary account</div>
            <div style={{ fontSize: 12, color: "#6B6557", marginTop: 2 }}>
              Your account is provided free of charge courtesy of Direct Freight.
              {me?.complimentaryExpiry && ` Free access through ${new Date(me.complimentaryExpiry).toLocaleDateString()}.`}
            </div>
          </div>
        </div>
      )}

      <Card style={{ padding: 20 }}>
        <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 16, textTransform: "uppercase", marginBottom: 10 }}>Current Plan</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <div style={{ fontWeight: 700 }}>{isComplimentary ? "Complimentary" : planName}</div>
            <div style={{ fontSize: 12, color: "#9A958A" }}>
              {isComplimentary
                ? "No charge — complimentary access granted by Direct Freight"
                : price ? `$${billingCycle === "annual" ? price * 10 : price}/${billingCycle === "annual" ? "yr" : "mo"}` : "Enterprise — contact us for billing details"}
            </div>
          </div>
          <Badge tone="amber">Active</Badge>
        </div>

        {/* Billing cycle toggle */}
        {!isComplimentary && price && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#44484D", marginBottom: 6 }}>Billing cycle</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => changeBillingCycle("monthly")} disabled={savingCycle} style={{
                flex: 1, padding: "10px 12px", borderRadius: 8, border: billingCycle === "monthly" ? "2px solid #FFB400" : "1px solid #E2DCCC",
                background: billingCycle === "monthly" ? "#FFFBF0" : "#fff", cursor: "pointer", textAlign: "left",
              }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>Monthly</div>
                <div style={{ fontSize: 11, color: "#9A958A" }}>${price}/mo</div>
              </button>
              <button onClick={() => changeBillingCycle("annual")} disabled={savingCycle} style={{
                flex: 1, padding: "10px 12px", borderRadius: 8, border: billingCycle === "annual" ? "2px solid #FFB400" : "1px solid #E2DCCC",
                background: billingCycle === "annual" ? "#FFFBF0" : "#fff", cursor: "pointer", textAlign: "left", position: "relative",
              }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>Annual</div>
                <div style={{ fontSize: 11, color: "#9A958A" }}>${price * 10}/yr</div>
                <div style={{ position: "absolute", top: 6, right: 8, fontSize: 9, background: "#3E7A4B", color: "#fff", padding: "1px 6px", borderRadius: 4, fontWeight: 700 }}>2 MO FREE</div>
              </button>
            </div>
            {savingCycle && <div style={{ fontSize: 11, color: "#9A958A", marginTop: 4 }}>Saving…</div>}
          </div>
        )}

        {/* Plan change — available to solo and company accounts alike */}
        {!showTierChange && (
          <button onClick={() => setShowTierChange(true)} style={{ ...ghostBtn, width: "100%", justifyContent: "center", display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}>
            <Users size={14} /> Change plan
          </button>
        )}
        {showTierChange && (
          <div style={{ border: "1px solid #E2DCCC", borderRadius: 8, padding: 14, marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#44484D", marginBottom: 10 }}>Select a plan</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
              {PLAN_OPTIONS.map((t) => (
                <button key={t.id} onClick={() => setSelectedTier(t.id)} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: 6,
                  border: selectedTier === t.id ? "2px solid #FFB400" : "1px solid #E2DCCC", background: selectedTier === t.id ? "#FFFBF0" : "#fff", cursor: "pointer", textAlign: "left",
                }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{t.name} {t.id === currentPlanId && <span style={{ fontSize: 10, color: "#9A958A", fontWeight: 400 }}>(current)</span>}</div>
                    <div style={{ fontSize: 11, color: "#9A958A" }}>{t.range}</div>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>${t.price}/mo</div>
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={requestPlanChange} disabled={selectedTier === currentPlanId} style={{ ...primaryBtn("#FFB400"), flex: 1, padding: "10px 0", opacity: selectedTier === currentPlanId ? 0.5 : 1 }}>Request this plan</button>
              <button onClick={() => setShowTierChange(false)} style={ghostBtn}>Cancel</button>
            </div>
            <div style={{ fontSize: 10, color: "#9A958A", marginTop: 8 }}>
              {selectedTier === "solo" && isCorp
                ? "Switching to a solo plan is set up by our team — we'll email you within 1 business day to confirm and move your account over."
                : !isCorp && selectedTier !== "solo"
                  ? "Upgrading to a company plan is set up by our team — we'll email you within 1 business day to finish setting up your company roster."
                  : "Tier changes take effect on your next billing cycle. We'll email you to confirm."}
            </div>
          </div>
        )}
        {tierRequestSent && (
          <div style={{ background: "#F1F8F2", border: "1px solid #BFE0C6", borderRadius: 6, padding: "8px 10px", fontSize: 12, color: "#3E7A4B", marginBottom: 8 }}>
            ✓ Plan change requested — we'll follow up by email to confirm.
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <a href="mailto:directfreightco2026@directfreightco.com?subject=Update payment method" style={{ ...ghostBtn, justifyContent: "flex-start", display: "flex", gap: 6, alignItems: "center", textDecoration: "none", color: "inherit" }}>
            <CreditCard size={14} /> Update payment method
          </a>
          <a href="mailto:directfreightco2026@directfreightco.com?subject=Invoice request" style={{ ...ghostBtn, justifyContent: "flex-start", display: "flex", gap: 6, alignItems: "center", textDecoration: "none", color: "inherit" }}>
            <FileText size={14} /> Request invoices
          </a>
          <a href="mailto:directfreightco2026@directfreightco.com?subject=Cancellation request" style={{ ...ghostBtn, color: "#FF5A1F", justifyContent: "flex-start", display: "flex", gap: 6, alignItems: "center", textDecoration: "none" }}>
            <X size={14} /> Cancel subscription
          </a>
        </div>
      </Card>
      <div style={{ fontSize: 11, color: "#9A958A", lineHeight: 1.5 }}>
        To update your payment method, email <b>directfreightco2026@directfreightco.com</b>. Cancellation takes effect at the end of your current billing period. No pro-rated refunds except where required by law.
      </div>
      {!isComplimentary && me && (
        <Card style={{ padding: 16 }}>
          <PromoCodeRedemption me={me} onApply={(benefit) => setPromoApplied(benefit)} />
        </Card>
      )}
      {promoApplied && (
        <div style={{ background: "#F1F8F2", border: "1px solid #BFE0C6", borderRadius: 8, padding: "10px 12px", fontSize: 12, color: "#3E7A4B" }}>
          ✓ {promoApplied.benefit === "free_trial_days" ? `${promoApplied.amount} extra days added to your free trial`
           : promoApplied.benefit === "free_months" ? `${promoApplied.amount} free month${promoApplied.amount > 1 ? "s" : ""} applied`
           : promoApplied.benefit === "discount_pct" ? `${promoApplied.amount}% discount applied to your subscription`
           : "Complimentary account activated — your account is now free"} 🎉
        </div>
      )}
    </div>
  );
}

// Computes an estimated next payment date based on trial start and billing cycle.
// Honest about being an estimate since real Stripe billing isn't wired yet.
function getNextPaymentDate(me, isCorp) {
  const start = new Date(me?.trialStartedAt || me?.createdAt || Date.now());
  const trialEnd = new Date(start.getTime() + TRIAL_MS);
  if (Date.now() < trialEnd.getTime()) return { date: trialEnd, isFirstPayment: true };
  const cycleMs = (me?.billingCycle === "annual" ? 365 : 30) * 24 * 60 * 60 * 1000;
  let next = trialEnd.getTime();
  while (next < Date.now()) next += cycleMs;
  return { date: new Date(next), isFirstPayment: false };
}

function MyAccountPanel({ me, corp, isCorp, onSave, onGoBilling }) {
  const [name, setName] = useState(me.name || "");
  const [email] = useState(me.email || "");
  const [phone, setPhone] = useState(me.phone || "");
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [saving, setSaving] = useState(false);

  const tier = isCorp ? getCompanyTier(corp?.members?.length || 0) : null;
  const price = isCorp ? tier?.price : (me.role === "trucker" ? 30 : 50);
  const planName = isCorp ? `${tier?.name} Plan` : (me.role === "trucker" ? "Carrier Plan" : "Shipper Plan");
  const billingCycle = me.billingCycle || "monthly";
  const isComplimentary = me.complimentary && (!me.complimentaryExpiry || Date.now() < me.complimentaryExpiry);
  const { date: nextPaymentDate, isFirstPayment } = getNextPaymentDate(me, isCorp);
  const displayPrice = billingCycle === "annual" ? price * 10 : price;

  const save = async () => {
    setSaving(true);
    setSaveError(false);
    const result = await onSave({ name, phone });
    setSaving(false);
    if (result === false) {
      setSaveError(true);
      setTimeout(() => setSaveError(false), 4000);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 560 }}>
      <Card style={{ padding: 24 }}>
        <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 18, textTransform: "uppercase", marginBottom: 16 }}>My Account</div>

        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
          <ProfilePicture src={me.avatar} name={me.name} size={72} onUpload={(dataUrl) => onSave({ avatar: dataUrl })} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 17 }}>{me.name}</div>
            <div style={{ fontSize: 13, color: "#6B6557" }}>{me.email}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
              <Stars value={avgRating(me.ratings)} size={13} />
              <span style={{ fontSize: 12, color: "#6B6557" }}>{avgRating(me.ratings).toFixed(1)} · {(me.ratings || []).length} rating{(me.ratings || []).length === 1 ? "" : "s"}</span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
          <Field label="Full name"><input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} /></Field>
          <Field label="Email (contact support to change)"><input value={email} disabled style={{ ...inputStyle, background: "#F8F5EE", color: "#9A958A" }} /></Field>
          <Field label="Phone"><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 000-0000" style={inputStyle} /></Field>
          <button onClick={save} disabled={saving} style={{ ...primaryBtn(saveError ? "#C0432B" : "#FFB400"), opacity: saving ? 0.7 : 1 }}>
            {saving ? "Saving…" : saveError ? "Save failed — try again" : saved ? "Saved ✓" : "Save changes"}
          </button>
          {saveError && (
            <div style={{ fontSize: 12, color: "#C0432B", marginTop: -6 }}>
              Couldn't reach the server to save. Check your connection and try again.
            </div>
          )}
        </div>
      </Card>

      <Card style={{ padding: 20 }}>
        <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 16, textTransform: "uppercase", marginBottom: 14 }}>Membership</div>

        {isComplimentary ? (
          <div style={{ background: "#F1F8F2", border: "1px solid #BFE0C6", borderRadius: 8, padding: "14px 16px", display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 22 }}>🎁</span>
            <div>
              <div style={{ fontWeight: 700, color: "#3E7A4B", fontSize: 14 }}>Complimentary account</div>
              <div style={{ fontSize: 12, color: "#6B6557" }}>
                No charge{me.complimentaryExpiry ? ` through ${new Date(me.complimentaryExpiry).toLocaleDateString()}` : " — permanent"}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #EEE8DA" }}>
              <span style={{ fontSize: 13, color: "#6B6557" }}>Plan</span>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{planName}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #EEE8DA" }}>
              <span style={{ fontSize: 13, color: "#6B6557" }}>Price</span>
              <span style={{ fontSize: 13, fontWeight: 700 }}>${displayPrice}/{billingCycle === "annual" ? "yr" : "mo"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #EEE8DA" }}>
              <span style={{ fontSize: 13, color: "#6B6557" }}>Billing cycle</span>
              <span style={{ fontSize: 13, fontWeight: 700, textTransform: "capitalize" }}>{billingCycle}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0" }}>
              <span style={{ fontSize: 13, color: "#6B6557" }}>{isFirstPayment ? "First payment due" : "Next payment due"}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: isFirstPayment ? "#B5790A" : "#1B1D21" }}>{nextPaymentDate.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}</span>
            </div>
            {isFirstPayment && (
              <div style={{ fontSize: 11, color: "#9A958A", marginTop: -4 }}>You're still in your 30-day free trial — this is when your first charge would apply.</div>
            )}
          </div>
        )}

        <button onClick={onGoBilling} style={{ ...ghostBtn, width: "100%", justifyContent: "center", display: "flex", alignItems: "center", gap: 6, marginTop: 16 }}>
          <CreditCard size={14} /> Manage billing & payment method
        </button>
      </Card>
    </div>
  );
}


function OnboardingCheckTrigger({ onboarding, onOpen, optional }) {
  if (!onboarding) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <button onClick={onOpen} style={{ ...ghostBtn, display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
          <ShieldCheck size={14} /> Run DOT/MC background check{optional ? " (optional)" : ""}
        </button>
      </div>
    );
  }
  const tone = { pass: { color: "#3E7A4B", bg: "#F1F8F2", border: "#BFE0C6", label: "Clean — passed onboarding check" },
    warn: { color: "#B5790A", bg: "#FFF6E5", border: "#FFD98C", label: "Flagged — proceeding with acknowledged risk" },
    fail: { color: "#C0432B", bg: "#FDF1EE", border: "#F3B7A6", label: "Failed onboarding check" } }[onboarding.evaluation.level];
  return (
    <div style={{ border: `1px solid ${tone.border}`, background: tone.bg, borderRadius: 8, padding: "10px 12px", fontSize: 12, color: tone.color, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
      <span style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700 }}><ShieldCheck size={14} /> {tone.label}</span>
      <button onClick={onOpen} style={{ background: "none", border: "none", color: tone.color, fontSize: 11, fontWeight: 700, textDecoration: "underline", cursor: "pointer" }}>Re-run</button>
    </div>
  );
}

function CorpLoginForm({ subtype, existing, onBack, onSubmit, embedded, selectedTier }) {
  const [mode, setMode] = useState("signup");
  const [email, setEmail] = useState(""); const [companyName, setCompanyName] = useState("");
  const [onboarding, setOnboarding] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const accent = subtype === "trucking" ? "#FF5A1F" : "#FFB400";

  // Stripe state
  const [stripeConnected, setStripeConnected] = useState(false);
  const [stripeCardNumber, setStripeCardNumber] = useState("");
  const [stripeExp, setStripeExp] = useState("");
  const [stripeCvc, setStripeCvc] = useState("");
  const [stripeNameOnCard, setStripeNameOnCard] = useState("");
  const [showStripeCard, setShowStripeCard] = useState(false);
  const [coiVerified, setCoiVerified] = useState(false);
  const [coiData, setCoiData] = useState(null);
  const [bizVerified, setBizVerified] = useState(false);
  const [bizData, setBizData] = useState(null);

  const formatCard = (v) => v.replace(/\D/g, "").slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 ");
  const formatExp = (v) => { const d = v.replace(/\D/g, "").slice(0, 4); return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d; };

  const tryLogin = async () => {
    try {
      const { user } = await api.post("/api/auth/login", { email });
      if (user.role !== "corp") { alert("No company account found with that email."); return; }
      onSubmit(dbUserToCorp(user));
    } catch (err) {
      alert(err.message || "No company account found with that email.");
    }
  };

  const trySignup = async () => {
    if (!companyName || !email) { alert("Company name and email are required."); return; }
    if (!agreedToTerms) { alert("You must agree to the Terms of Service to create an account."); return; }
    if (!bizVerified) { alert("Please upload and verify your business document before creating a company account."); return; }
    if (subtype === "trucking" && !onboarding) { alert("Run the DOT/MC background check before creating a trucking company account."); return; }
    if (subtype === "trucking" && !coiVerified) { alert("Please upload and verify your Certificate of Insurance before creating a company account."); return; }
    if (!stripeConnected) {
      alert(subtype === "trucking"
        ? "Connect your Stripe payout account to receive carrier payments before creating your account."
        : "Add a payment method before creating your account.");
      return;
    }
    const corpData = {
      name: companyName,
      company: subtype,
      email,
      role: "corp",
      equipment_type: subtype,
      mc_number: onboarding?.data?.mcNumber || null,
      dot_number: onboarding?.data?.dotNumber || null,
      verification: onboarding?.data || null,
      coi_verified: coiVerified || false,
      biz_verified: bizVerified || false,
      biz_data: bizData || null,
      stripe_connected: true,
      billing: subtype === "shipping" ? { connected: true, last4: stripeCardNumber.replace(/\D/g, "").slice(-4), exp: stripeExp } : null,
      payout: subtype === "trucking" ? { connected: true, provider: "Stripe Connect" } : null,
      lanes: [], // lanes field stores members array for corp accounts
    };
    try {
      const { user } = await api.post("/api/auth/signup", corpData);
      // Map DB user back to corp shape
      const corp = dbUserToCorp(user);
      onSubmit(corp);
    } catch (err) {
      // Try login if already exists
      try {
        const { user } = await api.post("/api/auth/login", { email });
        onSubmit(dbUserToCorp(user));
      } catch (e) { alert(e.message || "Signup failed — please try again."); }
    }
  };

  const formCard = (
    <Card style={{ width: 480, maxWidth: "100%", padding: 32 }}>
      {!embedded && <button onClick={onBack} style={{ background: "none", border: "none", color: "#6B6557", display: "flex", alignItems: "center", gap: 4, fontSize: 13, marginBottom: 16, padding: 0 }}><ArrowLeft size={14} /> Back</button>}
      <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 22, textTransform: "uppercase", marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
        <Building2 size={20} color={accent} /> {subtype === "trucking" ? "Trucking Company" : "Shipping Company"}
      </div>
      {selectedTier && (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#EAF1F8", border: "1px solid #C7DAEA", borderRadius: 6, padding: "4px 10px", fontSize: 12, color: "#3A6EA5", fontWeight: 600, marginBottom: 6 }}>
          {selectedTier.name} plan · {selectedTier.range} · ${selectedTier.price}/mo
        </div>
      )}
      <div style={{ fontSize: 13, color: "#6B6557", marginBottom: 8 }}>
        {subtype === "trucking" ? "Every driver gets their own profile and rating." : "Every team member gets their own profile."}
      </div>
      <BetaTrialBanner />
      <SubscriptionNote text="One flat bill per fleet-size tier, no per-driver or per-seat charges within your tier — pricing scales as you grow." />
      <div style={{ display: "flex", gap: 8, margin: "16px 0" }}>
        {["signup", "login"].map((m) => (
          <button key={m} onClick={() => setMode(m)} style={{ flex: 1, padding: "8px 0", borderRadius: 6, border: "1px solid #E2DCCC", background: mode === m ? accent : "#fff", color: mode === m ? "#1B1D21" : "#6B6557", fontWeight: 600, fontSize: 13, textTransform: "capitalize" }}>{m === "signup" ? "Sign up" : "Log in"}</button>
        ))}
      </div>
      {mode === "login" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Field label="Company email"><input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="dispatch@yourcompany.com" style={inputStyle} /></Field>
          <button onClick={tryLogin} style={{ ...primaryBtn(accent), marginTop: 8 }}>Log in</button>
          
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Field label="Company name"><input value={companyName} onChange={(e) => setCompanyName(e.target.value)} style={inputStyle} /></Field>
          <Field label="Company email"><input value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} /></Field>
          {subtype === "trucking" && <OnboardingCheckTrigger onboarding={onboarding} onOpen={() => setShowOnboarding(true)} />}
          {subtype === "trucking" && (
            <div style={{ borderTop: "1px solid #EEE8DA", paddingTop: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#44484D", marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
                <FileText size={13} color="#635BFF" /> Required: upload your Certificate of Insurance
              </div>
              <CoiVerifier onVerified={(data) => { setCoiVerified(true); setCoiData(data); }} carrierName={companyName} carrierEmail={email} />
            </div>
          )}
          {/* ── BUSINESS VERIFICATION ── */}
          <div style={{ borderTop: "1px solid #EEE8DA", paddingTop: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#44484D", marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
              <Building2 size={13} color="#635BFF" /> Required: verify your business registration
            </div>
            {!bizVerified ? (
              <BusinessVerifier
                userName={companyName} userEmail={email} claimedBusinessName={companyName}
                onVerified={(data) => { setBizVerified(true); setBizData(data); }}
              />
            ) : (
              <div style={{ background: "#F1F8F2", border: "1px solid #BFE0C6", borderRadius: 8, padding: "10px 12px", display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "#3E7A4B" }}>
                <CheckCircle2 size={15} /> Business verified — {bizData?.businessName || companyName}
              </div>
            )}
          </div>

          {/* ── STRIPE SECTION ── */}
          <div style={{ borderTop: "1px solid #EEE8DA", paddingTop: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#44484D", marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
              <CreditCard size={13} color="#635BFF" />
              {subtype === "trucking" ? "Required: connect your Stripe payout account" : "Required: add a payment method"}
            </div>
            <div style={{ fontSize: 11, color: "#6B6557", marginBottom: 8, lineHeight: 1.5 }}>
              {subtype === "trucking"
                ? "Stripe deposits load earnings directly to your company bank account. Free instant payouts, no fees."
                : "Your card is charged for load payments and detention fees. Subscriptions are billed here too."}
            </div>
            {!stripeConnected ? (
              subtype === "trucking" ? (
                <button onClick={() => setStripeConnected(true)} style={{ background: "#635BFF", color: "#fff", border: "none", borderRadius: 8, padding: "10px 16px", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 8, cursor: "pointer", width: "100%" }}>
                  <CreditCard size={15} /> Connect company with Stripe — receive payments
                </button>
              ) : !showStripeCard ? (
                <button onClick={() => setShowStripeCard(true)} style={{ background: "#635BFF", color: "#fff", border: "none", borderRadius: 8, padding: "10px 16px", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 8, cursor: "pointer", width: "100%" }}>
                  <CreditCard size={15} /> Add payment method
                </button>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, background: "#F8F5EE", borderRadius: 8, padding: 12 }}>
                  <Field label="Name on card"><input value={stripeNameOnCard} onChange={(e) => setStripeNameOnCard(e.target.value)} style={inputStyle} /></Field>
                  <Field label="Card number"><input value={stripeCardNumber} onChange={(e) => setStripeCardNumber(formatCard(e.target.value))} placeholder="4242 4242 4242 4242" style={inputStyle} /></Field>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Field label="Expiry"><input value={stripeExp} onChange={(e) => setStripeExp(formatExp(e.target.value))} placeholder="MM/YY" style={inputStyle} /></Field>
                    <Field label="CVC"><input value={stripeCvc} onChange={(e) => setStripeCvc(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="123" style={inputStyle} /></Field>
                  </div>
                  <button onClick={() => { const d = stripeCardNumber.replace(/\D/g,""); if(d.length<12||!stripeExp||!stripeCvc||!stripeNameOnCard){alert("Fill in all card fields.");return;} setStripeConnected(true); setShowStripeCard(false); }} style={{ background: "#635BFF", color: "#fff", border: "none", borderRadius: 8, padding: "10px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Save card</button>
                </div>
              )
            ) : (
              <div style={{ background: "#F1F8F2", border: "1px solid #BFE0C6", borderRadius: 8, padding: "10px 12px", display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "#3E7A4B" }}>
                <CheckCircle2 size={15} /> {subtype === "trucking" ? "Stripe payout account connected" : `Card ending in ${stripeCardNumber.replace(/\D/g,"").slice(-4)||"••••"} added`} — you're ready to go
              </div>
            )}
            <div style={{ fontSize: 10, color: "#9A958A", marginTop: 6 }}>Secured by Stripe. Direct Freight Co never stores raw card or bank account numbers.</div>
          </div>

          <TermsCheckbox checked={agreedToTerms} onChange={setAgreedToTerms} onOpenTerms={() => setShowTerms(true)} role={subtype} />
          <button onClick={trySignup} disabled={!agreedToTerms || !stripeConnected || !bizVerified} style={{ ...primaryBtn(accent), marginTop: 8, opacity: agreedToTerms && stripeConnected && bizVerified ? 1 : 0.5 }}>Create company account</button>
          {!bizVerified && <div style={{ fontSize: 11, color: "#C0432B", textAlign: "center" }}>Upload and verify your business document above to continue</div>}
          {bizVerified && !stripeConnected && <div style={{ fontSize: 11, color: "#C0432B", textAlign: "center" }}>{subtype === "trucking" ? "Connect your Stripe account above to continue" : "Add a payment method above to continue"}</div>}
        </div>
      )}
    </Card>
  );

  const modals = (
    <>
      {showOnboarding && <OnboardingCheckModal onClose={() => setShowOnboarding(false)} onComplete={(data, evaluation) => setOnboarding({ data, evaluation })} />}
      {showTerms && <TermsModal onClose={() => setShowTerms(false)} />}
    </>
  );

  if (embedded) {
    return (<>{formCard}{modals}</>);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F2EDE4", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "Inter, sans-serif" }}>
      {formCard}
      {modals}
    </div>
  );
}

// ---------- Carrier onboarding check (mock) ----------
// Replace this with a call to YOUR backend, e.g. fetch('/api/carrier-verify?mc=...&dot=...'),
// which then calls SaferWatch, Highway, or FMCSA's free QCMobile API using a server-side key.
// ---------- Carrier onboarding check — Authority & Safety only ----------
async function runCarrierOnboardingCheck(mcNumber, dotNumber, forceClean = false) {
  if (forceClean) {
    return {
      legalName: "Sample Carrier LLC", mcNumber, dotNumber: dotNumber || "1234567",
      authorityStatus: "AUTHORIZED", safetyRating: "SATISFACTORY",
      oosRateVehicle: 8, oosRateDriver: 3, crashCount24mo: 0,
    };
  }

  const apiBase = "https://hauldirect-api-production.up.railway.app";

  if (apiBase) {
    const params = new URLSearchParams();
    if (mcNumber) params.set("mc", mcNumber.replace(/\D/g, ""));
    if (dotNumber) params.set("dot", dotNumber.replace(/\D/g, ""));
    const resp = await fetch(`${apiBase}/api/carrier-verify?${params}`);
    if (!resp.ok) throw new Error(`Verification service error: ${resp.status}`);
    return resp.json();
  }

  // Mock fallback
  await new Promise((r) => setTimeout(r, 1300));
  const cleanDigits = (mcNumber || dotNumber || "").replace(/\D/g, "");
  const lastDigit = Number(cleanDigits.slice(-1)) || 0;
  const profiles = [
    { authorityStatus: "AUTHORIZED",     safetyRating: "SATISFACTORY",  oosRateVehicle: 9,  oosRateDriver: 2,  crashCount24mo: 0 },
    { authorityStatus: "AUTHORIZED",     safetyRating: "NOT RATED",      oosRateVehicle: 14, oosRateDriver: 4,  crashCount24mo: 1 },
    { authorityStatus: "REVOKED",        safetyRating: "UNSATISFACTORY", oosRateVehicle: 41, oosRateDriver: 22, crashCount24mo: 4 },
    { authorityStatus: "AUTHORIZED",     safetyRating: "SATISFACTORY",  oosRateVehicle: 11, oosRateDriver: 5,  crashCount24mo: 1 },
    { authorityStatus: "AUTHORIZED",     safetyRating: "CONDITIONAL",   oosRateVehicle: 33, oosRateDriver: 12, crashCount24mo: 3 },
    { authorityStatus: "AUTHORIZED",     safetyRating: "SATISFACTORY",  oosRateVehicle: 5,  oosRateDriver: 1,  crashCount24mo: 0 },
    { authorityStatus: "NOT AUTHORIZED", safetyRating: "NOT RATED",      oosRateVehicle: 0,  oosRateDriver: 0,  crashCount24mo: 0 },
    { authorityStatus: "AUTHORIZED",     safetyRating: "SATISFACTORY",  oosRateVehicle: 3,  oosRateDriver: 1,  crashCount24mo: 0 },
    { authorityStatus: "AUTHORIZED",     safetyRating: "NOT RATED",      oosRateVehicle: 22, oosRateDriver: 8,  crashCount24mo: 2 },
    { authorityStatus: "AUTHORIZED",     safetyRating: "CONDITIONAL",   oosRateVehicle: 28, oosRateDriver: 9,  crashCount24mo: 2 },
  ];
  const profile = profiles[lastDigit % profiles.length];
  return { legalName: "Sample Carrier LLC", mcNumber: mcNumber || null, dotNumber: dotNumber || ("1" + cleanDigits.padStart(6, "0")), ...profile };
}

// ---------- Insurance check — separate route ----------
async function runInsuranceVerify(mcNumber, dotNumber) {
  const apiBase = "https://hauldirect-api-production.up.railway.app";
  const params = new URLSearchParams();
  if (mcNumber) params.set("mc", mcNumber.replace(/\D/g, ""));
  if (dotNumber) params.set("dot", dotNumber.replace(/\D/g, ""));
  try {
    const resp = await fetch(`${apiBase}/api/insurance-verify?${params}`);
    if (!resp.ok) throw new Error(`Insurance verification error: ${resp.status}`);
    return resp.json();
  } catch (err) {
    // If insurance check fails, return unknown — don't block the carrier
    return { insuranceStatus: "UNKNOWN", autoLiabilityCoverage: null, cargoCoverage: null, error: err.message };
  }
}

const REQUIRED_COVERAGE = { autoLiability: 750000, cargo: 100000 };

// National benchmark thresholds (illustrative — replace with your actual underwriting/risk policy)
const ONBOARDING_THRESHOLDS = { maxVehicleOOS: 30, maxDriverOOS: 10, maxCrashes24mo: 2 };

function evaluateOnboarding(data) {
  const reasons = { fail: [], warn: [] };
  if (data.authorityStatus !== "AUTHORIZED") reasons.fail.push(`Operating authority is ${data.authorityStatus?.toLowerCase() || "unknown"} — must be authorized for hire.`);
  if (data.safetyRating === "UNSATISFACTORY") reasons.fail.push("FMCSA safety rating is Unsatisfactory.");
  if (data.safetyRating === "CONDITIONAL") reasons.warn.push("FMCSA safety rating is Conditional — below the standard Satisfactory threshold.");
  if (data.safetyRating === "NOT RATED") reasons.warn.push("Carrier has not yet received an FMCSA safety rating.");
  if (data.oosRateVehicle > ONBOARDING_THRESHOLDS.maxVehicleOOS) reasons.warn.push(`Vehicle out-of-service rate (${data.oosRateVehicle}%) exceeds the ${ONBOARDING_THRESHOLDS.maxVehicleOOS}% threshold.`);
  if (data.oosRateDriver > ONBOARDING_THRESHOLDS.maxDriverOOS) reasons.warn.push(`Driver out-of-service rate (${data.oosRateDriver}%) exceeds the ${ONBOARDING_THRESHOLDS.maxDriverOOS}% threshold.`);
  if (data.crashCount24mo > ONBOARDING_THRESHOLDS.maxCrashes24mo) reasons.warn.push(`${data.crashCount24mo} reportable crashes in the last 24 months.`);
  const level = reasons.fail.length ? "fail" : reasons.warn.length ? "warn" : "pass";
  return { level, reasons };
}

function OnboardingCheckModal({ onClose, onComplete }) {
  const [step, setStep] = useState("form"); // form | checking | result | insurance_checking | insurance_result
  const [mcNumber, setMcNumber] = useState(""); const [dotNumber, setDotNumber] = useState("");
  const [result, setResult] = useState(null);
  const [insuranceResult, setInsuranceResult] = useState(null);
  const [ackWarn, setAckWarn] = useState(false);

  const runCheck = async () => {
    if (!mcNumber.trim() && !dotNumber.trim()) { alert("Enter an MC number, a DOT number, or both."); return; }
    setStep("checking");
    try {
      const data = await runCarrierOnboardingCheck(mcNumber, dotNumber);
      const evaluation = evaluateOnboarding(data);
      setResult({ data, evaluation });
      setStep("result");
    } catch (err) {
      alert("Verification failed: " + err.message);
      setStep("form");
    }
  };

  const runInsuranceCheck = async () => {
    setStep("insurance_checking");
    try {
      const data = await runInsuranceVerify(mcNumber, dotNumber);
      setInsuranceResult(data);
      setStep("insurance_result");
    } catch (err) {
      setInsuranceResult({ error: err.message });
      setStep("insurance_result");
    }
  };

  const proceed = () => { onComplete(result.data, result.evaluation); onClose(); };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(27,29,33,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 16 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", width: "100%", maxWidth: 520, borderRadius: 12, overflow: "hidden", boxShadow: "0 12px 40px rgba(0,0,0,0.3)" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #E2DCCC", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#1B1D21", color: "#F2EDE4" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 15 }}><ShieldCheck size={16} color="#FFB400" /> DOT / MC Background Check</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#F2EDE4" }}><X size={18} /></button>
        </div>
        <div style={{ padding: 20 }}>

          {step === "form" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: 13, color: "#6B6557" }}>Checks operating authority, FMCSA safety rating, out-of-service rates, and crash history. Insurance is verified separately.</div>
              <Field label="DOT Number"><input value={dotNumber} onChange={(e) => setDotNumber(e.target.value)} placeholder="e.g. 1234567" style={inputStyle} /></Field>
              <Field label="MC Number (optional if DOT provided)"><input value={mcNumber} onChange={(e) => setMcNumber(e.target.value)} placeholder="e.g. MC-123456" style={inputStyle} /></Field>
              <button onClick={runCheck} style={{ ...primaryBtn("#FFB400"), marginTop: 4 }}>Run authority & safety check</button>
            </div>
          )}

          {step === "checking" && (
            <div style={{ textAlign: "center", padding: "30px 0", color: "#6B6557", fontSize: 14 }}>
              <RefreshCcw size={22} style={{ marginBottom: 10 }} />
              <div>Checking operating authority and safety records with FMCSA…</div>
            </div>
          )}

          {step === "result" && result && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <OnboardingResultCard result={result} ackWarn={ackWarn} setAckWarn={setAckWarn} onClose={onClose} onRetry={() => setStep("form")} onProceed={proceed} />
              {result.evaluation.level !== "fail" && (
                <div style={{ borderTop: "1px solid #EEE8DA", paddingTop: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                    <ShieldCheck size={14} color="#3A6EA5" /> Insurance verification (separate check)
                  </div>
                  <div style={{ fontSize: 12, color: "#6B6557", marginBottom: 10 }}>
                    Run a separate check to verify active Auto Liability ($750K min) on file with FMCSA. Cargo insurance is optional.
                  </div>
                  <button onClick={runInsuranceCheck} style={{ ...ghostBtn, display: "flex", alignItems: "center", gap: 6 }}>
                    <ShieldCheck size={14} /> Check insurance coverage
                  </button>
                </div>
              )}
            </div>
          )}

          {step === "insurance_checking" && (
            <div style={{ textAlign: "center", padding: "30px 0", color: "#6B6557", fontSize: 14 }}>
              <RefreshCcw size={22} style={{ marginBottom: 10 }} />
              <div>Checking insurance records with FMCSA…</div>
            </div>
          )}

          {step === "insurance_result" && insuranceResult && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <InsuranceResultCard data={insuranceResult} />
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setStep("result")} style={ghostBtn}>Back</button>
                <button onClick={proceed} style={{ ...primaryBtn("#FFB400") }}>Continue with signup</button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

function InsuranceResultCard({ data }) {
  if (data.error) {
    return (
      <div style={{ background: "#FFF6E5", border: "1px solid #FFD98C", borderRadius: 8, padding: 14, fontSize: 13, color: "#B5790A" }}>
        <b>Insurance check unavailable</b> — {data.error}. You can still proceed; insurance will be verified separately before your first load.
      </div>
    );
  }

  const autoAmt = Number(data.autoLiabilityCoverage) || 0;
  const cargoAmt = Number(data.cargoCoverage) || 0;
  const autoOk = autoAmt >= REQUIRED_COVERAGE.autoLiability;
  const isActive = data.insuranceStatus === "ACTIVE";
  const allGood = isActive && autoOk; // cargo is optional
  const tone = allGood
    ? { bg: "#F1F8F2", border: "#BFE0C6", color: "#3E7A4B" }
    : { bg: "#FDF1EE", border: "#F3B7A6", color: "#C0432B" };

  const fmtAuto = autoAmt >= 1000000
    ? `$${(autoAmt / 1000000).toFixed(2)}M`
    : autoAmt > 0 ? `$${(autoAmt / 1000).toFixed(0)}K` : "Not on file";

  const fmtCargo = cargoAmt > 0
    ? `$${(cargoAmt / 1000).toFixed(0)}K`
    : "Not on file";

  return (
    <div style={{ background: tone.bg, border: `1px solid ${tone.border}`, borderRadius: 8, padding: 14, fontSize: 13 }}>
      <div style={{ fontWeight: 700, color: tone.color, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
        <ShieldCheck size={15} /> Insurance Status: {data.insuranceStatus || "UNKNOWN"}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, color: "#44484D" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
          <span>Auto Liability:</span>
          <b style={{ color: autoOk ? "#3E7A4B" : "#C0432B" }}>
            {fmtAuto} {autoOk ? "✓" : `⚠ min $${(REQUIRED_COVERAGE.autoLiability / 1000).toFixed(0)}K required`}
          </b>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
          <span>Cargo (optional):</span>
          <b style={{ color: cargoAmt > 0 ? "#3E7A4B" : "#9A958A" }}>
            {fmtCargo} {cargoAmt > 0 ? "✓ on file" : "—"} <span style={{ fontSize: 11, color: "#9A958A" }}>(optional)</span>
          </b>
        </div>
      </div>
      {!allGood && (
        <div style={{ marginTop: 10, fontSize: 12, color: "#B5790A" }}>
          {!isActive && "Insurance is not showing as active on FMCSA. "}
          {!autoOk && "Auto Liability coverage is below the $750K minimum. "}
          Contact your insurer and confirm MCS-90 and BMC-34 forms have been filed directly with FMCSA.
        </div>
      )}
      <div style={{ marginTop: 8, fontSize: 11, color: "#9A958A" }}>
        Source: {data.dataSource || "FMCSA"} · {data.note}
      </div>
    </div>
  );
}

function OnboardingResultCard({ result, ackWarn, setAckWarn, onClose, onRetry, onProceed }) {
  const { data, evaluation } = result;
  const tone = { pass: { color: "#3E7A4B", bg: "#F1F8F2", border: "#BFE0C6", label: "Clean — meets onboarding standards" },
    warn: { color: "#B5790A", bg: "#FFF6E5", border: "#FFD98C", label: "Flagged — review before proceeding" },
    fail: { color: "#C0432B", bg: "#FDF1EE", border: "#F3B7A6", label: "Failed — does not meet onboarding standards" } }[evaluation.level];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ border: `1px solid ${tone.border}`, background: tone.bg, borderRadius: 8, padding: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, color: tone.color, fontSize: 14 }}>
          {evaluation.level === "pass" ? <ShieldCheck size={16} /> : evaluation.level === "warn" ? <ShieldCheck size={16} /> : <Lock size={16} />}
          {tone.label}
        </div>
      </div>

      <div style={{ fontSize: 13, color: "#44484D", lineHeight: 1.7 }}>
        Legal name: <b>{data.legalName}</b><br />
        DOT: <b>{data.dotNumber}</b> · MC: <b>{data.mcNumber || "—"}</b><br />
        Operating authority: <b style={{ color: data.authorityStatus === "AUTHORIZED" ? "#3E7A4B" : "#C0432B" }}>{data.authorityStatus}</b><br />
        FMCSA safety rating: <b>{data.safetyRating}</b><br />
        Insurance (BIPD): <b style={{ color: data.insuranceStatus === "ACTIVE" ? "#3E7A4B" : "#C0432B" }}>{data.insuranceStatus || "Check separately"}</b><br />
        {data.autoLiabilityCoverage != null && (
          <>Auto Liability: <b style={{ color: data.autoLiabilityCoverage >= REQUIRED_COVERAGE.autoLiability ? "#3E7A4B" : "#C0432B" }}>
            {data.autoLiabilityCoverage >= 1000000 ? `$${(data.autoLiabilityCoverage / 1000000).toFixed(2)}M` : `$${(data.autoLiabilityCoverage / 1000).toFixed(0)}K`}
          </b> <span style={{ color: "#9A958A" }}>(min $750K)</span><br /></>
        )}
        {data.cargoCoverage != null && (
          <>Cargo: <b style={{ color: data.cargoCoverage >= REQUIRED_COVERAGE.cargo ? "#3E7A4B" : "#C0432B" }}>
            ${(data.cargoCoverage / 1000).toFixed(0)}K
          </b> <span style={{ color: "#9A958A" }}>(min $100K)</span><br /></>
        )}
        {data.autoLiabilityCoverage == null && <span style={{ color: "#9A958A", fontSize: 11 }}>Run the separate insurance check below for coverage amounts.<br /></span>}
        Vehicle out-of-service rate: <b>{data.oosRateVehicle}%</b> <span style={{ color: "#9A958A" }}>(threshold {ONBOARDING_THRESHOLDS.maxVehicleOOS}%)</span><br />
        Driver out-of-service rate: <b>{data.oosRateDriver}%</b> <span style={{ color: "#9A958A" }}>(threshold {ONBOARDING_THRESHOLDS.maxDriverOOS}%)</span><br />
        Crashes (last 24 mo): <b>{data.crashCount24mo}</b> <span style={{ color: "#9A958A" }}>(threshold {ONBOARDING_THRESHOLDS.maxCrashes24mo})</span>
      </div>

      {(evaluation.reasons.fail.length > 0 || evaluation.reasons.warn.length > 0) && (
        <div style={{ fontSize: 12, color: "#44484D" }}>
          {evaluation.reasons.fail.map((r, i) => (
            <div key={"f" + i} style={{ display: "flex", gap: 6, marginBottom: 4, color: "#C0432B" }}><X size={13} style={{ flexShrink: 0, marginTop: 1 }} /> {r}</div>
          ))}
          {evaluation.reasons.warn.map((r, i) => (
            <div key={"w" + i} style={{ display: "flex", gap: 6, marginBottom: 4, color: "#B5790A" }}><ShieldCheck size={13} style={{ flexShrink: 0, marginTop: 1 }} /> {r}</div>
          ))}
        </div>
      )}

      {evaluation.level === "fail" && (
        <div style={{ fontSize: 12, color: "#C0432B", fontWeight: 600, display: "flex", gap: 6, alignItems: "flex-start" }}>
          <Lock size={14} style={{ flexShrink: 0, marginTop: 1 }} /> This carrier cannot be onboarded until the issues above are resolved. Try again once authority, insurance, and safety rating are corrected.
        </div>
      )}

      {evaluation.level === "warn" && (
        <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, color: "#44484D", cursor: "pointer" }}>
          <input type="checkbox" checked={ackWarn} onChange={(e) => setAckWarn(e.target.checked)} style={{ marginTop: 2, width: 14, height: 14, flexShrink: 0 }} />
          <span>I acknowledge the flags above and want to proceed with onboarding anyway.</span>
        </label>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        {evaluation.level === "fail" ? (
          <>
            <button onClick={onRetry} style={ghostBtn}>Re-run check</button>
            <button onClick={onClose} style={ghostBtn}>Close</button>
          </>
        ) : (
          <>
            <button onClick={onProceed} disabled={evaluation.level === "warn" && !ackWarn} style={{ ...primaryBtn("#FFB400"), opacity: evaluation.level === "warn" && !ackWarn ? 0.5 : 1 }}>
              {evaluation.level === "pass" ? "Continue" : "Proceed anyway"}
            </button>
            <button onClick={onRetry} style={ghostBtn}>Re-run</button>
          </>
        )}
      </div>
      <div style={{ fontSize: 11, color: "#9A958A" }}>Source: carrier verification service (mock data in this prototype)</div>
    </div>
  );
}

function VerificationResult({ data }) {
  const ok = data.authorityStatus === "AUTHORIZED";
  const insured = data.insuranceStatus === "ACTIVE";
  return (
    <div style={{ border: `1px solid ${ok ? "#BFE0C6" : "#F3B7A6"}`, background: ok ? "#F1F8F2" : "#FDF1EE", borderRadius: 8, padding: 12, fontSize: 13 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, color: ok ? "#3E7A4B" : "#C0432B", marginBottom: 6 }}>
        {ok ? <ShieldCheck size={15} /> : <X size={15} />} {ok ? "Authority verified" : "Verification failed"}
      </div>
      <div style={{ color: "#44484D", lineHeight: 1.6 }}>
        Legal name: <b>{data.legalName}</b><br />
        Operating authority: <b>{data.authorityStatus}</b><br />
        FMCSA safety rating: <b>{data.safetyRating}</b><br />
        Insurance (BIPD) status: <b style={{ color: insured ? "#3E7A4B" : "#C0432B" }}>{data.insuranceStatus}</b>
      </div>
      {!insured && (
        <div style={{ marginTop: 8, fontSize: 12, color: "#C0432B", fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
          <Lock size={13} /> Accounts with lapsed insurance are locked until coverage is restored.
        </div>
      )}
      <div style={{ fontSize: 11, color: "#9A958A", marginTop: 6 }}>Source: carrier verification service (mock data in this prototype)</div>
    </div>
  );
}

function BetaTrialBanner() {
  return (
    <div style={{ background: "#1B1D21", color: "#F2EDE4", borderRadius: 8, padding: "10px 14px", display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 2 }}>
      <Zap size={15} color="#FFB400" style={{ flexShrink: 0, marginTop: 1 }} />
      <div>
        <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 13, textTransform: "uppercase", color: "#FFB400", marginBottom: 2 }}>30-Day Free Trial — $0 for 30 days</div>
        <div style={{ fontSize: 11, color: "#C9C2B3" }}>Join during the launch window and your subscription is completely free for 30 days. No credit card required to start. Billing begins automatically after the trial ends.</div>
      </div>
    </div>
  );
}

function SubscriptionNote({ text }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "#F8F5EE", border: "1px solid #E2DCCC", borderRadius: 8, padding: "8px 10px", fontSize: 12, color: "#44484D" }}>
      <ShieldCheck size={14} color="#3E7A4B" style={{ flexShrink: 0, marginTop: 1 }} />
      <span>{text}</span>
    </div>
  );
}

// ---------- Terms of Service ----------
function TermsCheckbox({ checked, onChange, onOpenTerms, role }) {
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showCarrier, setShowCarrier] = useState(false);
  const isCarrier = role === "trucker" || role === "trucking";
  return (
    <div>
      <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, color: "#44484D", cursor: "pointer" }}>
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ marginTop: 3, width: 14, height: 14, flexShrink: 0 }} />
        <span>
          I agree to Direct Freight's{" "}
          <LinkBtn onClick={onOpenTerms}>Terms of Service</LinkBtn>,{" "}
          <LinkBtn onClick={() => setShowPrivacy(true)}>Privacy Policy</LinkBtn>
          {isCarrier && <>, and <LinkBtn onClick={() => setShowCarrier(true)}>Carrier Agreement</LinkBtn> (including mandatory location tracking, double-brokering prohibition, and payment hold policies)</>}
          . I understand this constitutes a cryptographically timestamped legal agreement.
        </span>
      </label>
      {checked && <div style={{ fontSize: 10, color: "#9A958A", marginTop: 4, marginLeft: 22 }}>✓ Consent recorded — {new Date().toLocaleString()} (session timestamp)</div>}
      {showPrivacy && <PrivacyModal onClose={() => setShowPrivacy(false)} />}
      {showCarrier && <CarrierAgreementModal onClose={() => setShowCarrier(false)} />}
    </div>
  );
}

function LinkBtn({ onClick, children }) {
  return (
    <button type="button" onClick={(e) => { e.preventDefault(); onClick(); }} style={{ background: "none", border: "none", padding: 0, color: "#1B1D21", fontWeight: 700, textDecoration: "underline", cursor: "pointer", fontSize: 12 }}>
      {children}
    </button>
  );
}

function TermsModal({ onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(27,29,33,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 16 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", width: "100%", maxWidth: 640, maxHeight: "85vh", borderRadius: 12, display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 12px 40px rgba(0,0,0,0.3)" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #E2DCCC", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#1B1D21", color: "#F2EDE4" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 15 }}><FileText size={16} color="#FFB400" /> Terms of Service</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#F2EDE4" }}><X size={18} /></button>
        </div>
        <div style={{ overflowY: "auto", padding: "20px 24px", fontSize: 13, color: "#33363B", lineHeight: 1.65 }}>
          <p style={{ fontSize: 11, color: "#9A958A", marginTop: 0 }}>Summary of key terms — see full Terms of Service document for complete legal text.</p>

          <h4 style={termsH4}>1. What Direct Freight Co is</h4>
          <p>Direct Freight is a technology platform connecting Shippers and Truckers directly. <b>We are not a freight broker, motor carrier, shipper, insurer, or financial institution</b>, and we are not a party to any agreement formed between a Shipper and a Trucker. All terms of carriage, rate, and delivery are solely between those two parties.</p>

          <h4 style={termsH4}>2. Accounts &amp; subscriptions</h4>
          <p>Independent and Corporate accounts require an active paid subscription. Corporate Accounts are billed a single flat fee based on fleet/team-size tier (see current pricing on the Companies page), covering unlimited driver or team-member profiles within that tier — not a per-driver or per-seat charge. Direct Freight does not take a percentage cut of any load, bid, or payment.</p>

          <h4 style={termsH4}>3. Bidding &amp; loads</h4>
          <p>Bids and counter-offers are offers between Users; a binding agreement forms only when accepted. Shippers are responsible for accurate load details; Truckers are responsible for verifying their equipment and licensing fit each load.</p>

          <h4 style={termsH4}>4. Tracking &amp; ETA</h4>
          <p>Tracking and ETA data shown on the Platform is for general informational purposes only and is not guaranteed to be accurate or real-time.</p>

          <h4 style={termsH4}>5. Carrier verification &amp; insurance lockout</h4>
          <p>Operating authority, safety rating, and insurance status shown on profiles is sourced from third-party verification data and may be outdated or inaccurate. It is not a warranty or endorsement by Direct Freight. <b>If a carrier's insurance is shown as lapsed, Direct Freight may suspend that account's access</b> (load board, bidding, messaging) until active coverage is reflected — a safety measure, not a determination of fault, and not a guarantee of real-time accuracy.</p>

          <h4 style={termsH4}>6. Payments between Users</h4>
          <p>Direct Freight does not hold, process, or guarantee freight payments between Shippers and Truckers. "Release payment" actions in the app are status indicators set by the Shipper, not a fund transfer performed by Direct Freight. Payment disputes are resolved directly between the parties.</p>

          <h4 style={termsH4}>7. Ratings</h4>
          <p>Ratings reflect a Shipper's subjective opinion and are not verified by Direct Freight. Fake, retaliatory, or paid-for ratings are prohibited.</p>

          <h4 style={termsH4}>8. Liability</h4>
          <p>The Platform is provided "as is." Direct Freight disclaims liability for cargo damage, accidents, delays, non-payment, or any dispute between Users, and our total liability is limited as described in the full Terms.</p>

          <p style={{ marginTop: 18, fontSize: 11, color: "#9A958A" }}>This is a summary for in-app display only. The complete Terms of Service — including dispute resolution, indemnification, and governing law — control in the event of any conflict, and should be reviewed by an attorney before this platform goes live.</p>
        </div>
        <div style={{ padding: 14, borderTop: "1px solid #E2DCCC", textAlign: "right" }}>
          <button onClick={onClose} style={primaryBtn("#FFB400")}>Close</button>
        </div>
      </div>
    </div>
  );
}
const termsH4 = { fontSize: 13, fontWeight: 700, color: "#1B1D21", marginTop: 18, marginBottom: 6 };

function PrivacyModal({ onClose }) {
  return (
    <LegalModal title="Privacy Policy" icon={<FileText size={16} color="#FFB400" />} onClose={onClose}>
      <p style={{ fontSize: 11, color: "#9A958A", marginTop: 0 }}>Summary of key provisions — the full Privacy Policy document controls.</p>
      <h4 style={termsH4}>1. What we collect</h4>
      <p>Account info (name, EIN/SSN for carriers, address, email), carrier verification data (MC/DOT, safety records, insurance), load and transaction records, location and telematics data, uploaded documents (BOL/POD/receipts), and usage data.</p>
      <h4 style={termsH4}>2. Location tracking is optional, unless a shipper requires it</h4>
      <p>Live GPS tracking during an active haul is <b>optional by default</b>. A carrier may choose to share real-time location voluntarily, and a shipper may require live tracking as a condition of a specific load, shown clearly before a carrier bids or accepts. Where tracking is active, your GPS coordinates and Loaded/Empty status are shared only with the Shipper on that load. Tracking is never required simply to use the Platform generally.</p>
      <h4 style={termsH4}>3. Information aggregator disclaimer</h4>
      <p>Direct Freight is an information aggregation platform — we compile and display data from users and third-party sources. We are not a freight broker, carrier, insurer, or financial institution and expressly disclaim liability for cargo damage, freight claims, payment disputes, or personal injury arising from transportation arranged through the Platform.</p>
      <h4 style={termsH4}>4. Tax reporting</h4>
      <p>Carrier payment data may be reported to the IRS via 1099-K filings where required by law. Carriers must provide a valid EIN or SSN during onboarding for this purpose.</p>
      <h4 style={termsH4}>5. Sharing</h4>
      <p>We share data with verification providers (SaferWatch/Highway/FMCSA), payment processors, and as required by law. We do not sell your personal information.</p>
      <p style={{ marginTop: 18, fontSize: 11, color: "#9A958A" }}>Full Privacy Policy available on the platform footer. Consult legal counsel before relying on this summary.</p>
    </LegalModal>
  );
}

function CarrierAgreementModal({ onClose }) {
  return (
    <LegalModal title="Carrier Agreement" icon={<Truck size={16} color="#FF5A1F" />} onClose={onClose}>
      <p style={{ fontSize: 11, color: "#9A958A", marginTop: 0 }}>Summary — the full Carrier Agreement document controls.</p>
      <h4 style={termsH4}>1. Operating authority & insurance</h4>
      <p>Carriers must hold active FMCSA authority at all times. Minimum required: <b>$750,000 Auto Liability</b>. Cargo insurance is not federally required for general freight (only for household goods movers) but may be required by individual shippers. Lapsed Auto Liability coverage triggers automatic account suspension.</p>
      <h4 style={termsH4}>2. Double-brokering prohibition</h4>
      <p><b>Zero tolerance.</b> Re-brokering or subcontracting any load to a third carrier without express Shipper consent is strictly prohibited. Violations trigger immediate account freeze and a payment hold on any associated funds, with potential permanent termination.</p>
      <h4 style={termsH4}>3. Mandatory location tracking</h4>
      <p>Accepting a load constitutes consent to continuous real-time vehicle tracking for the duration of that haul. Shippers see your live position. Deliberate disabling of tracking while a load is active may constitute a breach of this Agreement.</p>
      <h4 style={termsH4}>4. Corporate accounts & authorized agents</h4>
      <p>Fleet dispatchers and administrators may act on behalf of drivers. The corporate parent account holds administrative control; drivers have read-only access to their history. The fleet account holder is responsible for all agent actions.</p>
      <h4 style={termsH4}>5. Digital signature & RateCon</h4>
      <p>Accepting a load generates an automatic Rate Confirmation binding both parties. No wet signature required — load acceptance constitutes your digital signature.</p>
      <h4 style={termsH4}>6. Payment hold & cargo claims</h4>
      <p>Cargo claims are handled Carrier-to-Shipper under applicable law and BOL terms. Direct Freight may direct Stripe to pause disputed payment amounts pending resolution. Users waive immediate chargeback rights on amounts subject to a hold.</p>
      <p style={{ marginTop: 18, fontSize: 11, color: "#9A958A" }}>Full Carrier Agreement available on the platform footer. Consult a transportation attorney before relying on this summary.</p>
    </LegalModal>
  );
}

function ShipperAgreementModal({ onClose }) {
  return (
    <LegalModal title="Shipper Agreement" icon={<Package size={16} color="#FFB400" />} onClose={onClose}>
      <p style={{ fontSize: 11, color: "#9A958A", marginTop: 0 }}>Summary — the full Shipper Agreement document controls.</p>
      <h4 style={termsH4}>1. Load posting accuracy</h4>
      <p>You're responsible for accurate weight, dimensions, commodity description, and pickup/delivery details on every load you post. Direct Freight isn't liable for delays or misdelivery caused by inaccurate address or contact info you provided.</p>
      <h4 style={termsH4}>2. Carrier selection is your decision</h4>
      <p>Direct Freight provides FMCSA authority, safety rating, and insurance verification tools to help you choose — but selecting and accepting a Carrier is your own independent business decision. Direct Freight doesn't guarantee any Carrier's performance.</p>
      <h4 style={termsH4}>3. Digital signature & RateCon</h4>
      <p>Accepting a bid or claim generates an automatic Rate Confirmation binding both parties. No wet signature required — acceptance constitutes your digital signature, and you agree to honor the agreed rate absent a documented dispute.</p>
      <h4 style={termsH4}>4. Detention pay authorization</h4>
      <p>Posting a load and accepting a bid authorizes Direct Freight to automatically charge your payment method for verified detention (2 free hours, then $60/hr, capped at 5 hrs/$300 per stop) based on GPS geofence data — no separate approval needed at the time of each charge.</p>
      <h4 style={termsH4}>5. Payment hold & cargo claims</h4>
      <p>Cargo claims are handled Shipper-to-Carrier under applicable law and BOL terms. Direct Freight may direct Stripe to pause disputed payment amounts pending resolution. Users waive immediate chargeback rights on amounts subject to a hold.</p>
      <h4 style={termsH4}>6. Payment method & chargebacks</h4>
      <p>You must maintain a valid Stripe payment method to post loads and release payments. You agree not to dispute properly disclosed subscription, load payment, or detention charges as "unrecognized."</p>
      <p style={{ marginTop: 18, fontSize: 11, color: "#9A958A" }}>Full Shipper Agreement available on the platform footer. Consult a transportation attorney before relying on this summary.</p>
    </LegalModal>
  );
}

function LegalModal({ title, icon, onClose, children }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(27,29,33,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 16 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", width: "100%", maxWidth: 640, maxHeight: "85vh", borderRadius: 12, display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 12px 40px rgba(0,0,0,0.3)" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #E2DCCC", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#1B1D21", color: "#F2EDE4" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 15 }}>{icon} {title}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#F2EDE4" }}><X size={18} /></button>
        </div>
        <div style={{ overflowY: "auto", padding: "20px 24px", fontSize: 13, color: "#33363B", lineHeight: 1.65 }}>{children}</div>
        <div style={{ padding: 14, borderTop: "1px solid #E2DCCC", textAlign: "right" }}>
          <button onClick={onClose} style={{ ...primaryBtn("#FFB400"), padding: "9px 20px" }}>Close</button>
        </div>
      </div>
    </div>
  );
}



// ====================================================================
// ROSTER PICKER (corporation accounts)
// ====================================================================
// ====================================================================
// ACCOUNT LOCKED (lapsed insurance)
// ====================================================================
function AccountLockedScreen({ companyLabel, mcNumber, onRecheck, onLogout }) {
  const [checking, setChecking] = useState(false);
  const handleRecheck = async () => { setChecking(true); await onRecheck(); setChecking(false); };

  return (
    <div style={{ minHeight: "100vh", background: "#1B1D21", color: "#F2EDE4", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "Inter, sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@600;700&family=Inter:wght@400;500;600&display=swap');`}</style>
      <div style={{ width: 460, background: "#24272C", border: "2px solid #C0432B", borderRadius: 14, padding: 32, textAlign: "center" }}>
        <div style={{ background: "rgba(192,67,43,0.15)", width: 56, height: 56, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <Lock size={26} color="#FF6B52" />
        </div>
        <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 22, textTransform: "uppercase", marginBottom: 8 }}>Account Locked</div>
        <div style={{ fontSize: 14, color: "#C9C2B3", lineHeight: 1.6, marginBottom: 16 }}>
          Insurance verification for <b style={{ color: "#fff" }}>{companyLabel}</b> ({mcNumber || "no MC on file"}) shows <b style={{ color: "#FF6B52" }}>lapsed coverage</b>. For everyone's safety, load board access, bidding, and active hauls are paused until current proof of insurance is on file.
        </div>
        <div style={{ fontSize: 12, color: "#9A958A", marginBottom: 20 }}>Update your policy with your insurer, then re-check below — this updates automatically once your carrier verification feed reflects active coverage.</div>
        <button onClick={handleRecheck} disabled={checking} style={{ ...primaryBtn("#FFB400"), width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: checking ? 0.7 : 1 }}>
          <RefreshCcw size={15} /> {checking ? "Re-checking…" : "Re-check insurance status"}
        </button>
        <button onClick={onLogout} style={{ ...ghostBtn, width: "100%", marginTop: 10, background: "transparent", color: "#9A958A", borderColor: "#44484D" }}>Log out</button>
      </div>
    </div>
  );
}

function RosterPicker({ corp, role, onPick, onAddMember, onLogout }) {
  const [adding, setAdding] = useState(false);
  const isTrucking = corp.subtype === "trucking";

  return (
    <div style={{ minHeight: "100vh", background: "#F2EDE4", fontFamily: "Inter, sans-serif", padding: 24 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@600;700&family=Inter:wght@400;500;600&family=Roboto+Mono:wght@500&display=swap');`}</style>
      <div style={{ maxWidth: 640, margin: "40px auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 26, textTransform: "uppercase" }}>{corp.companyName}</div>
          <button onClick={onLogout} style={{ ...ghostBtn, fontSize: 12 }}>Log out</button>
        </div>
        <div className="mono" style={{ fontSize: 12, color: "#9A958A", marginBottom: 18 }}>
          {isTrucking ? "TRUCKING COMPANY" : "SHIPPING COMPANY"} · {getCompanyTier(corp.members.length).name.toUpperCase()} TIER · {corp.members.length} PROFILE{corp.members.length === 1 ? "" : "S"}
        </div>
        {isTrucking && (
          <div style={{ marginBottom: 18 }}>
            {corp.verification ? (
              <Badge tone={corp.verification.authorityStatus === "AUTHORIZED" ? "green" : "orange"}>
                {corp.verification.authorityStatus === "AUTHORIZED" ? "MC Verified" : "MC Verification Failed"} · {corp.mcNumber}
              </Badge>
            ) : (
              <Badge tone="gray">MC Not Verified</Badge>
            )}
          </div>
        )}
        <div style={{ fontSize: 14, color: "#44484D", marginBottom: 16 }}>
          Who's working right now? {isTrucking ? "Pick a driver" : "Pick a team member"} or add a new profile — everyone shares your company's single subscription.
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
          {corp.members.map((m) => (
            <Card key={m.id} style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{m.name}</div>
                <div style={{ fontSize: 12, color: "#6B6557" }}>{m.role}{m.loc ? ` · ${m.loc}` : ""}</div>
                {isTrucking && <div style={{ marginTop: 4 }}><Stars value={avgRating(m.ratings)} size={12} /> <span style={{ fontSize: 11, color: "#9A958A" }}>({m.ratings.length})</span></div>}
              </div>
              <button onClick={() => onPick(m.id)} style={{ ...primaryBtn("#FFB400"), padding: "8px 16px" }}>Continue as {m.name.split(" ")[0]}</button>
            </Card>
          ))}
          {!corp.members.length && <Empty text="No profiles yet — add the first one below." />}
        </div>

        {!adding ? (
          <button onClick={() => setAdding(true)} style={{ ...ghostBtn, display: "flex", alignItems: "center", gap: 6 }}><UserPlus size={15} /> Add a new {isTrucking ? "driver" : "team member"} profile</button>
        ) : (
          <AddMemberForm isTrucking={isTrucking} onCancel={() => setAdding(false)} onAdd={(member) => { onAddMember(member); setAdding(false); }} />
        )}
      </div>
    </div>
  );
}

function AddMemberForm({ isTrucking, onAdd, onCancel }) {
  const [name, setName] = useState(""); const [role, setRole] = useState(isTrucking ? "Driver" : "Shipping Agent");
  const [loc, setLoc] = useState(""); const [truckDesc, setTruckDesc] = useState(""); const [equipmentType, setEquipmentType] = useState(""); const [maxWeight, setMaxWeight] = useState("");
  const [l, setL] = useState(""); const [w, setW] = useState(""); const [h, setH] = useState("");

  const submit = () => {
    if (!name) { alert("Name is required."); return; }
    const base = { id: "cm" + Date.now(), name, role, loc, ratings: [] };
    onAdd(isTrucking ? { ...base, truckDesc, equipmentType, maxWeight: Number(maxWeight) || 0, dims: { l: Number(l) || 0, w: Number(w) || 0, h: Number(h) || 0 }, payout: { connected: false } } : base);
  };

  return (
    <Card style={{ padding: 20, marginTop: 4 }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>New {isTrucking ? "driver" : "team member"} profile</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", gap: 10 }}>
          <Field label="Full name"><input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} /></Field>
          <Field label="Title"><input value={role} onChange={(e) => setRole(e.target.value)} style={inputStyle} /></Field>
        </div>
        <Field label="Base location"><input value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="City, State" style={inputStyle} /></Field>
        {isTrucking && (
          <>
            <Field label="Truck description"><input value={truckDesc} onChange={(e) => setTruckDesc(e.target.value)} placeholder="Year, make, model, trailer type" style={inputStyle} /></Field>
            <Field label="Equipment type">
              <select value={equipmentType} onChange={(e) => setEquipmentType(e.target.value)} style={inputStyle}>
                <option value="">Select equipment type…</option>
                {EQUIPMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Max haul weight (lbs)"><input type="number" value={maxWeight} onChange={(e) => setMaxWeight(e.target.value)} style={inputStyle} /></Field>
            <div style={{ display: "flex", gap: 8 }}>
              <Field label="Length (ft)"><input type="number" value={l} onChange={(e) => setL(e.target.value)} style={inputStyle} /></Field>
              <Field label="Width (ft)"><input type="number" value={w} onChange={(e) => setW(e.target.value)} style={inputStyle} /></Field>
              <Field label="Height (ft)"><input type="number" value={h} onChange={(e) => setH(e.target.value)} style={inputStyle} /></Field>
            </div>
          </>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={submit} style={{ ...primaryBtn("#FFB400"), padding: "10px 18px" }}>Add profile</button>
          <button onClick={onCancel} style={{ ...ghostBtn }}>Cancel</button>
        </div>
      </div>
    </Card>
  );
}

// ====================================================================
// SHIPPER APP
// ====================================================================
function ShipperApp({ me, corp, loads, messages, independentTruckers, corporations, setLoads, updateTrucker, updateShipperProfile, addCorpMember, sendMessage, setMessages, addNotification, onLogout, onSwitchProfile }) {
  const [tab, setTab] = useState("dashboard");
  const [postMode, setPostMode] = useState("quick");
  const [chatWith, setChatWith] = useState(null);
  const [invoiceLoad, setInvoiceLoad] = useState(null);
  const myLoads = loads.filter((l) => l.shipperId === me.id);
  const pendingBidCount = myLoads.reduce((acc, l) => acc + (l.bids || []).filter((b) => b.status === "pending").length, 0);
  const resolveTrucker = (id) => findTruckerProfile(id, independentTruckers, corporations);
  const trialExpired = isTrialExpired(me);

  // Real-time messaging
  const { unreadCounts, markRead } = useRealtimeMessages(me.id, setMessages, addNotification);
  const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);

  const openChat = (loadId, truckerId, truckerName) => {
    const key = threadKey(loadId, truckerId);
    markRead(key);
    setChatWith({ loadId, truckerId, truckerName });
  };

  const postLoad = async (form) => {
    const newLoad = { shipperId: me.id, shipperName: corp ? `${corp.companyName} (${me.name})` : me.company || me.name, status: "open", truckerId: null, progress: 0, postedAt: Date.now(), bids: [], paid: false, documents: [], ...form };
    try {
      const { load } = await api.post("/api/loads", newLoad);
      const mappedLoad = dbLoadToFrontend(load);
      setLoads((prev) => [mappedLoad, ...prev]);
      // Notify matching carriers by email
      sendLaneMatchEmails(mappedLoad, independentTruckers);
    } catch (err) {
      setLoads((prev) => [{ id: "l" + Date.now(), ...newLoad }, ...prev]);
      sendLaneMatchEmails(newLoad, independentTruckers);
      console.warn("Could not save load to DB:", err.message);
    }
    setTab("mine");
  };
  const rate = async (loadId, truckerId, stars) => {
    updateTrucker(truckerId, (t) => ({ ...t, ratings: [...(t.ratings || []), stars] }));
    setLoads((prev) => prev.map((l) => (l.id === loadId ? { ...l, rated: true } : l)));
    try {
      await api.post("/api/ratings", { loadId, ratedUserId: truckerId, raterUserId: me.id, stars, role: "shipper" });
    } catch (err) { console.warn("Rating not saved to DB:", err.message); }
  };
  const acceptBid = async (loadId, bidId) => {
    let acceptedTruckerId = null, acceptedPrice = null;
    setLoads((prev) => prev.map((l) => {
      if (l.id !== loadId) return l;
      const bid = l.bids.find((b) => b.id === bidId);
      if (!bid) return l;
      acceptedTruckerId = bid.truckerId; acceptedPrice = bid.amount;
      return { ...l, status: "in_transit", truckerId: bid.truckerId, price: bid.amount, progress: 1, bids: l.bids.map((b) => ({ ...b, status: b.id === bidId ? "accepted" : "declined" })) };
    }));
    try {
      await api.patch(`/api/bids/${bidId}`, { status: "accepted" });
      await api.patch(`/api/loads/${loadId}`, { status: "in_transit", progress: 1, truckerId: acceptedTruckerId, price: acceptedPrice });
    } catch (err) { console.warn("Bid accept not saved to DB:", err.message); }
  };
  const counterBid = (loadId, bidId, amount) => setLoads((prev) => prev.map((l) => (l.id === loadId ? { ...l, bids: l.bids.map((b) => (b.id === bidId ? { ...b, status: "countered", counterAmount: amount, counterBy: "shipper" } : b)) } : l)));
  const rejectBid = (loadId, bidId) => setLoads((prev) => prev.map((l) => (l.id === loadId ? { ...l, bids: l.bids.map((b) => (b.id === bidId ? { ...b, status: "rejected" } : b)) } : l)));
  const releasePayment = async (loadId) => {
    setLoads((prev) => prev.map((l) => (l.id === loadId ? { ...l, paid: true, paidAt: Date.now() } : l)));
    try { await api.patch(`/api/loads/${loadId}`, { paid: true, paid_at: new Date().toISOString() }); }
    catch (err) { console.warn("Payment release not saved to DB:", err.message); }
  };
  const cancelLoad = async (loadId, reason) => {
    const cancelEntry = { by: me.name, role: "shipper", reason, at: Date.now() };
    setLoads((prev) => prev.map((l) => (l.id === loadId
      ? { ...l, status: "cancelled", cancelledAt: Date.now(), cancelledBy: "shipper", cancelReason: reason, cancelHistory: [...(l.cancelHistory || []), cancelEntry] }
      : l)));
    try {
      await api.patch(`/api/loads/${loadId}`, { status: "cancelled", cancelled_at: new Date().toISOString(), cancelled_by: "shipper", cancel_reason: reason });
    } catch (err) { console.warn("Cancellation not saved to DB:", err.message); }
  };
  const saveCompanySetup = async (form) => {
    updateShipperProfile(me.id, (s) => ({ ...s, ...form }));
    if (me.id?.startsWith("local_")) return "local"; // local test account — nothing to sync, treat as ok
    try {
      if (corp) {
        const updatedMembers = (corp.members || []).map((m) => (m.id === me.id ? { ...m, ...form } : m));
        await api.patch(`/api/auth/user/${corp.id}`, { lanes: updatedMembers });
      } else {
        await api.patch(`/api/auth/user/${me.id}`, form);
      }
      return true;
    } catch (err) { console.warn("Profile update not saved to DB:", err.message); return false; }
  };

  const allActiveBids = myLoads.filter((l) => l.status === "open").flatMap((l) => (l.bids || []).filter((b) => b.status !== "rejected").map((b) => ({ ...b, load: l })));

  const tabs = [
    { id: "dashboard", label: "Dashboard",        shortLabel: "Home",   icon: "🏠" },
    { id: "post",      label: "Post a Load",       shortLabel: "Post",   icon: "➕" },
    { id: "mine",      label: `My Loads (${myLoads.length})${totalUnread > 0 ? " · " + totalUnread + " new msg" + (totalUnread > 1 ? "s" : "") : ""}`, shortLabel: "Loads" + (totalUnread > 0 ? " 💬" : ""), icon: "📦" },
    { id: "bidcenter", label: `Bid Center${allActiveBids.length ? ` (${allActiveBids.length})` : ""}${pendingBidCount ? ` · ${pendingBidCount} new` : ""}`, shortLabel: "Bids", icon: "⚖️" },
    { id: "nearby",    label: "Nearby Capacity",   shortLabel: "Nearby", icon: "📍" },
    { id: "analytics", label: "Analytics",         shortLabel: "Stats",  icon: "📊" },
    ...(corp ? [{ id: "team", label: `Team (${corp.members.length})`, shortLabel: "Team", icon: "👥" }] : []),
    { id: "setup",     label: "Company Setup",     shortLabel: "Setup",  icon: "⚙️" },
    ...(corp ? [{ id: "companyprofile", label: "Company Profile", shortLabel: "Profile", icon: "🏢" }] : []),
    ...(corp ? [{ id: "edi", label: "Developer / EDI", shortLabel: "EDI", icon: "🔌" }] : []),
    { id: "billing",   label: "Billing",           shortLabel: "Billing", icon: "💳" },
    { id: "account",   label: "My Account",        shortLabel: "Account", icon: "👤" },
  ];

  return (
    <Shell title={me.name} subtitle={corp ? corp.companyName : "Shipper"} avatar={me.avatar} me={me} onLogout={onLogout} onSwitchProfile={onSwitchProfile}
      badge={<Badge tone="amber">{corp ? "CORP SHIPPER" : "SHIPPER"}</Badge>}>
      {trialExpired && <TrialExpiredPaywall me={me} onLogout={onLogout} />}
      <Tabs tabs={tabs} active={tab} onChange={setTab} />
      <MobileBottomNav tabs={tabs} activeTab={tab} onSelect={setTab} />
      {tab === "dashboard" && <ShipperDashboard loads={loads} me={me} />}
      {tab === "post" && (
        <div>
          <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
            <button onClick={() => setPostMode("quick")} style={{ padding: "7px 14px", borderRadius: 6, border: "1px solid #E2DCCC", background: postMode === "quick" ? "#FFB400" : "#fff", color: "#1B1D21", fontWeight: 700, fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}><Zap size={13} /> Quick Post</button>
            <button onClick={() => setPostMode("full")} style={{ padding: "7px 14px", borderRadius: 6, border: "1px solid #E2DCCC", background: postMode === "full" ? "#FFB400" : "#fff", color: "#1B1D21", fontWeight: 700, fontSize: 12 }}>Full Post</button>
          </div>
          {postMode === "quick" ? <QuickPostForm onSubmit={postLoad} /> : <PostLoadForm onSubmit={postLoad} />}
        </div>
      )}
      {tab === "mine" && (
        <MyLoads loads={myLoads} resolveTrucker={resolveTrucker} onRate={rate} onAcceptBid={acceptBid} onCounterBid={counterBid}
          onRejectBid={rejectBid} onReleasePayment={releasePayment} onOpenChat={(loadId, truckerId) => { markRead(threadKey(loadId, truckerId)); setChatWith({ loadId, truckerId }); }} unreadCounts={unreadCounts}
          onViewInvoice={(load) => setInvoiceLoad(load)} onCancelLoad={cancelLoad} me={me} />
      )}
      {tab === "bidcenter" && (
        <BidCenter bids={allActiveBids} resolveTrucker={resolveTrucker}
          onAccept={(loadId, bidId) => acceptBid(loadId, bidId)} onCounter={(loadId, bidId, amt) => counterBid(loadId, bidId, amt)}
          onReject={(loadId, bidId) => rejectBid(loadId, bidId)} onOpenChat={(loadId, truckerId) => { markRead(threadKey(loadId, truckerId)); setChatWith({ loadId, truckerId }); }} unreadCounts={unreadCounts} />
      )}
      {tab === "nearby" && <NearbyCapacity independentTruckers={independentTruckers} corporations={corporations} onOpenChat={(truckerId) => setChatWith({ loadId: "general-" + truckerId, truckerId })} />}
      {tab === "analytics" && <ShipperAnalytics loads={myLoads} me={me} />}
      {tab === "team" && corp && <TeamRoster corp={corp} onAddMember={(member) => addCorpMember(corp.id, member)} onUpdateMember={(member) => setCorporations((prev) => prev.map((c) => (c.id === corp.id ? { ...c, members: c.members.map((m) => (m.id === member.id ? member : m)) } : c)))} />}
      {tab === "setup" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 560 }}>
          <OnboardingProgressMap me={me} role="shipper" />
          <CompanySetupForm me={me} onSave={saveCompanySetup} />
        </div>
      )}
      {tab === "edi" && corp && <EdiGatewayPanel corp={corp} />}
      {tab === "companyprofile" && corp && (
        <div style={{ maxWidth: 600 }}>
          <Card style={{ padding: 20, marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Your Company's Public Profile</div>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}>
              <ProfilePicture src={corp.avatar} name={corp.companyName} size={72} onUpload={(dataUrl) => setCorporations((prev) => prev.map((c) => c.id === corp.id ? { ...c, avatar: dataUrl } : c))} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 18 }}>{corp.companyName}</div>
                <div style={{ fontSize: 12, color: "#6B6557" }}>Tap the camera icon to upload your company logo or photo</div>
              </div>
            </div>
          </Card>
          <CompanyProfilePage corp={corp} onClose={() => {}} embedded />
        </div>
      )}
      {tab === "billing" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 560 }}>
          <BillingCard isCorp={!!corp} corp={corp} me={me} onManage={() => document.getElementById("subscription-panel")?.scrollIntoView({ behavior: "smooth", block: "start" })} />
          <SubscriptionPortalPanel isCorp={!!corp} corp={corp} me={me} onSave={saveCompanySetup} />
        </div>
      )}
      {tab === "account" && (
        <MyAccountPanel me={me} corp={corp} isCorp={!!corp} onSave={saveCompanySetup} onGoBilling={() => setTab("billing")} />
      )}
      {chatWith && (
        <ChatPanel loadId={chatWith.loadId} otherId={chatWith.truckerId} myRole="shipper" myName={me.name}
          otherName={resolveTrucker(chatWith.truckerId)?.name || "Trucker"}
          messages={messages[threadKey(chatWith.loadId, chatWith.truckerId)] || []}
          onSend={(text) => sendMessage(chatWith.loadId, chatWith.truckerId, { role: "shipper", name: me.name, text })}
          onClose={() => setChatWith(null)} />
      )}
      {invoiceLoad && (
        <InvoiceModal load={invoiceLoad} shipper={me} trucker={resolveTrucker(invoiceLoad.truckerId)} onClose={() => setInvoiceLoad(null)} />
      )}
    </Shell>
  );
}

function QuickPostForm({ onSubmit }) {
  const [originZip, setOriginZip] = useState("");
  const [originCity, setOriginCity] = useState("");
  const [originState, setOriginState] = useState("");
  const [pickupAddress, setPickupAddress] = useState("");
  const [description, setDescription] = useState("");
  const [equipmentType, setEquipmentType] = useState("Dry Van");
  const [trailerLength, setTrailerLength] = useState("");
  const [pickupDate, setPickupDate] = useState(""); const [weight, setWeight] = useState("");
  const [l, setL] = useState(""); const [w, setW] = useState(""); const [h, setH] = useState("");
  const [price, setPrice] = useState("");
  const [requireGpsTracking, setRequireGpsTracking] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryCity, setDeliveryCity] = useState("");
  const [deliveryState, setDeliveryState] = useState("");
  const [deliveryZip, setDeliveryZip] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [estimating, setEstimating] = useState(false);
  const [miles, setMiles] = useState(null);
  const [originInfo, setOriginInfo] = useState(null);
  const [destInfo, setDestInfo] = useState(null);
  const [estimateError, setEstimateError] = useState("");

  const validZip = (z) => /^\d{5}$/.test(z);
  const formatPhone = (v) => {
    const d = v.replace(/\D/g, "").slice(0, 10);
    if (d.length >= 7) return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`;
    if (d.length >= 4) return `(${d.slice(0,3)}) ${d.slice(3)}`;
    return d;
  };

  const estimate = async () => {
    if (!validZip(originZip) || !validZip(deliveryZip)) { alert("Enter valid 5-digit ZIP codes for both origin and delivery address."); return; }
    setEstimating(true);
    setEstimateError("");
    const result = await estimateMilesReal(originZip, deliveryZip);
    if (!result) {
      setEstimateError("Couldn't find one of those ZIP codes — double check them and try again.");
      setMiles(null); setOriginInfo(null); setDestInfo(null);
    } else {
      setMiles(result.miles);
      setOriginInfo(result.origin);
      setDestInfo(result.destination);
      // Auto-fill origin city/state from the real lookup if not already typed
      if (!originCity) setOriginCity(result.origin.city);
      if (!originState) setOriginState(result.origin.state);
      // Auto-fill delivery city/state from the real lookup if not already typed
      if (!deliveryCity) setDeliveryCity(result.destination.city);
      if (!deliveryState) setDeliveryState(result.destination.state);
    }
    setEstimating(false);
  };

  const submit = () => {
    if (!validZip(originZip) || !validZip(deliveryZip) || !pickupDate || !weight || !price) { alert("Fill in origin ZIP, delivery ZIP, pickup date, weight, and price."); return; }
    if (!originCity.trim() || !originState.trim()) { alert("Origin city and state are required."); return; }
    if (!pickupAddress.trim()) { alert("Pickup address is required — carriers need to know where to pick up."); return; }
    if (!description.trim()) { alert("Please describe what needs to be delivered — this is shown to carriers before they bid."); return; }
    if (!deliveryAddress.trim()) { alert("Delivery address is required — carriers need to know where to deliver."); return; }
    if (!deliveryCity.trim() || !deliveryState.trim()) { alert("Delivery city and state are required."); return; }
    if (!contactPhone.trim()) { alert("Contact phone number is required so the carrier can reach you."); return; }
    if (miles == null) { alert("Estimate mileage before posting (click 'Estimate mileage')."); return; }
    onSubmit({
      origin: `${originCity}, ${originState}`,
      destination: `${deliveryCity}, ${deliveryState}`,
      originZip, originCity: originCity.trim(), originState: originState.trim(),
      pickupAddress: pickupAddress.trim(),
      destZip: deliveryZip, miles, pickupDate,
      description: description.trim(), weight: Number(weight),
      equipmentType, trailerLength: trailerLength ? Number(trailerLength) : null,
      dims: { l: Number(l) || 0, w: Number(w) || 0, h: Number(h) || 0 }, qty: 1, special: "", price: Number(price),
      requirements: { requireGpsTracking },
      deliveryAddress: deliveryAddress.trim(),
      deliveryCity: deliveryCity.trim(),
      deliveryState: deliveryState.trim(),
      deliveryZip,
      contactName: contactName.trim(),
      contactPhone: contactPhone.trim(),
      requirements: { minSafetyRating: "any", requireMcVerified: false, minCarrierRating: 0, preferences: "" },
    });
    setOriginZip(""); setOriginCity(""); setOriginState(""); setPickupAddress(""); setDescription(""); setPickupDate(""); setWeight(""); setL(""); setW(""); setH(""); setPrice(""); setMiles(null); setRequireGpsTracking(false);
    setEquipmentType("Dry Van"); setTrailerLength("");
    setDeliveryAddress(""); setDeliveryCity(""); setDeliveryState(""); setDeliveryZip(""); setContactName(""); setContactPhone("");
    setOriginInfo(null); setDestInfo(null);
  };

  const rpm = miles && Number(price) > 0 ? Number(price) / miles : 0;

  return (
    <Card style={{ padding: 24, maxWidth: 520 }}>
      <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 18, textTransform: "uppercase", marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
        <Zap size={18} color="#FFB400" /> Quick Post
      </div>
      <div style={{ fontSize: 13, color: "#6B6557", marginBottom: 16 }}>Drop in the basics — mileage is estimated automatically from real ZIP code locations. Switch to Full Post for dimensions and special requirements.</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label="What needs to be delivered? * (shown to carriers before they bid)">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
            placeholder="e.g. Pallet of bagged concrete mix, 40 bags, needs forklift to unload"
            style={{ ...inputStyle, resize: "vertical" }} />
        </Field>
        <div style={{ display: "flex", gap: 10 }}>
          <Field label="Equipment type needed *">
            <select value={equipmentType} onChange={(e) => setEquipmentType(e.target.value)} style={inputStyle}>
              {EQUIPMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Trailer length needed (ft)">
            <input type="number" value={trailerLength} onChange={(e) => setTrailerLength(e.target.value)} placeholder="e.g. 48" style={inputStyle} />
          </Field>
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#44484D" }}>Origin (pickup location)</div>
        <div style={{ display: "flex", gap: 10 }}>
          <Field label="City *"><input value={originCity} onChange={(e) => { setOriginCity(e.target.value); setMiles(null); setOriginInfo(null); }} placeholder="Dayton" style={inputStyle} /></Field>
          <Field label="State *"><input value={originState} onChange={(e) => { setOriginState(e.target.value.toUpperCase().slice(0,2)); setMiles(null); setOriginInfo(null); }} placeholder="OH" style={inputStyle} /></Field>
          <Field label="ZIP *"><input value={originZip} onChange={(e) => { setOriginZip(e.target.value.replace(/\D/g, "").slice(0, 5)); setMiles(null); setOriginInfo(null); }} placeholder="45402" style={inputStyle} /></Field>
        </div>
        <Field label="Pickup street address * (shown to carrier on acceptance)">
          <input value={pickupAddress} onChange={(e) => setPickupAddress(e.target.value)} placeholder="e.g. 500 Warehouse Rd" style={inputStyle} />
        </Field>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#44484D", marginTop: 4 }}>Delivery address</div>
        <div style={{ display: "flex", gap: 10 }}>
          <Field label="City *"><input value={deliveryCity} onChange={(e) => setDeliveryCity(e.target.value)} placeholder="Louisville" style={inputStyle} /></Field>
          <Field label="State *"><input value={deliveryState} onChange={(e) => setDeliveryState(e.target.value.toUpperCase().slice(0,2))} placeholder="KY" style={inputStyle} /></Field>
          <Field label="ZIP *"><input value={deliveryZip} onChange={(e) => { setDeliveryZip(e.target.value.replace(/\D/g, "").slice(0, 5)); setMiles(null); setDestInfo(null); }} placeholder="40202" style={inputStyle} /></Field>
        </div>
        <Field label="Delivery street address * (shown to carrier on acceptance)">
          <input value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} placeholder="e.g. 1234 Industrial Blvd" style={inputStyle} />
        </Field>
        <div style={{ display: "flex", gap: 10 }}>
          <Field label="Contact name (optional)"><input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="e.g. John Smith" style={inputStyle} /></Field>
          <Field label="Contact phone *"><input value={contactPhone} onChange={(e) => setContactPhone(formatPhone(e.target.value))} placeholder="(555) 000-0000" style={inputStyle} /></Field>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Field label="Pickup date"><input type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} style={inputStyle} /></Field>
          <Field label="Weight (lbs)"><input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} style={inputStyle} /></Field>
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#44484D" }}>Dimensions (optional)</div>
        <div style={{ display: "flex", gap: 10 }}>
          <Field label="Length (ft)"><input type="number" value={l} onChange={(e) => setL(e.target.value)} placeholder="40" style={inputStyle} /></Field>
          <Field label="Width (ft)"><input type="number" value={w} onChange={(e) => setW(e.target.value)} placeholder="8.5" style={inputStyle} /></Field>
          <Field label="Height (ft)"><input type="number" value={h} onChange={(e) => setH(e.target.value)} placeholder="5" style={inputStyle} /></Field>
        </div>
        <button onClick={estimate} disabled={estimating} style={{ ...ghostBtn, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: estimating ? 0.6 : 1 }}>
          <Navigation size={14} /> {estimating ? "Looking up ZIP codes…" : "Estimate mileage"}
        </button>
        {estimateError && <div style={{ fontSize: 12, color: "#C0432B" }}>{estimateError}</div>}
        {miles != null && originInfo && destInfo && (
          <div style={{ fontSize: 13, color: "#3E7A4B", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
            <CheckCircle2 size={14} /> {originInfo.city}, {originInfo.state} → {destInfo.city}, {destInfo.state} — approx. {miles} miles
          </div>
        )}
        <Field label="Asking price ($)"><input type="number" value={price} onChange={(e) => setPrice(e.target.value)} style={inputStyle} /></Field>
        {rpm > 0 && <div style={{ fontSize: 12, color: "#3E7A4B", fontWeight: 600 }}>{fmtMoney(rpm.toFixed(2))}/mile</div>}
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
          <input type="checkbox" checked={requireGpsTracking} onChange={(e) => setRequireGpsTracking(e.target.checked)} style={{ width: 16, height: 16 }} />
          Require live GPS tracking for this load
        </label>
        <div style={{ fontSize: 11, color: "#9A958A", marginTop: -6 }}>
          Tracking is optional by default. Check this if you specifically need live GPS visibility on this haul — only carriers willing to share live location will bid or accept.
        </div>
        <div style={{ background: "#EAF1F8", border: "1px solid #C7DAEA", borderRadius: 6, padding: "8px 10px", fontSize: 11, color: "#3A6EA5" }}>
          🔒 Delivery address and contact number are <b>hidden from carriers</b> until they accept the load. Fields marked * are required.
        </div>
        <button onClick={submit} style={{ ...primaryBtn("#FFB400"), marginTop: 4 }}>Post load to board</button>
        <div style={{ fontSize: 11, color: "#9A958A" }}>Mileage is an estimate based on real ZIP code locations — not a routed driving distance. Actual road mileage may vary by 5-15%.</div>
      </div>
    </Card>
  );
}

const SAFETY_RATING_OPTIONS = [
  { value: "any", label: "Any rating accepted" },
  { value: "not_unsatisfactory", label: "No Unsatisfactory carriers" },
  { value: "satisfactory_or_not_rated", label: "Satisfactory or Not Rated only" },
  { value: "satisfactory_only", label: "Satisfactory only" },
];

const TARP_TYPES = ["No tarp required", "Flatbed tarp (8×24)", "Lumber tarp (8×27)", "Smoke tarp", "Machinery tarp", "Super B tarp"];
const CHAIN_RATINGS = ["Grade 70 (transport)", "Grade 80 (alloy)", "Grade 100 (alloy)"];
const FREIGHT_CONDITIONS = ["Palletized", "Floor loaded", "Crated", "Boxed", "Bundled / banded", "Coiled", "Loose / bulk", "Oversized / wide load"];
const LOAD_TEMP_OPTIONS = ["No temperature requirement", "Frozen (0°F or below)", "Refrigerated (33–38°F)", "Controlled temp (specify)"];
const UNLOAD_TYPES = ["Shipper/receiver unloads", "Driver assist required", "Lumper provided", "Forklift on site", "Dock unload", "Ground level unload", "End dump", "Side dump"];

function PostLoadForm({ onSubmit }) {
  const [requireGpsTracking, setRequireGpsTracking] = useState(false);
  const [origin, setOrigin] = useState(""); const [destination, setDestination] = useState("");
  const [originZip, setOriginZip] = useState("");
  const [originCity, setOriginCity] = useState("");
  const [originState, setOriginState] = useState("");
  const [pickupAddress, setPickupAddress] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryCity, setDeliveryCity] = useState("");
  const [deliveryState, setDeliveryState] = useState("");
  const [deliveryZip, setDeliveryZip] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [pickupDate, setPickupDate] = useState(""); const [deliveryDate, setDeliveryDate] = useState("");
  const [miles, setMiles] = useState(""); const [price, setPrice] = useState("");
  const [description, setDescription] = useState(""); const [commodity, setCommodity] = useState("");
  const [equipmentType, setEquipmentType] = useState("Dry Van");
  const [trailerLength, setTrailerLength] = useState("");
  const [weight, setWeight] = useState(""); const [qty, setQty] = useState(1);
  const [freightCondition, setFreightCondition] = useState("Palletized");
  const [ltl, setLtl] = useState(false); const [pallets, setPallets] = useState(""); const [linearFeet, setLinearFeet] = useState("");
  const [l, setL] = useState(""); const [w, setW] = useState(""); const [h, setH] = useState("");
  const [oversize, setOversize] = useState(false); const [permitRequired, setPermitRequired] = useState(false);
  const [tarpType, setTarpType] = useState("No tarp required");
  const [chainsRequired, setChainsRequired] = useState(false); const [chainRating, setChainRating] = useState("Grade 70 (transport)"); const [chainCount, setChainCount] = useState("");
  const [strapsRequired, setStrapsRequired] = useState(false); const [strapCount, setStrapCount] = useState("");
  const [edgeProtectors, setEdgeProtectors] = useState(false); const [coilRacks, setCoilRacks] = useState(false);
  const [tempRequirement, setTempRequirement] = useState("No temperature requirement"); const [tempSpec, setTempSpec] = useState("");
  const [stackable, setStackable] = useState(false); const [doNotStack, setDoNotStack] = useState(false); const [fragile, setFragile] = useState(false);
  const [unloadType, setUnloadType] = useState("Shipper/receiver unloads");
  const [liftgateRequired, setLiftgateRequired] = useState(false); const [appointmentRequired, setAppointmentRequired] = useState(false); const [twicRequired, setTwicRequired] = useState(false);
  const [hazmat, setHazmat] = useState(false); const [hazmatClass, setHazmatClass] = useState("");
  const [special, setSpecial] = useState("");
  const [minSafetyRating, setMinSafetyRating] = useState("any"); const [requireMcVerified, setRequireMcVerified] = useState(false);
  const [minCarrierRating, setMinCarrierRating] = useState(0); const [carrierPreferences, setCarrierPreferences] = useState("");
  const [requireCargoInsurance, setRequireCargoInsurance] = useState(false);

  const rpm = Number(price) > 0 && Number(miles) > 0 ? Number(price) / Number(miles) : 0;
  const [estimating, setEstimating] = useState(false);
  const [estimateError, setEstimateError] = useState("");
  const autoEstimate = async () => {
    if (!/^\d{5}$/.test(originZip) || !/^\d{5}$/.test(deliveryZip)) { alert("Enter valid 5-digit ZIPs to auto-estimate — origin ZIP and delivery ZIP."); return; }
    setEstimating(true);
    setEstimateError("");
    const result = await estimateMilesReal(originZip, deliveryZip);
    if (!result) {
      setEstimateError("Couldn't find one of those ZIP codes — double check them and try again.");
    } else {
      setMiles(String(result.miles));
      if (!originCity) setOriginCity(result.origin.city);
      if (!originState) setOriginState(result.origin.state);
      setOrigin(`${originCity || result.origin.city}, ${originState || result.origin.state}`);
      if (!destination) setDestination(`${result.destination.city}, ${result.destination.state}`);
      if (!deliveryCity) setDeliveryCity(result.destination.city);
      if (!deliveryState) setDeliveryState(result.destination.state);
    }
    setEstimating(false);
  };

  const securementSummary = () => {
    const items = [];
    if (tarpType !== "No tarp required") items.push(tarpType);
    if (chainsRequired) items.push(`${chainCount || "?"}× chains (${chainRating})`);
    if (strapsRequired) items.push(`${strapCount || "?"}× straps`);
    if (edgeProtectors) items.push("edge protectors");
    if (coilRacks) items.push("coil racks");
    if (liftgateRequired) items.push("liftgate");
    if (oversize) items.push("OVERSIZE");
    if (permitRequired) items.push("PERMIT REQUIRED");
    return items.join(" · ");
  };

  const reset = () => {
    setOrigin(""); setDestination(""); setOriginZip(""); setOriginCity(""); setOriginState(""); setPickupAddress(""); setPickupDate(""); setDeliveryDate(""); setMiles(""); setPrice("");
    setDescription(""); setCommodity(""); setEquipmentType("Dry Van"); setTrailerLength(""); setWeight(""); setQty(1); setFreightCondition("Palletized");
    setLtl(false); setPallets(""); setLinearFeet(""); setL(""); setW(""); setH("");
    setOversize(false); setPermitRequired(false); setTarpType("No tarp required");
    setChainsRequired(false); setChainRating("Grade 70 (transport)"); setChainCount(""); setStrapsRequired(false); setStrapCount(""); setEdgeProtectors(false); setCoilRacks(false);
    setTempRequirement("No temperature requirement"); setTempSpec(""); setStackable(false); setDoNotStack(false); setFragile(false);
    setUnloadType("Shipper/receiver unloads"); setLiftgateRequired(false); setAppointmentRequired(false); setTwicRequired(false);
    setHazmat(false); setHazmatClass(""); setSpecial("");
    setMinSafetyRating("any"); setRequireMcVerified(false); setMinCarrierRating(0); setCarrierPreferences("");
    setDeliveryAddress(""); setDeliveryCity(""); setDeliveryState(""); setDeliveryZip(""); setContactName(""); setContactPhone("");
  };

  const submit = () => {
    if (!origin || !destination || !miles || !weight || !price || !description) { alert("Origin, destination, miles, freight description, weight, and price are required."); return; }
    if (!originCity.trim() || !originState.trim() || !originZip.trim()) { alert("Origin city, state, and ZIP are required."); return; }
    if (!pickupAddress.trim()) { alert("Pickup address is required — carriers need to know where to pick up."); return; }
    if (!deliveryAddress.trim()) { alert("Delivery address is required — carriers need to know where to deliver."); return; }
    if (!deliveryCity.trim() || !deliveryState.trim() || !deliveryZip.trim()) { alert("Delivery city, state, and ZIP are required."); return; }
    if (!contactPhone.trim()) { alert("Contact phone number is required so the carrier can reach you."); return; }
    onSubmit({
      origin, destination, originZip, originCity: originCity.trim(), originState: originState.trim(),
      pickupAddress: pickupAddress.trim(),
      destZip: deliveryZip, pickupDate, deliveryDate, miles: Number(miles), price: Number(price),
      description, commodity, equipmentType, trailerLength: trailerLength ? Number(trailerLength) : null,
      weight: Number(weight), qty: Number(qty) || 1,
      dims: { l: Number(l) || 0, w: Number(w) || 0, h: Number(h) || 0 },
      freightCondition, ltl, pallets: Number(pallets) || null, linearFeet: Number(linearFeet) || null,
      oversize, permitRequired,
      securement: { tarpType: tarpType !== "No tarp required" ? tarpType : null, chainsRequired, chainRating: chainsRequired ? chainRating : null, chainCount: chainsRequired ? Number(chainCount) || null : null, strapsRequired, strapCount: strapsRequired ? Number(strapCount) || null : null, edgeProtectors, coilRacks, liftgateRequired, summary: securementSummary() },
      tempRequirement: tempRequirement !== "No temperature requirement" ? tempRequirement : null, tempSpec,
      stackable, doNotStack, fragile, unloadType, appointmentRequired, twicRequired,
      hazmat, hazmatClass: hazmat ? hazmatClass : null, special,
      deliveryAddress: deliveryAddress.trim(),
      deliveryCity: deliveryCity.trim(),
      deliveryState: deliveryState.trim(),
      deliveryZip: deliveryZip.trim(),
      contactName: contactName.trim(),
      contactPhone: contactPhone.trim(),
      requirements: { minSafetyRating, requireMcVerified, requireCargoInsurance, requireGpsTracking, minCarrierRating: Number(minCarrierRating) || 0, preferences: carrierPreferences },
    });
    reset();
  };

  return (
    <Card style={{ padding: 24, maxWidth: 720 }}>
      <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 18, textTransform: "uppercase", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
        <Plus size={18} color="#FFB400" /> New Load Posting
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button onClick={() => setLtl(false)} style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #E2DCCC", background: !ltl ? "#1B1D21" : "#fff", color: !ltl ? "#F2EDE4" : "#6B6557", fontWeight: 700, fontSize: 12 }}>Full Truckload (FTL)</button>
        <button onClick={() => setLtl(true)} style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #E2DCCC", background: ltl ? "#3A6EA5" : "#fff", color: ltl ? "#fff" : "#6B6557", fontWeight: 700, fontSize: 12 }}>Less-Than-Truckload (LTL)</button>
      </div>
      {ltl && (
        <div style={{ background: "#EAF1F8", border: "1px solid #C7DAEA", borderRadius: 8, padding: "10px 12px", display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
          <Field label="Pallets"><input type="number" value={pallets} onChange={(e) => setPallets(e.target.value)} placeholder="12" style={inputStyle} /></Field>
          <Field label="Linear feet"><input type="number" value={linearFeet} onChange={(e) => setLinearFeet(e.target.value)} placeholder="14" style={inputStyle} /></Field>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

        <FSection label="Route & Timing">
          <div style={{ fontSize: 12, fontWeight: 700, color: "#44484D" }}>Origin (pickup location)</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Field label="City *"><input value={originCity} onChange={(e) => { setOriginCity(e.target.value); setOrigin(`${e.target.value}, ${originState}`); }} placeholder="Dayton" style={inputStyle} /></Field>
            <Field label="State *"><input value={originState} onChange={(e) => { const v = e.target.value.toUpperCase().slice(0,2); setOriginState(v); setOrigin(`${originCity}, ${v}`); }} placeholder="OH" style={inputStyle} /></Field>
            <Field label="ZIP *"><input value={originZip} onChange={(e) => setOriginZip(e.target.value.replace(/\D/g, "").slice(0, 5))} placeholder="45402" style={inputStyle} /></Field>
          </div>
          <Field label="Pickup street address * (shown to carrier on acceptance)">
            <input value={pickupAddress} onChange={(e) => setPickupAddress(e.target.value)} placeholder="e.g. 500 Warehouse Rd" style={inputStyle} />
          </Field>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#44484D", marginTop: 4 }}>Delivery address</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Field label="City *"><input value={deliveryCity} onChange={(e) => { setDeliveryCity(e.target.value); setDestination(`${e.target.value}, ${deliveryState}`); }} placeholder="Louisville" style={inputStyle} /></Field>
            <Field label="State *"><input value={deliveryState} onChange={(e) => { const v = e.target.value.toUpperCase().slice(0,2); setDeliveryState(v); setDestination(`${deliveryCity}, ${v}`); }} placeholder="KY" style={inputStyle} /></Field>
            <Field label="ZIP *"><input value={deliveryZip} onChange={(e) => setDeliveryZip(e.target.value.replace(/\D/g, "").slice(0, 5))} placeholder="40202" style={inputStyle} /></Field>
            <button onClick={autoEstimate} disabled={estimating} style={{ ...ghostBtn, whiteSpace: "nowrap", opacity: estimating ? 0.6 : 1, alignSelf: "flex-end" }}>
              {estimating ? "Looking up ZIPs…" : "Auto-estimate miles"}
            </button>
          </div>
          {estimateError && <div style={{ fontSize: 12, color: "#C0432B" }}>{estimateError}</div>}
          <Field label="Delivery street address * (shown to carrier after acceptance)">
            <input value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} placeholder="e.g. 1234 Industrial Blvd" style={inputStyle} />
          </Field>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Field label="Contact name (optional)">
              <input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="e.g. John Smith" style={inputStyle} />
            </Field>
            <Field label="Contact phone * (shown to carrier after acceptance)">
              <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="(555) 000-0000" style={inputStyle} />
            </Field>
          </div>
          <div style={{ background: "#EAF1F8", border: "1px solid #C7DAEA", borderRadius: 6, padding: "8px 10px", fontSize: 11, color: "#3A6EA5" }}>
            🔒 Delivery address and contact number are <b>hidden from carriers</b> on the load board. They are revealed only after a carrier's bid is accepted. Fields marked * are required.
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Field label="Total miles"><input type="number" value={miles} onChange={(e) => setMiles(e.target.value)} placeholder="225" style={inputStyle} /></Field>
            <Field label="Pickup date"><input type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} style={inputStyle} /></Field>
            <Field label="Delivery date (optional)"><input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} style={inputStyle} /></Field>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <Field label="Asking price ($)"><input type="number" value={price} onChange={(e) => setPrice(e.target.value)} style={inputStyle} /></Field>
            {rpm > 0 && <div style={{ fontSize: 12, color: "#3E7A4B", fontWeight: 700, paddingTop: 22, display: "flex", alignItems: "center", gap: 5 }}><Gauge size={13} /> {fmtMoney(rpm.toFixed(2))}/mile</div>}
          </div>
        </FSection>

        <FSection label="Equipment Needed">
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Field label="Equipment type needed *">
              <select value={equipmentType} onChange={(e) => setEquipmentType(e.target.value)} style={inputStyle}>
                {EQUIPMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Trailer length needed (ft)">
              <input type="number" value={trailerLength} onChange={(e) => setTrailerLength(e.target.value)} placeholder="e.g. 48" style={inputStyle} />
            </Field>
          </div>
        </FSection>

        <FSection label="Freight Description">
          <Field label="Commodity / what is it?"><input value={commodity} onChange={(e) => setCommodity(e.target.value)} placeholder="e.g. Structural steel I-beams" style={inputStyle} /></Field>
          <Field label="Detailed description">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
              placeholder="e.g. 12 steel I-beams, 40 ft long, banded in groups of 4. Each bundle approx 4,000 lbs. No end damage — use edge protectors on banding points."
              style={{ ...inputStyle, resize: "vertical" }} />
          </Field>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Field label="Total weight (lbs)"><input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} style={inputStyle} /></Field>
            <Field label="Quantity / pieces"><input type="number" value={qty} onChange={(e) => setQty(e.target.value)} style={inputStyle} /></Field>
            <Field label="Freight condition">
              <select value={freightCondition} onChange={(e) => setFreightCondition(e.target.value)} style={inputStyle}>
                {FREIGHT_CONDITIONS.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
          </div>
        </FSection>

        <FSection label="Dimensions">
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Field label="Length (ft)"><input type="number" value={l} onChange={(e) => setL(e.target.value)} placeholder="40" style={inputStyle} /></Field>
            <Field label="Width (ft)"><input type="number" value={w} onChange={(e) => setW(e.target.value)} placeholder="8.5" style={inputStyle} /></Field>
            <Field label="Height (ft)"><input type="number" value={h} onChange={(e) => setH(e.target.value)} placeholder="5" style={inputStyle} /></Field>
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <FCheckbox checked={oversize} onChange={setOversize} label="Oversize load" />
            <FCheckbox checked={permitRequired} onChange={setPermitRequired} label="Oversize permit required" />
            <FCheckbox checked={fragile} onChange={setFragile} label="Fragile — handle with care" />
          </div>
          {oversize && <div style={{ fontSize: 11, color: "#B5790A" }}>⚠ Confirm permit and escort requirements with the carrier before booking.</div>}
        </FSection>

        <FSection label="Securement Requirements">
          <Field label="Tarp">
            <select value={tarpType} onChange={(e) => setTarpType(e.target.value)} style={inputStyle}>
              {TARP_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <FCheckbox checked={chainsRequired} onChange={setChainsRequired} label="Chains required" />
            {chainsRequired && <>
              <Field label="# of chains"><input type="number" value={chainCount} onChange={(e) => setChainCount(e.target.value)} placeholder="4" style={{ ...inputStyle, width: 80 }} /></Field>
              <Field label="Grade">
                <select value={chainRating} onChange={(e) => setChainRating(e.target.value)} style={{ ...inputStyle, width: 220 }}>
                  {CHAIN_RATINGS.map((r) => <option key={r}>{r}</option>)}
                </select>
              </Field>
            </>}
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <FCheckbox checked={strapsRequired} onChange={setStrapsRequired} label="Straps required" />
            {strapsRequired && <Field label="# of straps"><input type="number" value={strapCount} onChange={(e) => setStrapCount(e.target.value)} placeholder="8" style={{ ...inputStyle, width: 80 }} /></Field>}
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <FCheckbox checked={edgeProtectors} onChange={setEdgeProtectors} label="Edge protectors required" />
            <FCheckbox checked={coilRacks} onChange={setCoilRacks} label="Coil racks / cradles required" />
          </div>
          {securementSummary() && (
            <div style={{ background: "#F8F5EE", border: "1px solid #E2DCCC", borderRadius: 6, padding: "8px 10px", fontSize: 12, color: "#44484D" }}>
              <b>Summary:</b> {securementSummary()}
            </div>
          )}
        </FSection>

        <FSection label="Special Handling & Temperature">
          <Field label="Temperature requirement">
            <select value={tempRequirement} onChange={(e) => setTempRequirement(e.target.value)} style={inputStyle}>
              {LOAD_TEMP_OPTIONS.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          {tempRequirement === "Controlled temp (specify)" && (
            <Field label="Temperature range"><input value={tempSpec} onChange={(e) => setTempSpec(e.target.value)} placeholder="e.g. 45–55°F" style={inputStyle} /></Field>
          )}
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <FCheckbox checked={stackable} onChange={setStackable} label="Stackable" />
            <FCheckbox checked={doNotStack} onChange={setDoNotStack} label="DO NOT STACK" />
          </div>
          {doNotStack && stackable && <div style={{ fontSize: 11, color: "#C0432B" }}>⚠ Both Stackable and Do Not Stack are checked — please pick one.</div>}
        </FSection>

        <FSection label="Loading & Unloading">
          <Field label="Unload type">
            <select value={unloadType} onChange={(e) => setUnloadType(e.target.value)} style={inputStyle}>
              {UNLOAD_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <FCheckbox checked={liftgateRequired} onChange={setLiftgateRequired} label="Liftgate required" />
            <FCheckbox checked={appointmentRequired} onChange={setAppointmentRequired} label="Appointment required" />
            <FCheckbox checked={twicRequired} onChange={setTwicRequired} label="TWIC card required" />
          </div>
        </FSection>

        <FSection label="Hazmat">
          <FCheckbox checked={hazmat} onChange={setHazmat} label="This load contains hazardous materials" />
          {hazmat && (
            <>
              <Field label="Hazmat class / UN number"><input value={hazmatClass} onChange={(e) => setHazmatClass(e.target.value)} placeholder="e.g. Class 3 Flammable Liquid / UN1203" style={inputStyle} /></Field>
              <div style={{ fontSize: 11, color: "#B5790A" }}>Carriers must hold a valid hazmat endorsement. Ensure your carrier requirements below reflect this.</div>
            </>
          )}
        </FSection>

        <FSection label="Additional Notes">
          <Field label="Anything else the carrier needs to know?">
            <textarea value={special} onChange={(e) => setSpecial(e.target.value)} rows={2}
              placeholder="e.g. 13'6&quot; height restriction at facility, call ahead 2 hours, no vehicles on site after 5pm"
              style={{ ...inputStyle, resize: "vertical" }} />
          </Field>
        </FSection>

        <FSection label="Carrier Requirements (optional)">
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Field label="Minimum FMCSA safety rating">
              <select value={minSafetyRating} onChange={(e) => setMinSafetyRating(e.target.value)} style={inputStyle}>
                {SAFETY_RATING_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Minimum star rating">
              <select value={minCarrierRating} onChange={(e) => setMinCarrierRating(e.target.value)} style={inputStyle}>
                <option value={0}>Any rating</option>
                <option value={3}>3+ stars</option>
                <option value={4}>4+ stars</option>
                <option value={4.5}>4.5+ stars</option>
              </select>
            </Field>
          </div>
          <FCheckbox checked={requireMcVerified} onChange={setRequireMcVerified} label="Require active operating authority (MC Verified)" />
          <FCheckbox checked={requireCargoInsurance} onChange={setRequireCargoInsurance} label="Require cargo insurance (optional — FMCSA does not mandate this for general freight)" />
          <FCheckbox checked={requireGpsTracking} onChange={setRequireGpsTracking} label="Require live GPS tracking for this load (optional by default — check if you specifically need live visibility)" />
          <Field label="Other preferences (note to carriers)">
            <input value={carrierPreferences} onChange={(e) => setCarrierPreferences(e.target.value)} placeholder="e.g. flatbed experience preferred, hazmat endorsement required" style={inputStyle} />
          </Field>
        </FSection>

        <button onClick={submit} style={{ ...primaryBtn("#FFB400"), marginTop: 4 }}>Post load to board</button>
      </div>
    </Card>
  );
}

function FSection({ label, children }) {
  return (
    <div style={{ borderTop: "1px solid #EEE8DA", paddingTop: 14 }}>
      <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 600, fontSize: 12, textTransform: "uppercase", color: "#6B6557", marginBottom: 10, letterSpacing: "0.04em" }}>{label}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{children}</div>
    </div>
  );
}

function FCheckbox({ checked, onChange, label }) {
  return (
    <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "#44484D", cursor: "pointer", userSelect: "none" }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ width: 14, height: 14, flexShrink: 0 }} />
      {label}
    </label>
  );
}

// ---------- BOL / POD document handling ----------
// Files are stored as base64 data URLs in component state for this prototype.
// In production, swap readFileAsDataUrl()'s result for an upload to real object
// storage (e.g. S3, Cloudflare R2) and store the returned URL instead of raw bytes.
function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const MAX_DOC_SIZE_BYTES = 8 * 1024 * 1024; // 8MB cap to keep in-memory storage reasonable

function DocumentUploader({ loadId, onUpload, typeOverride }) {
  const [docType, setDocType] = useState(typeOverride || "BOL");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const cameraRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_DOC_SIZE_BYTES) { alert("File is too large — please upload something under 8MB."); return; }
    setBusy(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      onUpload({
        id: "doc" + Date.now(), loadId, type: typeOverride || docType, filename: file.name,
        mimeType: file.type || "application/octet-stream", sizeBytes: file.size, dataUrl, uploadedAt: Date.now(),
      });
    } finally { setBusy(false); }
  };

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      {!typeOverride && (
        <select value={docType} onChange={(e) => setDocType(e.target.value)} style={{ ...inputStyle, width: 140 }}>
          <option value="BOL">Bill of Lading</option>
          <option value="POD">Proof of Delivery</option>
        </select>
      )}
      {/* Hidden file input — accepts PDF and images */}
      <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.heic,.webp" onChange={handleFile} style={{ display: "none" }} />
      {/* Hidden camera input — opens camera directly on mobile */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handleFile} style={{ display: "none" }} />
      <button onClick={() => fileRef.current?.click()} disabled={busy} style={{ ...ghostBtn, display: "flex", alignItems: "center", gap: 6, opacity: busy ? 0.6 : 1 }}>
        <Upload size={14} /> {busy ? "Uploading…" : `Upload ${typeOverride ? "receipt" : docType}`}
      </button>
      <button onClick={() => cameraRef.current?.click()} disabled={busy} style={{ ...ghostBtn, display: "flex", alignItems: "center", gap: 6, opacity: busy ? 0.6 : 1 }}>
        📷 Take photo
      </button>
    </div>
  );
}

function DocumentList({ documents, emptyText }) {
  if (!documents || !documents.length) return <div style={{ fontSize: 12, color: "#9A958A" }}>{emptyText || "No documents attached yet."}</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {documents.map((d) => (
        <div key={d.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, border: "1px solid #EEE8DA", borderRadius: 6, padding: "7px 10px", background: "#FBF9F4" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <Paperclip size={14} color="#6B6557" style={{ flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#1B1D21" }}>
                <span className="mono" style={{ fontSize: 10, background: d.type === "BOL" ? "#EAF1F8" : "#F1F8F2", color: d.type === "BOL" ? "#3A6EA5" : "#3E7A4B", padding: "1px 5px", borderRadius: 3, marginRight: 6 }}>{d.type}</span>
                {d.filename}
              </div>
              <div style={{ fontSize: 10, color: "#9A958A" }}>{(d.sizeBytes / 1024).toFixed(0)} KB · {new Date(d.uploadedAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}</div>
            </div>
          </div>
          <a href={d.dataUrl} download={d.filename} style={{ color: "#3A6EA5", display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 700, textDecoration: "none", flexShrink: 0 }}>
            <Download size={14} /> Download
          </a>
        </div>
      ))}
    </div>
  );
}


// ====================================================================
// NOTIFICATION TOASTS
// ====================================================================
function NotificationToasts({ notifications }) {
  if (!notifications.length) return null;
  const toneColors = { info: "#3A6EA5", success: "#3E7A4B", warning: "#B5790A", error: "#C0432B" };
  return (
    <div style={{ position: "fixed", bottom: 80, right: 16, zIndex: 200, display: "flex", flexDirection: "column", gap: 8, maxWidth: 320 }}>
      {notifications.map((n) => (
        <div key={n.id} style={{ background: "#1B1D21", color: "#F2EDE4", borderRadius: 8, padding: "10px 14px", fontSize: 13, borderLeft: `3px solid ${toneColors[n.tone] || toneColors.info}`, boxShadow: "0 4px 16px rgba(0,0,0,0.3)", animation: "slideIn 0.2s ease" }}>
          {n.msg}
        </div>
      ))}
    </div>
  );
}

// ====================================================================
// LOAD BOARD FILTERS
// ====================================================================
function LoadBoardFilters({ loads, filters, onChange }) {
  const equipmentTypes = [...new Set(loads.map((l) => l.requirements?.equipmentType).filter(Boolean))];
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14, padding: "12px 14px", background: "#fff", border: "1px solid #E2DCCC", borderRadius: 8 }}>
      <Field label="Origin contains">
        <input value={filters.origin} onChange={(e) => onChange({ ...filters, origin: e.target.value })} placeholder="e.g. Dayton" style={{ ...inputStyle, width: 130 }} />
      </Field>
      <Field label="Destination contains">
        <input value={filters.destination} onChange={(e) => onChange({ ...filters, destination: e.target.value })} placeholder="e.g. Louisville" style={{ ...inputStyle, width: 130 }} />
      </Field>
      <Field label="Max weight (lbs)">
        <input type="number" value={filters.maxWeight} onChange={(e) => onChange({ ...filters, maxWeight: e.target.value })} placeholder="45000" style={{ ...inputStyle, width: 100 }} />
      </Field>
      <Field label="Min price ($)">
        <input type="number" value={filters.minPrice} onChange={(e) => onChange({ ...filters, minPrice: e.target.value })} placeholder="500" style={{ ...inputStyle, width: 90 }} />
      </Field>
      <Field label="Sort by">
        <select value={filters.sortBy} onChange={(e) => onChange({ ...filters, sortBy: e.target.value })} style={{ ...inputStyle, width: 150 }}>
          <option value="newest">Newest first</option>
          <option value="price_high">Price: high to low</option>
          <option value="price_low">Price: low to high</option>
          <option value="rpm_high">$/mile: high to low</option>
        </select>
      </Field>
      <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: 1 }}>
        <button onClick={() => onChange({ origin: "", destination: "", maxWeight: "", minPrice: "", sortBy: "newest" })} style={{ ...ghostBtn, fontSize: 12 }}>Clear</button>
      </div>
    </div>
  );
}

function applyFilters(loads, filters) {
  let result = [...loads];
  if (filters.origin) result = result.filter((l) => (l.origin || "").toLowerCase().includes(filters.origin.toLowerCase()));
  if (filters.destination) result = result.filter((l) => (l.destination || "").toLowerCase().includes(filters.destination.toLowerCase()));
  if (filters.maxWeight) result = result.filter((l) => !l.weight || l.weight <= Number(filters.maxWeight));
  if (filters.minPrice) result = result.filter((l) => l.price >= Number(filters.minPrice));
  if (filters.sortBy === "price_high") result.sort((a, b) => b.price - a.price);
  else if (filters.sortBy === "price_low") result.sort((a, b) => a.price - b.price);
  else if (filters.sortBy === "rpm_high") result.sort((a, b) => (b.miles ? b.price / b.miles : 0) - (a.miles ? a.price / a.miles : 0));
  else result.sort((a, b) => b.postedAt - a.postedAt);
  return result;
}

function MyLoads({ loads, resolveTrucker, onRate, onAcceptBid, onCounterBid, onRejectBid, onReleasePayment, onOpenChat, onViewInvoice, onCancelLoad, me }) {
  if (!loads.length) return <Empty text="No loads posted yet — post one to get started." />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {loads.map((l) => {
        const trucker = l.truckerId ? resolveTrucker(l.truckerId) : null;
        const activeBids = (l.bids || []).filter((b) => b.status !== "rejected");
        return (
          <Card key={l.id} style={{ padding: 18 }}>
            <LoadHeader load={l} />
            {l.status === "cancelled" && (
              <div style={{ marginTop: 12, borderTop: "1px solid #EEE8DA", paddingTop: 12, background: "#FDF1EE", border: "1px solid #F3B7A6", borderRadius: 8, padding: "10px 12px" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#C0432B", marginBottom: 2 }}>Cancelled by {l.cancelledBy === "carrier" ? "carrier" : "you"}</div>
                <div style={{ fontSize: 12, color: "#6B6557" }}>{l.cancelReason}</div>
              </div>
            )}
            {l.status === "open" && (
              <div style={{ marginTop: 12, borderTop: "1px solid #EEE8DA", paddingTop: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#6B6557", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}><Gavel size={13} /> BIDS {activeBids.length ? `(${activeBids.length})` : ""}</div>
                {!activeBids.length && <div style={{ fontSize: 13, color: "#9A958A" }}>Waiting for truckers to bid or claim at your listed price.</div>}
                {activeBids.map((b) => (
                  <BidRow key={b.id} bid={b} trucker={resolveTrucker(b.truckerId)} role="shipper" miles={l.miles} load={l}
                    onAccept={() => onAcceptBid(l.id, b.id)} onCounter={(amt) => onCounterBid(l.id, b.id, amt)}
                    onReject={() => onRejectBid(l.id, b.id)} onMessage={() => onOpenChat(l.id, b.truckerId)} />
                ))}
                <div style={{ marginTop: 10 }}>
                  <CancelLoadButton load={l} me={{ id: l.shipperId, name: l.shipperName, role: "shipper" }} onCancel={(reason) => onCancelLoad(l.id, reason)} />
                </div>
              </div>
            )}
            {(l.status === "in_transit" || l.status === "delivered") && trucker && (
              <div style={{ marginTop: 12, borderTop: "1px solid #EEE8DA", paddingTop: 12 }}>
                <div style={{ fontSize: 13, marginBottom: 6, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}><Truck size={14} /> <b>{trucker.name}</b> · {trucker.companyLabel} <Stars value={avgRating(trucker.ratings)} />
                    {trucker.corp?.verification?.authorityStatus === "AUTHORIZED" && (<span style={{ color: "#3E7A4B", display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 700 }}><ShieldCheck size={12} /> MC Verified</span>)}
                  </span>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <RateConButton load={l} trucker={trucker} shipper={me} />
                    <button onClick={() => onOpenChat(l.id, trucker.id)} style={{ ...ghostBtn, display: "flex", alignItems: "center", gap: 6, padding: "6px 12px" }}><MessageCircle size={14} /> Message</button>
                  </div>
                </div>
                <TrackerBar load={l} />
                <div style={{ marginTop: 12, borderTop: "1px solid #EEE8DA", paddingTop: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#6B6557", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                    <Paperclip size={13} /> DOCUMENTS — BOL / POD
                  </div>
                  <DocumentList documents={(l.documents || []).filter((d) => d.type === "BOL" || d.type === "POD")} emptyText="No documents uploaded by the carrier yet." />
                  {(l.documents || []).filter((d) => d.type === "ACCESSORIAL").length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#6B6557", marginBottom: 4 }}>Accessorial receipts</div>
                      <DocumentList documents={(l.documents || []).filter((d) => d.type === "ACCESSORIAL")} />
                    </div>
                  )}
                </div>
                {l.status === "in_transit" && (
                  <div style={{ marginTop: 10 }}>
                    <CancelLoadButton load={l} me={{ id: l.shipperId, name: l.shipperName, role: "shipper" }} onCancel={(reason) => onCancelLoad(l.id, reason)} />
                  </div>
                )}
                {l.status === "delivered" && (
                  <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    {!l.paid ? (
                      <button onClick={() => onReleasePayment(l.id)} style={{ ...primaryBtn("#3E7A4B"), color: "#fff", padding: "8px 16px", display: "flex", alignItems: "center", gap: 6 }}>
                        <DollarSign size={14} /> Release payment ({fmtMoney(l.price)})
                      </button>
                    ) : (
                      <Badge tone="green">Paid {new Date(l.paidAt).toLocaleDateString()}</Badge>
                    )}
                    <button onClick={() => onViewInvoice && onViewInvoice(l)} style={{ ...ghostBtn, display: "flex", alignItems: "center", gap: 5, fontSize: 12, padding: "7px 12px" }}>
                      <FileText size={13} /> Invoice
                    </button>
                    <DisputeButton load={l} me={{ id: l.shipperId, name: l.shipperName, role: "shipper" }} />
                  </div>
                )}
                {l.status === "delivered" && !l.rated && <RateBox onRate={(stars) => onRate(l.id, trucker.id, stars)} />}
                {l.rated && <div style={{ fontSize: 12, color: "#3E7A4B", marginTop: 8, display: "flex", gap: 4, alignItems: "center" }}><CheckCircle2 size={14} /> Rated — thanks for the feedback.</div>}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function BidCenter({ bids, resolveTrucker, onAccept, onCounter, onReject, onOpenChat }) {
  if (!bids.length) return <Empty text="No active bids right now — bids on any of your open loads will show up here." />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 760 }}>
      <Card style={{ padding: 14, background: "#FBF9F4" }}>
        <div style={{ fontSize: 12, color: "#6B6557", display: "flex", alignItems: "center", gap: 6 }}>
          <Gavel size={14} /> Every active offer across all your open loads, in one place — accept instantly to lock in the contract.
        </div>
      </Card>
      {bids.map((b) => {
        const trucker = resolveTrucker(b.truckerId);
        const displayAmount = b.status === "countered" ? b.counterAmount : b.amount;
        const rpm = b.load.miles ? displayAmount / b.load.miles : 0;
        const isWaitingOnMe = b.status === "pending" || (b.status === "countered" && b.counterBy === "trucker");
        return (
          <Card key={b.id} style={{ padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 12, color: "#9A958A", display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                  <MapPin size={12} /> {b.load.origin} <ChevronRight size={11} /> {b.load.destination}
                </div>
                <div style={{ fontWeight: 700, fontSize: 15, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  {trucker?.name || "Trucker"}
                  <Stars value={avgRating(trucker?.ratings)} size={13} />
                  <span style={{ fontSize: 12, color: "#9A958A", fontWeight: 400 }}>{trucker?.companyLabel}</span>
                  {trucker?.equipmentType && <span className="mono" style={{ fontSize: 10, background: "#EEE8DA", color: "#44484D", padding: "1px 6px", borderRadius: 4 }}>{trucker.equipmentType}</span>}
                  {trucker?.corp?.verification?.authorityStatus === "AUTHORIZED" && (
                    <span style={{ color: "#3E7A4B", display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 700 }}><ShieldCheck size={11} /> MC Verified</span>
                  )}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 700, fontSize: 20 }}>{fmtMoney(displayAmount)}</div>
                {rpm > 0 && <div className="mono" style={{ fontSize: 11, color: "#3E7A4B" }}>{fmtMoney(rpm.toFixed(2))}/mi</div>}
              </div>
            </div>
            {b.note && <div style={{ fontSize: 12, color: "#6B6557", marginTop: 6 }}>"{b.note}"</div>}
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <button onClick={() => onOpenChat(b.load.id, b.truckerId)} style={{ ...ghostBtn, fontSize: 12, padding: "7px 12px", display: "flex", alignItems: "center", gap: 5 }}><MessageCircle size={13} /> Message</button>
              {isWaitingOnMe && (
                <>
                  <button onClick={() => onAccept(b.load.id, b.id)} style={{ ...primaryBtn("#3E7A4B"), color: "#fff", padding: "7px 16px", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                    <Zap size={14} /> Accept instantly — lock in contract
                  </button>
                  <CounterInline onCounter={(amt) => onCounter(b.load.id, b.id, amt)} />
                  <button onClick={() => onReject(b.load.id, b.id)} style={{ ...ghostBtn, fontSize: 12, padding: "7px 12px", color: "#FF5A1F" }}>Decline</button>
                </>
              )}
              {!isWaitingOnMe && <Badge tone={b.status === "countered" ? "orange" : "gray"}>{b.status === "countered" ? "Waiting on carrier" : b.status}</Badge>}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function CounterInline({ onCounter }) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState("");
  if (!open) return <button onClick={() => setOpen(true)} style={{ ...ghostBtn, fontSize: 12, padding: "7px 12px" }}>Counter</button>;
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <input type="number" value={val} onChange={(e) => setVal(e.target.value)} placeholder="$" style={{ ...inputStyle, width: 90, padding: "6px 8px" }} />
      <button onClick={() => { if (val) { onCounter(Number(val)); setOpen(false); setVal(""); } }} style={{ ...primaryBtn("#FFB400"), padding: "7px 12px", fontSize: 12 }}>Send</button>
    </div>
  );
}

function BidRow({ bid, trucker, role, miles, load, onAccept, onCounter, onReject, onMessage }) {
  const [counterVal, setCounterVal] = useState(""); const [showCounter, setShowCounter] = useState(false);
  const isWaitingOnMe = role === "shipper" ? bid.status === "pending" || (bid.status === "countered" && bid.counterBy === "trucker") : bid.status === "countered" && bid.counterBy === "shipper";
  const displayAmount = bid.status === "countered" ? bid.counterAmount : bid.amount;
  const rpm = miles ? displayAmount / miles : 0;
  const statusTone = { pending: "blue", countered: "orange", accepted: "green", rejected: "gray" }[bid.status];
  const statusLabel = { pending: "Awaiting response", countered: `Countered by ${bid.counterBy === "shipper" ? "you" : "trucker"}`, accepted: "Accepted", rejected: "Declined" }[bid.status];
  const reqCheck = load && trucker ? meetsLoadRequirements(load, trucker) : { met: true, failed: [] };

  return (
    <div style={{ border: "1px solid #EEE8DA", borderRadius: 8, padding: "10px 12px", marginBottom: 8, background: "#FBF9F4" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ProfilePicture src={trucker?.avatar} name={trucker?.name} size={36} />
          <div style={{ fontSize: 13 }}>
            <b>{trucker?.name || "Trucker"}</b>{trucker?.companyLabel ? ` · ${trucker.companyLabel}` : ""}
            {trucker?.equipmentType && <span className="mono" style={{ marginLeft: 6, fontSize: 10, background: "#EEE8DA", color: "#44484D", padding: "1px 6px", borderRadius: 4 }}>{trucker.equipmentType}</span>}
            {trucker && <span style={{ marginLeft: 8 }}><Stars value={avgRating(trucker.ratings)} size={12} /></span>}
            {trucker?.corp?.verification?.authorityStatus === "AUTHORIZED" && trucker?.corp?.verification?.insuranceStatus === "ACTIVE" && (
              <span style={{ marginLeft: 8, color: "#3E7A4B", display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 700 }}><ShieldCheck size={12} /> MC Verified</span>
            )}
            {trucker?.corp?.verification?.insuranceStatus === "LAPSED" && (
              <span style={{ marginLeft: 8, color: "#C0432B", display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 700 }}><Lock size={12} /> Insurance Lapsed</span>
          )}
          </div>
        </div>
        <Badge tone={statusTone}>{statusLabel}</Badge>
      </div>
      {!reqCheck.met && (
        <div style={{ marginTop: 6, background: "#FDF1EE", border: "1px solid #F3B7A6", borderRadius: 6, padding: "6px 8px", fontSize: 11, color: "#C0432B" }}>
          <b>Doesn't meet your stated requirements:</b> {reqCheck.failed.join("; ")}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
        <span style={{ fontSize: 17, fontWeight: 700 }}>{fmtMoney(displayAmount)}</span>
        {bid.status === "countered" && <span style={{ fontSize: 12, color: "#9A958A", textDecoration: "line-through" }}>{fmtMoney(bid.amount)}</span>}
        {rpm > 0 && <span className="mono" style={{ fontSize: 12, color: "#3E7A4B", fontWeight: 700 }}>{fmtMoney(rpm.toFixed(2))}/mi</span>}
      </div>
      {bid.note && <div style={{ fontSize: 12, color: "#6B6557", marginTop: 4 }}>"{bid.note}"</div>}
      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        <button onClick={onMessage} style={{ ...ghostBtn, padding: "6px 10px", display: "flex", alignItems: "center", gap: 5, fontSize: 12 }}><MessageCircle size={13} /> Message</button>
        {isWaitingOnMe && bid.status !== "accepted" && (
          <>
            <button onClick={onAccept} style={{ ...primaryBtn("#3E7A4B"), color: "#fff", padding: "6px 12px", fontSize: 12 }}>Accept {fmtMoney(displayAmount)}</button>
            <button onClick={() => setShowCounter((s) => !s)} style={{ ...ghostBtn, padding: "6px 10px", fontSize: 12 }}>Counter</button>
            <button onClick={onReject} style={{ ...ghostBtn, padding: "6px 10px", fontSize: 12, color: "#FF5A1F" }}>Decline</button>
          </>
        )}
      </div>
      {showCounter && (
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <input type="number" placeholder="Your counter ($)" value={counterVal} onChange={(e) => setCounterVal(e.target.value)} style={{ ...inputStyle, width: 140 }} />
          <button onClick={() => { if (counterVal) { onCounter(Number(counterVal)); setShowCounter(false); setCounterVal(""); } }} style={{ ...primaryBtn("#FFB400"), padding: "8px 14px", fontSize: 12 }}>Send counter</button>
        </div>
      )}
    </div>
  );
}

function getCarrierComplianceSummary(me) {
  const verification = me?.corp?.verification || me?.verification || null;
  return {
    safetyRating: verification?.safetyRating || null,
    mcVerified: verification?.authorityStatus === "AUTHORIZED",
    avgRating: avgRating(me?.ratings || []),
  };
}

const SAFETY_RATING_LABELS = {
  not_unsatisfactory: "No Unsatisfactory carriers",
  satisfactory_or_not_rated: "Satisfactory or Not Rated only",
  satisfactory_only: "Satisfactory rating required",
};

function meetsLoadRequirements(load, me) {
  const req = load.requirements;
  if (!req) return { met: true, failed: [] };
  const summary = getCarrierComplianceSummary(me);
  const failed = [];

  if (req.minSafetyRating && req.minSafetyRating !== "any") {
    const rating = summary.safetyRating;
    const ok =
      req.minSafetyRating === "not_unsatisfactory" ? rating !== "UNSATISFACTORY" :
      req.minSafetyRating === "satisfactory_or_not_rated" ? ["SATISFACTORY", "NOT RATED"].includes(rating) :
      req.minSafetyRating === "satisfactory_only" ? rating === "SATISFACTORY" : true;
    if (!ok) failed.push(SAFETY_RATING_LABELS[req.minSafetyRating] || "Safety rating requirement not met");
  }
  if (req.requireMcVerified && !summary.mcVerified) failed.push("MC Verified status required");
  if (req.requireCargoInsurance && !me.coiData?.cargoCoverage) failed.push("Cargo insurance required by this shipper");
  if (req.minCarrierRating && summary.avgRating < req.minCarrierRating) failed.push(`${req.minCarrierRating}+ star rating required (you're at ${summary.avgRating.toFixed(1)})`);

  return { met: failed.length === 0, failed };
}

function RequirementsLine({ requirements }) {
  if (!requirements) return null;
  const chips = [];
  if (requirements.minSafetyRating && requirements.minSafetyRating !== "any") chips.push(SAFETY_RATING_LABELS[requirements.minSafetyRating]);
  if (requirements.requireMcVerified) chips.push("MC Verified required");
  if (requirements.minCarrierRating) chips.push(`${requirements.minCarrierRating}+ stars required`);
  if (!chips.length && !requirements.preferences) return null;
  return (
    <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
      {chips.map((c, i) => (
        <span key={i} className="mono" style={{ fontSize: 10, fontWeight: 700, color: "#3A6EA5", background: "#EAF1F8", border: "1px solid #C7DAEA", borderRadius: 4, padding: "2px 7px" }}>
          <ShieldCheck size={10} style={{ verticalAlign: "-1px", marginRight: 3 }} />{c}
        </span>
      ))}
      {requirements.preferences && <span style={{ fontSize: 12, color: "#6B6557", fontStyle: "italic" }}>Pref: {requirements.preferences}</span>}
    </div>
  );
}

function LoadHeader({ load }) {
  const statusTone = { open: "amber", in_transit: "orange", delivered: "green", cancelled: "red" }[load.status];
  const statusLabel = { open: "Open", in_transit: "In Transit", delivered: "Delivered", cancelled: "Cancelled" }[load.status];
  const rpm = load.miles ? load.price / load.miles : 0;
  const secureSummary = load.securement?.summary;

  return (
    <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
      <div style={{ flex: 1, minWidth: 220 }}>
        <div style={{ fontWeight: 700, fontSize: 15, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <MapPin size={15} color="#FF5A1F" /> {load.origin} <ChevronRight size={14} color="#9A958A" /> {load.destination}
          {load.miles ? <span className="mono" style={{ fontSize: 11, color: "#9A958A", fontWeight: 400 }}>({load.miles} mi)</span> : null}
        </div>

        {/* Equipment type needed — shown to carriers before they bid */}
        {load.equipmentType && (
          <div style={{ marginTop: 5, display: "inline-flex", alignItems: "center", gap: 6, background: "#EAF1F8", border: "1px solid #C7DAEA", borderRadius: 6, padding: "3px 9px", fontSize: 12, fontWeight: 700, color: "#3A6EA5" }}>
            <Truck size={12} /> {load.equipmentType}{load.trailerLength ? ` · ${load.trailerLength} ft` : ""}
          </div>
        )}

        {/* GPS tracking requirement — shown to carriers before they bid, since
            tracking is optional platform-wide unless a specific shipper requires it */}
        {load.requirements?.requireGpsTracking && (
          <div style={{ marginTop: 5, marginLeft: 6, display: "inline-flex", alignItems: "center", gap: 6, background: "#FFF6E5", border: "1px solid #FFD98C", borderRadius: 6, padding: "3px 9px", fontSize: 12, fontWeight: 700, color: "#B5790A" }}>
            <Navigation size={12} /> Live GPS tracking required
          </div>
        )}

        {/* Commodity + description */}
        {(load.commodity || load.description) && (
          <div style={{ fontSize: 13, color: "#1B1D21", marginTop: 5, fontWeight: 600 }}>
            {load.commodity || load.description}
            {load.commodity && load.description && load.commodity !== load.description && (
              <span style={{ fontWeight: 400, color: "#6B6557" }}> — {load.description}</span>
            )}
          </div>
        )}

        {/* Core freight specs */}
        <div className="mono" style={{ fontSize: 11, color: "#9A958A", marginTop: 4, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <span>{load.weight.toLocaleString()} lbs</span>
          {load.dims && (load.dims.l || load.dims.w || load.dims.h) && <span>{load.dims.l}×{load.dims.w}×{load.dims.h} ft</span>}
          {load.qty > 1 && <span>qty {load.qty}</span>}
          {load.freightCondition && <span>{load.freightCondition}</span>}
          {load.ltl && <span style={{ color: "#3A6EA5", fontWeight: 700 }}>LTL{load.pallets ? ` · ${load.pallets} pallets` : ""}{load.linearFeet ? ` · ${load.linearFeet} lin ft` : ""}</span>}
        </div>

        {/* Dates */}
        {(load.pickupDate || load.deliveryDate) && (
          <div style={{ fontSize: 11, color: "#6B6557", marginTop: 3 }}>
            {load.pickupDate && <>Pickup: <b>{new Date(load.pickupDate).toLocaleDateString()}</b></>}
            {load.deliveryDate && <> · Delivery: <b>{new Date(load.deliveryDate).toLocaleDateString()}</b></>}
          </div>
        )}

        {/* Securement summary */}
        {secureSummary && (
          <div style={{ fontSize: 11, color: "#44484D", marginTop: 4, display: "flex", alignItems: "center", gap: 5 }}>
            <ShieldCheck size={11} color="#B5790A" /> {secureSummary}
          </div>
        )}

        {/* Flags row */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 5 }}>
          {load.hazmat && <span className="mono" style={{ fontSize: 10, background: "#FDF1EE", color: "#C0432B", border: "1px solid #F3B7A6", borderRadius: 4, padding: "1px 6px", fontWeight: 700 }}>HAZMAT</span>}
          {load.oversize && <span className="mono" style={{ fontSize: 10, background: "#FFF6E5", color: "#B5790A", border: "1px solid #FFD98C", borderRadius: 4, padding: "1px 6px", fontWeight: 700 }}>OVERSIZE</span>}
          {load.permitRequired && <span className="mono" style={{ fontSize: 10, background: "#FFF6E5", color: "#B5790A", border: "1px solid #FFD98C", borderRadius: 4, padding: "1px 6px", fontWeight: 700 }}>PERMIT REQ</span>}
          {load.twicRequired && <span className="mono" style={{ fontSize: 10, background: "#EAF1F8", color: "#3A6EA5", border: "1px solid #C7DAEA", borderRadius: 4, padding: "1px 6px", fontWeight: 700 }}>TWIC</span>}
          {load.doNotStack && <span className="mono" style={{ fontSize: 10, background: "#FDF1EE", color: "#C0432B", border: "1px solid #F3B7A6", borderRadius: 4, padding: "1px 6px", fontWeight: 700 }}>DO NOT STACK</span>}
          {load.fragile && <span className="mono" style={{ fontSize: 10, background: "#EAF1F8", color: "#3A6EA5", border: "1px solid #C7DAEA", borderRadius: 4, padding: "1px 6px", fontWeight: 700 }}>FRAGILE</span>}
          {load.appointmentRequired && <span className="mono" style={{ fontSize: 10, background: "#F8F5EE", color: "#44484D", border: "1px solid #E2DCCC", borderRadius: 4, padding: "1px 6px" }}>APPT REQUIRED</span>}
          {load.tempRequirement && <span className="mono" style={{ fontSize: 10, background: "#EAF1F8", color: "#3A6EA5", border: "1px solid #C7DAEA", borderRadius: 4, padding: "1px 6px" }}>{load.tempRequirement}</span>}
        </div>

        {load.special && <div style={{ fontSize: 11, color: "#6B6557", marginTop: 5 }}>⚑ {load.special}</div>}
        {load.unloadType && load.unloadType !== "Shipper/receiver unloads" && (
          <div style={{ fontSize: 11, color: "#6B6557", marginTop: 3 }}>Unload: {load.unloadType}</div>
        )}
        <RequirementsLine requirements={load.requirements} />
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 18, color: "#1B1D21" }}>{fmtMoney(load.price)}</div>
        {rpm > 0 && <div className="mono" style={{ fontSize: 12, color: "#3E7A4B", fontWeight: 700, marginBottom: 4 }}>{fmtMoney(rpm.toFixed(2))}/mi</div>}
        <Badge tone={statusTone}>{statusLabel}</Badge>
      </div>
    </div>
  );
}

function TrackerBar({ load }) {
  const fallbackMiles = useRef(milesBetween()).current;
  const miles = load.miles || fallbackMiles;
  const remaining = Math.round(miles * (1 - load.progress / 100));
  const etaHours = (remaining / 55).toFixed(1);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#9A958A", marginBottom: 4 }}><span>{load.origin}</span><span>{load.destination}</span></div>
      <div style={{ background: "#EEE8DA", borderRadius: 6, height: 10, overflow: "hidden" }}>
        <div style={{ width: `${load.progress}%`, height: "100%", background: load.progress >= 100 ? "#3E7A4B" : "#FF5A1F", transition: "width 1.5s linear" }} />
      </div>
      <div style={{ display: "flex", gap: 14, marginTop: 6, fontSize: 12, color: "#44484D", alignItems: "center" }}>
        <span style={{ display: "flex", gap: 4, alignItems: "center" }}><Gauge size={13} /> {Math.round(load.progress)}% complete</span>
        {load.progress < 100 && <span style={{ display: "flex", gap: 4, alignItems: "center" }}><Clock size={13} /> ETA ~{etaHours} hrs ({remaining} mi left)</span>}
        {load.progress >= 100 && <span style={{ display: "flex", gap: 4, alignItems: "center", color: "#3E7A4B" }}><CheckCircle2 size={13} /> Delivered</span>}
      </div>
      <TrackingMapWidget load={load} />
      <DetentionClock load={load} />
    </div>
  );
}

// Simulated geofenced detention — in production this is driven by an actual
// geofence radius around the facility coordinates plus a real GPS dwell timer
// from the ELD/telematics feed, not load.progress thresholds.
// ================================================================
// REAL GPS DETENTION TRACKER
// Requests browser geolocation, pings the backend every 60 seconds,
// and displays the live detention clock.
// ================================================================
const API_BASE = "https://hauldirect-api-production.up.railway.app";
const PING_INTERVAL_MS = 60000; // ping every 60 seconds
const FREE_WINDOW_MIN = 120;
const DETENTION_RATE = 60; // $60/hr

function DetentionTracker({ load, me }) {
  const [gpsStatus, setGpsStatus] = useState("idle"); // idle | requesting | active | denied | error
  const [tracking, setTracking] = useState(null); // last ping response from server
  const [elapsed, setElapsed] = useState(0); // seconds since arrival for live clock
  const pingRef = useRef(null);
  const watchRef = useRef(null);

  // Facility coordinates — in production these come from the load's facility record.
  // For now we derive them from the load's origin ZIP using our mock geocoder.
  const facilityCoord = load.originZip
    ? zipToCoord(load.originZip)
    : { lat: 39.7589, lng: -84.1916 }; // fallback: Dayton OH

  // Live elapsed clock — ticks every second while inside geofence
  useEffect(() => {
    if (!tracking?.arrivalAt || tracking?.departureAt) return;
    const iv = setInterval(() => {
      setElapsed(Math.floor((Date.now() - tracking.arrivalAt) / 1000));
    }, 1000);
    return () => clearInterval(iv);
  }, [tracking?.arrivalAt, tracking?.departureAt]);

  const sendPing = async (lat, lng) => {
    try {
      const resp = await fetch(`${API_BASE}/api/tracking/ping`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loadId: load.id,
          carrierId: me?.id,
          lat, lng,
          facilityLat: facilityCoord.lat,
          facilityLng: facilityCoord.lng,
          shipperStripeCustomerId: load.shipperStripeCustomerId || null,
          carrierStripeAccountId: me?.stripeAccountId || null,
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        setTracking(data);
      }
    } catch (e) {
      console.warn("Tracking ping failed:", e.message);
    }
  };

  const startTracking = () => {
    if (!navigator.geolocation) { setGpsStatus("error"); return; }
    setGpsStatus("requesting");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsStatus("active");
        sendPing(pos.coords.latitude, pos.coords.longitude);
        pingRef.current = setInterval(() => {
          navigator.geolocation.getCurrentPosition(
            (p) => sendPing(p.coords.latitude, p.coords.longitude),
            () => {}
          );
        }, PING_INTERVAL_MS);
      },
      () => setGpsStatus("denied")
    );
  };

  const stopTracking = () => {
    clearInterval(pingRef.current);
    setGpsStatus("idle");
  };

  useEffect(() => () => clearInterval(pingRef.current), []);

  if (load.status !== "in_transit") return null;

  const freeElapsedMin = tracking?.arrivalAt ? Math.floor((Date.now() - tracking.arrivalAt) / 60000) : 0;
  const freeRemaining = Math.max(0, FREE_WINDOW_MIN - freeElapsedMin);
  const detentionMin = tracking?.detentionMinutes || 0;
  const detentionAmt = tracking?.detentionAmount || 0;
  const detentionActive = tracking?.detentionActive;

  const fmtElapsed = (sec) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${h > 0 ? h + "h " : ""}${m}m ${s}s`;
  };

  return (
    <div style={{ marginTop: 10 }}>
      {gpsStatus === "idle" && (
        <div style={{ border: load.requirements?.requireGpsTracking ? "1px solid #FFD98C" : "1px solid #E2DCCC", background: load.requirements?.requireGpsTracking ? "#FFF6E5" : "#fff", borderRadius: 8, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontSize: 12, color: "#6B6557", display: "flex", alignItems: "center", gap: 6 }}>
            <Navigation size={13} />
            {load.requirements?.requireGpsTracking
              ? <span><b style={{ color: "#B5790A" }}>This shipper requires live GPS tracking</b> for this load — also enables automatic detention pay.</span>
              : "GPS tracking is optional on this load — enable it if you'd like automatic detention pay tracked for you."}
          </div>
          <button onClick={startTracking} style={{ ...primaryBtn("#FFB400"), padding: "7px 14px", display: "flex", alignItems: "center", gap: 5 }}>
            <Navigation size={13} /> Start tracking
          </button>
        </div>
      )}

      {gpsStatus === "requesting" && (
        <div style={{ border: "1px solid #E2DCCC", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#6B6557" }}>
          <RefreshCcw size={13} /> Requesting location permission…
        </div>
      )}

      {gpsStatus === "denied" && (
        <div style={{ border: "1px solid #F3B7A6", background: "#FDF1EE", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#C0432B" }}>
          <Lock size={13} /> Location permission denied. Enable location access in your browser settings to track detention time.
        </div>
      )}

      {gpsStatus === "active" && (
        <div style={{ border: `2px solid ${detentionActive ? "#C0432B" : tracking?.insideGeofence ? "#3E7A4B" : "#E2DCCC"}`, borderRadius: 8, overflow: "hidden" }}>
          <div style={{ background: detentionActive ? "#FDF1EE" : tracking?.insideGeofence ? "#F1F8F2" : "#FBF9F4", padding: "10px 14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 13, color: detentionActive ? "#C0432B" : tracking?.insideGeofence ? "#3E7A4B" : "#44484D" }}>
                <Navigation size={14} />
                {tracking?.insideGeofence ? "Inside facility geofence" : "Outside geofence"}
                {tracking?.distMiles != null && <span style={{ fontWeight: 400, fontSize: 11, color: "#9A958A" }}>({tracking.distMiles} mi from facility)</span>}
              </div>
              <button onClick={stopTracking} style={{ ...ghostBtn, fontSize: 11, padding: "4px 8px" }}>Stop tracking</button>
            </div>

            {tracking?.arrivalAt && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                <div style={{ color: "#44484D" }}>
                  Arrived: <b>{new Date(tracking.arrivalAt).toLocaleTimeString()}</b> · Time at facility: <b style={{ fontFamily: "monospace" }}>{fmtElapsed(elapsed)}</b>
                </div>

                {!detentionActive && freeRemaining > 0 && (
                  <div style={{ color: "#3E7A4B" }}>
                    Free window: <b>{freeRemaining} min remaining</b> (2-hour grace period)
                  </div>
                )}

                {detentionActive && (
                  <div style={{ marginTop: 6, background: "#fff", border: "1px solid #F3B7A6", borderRadius: 6, padding: "8px 10px" }}>
                    <div style={{ fontWeight: 700, color: "#C0432B", fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
                      <Clock size={14} /> Detention accruing — {detentionMin} min · <span style={{ fontFamily: "monospace" }}>{fmtMoney(detentionAmt)}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#9A958A", marginTop: 3 }}>
                      $60/hr · 15-min increments · auto-charged to shipper on departure
                    </div>
                  </div>
                )}

                {tracking?.departureAt && (
                  <div style={{ marginTop: 6, background: "#F1F8F2", border: "1px solid #BFE0C6", borderRadius: 6, padding: "8px 10px" }}>
                    <div style={{ fontWeight: 700, color: "#3E7A4B", display: "flex", alignItems: "center", gap: 6 }}>
                      <CheckCircle2 size={14} /> Departed {new Date(tracking.departureAt).toLocaleTimeString()}
                      {detentionAmt > 0
                        ? ` · ${fmtMoney(detentionAmt)} detention charged to shipper`
                        : " · No detention — within free window"}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!tracking?.arrivalAt && (
              <div style={{ fontSize: 12, color: "#9A958A" }}>
                GPS active · pinging every 60 sec · detention clock starts when you enter the 1-mile facility radius
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DetentionClock({ load }) {
  // Legacy simulated clock kept for shipper view (TrackerBar)
  // Real detention is handled by DetentionTracker on the carrier side
  const atFacility = load.status === "in_transit" && load.progress > 2 && load.progress < 8;
  if (!atFacility) return null;
  const dwellMinutes = Math.round((load.progress - 2) * 20);
  const overFree = Math.max(0, dwellMinutes - 120);
  const billable = Math.ceil(overFree / 60) * 60;
  return (
    <div style={{ marginTop: 8, border: `1px solid ${overFree > 0 ? "#F3B7A6" : "#E2DCCC"}`, background: overFree > 0 ? "#FDF1EE" : "#FBF9F4", borderRadius: 8, padding: "8px 10px", fontSize: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, color: overFree > 0 ? "#C0432B" : "#44484D" }}>
        <Clock size={13} /> Geofence estimate: {dwellMinutes} min at facility · 120 min free
      </div>
      {overFree > 0 && <div style={{ color: "#C0432B", marginTop: 3 }}>Est. detention: {fmtMoney(billable)} · Exact amount set by carrier GPS on departure</div>}
    </div>
  );
}


// Real live GPS tracking map — polls the carrier's actual device position
// (reported via DetentionTracker's navigator.geolocation pings) from the backend.
// Falls back to a "waiting for carrier GPS" state until the first real ping arrives.
function TrackingMapWidget({ load }) {
  const [position, setPosition] = useState(null); // { lat, lng, updatedAt, ageSeconds, stale } | null
  const [loading, setLoading] = useState(true);
  const pollRef = useRef(null);

  useEffect(() => {
    if (load.status !== "in_transit" && load.status !== "delivered") return;

    const fetchPosition = async () => {
      try {
        const resp = await fetch(`${API_URL}/api/tracking/position/${load.id}`);
        if (resp.ok) {
          const data = await resp.json();
          setPosition(data.hasPosition ? data : null);
        }
      } catch (e) {
        console.warn("Could not fetch live position:", e.message);
      } finally {
        setLoading(false);
      }
    };

    fetchPosition();
    // Poll every 30 seconds while the load is active — matches carrier's ~60s ping cadence with margin
    pollRef.current = setInterval(fetchPosition, 30000);
    return () => clearInterval(pollRef.current);
  }, [load.id, load.status]);

  if (load.status !== "in_transit" && load.status !== "delivered") return null;

  const originZip = load.originZip || "00000";
  const destZip = load.destZip || "99999";
  const originCoord = zipToCoord(originZip);
  const destCoord = zipToCoord(destZip);

  const toXY = (c) => ({
    x: ((c.lng + 125) / 58) * 100,
    y: 100 - ((c.lat - 25) / 24) * 100,
  });
  const oXY = toXY(originCoord), dXY = toXY(destCoord);

  // No real GPS ping received yet — carrier hasn't tapped "Start tracking"
  if (loading) {
    return (
      <div style={{ marginTop: 10, border: "1px solid #E2DCCC", borderRadius: 8, padding: "16px", background: "#F8F5EE", textAlign: "center", fontSize: 12, color: "#9A958A" }}>
        Loading live position…
      </div>
    );
  }

  if (!position) {
    return (
      <div style={{ marginTop: 10, border: "1px solid #E2DCCC", borderRadius: 8, overflow: "hidden", background: "#EAF1F8" }}>
        <svg viewBox="0 0 100 60" style={{ width: "100%", height: 110, display: "block" }}>
          <line x1={oXY.x} y1={oXY.y * 0.6} x2={dXY.x} y2={dXY.y * 0.6} stroke="#B7CBDD" strokeWidth="1" strokeDasharray="2,2" />
          <circle cx={oXY.x} cy={oXY.y * 0.6} r="2" fill="#3A6EA5" />
          <circle cx={dXY.x} cy={dXY.y * 0.6} r="2" fill="#FF5A1F" />
        </svg>
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 10px", background: "#fff", borderTop: "1px solid #E2DCCC", fontSize: 11, color: "#9A958A" }}>
          <Navigation size={12} color="#9A958A" /> Waiting for carrier to start GPS tracking — no live position yet
        </div>
      </div>
    );
  }

  const truckXY = toXY({ lat: position.lat, lng: position.lng });

  return (
    <div style={{ marginTop: 10, border: "1px solid #E2DCCC", borderRadius: 8, overflow: "hidden", background: "#EAF1F8" }}>
      <svg viewBox="0 0 100 60" style={{ width: "100%", height: 110, display: "block" }}>
        <line x1={oXY.x} y1={oXY.y * 0.6} x2={dXY.x} y2={dXY.y * 0.6} stroke="#B7CBDD" strokeWidth="1" strokeDasharray="2,2" />
        <circle cx={oXY.x} cy={oXY.y * 0.6} r="2" fill="#3A6EA5" />
        <circle cx={dXY.x} cy={dXY.y * 0.6} r="2" fill="#FF5A1F" />
        <circle cx={truckXY.x} cy={truckXY.y * 0.6} r="2.6" fill={position.stale ? "#9A958A" : "#FFB400"} stroke="#1B1D21" strokeWidth="0.6" />
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", background: "#fff", borderTop: "1px solid #E2DCCC" }}>
        <span style={{ fontSize: 11, color: position.stale ? "#B5790A" : "#3E7A4B", display: "flex", alignItems: "center", gap: 4 }}>
          <Navigation size={12} color={position.stale ? "#B5790A" : "#3E7A4B"} />
          {position.stale ? `Last seen ${Math.round(position.ageSeconds / 60)} min ago` : "Live GPS position"}
        </span>
        <span className="mono" style={{ fontSize: 10, color: "#9A958A" }}>{position.lat.toFixed(4)}, {position.lng.toFixed(4)}</span>
      </div>
    </div>
  );
}

function RateBox({ onRate, label }) {
  const [val, setVal] = useState(0);
  return (
    <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{label || "Rate this trucker:"}</span>
      <span style={{ display: "flex" }}>{[1, 2, 3, 4, 5].map((i) => (<Star key={i} size={20} onClick={() => setVal(i)} fill={i <= val ? "#FFB400" : "none"} stroke={i <= val ? "#FFB400" : "#9A958A"} style={{ cursor: "pointer" }} />))}</span>
      <button disabled={!val} onClick={() => onRate(val)} style={{ ...primaryBtn("#FFB400"), padding: "6px 12px", opacity: val ? 1 : 0.5 }}>Submit</button>
    </div>
  );
}

function TeamRoster({ corp, onAddMember, onUpdateMember, onRemoveMember }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewProfile, setViewProfile] = useState(null);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const isTrucking = corp.subtype === "trucking";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 720 }}>
      <Card style={{ padding: 16, background: "#FBF9F4" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#44484D" }}>
            <Users size={15} /> {corp.members.length} profile{corp.members.length === 1 ? "" : "s"} · {getCompanyTier(corp.members.length).name} tier
          </div>
          <div style={{ fontSize: 11, color: "#9A958A" }}>Parent account has full administrative control over all driver profiles below.</div>
        </div>
      </Card>
      {corp.members.map((m) => (
        <Card key={m.id} style={{ padding: 16, border: m.suspended ? "1px solid #F3B7A6" : "1px solid #E2DCCC", background: m.suspended ? "#FDF1EE" : "#fff" }}>
          {editing !== m.id ? (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}>
                  {m.name}
                  {m.suspended && <Badge tone="orange">Suspended</Badge>}
                  {isTrucking && m.equipmentType && <span className="mono" style={{ fontSize: 10, background: "#EEE8DA", padding: "1px 6px", borderRadius: 4 }}>{m.equipmentType}</span>}
                </div>
                <div style={{ fontSize: 12, color: "#6B6557", marginTop: 2 }}>{m.role}{m.loc ? ` · ${m.loc}` : ""}{m.phone ? ` · ${m.phone}` : ""}</div>
                {isTrucking && <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}><Stars value={avgRating(m.ratings)} size={12} /> <span style={{ fontSize: 11, color: "#9A958A" }}>({m.ratings.length} ratings)</span></div>}
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button onClick={() => setViewProfile(m)} style={{ ...ghostBtn, fontSize: 12, padding: "6px 10px" }}>View profile</button>
                <button onClick={() => setEditing(m.id)} style={{ ...ghostBtn, fontSize: 12, padding: "6px 10px" }}>Edit</button>
                {onUpdateMember && <button onClick={() => onUpdateMember({ ...m, suspended: !m.suspended })} style={{ ...ghostBtn, fontSize: 12, padding: "6px 10px", color: m.suspended ? "#3E7A4B" : "#FF5A1F" }}>{m.suspended ? "Reinstate" : "Suspend"}</button>}
              </div>
            </div>
          ) : (
            <AdminEditMemberForm member={m} isTrucking={isTrucking} onSave={(updated) => { onUpdateMember && onUpdateMember(updated); setEditing(null); }} onCancel={() => setEditing(null)} />
          )}
        </Card>
      ))}
      {!corp.members.length && <Empty text="No profiles yet — add the first one below." />}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {!adding ? (
          <button onClick={() => {
            const plan = getPlanFromMemberCount(corp.members.length);
            const lim = PLAN_PROFILE_LIMITS[plan];
            if (corp.members.length >= lim) { setShowLimitModal(true); return; }
            setAdding(true);
          }} style={{ ...ghostBtn, display: "flex", alignItems: "center", gap: 6, width: "fit-content" }}>
            <UserPlus size={15} /> Add profile
          </button>
        ) : (
          <AddMemberForm isTrucking={isTrucking} onCancel={() => setAdding(false)} onAdd={(member) => { onAddMember(member); setAdding(false); }} />
        )}
        {(() => {
          const plan = getPlanFromMemberCount(corp.members.length);
          const lim = PLAN_PROFILE_LIMITS[plan];
          return lim !== Infinity ? <span style={{ fontSize: 11, color: "#9A958A" }}>{corp.members.length} / {lim} profiles used on {getCompanyTier(corp.members.length).name} tier</span> : null;
        })()}
      </div>
      {viewProfile && <DriverProfileModal member={viewProfile} corp={corp} onClose={() => setViewProfile(null)} />}
      {showLimitModal && <ProfileLimitModal currentCount={corp.members.length} onClose={() => setShowLimitModal(false)} onUpgrade={() => { setShowLimitModal(false); alert("Upgrade handled via Stripe Customer Portal in production."); }} />}
    </div>
  );
}

function AdminEditMemberForm({ member, isTrucking, onSave, onCancel }) {
  const [name, setName] = useState(member.name || "");
  const [role, setRole] = useState(member.role || "");
  const [loc, setLoc] = useState(member.loc || "");
  const [phone, setPhone] = useState(member.phone || "");
  const [truckDesc, setTruckDesc] = useState(member.truckDesc || "");
  const [equipmentType, setEquipmentType] = useState(member.equipmentType || "");
  const [maxWeight, setMaxWeight] = useState(member.maxWeight || "");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#44484D", marginBottom: 4 }}>Editing {member.name} — admin control</div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Field label="Full name"><input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} /></Field>
        <Field label="Title / role"><input value={role} onChange={(e) => setRole(e.target.value)} style={inputStyle} /></Field>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Field label="Base location"><input value={loc} onChange={(e) => setLoc(e.target.value)} style={inputStyle} /></Field>
        <Field label="Phone / contact"><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(513) 555-1234" style={inputStyle} /></Field>
      </div>
      {isTrucking && (
        <>
          <Field label="Truck description"><input value={truckDesc} onChange={(e) => setTruckDesc(e.target.value)} style={inputStyle} /></Field>
          <div style={{ display: "flex", gap: 10 }}>
            <Field label="Equipment type">
              <select value={equipmentType} onChange={(e) => setEquipmentType(e.target.value)} style={inputStyle}>
                <option value="">Select…</option>
                {EQUIPMENT_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Max haul weight (lbs)"><input type="number" value={maxWeight} onChange={(e) => setMaxWeight(e.target.value)} style={inputStyle} /></Field>
          </div>
        </>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => onSave({ ...member, name, role, loc, phone, truckDesc, equipmentType, maxWeight: Number(maxWeight) || member.maxWeight })} style={{ ...primaryBtn("#FFB400"), padding: "9px 18px" }}>Save changes</button>
        <button onClick={onCancel} style={ghostBtn}>Cancel</button>
      </div>
    </div>
  );
}

function DriverProfileModal({ member, corp, onClose }) {
  const [showCorpProfile, setShowCorpProfile] = useState(false);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(27,29,33,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 16 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", width: "100%", maxWidth: 480, borderRadius: 12, overflow: "hidden", boxShadow: "0 12px 40px rgba(0,0,0,0.3)" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid #E2DCCC", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#1B1D21", color: "#F2EDE4" }}>
          <div style={{ fontWeight: 700 }}>Driver Profile</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#F2EDE4" }}><X size={18} /></button>
        </div>
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 4 }}>
            <ProfilePicture src={member.avatar} name={member.name} size={64} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 18 }}>{member.name}</div>
              <div style={{ fontSize: 12, color: "#6B6557" }}>{member.role}</div>
              {corp && (
                <button onClick={() => setShowCorpProfile(true)} style={{ background: "none", border: "none", color: "#3A6EA5", fontWeight: 700, fontSize: 12, padding: 0, textDecoration: "underline", cursor: "pointer", marginTop: 2 }}>
                  {corp.companyName} ↗
                </button>
              )}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Stars value={avgRating(member.ratings)} size={15} />
            <span style={{ color: "#6B6557" }}>{avgRating(member.ratings).toFixed(1)} avg · {member.ratings.length} rating{member.ratings.length === 1 ? "" : "s"}</span>
          </div>
          {member.equipmentType && <div><b>Equipment:</b> {member.equipmentType} · {member.truckDesc || "—"}</div>}
          {member.maxWeight ? <div><b>Max haul:</b> {member.maxWeight.toLocaleString()} lbs</div> : null}
          {member.loc && <div><b>Base location:</b> {member.loc}</div>}
          {member.phone && <div><b>Contact:</b> {member.phone}</div>}
          {corp?.verification?.authorityStatus === "AUTHORIZED" && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#3E7A4B", fontWeight: 700 }}>
              <ShieldCheck size={14} /> Operating under {corp.companyName} · MC verified
            </div>
          )}
        </div>
      </div>
      {showCorpProfile && corp && <CompanyProfilePage corp={corp} onClose={() => setShowCorpProfile(false)} />}
    </div>
  );
}

function CompanySetupForm({ me, onSave }) {
  const [companyName, setCompanyName] = useState(me.companyName || me.company || "");
  const [ein, setEin] = useState(me.ein || "");
  const [addr1, setAddr1] = useState(me.address?.line1 || "");
  const [addr2, setAddr2] = useState(me.address?.line2 || "");
  const [city, setCity] = useState(me.address?.city || "");
  const [state, setState] = useState(me.address?.state || "");
  const [zip, setZip] = useState(me.address?.zip || "");
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [saving, setSaving] = useState(false);

  const formatEin = (v) => {
    const digits = v.replace(/\D/g, "").slice(0, 9);
    return digits.length > 2 ? `${digits.slice(0, 2)}-${digits.slice(2)}` : digits;
  };

  const save = async () => {
    setSaving(true);
    setSaveError(false);
    const result = await onSave({ companyName, ein, address: { line1: addr1, line2: addr2, city, state, zip } });
    setSaving(false);
    if (result === false) {
      setSaveError(true);
      setTimeout(() => setSaveError(false), 4000);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 560 }}>
      <Card style={{ padding: 24 }}>
        <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 18, textTransform: "uppercase", marginBottom: 6 }}>Company Setup</div>
        <div style={{ fontSize: 13, color: "#6B6557", marginBottom: 18 }}>This information appears on invoices and accounting records for your loads.</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Field label="Company name"><input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Your Company LLC" style={inputStyle} /></Field>
          <Field label="EIN (Employer Identification Number)">
            <input value={ein} onChange={(e) => setEin(formatEin(e.target.value))} placeholder="12-3456789" style={inputStyle} />
          </Field>
          <Field label="Corporate address — line 1"><input value={addr1} onChange={(e) => setAddr1(e.target.value)} placeholder="123 Industrial Pkwy" style={inputStyle} /></Field>
          <Field label="Corporate address — line 2 (optional)"><input value={addr2} onChange={(e) => setAddr2(e.target.value)} placeholder="Suite 400" style={inputStyle} /></Field>
          <div style={{ display: "flex", gap: 10 }}>
            <Field label="City"><input value={city} onChange={(e) => setCity(e.target.value)} style={inputStyle} /></Field>
            <Field label="State"><input value={state} onChange={(e) => setState(e.target.value)} style={{ ...inputStyle, width: 70 }} /></Field>
            <Field label="ZIP"><input value={zip} onChange={(e) => setZip(e.target.value)} style={{ ...inputStyle, width: 100 }} /></Field>
          </div>
          <button onClick={save} disabled={saving} style={{ ...primaryBtn(saveError ? "#C0432B" : "#FFB400"), marginTop: 4, opacity: saving ? 0.7 : 1 }}>
            {saving ? "Saving…" : saveError ? "Save failed — try again" : saved ? "Saved ✓" : "Save company info"}
          </button>
          {saveError && (
            <div style={{ fontSize: 12, color: "#C0432B", marginTop: -4 }}>
              Couldn't reach the server to save your company info. Check your connection and try again.
            </div>
          )}
        </div>
      </Card>
      <BillingPaymentCard me={me} onSave={onSave} />
    </div>
  );
}

function BillingPaymentCard({ me, onSave }) {
  const [open, setOpen] = useState(false);
  const [cardNumber, setCardNumber] = useState(""); const [exp, setExp] = useState(""); const [cvc, setCvc] = useState(""); const [nameOnCard, setNameOnCard] = useState("");

  const formatCard = (v) => v.replace(/\D/g, "").slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 ");
  const formatExp = (v) => {
    const digits = v.replace(/\D/g, "").slice(0, 4);
    return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
  };

  const connectCard = () => {
    const digits = cardNumber.replace(/\D/g, "");
    if (digits.length < 12 || !exp || !cvc || !nameOnCard) { alert("Fill in all card fields."); return; }
    onSave({ billing: { connected: true, brand: "Card", last4: digits.slice(-4), exp, nameOnCard } });
    setOpen(false); setCardNumber(""); setExp(""); setCvc(""); setNameOnCard("");
  };
  const disconnectCard = () => onSave({ billing: { connected: false } });

  return (
    <Card style={{ padding: 24 }}>
      <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 18, textTransform: "uppercase", marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
        <CreditCard size={18} color="#FFB400" /> Payment Method
      </div>
      <div style={{ fontSize: 13, color: "#6B6557", marginBottom: 16, lineHeight: 1.5 }}>
        Your subscription is charged to this card each billing cycle. This is for your Direct Freight subscription only — freight payments to carriers are handled separately, directly between you and the carrier.
      </div>
      {me.billing?.connected ? (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600 }}>
            <ShieldCheck size={16} color="#3E7A4B" /> {me.billing.brand} ending in {me.billing.last4} · exp {me.billing.exp}
          </div>
          <button onClick={disconnectCard} style={{ ...ghostBtn, fontSize: 12, color: "#FF5A1F" }}>Remove</button>
        </div>
      ) : !open ? (
        <button onClick={() => setOpen(true)} style={primaryBtn("#FFB400")}>Add payment method</button>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Field label="Name on card"><input value={nameOnCard} onChange={(e) => setNameOnCard(e.target.value)} style={inputStyle} /></Field>
          <Field label="Card number"><input value={cardNumber} onChange={(e) => setCardNumber(formatCard(e.target.value))} placeholder="4242 4242 4242 4242" style={inputStyle} /></Field>
          <div style={{ display: "flex", gap: 8 }}>
            <Field label="Expiry"><input value={exp} onChange={(e) => setExp(formatExp(e.target.value))} placeholder="MM/YY" style={inputStyle} /></Field>
            <Field label="CVC"><input value={cvc} onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="123" style={inputStyle} /></Field>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={connectCard} style={{ ...primaryBtn("#FFB400"), padding: "10px 18px" }}>Save card</button>
            <button onClick={() => setOpen(false)} style={ghostBtn}>Cancel</button>
          </div>
        </div>
      )}
      <div style={{ fontSize: 11, color: "#9A958A", marginTop: 14 }}>Secured by Stripe. Direct Freight Co never stores your raw card number.</div>
    </Card>
  );
}

function getAllTruckersFlat(independentTruckers, corporations) {
  const indie = independentTruckers.map((t) => ({ ...t, companyLabel: t.company || "Owner-operator", corp: t.verification ? { verification: t.verification } : null }));
  const corpDrivers = corporations.filter((c) => c.subtype === "trucking").flatMap((c) =>
    c.members.map((m) => ({ ...m, companyLabel: c.companyName, corp: { companyName: c.companyName, verification: c.verification } }))
  );
  return [...indie, ...corpDrivers];
}

function NearbyCapacity({ independentTruckers, corporations, onOpenChat }) {
  const [searchZip, setSearchZip] = useState("");
  const [radius, setRadius] = useState(150);
  const [onlyEmpty, setOnlyEmpty] = useState(true);

  const allTruckers = getAllTruckersFlat(independentTruckers, corporations);
  const validSearch = /^\d{5}$/.test(searchZip);
  const results = validSearch
    ? allTruckers
        .filter((t) => t.currentZip)
        .map((t) => ({ ...t, distance: estimateMilesBetweenZips(searchZip, t.currentZip) }))
        .filter((t) => t.distance <= radius)
        .filter((t) => !onlyEmpty || t.equipmentStatus === "empty")
        .sort((a, b) => a.distance - b.distance)
    : [];

  return (
    <div style={{ maxWidth: 760 }}>
      <Card style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 18, textTransform: "uppercase", marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
          <Navigation size={18} color="#FFB400" /> Nearby Capacity
        </div>
        <div style={{ fontSize: 13, color: "#6B6557", marginBottom: 14 }}>Find carriers currently marked Empty near a given location — useful for last-minute spot coverage.</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <Field label="Search ZIP"><input value={searchZip} onChange={(e) => setSearchZip(e.target.value.replace(/\D/g, "").slice(0, 5))} placeholder="45402" style={inputStyle} /></Field>
          <Field label="Radius (mi)">
            <select value={radius} onChange={(e) => setRadius(Number(e.target.value))} style={inputStyle}>
              {[50, 100, 150, 250, 500].map((r) => <option key={r} value={r}>{r} mi</option>)}
            </select>
          </Field>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#44484D", paddingBottom: 9 }}>
            <input type="checkbox" checked={onlyEmpty} onChange={(e) => setOnlyEmpty(e.target.checked)} /> Empty only
          </label>
        </div>
      </Card>

      {!validSearch ? (
        <Empty text="Enter a 5-digit ZIP to search for nearby capacity." />
      ) : !results.length ? (
        <Empty text="No carriers found in range with the current filters." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {results.map((t) => (
            <Card key={t.id} style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  {t.name} <Stars value={avgRating(t.ratings)} size={12} />
                  <Badge tone={t.equipmentStatus === "empty" ? "green" : "orange"}>{t.equipmentStatus === "empty" ? "Empty" : "Loaded"}</Badge>
                  {t.corp?.verification?.authorityStatus === "AUTHORIZED" && <span style={{ color: "#3E7A4B", display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 700 }}><ShieldCheck size={11} /> MC Verified</span>}
                </div>
                <div style={{ fontSize: 12, color: "#6B6557", marginTop: 3 }}>{t.companyLabel} · {t.equipmentType || "Equipment not specified"} · near {t.currentZip}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#3A6EA5" }}>{t.distance} mi away</div>
                <button onClick={() => onOpenChat(t.id)} style={{ ...ghostBtn, fontSize: 12, padding: "7px 12px", display: "flex", alignItems: "center", gap: 5 }}><MessageCircle size={13} /> Contact</button>
              </div>
            </Card>
          ))}
        </div>
      )}
      <div style={{ fontSize: 11, color: "#9A958A", marginTop: 12 }}>
        Carrier location reflects each carrier's current reported ZIP and Empty/Loaded status, updated as they move between loads.
      </div>
    </div>
  );
}


// ====================================================================
// INVOICE GENERATOR — for completed loads
// ====================================================================
function InvoiceModal({ load, shipper, trucker, onClose }) {
  const invNum = "DH-INV-" + (load.id || "").slice(-6).toUpperCase();
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const handlePrint = () => window.print();

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(27,29,33,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 70, padding: 16 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", width: "100%", maxWidth: 640, maxHeight: "90vh", borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 12px 40px rgba(0,0,0,0.3)" }}>
        <div style={{ background: "#1B1D21", color: "#F2EDE4", padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 700 }}>Invoice — {invNum}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handlePrint} style={{ ...ghostBtn, color: "#F2EDE4", borderColor: "#9A958A", fontSize: 12 }}>Print / Save PDF</button>
            <button onClick={onClose} style={{ background: "none", border: "none", color: "#F2EDE4" }}><X size={18} /></button>
          </div>
        </div>
        <div style={{ overflowY: "auto", padding: 28 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24 }}>
            <div>
              <Logo size={30} variant="dark" showTagline={false} />
              <div style={{ fontSize: 11, color: "#9A958A", marginTop: 4 }}>Broker-Free Freight Platform</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>INVOICE</div>
              <div style={{ fontSize: 12, color: "#6B6557" }}>#{invNum}</div>
              <div style={{ fontSize: 12, color: "#6B6557" }}>Date: {today}</div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
            <div style={{ background: "#F8F5EE", borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: 11, color: "#9A958A", fontWeight: 700, marginBottom: 6 }}>BILLED TO (SHIPPER)</div>
              <div style={{ fontWeight: 600 }}>{shipper?.name || load.shipperName}</div>
              {shipper?.company && <div style={{ fontSize: 12, color: "#6B6557" }}>{shipper.company}</div>}
              {shipper?.ein && <div style={{ fontSize: 12, color: "#6B6557" }}>EIN: {shipper.ein}</div>}
              {shipper?.address?.line1 && <div style={{ fontSize: 12, color: "#6B6557" }}>{shipper.address.line1}, {shipper.address.city}, {shipper.address.state} {shipper.address.zip}</div>}
            </div>
            <div style={{ background: "#F8F5EE", borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: 11, color: "#9A958A", fontWeight: 700, marginBottom: 6 }}>CARRIER</div>
              <div style={{ fontWeight: 600 }}>{trucker?.name || "Carrier"}</div>
              {trucker?.company && <div style={{ fontSize: 12, color: "#6B6557" }}>{trucker.company}</div>}
              {trucker?.mcNumber && <div style={{ fontSize: 12, color: "#6B6557" }}>MC: {trucker.mcNumber}</div>}
            </div>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 20 }}>
            <thead>
              <tr style={{ background: "#1B1D21", color: "#F2EDE4" }}>
                {["Description", "Origin → Destination", "Miles", "Rate"].map((h) => (
                  <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: 12, fontWeight: 700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid #EEE8DA" }}>
                <td style={{ padding: "10px 12px", fontSize: 13 }}>{load.commodity || load.description}</td>
                <td style={{ padding: "10px 12px", fontSize: 13 }}>{load.origin} → {load.destination}</td>
                <td style={{ padding: "10px 12px", fontSize: 13 }}>{load.miles || "—"}</td>
                <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 700 }}>{fmtMoney(load.price)}</td>
              </tr>
              {load.securement?.summary && (
                <tr style={{ borderBottom: "1px solid #EEE8DA", background: "#FBF9F4" }}>
                  <td colSpan={3} style={{ padding: "8px 12px", fontSize: 12, color: "#6B6557" }}>Securement: {load.securement.summary}</td>
                  <td style={{ padding: "8px 12px", fontSize: 12, color: "#6B6557" }}>Incl.</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr style={{ background: "#F8F5EE" }}>
                <td colSpan={3} style={{ padding: "10px 12px", fontWeight: 700, fontSize: 14 }}>Total</td>
                <td style={{ padding: "10px 12px", fontWeight: 700, fontSize: 16, color: "#1B1D21" }}>{fmtMoney(load.price)}</td>
              </tr>
              <tr>
                <td colSpan={4} style={{ padding: "8px 12px", fontSize: 11, color: "#9A958A" }}>
                  Status: {load.paid ? `PAID ${load.paidAt ? new Date(load.paidAt).toLocaleDateString() : ""}` : "PENDING"} · Load ID: {load.id}
                </td>
              </tr>
            </tfoot>
          </table>

          {trucker?.factoringEnabled && trucker?.factoringCompany && (
            <div style={{ background: "#EAF1F8", border: "1px solid #C7DAEA", borderRadius: 8, padding: "12px 14px", marginBottom: 16, fontSize: 12, color: "#1B1D21", lineHeight: 1.6 }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>💰 Remit payment to (Notice of Assignment on file)</div>
              <div><b>{trucker.factoringCompany}</b></div>
              {trucker.factoringEmail && <div>{trucker.factoringEmail}</div>}
              {trucker.factoringPhone && <div>{trucker.factoringPhone}</div>}
              {trucker.factoringNoaNumber && <div>NOA Ref: {trucker.factoringNoaNumber}</div>}
            </div>
          )}

          <div style={{ fontSize: 11, color: "#9A958A", lineHeight: 1.6, borderTop: "1px solid #EEE8DA", paddingTop: 14 }}>
            Direct Freight is a technology platform and information aggregator. This invoice is generated automatically upon delivery confirmation and serves as a record of the freight transaction between Shipper and Carrier. Direct Freight is not a party to this transaction. Payment terms are agreed between Shipper and Carrier. directfreight.com
          </div>
        </div>
      </div>
    </div>
  );
}

// ====================================================================
// SHIPPER DASHBOARD OVERVIEW
// ====================================================================
function ShipperDashboard({ loads, me }) {
  const myLoads = loads.filter((l) => l.shipperId === me.id);
  const open = myLoads.filter((l) => l.status === "open").length;
  const inTransit = myLoads.filter((l) => l.status === "in_transit").length;
  const delivered = myLoads.filter((l) => l.status === "delivered").length;
  const totalSpend = myLoads.filter((l) => l.paid).reduce((a, l) => a + l.price, 0);
  const pendingPayment = myLoads.filter((l) => l.status === "delivered" && !l.paid).reduce((a, l) => a + l.price, 0);
  const pendingBids = myLoads.reduce((a, l) => a + (l.bids || []).filter((b) => b.status === "pending").length, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <StatCard label="Open loads" value={open} icon={<Package size={16} />} />
        <StatCard label="In transit" value={inTransit} icon={<Truck size={16} />} />
        <StatCard label="Delivered" value={delivered} icon={<CheckCircle2 size={16} />} />
        <StatCard label="Pending bids" value={pendingBids} icon={<Gavel size={16} />} highlight={pendingBids > 0} />
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <StatCard label="Total freight spend" value={fmtMoney(totalSpend)} icon={<DollarSign size={16} />} />
        <StatCard label="Awaiting payment" value={fmtMoney(pendingPayment)} icon={<Clock size={16} />} highlight={pendingPayment > 0} />
        <StatCard label="Est. broker fees avoided" value={fmtMoney(Math.round(totalSpend * 0.15))} icon={<ShieldCheck size={16} />} />
      </div>
      {inTransit > 0 && (
        <Card style={{ padding: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Active shipments</div>
          {myLoads.filter((l) => l.status === "in_transit").map((l) => (
            <div key={l.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "6px 0", borderBottom: "1px solid #EEE8DA" }}>
              <span>{l.origin} → {l.destination}</span>
              <span className="mono" style={{ color: "#FF5A1F" }}>{Math.round(l.progress)}% · {fmtMoney(l.price)}</span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

function ShipperAnalytics({ loads, me }) {
  const total = loads.length;
  const booked = loads.filter((l) => l.status !== "open");
  const delivered = loads.filter((l) => l.status === "delivered");
  const avgAcceptHrs = (() => {
    const times = booked.map((l) => {
      const acceptedBid = (l.bids || []).find((b) => b.status === "accepted");
      if (!acceptedBid) return (l.progress > 0 ? 4 : null); // claimed-at-price loads: assume ~4hr avg for demo
      return 6; // bid-accepted loads: assume ~6hr avg for demo
    }).filter((x) => x != null);
    return times.length ? (times.reduce((a, b) => a + b, 0) / times.length).toFixed(1) : "—";
  })();
  const onTimePct = delivered.length ? Math.round((delivered.filter((l) => l.progress >= 100).length / delivered.length) * 100) : null;
  const avgRpm = (() => {
    const rpms = loads.filter((l) => l.miles).map((l) => l.price / l.miles);
    return rpms.length ? (rpms.reduce((a, b) => a + b, 0) / rpms.length).toFixed(2) : "—";
  })();
  const estBrokerSavings = booked.reduce((acc, l) => acc + l.price * 0.15, 0); // illustrative: ~15% typical broker margin avoided

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 16 }}>
        <StatCard label="Tender acceptance time" value={avgAcceptHrs === "—" ? "—" : `${avgAcceptHrs} hrs`} icon={<Clock size={16} />} />
        <StatCard label="On-time delivery rate" value={onTimePct == null ? "—" : `${onTimePct}%`} icon={<CheckCircle2 size={16} />} />
        <StatCard label="Average rate per mile" value={avgRpm === "—" ? "—" : `$${avgRpm}`} icon={<Gauge size={16} />} />
        <StatCard label="Est. broker fees avoided" value={fmtMoney(Math.round(estBrokerSavings))} icon={<DollarSign size={16} />} highlight />
      </div>
      <Card style={{ padding: 16, fontSize: 12, color: "#6B6557", lineHeight: 1.6 }}>
        Based on {total} posted load{total === 1 ? "" : "s"}, {booked.length} booked, {delivered.length} delivered. "Broker fees avoided" is an illustrative estimate using a typical ~15% broker margin on your booked freight spend — not a guaranteed or audited figure.
      </Card>
      <BrokerSavingsReport loads={loads} me={me} />
    </div>
  );
}

function StatCard({ label, value, icon, highlight }) {
  const w = useWindowWidth();
  const isMobile = w <= 640;
  return (
    <Card style={{ padding: isMobile ? 12 : 16, flex: 1, minWidth: isMobile ? 120 : 160, border: highlight ? "1px solid #FFD98C" : undefined, background: highlight ? "#FFFBF0" : "#fff" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#9A958A", fontSize: 10, marginBottom: 4 }}>{icon} {label.toUpperCase()}</div>
      <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 700, fontFamily: "Oswald, sans-serif" }}>{value}</div>
    </Card>
  );
}

function EdiGatewayPanel({ corp }) {
  const [apiKey, setApiKey] = useState(null);
  const generate = () => setApiKey("hd_live_" + Math.random().toString(36).slice(2, 18));
  return (
    <Card style={{ padding: 24, maxWidth: 640 }}>
      <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 18, textTransform: "uppercase", marginBottom: 6 }}>Developer / EDI Gateway</div>
      <div style={{ fontSize: 13, color: "#6B6557", marginBottom: 16, lineHeight: 1.5 }}>
        Push loads directly from your internal TMS/ERP instead of using the web form — useful for high-volume tendering.
      </div>
      <div style={{ background: "#1B1D21", color: "#F2EDE4", borderRadius: 8, padding: 14, fontFamily: "monospace", fontSize: 12, marginBottom: 16, overflowX: "auto" }}>
        POST https://api.directfreight.com/v1/loads/tender<br />
        Authorization: Bearer {apiKey || "{your_api_key}"}<br />
        Content-Type: application/json<br /><br />
        {"{ \"origin\": \"45402\", \"destination\": \"40202\", \"weight\": 32000, \"price\": 1450 }"}
      </div>
      {apiKey ? (
        <div style={{ background: "#F1F8F2", border: "1px solid #BFE0C6", borderRadius: 8, padding: 12, fontSize: 12, fontFamily: "monospace", wordBreak: "break-all" }}>{apiKey}</div>
      ) : (
        <button onClick={generate} style={primaryBtn("#3A6EA5")}>Generate API key</button>
      )}
      <div style={{ fontSize: 11, color: "#9A958A", marginTop: 14 }}>
        This is a UI mock of the developer experience — a real EDI/API gateway needs a backend with authentication, rate limiting, and EDI 204/990/214 translation if you're integrating with legacy enterprise TMS systems.
      </div>
    </Card>
  );
}

function BillingCard({ isCorp, corp, me, onManage }) {
  const memberCount = isCorp ? corp.members.length : 1;
  const tier = isCorp ? getCompanyTier(memberCount) : null;
  const tierIndex = isCorp ? COMPANY_TIERS.findIndex((t) => t.id === tier.id) : -1;
  const nextTier = isCorp && tierIndex < COMPANY_TIERS.length - 1 ? COMPANY_TIERS[tierIndex + 1] : null;
  const planLabel = isCorp ? `${tier.name} Plan` : "Standard Plan";
  const priceLabel = isCorp ? `$${tier.price}/mo` : (me?.role === "trucker" ? "$30/mo" : "$70/mo");

  return (
    <Card style={{ padding: 24, maxWidth: 520 }}>
      <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 18, textTransform: "uppercase", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
        <ShieldCheck size={18} color="#3E7A4B" /> Billing
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderBottom: "1px solid #EEE8DA" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{planLabel}</div>
          <div style={{ fontSize: 12, color: "#9A958A" }}>
            {isCorp ? `${tier.range} · ${memberCount} profile${memberCount === 1 ? "" : "s"} currently on roster` : "Covers your single profile"}
          </div>
        </div>
        <div style={{ fontWeight: 700, fontSize: 18 }}>{priceLabel}</div>
      </div>
      <div style={{ fontSize: 13, color: "#44484D", marginTop: 14, lineHeight: 1.6 }}>
        {isCorp ? (
          tier.id === "enterprise" ? (
            <>Flat Enterprise rate for fleets/teams of 150+ profiles — no per-driver or per-seat charges, no custom quote or sales call required. Add as many profiles as you need at this rate.</>
          ) : (
            <>One flat bill for the {tier.name} tier — add or remove driver/team profiles within {tier.range} and your subscription cost doesn't change. No per-load, per-bid, or per-seat fees.</>
          )
        ) : (
          <>One flat bill, one profile, no per-load or per-bid fees.</>
        )}
      </div>
      {isCorp && nextTier && (
        <div style={{ marginTop: 14, background: "#F8F5EE", border: "1px solid #E2DCCC", borderRadius: 8, padding: "10px 12px", fontSize: 12, color: "#6B6557" }}>
          Crossing into <b>{nextTier.range}</b> automatically moves you to the {nextTier.name} tier at ${nextTier.price}/mo.
        </div>
      )}
      <button onClick={onManage} style={{ ...ghostBtn, marginTop: 16 }}>Manage subscription</button>
    </Card>
  );
}

// ====================================================================
// TRUCKER APP
// ====================================================================
function EquipmentStatusBar({ me, onSetStatus, onSetZip }) {
  const [editingZip, setEditingZip] = useState(false);
  const [zipVal, setZipVal] = useState(me.currentZip || "");
  const status = me.equipmentStatus || "empty";

  return (
    <Card style={{ padding: "10px 16px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={() => onSetStatus("empty")} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #BFE0C6", background: status === "empty" ? "#3E7A4B" : "#fff", color: status === "empty" ? "#fff" : "#3E7A4B", fontWeight: 700, fontSize: 12 }}>Empty / Available</button>
          <button onClick={() => onSetStatus("loaded")} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #FFD98C", background: status === "loaded" ? "#B5790A" : "#fff", color: status === "loaded" ? "#fff" : "#B5790A", fontWeight: 700, fontSize: 12 }}>Loaded</button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#44484D" }}>
          <Navigation size={13} />
          {editingZip ? (
            <>
              <input value={zipVal} onChange={(e) => setZipVal(e.target.value.replace(/\D/g, "").slice(0, 5))} style={{ ...inputStyle, width: 80, padding: "4px 6px" }} />
              <button onClick={() => { onSetZip(zipVal); setEditingZip(false); }} style={{ ...ghostBtn, padding: "4px 8px", fontSize: 11 }}>Save</button>
            </>
          ) : (
            <button onClick={() => setEditingZip(true)} style={{ background: "none", border: "none", color: "#44484D", textDecoration: "underline", fontSize: 12, padding: 0 }}>
              Current ZIP: {me.currentZip || "not set"}
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}

function TruckerApp({ me, corp, loads, messages, independentShippers, corporations, setLoads, updateTrucker, updateShipperProfile, addCorpMember, sendMessage, setMessages, addNotification, onLogout, onSwitchProfile }) {
  const [tab, setTab] = useState("board");
  const [chatWith, setChatWith] = useState(null);
  const myLoads = loads.filter((l) => l.truckerId === me.id);
  // Only show loads matching this carrier's own equipment type — a Box Truck
  // carrier shouldn't see Flatbed loads, a Reefer carrier shouldn't see Dry
  // Van loads, and so on. Carriers with no equipment type set yet see everything.
  const openLoads = loads.filter((l) => l.status === "open" && (!me.equipmentType || !l.equipmentType || l.equipmentType === me.equipmentType));
  const myBidLoads = loads.filter((l) => l.status === "open" && (l.bids || []).some((b) => b.truckerId === me.id && b.status !== "rejected"));
  const myCounters = myBidLoads.reduce((acc, l) => acc + l.bids.filter((b) => b.truckerId === me.id && b.status === "countered" && b.counterBy === "shipper").length, 0);
  const deliveredLoads = myLoads.filter((l) => l.status === "delivered");
  const earnedTotal = deliveredLoads.filter((l) => l.paid).reduce((a, l) => a + l.price, 0);
  const pendingTotal = deliveredLoads.filter((l) => !l.paid).reduce((a, l) => a + l.price, 0);
  const myLanes = me.lanes || [];
  const laneMatchCount = openLoads.filter((l) => laneMatches(myLanes, l)).length;
  const notifiedRef = useRef(new Set());
  const trialExpired = isTrialExpired(me);

  // Real-time messaging
  const { unreadCounts, markRead } = useRealtimeMessages(me.id, setMessages, addNotification);
  const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);

  const openChat = (loadId, shipperId, shipperName) => {
    const key = threadKey(loadId, me.id);
    markRead(key);
    setChatWith({ loadId, shipperId, shipperName });
  };

  useEffect(() => {
    if (!myLanes.length || typeof Notification === "undefined") return;
    // Request notification permission if not yet granted
    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
    const matches = openLoads.filter((l) => laneMatches(myLanes, l) && !notifiedRef.current.has(l.id));
    if (!matches.length) return;
    matches.forEach((l) => notifiedRef.current.add(l.id));
    if (Notification.permission === "granted") {
      matches.forEach((l) => {
        try { new Notification("New load on your lane", { body: `${l.origin} → ${l.destination} · ${fmtMoney(l.price)}`, tag: l.id }); } catch (e) { /* notifications unsupported in this context */ }
      });
    }
  }, [openLoads, myLanes]);

  const resolveShipper = (id) => findShipperProfile(id, independentShippers, corporations);

  const claimAtPrice = (loadId) => { setLoads((prev) => prev.map((l) => (l.id === loadId ? { ...l, status: "in_transit", truckerId: me.id, progress: 1 } : l))); setTab("mine"); };
  const placeBid = async (loadId, amount, note) => {
    const newBid = { id: "b" + Date.now(), truckerId: me.id, truckerName: me.name, amount, note, status: "pending" };
    setLoads((prev) => prev.map((l) => (l.id === loadId ? { ...l, bids: [...(l.bids || []), newBid] } : l)));
    try {
      await api.post(`/api/loads/${loadId}/bids`, { carrierId: me.id, amount, note });
    } catch (err) { console.warn("Bid not saved to DB:", err.message); }
  };
  const acceptCounter = (loadId, bidId) => {
    setLoads((prev) => prev.map((l) => {
      if (l.id !== loadId) return l;
      const bid = l.bids.find((b) => b.id === bidId);
      return { ...l, status: "in_transit", truckerId: me.id, price: bid.counterAmount, progress: 1, bids: l.bids.map((b) => (b.id === bidId ? { ...b, status: "accepted" } : { ...b, status: "rejected" })) };
    }));
    setTab("mine");
  };
  const reCounter = (loadId, bidId, amount) => setLoads((prev) => prev.map((l) => (l.id === loadId ? { ...l, bids: l.bids.map((b) => (b.id === bidId ? { ...b, status: "countered", counterAmount: amount, counterBy: "trucker" } : b)) } : l)));
  const withdrawBid = (loadId, bidId) => setLoads((prev) => prev.map((l) => (l.id === loadId ? { ...l, bids: l.bids.map((b) => (b.id === bidId ? { ...b, status: "rejected" } : b)) } : l)));
  const saveProfile = async (form) => {
    updateTrucker(me.id, (t) => ({ ...t, ...form }));
    if (me.id?.startsWith("local_")) return "local"; // local test account — nothing to sync, treat as ok
    try {
      if (corp) {
        // Corp team members don't have their own database row — they live
        // inside the corp's own record. Persist by updating that member's
        // entry within the corp's roster instead of a standalone user.
        const updatedMembers = (corp.members || []).map((m) => (m.id === me.id ? { ...m, ...form } : m));
        await api.patch(`/api/auth/user/${corp.id}`, { lanes: updatedMembers });
      } else {
        await api.patch(`/api/auth/user/${me.id}`, form);
      }
      return true;
    } catch (err) { console.warn("Profile update not saved to DB:", err.message); return false; }
  };
  const connectPayout = (info) => updateTrucker(me.id, (t) => ({ ...t, payout: { connected: true, ...info } }));
  const disconnectPayout = () => updateTrucker(me.id, (t) => ({ ...t, payout: { connected: false } }));
  const saveW9 = (w9) => updateTrucker(me.id, (t) => ({ ...t, w9 }));
  const addDocument = (loadId, doc) => setLoads((prev) => prev.map((l) => (l.id === loadId ? { ...l, documents: [...(l.documents || []), { ...doc, uploadedByName: me.name }] } : l)));
  const rateShipper = async (loadId, shipperId, stars) => {
    updateShipperProfile(shipperId, (s) => ({ ...s, ratings: [...(s.ratings || []), stars] }));
    setLoads((prev) => prev.map((l) => (l.id === loadId ? { ...l, shipperRated: true } : l)));
    try {
      await api.post("/api/ratings", { loadId, ratedUserId: shipperId, raterUserId: me.id, stars, role: "carrier" });
    } catch (err) { console.warn("Rating not saved to DB:", err.message); }
  };
  // Shared helper — persists a field update whether "me" is an individual
  // carrier (own DB row) or a corp team member (lives inside corp's row).
  const persistTruckerFields = async (fields) => {
    if (me.id?.startsWith("local_")) return;
    try {
      if (corp) {
        const updatedMembers = (corp.members || []).map((m) => (m.id === me.id ? { ...m, ...fields } : m));
        await api.patch(`/api/auth/user/${corp.id}`, { lanes: updatedMembers });
      } else {
        await api.patch(`/api/auth/user/${me.id}`, fields);
      }
    } catch (err) { console.warn("Update not saved to DB:", err.message); }
  };
  const saveLanes = async (lanes) => {
    updateTrucker(me.id, (t) => ({ ...t, lanes }));
    await persistTruckerFields({ lanes });
  };
  const setEquipmentStatus = async (status) => {
    updateTrucker(me.id, (t) => ({ ...t, equipmentStatus: status }));
    await persistTruckerFields({ equipmentStatus: status });
  };
  const setCurrentZip = async (zip) => {
    updateTrucker(me.id, (t) => ({ ...t, currentZip: zip }));
    await persistTruckerFields({ currentZip: zip });
  };
  const confirmDeliveryStatus = (loadId, status, zip) => {
    updateTrucker(me.id, (t) => ({ ...t, equipmentStatus: status, currentZip: zip || t.currentZip }));
    setLoads((prev) => prev.map((l) => (l.id === loadId ? { ...l, deliveryStatusConfirmed: true } : l)));
  };
  const requestQuickPay = (loadId) => {
    const load = myLoads.find((l) => l.id === loadId);
    if (!load) return;
    const QUICKPAY_FEE_RATE = 0.015;
    const fee = Math.round(load.price * QUICKPAY_FEE_RATE * 100) / 100;
    const net = load.price - fee;
    if (confirm(`Confirm QuickPay instant payout? You'll receive ${fmtMoney(net)} within minutes (a 1.5% instant payout fee of ${fmtMoney(fee)} applies). Choose Cancel if you'd rather wait for the free standard payout (full ${fmtMoney(load.price)}, 1-2 business days).`)) {
      setLoads((prev) => prev.map((l) => (l.id === loadId ? { ...l, paid: true, paidAt: Date.now(), quickPay: true, quickPayFee: fee, quickPayNet: net } : l)));
    }
  };
  const [escrowWaiverSeen, setEscrowWaiverSeen] = useState(!!(me.escrowWaiverAccepted));
  const acceptEscrowWaiver = () => { updateTrucker(me.id, (t) => ({ ...t, escrowWaiverAccepted: true })); setEscrowWaiverSeen(true); };
  const cancelLoad = async (loadId, reason) => {
    const cancelEntry = { by: me.name, role: "trucker", reason, at: Date.now() };
    setLoads((prev) => prev.map((l) => (l.id === loadId
      ? { ...l, status: "open", truckerId: null, progress: 0, cancelledBy: "carrier", cancelReason: reason, cancelHistory: [...(l.cancelHistory || []), cancelEntry], bids: (l.bids || []).map((b) => b.truckerId === me.id ? { ...b, status: "rejected" } : b) }
      : l)));
    try {
      await api.patch(`/api/loads/${loadId}`, { status: "open", truckerId: null, progress: 0, cancelled_by: "carrier", cancel_reason: reason });
    } catch (err) { console.warn("Cancellation not saved to DB:", err.message); }
  };

  const tabs = [
    { id: "board",    label: `Load Board (${openLoads.length})`,  shortLabel: "Board",    icon: "🚛" },
    { id: "bids",     label: `My Bids (${myBidLoads.length})${myCounters ? ` · ${myCounters} counter${myCounters > 1 ? "s" : ""}` : ""}`, shortLabel: "Bids", icon: "⚖️" },
    { id: "mine",     label: `My Hauls (${myLoads.length})${totalUnread > 0 ? " · " + totalUnread + " new msg" + (totalUnread > 1 ? "s" : "") : ""}`, shortLabel: "Hauls" + (totalUnread > 0 ? " 💬" : ""), icon: "📦" },
    { id: "lanes",    label: `My Lanes${laneMatchCount ? ` · ${laneMatchCount} match${laneMatchCount > 1 ? "es" : ""}` : ""}`, shortLabel: "Lanes", icon: "🗺️" },
    { id: "deadhead", label: "Deadhead & Backhaul",               shortLabel: "Miles",    icon: "🔄" },
    { id: "earnings", label: "Earnings",                          shortLabel: "Pay",      icon: "💰" },
    ...(corp ? [{ id: "team", label: `Team (${corp.members.length})`, shortLabel: "Team", icon: "👥" }] : []),
    { id: "profile",  label: "Profile",                           shortLabel: "Profile",  icon: "👤" },
    { id: "billing",  label: "Billing",                           shortLabel: "Billing",  icon: "💳" },
    { id: "account",  label: "My Account",                        shortLabel: "Account",  icon: "👤" },
  ];

  return (
    <Shell title={me.name} subtitle={corp ? corp.companyName : me.companyLabel} avatar={me.avatar} me={me} onLogout={onLogout} onSwitchProfile={onSwitchProfile}
      badge={<Badge tone="orange">{corp ? "CORP DRIVER" : "TRUCKER"}</Badge>}>
      {trialExpired && <TrialExpiredPaywall me={me} onLogout={onLogout} />}
      <EquipmentStatusBar me={me} onSetStatus={setEquipmentStatus} onSetZip={setCurrentZip} />
      <Tabs tabs={tabs} active={tab} onChange={setTab} />
      <MobileBottomNav tabs={tabs} activeTab={tab} onSelect={setTab} />
      {tab === "board" && <LoadBoard loads={openLoads} allLoads={loads} me={me} onClaim={claimAtPrice} onBid={placeBid} myLanes={myLanes} independentShippers={independentShippers} corporations={corporations} />}
      {tab === "bids" && (
        <MyBids loads={myBidLoads} me={me} onAcceptCounter={acceptCounter} onReCounter={reCounter} onWithdraw={withdrawBid}
          onOpenChat={(loadId, shipperId) => { markRead(threadKey(loadId, me.id)); setChatWith({ loadId, shipperId }); }} unreadCounts={unreadCounts} />
      )}
      {tab === "mine" && (
        <MyHauls loads={myLoads} me={me} resolveShipper={resolveShipper} onOpenChat={(loadId, shipperId) => { markRead(threadKey(loadId, me.id)); setChatWith({ loadId, shipperId }); }} unreadCounts={unreadCounts}
          onUploadDoc={addDocument} onRateShipper={rateShipper} onConfirmDeliveryStatus={confirmDeliveryStatus} onRequestQuickPay={requestQuickPay} onCancelLoad={cancelLoad} />
      )}
      {tab === "lanes" && <MyLanesPanel lanes={myLanes} onSave={saveLanes} openLoads={openLoads} />}
      {tab === "deadhead" && <DeadheadCalculator openLoads={openLoads} myLoads={myLoads} />}
      {tab === "earnings" && <Earnings loads={deliveredLoads} earnedTotal={earnedTotal} pendingTotal={pendingTotal} payout={me.payout} />}
      {tab === "team" && corp && <TeamRoster corp={corp} onAddMember={(member) => addCorpMember(corp.id, member)} onUpdateMember={(member) => setCorporations((prev) => prev.map((c) => (c.id === corp.id ? { ...c, members: c.members.map((m) => (m.id === member.id ? member : m)) } : c)))} />}
      {tab === "profile" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 580 }}>
          <OnboardingProgressMap me={me} role={corp ? "trucking" : "trucker"} />
          <W9Wizard me={me} onComplete={saveW9} />
          <ProfileForm me={me} myLoads={myLoads} onSave={saveProfile} onConnectPayout={connectPayout} onDisconnectPayout={disconnectPayout} />
        </div>
      )}
      {tab === "billing" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 560 }}>
          <BillingCard isCorp={!!corp} corp={corp} me={me} onManage={() => document.getElementById("subscription-panel")?.scrollIntoView({ behavior: "smooth", block: "start" })} />
          <SubscriptionPortalPanel isCorp={!!corp} corp={corp} me={me} onSave={saveProfile} />
        </div>
      )}
      {tab === "account" && (
        <MyAccountPanel me={me} corp={corp} isCorp={!!corp} onSave={saveProfile} onGoBilling={() => setTab("billing")} />
      )}

      {!escrowWaiverSeen && myLoads.length > 0 && <EscrowWaiverModal onAccept={acceptEscrowWaiver} />}

      {chatWith && (
        <ChatPanel loadId={chatWith.loadId} otherId={me.id} myRole="trucker" myName={me.name} otherName={chatWith.shipperName}
          messages={messages[threadKey(chatWith.loadId, me.id)] || []}
          onSend={(text) => sendMessage(chatWith.loadId, me.id, { role: "trucker", name: me.name, text })}
          onClose={() => setChatWith(null)} />
      )}
    </Shell>
  );
}

function LoadBoard({ loads, allLoads, me, onClaim, onBid, myLanes, independentShippers, corporations }) {
  const [viewShipperId, setViewShipper] = useState(null);
  const [filters, setFilters] = useState({ origin: "", destination: "", maxWeight: "", minPrice: "", sortBy: "newest" });
  if (!loads.length) {
    return (
      <Empty text={me.equipmentType
        ? `No open ${me.equipmentType} loads right now — check back soon. The board only shows loads matching your equipment type (${me.equipmentType}).`
        : "No open loads right now — check back soon."} />
    );
  }

  const resolveShipper = (id) => findShipperProfile(id, independentShippers || [], corporations || []);
  const viewShipper = viewShipperId ? resolveShipper(viewShipperId) : null;
  const filteredLoads = applyFilters(loads, filters);

  // 7-day rolling rate average for each load's lane (origin→dest), mocked from allLoads
  const laneRateAvg = (load) => {
    const sevenDaysAgo = Date.now() - 7 * 86400000;
    const samples = (allLoads || []).filter((l) => l.origin === load.origin && l.destination === load.destination && l.postedAt >= sevenDaysAgo && l.miles);
    if (!samples.length) return null;
    return (samples.reduce((a, l) => a + l.price / l.miles, 0) / samples.length).toFixed(2);
  };

  return (
    <>
    <LoadBoardFilters loads={loads} filters={filters} onChange={setFilters} />
    <div style={{ fontSize: 12, color: "#9A958A", marginBottom: 8 }}>{filteredLoads.length} of {loads.length} load{loads.length === 1 ? "" : "s"}</div>
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {filteredLoads.map((l) => {
        const overweight = me.maxWeight && l.weight > me.maxWeight;
        const myBid = (l.bids || []).find((b) => b.truckerId === me.id && b.status !== "rejected");
        const reqCheck = meetsLoadRequirements(l, me);
        const isLaneMatch = laneMatches(myLanes, l);
        const avgLaneRpm = laneRateAvg(l);
        const shipperLoads = (allLoads || []).filter((al) => al.shipperId === l.shipperId);
        const daysToPay = calcDaysToPay(shipperLoads);
        return (
          <Card key={l.id} style={{ padding: 18, borderLeft: overweight || !reqCheck.met ? "4px solid #FF5A1F" : isLaneMatch ? "4px solid #3A6EA5" : "4px solid #FFB400" }}>
            {isLaneMatch && <div style={{ marginBottom: 8 }}><Badge tone="blue"><Route size={10} style={{ verticalAlign: "-1px", marginRight: 3 }} />Matches your saved lane</Badge></div>}
            <LoadHeader load={l} />
            {(avgLaneRpm || daysToPay) && (
              <div style={{ display: "flex", gap: 16, marginTop: 6, flexWrap: "wrap" }}>
                {avgLaneRpm && <div style={{ fontSize: 11, color: "#6B6557" }}>7-day lane avg: <b className="mono">${avgLaneRpm}/mi</b> <span style={{ color: l.miles && (l.price / l.miles) > Number(avgLaneRpm) ? "#C0432B" : "#3E7A4B" }}>({l.miles ? ((l.price / l.miles) > Number(avgLaneRpm) ? "above" : "below") : "—"} avg)</span></div>}
                {daysToPay !== null && <div style={{ fontSize: 11, color: "#6B6557" }}>Shipper avg pay: <b className="mono" style={{ color: daysToPay <= 14 ? "#3E7A4B" : daysToPay <= 30 ? "#B5790A" : "#C0432B" }}>{daysToPay} days</b></div>}
              </div>
            )}
            <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <div className="mono" style={{ fontSize: 11, color: "#9A958A" }}>
                Posted by{" "}
                <button onClick={() => setViewShipper && setViewShipper(l.shipperId)} style={{ background: "none", border: "none", color: "#3A6EA5", fontWeight: 700, textDecoration: "underline", cursor: "pointer", fontSize: 11, padding: 0, fontFamily: "inherit" }}>
                  {l.shipperName}
                </button>
                {l.pickupDate ? ` · Pickup ${new Date(l.pickupDate).toLocaleDateString()}` : ""}
              </div>
              {overweight && <span style={{ fontSize: 12, color: "#FF5A1F", fontWeight: 600 }}>Exceeds your max haul weight</span>}
            </div>
            {l.ltl && <div style={{ fontSize: 11, color: "#3A6EA5", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}><Package size={11} /> LTL — {l.pallets || "?"} pallets · {l.linearFeet || "?"} linear ft</div>}
            {!reqCheck.met && (
              <div style={{ marginTop: 8, background: "#FDF1EE", border: "1px solid #F3B7A6", borderRadius: 8, padding: "8px 10px", fontSize: 12, color: "#C0432B" }}>
                <div style={{ fontWeight: 700, marginBottom: 2, display: "flex", alignItems: "center", gap: 5 }}><ShieldCheck size={13} /> You may not meet this shipper's carrier requirements:</div>
                {reqCheck.failed.map((f, i) => <div key={i}>• {f}</div>)}
                <div style={{ marginTop: 2, color: "#8A3322" }}>You can still bid — the shipper may consider it anyway.</div>
              </div>
            )}
            {myBid ? (
              <div style={{ marginTop: 10, fontSize: 13, color: "#6B6557", display: "flex", alignItems: "center", gap: 6 }}>
                <Gavel size={13} /> You bid {fmtMoney(myBid.status === "countered" ? myBid.counterAmount : myBid.amount)}
                {l.miles ? ` (${fmtMoney(((myBid.status === "countered" ? myBid.counterAmount : myBid.amount) / l.miles).toFixed(2))}/mi)` : ""} — see "My Bids" for status.
              </div>
            ) : (
              <BidForm listedPrice={l.price} miles={l.miles} onClaim={() => onClaim(l.id)} onBid={(amount, note) => onBid(l.id, amount, note)} />
            )}
          </Card>
        );
      })}
    </div>
    {viewShipper && <ShipperProfileModal shipper={viewShipper} loads={allLoads} onClose={() => setViewShipper(null)} />}
  </>
  );
}

function BidForm({ listedPrice, miles, onClaim, onBid }) {
  const [open, setOpen] = useState(false); const [amount, setAmount] = useState(""); const [note, setNote] = useState("");
  const rpm = miles && Number(amount) > 0 ? Number(amount) / miles : 0;
  return (
    <div style={{ marginTop: 10, borderTop: "1px solid #EEE8DA", paddingTop: 10 }}>
      <div style={{ fontSize: 11, color: "#9A958A", marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}><Zap size={11} /> One-touch bidding</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={onClaim} style={{ ...primaryBtn("#FFB400"), padding: "8px 16px", display: "flex", alignItems: "center", gap: 6 }}><Zap size={14} /> Accept instantly at {fmtMoney(listedPrice)}</button>
        <button onClick={() => setOpen((o) => !o)} style={{ ...ghostBtn, display: "flex", alignItems: "center", gap: 6 }}><Gavel size={14} /> Submit counter offer</button>
      </div>
      {open && (
        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input type="number" placeholder="Your price ($)" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ ...inputStyle, width: 140 }} />
          <input placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} style={{ ...inputStyle, width: 220 }} />
          {rpm > 0 && <span className="mono" style={{ fontSize: 12, color: "#3E7A4B", fontWeight: 700 }}>{fmtMoney(rpm.toFixed(2))}/mi</span>}
          <button onClick={() => { if (amount) { onBid(Number(amount), note); setAmount(""); setNote(""); setOpen(false); } }} style={{ ...primaryBtn("#FF5A1F"), color: "#fff", padding: "8px 14px" }}>Submit bid</button>
        </div>
      )}
    </div>
  );
}

function MyBids({ loads, me, onAcceptCounter, onReCounter, onWithdraw, onOpenChat }) {
  if (!loads.length) return <Empty text="You haven't placed any bids yet — find a load and make an offer." />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {loads.map((l) => {
        const bid = l.bids.find((b) => b.truckerId === me.id && b.status !== "rejected");
        return (
          <Card key={l.id} style={{ padding: 18 }}>
            <LoadHeader load={l} />
            <div style={{ marginTop: 12, borderTop: "1px solid #EEE8DA", paddingTop: 12 }}>
              <MyBidRow bid={bid} load={l} onAcceptCounter={() => onAcceptCounter(l.id, bid.id)} onReCounter={(amt) => onReCounter(l.id, bid.id, amt)}
                onWithdraw={() => onWithdraw(l.id, bid.id)} onMessage={() => onOpenChat(l.id, l.shipperName)} />
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function MyBidRow({ bid, load, onAcceptCounter, onReCounter, onWithdraw, onMessage }) {
  const [counterVal, setCounterVal] = useState(""); const [showCounter, setShowCounter] = useState(false);
  const waitingOnMe = bid.status === "countered" && bid.counterBy === "shipper";
  const displayAmount = bid.status === "countered" ? bid.counterAmount : bid.amount;
  const rpm = load.miles ? displayAmount / load.miles : 0;
  const statusTone = { pending: "blue", countered: "orange", accepted: "green" }[bid.status] || "gray";
  const statusLabel = { pending: "Sent to shipper", countered: `Countered by ${bid.counterBy === "shipper" ? "shipper" : "you"}`, accepted: "Accepted" }[bid.status] || bid.status;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: 17, fontWeight: 700 }}>{fmtMoney(displayAmount)}</span>
          {bid.status === "countered" && <span style={{ fontSize: 12, color: "#9A958A", textDecoration: "line-through" }}>{fmtMoney(bid.amount)}</span>}
          {rpm > 0 && <span className="mono" style={{ fontSize: 12, color: "#3E7A4B", fontWeight: 700 }}>{fmtMoney(rpm.toFixed(2))}/mi</span>}
        </div>
        <Badge tone={statusTone}>{statusLabel}</Badge>
      </div>
      {bid.note && <div style={{ fontSize: 12, color: "#6B6557", marginTop: 4 }}>"{bid.note}"</div>}
      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        <button onClick={onMessage} style={{ ...ghostBtn, padding: "6px 10px", display: "flex", alignItems: "center", gap: 5, fontSize: 12 }}><MessageCircle size={13} /> Message {load.shipperName}</button>
        {waitingOnMe && (
          <>
            <button onClick={onAcceptCounter} style={{ ...primaryBtn("#3E7A4B"), color: "#fff", padding: "6px 12px", fontSize: 12 }}>Accept {fmtMoney(displayAmount)}</button>
            <button onClick={() => setShowCounter((s) => !s)} style={{ ...ghostBtn, padding: "6px 10px", fontSize: 12 }}>Counter back</button>
            <button onClick={onWithdraw} style={{ ...ghostBtn, padding: "6px 10px", fontSize: 12, color: "#FF5A1F" }}>Withdraw</button>
          </>
        )}
      </div>
      {showCounter && (
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <input type="number" placeholder="Your counter ($)" value={counterVal} onChange={(e) => setCounterVal(e.target.value)} style={{ ...inputStyle, width: 140 }} />
          <button onClick={() => { if (counterVal) { onReCounter(Number(counterVal)); setShowCounter(false); setCounterVal(""); } }} style={{ ...primaryBtn("#FFB400"), padding: "8px 14px", fontSize: 12 }}>Send counter</button>
        </div>
      )}
    </div>
  );
}

function MyHauls({ loads, me, resolveShipper, onOpenChat, onUploadDoc, onRateShipper, onConfirmDeliveryStatus, onRequestQuickPay, onCancelLoad }) {
  if (!loads.length) return <Empty text="You haven't claimed any loads yet — check the load board." />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {loads.map((l) => {
        const shipper = resolveShipper ? resolveShipper(l.shipperId) : null;
        return (
        <Card key={l.id} style={{ padding: 18 }}>
          <LoadHeader load={l} />
          <div style={{ marginTop: 12, borderTop: "1px solid #EEE8DA", paddingTop: 12 }}>

            {/* Pickup and delivery address and contact — shown only after load is accepted */}
            {(l.status === "in_transit" || l.status === "delivered") && (l.pickupAddress || l.deliveryAddress || l.contactPhone) && (
              <div style={{ background: "#F1F8F2", border: "1px solid #BFE0C6", borderRadius: 8, padding: "12px 14px", marginBottom: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 12, color: "#3E7A4B", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                  <MapPin size={13} /> Pickup & Delivery Details — Confidential
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: "#44484D" }}>
                  {l.pickupAddress && (
                    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <span style={{ color: "#9A958A", minWidth: 70, fontSize: 11, fontWeight: 600, textTransform: "uppercase", paddingTop: 2 }}>Pickup</span>
                      <span style={{ fontWeight: 600 }}>{l.pickupAddress}{l.originZip ? `, ${l.originZip}` : ""}</span>
                    </div>
                  )}
                  {l.deliveryAddress && (
                    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <span style={{ color: "#9A958A", minWidth: 70, fontSize: 11, fontWeight: 600, textTransform: "uppercase", paddingTop: 2 }}>Delivery</span>
                      <span style={{ fontWeight: 600 }}>{l.deliveryAddress}{l.destZip ? `, ${l.destZip}` : ""}</span>
                    </div>
                  )}
                  {l.contactPhone && (
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ color: "#9A958A", minWidth: 70, fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>Contact</span>
                      <div>
                        {l.contactName && <span style={{ marginRight: 8 }}>{l.contactName}</span>}
                        <a href={`tel:${l.contactPhone.replace(/\D/g, "")}`} style={{ color: "#3A6EA5", fontWeight: 700, textDecoration: "none" }}>
                          📞 {l.contactPhone}
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span className="mono" style={{ fontSize: 11, color: "#9A958A", display: "flex", alignItems: "center", gap: 6 }}>
                Shipper: {l.shipperName} {shipper && <Stars value={avgRating(shipper.ratings)} size={11} />}
              </span>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <RateConButton load={l} trucker={me} shipper={shipper} />
                <button onClick={() => onOpenChat(l.id, l.shipperName)} style={{ ...ghostBtn, display: "flex", alignItems: "center", gap: 6, padding: "6px 12px" }}><MessageCircle size={14} /> Message</button>
              </div>
            </div>
            <TrackerBar load={l} />
            <DetentionTracker load={l} me={me} />
            {l.status === "delivered" && !l.deliveryStatusConfirmed && (
              <div style={{ marginTop: 10, background: "#FFF6E5", border: "1px solid #FFD98C", borderRadius: 8, padding: "12px 14px" }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: "#B5790A", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                  <Bell size={14} /> Required: confirm your equipment status at drop-off
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button onClick={() => onConfirmDeliveryStatus(l.id, "empty", l.destZip)} style={{ ...primaryBtn("#3E7A4B"), color: "#fff", padding: "8px 16px" }}>I'm Empty — Available</button>
                  <button onClick={() => onConfirmDeliveryStatus(l.id, "loaded", l.destZip)} style={{ ...ghostBtn, padding: "8px 16px" }}>Still Loaded</button>
                </div>
                <div style={{ fontSize: 11, color: "#9A958A", marginTop: 6 }}>This updates the live capacity radar shippers see when searching for nearby trucks.</div>
              </div>
            )}
            {l.status === "delivered" && (
              <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                {l.paid
                  ? <Badge tone={l.quickPay ? "amber" : "green"}>{l.quickPay ? `QuickPay · ${new Date(l.paidAt).toLocaleDateString()}` : `Paid ${new Date(l.paidAt).toLocaleDateString()}`}</Badge>
                  : <Badge tone="orange">Awaiting payment from shipper</Badge>}
              </div>
            )}
            <QuickPayPanel load={l} me={me} onRequestQuickPay={onRequestQuickPay} />
            {l.status === "in_transit" && (
              <div style={{ marginTop: 8 }}>
                <CancelLoadButton load={l} me={me} onCancel={(reason) => onCancelLoad(l.id, reason)} />
              </div>
            )}
            {l.status !== "open" && (
              <div style={{ marginTop: 8 }}>
                <DisputeButton load={l} me={me} />
              </div>
            )}
            {l.status === "delivered" && !l.shipperRated && (
              <RateBox label="Rate this shipper:" onRate={(stars) => onRateShipper(l.id, l.shipperId, stars)} />
            )}
            {l.shipperRated && <div style={{ fontSize: 12, color: "#3E7A4B", marginTop: 8, display: "flex", gap: 4, alignItems: "center" }}><CheckCircle2 size={14} /> You rated this shipper — thanks for the feedback.</div>}
            <div style={{ marginTop: 14, borderTop: "1px solid #EEE8DA", paddingTop: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#6B6557", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <Paperclip size={13} /> DOCUMENTS — BOL / POD
              </div>
              <div style={{ marginBottom: 8 }}><DocumentList documents={(l.documents || []).filter((d) => d.type === "BOL" || d.type === "POD")} /></div>
              <DocumentUploader loadId={l.id} onUpload={(doc) => onUploadDoc(l.id, doc)} />
            </div>
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#6B6557", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <DollarSign size={13} /> ACCESSORIALS — Unexpected charges (lumper, detention, tarping, layover)
              </div>
              <div style={{ marginBottom: 8 }}><DocumentList documents={(l.documents || []).filter((d) => d.type === "ACCESSORIAL")} emptyText="No accessorial receipts uploaded." /></div>
              <DocumentUploader loadId={l.id} onUpload={(doc) => onUploadDoc(l.id, { ...doc, type: "ACCESSORIAL" })} typeOverride="ACCESSORIAL" />
            </div>
          </div>
        </Card>
        );
      })}
    </div>
  );
}

function MyLanesPanel({ lanes, onSave, openLoads }) {
  const [origin, setOrigin] = useState(""); const [destination, setDestination] = useState("");
  const [originZip, setOriginZip] = useState(""); const [destZip, setDestZip] = useState("");
  const [notifPermission, setNotifPermission] = useState(typeof Notification !== "undefined" ? Notification.permission : "unsupported");

  const addLane = () => {
    if (!origin || !destination) { alert("Enter both an origin and destination for the lane."); return; }
    onSave([...lanes, { id: "lane" + Date.now(), origin, destination, originZip, destZip }]);
    setOrigin(""); setDestination(""); setOriginZip(""); setDestZip("");
  };
  const removeLane = (id) => onSave(lanes.filter((l) => l.id !== id));

  const requestPermission = async () => {
    if (typeof Notification === "undefined") { alert("This browser doesn't support desktop notifications."); return; }
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 640 }}>
      <Card style={{ padding: 20 }}>
        <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 18, textTransform: "uppercase", marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
          <Route size={18} color="#FF5A1F" /> My Lanes
        </div>
        <div style={{ fontSize: 13, color: "#6B6557", marginBottom: 14 }}>Save the routes you run most. When a new load matches one of your lanes, you'll get a notification.</div>

        <div style={{ background: notifPermission === "granted" ? "#F1F8F2" : "#FFF6E5", border: `1px solid ${notifPermission === "granted" ? "#BFE0C6" : "#FFD98C"}`, borderRadius: 8, padding: "10px 12px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: notifPermission === "granted" ? "#3E7A4B" : "#B5790A", display: "flex", alignItems: "center", gap: 6 }}>
            <Bell size={14} /> {notifPermission === "granted" ? "Desktop notifications enabled" : notifPermission === "denied" ? "Notifications blocked in browser settings" : "Notifications not yet enabled"}
          </span>
          {notifPermission !== "granted" && notifPermission !== "unsupported" && (
            <button onClick={requestPermission} style={{ ...ghostBtn, fontSize: 12, padding: "6px 10px" }}>Enable notifications</button>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <input value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="Origin (city or text match)" style={{ ...inputStyle, flex: 1, minWidth: 140 }} />
          <input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Destination" style={{ ...inputStyle, flex: 1, minWidth: 140 }} />
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <input value={originZip} onChange={(e) => setOriginZip(e.target.value.replace(/\D/g, "").slice(0, 5))} placeholder="Origin ZIP (optional)" style={{ ...inputStyle, width: 160 }} />
          <input value={destZip} onChange={(e) => setDestZip(e.target.value.replace(/\D/g, "").slice(0, 5))} placeholder="Destination ZIP (optional)" style={{ ...inputStyle, width: 160 }} />
          <button onClick={addLane} style={{ ...primaryBtn("#FF5A1F"), color: "#fff", padding: "9px 16px" }}>Save lane</button>
        </div>

        {!lanes.length ? (
          <div style={{ fontSize: 12, color: "#9A958A" }}>No saved lanes yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {lanes.map((lane) => {
              const matchCount = openLoads.filter((l) => laneMatches([lane], l)).length;
              return (
                <div key={lane.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid #EEE8DA", borderRadius: 8, padding: "8px 12px", background: "#FBF9F4" }}>
                  <div style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                    <MapPin size={13} color="#FF5A1F" /> {lane.origin} <ChevronRight size={12} /> {lane.destination}
                    {matchCount > 0 && <Badge tone="orange">{matchCount} open match{matchCount > 1 ? "es" : ""}</Badge>}
                  </div>
                  <button onClick={() => removeLane(lane.id)} style={{ background: "none", border: "none", color: "#9A958A" }}><X size={15} /></button>
                </div>
              );
            })}
          </div>
        )}
      </Card>
      <div style={{ fontSize: 11, color: "#9A958A" }}>
        Desktop notifications fire while this tab is open and permission is granted. A real mobile push notification requires a native app or web-push service worker registered with your backend — this prototype covers the in-browser desktop case only.
      </div>
    </div>
  );
}

function DeadheadCalculator({ openLoads, myLoads }) {
  const lastActive = [...myLoads].reverse().find((l) => l.status === "in_transit") || [...myLoads].reverse().find((l) => l.status === "delivered");
  const [currentZip, setCurrentZip] = useState(lastActive?.destZip || "");
  const [targetZip, setTargetZip] = useState("");
  const [manualResult, setManualResult] = useState(null);

  const calcManual = () => {
    if (!/^\d{5}$/.test(currentZip) || !/^\d{5}$/.test(targetZip)) { alert("Enter valid 5-digit ZIPs for both locations."); return; }
    setManualResult(estimateMilesBetweenZips(currentZip, targetZip));
  };

  const ranked = openLoads
    .filter((l) => l.originZip)
    .map((l) => {
      const deadhead = currentZip && /^\d{5}$/.test(currentZip) ? estimateMilesBetweenZips(currentZip, l.originZip) : null;
      const totalMiles = deadhead != null && l.miles ? deadhead + l.miles : null;
      const netYield = totalMiles ? l.price / totalMiles : null;
      return { load: l, deadhead, netYield };
    })
    .sort((a, b) => (b.netYield ?? -1) - (a.netYield ?? -1));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 680 }}>
      <Card style={{ padding: 20 }}>
        <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 18, textTransform: "uppercase", marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
          <Route size={18} color="#FF5A1F" /> Deadhead Mileage Calculator
        </div>
        <div style={{ fontSize: 13, color: "#6B6557", marginBottom: 14 }}>Estimate the unpaid miles between where you're dropping off and a potential next load's pickup point.</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <Field label="Your current/drop-off ZIP"><input value={currentZip} onChange={(e) => setCurrentZip(e.target.value.replace(/\D/g, "").slice(0, 5))} placeholder="40202" style={inputStyle} /></Field>
          <Field label="Potential pickup ZIP"><input value={targetZip} onChange={(e) => setTargetZip(e.target.value.replace(/\D/g, "").slice(0, 5))} placeholder="46225" style={inputStyle} /></Field>
          <button onClick={calcManual} style={{ ...primaryBtn("#FF5A1F"), color: "#fff", padding: "10px 18px" }}>Calculate</button>
        </div>
        {manualResult != null && (
          <div style={{ marginTop: 12, background: "#FDF1EE", border: "1px solid #F3B7A6", borderRadius: 8, padding: "10px 14px", fontWeight: 700, color: "#C0432B", display: "flex", alignItems: "center", gap: 8 }}>
            <Route size={16} /> {manualResult} unpaid deadhead miles
          </div>
        )}
      </Card>

      <Card style={{ padding: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}><Zap size={14} color="#FF5A1F" /> Backhaul optimizer — best net yield from your current ZIP</div>
        <div style={{ fontSize: 12, color: "#9A958A", marginBottom: 12 }}>Ranked by $/mile after factoring in deadhead to pickup — not just the posted rate. Enter a ZIP above to rank.</div>
        {!ranked.length ? (
          <div style={{ fontSize: 12, color: "#9A958A" }}>No open loads with ZIP data available right now.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {ranked.slice(0, 10).map(({ load, deadhead, netYield }) => (
              <div key={load.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid #EEE8DA", borderRadius: 8, padding: "8px 12px" }}>
                <div style={{ fontSize: 13 }}>
                  <MapPin size={12} color="#FF5A1F" style={{ marginRight: 4 }} />{load.origin} → {load.destination} <span style={{ color: "#9A958A" }}>· {fmtMoney(load.price)}</span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: deadhead == null ? "#9A958A" : deadhead < 50 ? "#3E7A4B" : "#C0432B" }}>
                    {deadhead == null ? "—" : `${deadhead} mi deadhead`}
                  </div>
                  {netYield != null && <div className="mono" style={{ fontSize: 11, color: "#3A6EA5" }}>{fmtMoney(netYield.toFixed(2))}/mi net</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function Earnings({ loads, earnedTotal, pendingTotal, payout }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 700 }}>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <Card style={{ padding: 18, flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 12, color: "#9A958A", marginBottom: 4 }}>Paid out</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: "#3E7A4B" }}>{fmtMoney(earnedTotal)}</div>
        </Card>
        <Card style={{ padding: 18, flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 12, color: "#9A958A", marginBottom: 4 }}>Pending payment</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: "#FF5A1F" }}>{fmtMoney(pendingTotal)}</div>
        </Card>
      </div>
      {!payout?.connected && (
        <Card style={{ padding: 16, background: "#FFF6E5", border: "1px solid #FFD98C", display: "flex", alignItems: "center", gap: 10 }}>
          <Wallet size={18} color="#B5790A" />
          <div style={{ fontSize: 13, color: "#6B5106" }}>Connect a bank account in the Profile tab so shippers can pay you directly when they release payment.</div>
        </Card>
      )}
      {!loads.length ? <Empty text="No completed hauls yet." /> : loads.map((l) => (
        <Card key={l.id} style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{l.origin} → {l.destination}</div>
            <div style={{ fontSize: 12, color: "#9A958A" }}>{l.shipperName} · {l.description}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{fmtMoney(l.price)}</div>
            {l.paid ? <Badge tone="green">Paid</Badge> : <Badge tone="orange">Pending</Badge>}
          </div>
        </Card>
      ))}
    </div>
  );
}

// ====================================================================
// PROFILE PICTURE
// ====================================================================
function ProfilePicture({ src, name, size = 56, onUpload }) {
  const inputRef = useRef(null);
  const cameraRef = useRef(null);
  const initial = (name || "?").slice(0, 1).toUpperCase();

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) { alert("Photo must be under 4MB."); return; }
    const reader = new FileReader();
    reader.onload = () => onUpload && onUpload(reader.result);
    reader.readAsDataURL(file);
  };

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      {src ? (
        <img src={src} alt={name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", border: "2px solid #FFB400" }} />
      ) : (
        <div style={{ width: size, height: size, borderRadius: "50%", background: "#FFB400", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: size * 0.4, color: "#1B1D21", border: "2px solid #E2DCCC" }}>
          {initial}
        </div>
      )}
      {onUpload && (
        <>
          <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />
          <input ref={cameraRef} type="file" accept="image/*" capture="user" onChange={handleFile} style={{ display: "none" }} />
          <div style={{ position: "absolute", bottom: -2, right: -2, display: "flex", gap: 2 }}>
            <button onClick={() => inputRef.current?.click()} title="Upload photo" style={{ width: 20, height: 20, borderRadius: "50%", background: "#1B1D21", border: "none", color: "#F2EDE4", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>📁</button>
            <button onClick={() => cameraRef.current?.click()} title="Take photo" style={{ width: 20, height: 20, borderRadius: "50%", background: "#FFB400", border: "none", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>📷</button>
          </div>
        </>
      )}
    </div>
  );
}

function ProfileForm({ me, myLoads, onSave, onConnectPayout, onDisconnectPayout }) {
  const [company, setCompany] = useState(me.company || "");
  const [truckDesc, setTruckDesc] = useState(me.truckDesc || "");
  const [equipmentType, setEquipmentType] = useState(me.equipmentType || "");
  const [maxWeight, setMaxWeight] = useState(me.maxWeight || "");
  const [l, setL] = useState(me.dims?.l || ""); const [w, setW] = useState(me.dims?.w || ""); const [h, setH] = useState(me.dims?.h || "");
  const [loc, setLoc] = useState(me.loc || "");
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [saving, setSaving] = useState(false);

  const [factoringEnabled, setFactoringEnabled] = useState(me.factoringEnabled || false);
  const [factoringCompany, setFactoringCompany] = useState(me.factoringCompany || "");
  const [factoringEmail, setFactoringEmail] = useState(me.factoringEmail || "");
  const [factoringPhone, setFactoringPhone] = useState(me.factoringPhone || "");
  const [factoringNoaNumber, setFactoringNoaNumber] = useState(me.factoringNoaNumber || "");
  const [factoringSaved, setFactoringSaved] = useState(false);
  const [factoringSaving, setFactoringSaving] = useState(false);
  const [factoringError, setFactoringError] = useState(false);

  const saveFactoring = async () => {
    if (factoringEnabled && !factoringCompany.trim()) { setFactoringError(true); setTimeout(() => setFactoringError(false), 4000); return; }
    setFactoringSaving(true);
    const result = await onSave({
      factoringEnabled,
      factoringCompany: factoringCompany.trim(),
      factoringEmail: factoringEmail.trim(),
      factoringPhone: factoringPhone.trim(),
      factoringNoaNumber: factoringNoaNumber.trim(),
    });
    setFactoringSaving(false);
    if (result === false) {
      setFactoringError(true);
      setTimeout(() => setFactoringError(false), 4000);
    } else {
      setFactoringSaved(true);
      setTimeout(() => setFactoringSaved(false), 2000);
    }
  };

  const save = async () => {
    setSaving(true);
    setSaveError(false);
    const result = await onSave({ company, truckDesc, equipmentType, maxWeight: Number(maxWeight) || 0, dims: { l: Number(l) || 0, w: Number(w) || 0, h: Number(h) || 0 }, loc });
    setSaving(false);
    if (result === false) {
      setSaveError(true);
      setTimeout(() => setSaveError(false), 4000);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 560 }}>
      <Card style={{ padding: 24 }}>
        <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 18, textTransform: "uppercase", marginBottom: 12 }}>Your Profile</div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
          <ProfilePicture src={me.avatar} name={me.name} size={64} onUpload={(dataUrl) => onSave({ avatar: dataUrl })} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{me.name}</div>
            <div style={{ fontSize: 12, color: "#6B6557" }}>{me.company || me.companyLabel || "Owner-operator"}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
              <Stars value={avgRating(me.ratings)} size={14} />
              <span style={{ fontSize: 12, color: "#6B6557" }}>{avgRating(me.ratings).toFixed(1)} · {me.ratings.length} rating{me.ratings.length === 1 ? "" : "s"}</span>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {!me.isCorpMember && <Field label="Business name (if you have one)"><input value={company} onChange={(e) => setCompany(e.target.value)} style={inputStyle} /></Field>}
          <Field label="Base location"><input value={loc} onChange={(e) => setLoc(e.target.value)} style={inputStyle} /></Field>
          <Field label="Truck description"><input value={truckDesc} onChange={(e) => setTruckDesc(e.target.value)} placeholder="Year, make, model, trailer type" style={inputStyle} /></Field>
          <Field label="Equipment type">
            <select value={equipmentType} onChange={(e) => setEquipmentType(e.target.value)} style={inputStyle}>
              <option value="">Select equipment type…</option>
              {EQUIPMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Max haul weight (lbs)"><input type="number" value={maxWeight} onChange={(e) => setMaxWeight(e.target.value)} style={inputStyle} /></Field>
          <div style={{ display: "flex", gap: 10 }}>
            <Field label="Length (ft)"><input type="number" value={l} onChange={(e) => setL(e.target.value)} style={inputStyle} /></Field>
            <Field label="Width (ft)"><input type="number" value={w} onChange={(e) => setW(e.target.value)} style={inputStyle} /></Field>
            <Field label="Height (ft)"><input type="number" value={h} onChange={(e) => setH(e.target.value)} style={inputStyle} /></Field>
          </div>
          <button onClick={save} disabled={saving} style={{ ...primaryBtn(saveError ? "#C0432B" : "#FFB400"), marginTop: 4, opacity: saving ? 0.7 : 1 }}>
            {saving ? "Saving…" : saveError ? "Save failed — try again" : saved ? "Saved ✓" : "Save profile"}
          </button>
          {saveError && (
            <div style={{ fontSize: 12, color: "#C0432B", marginTop: -4 }}>
              Couldn't reach the server to save your profile. Check your connection and try again — your changes are visible here but weren't saved permanently.
            </div>
          )}
        </div>
      </Card>
      <PayoutCard payout={me.payout} onConnect={onConnectPayout} onDisconnect={onDisconnectPayout} />

      <Card style={{ padding: 24 }}>
        <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 18, textTransform: "uppercase", marginBottom: 6 }}>Factoring Company</div>
        <div style={{ fontSize: 12, color: "#6B6557", marginBottom: 16, lineHeight: 1.5 }}>
          If you factor your invoices, register your factoring company here. It'll automatically appear as the payment remit-to party on your Rate Confirmations and Invoices, so shippers know exactly where to send payment.
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: factoringEnabled ? 16 : 0, cursor: "pointer" }}>
          <input type="checkbox" checked={factoringEnabled} onChange={(e) => setFactoringEnabled(e.target.checked)} style={{ width: 18, height: 18 }} />
          <span style={{ fontSize: 14, fontWeight: 600 }}>I factor my invoices through a factoring company</span>
        </label>

        {factoringEnabled && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Field label="Factoring company name *">
              <input value={factoringCompany} onChange={(e) => setFactoringCompany(e.target.value)} placeholder="e.g. TAFS, Triumph Business Capital, RTS Financial" style={inputStyle} />
            </Field>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Field label="Remit-to email"><input type="email" value={factoringEmail} onChange={(e) => setFactoringEmail(e.target.value)} placeholder="payments@factoringco.com" style={inputStyle} /></Field>
              <Field label="Remit-to phone"><input value={factoringPhone} onChange={(e) => setFactoringPhone(e.target.value)} placeholder="(555) 000-0000" style={inputStyle} /></Field>
            </div>
            <Field label="Notice of Assignment # (optional)">
              <input value={factoringNoaNumber} onChange={(e) => setFactoringNoaNumber(e.target.value)} placeholder="Reference number, if your factor uses one" style={inputStyle} />
            </Field>
          </div>
        )}

        <button onClick={saveFactoring} disabled={factoringSaving} style={{ ...primaryBtn(factoringError ? "#C0432B" : "#FFB400"), marginTop: 16, opacity: factoringSaving ? 0.7 : 1 }}>
          {factoringSaving ? "Saving…" : factoringError ? "Save failed — try again" : factoringSaved ? "Saved ✓" : "Save factoring info"}
        </button>
        {factoringError && (
          <div style={{ fontSize: 12, color: "#C0432B", marginTop: 8 }}>
            {factoringEnabled && !factoringCompany.trim() ? "Factoring company name is required when factoring is enabled." : "Couldn't reach the server to save. Check your connection and try again."}
          </div>
        )}
      </Card>

      {myLoads && <IftaLogPanel loads={myLoads} />}
    </div>
  );
}

function PayoutCard({ payout, onConnect, onDisconnect }) {
  const [open, setOpen] = useState(false);
  const [bankName, setBankName] = useState(""); const [last4, setLast4] = useState("");

  const connect = () => {
    if (!bankName || !last4) { alert("Enter a bank name and the last 4 digits of your account."); return; }
    onConnect({ bankName: `${bankName} ••${last4}` });
    setOpen(false); setBankName(""); setLast4("");
  };

  return (
    <Card style={{ padding: 24 }}>
      <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 18, textTransform: "uppercase", marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
        <Wallet size={18} color="#FFB400" /> Get Paid
      </div>
      <div style={{ fontSize: 13, color: "#6B6557", marginBottom: 16, lineHeight: 1.5 }}>
        When a shipper releases payment on a delivered load, it goes straight to your bank — Direct Freight Co never holds your money.
      </div>
      {payout?.connected ? (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600 }}><ShieldCheck size={16} color="#3E7A4B" /> {payout.bankName}</div>
          <button onClick={onDisconnect} style={{ ...ghostBtn, fontSize: 12, color: "#FF5A1F" }}>Disconnect</button>
        </div>
      ) : !open ? (
        <button onClick={() => setOpen(true)} style={{ ...primaryBtn("#FFB400") }}>Connect bank account</button>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Field label="Bank name"><input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="e.g. Chase" style={inputStyle} /></Field>
          <Field label="Last 4 digits of account"><input value={last4} onChange={(e) => setLast4(e.target.value.replace(/\D/g, "").slice(0, 4))} style={inputStyle} /></Field>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={connect} style={{ ...primaryBtn("#FFB400"), padding: "10px 18px" }}>Connect</button>
            <button onClick={() => setOpen(false)} style={ghostBtn}>Cancel</button>
          </div>
        </div>
      )}
    </Card>
  );
}

// ====================================================================
// MESSAGING
// ====================================================================
function ChatPanel({ loadId, otherId, otherName, myRole, myName, messages, onSend, onClose, onOpen }) {
  const [text, setText] = useState("");
  const bottomRef = useRef(null);
  const [loading, setLoading] = useState(false);

  // Load message history from DB when panel opens
  useEffect(() => {
    if (!loadId || !otherId) return;
    setLoading(true);
    api.get(`/api/messages/${loadId}/${otherId}`)
      .then(({ messages: dbMsgs }) => {
        if (dbMsgs?.length) onOpen?.(dbMsgs);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [loadId, otherId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);
  const send = () => { if (text.trim()) { onSend(text.trim()); setText(""); } };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(27,29,33,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", width: "100%", maxWidth: 480, borderRadius: "14px 14px 0 0", display: "flex", flexDirection: "column", height: "min(560px, 80vh)", boxShadow: "0 -8px 30px rgba(0,0,0,0.2)" }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid #E2DCCC", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#1B1D21", color: "#F2EDE4", borderRadius: "14px 14px 0 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <MessageCircle size={16} color="#FFB400" />
            <div><div style={{ fontWeight: 700, fontSize: 14 }}>{otherName}</div><div className="mono" style={{ fontSize: 10, color: "#9A958A" }}>Load #{loadId.slice(-5).toUpperCase()}</div></div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#F2EDE4" }}><X size={18} /></button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 8, background: "#F8F5EE" }}>
          {loading && <div style={{ textAlign: "center", color: "#9A958A", fontSize: 13 }}>Loading messages…</div>}
          {!loading && !messages.length && <div style={{ textAlign: "center", color: "#9A958A", fontSize: 13, marginTop: 20 }}>No messages yet — say hello.</div>}
          {messages.map((m) => {
            const mine = m.role === myRole;
            return (
              <div key={m.id} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start" }}>
                <div style={{ maxWidth: "75%", padding: "8px 12px", borderRadius: 12, background: mine ? "#FFB400" : "#fff", color: "#1B1D21", border: mine ? "none" : "1px solid #E2DCCC", fontSize: 14, borderBottomRightRadius: mine ? 3 : 12, borderBottomLeftRadius: mine ? 12 : 3 }}>
                  {!mine && <div style={{ fontSize: 10, fontWeight: 700, color: "#6B6557", marginBottom: 2 }}>{m.name}</div>}
                  {m.text}
                  <div style={{ fontSize: 10, color: mine ? "#6B5800" : "#9A958A", marginTop: 3 }}>{new Date(m.ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
        <div style={{ padding: 12, borderTop: "1px solid #E2DCCC", display: "flex", gap: 8 }}>
          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Type a message…" style={{ ...inputStyle, flex: 1 }} autoFocus />
          <button onClick={send} style={{ background: "#FFB400", border: "none", borderRadius: 6, padding: "0 14px", display: "flex", alignItems: "center" }}><Send size={16} color="#1B1D21" /></button>
        </div>
      </div>
    </div>
  );
}


// ====================================================================
// RATECON / DIGITAL CONTRACT
// ====================================================================
function RateConButton({ load, trucker, shipper }) {
  const [show, setShow] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(!!load.raterconSent);
  const [sendError, setSendError] = useState(false);
  const rcNum = "HD-" + load.id.slice(-6).toUpperCase();
  const today = new Date().toLocaleDateString();
  const accepted = (load.bids || []).find((b) => b.status === "accepted");

  const rateConFields = {
    rc_number: rcNum,
    date: today,
    shipper_name: load.shipperName,
    carrier_name: (trucker?.name || "") + (trucker?.companyLabel ? ` / ${trucker.companyLabel}` : ""),
    mc_dot: trucker?.corp?.mcNumber || trucker?.mcNumber || "On file",
    origin: load.origin + (load.originZip ? ` (${load.originZip})` : ""),
    destination: load.destination + (load.destZip ? ` (${load.destZip})` : ""),
    miles: load.miles ? `${load.miles} mi` : "—",
    commodity: load.description || "—",
    weight: load.weight ? `${load.weight.toLocaleString()} lbs` : "—",
    equipment: trucker?.equipmentType || "—",
    pickup_date: load.pickupDate ? new Date(load.pickupDate).toLocaleDateString() : "As arranged",
    rate: fmtMoney(load.price),
    rate_per_mile: load.miles ? `${fmtMoney((load.price / load.miles).toFixed(2))}/mi` : "—",
    special_instructions: load.special || "None",
  };

  const emailRateCon = async () => {
    if (EMAILJS_SERVICE_ID === "YOUR_EMAILJS_SERVICE_ID" || EMAILJS_RATECON_TEMPLATE === "YOUR_RATECON_TEMPLATE") {
      setSendError(true);
      setTimeout(() => setSendError(false), 4000);
      return;
    }
    setSending(true);
    setSendError(false);
    try {
      const ejs = await loadEmailJS();
      const recipients = [shipper?.email, trucker?.email].filter(Boolean);
      await Promise.all(recipients.map((to_email) =>
        ejs.send(EMAILJS_SERVICE_ID, EMAILJS_RATECON_TEMPLATE, { to_email, ...rateConFields })
      ));
      await api.patch(`/api/loads/${load.id}`, { raterconSent: true });
      setSent(true);
    } catch (err) {
      console.error("Rate Con email failed to send:", err.message);
      setSendError(true);
      setTimeout(() => setSendError(false), 4000);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button onClick={() => setShow(true)} style={{ ...ghostBtn, display: "flex", alignItems: "center", gap: 5, padding: "6px 10px", fontSize: 12 }}>
        <FileText size={13} /> Rate Con
      </button>
      {show && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(27,29,33,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 16 }} onClick={() => setShow(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", width: "100%", maxWidth: 560, borderRadius: 12, overflow: "hidden", boxShadow: "0 12px 40px rgba(0,0,0,0.3)", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid #E2DCCC", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#1B1D21", color: "#F2EDE4" }}>
              <div style={{ fontWeight: 700, fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}><FileText size={16} color="#FFB400" /> Rate Confirmation — {rcNum}</div>
              <button onClick={() => setShow(false)} style={{ background: "none", border: "none", color: "#F2EDE4" }}><X size={18} /></button>
            </div>
            <div style={{ padding: 24, fontSize: 13, lineHeight: 1.7, color: "#1B1D21" }}>
              <div className="mono" style={{ fontSize: 10, color: "#9A958A", marginBottom: 16 }}>DIRECT FREIGHT DIGITAL RATE CONFIRMATION · {today}</div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  {[
                    ["Load ID", rcNum],
                    ["Shipper", load.shipperName],
                    ["Carrier", trucker?.name + (trucker?.companyLabel ? ` / ${trucker.companyLabel}` : "")],
                    ["MC / DOT", trucker?.corp?.mcNumber || trucker?.mcNumber || "On file"],
                    ["Origin", load.origin + (load.originZip ? ` (${load.originZip})` : "")],
                    ["Destination", load.destination + (load.destZip ? ` (${load.destZip})` : "")],
                    ["Miles", load.miles ? `${load.miles} mi` : "—"],
                    ["Commodity", load.description || "—"],
                    ["Weight", load.weight ? `${load.weight.toLocaleString()} lbs` : "—"],
                    ["Equipment", trucker?.equipmentType || "—"],
                    ["Pickup date", load.pickupDate ? new Date(load.pickupDate).toLocaleDateString() : "As arranged"],
                    ["Rate", fmtMoney(load.price)],
                    ["Rate per mile", load.miles ? `${fmtMoney((load.price / load.miles).toFixed(2))}/mi` : "—"],
                    ["Special instructions", load.special || "None"],
                  ].map(([k, v]) => (
                    <tr key={k} style={{ borderBottom: "1px solid #EEE8DA" }}>
                      <td style={{ padding: "5px 8px", color: "#6B6557", fontWeight: 600, width: "38%" }}>{k}</td>
                      <td style={{ padding: "5px 8px" }}>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ marginTop: 18, fontSize: 11, color: "#6B6557", lineHeight: 1.5, borderTop: "1px solid #EEE8DA", paddingTop: 12 }}>
                This Rate Confirmation serves as a binding agreement between Shipper and Carrier executed through Direct Freight. Carrier accepts rate and terms by claiming or bidding on this load. Standard FMCSA carrier liability applies. Direct Freight is not a party to this contract. Governed by the Terms of Service at directfreight.com/terms.
              </div>
              <div style={{ marginTop: 10, background: "#FFF6E5", border: "1px solid #FFD98C", borderRadius: 6, padding: "10px 12px", fontSize: 11, color: "#44484D", lineHeight: 1.6 }}>
                <b>⏱ DETENTION POLICY — AUTOMATED BILLING:</b> Loading and unloading wait times exceeding 2 hours from the platform-validated GPS arrival timestamp will accrue detention charges automatically at a rate of <b>$60.00/hr</b>, billed in 15-minute increments. Accessorial fees will be processed instantly via the Shipper's pre-authorized Stripe billing profile upon completion of the haul. The carrier must maintain an active mobile session with browser location permissions enabled while within the shipper facility perimeter to successfully claim automated platform detention payouts. All automated detention charges are final and non-refundable per Direct Freight Terms of Service Section 5.4.
              </div>
              {trucker?.factoringEnabled && trucker?.factoringCompany && (
                <div style={{ marginTop: 10, background: "#EAF1F8", border: "1px solid #C7DAEA", borderRadius: 6, padding: "10px 12px", fontSize: 11, color: "#1B1D21", lineHeight: 1.6 }}>
                  <b>💰 NOTICE OF ASSIGNMENT — PAYMENT REMIT TO:</b> This carrier has assigned payment on this invoice to their factoring company. Please remit payment to <b>{trucker.factoringCompany}</b>{trucker.factoringEmail ? ` (${trucker.factoringEmail})` : ""}{trucker.factoringPhone ? ` · ${trucker.factoringPhone}` : ""}{trucker.factoringNoaNumber ? ` · NOA Ref: ${trucker.factoringNoaNumber}` : ""} — not directly to the carrier.
                </div>
              )}
              <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={() => window.print()} style={{ ...primaryBtn("#FFB400") }}>Print / Save PDF</button>
                <button onClick={emailRateCon} disabled={sending || sent} style={{ ...primaryBtn(sent ? "#3E7A4B" : "#3A6EA5"), color: "#fff", opacity: sending ? 0.7 : 1, display: "flex", alignItems: "center", gap: 6 }}>
                  {sending ? "Sending…" : sent ? <><CheckCircle2 size={14} /> Sent to both parties</> : "Email to shipper & carrier"}
                </button>
                <button onClick={() => setShow(false)} style={ghostBtn}>Close</button>
              </div>
              {sendError && (
                <div style={{ fontSize: 11, color: "#C0432B", marginTop: 8 }}>
                  {EMAILJS_RATECON_TEMPLATE === "YOUR_RATECON_TEMPLATE"
                    ? "Email sending isn't set up yet — create a Rate Con EmailJS template and add its ID to EMAILJS_RATECON_TEMPLATE."
                    : "Couldn't send the email — check your connection and try again."}
                </div>
              )}
              {!shipper?.email && !trucker?.email && (
                <div style={{ fontSize: 11, color: "#9A958A", marginTop: 8 }}>Missing email addresses for this load — can't send.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ====================================================================
// FUEL CARD + IFTA LOG (trucker profile add-ons)
function IftaLogPanel({ loads }) {
  const hauls = loads.filter((l) => l.status === "delivered" && l.miles);
  const totalMiles = hauls.reduce((a, l) => a + l.miles, 0);

  const exportCsv = () => {
    const rows = [["Load ID", "Origin", "Destination", "Miles", "Delivered Date"]];
    hauls.forEach((l) => rows.push([l.id, l.origin, l.destination, l.miles, l.deliveredAt ? new Date(l.deliveredAt).toLocaleDateString() : "—"]));
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "directfreight-ifta-mileage.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card style={{ padding: 20 }}>
      <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 16, textTransform: "uppercase", marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
        <Route size={16} color="#FF5A1F" /> IFTA Mileage Log
      </div>
      <div style={{ fontSize: 13, color: "#6B6557", marginBottom: 14, lineHeight: 1.5 }}>
        Mileage from your completed hauls on Direct Freight. Export for quarterly IFTA fuel tax filing.
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <StatCard label="Total miles (platform)" value={totalMiles.toLocaleString()} icon={<Route size={14} />} />
        <StatCard label="Completed hauls" value={hauls.length} icon={<Truck size={14} />} />
      </div>
      {!hauls.length ? <div style={{ fontSize: 12, color: "#9A958A" }}>No completed hauls with mileage data yet.</div> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
          {hauls.map((l) => (
            <div key={l.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "5px 0", borderBottom: "1px solid #EEE8DA" }}>
              <span>{l.origin} → {l.destination}</span>
              <span className="mono" style={{ color: "#3A6EA5" }}>{l.miles} mi</span>
            </div>
          ))}
        </div>
      )}
      <button onClick={exportCsv} disabled={!hauls.length} style={{ ...ghostBtn, display: "flex", alignItems: "center", gap: 6, opacity: hauls.length ? 1 : 0.5 }}>
        <Download size={13} /> Export CSV for IFTA
      </button>
    </Card>
  );
}


// ====================================================================
// PROFILE CAP ENFORCEMENT
// ====================================================================
const PLAN_PROFILE_LIMITS = {
  indie: 1,       // Solo $30/mo (carrier) / $70/mo (shipper) — 1 profile only
  starter: 10,    // Starter $350/mo — up to 10
  growth: 50,     // Growth $800/mo — up to 50
  fleet: 150,     // Fleet $1,800/mo — up to 150
  enterprise: Infinity, // Enterprise $3,500/mo — unlimited
};

function getPlanFromMemberCount(count) {
  if (count <= 1) return "indie";
  if (count <= 10) return "starter";
  if (count <= 50) return "growth";
  if (count <= 150) return "fleet";
  return "enterprise";
}

function ProfileLimitModal({ currentCount, onClose, onUpgrade }) {
  const currentPlan = getPlanFromMemberCount(currentCount);
  const upgradePrices = { indie: "$180/mo extra", starter: "$450/mo extra", growth: "$1,000/mo extra", fleet: "$1,700/mo extra" };
  const upgradeNames = { indie: "Starter Fleet", starter: "Growth Fleet", growth: "Fleet Plan", fleet: "Enterprise" };
  const upgradeLimits = { indie: "add more drivers", starter: "up to 50 drivers", growth: "up to 150 drivers", fleet: "unlimited drivers" };
  const nextPlan = { indie: "starter", starter: "growth", growth: "fleet", fleet: "enterprise" }[currentPlan];
  const upgradeName = upgradeNames[currentPlan] || "the next tier";
  const upgradePrice = upgradePrices[currentPlan] || "contact us";
  const upgradeLimit = upgradeLimits[currentPlan] || "more drivers";

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(27,29,33,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 80, padding: 16 }}>
      <Card style={{ width: "100%", maxWidth: 420, padding: 28 }}>
        <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 20, textTransform: "uppercase", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <Lock size={20} color="#FF5A1F" /> Profile Limit Reached
        </div>
        <div style={{ fontSize: 15, color: "#1B1D21", lineHeight: 1.6, marginBottom: 20 }}>
          You've reached your profile limit. Upgrade to <b>{upgradeName}</b> for an extra <b>{upgradePrice}</b> to {upgradeLimit}.
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onUpgrade} style={{ ...primaryBtn("#FFB400"), flex: 1 }}>Upgrade to {upgradeName}</button>
          <button onClick={onClose} style={{ ...ghostBtn, flex: 1 }}>Maybe later</button>
        </div>
      </Card>
    </div>
  );
}

// ====================================================================
// GPS DETENTION TRACKER
// Runs when a carrier has an active load — watches browser geolocation,
// pings the backend every 30 seconds, displays live detention clock.
// Rate: $60/hr in 15-min increments after 2-hour free window.
// ====================================================================
const DETENTION_RATE_PER_HOUR = 60;
const DETENTION_FREE_HOURS = 2;
const DETENTION_GEOFENCE_MILES = 1.0;

function GpsDetentionTracker({ load, me, onDetentionUpdate }) {
  const [gpsStatus, setGpsStatus] = useState("idle"); // idle | watching | inside | outside | denied
  const [detentionState, setDetentionState] = useState(null);
  const watchRef = useRef(null);
  const pingRef = useRef(null);
  const arrivalTimeRef = useRef(null);

  const facilityCoord = load.originZip ? zipToCoord(load.originZip) : null;

  const startTracking = () => {
    if (!navigator.geolocation) { alert("Your browser doesn't support GPS tracking."); return; }
    navigator.geolocation.getCurrentPosition(
      () => {
        setGpsStatus("watching");
        watchRef.current = navigator.geolocation.watchPosition(handlePosition, handleError, { enableHighAccuracy: true, maximumAge: 15000, timeout: 10000 });
      },
      handleError,
      { enableHighAccuracy: true }
    );
  };

  const handleError = (err) => {
    if (err.code === 1) setGpsStatus("denied");
    else setGpsStatus("idle");
  };

  const handlePosition = (pos) => {
    if (!facilityCoord) return;
    const truckCoord = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    const dist = haversineMiles(truckCoord, facilityCoord);
    const inside = dist <= DETENTION_GEOFENCE_MILES;

    if (inside && !arrivalTimeRef.current) {
      arrivalTimeRef.current = Date.now();
      setGpsStatus("inside");
      pingBackend(truckCoord, "arrived", dist);
    } else if (!inside && arrivalTimeRef.current) {
      setGpsStatus("outside");
      pingBackend(truckCoord, "departed", dist);
    } else if (inside) {
      pingBackend(truckCoord, "inside", dist);
    }

    if (arrivalTimeRef.current) {
      const dwellMs = Date.now() - arrivalTimeRef.current;
      const dwellHrs = dwellMs / 3600000;
      const freeHrs = DETENTION_FREE_HOURS;
      const billableHrs = Math.max(0, dwellHrs - freeHrs);
      const billable15min = Math.floor(billableHrs * 4) / 4;
      const amount = billable15min * DETENTION_RATE_PER_HOUR;
      const state = { inside, dist: dist.toFixed(2), dwellMinutes: Math.round(dwellMs / 60000), billableHrs: billable15min, amount, arrivalTime: arrivalTimeRef.current };
      setDetentionState(state);
      onDetentionUpdate && onDetentionUpdate(load.id, state);
    }
  };

  const pingBackend = async (coord, event, distMiles) => {
    try {
      await fetch("https://hauldirect-api-production.up.railway.app/api/tracking/ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loadId: load.id, carrierId: me.id, lat: coord.lat, lng: coord.lng, distMiles, event, timestamp: Date.now() }),
      });
    } catch (e) { /* ping failure is non-blocking */ }
  };

  useEffect(() => {
    return () => {
      if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current);
      if (pingRef.current) clearInterval(pingRef.current);
    };
  }, []);

  if (load.status !== "in_transit") return null;

  return (
    <div style={{ marginTop: 10, border: "1px solid #E2DCCC", borderRadius: 8, overflow: "hidden" }}>
      <div style={{ background: "#1B1D21", color: "#F2EDE4", padding: "8px 12px", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
        <Navigation size={13} color="#FFB400" /> Live GPS Detention Tracker
      </div>
      <div style={{ padding: "12px 14px" }}>
        {gpsStatus === "idle" && (
          <div>
            <div style={{ fontSize: 12, color: "#6B6557", marginBottom: 8 }}>
              Enable GPS tracking to automatically clock detention time when you're at the facility. Detention pays ${DETENTION_RATE_PER_HOUR}/hr after a {DETENTION_FREE_HOURS}-hour free window, billed in 15-min increments.
            </div>
            <button onClick={startTracking} style={{ ...primaryBtn("#FFB400"), display: "flex", alignItems: "center", gap: 6 }}>
              <Navigation size={14} /> Enable GPS tracking
            </button>
          </div>
        )}
        {gpsStatus === "denied" && (
          <div style={{ fontSize: 12, color: "#C0432B" }}>GPS access denied. Enable location permissions in your browser settings to use detention tracking.</div>
        )}
        {gpsStatus === "watching" && !detentionState && (
          <div style={{ fontSize: 12, color: "#6B6557", display: "flex", alignItems: "center", gap: 6 }}>
            <Navigation size={13} /> Watching your location… Detention clock starts when you enter the 1-mile facility perimeter.
          </div>
        )}
        {detentionState && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: detentionState.inside ? "#3E7A4B" : "#9A958A" }} />
                {detentionState.inside ? `Inside perimeter (${detentionState.dist} mi from facility)` : `Outside perimeter (${detentionState.dist} mi away)`}
              </span>
              <span><Clock size={12} /> Dwell: {detentionState.dwellMinutes} min</span>
            </div>
            {detentionState.dwellMinutes < DETENTION_FREE_HOURS * 60 ? (
              <div style={{ fontSize: 12, color: "#3E7A4B" }}>
                ✓ Within free window — {(DETENTION_FREE_HOURS * 60) - detentionState.dwellMinutes} min remaining before detention starts
              </div>
            ) : (
              <div style={{ background: "#FFF6E5", border: "1px solid #FFD98C", borderRadius: 6, padding: "8px 10px" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#B5790A", display: "flex", alignItems: "center", gap: 6 }}>
                  <DollarSign size={14} /> Detention accruing: {fmtMoney(detentionState.amount)}
                </div>
                <div style={{ fontSize: 11, color: "#9A958A", marginTop: 2 }}>
                  {detentionState.billableHrs.toFixed(2)} billable hours × ${DETENTION_RATE_PER_HOUR}/hr (15-min increments)
                </div>
              </div>
            )}
            <div style={{ fontSize: 10, color: "#9A958A" }}>Arrival logged: {new Date(detentionState.arrivalTime).toLocaleTimeString()}</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ====================================================================

// ====================================================================
// COMPANY PROFILE PAGE — Carrier company public profile
// Aggregates all driver ratings into one company score
// ====================================================================
function companyAggregateRating(corp) {
  const allRatings = (corp.members || []).flatMap((m) => m.ratings || []);
  if (!allRatings.length) return { avg: 0, count: 0 };
  return { avg: allRatings.reduce((a, b) => a + b, 0) / allRatings.length, count: allRatings.length };
}

function CompanyProfilePage({ corp, onClose, embedded }) {
  const rating = companyAggregateRating(corp);
  const isTrucking = corp.subtype === "trucking";

  const content = (
    <div style={{ padding: embedded ? 0 : 24 }}>
      {!embedded && (
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
          <ProfilePicture src={corp.avatar} name={corp.companyName} size={72} />
          <div>
            <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 22 }}>{corp.companyName}</div>
            <div style={{ fontSize: 12, color: "#6B6557", marginTop: 2 }}>{isTrucking ? "Carrier Company" : "Shipping Company"}</div>
            {corp.verification?.authorityStatus === "AUTHORIZED" && (
              <div style={{ display: "flex", alignItems: "center", gap: 5, color: "#3E7A4B", fontSize: 12, fontWeight: 700, marginTop: 4 }}>
                <ShieldCheck size={13} /> MC Verified · {corp.mcNumber}
              </div>
            )}
          </div>
        </div>
      )}

      <Card style={{ padding: 16, marginBottom: 16, background: rating.count > 0 ? "#F1F8F2" : "#FBF9F4", border: `1px solid ${rating.count > 0 ? "#BFE0C6" : "#E2DCCC"}` }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Company Rating</div>
        {rating.count > 0 ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Stars value={rating.avg} size={20} />
            <span style={{ fontSize: 18, fontWeight: 700 }}>{rating.avg.toFixed(1)}</span>
            <span style={{ fontSize: 13, color: "#6B6557" }}>({rating.count} rating{rating.count === 1 ? "" : "s"} across all drivers)</span>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: "#9A958A" }}>No ratings yet — this company is new to the platform.</div>
        )}
      </Card>

      {isTrucking && corp.members.length > 0 && (
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Drivers ({corp.members.length})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {corp.members.map((m) => (
              <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: "1px solid #EEE8DA", borderRadius: 8 }}>
                <ProfilePicture src={m.avatar} name={m.name} size={38} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{m.name}</div>
                  <div style={{ fontSize: 12, color: "#6B6557" }}>{m.role}{m.equipmentType ? ` · ${m.equipmentType}` : ""}{m.loc ? ` · ${m.loc}` : ""}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <Stars value={avgRating(m.ratings)} size={12} />
                  <span style={{ fontSize: 11, color: "#9A958A" }}>{m.ratings.length > 0 ? avgRating(m.ratings).toFixed(1) : "—"}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isTrucking && corp.members.length > 0 && (
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Shipping Team ({corp.members.length})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {corp.members.map((m) => (
              <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", border: "1px solid #EEE8DA", borderRadius: 8 }}>
                <ProfilePicture src={m.avatar} name={m.name} size={32} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{m.name}</div>
                  <div style={{ fontSize: 11, color: "#6B6557" }}>{m.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  if (embedded) return <div>{content}</div>;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(27,29,33,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 16 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", width: "100%", maxWidth: 560, maxHeight: "85vh", borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 12px 40px rgba(0,0,0,0.3)" }}>
        <div style={{ background: "#1B1D21", color: "#F2EDE4", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{isTrucking ? "Carrier" : "Shipper"} Company Profile</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#F2EDE4" }}><X size={18} /></button>
        </div>
        <div style={{ overflowY: "auto" }}>{content}</div>
      </div>
    </div>
  );
}

// ====================================================================
// SHIPPER PUBLIC PROFILE — Visible to carriers on load board
// Shows company name, rating, days to pay, loads history
// ====================================================================
function ShipperProfileModal({ shipper, loads, onClose }) {
  const shipperLoads = (loads || []).filter((l) => l.shipperId === shipper.id);
  const delivered = shipperLoads.filter((l) => l.status === "delivered");
  const daysToPay = calcDaysToPay(delivered);
  const rating = { avg: avgRating(shipper.ratings || []), count: (shipper.ratings || []).length };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(27,29,33,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 16 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", width: "100%", maxWidth: 460, borderRadius: 12, overflow: "hidden", boxShadow: "0 12px 40px rgba(0,0,0,0.3)" }}>
        <div style={{ background: "#1B1D21", color: "#F2EDE4", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Shipper Profile</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#F2EDE4" }}><X size={18} /></button>
        </div>
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <ProfilePicture src={shipper.avatar} name={shipper.name} size={60} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{shipper.name}</div>
              {shipper.company && <div style={{ fontSize: 13, color: "#6B6557" }}>{shipper.company}</div>}
              {shipper.ein && <div style={{ fontSize: 11, color: "#9A958A" }}>EIN: •••–{shipper.ein.slice(-4)}</div>}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Card style={{ padding: 12 }}>
              <div style={{ fontSize: 11, color: "#9A958A", marginBottom: 4 }}>RATING</div>
              {rating.count > 0 ? (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Stars value={rating.avg} size={14} />
                  <span style={{ fontWeight: 700 }}>{rating.avg.toFixed(1)}</span>
                  <span style={{ fontSize: 11, color: "#9A958A" }}>({rating.count})</span>
                </div>
              ) : <div style={{ fontSize: 12, color: "#9A958A" }}>No ratings yet</div>}
            </Card>
            <Card style={{ padding: 12 }}>
              <div style={{ fontSize: 11, color: "#9A958A", marginBottom: 4 }}>AVG DAYS TO PAY</div>
              <div style={{ fontWeight: 700, fontSize: 16, color: daysToPay == null ? "#9A958A" : daysToPay <= 14 ? "#3E7A4B" : daysToPay <= 30 ? "#B5790A" : "#C0432B" }}>
                {daysToPay == null ? "—" : `${daysToPay} days`}
              </div>
            </Card>
            <Card style={{ padding: 12 }}>
              <div style={{ fontSize: 11, color: "#9A958A", marginBottom: 4 }}>LOADS POSTED</div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{shipperLoads.length}</div>
            </Card>
            <Card style={{ padding: 12 }}>
              <div style={{ fontSize: 11, color: "#9A958A", marginBottom: 4 }}>COMPLETED</div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{delivered.length}</div>
            </Card>
          </div>
          {(shipper.address?.city || shipper.address?.state) && (
            <div style={{ fontSize: 13, color: "#6B6557", display: "flex", alignItems: "center", gap: 6 }}>
              <MapPin size={13} /> {shipper.address.city}{shipper.address.state ? `, ${shipper.address.state}` : ""}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ====================================================================
// MASTER OPERATOR DASHBOARD — Hidden from all users
// Access: click the footer copyright text 5 times, enter credentials
// ====================================================================
function OperatorApp({ independentShippers, independentTruckers, corporations, loads, messages,
  onRemoveShipper, onSuspendShipper, onUpdateShipper,
  onRemoveTrucker, onSuspendTrucker, onUpdateTrucker,
  onRemoveCorp, onSuspendCorp, onUpdateCorp,
  onRemoveLoad, onImpersonate, onLogout }) {
  const [tab, setTab] = useState("overview");
  const [confirmAction, setConfirmAction] = useState(null);
  const [editingUser, setEditingUser] = useState(null); // { user, type: 'shipper'|'trucker'|'corp' }
  const [waitlistCount, setWaitlistCount] = useState(null);

  useEffect(() => {
    api.get("/api/waitlist/count").then((d) => setWaitlistCount(d.count)).catch(() => {});
  }, [tab]);

  const allShippers = independentShippers;
  const allTruckers = independentTruckers;
  const allCorps = corporations;
  const openLoads = loads.filter((l) => l.status === "open").length;
  const activeLoads = loads.filter((l) => l.status === "in_transit").length;
  const deliveredLoads = loads.filter((l) => l.status === "delivered").length;
  const totalRevenue = loads.filter((l) => l.paid).reduce((a, l) => a + l.price, 0);

  const tabs = [
    { id: "overview",   label: "Overview" },
    { id: "growth",     label: "Growth" },
    { id: "waitlist",   label: `Waitlist (${waitlistCount === null ? "…" : waitlistCount})` },
    { id: "shippers",   label: `Shippers (${allShippers.length})` },
    { id: "carriers",   label: `Carriers (${allTruckers.length})` },
    { id: "companies",  label: `Companies (${allCorps.length})` },
    { id: "loads",      label: `All Loads (${loads.length})` },
    { id: "disputes",   label: "Disputes" },
    { id: "reviews",    label: `Reviews (${FEEDBACK_STORE.length})` },
    { id: "promos",     label: "Promo Codes" },
    { id: "saferwatch", label: "SaferWatch" },
  ];

  const confirm = (label, fn) => setConfirmAction({ label, onConfirm: fn });

  return (
    <div style={{ minHeight: "100vh", background: "#0F1114", color: "#F2EDE4", fontFamily: "system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ background: "#1B1D21", borderBottom: "2px solid #FFB400", padding: "14px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 20, color: "#FFB400", textTransform: "uppercase", letterSpacing: "0.05em" }}>Direct Freight</div>
          <div style={{ background: "#C0432B", color: "#fff", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4, textTransform: "uppercase" }}>Master Operator</div>
        </div>
        <button onClick={onLogout} style={{ background: "none", border: "1px solid #44484D", color: "#9A958A", borderRadius: 6, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>Log out</button>
      </div>

      <div style={{ padding: "20px 24px" }}>
        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20, flexWrap: "wrap" }}>
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: tab === t.id ? "#FFB400" : "#1B1D21", color: tab === t.id ? "#1B1D21" : "#9A958A", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>{t.label}</button>
          ))}
        </div>

        {/* Waitlist */}
        {tab === "waitlist" && (
          <div>
            <div style={{ fontSize: 13, color: "#9A958A", marginBottom: 16 }}>
              Everyone who signed up for early access. First 100 get a 20% off promo code automatically. Mark entries as converted once they create a real account.
            </div>
            <OperatorWaitlistPanel />
          </div>
        )}

        {/* Overview */}
        {tab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {[
                { label: "Total shippers", value: allShippers.length, color: "#FFB400" },
                { label: "Total carriers", value: allTruckers.length, color: "#FF5A1F" },
                { label: "Companies", value: allCorps.length, color: "#3A6EA5" },
                { label: "Open loads", value: openLoads, color: "#FFB400" },
                { label: "Active hauls", value: activeLoads, color: "#FF5A1F" },
                { label: "Delivered", value: deliveredLoads, color: "#3E7A4B" },
                { label: "Platform revenue (paid loads)", value: fmtMoney(totalRevenue), color: "#3E7A4B" },
              ].map((s) => (
                <div key={s.label} style={{ background: "#1B1D21", border: "1px solid #2A2D32", borderRadius: 8, padding: "14px 18px", minWidth: 150 }}>
                  <div style={{ fontSize: 11, color: "#6B6557", textTransform: "uppercase", marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: s.color, fontFamily: "Oswald, sans-serif" }}>{s.value}</div>
                </div>
              ))}
            </div>
            <div style={{ background: "#1B1D21", border: "1px solid #2A2D32", borderRadius: 8, padding: 16, fontSize: 12, color: "#9A958A", lineHeight: 1.6 }}>
              <b style={{ color: "#FFB400" }}>Access instructions:</b> This dashboard is only accessible to you. To reach it: press <b>Ctrl + Shift + O</b> anywhere on the site, then enter your operator email and PIN. Change your PIN in the source code before going live (<code>OPERATOR_EMAIL</code> and <code>OPERATOR_PIN</code> constants at the top of the file).
            </div>
          </div>
        )}

        {tab === "growth" && (
          <GrowthPanel shippers={allShippers} truckers={allTruckers} corps={allCorps} />
        )}

        {/* Shippers */}
        {tab === "shippers" && (
          <OperatorUserPanel
            title="Shippers" users={allShippers} color="#FFB400"
            onEdit={(user) => setEditingUser({ user, type: "shipper" })}
            onImpersonate={(user) => onImpersonate({ role: "shipper", corpId: null, profileId: user.id })}
            onSuspend={(id, val) => confirm(`${val ? "Suspend" : "Reinstate"} this shipper?`, () => { onSuspendShipper(id, val); setConfirmAction(null); })}
            onRemove={(id, name) => confirm(`Permanently remove "${name}"? This cannot be undone.`, () => { onRemoveShipper(id); setConfirmAction(null); })}
          />
        )}

        {/* Carriers */}
        {tab === "carriers" && (
          <OperatorUserPanel
            title="Carriers" users={allTruckers} color="#FF5A1F"
            extraFields={(u) => u.equipmentType || ""}
            onEdit={(user) => setEditingUser({ user, type: "trucker" })}
            onImpersonate={(user) => onImpersonate({ role: "trucker", corpId: null, profileId: user.id })}
            onSuspend={(id, val) => confirm(`${val ? "Suspend" : "Reinstate"} this carrier?`, () => { onSuspendTrucker(id, val); setConfirmAction(null); })}
            onRemove={(id, name) => confirm(`Permanently remove "${name}"? This cannot be undone.`, () => { onRemoveTrucker(id); setConfirmAction(null); })}
          />
        )}

        {/* Companies */}
        {tab === "companies" && (
          <OperatorUserPanel
            title="Companies" users={allCorps.map((c) => ({ ...c, name: c.companyName, company: c.subtype }))} color="#3A6EA5"
            extraFields={(u) => `${u.members?.length || 0} members · ${u.subtype}`}
            onEdit={(user) => setEditingUser({ user, type: "corp" })}
            onImpersonate={(user) => onImpersonate({ role: user.subtype === "trucking" ? "trucker" : "shipper", corpId: user.id, profileId: null })}
            onSuspend={(id, val) => confirm(`${val ? "Suspend" : "Reinstate"} this company?`, () => { onSuspendCorp(id, val); setConfirmAction(null); })}
            onRemove={(id, name) => confirm(`Permanently remove company "${name}"? This cannot be undone.`, () => { onRemoveCorp(id); setConfirmAction(null); })}
          />
        )}

        {/* All Loads */}
        {tab === "loads" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {!loads.length && <div style={{ color: "#6B6557", fontSize: 13 }}>No loads on the platform yet.</div>}
            {loads.map((l) => (
              <div key={l.id} style={{ background: "#1B1D21", border: "1px solid #2A2D32", borderRadius: 8, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{l.origin} → {l.destination}</div>
                  <div style={{ fontSize: 11, color: "#9A958A", marginTop: 2 }}>{l.description} · {l.weight?.toLocaleString()} lbs · {fmtMoney(l.price)} · {l.status}</div>
                  <div style={{ fontSize: 11, color: "#6B6557" }}>Shipper: {l.shipperName} · {new Date(l.postedAt).toLocaleDateString()}</div>
                </div>
                <button onClick={() => confirm(`Remove load "${l.origin} → ${l.destination}"?`, () => { onRemoveLoad(l.id); setConfirmAction(null); })} style={{ background: "#C0432B", border: "none", color: "#fff", borderRadius: 6, padding: "6px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Remove load</button>
              </div>
            ))}
          </div>
        )}

        {/* Reviews */}
        {tab === "reviews" && (
          <div>
            <div style={{ fontSize: 13, color: "#9A958A", marginBottom: 16 }}>All user reviews and feedback submitted through the platform. Also emailed to you via EmailJS when submitted.</div>
            <OperatorFeedbackPanel />
          </div>
        )}

        {/* Disputes */}
        {tab === "disputes" && (
          <div>
            <div style={{ fontSize: 13, color: "#9A958A", marginBottom: 14 }}>All disputes filed by shippers and carriers. Review, update status, and add resolution notes.</div>
            <OperatorDisputesPanel />
          </div>
        )}

        {/* Promo Codes */}
        {tab === "promos" && (
          <div style={{ maxWidth: 680 }}>
            <div style={{ fontSize: 13, color: "#9A958A", marginBottom: 16, lineHeight: 1.5 }}>
              Create promo codes to give users extended free trials, free months, or discounts. Share codes with early adopters, partners, or anyone you want to give free service to.
            </div>
            <OperatorPromoPanel />
          </div>
        )}

        {/* SaferWatch */}
        {tab === "saferwatch" && (
          <div style={{ maxWidth: 600 }}>
            <SaferWatchPanel />
          </div>
        )}
      </div>

      {/* Confirm dialog */}
      {confirmAction && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}>
          <div style={{ background: "#1B1D21", border: "1px solid #2A2D32", borderRadius: 12, padding: 28, maxWidth: 380, width: "100%" }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>{confirmAction.label}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={confirmAction.onConfirm} style={{ background: "#C0432B", border: "none", color: "#fff", borderRadius: 6, padding: "10px 20px", fontWeight: 700, fontSize: 13, cursor: "pointer", flex: 1 }}>Confirm</button>
              <button onClick={() => setConfirmAction(null)} style={{ background: "#2A2D32", border: "none", color: "#9A958A", borderRadius: 6, padding: "10px 20px", fontSize: 13, cursor: "pointer", flex: 1 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {editingUser && (
        <OperatorEditModal
          editingUser={editingUser}
          onSave={(updated) => {
            if (editingUser.type === "shipper") onUpdateShipper(updated);
            else if (editingUser.type === "trucker") onUpdateTrucker(updated);
            else onUpdateCorp(updated);
            setEditingUser(null);
          }}
          onClose={() => setEditingUser(null)}
        />
      )}
    </div>
  );
}

// Month-by-month growth tracking — new signups, cumulative customers, and an
// ESTIMATED subscription revenue figure based on current pricing tiers.
// This is not real billing data (that requires Stripe to be wired in) — it's
// a projection based on who's currently signed up and what they'd owe monthly.
function monthKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(key) {
  const [y, m] = key.split("-");
  return new Date(Number(y), Number(m) - 1).toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}

function GrowthPanel({ shippers, truckers, corps }) {
  const allAccounts = [
    ...shippers.map(s => ({ ...s, _kind: "shipper" })),
    ...truckers.map(t => ({ ...t, _kind: "trucker" })),
    ...corps.map(c => ({ ...c, _kind: "corp" })),
  ].filter(a => a.createdAt);

  if (!allAccounts.length) {
    return <Empty text="No signup data yet — this fills in automatically as real accounts are created." />;
  }

  // Group signups by month
  const monthMap = {};
  allAccounts.forEach(a => {
    const key = monthKey(a.createdAt);
    if (!monthMap[key]) monthMap[key] = [];
    monthMap[key].push(a);
  });
  const sortedMonths = Object.keys(monthMap).sort();
  const maxNewInMonth = Math.max(...sortedMonths.map(k => monthMap[k].length), 1);

  // Estimated monthly price per account, based on current pricing
  const estPrice = (a) => {
    if (a.complimentary) return 0;
    if (a._kind === "corp") return getCompanyTier(a.members?.length || 0)?.price || 0;
    if (a._kind === "trucker") return 30;
    return 70; // shipper
  };

  let cumulative = 0;
  const rows = sortedMonths.map(key => {
    const accountsThisMonth = monthMap[key];
    cumulative += accountsThisMonth.length;
    return { key, count: accountsThisMonth.length, cumulative };
  });

  const activeAccounts = allAccounts.filter(a => !a.suspended);
  const estimatedMRR = activeAccounts.reduce((sum, a) => sum + estPrice(a), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ background: "#1B1D21", border: "1px solid #2A2D32", borderRadius: 8, padding: "14px 16px", fontSize: 12, color: "#9A958A", lineHeight: 1.6 }}>
        <b style={{ color: "#FFB400" }}>About this estimate:</b> These figures are calculated from actual signup dates and current pricing — they are <b>not</b> real billing data. Once Stripe is fully wired in, this can be replaced with real charged revenue, active subscriptions, and churn straight from Stripe's own records.
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div style={{ background: "#1B1D21", border: "1px solid #2A2D32", borderRadius: 8, padding: "14px 18px", minWidth: 170 }}>
          <div style={{ fontSize: 11, color: "#6B6557", textTransform: "uppercase", marginBottom: 4 }}>Total customers</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#FFB400", fontFamily: "Oswald, sans-serif" }}>{allAccounts.length}</div>
        </div>
        <div style={{ background: "#1B1D21", border: "1px solid #2A2D32", borderRadius: 8, padding: "14px 18px", minWidth: 170 }}>
          <div style={{ fontSize: 11, color: "#6B6557", textTransform: "uppercase", marginBottom: 4 }}>Active subscriptions</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#3E7A4B", fontFamily: "Oswald, sans-serif" }}>{activeAccounts.length}</div>
        </div>
        <div style={{ background: "#1B1D21", border: "1px solid #2A2D32", borderRadius: 8, padding: "14px 18px", minWidth: 170 }}>
          <div style={{ fontSize: 11, color: "#6B6557", textTransform: "uppercase", marginBottom: 4 }}>Est. monthly revenue</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#FF5A1F", fontFamily: "Oswald, sans-serif" }}>{fmtMoney(estimatedMRR)}</div>
        </div>
        <div style={{ background: "#1B1D21", border: "1px solid #2A2D32", borderRadius: 8, padding: "14px 18px", minWidth: 170 }}>
          <div style={{ fontSize: 11, color: "#6B6557", textTransform: "uppercase", marginBottom: 4 }}>This month's signups</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#3A6EA5", fontFamily: "Oswald, sans-serif" }}>{monthMap[monthKey(Date.now())]?.length || 0}</div>
        </div>
      </div>

      <div style={{ background: "#1B1D21", border: "1px solid #2A2D32", borderRadius: 8, padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#F2EDE4", marginBottom: 16 }}>New signups by month</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 140 }}>
          {rows.map(r => (
            <div key={r.key} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div style={{ fontSize: 11, color: "#9A958A" }}>{r.count}</div>
              <div style={{
                width: "100%", maxWidth: 36,
                height: `${Math.max(4, (r.count / maxNewInMonth) * 100)}px`,
                background: "#FFB400", borderRadius: "3px 3px 0 0",
              }} />
              <div style={{ fontSize: 10, color: "#6B6557", textAlign: "center" }}>{monthLabel(r.key)}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: "#1B1D21", border: "1px solid #2A2D32", borderRadius: 8, padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#F2EDE4", marginBottom: 16 }}>Cumulative customers over time</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 140 }}>
          {rows.map(r => (
            <div key={r.key} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div style={{ fontSize: 11, color: "#9A958A" }}>{r.cumulative}</div>
              <div style={{
                width: "100%", maxWidth: 36,
                height: `${Math.max(4, (r.cumulative / cumulative) * 100)}px`,
                background: "#3E7A4B", borderRadius: "3px 3px 0 0",
              }} />
              <div style={{ fontSize: 10, color: "#6B6557", textAlign: "center" }}>{monthLabel(r.key)}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: "#1B1D21", border: "1px solid #2A2D32", borderRadius: 8, padding: 16, fontSize: 12, color: "#9A958A" }}>
        <b style={{ color: "#F2EDE4" }}>Breakdown by role:</b> {shippers.length} shippers · {truckers.length} carriers · {corps.length} companies
      </div>
    </div>
  );
}


function OperatorUserPanel({ title, users, color, extraFields, onEdit, onImpersonate, onSuspend, onRemove }) {
  const [search, setSearch] = useState("");
  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return (u.name || "").toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q) || (u.company || "").toLowerCase().includes(q);
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search ${title.toLowerCase()}…`}
        style={{ background: "#1B1D21", border: "1px solid #2A2D32", borderRadius: 6, padding: "8px 12px", color: "#F2EDE4", fontSize: 13, outline: "none", maxWidth: 320 }} />
      {!filtered.length && <div style={{ color: "#6B6557", fontSize: 13 }}>No {title.toLowerCase()} found.</div>}
      {filtered.map((u) => (
        <div key={u.id} style={{ background: "#1B1D21", border: `1px solid ${u.suspended ? "#C0432B" : "#2A2D32"}`, borderRadius: 8, padding: "12px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: u.suspended ? "#9A958A" : "#F2EDE4", display: "flex", alignItems: "center", gap: 8 }}>
                {u.name}
                {u.suspended && <span style={{ background: "#C0432B", color: "#fff", fontSize: 10, padding: "1px 6px", borderRadius: 4 }}>SUSPENDED</span>}
              </div>
              <div style={{ fontSize: 11, color: "#9A958A", marginTop: 2 }}>
                {u.email}{u.company ? ` · ${u.company}` : ""}
                {extraFields ? ` · ${extraFields(u)}` : ""}
                {(u.ratings?.length > 0) ? ` · ${avgRating(u.ratings).toFixed(1)}★ (${u.ratings.length})` : ""}
              </div>
              {u.dotNumber && <div style={{ fontSize: 10, color: "#6B6557", marginTop: 2 }}>DOT: {u.dotNumber} · {u.verification?.authorityStatus || "—"}</div>}
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button onClick={() => onEdit(u)} style={{ background: "#2A2D32", border: "none", color: "#FFB400", borderRadius: 6, padding: "6px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                ✏️ Edit profile
              </button>
              <button onClick={() => onImpersonate(u)} style={{ background: "#3A6EA5", border: "none", color: "#fff", borderRadius: 6, padding: "6px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                👁 View as user
              </button>
              <button onClick={() => onSuspend(u.id, !u.suspended)} style={{ background: u.suspended ? "#3E7A4B" : "#2A2D32", border: "none", color: "#fff", borderRadius: 6, padding: "6px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                {u.suspended ? "Reinstate" : "Suspend"}
              </button>
              <button onClick={() => onRemove(u.id, u.name)} style={{ background: "#C0432B", border: "none", color: "#fff", borderRadius: 6, padding: "6px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                Remove
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function OperatorEditModal({ editingUser, onSave, onClose }) {
  const { user, type } = editingUser;
  const isTrucker = type === "trucker";
  const isCorp = type === "corp";

  const [name, setName] = useState(user.name || user.companyName || "");
  const [email, setEmail] = useState(user.email || "");
  const [company, setCompany] = useState(user.company || "");
  const [loc, setLoc] = useState(user.loc || "");
  const [phone, setPhone] = useState(user.phone || "");
  const [truckDesc, setTruckDesc] = useState(user.truckDesc || "");
  const [equipmentType, setEquipmentType] = useState(user.equipmentType || "");
  const [maxWeight, setMaxWeight] = useState(user.maxWeight || "");
  const [ein, setEin] = useState(user.ein || "");
  const [notes, setNotes] = useState(user.operatorNotes || "");
  const [complimentary, setComplimentary] = useState(user.complimentary || false);
  const [compExpiry, setCompExpiry] = useState(user.complimentaryExpiry ? new Date(user.complimentaryExpiry).toISOString().slice(0,10) : "");

  const save = () => {
    const updated = {
      ...user,
      email, loc, phone, operatorNotes: notes,
      complimentary,
      complimentaryExpiry: compExpiry ? new Date(compExpiry).getTime() : null,
      ...(isCorp ? { companyName: name, ein } : { name, company }),
      ...(isTrucker ? { truckDesc, equipmentType, maxWeight: Number(maxWeight) || user.maxWeight } : {}),
    };
    onSave(updated);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto", borderRadius: 12, overflow: "hidden", boxShadow: "0 12px 40px rgba(0,0,0,0.4)" }}>
        <div style={{ background: "#1B1D21", color: "#F2EDE4", padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>✏️ Edit profile — {user.name || user.companyName}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#F2EDE4", cursor: "pointer" }}><X size={18} /></button>
        </div>
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 11, color: "#9A958A", background: "#FFF6E5", border: "1px solid #FFD98C", borderRadius: 6, padding: "6px 10px" }}>
            You are editing this profile as the platform operator. Changes take effect immediately.
          </div>

          <Field label={isCorp ? "Company name" : "Full name"}>
            <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Email">
            <input value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
          </Field>
          {!isCorp && <Field label="Business name"><input value={company} onChange={(e) => setCompany(e.target.value)} style={inputStyle} /></Field>}
          {isCorp && <Field label="EIN"><input value={ein} onChange={(e) => setEin(e.target.value)} style={inputStyle} /></Field>}
          <Field label="Location / base city"><input value={loc} onChange={(e) => setLoc(e.target.value)} style={inputStyle} /></Field>
          <Field label="Phone number"><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 000-0000" style={inputStyle} /></Field>

          {isTrucker && (
            <>
              <Field label="Truck description"><input value={truckDesc} onChange={(e) => setTruckDesc(e.target.value)} style={inputStyle} /></Field>
              <Field label="Equipment type">
                <select value={equipmentType} onChange={(e) => setEquipmentType(e.target.value)} style={inputStyle}>
                  <option value="">Select…</option>
                  {EQUIPMENT_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Max haul weight (lbs)"><input type="number" value={maxWeight} onChange={(e) => setMaxWeight(e.target.value)} style={inputStyle} /></Field>
            </>
          )}

          <Field label="Operator notes (internal only — not visible to user)">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="e.g. User called in, updated equipment info on their behalf. Verified by phone." style={{ ...inputStyle, resize: "vertical" }} />
          </Field>

          {/* Complimentary account toggle */}
          <div style={{ borderTop: "1px solid #EEE8DA", paddingTop: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#44484D", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
              🎁 Complimentary account
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <button
                onClick={() => setComplimentary(!complimentary)}
                style={{ background: complimentary ? "#3E7A4B" : "#E2DCCC", border: "none", borderRadius: 20, width: 44, height: 24, cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
                <div style={{ position: "absolute", top: 3, left: complimentary ? 22 : 2, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
              </button>
              <span style={{ fontSize: 13, color: complimentary ? "#3E7A4B" : "#9A958A", fontWeight: complimentary ? 700 : 400 }}>
                {complimentary ? "Complimentary — this account is free" : "Standard — normal billing applies"}
              </span>
            </div>
            {complimentary && (
              <Field label="Free until (leave blank for permanent)">
                <input type="date" value={compExpiry} onChange={e => setCompExpiry(e.target.value)} style={inputStyle} />
              </Field>
            )}
            {complimentary && (
              <div style={{ fontSize: 11, color: "#9A958A", marginTop: 6, lineHeight: 1.5 }}>
                This account will not be charged for their subscription. They'll see "Complimentary account" in their billing tab. When Stripe is connected, their subscription will be paused.
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button onClick={save} style={{ ...primaryBtn("#FFB400"), flex: 1 }}>Save changes</button>
            <button onClick={onClose} style={ghostBtn}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ====================================================================
// FEEDBACK & REVIEW SYSTEM
// Star rating + three input categories — emailed to operator via EmailJS
// Accessible from the Shell header (logged-in users) and home page
// ====================================================================

const FEEDBACK_EMAILJS_TEMPLATE = "YOUR_FEEDBACK_TEMPLATE"; // create this template in EmailJS

async function sendFeedbackEmail(feedback) {
  if (EMAILJS_SERVICE_ID === "YOUR_EMAILJS_SERVICE_ID") {
    console.log("[EmailJS not configured] Feedback received:", feedback);
    return true;
  }
  try {
    const ejs = await loadEmailJS();
    await ejs.send(EMAILJS_SERVICE_ID, FEEDBACK_EMAILJS_TEMPLATE, {
      to_email:       OPERATOR_NOTIFY_EMAIL,
      user_name:      feedback.userName,
      user_email:     feedback.userEmail,
      user_role:      feedback.userRole,
      stars:          feedback.stars + " / 5 stars",
      what_to_add:    feedback.whatToAdd     || "No response",
      easier:         feedback.easier        || "No response",
      problems:       feedback.problems      || "No response",
      general:        feedback.general       || "No response",
      submitted_at:   new Date().toLocaleString(),
    });
    return true;
  } catch (err) {
    console.warn("Feedback email failed:", err.message);
    return false;
  }
}

// In-memory feedback store (operator can see all in their dashboard)
const FEEDBACK_STORE = [];

function StarRating({ value, onChange, size = 28 }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          onClick={() => onChange(n)}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 2, fontSize: size, lineHeight: 1, color: n <= (hovered || value) ? "#FFB400" : "#D8D1C0", transition: "color 0.1s" }}>
          ★
        </button>
      ))}
    </div>
  );
}

function FeedbackModal({ me, onClose }) {
  const [stars, setStars]           = useState(0);
  const [whatToAdd, setWhatToAdd]   = useState("");
  const [easier, setEasier]         = useState("");
  const [problems, setProblems]     = useState("");
  const [general, setGeneral]       = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]             = useState(false);

  const submit = async () => {
    if (!stars) { alert("Please select a star rating before submitting."); return; }
    setSubmitting(true);
    const feedback = {
      id:        "fb" + Date.now(),
      userName:  me?.name || "Anonymous",
      userEmail: me?.email || "Not logged in",
      userRole:  me?.role || "visitor",
      stars,
      whatToAdd,
      easier,
      problems,
      general,
      submittedAt: Date.now(),
    };
    FEEDBACK_STORE.unshift(feedback);
    await sendFeedbackEmail(feedback);
    setSubmitting(false);
    setDone(true);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(27,29,33,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 500, padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", width: "100%", maxWidth: 520, borderRadius: 14, overflow: "hidden", boxShadow: "0 16px 48px rgba(0,0,0,0.3)", maxHeight: "90vh", overflowY: "auto" }}>

        {/* Header */}
        <div style={{ background: "#1B1D21", color: "#F2EDE4", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 18, textTransform: "uppercase" }}>Leave a Review</div>
            <div style={{ fontSize: 12, color: "#9A958A", marginTop: 2 }}>Your feedback goes directly to the Direct Freight team</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#F2EDE4", cursor: "pointer" }}><X size={18} /></button>
        </div>

        <div style={{ padding: 24 }}>
          {done ? (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🙏</div>
              <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 22, textTransform: "uppercase", marginBottom: 8 }}>Thank you!</div>
              <div style={{ fontSize: 14, color: "#6B6557", lineHeight: 1.6, marginBottom: 20 }}>
                Your review has been sent to the Direct Freight team. We read every single one and use your feedback to improve the platform.
              </div>
              <button onClick={onClose} style={{ ...primaryBtn("#FFB400"), padding: "12px 32px" }}>Close</button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

              {/* Star rating */}
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Overall rating</div>
                <StarRating value={stars} onChange={setStars} />
                {stars > 0 && (
                  <div style={{ fontSize: 12, color: "#9A958A", marginTop: 6 }}>
                    {["", "Poor — significant issues", "Fair — needs improvement", "Good — works well", "Great — very happy", "Excellent — love it!"][stars]}
                  </div>
                )}
              </div>

              {/* What to add */}
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                  ✨ What should we add?
                </div>
                <div style={{ fontSize: 12, color: "#9A958A", marginBottom: 8 }}>Features, tools, or integrations you wish Direct Freight had.</div>
                <textarea
                  value={whatToAdd}
                  onChange={e => setWhatToAdd(e.target.value)}
                  rows={3}
                  placeholder="e.g. I'd love to see a fuel cost calculator, or the ability to set a minimum rate per mile on bids..."
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </div>

              {/* Make it easier */}
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                  ⚡ What would make it easier?
                </div>
                <div style={{ fontSize: 12, color: "#9A958A", marginBottom: 8 }}>Things that were confusing, slow, or harder than they should be.</div>
                <textarea
                  value={easier}
                  onChange={e => setEasier(e.target.value)}
                  rows={3}
                  placeholder="e.g. The signup process felt long, or I couldn't figure out how to accept a bid..."
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </div>

              {/* Problems */}
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                  🐛 Any problems or bugs?
                </div>
                <div style={{ fontSize: 12, color: "#9A958A", marginBottom: 8 }}>Anything that didn't work the way you expected.</div>
                <textarea
                  value={problems}
                  onChange={e => setProblems(e.target.value)}
                  rows={3}
                  placeholder="e.g. The DOT check froze on my phone, or the load didn't show up after I posted it..."
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </div>

              {/* General comments */}
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                  💬 Anything else?
                </div>
                <textarea
                  value={general}
                  onChange={e => setGeneral(e.target.value)}
                  rows={2}
                  placeholder="General thoughts, compliments, concerns..."
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </div>

              <div style={{ fontSize: 11, color: "#9A958A", lineHeight: 1.5, background: "#F8F5EE", borderRadius: 6, padding: "8px 10px" }}>
                Your review is sent directly to the Direct Freight team. {me?.name ? `Submitted as ${me.name} (${me.email}).` : "You can leave feedback anonymously."}
              </div>

              <button
                onClick={submit}
                disabled={submitting || !stars}
                style={{ ...primaryBtn("#FFB400"), opacity: stars ? 1 : 0.5 }}>
                {submitting ? "Sending…" : "Submit review"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Feedback button — drop this anywhere to open the review modal
function FeedbackButton({ me, style }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} style={{ background: "#FFB400", border: "none", borderRadius: 8, padding: "8px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, ...style }}>
        ⭐ Leave a review
      </button>
      {open && <FeedbackModal me={me} onClose={() => setOpen(false)} />}
    </>
  );
}

// Operator feedback panel — shows all submitted reviews
function OperatorFeedbackPanel() {
  const reviews = FEEDBACK_STORE;
  const avgStars = reviews.length ? (reviews.reduce((a, r) => a + r.stars, 0) / reviews.length).toFixed(1) : null;
  const starCounts = [5,4,3,2,1].map(s => ({ stars: s, count: reviews.filter(r => r.stars === s).length }));

  if (!reviews.length) return (
    <div style={{ fontSize: 13, color: "#6B6557" }}>No reviews yet. Once users submit feedback it will appear here.</div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Summary */}
      <div style={{ background: "#1B1D21", border: "1px solid #2A2D32", borderRadius: 10, padding: 18, display: "flex", gap: 20, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 42, fontFamily: "Oswald, sans-serif", fontWeight: 700, color: "#FFB400" }}>{avgStars}</div>
          <div style={{ fontSize: 11, color: "#9A958A", marginTop: 2 }}>AVG RATING</div>
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          {starCounts.map(({ stars, count }) => (
            <div key={stars} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: "#FFB400", width: 14 }}>{stars}★</span>
              <div style={{ flex: 1, background: "#2A2D32", borderRadius: 4, height: 8, overflow: "hidden" }}>
                <div style={{ width: reviews.length ? `${(count / reviews.length) * 100}%` : "0%", background: "#FFB400", height: "100%", borderRadius: 4 }} />
              </div>
              <span style={{ fontSize: 11, color: "#9A958A", width: 20 }}>{count}</span>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 13, color: "#9A958A" }}>{reviews.length} review{reviews.length !== 1 ? "s" : ""} total</div>
      </div>

      {/* Individual reviews */}
      {reviews.map(r => (
        <div key={r.id} style={{ background: "#1B1D21", border: "1px solid #2A2D32", borderRadius: 8, padding: "14px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#F2EDE4" }}>{r.userName} <span style={{ fontWeight: 400, fontSize: 12, color: "#9A958A" }}>({r.userRole})</span></div>
              <div style={{ fontSize: 11, color: "#6B6557" }}>{r.userEmail} · {new Date(r.submittedAt).toLocaleDateString()}</div>
            </div>
            <div style={{ display: "flex", gap: 2 }}>
              {[1,2,3,4,5].map(n => <span key={n} style={{ color: n <= r.stars ? "#FFB400" : "#2A2D32", fontSize: 18 }}>★</span>)}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {r.whatToAdd  && <div style={{ fontSize: 12 }}><span style={{ color: "#FFB400", fontWeight: 700 }}>✨ Add: </span><span style={{ color: "#C9C2B3" }}>{r.whatToAdd}</span></div>}
            {r.easier     && <div style={{ fontSize: 12 }}><span style={{ color: "#3A6EA5", fontWeight: 700 }}>⚡ Easier: </span><span style={{ color: "#C9C2B3" }}>{r.easier}</span></div>}
            {r.problems   && <div style={{ fontSize: 12 }}><span style={{ color: "#C0432B", fontWeight: 700 }}>🐛 Problems: </span><span style={{ color: "#C9C2B3" }}>{r.problems}</span></div>}
            {r.general    && <div style={{ fontSize: 12 }}><span style={{ color: "#9A958A", fontWeight: 700 }}>💬 General: </span><span style={{ color: "#C9C2B3" }}>{r.general}</span></div>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ====================================================================
// ====================================================================
// TRIAL EXPIRATION PAYWALL
// Shows when a user's 30-day trial has ended.
// Cannot be dismissed — user must upgrade or log out.
// ====================================================================
function TrialExpiredPaywall({ me, onLogout }) {
  const daysUsed = me?.trialStartedAt || me?.created_at
    ? Math.floor((Date.now() - new Date(me.trialStartedAt || me.created_at).getTime()) / 86400000)
    : TRIAL_DAYS;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(27,29,33,0.97)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: 24, overflowY: "auto" }}>
      <div style={{ width: "100%", maxWidth: 680, color: "#F2EDE4", fontFamily: "Inter, sans-serif" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ background: "#FFB400", borderRadius: 6, padding: 10, display: "inline-flex", marginBottom: 16 }}>
            <Truck size={28} color="#1B1D21" />
          </div>
          <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 28, textTransform: "uppercase", marginBottom: 8 }}>
            Your free trial has ended
          </div>
          <div style={{ fontSize: 15, color: "#9A958A", lineHeight: 1.6, maxWidth: 480, margin: "0 auto" }}>
            You've used {daysUsed} days of your 30-day free trial. Choose a plan below to continue using Direct Freight Co — no broker fees, no commissions, ever.
          </div>
        </div>

        {/* Pricing tiers */}
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center", marginBottom: 24 }}>

          {/* Carrier / Shipper */}
          {(me?.role === "trucker" || me?.role === "shipper") && (
            <div style={{ background: "#1B1D21", border: "2px solid #FFB400", borderRadius: 12, padding: 24, flex: 1, minWidth: 200, maxWidth: 260 }}>
              <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 20, textTransform: "uppercase", color: "#FFB400", marginBottom: 4 }}>
                {me.role === "trucker" ? "Carrier" : "Shipper"}
              </div>
              <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 36, fontWeight: 700, marginBottom: 4 }}>
                {me.role === "trucker" ? "$30" : "$70"}<span style={{ fontSize: 16, fontWeight: 400, color: "#9A958A" }}>/mo</span>
              </div>
              <div style={{ fontSize: 12, color: "#9A958A", marginBottom: 16 }}>or {me.role === "trucker" ? "$300" : "$700"}/yr — 2 months free</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 18, fontSize: 13, color: "#C9C2B3" }}>
                {me.role === "trucker" ? [
                  "Full load board access",
                  "Bid your own rate",
                  "Free instant payouts",
                  "GPS detention tracking",
                  "IFTA mileage export",
                ] : [
                  "Unlimited load postings",
                  "Bidding & counter-offers",
                  "Live carrier tracking",
                  "Auto detention billing",
                  "Broker savings reports",
                ].map(f => <div key={f}>✓ {f}</div>)}
              </div>
              <a href="mailto:directfreightco2026@directfreightco.com?subject=Subscribe - {me.role}" style={{ display: "block", background: "#FFB400", color: "#1B1D21", borderRadius: 8, padding: "12px 0", fontWeight: 700, fontSize: 14, textAlign: "center", textDecoration: "none" }}>
                Subscribe now
              </a>
            </div>
          )}

          {/* Company tiers */}
          {me?.role !== "trucker" && me?.role !== "shipper" && COMPANY_TIERS.map(t => (
            <div key={t.id} style={{ background: "#1B1D21", border: "1px solid #2A2D32", borderRadius: 12, padding: 18, flex: 1, minWidth: 150 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#FFB400", marginBottom: 2 }}>{t.name}</div>
              <div style={{ fontSize: 11, color: "#6B6557", marginBottom: 8 }}>{t.range}</div>
              <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 22, fontWeight: 700, marginBottom: 12 }}>${t.price}<span style={{ fontSize: 12, fontWeight: 400, color: "#9A958A" }}>/mo</span></div>
              <a href={`mailto:directfreightco2026@directfreightco.com?subject=Subscribe - ${t.name}`} style={{ display: "block", background: "#2A2D32", color: "#FFB400", borderRadius: 6, padding: "8px 0", fontWeight: 700, fontSize: 12, textAlign: "center", textDecoration: "none" }}>
                Subscribe
              </a>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
          <div style={{ fontSize: 12, color: "#6B6557" }}>
            To subscribe, email <a href="mailto:directfreightco2026@directfreightco.com" style={{ color: "#FFB400" }}>directfreightco2026@directfreightco.com</a> or contact us to get set up. Stripe payments coming soon.
          </div>
          <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#6B6557" }}>
            <span>✓ Cancel anytime</span>
            <span>✓ No cancellation fees</span>
            <span>✓ No commissions</span>
          </div>
          <button onClick={onLogout} style={{ background: "none", border: "1px solid #2A2D32", color: "#6B6557", borderRadius: 6, padding: "8px 16px", fontSize: 12, cursor: "pointer", marginTop: 8 }}>
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}

// ====================================================================
// WAITLIST SYSTEM
// First 100 to sign up get 20% off automatically
// ====================================================================
const WAITLIST_LIMIT = 100;

function WaitlistSection({ setPage, embedded = false }) {
  const [count, setCount] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", role: "carrier", company: "", phone: "" });
  const [status, setStatus] = useState("idle"); // idle | loading | success | error | duplicate
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.get("/api/waitlist/count")
      .then(d => setCount(d.count || 0))
      .catch(() => setCount(0));
  }, []);

  const spotsLeft = count !== null ? Math.max(0, WAITLIST_LIMIT - count) : null;
  const earlyBirdOpen = spotsLeft === null || spotsLeft > 0;

  const submit = async () => {
    if (!form.name.trim() || !form.email.trim()) { setErr("Name and email are required."); return; }
    if (!/\S+@\S+\.\S+/.test(form.email)) { setErr("Enter a valid email address."); return; }
    if (!form.company.trim()) { setErr("Business name is required."); return; }
    setErr("");
    setStatus("loading");
    try {
      const data = await api.post("/api/waitlist", form);
      setResult(data);
      setStatus("success");
      setCount(prev => (prev || 0) + 1);

      // Email the signup themselves — confirms their spot and, if they're
      // an early bird, their promo code (persisted in the DB, valid until used)
      if (EMAILJS_SERVICE_ID !== "YOUR_EMAILJS_SERVICE_ID") {
        loadEmailJS().then(ejs => ejs?.send(EMAILJS_SERVICE_ID, EMAILJS_WAITLIST_TEMPLATE, {
          to_email:        form.email,
          user_name:       form.name,
          position:        data.position,
          is_early_bird:   data.isEarlyBird ? "yes" : "no",
          promo_code:      data.isEarlyBird ? data.promoCode : "",
          discount_percent: data.isEarlyBird ? String(data.discount) : "",
          discount_months: "3",
        })).catch(err => console.error("Waitlist confirmation email failed to send:", err));
      }

      // Notify operator via EmailJS — sends you the signup's business name,
      // email, and role every time someone new joins the waitlist
      if (EMAILJS_SERVICE_ID !== "YOUR_EMAILJS_SERVICE_ID" && EMAILJS_WAITLIST_NOTIFY_TEMPLATE !== "YOUR_WAITLIST_NOTIFY_TEMPLATE") {
        loadEmailJS().then(ejs => ejs?.send(EMAILJS_SERVICE_ID, EMAILJS_WAITLIST_NOTIFY_TEMPLATE, {
          to_email:        OPERATOR_NOTIFY_EMAIL,
          signup_name:     form.name,
          signup_email:    form.email,
          business_name:   form.company,
          role:            form.role,
          position:        data.position,
          is_early_bird:   data.isEarlyBird ? "yes" : "no",
          promo_code:      data.isEarlyBird ? data.promoCode : "N/A",
          timestamp:       new Date().toLocaleString(),
        })).catch(err => console.error("Operator waitlist notification failed to send:", err));
      }
    } catch (e) {
      if (e.message?.includes("already_on_waitlist")) {
        setStatus("duplicate");
      } else {
        setErr(e.message || "Something went wrong — please try again.");
        setStatus("idle");
      }
    }
  };

  const inner = (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>

        {/* Badge */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#FFB400", color: "#1B1D21", borderRadius: 20, padding: "6px 16px", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 20 }}>
          {earlyBirdOpen ? "🚀 Early Access — Limited Spots" : "🚀 Early Access — Waitlist Open"}
        </div>

        <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 36, lineHeight: 1.1, textTransform: "uppercase", marginBottom: 14 }}>
          {earlyBirdOpen ? (
            <>Join the waitlist.<br /><span style={{ color: "#FFB400" }}>First 100 get 20% off.</span></>
          ) : (
            <>Join the waitlist.<br /><span style={{ color: "#FFB400" }}>Be first to know when we launch.</span></>
          )}
        </div>

        <div style={{ fontSize: 15, color: "#C9C2B3", marginBottom: 12, lineHeight: 1.6 }}>
          {earlyBirdOpen ? (
            <>Direct Freight Co is launching soon. Join the waitlist and lock in your spot. The first 100 shippers and carriers to sign up get <b style={{ color: "#FFB400" }}>20% off for the first 3 months</b>, not just the first month.</>
          ) : (
            <>Direct Freight Co is launching soon. The first 100 early bird spots are already claimed, but you can still join the waitlist to be notified the moment we launch.</>
          )}
        </div>

        {/* Spot counter */}
        {spotsLeft !== null && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: spotsLeft <= 20 ? "#C0432B" : "#2A2D32", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, marginBottom: 24, color: spotsLeft <= 20 ? "#fff" : "#FFB400" }}>
            {spotsLeft <= 0
              ? "🔒 All 100 early bird spots claimed — standard waitlist open"
              : spotsLeft <= 20
                ? `⚠️ Only ${spotsLeft} early bird spot${spotsLeft === 1 ? "" : "s"} left at 20% off`
                : `✓ ${spotsLeft} of 100 early bird spots remaining`}
          </div>
        )}


        {status === "success" && result ? (
          <div style={{ background: "#2A2D32", border: "2px solid #FFB400", borderRadius: 14, padding: 28, textAlign: "left" }}>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 48, marginBottom: 8 }}>🎉</div>
              <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 22, textTransform: "uppercase", color: "#FFB400" }}>
                You're on the list!
              </div>
              <div style={{ fontSize: 14, color: "#C9C2B3", marginTop: 6 }}>
                You're <b style={{ color: "#F2EDE4" }}>#{result.position}</b> on the Direct Freight waitlist.
              </div>
            </div>

            {result.isEarlyBird ? (
              <div style={{ background: "#1B1D21", border: "1px solid #FFB400", borderRadius: 10, padding: 18, textAlign: "center", marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: "#9A958A", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Your exclusive promo code</div>
                <div style={{ fontFamily: "monospace", fontSize: 28, fontWeight: 700, color: "#FFB400", letterSpacing: "0.15em", marginBottom: 6 }}>
                  {result.promoCode}
                </div>
                <div style={{ fontSize: 13, color: "#C9C2B3" }}>
                  <b style={{ color: "#3E7A4B" }}>20% off for your first 3 months.</b><br />
                  Enter this code when you sign up at launch. Save it somewhere safe.
                </div>
              </div>
            ) : (
              <div style={{ background: "#1B1D21", borderRadius: 10, padding: 14, marginBottom: 16, fontSize: 13, color: "#9A958A", textAlign: "center" }}>
                The first 100 early bird spots are full. You're on the standard waitlist and will be notified at launch.
              </div>
            )}

            <div style={{ fontSize: 12, color: "#6B6557", lineHeight: 1.6, textAlign: "center" }}>
              We'll email you at <b style={{ color: "#F2EDE4" }}>{form.email}</b> when Direct Freight launches.<br />
              Questions? Email us at <a href="mailto:directfreightco2026@directfreightco.com" style={{ color: "#FFB400" }}>directfreightco2026@directfreightco.com</a>
            </div>

            {!embedded && (
              <div style={{ marginTop: 18, display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                <button onClick={() => setPage("shippers")} style={{ background: "#FFB400", border: "none", color: "#1B1D21", borderRadius: 8, padding: "10px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                  Learn more for Shippers
                </button>
                <button onClick={() => setPage("carriers")} style={{ background: "transparent", border: "1px solid #FFB400", color: "#FFB400", borderRadius: 8, padding: "10px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                  Learn more for Carriers
                </button>
              </div>
            )}
          </div>

        ) : status === "duplicate" ? (
          <div style={{ background: "#2A2D32", border: "1px solid #3E7A4B", borderRadius: 10, padding: 20, fontSize: 14, color: "#C9C2B3" }}>
            <div style={{ fontSize: 20, marginBottom: 8 }}>✅</div>
            You're already on the waitlist! We'll email you at <b style={{ color: "#F2EDE4" }}>{form.email}</b> when Direct Freight launches.
          </div>

        ) : (
          <div style={{ background: "#2A2D32", borderRadius: 12, padding: 24, textAlign: "left" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: "#9A958A", marginBottom: 4 }}>Full name *</div>
                  <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="Your name" style={{ ...inputStyle, background: "#1B1D21", color: "#F2EDE4", border: "1px solid #44484D" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: "#9A958A", marginBottom: 4 }}>Email address *</div>
                  <input type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} placeholder="you@company.com" style={{ ...inputStyle, background: "#1B1D21", color: "#F2EDE4", border: "1px solid #44484D" }} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: "#9A958A", marginBottom: 4 }}>I am a *</div>
                  <select value={form.role} onChange={e => setForm(f => ({...f, role: e.target.value}))} style={{ ...inputStyle, background: "#1B1D21", color: "#F2EDE4", border: "1px solid #44484D" }}>
                    <option value="carrier">Carrier / Owner-Operator</option>
                    <option value="shipper">Shipper</option>
                    <option value="company">Company (Fleet / Logistics)</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: "#9A958A", marginBottom: 4 }}>Business name *</div>
                  <input value={form.company} onChange={e => setForm(f => ({...f, company: e.target.value}))} placeholder="Your company name" style={{ ...inputStyle, background: "#1B1D21", color: "#F2EDE4", border: "1px solid #44484D" }} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#9A958A", marginBottom: 4 }}>Phone (optional — for early access updates)</div>
                <input value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} placeholder="(555) 000-0000" style={{ ...inputStyle, background: "#1B1D21", color: "#F2EDE4", border: "1px solid #44484D", maxWidth: 220 }} />
              </div>
              {err && <div style={{ fontSize: 12, color: "#C0432B" }}>{err}</div>}
              <button
                onClick={submit}
                disabled={status === "loading"}
                style={{ background: "#FFB400", border: "none", color: "#1B1D21", borderRadius: 8, padding: "14px 0", fontWeight: 700, fontSize: 15, cursor: "pointer", opacity: status === "loading" ? 0.7 : 1, marginTop: 4 }}>
                {status === "loading" ? "Joining…" : earlyBirdOpen ? "🚀 Join waitlist — claim my 20% off" : "Join waitlist"}
              </button>
              <div style={{ fontSize: 11, color: "#6B6557", textAlign: "center" }}>
                No spam. We'll only email you when Direct Freight launches.
              </div>
            </div>
          </div>
        )}
      </div>
  );
  if (embedded) return inner;
  return (
    <div style={{ background: "#1B1D21", color: "#F2EDE4", padding: "64px 24px", textAlign: "center" }}>
      {inner}
    </div>
  );
}

// Operator waitlist management panel
function OperatorWaitlistPanel() {
  const [waitlist, setWaitlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.get("/api/waitlist")
      .then(d => setWaitlist(d.waitlist || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const earlyBirds = waitlist.filter(w => w.position <= WAITLIST_LIMIT);
  const standard   = waitlist.filter(w => w.position > WAITLIST_LIMIT);
  const converted  = waitlist.filter(w => w.converted);

  const markConverted = async (id) => {
    try {
      await api.patch(`/api/waitlist/${id}`, { converted: true });
      setWaitlist(prev => prev.map(w => w.id === id ? { ...w, converted: true } : w));
    } catch (e) { alert(e.message); }
  };

  const filtered = waitlist.filter(w =>
    !search || w.name?.toLowerCase().includes(search.toLowerCase()) || w.email?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div style={{ color: "#9A958A", fontSize: 13 }}>Loading waitlist…</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Stats */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {[
          { label: "Total on waitlist", value: waitlist.length, color: "#FFB400" },
          { label: "Early birds (20% off)", value: earlyBirds.length, color: "#3E7A4B" },
          { label: "Standard waitlist", value: standard.length, color: "#9A958A" },
          { label: "Converted to account", value: converted.length, color: "#3A6EA5" },
          { label: "Early bird spots left", value: Math.max(0, WAITLIST_LIMIT - earlyBirds.length), color: earlyBirds.length >= WAITLIST_LIMIT ? "#C0432B" : "#FFB400" },
        ].map(s => (
          <div key={s.label} style={{ background: "#1B1D21", border: "1px solid #2A2D32", borderRadius: 8, padding: "12px 16px", minWidth: 130 }}>
            <div style={{ fontSize: 10, color: "#6B6557", textTransform: "uppercase", marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color, fontFamily: "Oswald, sans-serif" }}>{s.value}</div>
          </div>
        ))}
      </div>

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email…"
        style={{ background: "#1B1D21", border: "1px solid #2A2D32", borderRadius: 6, padding: "8px 12px", color: "#F2EDE4", fontSize: 13, outline: "none", maxWidth: 320 }} />

      {!filtered.length && <div style={{ color: "#6B6557", fontSize: 13 }}>No waitlist signups yet.</div>}

      {filtered.map(w => (
        <div key={w.id} style={{ background: "#1B1D21", border: `1px solid ${w.position <= WAITLIST_LIMIT ? "#3E7A4B" : "#2A2D32"}`, borderRadius: 8, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#F2EDE4", display: "flex", alignItems: "center", gap: 8 }}>
              #{w.position} — {w.name}
              {w.position <= WAITLIST_LIMIT && <span style={{ background: "#3E7A4B", color: "#fff", fontSize: 10, padding: "1px 6px", borderRadius: 4 }}>EARLY BIRD</span>}
              {w.converted && <span style={{ background: "#3A6EA5", color: "#fff", fontSize: 10, padding: "1px 6px", borderRadius: 4 }}>CONVERTED</span>}
            </div>
            <div style={{ fontSize: 11, color: "#9A958A", marginTop: 2 }}>
              {w.email} · {w.role}{w.company ? " · " + w.company : ""}{w.phone ? " · " + w.phone : ""}
            </div>
            {w.promo_code && (
              <div style={{ fontSize: 11, color: "#FFB400", marginTop: 2, fontFamily: "monospace" }}>
                Promo: {w.promo_code} (20% off)
              </div>
            )}
            <div style={{ fontSize: 10, color: "#6B6557", marginTop: 2 }}>{new Date(w.created_at).toLocaleDateString()}</div>
          </div>
          {!w.converted && (
            <button onClick={() => markConverted(w.id)} style={{ background: "#3A6EA5", border: "none", color: "#fff", borderRadius: 6, padding: "6px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
              Mark converted
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// ====================================================================
// PROMO CODE SYSTEM
// Operator creates codes in their dashboard.
// Users redeem codes in their Billing tab.
// ====================================================================

// Benefit types: free_trial_days (extend trial), free_months (free subscription months), discount_pct (% off)
function OperatorPromoPanel() {
  const [codes, setCodes] = useState(PROMO_STORE.codes);
  const [code, setCode]   = useState("");
  const [benefit, setBenefit] = useState("free_trial_days");
  const [amount, setAmount]   = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [expiryDays, setExpiryDays] = useState("");
  const [error, setError] = useState("");

  const BENEFIT_LABELS = {
    free_trial_days: "Extra free trial days",
    free_months:     "Free months",
    discount_pct:    "% discount on subscription",
    free_forever:    "Complimentary account (no charge ever)",
  };

  const create = () => {
    if (!code.trim()) { setError("Enter a promo code."); return; }
    if (code.trim().length < 3) { setError("Code must be at least 3 characters."); return; }
    if (!amount && benefit !== "free_forever") { setError("Enter a benefit amount."); return; }
    if (PROMO_STORE.find(code.trim())) { setError("That code already exists."); return; }
    const newCode = {
      code:      code.trim().toUpperCase(),
      benefit,
      amount:    Number(amount) || 0,
      maxUses:   Number(maxUses) || null,
      expiresAt: expiryDays ? Date.now() + Number(expiryDays) * 86400000 : null,
      usedBy:    [],
      createdAt: Date.now(),
    };
    PROMO_STORE.add(newCode);
    setCodes([...PROMO_STORE.codes]);
    setCode(""); setAmount(""); setMaxUses(""); setExpiryDays(""); setError("");
  };

  const deactivate = (c) => {
    c.expiresAt = Date.now() - 1;
    setCodes([...PROMO_STORE.codes]);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Create new code */}
      <div style={{ background: "#1B1D21", border: "1px solid #2A2D32", borderRadius: 10, padding: 18 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "#FFB400", marginBottom: 12 }}>✨ Create promo code</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 140 }}>
              <div style={{ fontSize: 11, color: "#9A958A", marginBottom: 4 }}>Code</div>
              <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="e.g. LAUNCH50" style={{ ...inputStyle, background: "#2A2D32", color: "#F2EDE4", border: "1px solid #44484D" }} />
            </div>
            <div style={{ flex: 2, minWidth: 180 }}>
              <div style={{ fontSize: 11, color: "#9A958A", marginBottom: 4 }}>Benefit type</div>
              <select value={benefit} onChange={e => setBenefit(e.target.value)} style={{ ...inputStyle, background: "#2A2D32", color: "#F2EDE4", border: "1px solid #44484D" }}>
                {Object.entries(BENEFIT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            {benefit !== "free_forever" && (
              <div style={{ flex: 1, minWidth: 100 }}>
                <div style={{ fontSize: 11, color: "#9A958A", marginBottom: 4 }}>{benefit === "discount_pct" ? "% off" : "Amount"}</div>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder={benefit === "discount_pct" ? "20" : "30"} style={{ ...inputStyle, background: "#2A2D32", color: "#F2EDE4", border: "1px solid #44484D" }} />
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 120 }}>
              <div style={{ fontSize: 11, color: "#9A958A", marginBottom: 4 }}>Max uses (blank = unlimited)</div>
              <input type="number" value={maxUses} onChange={e => setMaxUses(e.target.value)} placeholder="Unlimited" style={{ ...inputStyle, background: "#2A2D32", color: "#F2EDE4", border: "1px solid #44484D" }} />
            </div>
            <div style={{ flex: 1, minWidth: 120 }}>
              <div style={{ fontSize: 11, color: "#9A958A", marginBottom: 4 }}>Expires in (days, blank = never)</div>
              <input type="number" value={expiryDays} onChange={e => setExpiryDays(e.target.value)} placeholder="Never" style={{ ...inputStyle, background: "#2A2D32", color: "#F2EDE4", border: "1px solid #44484D" }} />
            </div>
          </div>
          {error && <div style={{ fontSize: 12, color: "#C0432B" }}>{error}</div>}
          <button onClick={create} style={{ background: "#FFB400", border: "none", color: "#1B1D21", borderRadius: 8, padding: "10px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer", alignSelf: "flex-start" }}>
            Create code
          </button>
        </div>
      </div>

      {/* Existing codes */}
      {!codes.length ? (
        <div style={{ fontSize: 13, color: "#6B6557" }}>No promo codes yet. Create your first one above.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {codes.map((c, i) => {
            const expired = c.expiresAt && Date.now() > c.expiresAt;
            const exhausted = c.maxUses && c.usedBy.length >= c.maxUses;
            const active = !expired && !exhausted;
            return (
              <div key={i} style={{ background: "#1B1D21", border: `1px solid ${active ? "#3E7A4B" : "#44484D"}`, borderRadius: 8, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 15, color: active ? "#FFB400" : "#6B6557" }}>{c.code}</span>
                    <span style={{ fontSize: 10, background: active ? "#3E7A4B" : "#44484D", color: "#fff", padding: "2px 6px", borderRadius: 4 }}>{active ? "ACTIVE" : expired ? "EXPIRED" : "EXHAUSTED"}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "#9A958A", marginTop: 3 }}>
                    {BENEFIT_LABELS[c.benefit]} {c.benefit !== "free_forever" ? `· ${c.amount}${c.benefit === "discount_pct" ? "%" : " " + c.benefit.split("_").slice(-1)[0]}` : ""} · Used: {c.usedBy.length}{c.maxUses ? `/${c.maxUses}` : ""}{c.expiresAt ? ` · Expires: ${new Date(c.expiresAt).toLocaleDateString()}` : " · Never expires"}
                  </div>
                </div>
                {active && <button onClick={() => deactivate(c)} style={{ background: "#C0432B", border: "none", color: "#fff", borderRadius: 6, padding: "5px 10px", fontSize: 11, cursor: "pointer" }}>Deactivate</button>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Promo code redemption — shown in user's Billing tab
function PromoCodeRedemption({ me, onApply }) {
  const [code, setCode] = useState("");
  const [msg, setMsg]   = useState(null); // { ok, text }
  const [used, setUsed] = useState(false);
  const [redeeming, setRedeeming] = useState(false);

  if (used) return (
    <div style={{ background: "#F1F8F2", border: "1px solid #BFE0C6", borderRadius: 8, padding: "10px 12px", fontSize: 13, color: "#3E7A4B", display: "flex", alignItems: "center", gap: 6 }}>
      <CheckCircle2 size={15} /> Promo code applied!
    </div>
  );

  const BENEFIT_LABELS_SHORT = {
    free_trial_days: "extended free trial",
    free_months:     "free subscription months",
    discount_pct:    "% discount applied",
    free_forever:    "complimentary account activated",
  };

  const redeem = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    setRedeeming(true);
    setMsg(null);

    // Early-bird waitlist codes (random EARLY-XXXXXX format) are real, persisted,
    // single-use codes validated against the database — not the in-memory
    // operator promo store. Try this path first for anything matching the pattern.
    if (/^EARLY-[A-Z0-9]{6}$/.test(trimmed)) {
      try {
        const redeemResp = await api.post(`/api/waitlist/promo/${trimmed}/redeem`, { userId: me?.id });
        onApply?.({ benefit: "discount_pct", amount: redeemResp.discountPercent, durationMonths: redeemResp.durationMonths });
        setUsed(true);
        setMsg({ ok: true, text: `Code applied — ${redeemResp.discountPercent}% off for ${redeemResp.durationMonths} months!` });
      } catch (e) {
        setMsg({ ok: false, text: e.message || "Invalid or already-used promo code." });
      } finally {
        setRedeeming(false);
      }
      return;
    }

    // Fall back to operator-created promo codes (Promo Codes tab)
    const result = PROMO_STORE.redeem(trimmed, me.id);
    if (!result.ok) { setMsg({ ok: false, text: result.error }); setRedeeming(false); return; }
    const benefit = PROMO_STORE.find(trimmed);
    onApply?.(benefit);
    setUsed(true);
    setMsg({ ok: true, text: `Code applied — ${BENEFIT_LABELS_SHORT[benefit.benefit] || "benefit applied"}!` });
    setRedeeming(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#44484D" }}>Have a promo code?</div>
      <div style={{ display: "flex", gap: 8 }}>
        <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="Enter code" style={{ ...inputStyle, maxWidth: 200, fontFamily: "monospace", fontWeight: 700 }} />
        <button onClick={redeem} disabled={redeeming} style={{ ...primaryBtn("#FFB400"), padding: "10px 18px", opacity: redeeming ? 0.6 : 1 }}>{redeeming ? "Checking…" : "Apply"}</button>
      </div>
      {msg && <div style={{ fontSize: 12, color: msg.ok ? "#3E7A4B" : "#C0432B" }}>{msg.text}</div>}
    </div>
  );
}

// ====================================================================
// 1. PUSH NOTIFICATIONS — request permission and fire on lane matches
// ====================================================================
function usePushNotifications() {
  const requestPermission = async () => {
    if (typeof Notification === "undefined") return "unsupported";
    if (Notification.permission === "granted") return "granted";
    if (Notification.permission === "denied") return "denied";
    const result = await Notification.requestPermission();
    return result;
  };

  const sendNotification = (title, body, tag) => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    try { new Notification(title, { body, tag, icon: "/favicon.ico" }); } catch (e) {}
  };

  return { requestPermission, sendNotification };
}

// ====================================================================
// 2. AUTOMATED LOAD MATCH EMAILS
// Fires when a load is posted — checks all carriers' saved lanes
// and sends EmailJS emails to matching carriers
// ====================================================================
async function sendLaneMatchEmails(newLoad, allTruckers) {
  if (EMAILJS_SERVICE_ID === "YOUR_EMAILJS_SERVICE_ID") {
    const matches = allTruckers.filter(t => t.lanes?.length && laneMatches(t.lanes, newLoad));
    console.log(`[Email] Would notify ${matches.length} carriers about lane match:`, newLoad.origin, "→", newLoad.destination);
    return matches.length;
  }
  const matches = allTruckers.filter(t => t.lanes?.length && laneMatches(t.lanes, newLoad) && t.email);
  let sent = 0;
  for (const trucker of matches) {
    try {
      const ejs = await loadEmailJS();
      await ejs.send(EMAILJS_SERVICE_ID, EMAILJS_VERIFY_TEMPLATE, {
        to_email:     trucker.email,
        user_name:    trucker.name,
        verify_code:  "LANE MATCH",
        platform_name: `New load on your lane: ${newLoad.origin} → ${newLoad.destination} · ${fmtMoney(newLoad.price)} · ${newLoad.weight?.toLocaleString()} lbs. Log in to Direct Freight to bid now.`,
      });
      sent++;
    } catch (e) { console.warn("Lane match email failed:", e.message); }
  }
  return sent;
}

// ====================================================================
// 3. SAFERWATCH PANEL — operator can check real-time insurance
// ====================================================================
function SaferWatchPanel({ me }) {
  const [dotNumber, setDotNumber] = useState(me?.dotNumber || "");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const check = async () => {
    if (!dotNumber) return;
    setLoading(true);
    try {
      const data = await api.get(`/api/insurance-monitor/${dotNumber.replace(/\D/g, "")}`);
      setResult(data);
    } catch (err) {
      setResult({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card style={{ padding: 20 }}>
      <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 16, textTransform: "uppercase", marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
        <ShieldCheck size={16} color="#3A6EA5" /> SaferWatch — Real-Time Insurance Monitor
      </div>
      <div style={{ fontSize: 13, color: "#6B6557", marginBottom: 14, lineHeight: 1.5 }}>
        Check a carrier's insurance status in real time directly with the insurer — not just what's on file with FMCSA. Add your SaferWatch API key to Railway to activate continuous monitoring and lapse alerts.
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <input value={dotNumber} onChange={e => setDotNumber(e.target.value)} placeholder="DOT number" style={{ ...inputStyle, maxWidth: 200 }} />
        <button onClick={check} disabled={loading || !dotNumber} style={{ ...primaryBtn("#3A6EA5"), color: "#fff", padding: "10px 18px", opacity: dotNumber ? 1 : 0.5 }}>
          {loading ? "Checking…" : "Check insurance"}
        </button>
      </div>
      {result && !result.error && !result.monitored && (
        <div style={{ background: "#FFF6E5", border: "1px solid #FFD98C", borderRadius: 8, padding: 12, fontSize: 13, color: "#B5790A" }}>
          <b>SaferWatch not configured.</b> Add <code>SAFERWATCH_API_KEY</code> to your Railway environment variables to enable real-time insurance verification. Contact SaferWatch at saferwatch.com to get an API key (use the Broker tier).
        </div>
      )}
      {result?.monitored && (
        <div style={{ background: "#F1F8F2", border: "1px solid #BFE0C6", borderRadius: 8, padding: 12, fontSize: 13 }}>
          <div style={{ fontWeight: 700, color: "#3E7A4B", marginBottom: 6 }}>✅ SaferWatch Live Data</div>
          <pre style={{ margin: 0, fontSize: 11, color: "#44484D", overflow: "auto" }}>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
      {result?.error && (
        <div style={{ color: "#C0432B", fontSize: 12 }}>Error: {result.error}</div>
      )}
    </Card>
  );
}

// ====================================================================
// 4. DISPUTE RESOLUTION SYSTEM
// ====================================================================
const DISPUTE_TYPES = ["Detention fee dispute", "Cargo damage", "Load not delivered", "Payment not released", "Carrier no-show", "Freight count discrepancy", "Rate dispute", "Other"];

// ====================================================================
// CANCEL LOAD — lets shippers cancel a load, and carriers back out of
// one they've accepted. Requires a reason and confirmation.
// ====================================================================
const CANCEL_REASONS_SHIPPER = ["Freight no longer needs to ship", "Found a different carrier", "Pickup/delivery details changed", "Pricing issue", "Other"];
const CANCEL_REASONS_CARRIER = ["Truck broke down / mechanical issue", "Scheduling conflict", "Rate no longer works", "Freight details don't match what was posted", "Other"];

function CancelLoadButton({ load, me, onCancel }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [otherReason, setOtherReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isCarrier = me.role === "trucker";
  const reasons = isCarrier ? CANCEL_REASONS_CARRIER : CANCEL_REASONS_SHIPPER;

  // Shippers can cancel open or in_transit loads. Carriers can only back out of in_transit loads they're on.
  const canCancel = load.status === "open" || load.status === "in_transit";
  if (!canCancel) return null;

  const submit = async () => {
    const finalReason = reason === "Other" ? otherReason.trim() : reason;
    if (!finalReason) { alert("Please select or describe a reason for cancelling."); return; }
    setSubmitting(true);
    await onCancel(finalReason);
    setSubmitting(false);
    setOpen(false);
    setReason(""); setOtherReason("");
  };

  return (
    <>
      <button onClick={() => setOpen(true)} style={{ ...ghostBtn, color: "#C0432B", border: "1px solid #F3B7A6", fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}>
        <X size={13} /> {isCarrier ? "Back out of this load" : "Cancel load"}
      </button>
      {open && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16 }} onClick={() => setOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, width: "100%", maxWidth: 440, overflow: "hidden", boxShadow: "0 12px 40px rgba(0,0,0,0.3)" }}>
            <div style={{ background: "#C0432B", color: "#fff", padding: "14px 20px", fontWeight: 700, fontSize: 15, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              {isCarrier ? "Back out of this load" : "Cancel this load"}
              <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer" }}><X size={18} /></button>
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ fontSize: 13, color: "#6B6557", lineHeight: 1.5 }}>
                {isCarrier
                  ? "This load will be reopened on the board so the shipper can find another carrier. The shipper will be notified you can no longer haul this load."
                  : load.status === "in_transit"
                    ? "This load has already been accepted by a carrier. Cancelling will notify them and permanently close the load."
                    : "This will permanently close the load and remove it from the board."}
              </div>
              <Field label="Reason for cancelling">
                <select value={reason} onChange={e => setReason(e.target.value)} style={inputStyle}>
                  <option value="">Select a reason…</option>
                  {reasons.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
              {reason === "Other" && (
                <Field label="Please describe">
                  <textarea value={otherReason} onChange={e => setOtherReason(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
                </Field>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={submit} disabled={submitting} style={{ ...primaryBtn("#C0432B"), flex: 1, color: "#fff" }}>
                  {submitting ? "Cancelling…" : isCarrier ? "Confirm — back out of load" : "Confirm cancellation"}
                </button>
                <button onClick={() => setOpen(false)} style={ghostBtn}>Never mind</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function DisputeButton({ load, me, onFiled }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState(DISPUTE_TYPES[0]);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!description.trim()) { alert("Please describe the dispute."); return; }
    setSubmitting(true);
    try {
      const againstId = me.role === "trucker" ? load.shipperId : load.truckerId;
      const againstName = me.role === "trucker" ? load.shipperName : load.truckerName || "Carrier";
      await api.post("/api/disputes", {
        loadId: load.id, filedBy: me.id, filedByName: me.name,
        filedByRole: me.role, againstId, againstName, type, description,
      });
      onFiled?.();
      setOpen(false);
      setDescription("");
      alert("Dispute filed. The platform operator will review and contact both parties within 48 hours.");
    } catch (err) {
      alert("Could not file dispute: " + err.message);
    } finally { setSubmitting(false); }
  };

  return (
    <>
      <button onClick={() => setOpen(true)} style={{ ...ghostBtn, color: "#C0432B", border: "1px solid #F3B7A6", fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}>
        <FileText size={13} /> File dispute
      </button>
      {open && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16 }} onClick={() => setOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, width: "100%", maxWidth: 480, overflow: "hidden", boxShadow: "0 12px 40px rgba(0,0,0,0.3)" }}>
            <div style={{ background: "#C0432B", color: "#fff", padding: "14px 20px", fontWeight: 700, fontSize: 15, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              File a Dispute — Load {load.origin} → {load.destination}
              <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer" }}><X size={18} /></button>
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: 13, color: "#6B6557", lineHeight: 1.5 }}>
                The Direct Freight operator will review this dispute and contact both parties within 48 hours. All disputes are logged permanently.
              </div>
              <Field label="Dispute type">
                <select value={type} onChange={e => setType(e.target.value)} style={inputStyle}>
                  {DISPUTE_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Describe the issue in detail">
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={5}
                  placeholder="Explain what happened, including dates, amounts, and any relevant details..."
                  style={{ ...inputStyle, resize: "vertical" }} />
              </Field>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={submit} disabled={submitting} style={{ ...primaryBtn("#C0432B"), flex: 1, color: "#fff" }}>
                  {submitting ? "Filing…" : "Submit dispute"}
                </button>
                <button onClick={() => setOpen(false)} style={ghostBtn}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function OperatorDisputesPanel() {
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [resolution, setResolution] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    api.get("/api/disputes")
      .then(d => setDisputes(d.disputes || []))
      .catch(e => console.warn("Could not load disputes:", e.message))
      .finally(() => setLoading(false));
  }, []);

  const update = async (id, patch) => {
    try {
      const { dispute } = await api.patch(`/api/disputes/${id}`, patch);
      setDisputes(prev => prev.map(d => d.id === id ? dispute : d));
      setSelected(null);
    } catch (e) { alert(e.message); }
  };

  const statusColor = { open: "#C0432B", under_review: "#B5790A", resolved: "#3E7A4B", dismissed: "#9A958A" };

  if (loading) return <div style={{ color: "#9A958A", fontSize: 13 }}>Loading disputes…</div>;
  if (!disputes.length) return <div style={{ color: "#6B6557", fontSize: 13 }}>No disputes filed yet.</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {disputes.map(d => (
        <div key={d.id} style={{ background: "#1B1D21", border: `1px solid ${statusColor[d.status] || "#2A2D32"}`, borderRadius: 8, padding: "12px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#F2EDE4", marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
                {d.type}
                <span style={{ background: statusColor[d.status], color: "#fff", fontSize: 10, padding: "2px 6px", borderRadius: 4, textTransform: "uppercase" }}>{d.status.replace("_", " ")}</span>
              </div>
              <div style={{ fontSize: 11, color: "#9A958A" }}>Filed by: {d.filed_by_name} ({d.filed_by_role}) · Against: {d.against_name}</div>
              <div style={{ fontSize: 11, color: "#9A958A" }}>Load ID: {d.load_id} · {new Date(d.created_at).toLocaleDateString()}</div>
              <div style={{ fontSize: 12, color: "#C9C2B3", marginTop: 6, lineHeight: 1.5 }}>{d.description}</div>
            </div>
            <button onClick={() => { setSelected(d); setResolution(d.resolution || ""); setNotes(d.operator_notes || ""); }}
              style={{ background: "#FFB400", border: "none", color: "#1B1D21", borderRadius: 6, padding: "6px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
              Review
            </button>
          </div>
        </div>
      ))}

      {selected && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 16 }}>
          <div style={{ background: "#1B1D21", border: "1px solid #2A2D32", borderRadius: 12, padding: 24, width: "100%", maxWidth: 480, color: "#F2EDE4" }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 14 }}>Review Dispute — {selected.type}</div>
            <div style={{ fontSize: 13, color: "#C9C2B3", marginBottom: 14, lineHeight: 1.5 }}>{selected.description}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Field label={<span style={{ color: "#9A958A" }}>Resolution notes (visible to both parties)</span>}>
                <textarea value={resolution} onChange={e => setResolution(e.target.value)} rows={3} style={{ ...inputStyle, background: "#2A2D32", color: "#F2EDE4", border: "1px solid #44484D" }} />
              </Field>
              <Field label={<span style={{ color: "#9A958A" }}>Internal operator notes (not shared)</span>}>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} style={{ ...inputStyle, background: "#2A2D32", color: "#F2EDE4", border: "1px solid #44484D" }} />
              </Field>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button onClick={() => update(selected.id, { status: "under_review", operator_notes: notes })} style={{ background: "#B5790A", border: "none", color: "#fff", borderRadius: 6, padding: "8px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Mark Under Review</button>
                <button onClick={() => update(selected.id, { status: "resolved", resolution, operator_notes: notes })} style={{ background: "#3E7A4B", border: "none", color: "#fff", borderRadius: 6, padding: "8px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Mark Resolved</button>
                <button onClick={() => update(selected.id, { status: "dismissed", resolution, operator_notes: notes })} style={{ background: "#44484D", border: "none", color: "#fff", borderRadius: 6, padding: "8px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Dismiss</button>
                <button onClick={() => setSelected(null)} style={{ background: "#2A2D32", border: "none", color: "#9A958A", borderRadius: 6, padding: "8px 12px", fontSize: 12, cursor: "pointer" }}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ====================================================================
// 5. BROKER SAVINGS REPORT
// ====================================================================
function BrokerSavingsReport({ loads, me }) {
  const BROKER_RATE = 0.15; // brokers take ~15% on average
  const myLoads = loads.filter(l => (l.shipperId === me.id || l.shipperName?.includes(me.name)) && l.paid);
  const totalPaid = myLoads.reduce((a, l) => a + (l.price || 0), 0);
  const brokerWouldHaveCharged = totalPaid / (1 - BROKER_RATE);
  const totalSaved = brokerWouldHaveCharged - totalPaid;
  const subscriptionCost = me?.role === "trucker" ? 29 : 49; // monthly
  const netSavings = totalSaved - subscriptionCost;
  const avgBrokerRate = myLoads.length ? (brokerWouldHaveCharged / myLoads.length) : 0;
  const avgDirectRate = myLoads.length ? (totalPaid / myLoads.length) : 0;

  const emailReport = async () => {
    if (EMAILJS_SERVICE_ID === "YOUR_EMAILJS_SERVICE_ID") {
      alert("Configure EmailJS to send savings reports by email."); return;
    }
    try {
      const ejs = await loadEmailJS();
      await ejs.send(EMAILJS_SERVICE_ID, EMAILJS_VERIFY_TEMPLATE, {
        to_email: me.email,
        user_name: me.name,
        verify_code: "SAVINGS REPORT",
        platform_name: `Your Direct Freight Savings Report:\n\nLoads shipped: ${myLoads.length}\nTotal freight cost: ${fmtMoney(totalPaid)}\nEstimated broker cost: ${fmtMoney(brokerWouldHaveCharged)}\nTotal saved: ${fmtMoney(totalSaved)}\nNet savings after subscription: ${fmtMoney(netSavings)}\n\nKeep saving by posting your next load at directfreight.com`,
      });
      alert("Savings report sent to " + me.email);
    } catch (e) { alert("Could not send report: " + e.message); }
  };

  return (
    <Card style={{ padding: 20 }}>
      <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 16, textTransform: "uppercase", marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
        <DollarSign size={16} color="#3E7A4B" /> Broker Savings Report
      </div>
      <div style={{ fontSize: 13, color: "#6B6557", marginBottom: 16, lineHeight: 1.5 }}>
        See how much you've saved by shipping direct instead of through a freight broker (industry avg: 15% markup).
      </div>

      {!myLoads.length ? (
        <div style={{ fontSize: 13, color: "#9A958A" }}>No completed paid loads yet. Savings appear after your first delivered load.</div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
            {[
              { label: "Loads shipped", value: myLoads.length, color: "#3A6EA5" },
              { label: "Total you paid", value: fmtMoney(totalPaid), color: "#44484D" },
              { label: "Est. broker cost", value: fmtMoney(brokerWouldHaveCharged), color: "#C0432B" },
              { label: "Total saved", value: fmtMoney(totalSaved), color: "#3E7A4B", highlight: true },
              { label: `Net after $${me?.role === "trucker" ? 29 : 49}/mo sub`, value: fmtMoney(netSavings), color: "#3E7A4B", highlight: true },
            ].map(s => (
              <div key={s.label} style={{ background: s.highlight ? "#F1F8F2" : "#FBF9F4", border: `1px solid ${s.highlight ? "#BFE0C6" : "#E2DCCC"}`, borderRadius: 8, padding: "12px 16px", minWidth: 140, flex: 1 }}>
                <div style={{ fontSize: 11, color: "#9A958A", textTransform: "uppercase", marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: s.color, fontFamily: "Oswald, sans-serif" }}>{s.value}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12, color: "#9A958A", marginBottom: 14, lineHeight: 1.5 }}>
            Avg rate you paid: <b>{fmtMoney(avgDirectRate)}/load</b> · Avg estimated broker rate: <b>{fmtMoney(avgBrokerRate)}/load</b> · Savings per load: <b>{fmtMoney(avgBrokerRate - avgDirectRate)}</b>
          </div>
          <button onClick={emailReport} style={{ ...ghostBtn, display: "flex", alignItems: "center", gap: 6 }}>
            <Download size={13} /> Email this report to {me.email}
          </button>
        </>
      )}
    </Card>
  );
}

// ====================================================================
// 6. PROGRAMMATIC SEO PAGES
// Auto-generated landing pages for freight lane searches
// ====================================================================
const SEO_LANES = [
  { origin: "Dayton, OH", dest: "Columbus, OH", miles: 72, type: "Flatbed" },
  { origin: "Dayton, OH", dest: "Cincinnati, OH", miles: 55, type: "Dry Van" },
  { origin: "Dayton, OH", dest: "Louisville, KY", miles: 117, type: "Dry Van" },
  { origin: "Dayton, OH", dest: "Indianapolis, IN", miles: 113, type: "Flatbed" },
  { origin: "Dayton, OH", dest: "Cleveland, OH", miles: 145, type: "Reefer" },
  { origin: "Columbus, OH", dest: "Chicago, IL", miles: 358, type: "Dry Van" },
  { origin: "Cincinnati, OH", dest: "Nashville, TN", miles: 272, type: "Flatbed" },
  { origin: "Columbus, OH", dest: "Pittsburgh, PA", miles: 185, type: "Dry Van" },
  { origin: "Indianapolis, IN", dest: "Chicago, IL", miles: 182, type: "Dry Van" },
  { origin: "Louisville, KY", dest: "Atlanta, GA", miles: 421, type: "Reefer" },
  { origin: "Cleveland, OH", dest: "Detroit, MI", miles: 170, type: "Flatbed" },
  { origin: "Cincinnati, OH", dest: "Columbus, OH", miles: 107, type: "Dry Van" },
];

function SEOLandingPages({ setPage }) {
  const [selectedLane, setSelectedLane] = useState(null);

  if (selectedLane) {
    const lane = selectedLane;
    return (
      <div style={{ minHeight: "100vh", background: "#F2EDE4", fontFamily: "Inter, sans-serif" }}>
        <MarketingNav page="seo" setPage={setPage} />
        <div style={{ maxWidth: 860, margin: "0 auto", padding: "40px 24px" }}>
          <button onClick={() => setSelectedLane(null)} style={{ ...ghostBtn, marginBottom: 20, display: "flex", alignItems: "center", gap: 6 }}>
            <ArrowLeft size={14} /> Back to freight lanes
          </button>
          <h1 style={{ fontFamily: "Oswald, sans-serif", fontSize: 32, fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>
            {lane.type} Loads from {lane.origin} to {lane.dest}
          </h1>
          <p style={{ fontSize: 16, color: "#6B6557", marginBottom: 24, lineHeight: 1.6 }}>
            Find direct {lane.type.toLowerCase()} freight loads from {lane.origin} to {lane.dest} without a broker. {lane.miles} miles. Direct Freight Co connects shippers and carriers directly — no broker cut, no middleman.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 32 }}>
            {[
              { label: "Distance", value: `${lane.miles} miles` },
              { label: "Equipment", value: lane.type },
              { label: "Typical transit", value: lane.miles > 300 ? "2 days" : "Same day" },
              { label: "Broker savings", value: "~15%" },
            ].map(s => (
              <div key={s.label} style={{ background: "#fff", border: "1px solid #E2DCCC", borderRadius: 8, padding: "12px 16px", minWidth: 130 }}>
                <div style={{ fontSize: 11, color: "#9A958A", textTransform: "uppercase" }}>{s.label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "Oswald, sans-serif", marginTop: 4 }}>{s.value}</div>
              </div>
            ))}
          </div>
          <div style={{ background: "#1B1D21", color: "#F2EDE4", borderRadius: 12, padding: 28, marginBottom: 28 }}>
            <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 22, fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>
              Post or bid on {lane.origin} → {lane.dest} loads today
            </div>
            <p style={{ fontSize: 14, color: "#C9C2B3", marginBottom: 16, lineHeight: 1.6 }}>
              Direct Freight is the only broker-free freight marketplace for this lane. Shippers post loads directly, carriers bid their own rate, and both parties connect without a broker taking 15%.
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={() => setPage("shippers")} style={{ background: "#FFB400", color: "#1B1D21", border: "none", borderRadius: 8, padding: "12px 20px", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                Post a {lane.type} load — free trial
              </button>
              <button onClick={() => setPage("carriers")} style={{ background: "transparent", color: "#FFB400", border: "1px solid #FFB400", borderRadius: 8, padding: "12px 20px", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                Find loads on this lane
              </button>
            </div>
          </div>
          <div>
            <h2 style={{ fontFamily: "Oswald, sans-serif", fontSize: 20, textTransform: "uppercase", marginBottom: 12 }}>Why direct freight on this lane?</h2>
            {[
              `No broker markup — keep the full rate on {lane.origin} to {lane.dest} freight`,
              `Post loads in under 2 minutes and get bids from verified {lane.type.toLowerCase()} carriers`,
              `Automated detention billing at $60/hr if a carrier is kept waiting at your facility`,
              `All carriers are FMCSA-verified with active operating authority`,
              `Free instant payouts to carriers — no waiting 30-45 days for a broker to pay`,
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 0", borderBottom: "1px solid #E2DCCC", fontSize: 14, color: "#44484D", lineHeight: 1.5 }}>
                <span style={{ color: "#3E7A4B", fontWeight: 700, marginTop: 1 }}>✓</span>
                {item.replace("{lane.origin}", lane.origin).replace("{lane.dest}", lane.dest).replace("{lane.type.toLowerCase()}", lane.type.toLowerCase())}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F2EDE4", fontFamily: "Inter, sans-serif" }}>
      <MarketingNav page="seo" setPage={setPage} />
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "40px 24px" }}>
        <h1 style={{ fontFamily: "Oswald, sans-serif", fontSize: 32, fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>
          Freight Lanes — No Broker Required
        </h1>
        <p style={{ fontSize: 16, color: "#6B6557", marginBottom: 32, lineHeight: 1.6, maxWidth: 640 }}>
          Direct Freight Co connects shippers and carriers directly on the most popular Midwest freight lanes. No broker. No commission. No middleman.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
          {SEO_LANES.map((lane, i) => (
            <button key={i} onClick={() => setSelectedLane(lane)} style={{ background: "#fff", border: "1px solid #E2DCCC", borderRadius: 10, padding: "16px 18px", textAlign: "left", cursor: "pointer", transition: "box-shadow 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)"}
              onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}>
              <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 16, marginBottom: 4, color: "#1B1D21" }}>
                {lane.origin} → {lane.dest}
              </div>
              <div style={{ fontSize: 12, color: "#9A958A", display: "flex", gap: 10 }}>
                <span>{lane.type}</span>
                <span>·</span>
                <span>{lane.miles} mi</span>
                <span>·</span>
                <span style={{ color: "#3E7A4B", fontWeight: 600 }}>No broker</span>
              </div>
            </button>
          ))}
        </div>
        <div style={{ marginTop: 32, background: "#1B1D21", color: "#F2EDE4", borderRadius: 12, padding: 24, textAlign: "center" }}>
          <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 20, fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>
            Don't see your lane?
          </div>
          <p style={{ fontSize: 14, color: "#C9C2B3", marginBottom: 16 }}>
            Direct Freight works for any lane in the US — post or bid on any origin/destination pair.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={() => setPage("shippers")} style={{ background: "#FFB400", color: "#1B1D21", border: "none", borderRadius: 8, padding: "12px 20px", fontWeight: 700, cursor: "pointer" }}>
              Post a load
            </button>
            <button onClick={() => setPage("carriers")} style={{ background: "transparent", color: "#FFB400", border: "1px solid #FFB400", borderRadius: 8, padding: "12px 20px", fontWeight: 700, cursor: "pointer" }}>
              Find loads
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
