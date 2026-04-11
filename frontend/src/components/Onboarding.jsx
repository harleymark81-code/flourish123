import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Droplets, Shield, Leaf, Flower2, Activity, Zap } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import axios from "axios";

const CONDITIONS = [
  { id: "pcos", label: "PCOS", icon: <Activity size={24} />, desc: "Polycystic ovary syndrome" },
  { id: "thyroid", label: "Thyroid", icon: <Zap size={24} />, desc: "Thyroid condition" },
  { id: "autoimmune", label: "Autoimmune", icon: <Shield size={24} />, desc: "Autoimmune disease" },
  { id: "ibs", label: "IBS", icon: <Leaf size={24} />, desc: "Irritable bowel syndrome" },
  { id: "endometriosis", label: "Endometriosis", icon: <Flower2 size={24} />, desc: "Endometriosis" },
  { id: "hormonal_imbalance", label: "Hormonal Imbalance", icon: <Activity size={24} />, desc: "Hormonal imbalance" },
  { id: "type2_diabetes", label: "Type 2 Diabetes", icon: <Droplets size={24} />, desc: "Type 2 diabetes" },
  { id: "general_health", label: "General Health", icon: <Heart size={24} />, desc: "General health" },
];

const GOALS = [
  { id: "reduce_inflammation", label: "Reduce inflammation", emoji: "🔥" },
  { id: "balance_hormones", label: "Balance hormones", emoji: "⚖️" },
  { id: "improve_gut", label: "Improve gut health", emoji: "🌿" },
  { id: "eat_clean", label: "Eat clean & natural", emoji: "🥗" },
];

const DURATIONS = ["Less than a year", "1 to 3 years", "More than 3 years"];
const CHALLENGES = ["Knowing what to avoid", "Finding alternatives", "Eating out", "Understanding labels"];
const SEVERITIES = ["Mild", "Moderate", "Severe"];

const TAGLINES = [
  "Personalised for PCOS.",
  "Built for autoimmune conditions.",
  "Designed for hormonal health.",
];

