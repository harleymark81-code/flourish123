import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Crown, Check, Star, ChevronDown, ChevronUp } from "lucide-react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { ph } from "../lib/posthog";

const PAYWALL_HEADLINES = {
  pcos: "Stop guessing what to eat for your PCOS. Start knowing.",
  thyroid: "Stop guessing what food is affecting your thyroid. Start knowing.",
  autoimmune: "Stop guessing what triggers your autoimmune flares. Start knowing.",
  ibs: "Stop guessing what food is upsetting your gut. Start knowing.",
  endometriosis: "Stop guessing what food is fuelling your endometriosis. Start knowing.",
  hormonal_imbalance: "Stop guessing what food is disrupting your hormones. Start knowing.",
  type2_diabetes: "Stop guessing what to eat for your blood sugar. Start knowing.",
  general_health: "Stop guessing what to eat for your health. Start knowing."
};

const ENTRY_MESSAGES = {
  diary: "Your food diary is a Flourish Premium feature. Track every food you eat, see your patterns, and watch your health transform.",
  inflammation: "Your inflammation score is waiting. Inflammation is one of the biggest drivers of your condition.",
  hormonal: "Your hormonal impact score is ready. This shows exactly how this food interacts with your hormones.",
  gut_health: "Your gut health score is ready. Gut health directly affects hormonal balance.",
  condition_insight: "Your personalised insight is one tap away. This is where Flourish gets specific to your body.",
  alternatives: "There are 2 more foods that score better for your condition. See them.",
  swaps: "See personalised food swaps tailored to your exact conditions — rated and ready to try.",
  meal_plan: "Your full day meal plan is ready.",
  scan_limit: "Your free scan has been used. Start a free trial to unlock unlimited ratings every day.",
  symptoms: "Symptom tracking is a Premium feature. Log how you feel daily and uncover patterns between food and your health.",
  favourites: "You've reached the 3-favourite limit on the free plan. Upgrade to save unlimited foods.",
  history: "See your full scan history, filter by score, and track what you eat over time.",
  insights: "Unlock your streaks, weekly food scores, symptom patterns, and personalised badges.",
  patterns: "After 14+ days of logging, Flourish identifies patterns between what you eat and how you feel — personalised to your condition.",
  shopping_list: "Build a personalised shopping list of foods that work for your condition.",
  default: ""
};

const TESTIMONIALS = [
  { name: "Sarah", condition: "PCOS", text: "I finally understand why certain foods were triggering my symptoms. Game changer." },
  { name: "Emma", condition: "Autoimmune", text: "Nothing has explained the connection between food and my flares like this. I wish I found this sooner." },
  { name: "Jade", condition: "Thyroid", text: "I scanned my breakfast and finally understood why I felt terrible every morning." }
];

const NUDGE_QUOTES = [
  "You've already spent £4.50 on that coffee. Your hormones are still waiting.",
  "Every meal without Flourish is a guess. How many guesses can your body afford?",
  "You googled your symptoms. You deserve better than that.",
  "Counting calories while ignoring hormones is like fixing a leak with a bucket.",
  "You wouldn't take someone else's prescription. Why follow someone else's diet?",
  "Less than 43p a day. That's what knowing exactly what to eat costs.",
  "One nutritionist appointment costs £80. Flourish costs £12.99 a month. Forever.",
  "Your condition doesn't take days off. Your food intelligence shouldn't either.",
  "Every day you eat blind is a day your hormones pay the price.",
  "Still guessing? For £12.99 a month, that's the most expensive thing you own.",
];

const BENEFITS = [
  "Rate every food you eat — never guess again.",
  "See exactly how food is affecting your hormones today.",
  "Your food diary — track every meal and watch your health transform.",
  "Get the breakdown your doctor never has time to give you.",
  "Wake up every morning knowing exactly what your body needs today.",
  "Understand patterns in your health that took others years to figure out."
];

