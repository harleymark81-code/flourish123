import React from "react";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";

const CONDITION_LABELS = {
  pcos: "PCOS",
  endometriosis: "Endometriosis",
  thyroid: "thyroid issues",
  ibs: "IBS / gut issues",
  autoimmune: "an autoimmune condition",
  hormonal_imbalance: "hormonal imbalance",
  not_sure: "unexplained symptoms",
  other: "your condition",
};

const GOAL_LABELS = {
  reduce_inflammation: "reduce inflammation",
  balance_hormones: "balance your hormones",
  improve_gut: "improve your gut health",
  increase_energy: "increase your energy",
  feel_in_control: "feel in control of your body",
};

export default function ReturningUserWelcome({ onContinue }) {
  const { user } = useAuth();

  const conditions = (user?.conditions || []).map(c => CONDITION_LABELS[c] || c.replace(/_/g, " "));
  const conditionList = conditions.length === 0
    ? "your health"
    : conditions.length === 1
      ? conditions[0]
      : conditions.slice(0, -1).join(", ") + " and " + conditions.slice(-1);
  const goalLabel = GOAL_LABELS[user?.goal] || user?.goal || "feel your best";
  const firstName = (user?.name || "").split(" ")[0] || "there";

  const PRI = "#534AB7";
  const P = "var(--text-primary)";
  const S = "var(--text-secondary)";

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", background: "var(--bg-app)", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1, padding: "60px 24px 48px", display: "flex", flexDirection: "column", justifyContent: "center" }}>

        <motion.div initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 280, damping: 18 }}
          style={{ width: 84, height: 84, borderRadius: 22, background: `linear-gradient(135deg, ${PRI}, #756AD9)`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", boxShadow: "0 10px 40px rgba(83,74,183,0.4)" }}>
          <span style={{ fontSize: 42 }}>🌸</span>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.15 } }}
          style={{ textAlign: "center", marginBottom: 28 }}>
          <h1 style={{ fontSize: 30, fontWeight: 800, color: P, margin: "0 0 10px", letterSpacing: "-0.02em", lineHeight: 1.2 }}>
            Welcome back, {firstName}.
          </h1>
          <p style={{ fontSize: 16, color: S, margin: 0, lineHeight: 1.55 }}>
            You told us you're managing <strong style={{ color: P }}>{conditionList}</strong> and your goal is to <strong style={{ color: P }}>{goalLabel}</strong>.
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.3 } }}
          style={{ background: "var(--bg-card)", borderRadius: 16, padding: "20px 22px", marginBottom: 20, border: "1px solid var(--border)" }}>
          <p style={{ fontSize: 13, fontWeight: 800, color: PRI, textTransform: "uppercase", letterSpacing: 1, margin: "0 0 10px" }}>What you saw in your free scan</p>
          <p style={{ fontSize: 15, color: P, margin: 0, lineHeight: 1.65 }}>
            A full breakdown — your overall score, all 4 health dimensions, your personalised insight, and tailored swap suggestions. Every single rating in Flourish is built around <strong>{conditions[0] ? CONDITION_LABELS[(user?.conditions || [])[0]] || conditionList : "your conditions"}</strong> — not a generic number.
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.45 } }}
          style={{ background: `linear-gradient(135deg, ${PRI}, #756AD9)`, borderRadius: 16, padding: "18px 20px", marginBottom: 28, textAlign: "center" }}>
          <p style={{ color: "#fff", fontWeight: 800, fontSize: 16, margin: "0 0 4px", letterSpacing: "-0.01em" }}>
            Pick up where you left off.
          </p>
          <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, margin: 0, lineHeight: 1.5 }}>
            Unlimited scans. Full personalised analysis. Built for {conditions[0] ? CONDITION_LABELS[(user?.conditions || [])[0]] || "you" : "you"}.
          </p>
        </motion.div>

        <motion.button
          data-testid="welcome-back-continue-btn"
          whileTap={{ scale: 0.97 }}
          onClick={onContinue}
          style={{
            width: "100%", border: "none", borderRadius: 14,
            padding: "20px 24px", fontSize: 17, fontWeight: 800, cursor: "pointer",
            background: `linear-gradient(135deg, ${PRI}, #756AD9)`,
            color: "#fff", boxShadow: "0 6px 28px rgba(83,74,183,0.35)",
            minHeight: 60, letterSpacing: "-0.01em",
          }}>
          See your plan options →
        </motion.button>
      </div>
    </div>
  );
}