export default function Onboarding({ onComplete }) {
  const [screen, setScreen] = useState(1);
  const [taglineIdx, setTaglineIdx] = useState(0);
  const [selectedConditions, setSelectedConditions] = useState([]);
  const [selectedGoals, setSelectedGoals] = useState([]);
  const [duration, setDuration] = useState("");
  const [challenge, setChallenge] = useState("");
  const [severity, setSeverity] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const { user, updateProfile } = useAuth();

  useEffect(() => {
    const interval = setInterval(() => {
      setTaglineIdx(i => (i + 1) % TAGLINES.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const progress = (screen / 5) * 100;

  const toggleCondition = (id) => {
    setSelectedConditions(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const toggleGoalFixed = (id) => {
    setSelectedGoals(prev =>
      prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]
    );
  };

  const handleComplete = async () => {
    setSaving(true);
    setSaveError("");
    try {
      await updateProfile({
        conditions: selectedConditions,
        goals: selectedGoals,
        managing_duration: duration,
        food_challenge: challenge,
        severity: severity.toLowerCase(),
        onboarding_completed: true
      });
      onComplete();
    } catch (e) {
      console.error(e);
      setSaveError("Something went wrong saving your profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const containerVariants = {
    initial: { opacity: 0, x: 40 },
    animate: { opacity: 1, x: 0, transition: { type: "spring", damping: 25, stiffness: 300 } },
    exit: { opacity: 0, x: -40, transition: { duration: 0.2 } }
  };

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", background: "var(--bg-app)", display: "flex", flexDirection: "column" }}>
      {/* Progress Bar */}
      <div style={{ height: 4, background: "var(--border)", position: "fixed", top: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, zIndex: 100 }}>
        <motion.div
          style={{ height: "100%", background: "#534AB7", borderRadius: 4 }}
          animate={{ width: `${progress}%` }}
          transition={{ type: "spring", stiffness: 200, damping: 25 }}
        />
      </div>

      <div style={{ flex: 1, padding: "56px 20px 40px", overflowY: "auto" }}>
        <AnimatePresence mode="wait">
          {screen === 1 && (
            <motion.div key="s1" variants={containerVariants} initial="initial" animate="animate" exit="exit"
              style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "80vh", textAlign: "center" }}>
              
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 1.5, repeat: Infinity, repeatType: "reverse" }}
                style={{ width: 80, height: 80, borderRadius: 20, background: "linear-gradient(135deg, #534AB7, #756AD9)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24, boxShadow: "0 8px 32px rgba(83,74,183,0.3)" }}>
                <span style={{ fontSize: 36 }}>🌸</span>
              </motion.div>

              <h1 style={{ fontSize: 36, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>Flourish</h1>
              <p style={{ fontSize: 20, fontWeight: 600, color: "#534AB7", marginBottom: 32 }}>Finally. Food that works for your body.</p>

              <div style={{ height: 32, overflow: "hidden", marginBottom: 48 }}>
                <AnimatePresence mode="wait">
                  <motion.p
                    key={taglineIdx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                    style={{ fontSize: 16, color: "var(--text-secondary)", fontWeight: 500 }}>
                    {TAGLINES[taglineIdx]}
                  </motion.p>
                </AnimatePresence>
              </div>

              <motion.button
                data-testid="onboarding-get-started-btn"
                whileTap={{ scale: 0.97 }}
                onClick={() => setScreen(2)}
                style={{ width: "100%", background: "#534AB7", color: "#fff", border: "none", borderRadius: 12, padding: "18px 24px", fontSize: 18, fontWeight: 600, cursor: "pointer", boxShadow: "0 4px 20px rgba(83,74,183,0.3)" }}>
                Get Started
              </motion.button>
            </motion.div>
          )}

          {screen === 2 && (
            <motion.div key="s2" variants={containerVariants} initial="initial" animate="animate" exit="exit">
              <h2 style={{ fontSize: 26, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>What does your body deal with every day?</h2>
              <p style={{ color: "var(--text-secondary)", marginBottom: 28 }}>Select all that apply</p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 32 }}>
                {CONDITIONS.map((c, i) => (
                  <motion.div
                    key={c.id}
                    data-testid={`condition-card-${c.id}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0, transition: { delay: i * 0.08, type: "spring", damping: 20 } }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => toggleCondition(c.id)}
                    style={{
                      padding: "16px 12px",
                      borderRadius: 16,
                      border: `2px solid ${selectedConditions.includes(c.id) ? "#534AB7" : "var(--border)"}`,
                      background: selectedConditions.includes(c.id) ? "#534AB7" : "var(--bg-card)",
                      cursor: "pointer",
                      textAlign: "center",
                      transition: "all 0.3s"
                    }}>
                    <div style={{ color: selectedConditions.includes(c.id) ? "#fff" : "#534AB7", marginBottom: 8 }}>
                      {c.icon}
                    </div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: selectedConditions.includes(c.id) ? "#fff" : "#1A1A24", margin: 0 }}>
                      {c.label}
                    </p>
                  </motion.div>
                ))}
              </div>

              <motion.button
                data-testid="onboarding-next-conditions-btn"
                whileTap={{ scale: 0.97 }}
                onClick={() => setScreen(3)}
                disabled={selectedConditions.length === 0}
                style={{
                  width: "100%", background: selectedConditions.length > 0 ? "#534AB7" : "var(--border)",
                  color: selectedConditions.length > 0 ? "#fff" : "var(--text-muted)",
                  border: "none", borderRadius: 12, padding: "18px 24px",
                  fontSize: 16, fontWeight: 600, cursor: selectedConditions.length > 0 ? "pointer" : "not-allowed",
                  transition: "all 0.3s"
                }}>
                Next
              </motion.button>
            </motion.div>
          )}

          {screen === 3 && (
            <motion.div key="s3" variants={containerVariants} initial="initial" animate="animate" exit="exit">
              <h2 style={{ fontSize: 26, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>What matters most to you right now?</h2>
              <p style={{ color: "var(--text-secondary)", marginBottom: 28 }}>Select all that apply</p>

              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 32 }}>
                {GOALS.map((g, i) => (
                  <motion.div
                    key={g.id}
                    data-testid={`goal-card-${g.id}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0, transition: { delay: i * 0.08, type: "spring" } }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => toggleGoalFixed(g.id)}
                    style={{
                      padding: "20px 20px",
                      borderRadius: 16,
                      border: `2px solid ${selectedGoals.includes(g.id) ? "#534AB7" : "var(--border)"}`,
                      background: selectedGoals.includes(g.id) ? "#534AB7" : "var(--bg-card)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 16,
                      transition: "all 0.3s"
                    }}>
                    <span style={{ fontSize: 24 }}>{g.emoji}</span>
                    <p style={{ fontSize: 16, fontWeight: 600, color: selectedGoals.includes(g.id) ? "#fff" : "#1A1A24", margin: 0 }}>
                      {g.label}
                    </p>
                  </motion.div>
                ))}
              </div>

              <motion.button
                data-testid="onboarding-next-goals-btn"
                whileTap={{ scale: 0.97 }}
                onClick={() => setScreen(4)}
                disabled={selectedGoals.length === 0}
                style={{
                  width: "100%", background: selectedGoals.length > 0 ? "#534AB7" : "var(--border)",
                  color: selectedGoals.length > 0 ? "#fff" : "var(--text-muted)",
                  border: "none", borderRadius: 12, padding: "18px 24px",
                  fontSize: 16, fontWeight: 600, cursor: selectedGoals.length > 0 ? "pointer" : "not-allowed"
                }}>
                Next
              </motion.button>
            </motion.div>
          )}

          {screen === 4 && (
            <motion.div key="s4" variants={containerVariants} initial="initial" animate="animate" exit="exit">
              <h2 style={{ fontSize: 26, fontWeight: 700, color: "var(--text-primary)", marginBottom: 28 }}>A couple quick questions</h2>

              <p style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>How long have you been managing your condition?</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 28 }}>
                {DURATIONS.map(d => (
                  <motion.div
                    key={d}
                    data-testid={`duration-${d.replace(/\s+/g, "-").toLowerCase()}`}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setDuration(d)}
                    style={{
                      padding: "14px 16px", borderRadius: 12,
                      border: `2px solid ${duration === d ? "#534AB7" : "var(--border)"}`,
                      background: duration === d ? "#534AB7" : "var(--bg-card)",
                      cursor: "pointer", transition: "all 0.3s"
                    }}>
                    <p style={{ margin: 0, fontWeight: 600, color: duration === d ? "#fff" : "#1A1A24" }}>{d}</p>
                  </motion.div>
                ))}
              </div>

              <p style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>What's your biggest food challenge?</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
                {CHALLENGES.map(c => (
                  <motion.div
                    key={c}
                    data-testid={`challenge-${c.replace(/\s+/g, "-").toLowerCase()}`}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setChallenge(c)}
                    style={{
                      padding: "14px 16px", borderRadius: 12,
                      border: `2px solid ${challenge === c ? "#534AB7" : "var(--border)"}`,
                      background: challenge === c ? "#534AB7" : "var(--bg-card)",
                      cursor: "pointer", transition: "all 0.3s"
                    }}>
                    <p style={{ margin: 0, fontWeight: 600, color: challenge === c ? "#fff" : "#1A1A24" }}>{c}</p>
                  </motion.div>
                ))}
              </div>

              <p style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>How severe are your symptoms? <span style={{ fontSize: 13, fontWeight: 400, color: "var(--text-muted)" }}>(optional)</span></p>
              <div style={{ display: "flex", gap: 8, marginBottom: 32 }}>
                {SEVERITIES.map(s => (
                  <motion.div
                    key={s}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setSeverity(severity === s ? "" : s)}
                    style={{
                      flex: 1, padding: "12px 8px", borderRadius: 12, textAlign: "center",
                      border: `2px solid ${severity === s ? "#534AB7" : "var(--border)"}`,
                      background: severity === s ? "#534AB7" : "var(--bg-card)",
                      cursor: "pointer", transition: "all 0.3s"
                    }}>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: severity === s ? "#fff" : "#1A1A24" }}>{s}</p>
                  </motion.div>
                ))}
              </div>

              <motion.button
                data-testid="onboarding-next-q4-btn"
                whileTap={{ scale: 0.97 }}
                onClick={() => setScreen(5)}
                disabled={!duration || !challenge}
                style={{
                  width: "100%", background: duration && challenge ? "#534AB7" : "var(--border)",
                  color: duration && challenge ? "#fff" : "var(--text-muted)",
                  border: "none", borderRadius: 12, padding: "18px 24px",
                  fontSize: 16, fontWeight: 600, cursor: duration && challenge ? "pointer" : "not-allowed"
                }}>
                Next
              </motion.button>
            </motion.div>
          )}

          {screen === 5 && (
            <motion.div key="s5" variants={containerVariants} initial="initial" animate="animate" exit="exit"
              style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", paddingTop: 40 }}>
              
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                style={{ width: 80, height: 80, borderRadius: "50%", background: "linear-gradient(135deg, #639922, #7ab82a)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
                <span style={{ fontSize: 40 }}>✓</span>
              </motion.div>

              <h2 style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>Flourish is now personalised for you.</h2>
              <p style={{ fontSize: 16, color: "var(--text-secondary)", marginBottom: 48 }}>Your food intelligence is ready.</p>

              <div style={{ width: "100%", background: "var(--bg-card)", borderRadius: 16, padding: 24, marginBottom: 32, border: "1px solid var(--border)" }}>
                <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: 0 }}>Personalised for</p>
                <p style={{ fontSize: 18, fontWeight: 700, color: "#534AB7", margin: "4px 0 0" }}>
                  {selectedConditions.map(c => {
                  const special = { pcos: "PCOS", ibs: "IBS", type2_diabetes: "Type 2 Diabetes" };
                  return special[c] || c.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
                }).join(", ")}
                </p>
              </div>

              {saveError && (
                <p style={{ fontSize: 13, color: "#A32D2D", background: "rgba(163,45,45,0.08)", borderRadius: 10, padding: "10px 14px", width: "100%", margin: "0 0 12px", boxSizing: "border-box" }}>
                  {saveError}
                </p>
              )}
              <motion.button
                data-testid="onboarding-complete-btn"
                whileTap={{ scale: 0.97 }}
                onClick={handleComplete}
                disabled={saving}
                style={{ width: "100%", background: "#534AB7", color: "#fff", border: "none", borderRadius: 12, padding: "18px 24px", fontSize: 18, fontWeight: 600, cursor: "pointer", boxShadow: "0 4px 20px rgba(83,74,183,0.3)" }}>
                {saving ? "Setting up..." : "Start exploring"}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