function ConfettiBurst() {
  const pieces = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    color: i % 2 === 0 ? "#534AB7" : "#fff",
    x: (Math.random() - 0.5) * 400,
    y: -200 - Math.random() * 300,
    rotate: Math.random() * 720,
    size: 6 + Math.random() * 8
  }));
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 9999, overflow: "hidden" }}>
      {pieces.map(p => (
        <motion.div
          key={p.id}
          initial={{ x: "50vw", y: "40vh", opacity: 1, rotate: 0 }}
          animate={{ x: `calc(50vw + ${p.x}px)`, y: p.y, opacity: 0, rotate: p.rotate }}
          transition={{ duration: 1.2, ease: "easeOut", delay: Math.random() * 0.3 }}
          style={{ position: "absolute", width: p.size, height: p.size, background: p.color, borderRadius: 2 }}
        />
      ))}
    </div>
  );
}

export default function Paywall({ onClose, user: userProp, entryPoint = "default", hardGate = false }) {
  const { getHeaders, API, refreshUser, user: authUser, loading: authLoading } = useAuth();
  const user = authUser || userProp;
  const [plan, setPlan] = useState("annual");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [testimonialIdx, setTestimonialIdx] = useState(0);
  const [nudgeIdx, setNudgeIdx] = useState(() => Math.floor(Math.random() * NUDGE_QUOTES.length));
  const [showExit, setShowExit] = useState(false);
  const scrollRef = useRef(null);

  const conditions = user?.conditions || [];
  const primaryCondition = conditions[0] || "general_health";
  const headline = PAYWALL_HEADLINES[primaryCondition] || PAYWALL_HEADLINES.general_health;
  const entryMsg = ENTRY_MESSAGES[entryPoint] || ENTRY_MESSAGES.default;

  useEffect(() => {
    const t = setInterval(() => setTestimonialIdx(i => (i + 1) % TESTIMONIALS.length), 4000);
    const n = setInterval(() => setNudgeIdx(i => (i + 1) % NUDGE_QUOTES.length), 5000);
    return () => { clearInterval(t); clearInterval(n); };
  }, []);

  const handleSubscribe = async () => {
    if (!user) {
      setError("Please sign in to continue.");
      return;
    }
    ph.upgradeCTAClicked(plan);
    setLoading(true);
    setError("");
    try {
      const res = await axios.post(`${API}/payments/checkout`, {
        plan,
        origin_url: window.location.origin
      }, { headers: getHeaders(), withCredentials: true });

      if (res.data.url) {
        ph.freeTrialStarted(plan);
        window.location.href = res.data.url;
      } else {
        setError("Could not create checkout session. Please try again.");
      }
    } catch (e) {
      if (e.response?.status === 401) {
        ph.apiError("/payments/checkout", "Not authenticated", 401);
        setError("Your session has expired. Please sign in again.");
        setTimeout(() => { onClose(); }, 2000);
        return;
      }
      const msg = e.response?.data?.detail || "Something went wrong. Please try again.";
      ph.apiError("/payments/checkout", String(msg), e.response?.status);
      setError(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => { if (hardGate) return; setShowExit(true); };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{ position: "fixed", inset: 0, zIndex: 5000, background: "rgba(0,0,0,0.65)", overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0, transition: { type: "spring", damping: 30, stiffness: 260 } }}
          exit={{ y: "100%" }}
          ref={scrollRef}
          style={{ minHeight: "100%", background: "var(--bg-elevated)", maxWidth: 480, margin: "0 auto", position: "relative", paddingBottom: 40 }}>

          {/* Sticky header */}
          <div style={{ position: "sticky", top: 0, background: "var(--header-sticky)", backdropFilter: "blur(20px)", padding: "16px 20px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)", zIndex: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, #F6D365, #FDA085)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Crown size={14} color="#fff" />
              </div>
              <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Flourish Premium</span>
            </div>
            {!hardGate && (
              <motion.button data-testid="paywall-close-btn" whileTap={{ scale: 0.88 }} onClick={handleClose}
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <X size={16} color="#6B6A7C" />
              </motion.button>
            )}
          </div>

          <div style={{ padding: "20px 20px 0" }}>

            {/* Entry-point specific message */}
            {entryMsg && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                style={{ background: "linear-gradient(135deg, rgba(83,74,183,0.08), rgba(83,74,183,0.04))", border: "1px solid rgba(83,74,183,0.2)", borderRadius: 12, padding: "12px 16px", marginBottom: 16 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: "#534AB7", margin: 0, lineHeight: 1.4 }}>{entryMsg}</p>
              </motion.div>
            )}

            {/* Free trial badge */}
            <div style={{ background: "linear-gradient(135deg, #639922, #7ab82a)", borderRadius: 14, padding: "14px 20px", textAlign: "center", marginBottom: 20, boxShadow: "0 4px 16px rgba(99,153,34,0.25)" }}>
              <p style={{ color: "#fff", fontWeight: 800, fontSize: 17, margin: 0, letterSpacing: "-0.01em" }}>
                {plan === "annual" ? "7-day free trial — cancel anytime" : "3-day free trial — cancel anytime"}
              </p>
              <p style={{ color: "rgba(255,255,255,0.88)", fontSize: 13, margin: "2px 0 0" }}>
                {plan === "annual" ? "No charge until day 8. Cancel in one tap." : "No charge until day 4. Cancel in one tap."}
              </p>
            </div>

            {/* Headline */}
            <h1 style={{ fontSize: 28, fontWeight: 800, color: "var(--text-primary)", lineHeight: 1.25, marginBottom: 10, textAlign: "center", letterSpacing: "-0.02em" }}>{headline}</h1>

            {/* Rotating motivational subheadline */}
            <div style={{ minHeight: 52, marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <AnimatePresence mode="wait">
                <motion.p
                  key={nudgeIdx}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.35 }}
                  style={{ fontSize: 14, color: "#534AB7", fontWeight: 600, lineHeight: 1.5, textAlign: "center", margin: 0, fontStyle: "italic" }}>
                  {NUDGE_QUOTES[nudgeIdx]}
                </motion.p>
              </AnimatePresence>
            </div>

            <p style={{ fontSize: 15, color: "var(--text-secondary)", lineHeight: 1.55, marginBottom: 20, textAlign: "center" }}>
              The food decisions you make today are either fuelling your condition or fighting it. Flourish tells you which.
            </p>

            {/* Price justification */}
            <div style={{ background: "var(--bg-card)", borderRadius: 14, padding: "16px 18px", marginBottom: 16, border: "1px solid var(--border)", boxShadow: "0 2px 16px rgba(83,74,183,0.10)" }}>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7, margin: 0 }}>
                People spend <strong style={{ color: "var(--text-primary)" }}>£5.50 on a Starbucks</strong> that spikes their cortisol.{" "}
                <strong style={{ color: "var(--text-primary)" }}>£45 on one nutritionist appointment</strong> with no daily follow-up.{" "}
                <strong style={{ color: "var(--text-primary)" }}>£10.99 on Netflix</strong> that has never heard of {primaryCondition.replace(/_/g, " ")}.{" "}
                <strong style={{ color: "#534AB7" }}>Flourish Premium is £4.17 a month. Less than one coffee.</strong> The only daily health tool built specifically for your condition.
              </p>
            </div>

            {/* Founding member banner */}
            <div style={{ background: "linear-gradient(135deg, #BA7517, #D97706)", borderRadius: 12, padding: "10px 16px", marginBottom: 16, textAlign: "center" }}>
              <p style={{ color: "#fff", fontWeight: 800, fontSize: 13, margin: 0, letterSpacing: "-0.01em" }}>
                🔒 Founding Member Price — £49.99/year
              </p>
              <p style={{ color: "rgba(255,255,255,0.88)", fontSize: 12, margin: "3px 0 0" }}>
                Price increases to £79 when we hit 500 members. Lock in forever today.
              </p>
            </div>

            {/* Plan toggle */}
            <div style={{ display: "flex", background: "var(--bg-card)", borderRadius: 14, padding: 4, marginBottom: 4, border: "1px solid var(--border)" }}>
              <button data-testid="plan-monthly-btn" onClick={() => setPlan("monthly")}
                style={{ flex: 1, padding: "12px 8px", borderRadius: 11, border: "none", background: plan === "monthly" ? "var(--bg-elevated)" : "transparent", fontWeight: 700, fontSize: 14, color: plan === "monthly" ? "#534AB7" : "var(--text-secondary)", cursor: "pointer", boxShadow: plan === "monthly" ? "0 2px 12px rgba(83,74,183,0.12)" : "none", transition: "all 0.25s" }}>
                Monthly
              </button>
              <button data-testid="plan-annual-btn" onClick={() => setPlan("annual")}
                style={{ flex: 1, padding: "12px 8px", borderRadius: 11, border: "none", background: plan === "annual" ? "var(--bg-elevated)" : "transparent", fontWeight: 700, fontSize: 14, color: plan === "annual" ? "#534AB7" : "var(--text-secondary)", cursor: "pointer", boxShadow: plan === "annual" ? "0 2px 12px rgba(83,74,183,0.12)" : "none", transition: "all 0.25s", position: "relative" }}>
                Annual
                <span style={{ position: "absolute", top: -10, right: 6, background: "#534AB7", color: "#fff", fontSize: 9, fontWeight: 800, padding: "2px 7px", borderRadius: 6, whiteSpace: "nowrap" }}>MOST POPULAR</span>
              </button>
            </div>

            {/* Pricing */}
            <AnimatePresence mode="wait">
              <motion.div key={plan} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                style={{ textAlign: "center", padding: "18px 0 16px" }}>
                {plan === "monthly" ? (
                  <>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 4 }}>
                      <span style={{ fontSize: 44, fontWeight: 800, color: "#534AB7", letterSpacing: "-0.03em" }}>£12.99</span>
                      <span style={{ fontSize: 16, color: "var(--text-secondary)", fontWeight: 500 }}>/month</span>
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <span style={{ background: "rgba(163,45,45,0.1)", color: "#A32D2D", fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 8 }}>
                        You're paying £71 extra per year vs annual
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <p style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "line-through", margin: "0 0 4px" }}>£79/year</p>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 4 }}>
                      <span style={{ fontSize: 44, fontWeight: 800, color: "#534AB7", letterSpacing: "-0.03em" }}>£49.99</span>
                      <span style={{ fontSize: 16, color: "var(--text-secondary)", fontWeight: 500 }}>/year</span>
                    </div>
                    <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 8, flexWrap: "wrap" }}>
                      <span style={{ background: "rgba(99,153,34,0.12)", color: "#639922", fontSize: 12, fontWeight: 800, padding: "3px 10px", borderRadius: 8 }}>Save 68%</span>
                      <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>£4.17/month</span>
                    </div>
                  </>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Benefits */}
            <div style={{ marginBottom: 24 }}>
              {BENEFITS.map((b, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0, transition: { delay: i * 0.05 } }}
                  style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#534AB7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2)" }}>
                    <Check size={13} color="#fff" />
                  </div>
                  <p style={{ fontSize: 15, color: "var(--text-primary)", margin: 0, lineHeight: 1.45 }}>{b}</p>
                </motion.div>
              ))}
            </div>

            {/* Testimonials */}
            <div style={{ background: "var(--bg-card)", borderRadius: 16, padding: 20, marginBottom: 20, border: "1px solid var(--border)", boxShadow: "0 2px 16px rgba(83,74,183,0.10)" }}>
              <p style={{ fontSize: 11, fontWeight: 800, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 1.2, margin: "0 0 14px" }}>Beta feedback</p>
              <AnimatePresence mode="wait">
                <motion.div key={testimonialIdx} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.28 }}>
                  <div style={{ display: "flex", gap: 2, marginBottom: 10 }}>
                    {[1,2,3,4,5].map(s => <Star key={s} size={15} color="#F59E0B" fill="#F59E0B" />)}
                  </div>
                  <p style={{ fontSize: 15, color: "var(--text-primary)", fontStyle: "italic", lineHeight: 1.6, margin: "0 0 10px" }}>
                    "{TESTIMONIALS[testimonialIdx].text}"
                  </p>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#534AB7", margin: 0 }}>
                    {TESTIMONIALS[testimonialIdx].name} · {TESTIMONIALS[testimonialIdx].condition}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Trust */}
            <p style={{ fontSize: 13, color: "var(--text-secondary)", textAlign: "center", marginBottom: 20, lineHeight: 1.5 }}>
              Trusted by people managing PCOS, autoimmune, and thyroid conditions.
            </p>

            {/* Error */}
            {error && (
              <div style={{ background: "rgba(163,45,45,0.08)", border: "1px solid rgba(163,45,45,0.2)", borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
                <p style={{ color: "#A32D2D", fontSize: 14, margin: 0 }}>{error}</p>
              </div>
            )}

            {/* CTA */}
            <motion.button
              data-testid="start-trial-btn"
              whileTap={{ scale: 0.96 }}
              onClick={handleSubscribe}
              disabled={loading || authLoading || !user}
              style={{
                width: "100%",
                background: (loading || authLoading || !user) ? "#A09FAD" : "linear-gradient(135deg, #534AB7, #756AD9)",
                color: "#fff", border: "none", borderRadius: 14,
                padding: "20px 24px", fontSize: 18, fontWeight: 800,
                cursor: (loading || authLoading || !user) ? "not-allowed" : "pointer",
                boxShadow: (loading || authLoading || !user) ? "none" : "0 6px 24px rgba(83,74,183,0.35), inset 0 1px 0 rgba(255,255,255,0.2)",
                marginBottom: 12, letterSpacing: "-0.01em",
                minHeight: 60
              }}>
              {authLoading ? "Checking your account..." : loading ? "Creating your trial..." : !user ? "Sign in to continue" : plan === "annual" ? "Start 7-Day Free Trial →" : "Start 3-Day Free Trial →"}
            </motion.button>

            {!hardGate && (
              <button data-testid="maybe-later-btn" onClick={handleClose}
                style={{ width: "100%", background: "none", border: "none", color: "var(--text-muted)", fontSize: 14, cursor: "pointer", padding: "8px 0", fontWeight: 500 }}>
                Maybe later
              </button>
            )}

            <p style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center", lineHeight: 1.6, marginTop: 16 }}>
              Flourish provides AI powered nutritional guidance. Not a substitute for medical advice.
            </p>
          </div>
        </motion.div>
      </motion.div>

      {/* Exit intent */}
      <AnimatePresence>
        {showExit && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 6000, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
              style={{ background: "var(--bg-elevated)", borderRadius: 20, padding: "28px 24px", maxWidth: 360, width: "100%", textAlign: "center" }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🔒</div>
              <p style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", marginBottom: 8, letterSpacing: "-0.02em" }}>Early access price locks in forever after launch.</p>
              <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 24 }}>We would love to have you.</p>
              <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowExit(false)}
                style={{ width: "100%", background: "#534AB7", color: "#fff", border: "none", borderRadius: 12, padding: "14px 24px", fontWeight: 700, cursor: "pointer", marginBottom: 10, fontSize: 15 }}>
                OK, I'll stay
              </motion.button>
              <button onClick={() => { setShowExit(false); onClose(); }}
                style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 14, cursor: "pointer" }}>
                No thanks
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
