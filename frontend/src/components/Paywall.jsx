import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Crown, Check, Star, ChevronRight } from "lucide-react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";

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

const TESTIMONIALS = [
  { name: "Sarah", condition: "PCOS", text: "I finally understand why certain foods were triggering my symptoms. Game changer for managing my condition." },
  { name: "Emma", condition: "Autoimmune disease", text: "Nothing has ever explained the connection between food and my flares like this. I wish I found this sooner." },
  { name: "Jade", condition: "Thyroid condition", text: "I scanned my breakfast and finally understood why I felt terrible every morning. This app changed how I eat." }
];

const BENEFITS = [
  "Rate every food you eat — never guess again.",
  "See exactly how food is affecting your hormones today.",
  "Track your progress and watch your health transform week by week.",
  "Wake up every morning knowing exactly what to eat for your condition.",
  "Understand your body better every single week.",
  "Share beautiful rating cards without any watermark."
];

export default function Paywall({ onClose, user }) {
  const { getHeaders, API, refreshUser } = useAuth();
  const [plan, setPlan] = useState("annual");
  const [loading, setLoading] = useState(false);
  const [testimonialIdx, setTestimonialIdx] = useState(0);
  const [showExit, setShowExit] = useState(false);

  const conditions = user?.conditions || [];
  const primaryCondition = conditions[0] || "general_health";
  const headline = PAYWALL_HEADLINES[primaryCondition] || PAYWALL_HEADLINES.general_health;

  useEffect(() => {
    const interval = setInterval(() => setTestimonialIdx(i => (i + 1) % TESTIMONIALS.length), 4000);
    return () => clearInterval(interval);
  }, []);

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      const res = await axios.post(`${API}/payments/checkout`, {
        plan,
        origin_url: window.location.origin
      }, { headers: getHeaders(), withCredentials: true });

      if (res.data.url) {
        window.location.href = res.data.url;
      }
    } catch (e) {
      alert("Something went wrong. Let us try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setShowExit(true);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ position: "fixed", inset: 0, zIndex: 150, background: "rgba(0,0,0,0.6)", overflowY: "auto" }}>
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0, transition: { type: "spring", damping: 28, stiffness: 250 } }}
        style={{ minHeight: "100%", background: "#fff", maxWidth: 480, margin: "0 auto", position: "relative" }}>

        {/* Close */}
        <div style={{ position: "sticky", top: 0, background: "rgba(255,255,255,0.95)", backdropFilter: "blur(10px)", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #E8E6FF", zIndex: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Crown size={20} color="#F59E0B" />
            <span style={{ fontSize: 16, fontWeight: 700, color: "#1A1A24" }}>Flourish Premium</span>
          </div>
          <motion.button whileTap={{ scale: 0.9 }} onClick={handleClose} style={{ background: "#F8F7FF", border: "1px solid #E8E6FF", borderRadius: 10, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <X size={16} color="#6B6A7C" />
          </motion.button>
        </div>

        <div style={{ padding: "24px 20px 80px" }}>
          {/* Free Trial Badge */}
          <div style={{ background: "linear-gradient(135deg, #639922, #7ab82a)", borderRadius: 12, padding: "10px 16px", textAlign: "center", marginBottom: 20 }}>
            <p style={{ color: "#fff", fontWeight: 700, fontSize: 16, margin: 0 }}>Start your 3-day free trial</p>
            <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, margin: 0 }}>Cancel anytime — no charges for 3 days</p>
          </div>

          {/* Headline */}
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1A1A24", lineHeight: 1.3, marginBottom: 24, textAlign: "center" }}>{headline}</h1>

          {/* Price Justification */}
          <div style={{ background: "#F8F7FF", borderRadius: 12, padding: 16, marginBottom: 20, border: "1px solid #E8E6FF" }}>
            <p style={{ fontSize: 13, color: "#6B6A7C", lineHeight: 1.6, margin: 0 }}>
              Most people spend £5.50 on a Starbucks that spikes their cortisol, £10.99 on Netflix that knows nothing about their {primaryCondition.replace(/_/g, " ")}, £15 on a takeaway with zero hormonal awareness, and £45 on a single nutritionist appointment with no daily follow up. <strong style={{ color: "#1A1A24" }}>Flourish Premium is £12.99 a month. Less than two coffees.</strong>
            </p>
          </div>

          {/* Plan Toggle */}
          <div style={{ display: "flex", background: "#F8F7FF", borderRadius: 12, padding: 4, marginBottom: 16, border: "1px solid #E8E6FF" }}>
            <button
              data-testid="plan-monthly-btn"
              onClick={() => setPlan("monthly")}
              style={{ flex: 1, padding: "10px 8px", borderRadius: 10, border: "none", background: plan === "monthly" ? "#fff" : "transparent", fontWeight: 600, fontSize: 14, color: plan === "monthly" ? "#534AB7" : "#6B6A7C", cursor: "pointer", boxShadow: plan === "monthly" ? "0 2px 8px rgba(83,74,183,0.1)" : "none", transition: "all 0.3s" }}>
              Monthly
            </button>
            <button
              data-testid="plan-annual-btn"
              onClick={() => setPlan("annual")}
              style={{ flex: 1, padding: "10px 8px", borderRadius: 10, border: "none", background: plan === "annual" ? "#fff" : "transparent", fontWeight: 600, fontSize: 14, color: plan === "annual" ? "#534AB7" : "#6B6A7C", cursor: "pointer", boxShadow: plan === "annual" ? "0 2px 8px rgba(83,74,183,0.1)" : "none", transition: "all 0.3s", position: "relative" }}>
              Annual
              <span style={{ position: "absolute", top: -8, right: 4, background: "#534AB7", color: "#fff", fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 6 }}>Best Value</span>
            </button>
          </div>

          {/* Pricing */}
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <p style={{ fontSize: 14, color: "#A09FAD", textDecoration: "line-through", margin: "0 0 4px" }}>
              {plan === "monthly" ? "£19.99/month" : "£129.99/year"}
            </p>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 4 }}>
              <span style={{ fontSize: 40, fontWeight: 700, color: "#534AB7" }}>{plan === "monthly" ? "£12.99" : "£84.99"}</span>
              <span style={{ fontSize: 16, color: "#6B6A7C" }}>{plan === "monthly" ? "/month" : "/year"}</span>
            </div>
            {plan === "annual" && (
              <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 6 }}>
                <span style={{ background: "rgba(99,153,34,0.12)", color: "#639922", fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 6 }}>Save 45%</span>
                <span style={{ color: "#6B6A7C", fontSize: 13 }}>£2.92/month equivalent</span>
              </div>
            )}
            <p style={{ fontSize: 12, color: "#BA7517", fontWeight: 600, margin: "8px 0 0" }}>
              Launch price — locked in forever for early access members.
            </p>
            <p style={{ fontSize: 12, color: "#6B6A7C", margin: "4px 0 0" }}>
              When we launch publicly the price increases. Lock in your price forever today.
            </p>
          </div>

          {/* Benefits */}
          <div style={{ marginBottom: 24 }}>
            {BENEFITS.map((b, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0, transition: { delay: i * 0.06 } }}
                style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#534AB7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                  <Check size={12} color="#fff" />
                </div>
                <p style={{ fontSize: 14, color: "#1A1A24", margin: 0, lineHeight: 1.4 }}>{b}</p>
              </motion.div>
            ))}
          </div>

          {/* Testimonials */}
          <div style={{ background: "#F8F7FF", borderRadius: 16, padding: 20, marginBottom: 20, border: "1px solid #E8E6FF" }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6A7C", textTransform: "uppercase", letterSpacing: 1, margin: "0 0 12px" }}>Beta feedback</p>
            <AnimatePresence mode="wait">
              <motion.div
                key={testimonialIdx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}>
                <div style={{ display: "flex", gap: 3, marginBottom: 8 }}>
                  {[1,2,3,4,5].map(s => <Star key={s} size={14} color="#F59E0B" fill="#F59E0B" />)}
                </div>
                <p style={{ fontSize: 14, color: "#1A1A24", fontStyle: "italic", lineHeight: 1.6, margin: "0 0 8px" }}>
                  "{TESTIMONIALS[testimonialIdx].text}"
                </p>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#534AB7", margin: 0 }}>
                  {TESTIMONIALS[testimonialIdx].name} · {TESTIMONIALS[testimonialIdx].condition}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Trust */}
          <p style={{ fontSize: 13, color: "#6B6A7C", textAlign: "center", marginBottom: 20 }}>
            Trusted by people managing PCOS, autoimmune, and thyroid conditions. Powered by advanced AI. Backed by nutritional research.
          </p>

          {/* CTA */}
          <motion.button
            data-testid="start-trial-btn"
            whileTap={{ scale: 0.97 }}
            onClick={handleSubscribe}
            disabled={loading}
            style={{ width: "100%", background: "linear-gradient(135deg, #534AB7, #756AD9)", color: "#fff", border: "none", borderRadius: 12, padding: "18px 24px", fontSize: 18, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 20px rgba(83,74,183,0.3)", marginBottom: 12 }}>
            {loading ? "Creating your trial..." : "Start 3-Day Free Trial"}
          </motion.button>

          <button
            data-testid="maybe-later-btn"
            onClick={handleClose}
            style={{ width: "100%", background: "none", border: "none", color: "#6B6A7C", fontSize: 14, cursor: "pointer", padding: "8px 0 0" }}>
            Maybe later
          </button>

          <p style={{ fontSize: 11, color: "#A09FAD", textAlign: "center", lineHeight: 1.5, marginTop: 16 }}>
            Flourish provides AI powered nutritional guidance. Not a substitute for medical advice. Always consult your healthcare provider.
          </p>
        </div>
      </motion.div>

      {/* Exit Intent */}
      <AnimatePresence>
        {showExit && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              style={{ background: "#fff", borderRadius: 20, padding: 28, maxWidth: 360, width: "100%", textAlign: "center" }}>
              <p style={{ fontSize: 18, fontWeight: 700, color: "#1A1A24", marginBottom: 8 }}>Early access price locks in forever after launch.</p>
              <p style={{ fontSize: 14, color: "#6B6A7C", marginBottom: 24 }}>We would love to have you.</p>
              <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowExit(false)} style={{ width: "100%", background: "#534AB7", color: "#fff", border: "none", borderRadius: 12, padding: "14px 24px", fontWeight: 700, cursor: "pointer", marginBottom: 10 }}>
                OK, I'll stay
              </motion.button>
              <button onClick={() => { setShowExit(false); onClose(); }} style={{ background: "none", border: "none", color: "#6B6A7C", fontSize: 14, cursor: "pointer" }}>
                No thanks, close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
