import React, { useState } from "react";
import { motion } from "framer-motion";
import { X, Crown, Check, ChevronRight, Loader } from "lucide-react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";

const FEATURES_PREMIUM = [
  "Unlimited food ratings",
  "Full health dimension breakdown",
  "All warning flags for your condition",
  "Complete personalised food diary",
  "Full meal planner",
  "All alternative food suggestions",
  "Symptom tracker & trends",
  "Barcode scanner",
];

export default function SubscriptionScreen({ onClose }) {
  const { user, getHeaders, API } = useAuth();
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [error, setError] = useState("");

  const planLabel = user?.premium_plan === "annual" ? "Annual" : "Monthly";
  const planPrice = user?.premium_plan === "annual" ? "£49.99/year" : "£12.99/month";

  const handlePortal = async () => {
    setLoadingPortal(true);
    setError("");
    try {
      const res = await axios.post(`${API}/payments/portal`, {}, { headers: getHeaders(), withCredentials: true });
      window.location.href = res.data.url;
    } catch (e) {
      setError(e.response?.data?.detail || "Unable to open subscription portal. Please contact support.");
      setLoadingPortal(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ position: "fixed", inset: 0, zIndex: 9600, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0, transition: { type: "spring", damping: 28, stiffness: 300 } }}
        exit={{ y: "100%" }}
        style={{ width: "100%", maxWidth: 480, background: "var(--bg-elevated)", borderRadius: "24px 24px 0 0", display: "flex", flexDirection: "column", maxHeight: "92vh", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>

        {/* Header */}
        <div style={{ padding: "20px 20px 0", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #F59E0B, #D97706)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Crown size={18} color="#fff" />
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>My Subscription</h2>
            </div>
            <motion.button whileTap={{ scale: 0.9 }} onClick={onClose}
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <X size={16} color="#6B6A7C" />
            </motion.button>
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "16px 20px", flex: 1 }}>

          {/* Current plan badge */}
          <div style={{ background: "linear-gradient(135deg, #534AB7, #756AD9)", borderRadius: 16, padding: 20, marginBottom: 20 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: 1, margin: "0 0 6px" }}>Current plan</p>
            <p style={{ fontSize: 22, fontWeight: 800, color: "#fff", margin: "0 0 4px" }}>
              Flourish Premium — {planLabel}
            </p>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", margin: 0 }}>{planPrice} · Renews automatically</p>
          </div>

          {/* What you get */}
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>What's included</p>
            <div style={{ background: "linear-gradient(135deg, rgba(83,74,183,0.06), rgba(117,106,217,0.06))", borderRadius: 14, padding: "14px 16px", border: "1px solid rgba(83,74,183,0.2)" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {FEATURES_PREMIUM.map(f => (
                  <div key={f} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Check size={14} color="#534AB7" />
                    <span style={{ fontSize: 13, color: "var(--text-primary)" }}>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {error && (
            <div style={{ background: "rgba(163,45,45,0.08)", border: "1px solid rgba(163,45,45,0.2)", borderRadius: 10, padding: "10px 14px", marginBottom: 16 }}>
              <p style={{ fontSize: 13, color: "#A32D2D", margin: 0 }}>{error}</p>
            </div>
          )}

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handlePortal}
            disabled={loadingPortal}
            style={{ width: "100%", background: "var(--bg-card)", border: "2px solid var(--border)", borderRadius: 14, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", marginBottom: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
              {loadingPortal ? "Opening portal..." : "Manage / Cancel subscription"}
            </span>
            {loadingPortal ? <Loader size={18} color="#6B6A7C" style={{ animation: "spin 1s linear infinite" }} /> : <ChevronRight size={18} color="#6B6A7C" />}
          </motion.button>

          <p style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center", marginTop: 12, lineHeight: 1.6, paddingBottom: 8 }}>
            Subscriptions managed via Stripe. Cancel anytime from the customer portal.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
