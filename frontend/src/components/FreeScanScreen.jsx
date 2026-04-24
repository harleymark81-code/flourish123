import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { ph } from "../lib/posthog";

// ── Condition-specific data ────────────────────────────────────────────────────

const CONDITION_LABELS = {
  pcos: "PCOS",
  endometriosis: "Endometriosis",
  thyroid: "Thyroid condition",
  ibs: "IBS / gut issues",
  autoimmune: "Autoimmune condition",
  hormonal_imbalance: "Hormonal imbalance",
  not_sure: "your conditions",
  other: "your conditions",
};

const LOADING_MSGS = {
  pcos: ["Checking insulin impact...", "Analysing oestrogen effects...", "Reviewing inflammatory markers...", "Personalising for your PCOS profile..."],
  endometriosis: ["Checking inflammation triggers...", "Analysing oestrogen impact...", "Reviewing prostaglandin foods...", "Personalising for your endometriosis profile..."],
  thyroid: ["Checking thyroid hormone interactions...", "Analysing iodine and selenium content...", "Reviewing metabolic impact...", "Personalising for your thyroid profile..."],
  ibs: ["Analysing gut irritants...", "Checking fermentation potential...", "Reviewing microbiome impact...", "Personalising for your IBS profile..."],
  autoimmune: ["Checking inflammation triggers...", "Analysing immune response factors...", "Reviewing gut permeability impact...", "Personalising for your profile..."],
  default: ["Analysing ingredient quality...", "Checking nutritional density...", "Reviewing processing level...", "Building your personalised rating..."],
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function ScoreRing({ score }) {
  const [d, setD] = useState(0);
  useEffect(() => {
    const dur = 1200, t0 = performance.now();
    const tick = (now) => {
      const p = Math.min((now - t0) / dur, 1);
      setD(Math.round((1 - Math.pow(1 - p, 3)) * score));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [score]);
  const col = score >= 70 ? "#639922" : score >= 40 ? "#BA7517" : "#A32D2D";
  const r = 44, circ = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: 100, height: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg width={100} height={100} style={{ position: "absolute", transform: "rotate(-90deg)" }}>
        <circle cx={50} cy={50} r={r} fill="none" stroke="var(--border)" strokeWidth={7} />
        <motion.circle cx={50} cy={50} r={r} fill="none" stroke={col} strokeWidth={7}
          strokeDasharray={circ} initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - (d / 100) * circ }}
          transition={{ duration: 1.2, ease: "easeOut" }} strokeLinecap="round" />
      </svg>
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: 26, fontWeight: 800, color: col, margin: 0, lineHeight: 1 }}>{d}</p>
        <p style={{ fontSize: 10, color: "var(--text-muted)", margin: 0 }}>/100</p>
      </div>
    </div>
  );
}

function DimCard({ label, data }) {
  if (!data) return null;
  const s = data.score || 0;
  const col = s >= 7 ? "#639922" : s >= 5 ? "#BA7517" : "#A32D2D";
  return (
    <div style={{ background: "var(--bg-card)", borderRadius: 12, padding: "12px 14px", border: "1px solid var(--border)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", margin: 0 }}>{label}</p>
        <span style={{ fontSize: 14, fontWeight: 800, color: col }}>{s}/10</span>
      </div>
      <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0, lineHeight: 1.45 }}>{data.summary}</p>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function FreeScanScreen({ onComplete }) {
  const { user, getHeaders, API } = useAuth();

  const [phase, setPhase] = useState("input"); // input | loading | result
  const [foodName, setFoodName] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loadMsgIdx, setLoadMsgIdx] = useState(0);
  const intervalRef = useRef(null);

  const conditions = user?.conditions || [];
  const primaryCondition = conditions[0] || "default";
  const conditionLabel = conditions.map(c => CONDITION_LABELS[c] || c).join(", ") || "your health";
  const loadingMsgs = LOADING_MSGS[primaryCondition] || LOADING_MSGS.default;

  useEffect(() => {
    if (phase !== "loading") return;
    setLoadMsgIdx(0);
    intervalRef.current = setInterval(() => {
      setLoadMsgIdx(i => (i + 1) % loadingMsgs.length);
    }, 900);
    return () => clearInterval(intervalRef.current);
  }, [phase, loadingMsgs.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleScan = async () => {
    if (!foodName.trim()) return;
    setPhase("loading");
    setError("");
    ph.foodSearched(foodName.trim());
    try {
      const res = await axios.post(`${API}/food/rate`, { food_name: foodName.trim() }, {
        headers: getHeaders(), withCredentials: true,
      });
      setResult(res.data);
      setPhase("result");
    } catch (e) {
      const msg = e.response?.data?.detail;
      setError(typeof msg === "string" ? msg : "Could not rate this food. Please try again.");
      setPhase("input");
    }
  };

  const PRI = "#534AB7";
  const P = "var(--text-primary)";
  const S = "var(--text-secondary)";

  const container = {
    maxWidth: 480, margin: "0 auto", minHeight: "100vh",
    background: "var(--bg-app)", display: "flex", flexDirection: "column",
    overflowX: "hidden",
  };

  // ── Input phase ────────────────────────────────────────────────────────────
  if (phase === "input") return (
    <div style={container}>
      <div style={{ flex: 1, padding: "60px 24px 48px", display: "flex", flexDirection: "column" }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <motion.div
              animate={{ scale: [1, 1.07, 1], rotate: [0, 4, -4, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              style={{ width: 80, height: 80, borderRadius: 22, background: `linear-gradient(135deg, ${PRI}, #756AD9)`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", boxShadow: "0 10px 36px rgba(83,74,183,0.35)" }}>
              <span style={{ fontSize: 40 }}>🔍</span>
            </motion.div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: P, marginBottom: 10, letterSpacing: "-0.02em", lineHeight: 1.2 }}>
              Let's show you what Flourish can do.
            </h1>
            <p style={{ fontSize: 15, color: S, lineHeight: 1.6, marginBottom: 0 }}>
              One free scan — personalised for <strong style={{ color: P }}>{conditionLabel}</strong>. Full premium experience. Nothing locked.
            </p>
          </div>

          <div style={{ background: "var(--bg-card)", borderRadius: 16, padding: "16px 18px", marginBottom: 24, border: "1px solid var(--border)" }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: PRI, margin: "0 0 6px" }}>What you'll see:</p>
            {["Overall score personalised to your conditions", "All 4 health dimensions — Naturalness, Hormonal Impact, Inflammation, Gut Health", "Your personalised insight", "Swap suggestions for better alternatives"].map((f, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 5 }}>
                <div style={{ width: 18, height: 18, borderRadius: "50%", background: PRI, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                  <Check size={10} color="#fff" />
                </div>
                <p style={{ fontSize: 13, color: S, margin: 0, lineHeight: 1.4 }}>{f}</p>
              </div>
            ))}
          </div>

          <input
            value={foodName}
            onChange={e => setFoodName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleScan()}
            placeholder="Search any food — e.g. Greek yoghurt, Oat milk, Salmon..."
            style={{ width: "100%", boxSizing: "border-box", background: "var(--input-bg)", border: "2px solid var(--border)", borderRadius: 14, padding: "18px 20px", fontSize: 16, outline: "none", color: "var(--input-text)", fontFamily: "inherit", marginBottom: 4 }}
            autoFocus
          />

          {error && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{ fontSize: 14, color: "#A32D2D", background: "rgba(163,45,45,0.08)", borderRadius: 10, padding: "10px 14px", margin: "8px 0" }}>
              {error}
            </motion.p>
          )}

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleScan}
            disabled={!foodName.trim()}
            style={{
              width: "100%", border: "none", borderRadius: 14, padding: "18px 24px",
              fontSize: 16, fontWeight: 700, cursor: foodName.trim() ? "pointer" : "not-allowed",
              background: foodName.trim() ? `linear-gradient(135deg, ${PRI}, #756AD9)` : "var(--border)",
              color: foodName.trim() ? "#fff" : "var(--text-muted)",
              boxShadow: foodName.trim() ? "0 4px 20px rgba(83,74,183,0.30)" : "none",
              marginTop: 8, minHeight: 56,
            }}>
            {foodName.trim() ? `Rate "${foodName}" →` : "Type a food name to begin"}
          </motion.button>
        </motion.div>
      </div>
    </div>
  );

  // ── Loading phase ──────────────────────────────────────────────────────────
  if (phase === "loading") return (
    <div style={{ ...container, alignItems: "center", justifyContent: "center" }}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        style={{ textAlign: "center", padding: "0 24px" }}>
        <motion.div
          animate={{ scale: [1, 1.1, 1], rotate: [0, 8, -8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          style={{ width: 80, height: 80, borderRadius: 22, background: `linear-gradient(135deg, ${PRI}, #756AD9)`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 28px", boxShadow: "0 10px 36px rgba(83,74,183,0.35)" }}>
          <span style={{ fontSize: 40 }}>🌸</span>
        </motion.div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: P, marginBottom: 6, letterSpacing: "-0.02em" }}>Analysing {foodName}</h2>
        <div style={{ height: 26, overflow: "hidden", marginBottom: 28 }}>
          <AnimatePresence mode="wait">
            <motion.p key={loadMsgIdx} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              style={{ fontSize: 15, color: PRI, fontWeight: 600, margin: 0 }}>
              {loadingMsgs[loadMsgIdx]}
            </motion.p>
          </AnimatePresence>
        </div>
        <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
          {[0, 1, 2].map(i => (
            <motion.div key={i}
              animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.3 }}
              style={{ width: 8, height: 8, borderRadius: "50%", background: PRI }}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );

  // ── Result phase ───────────────────────────────────────────────────────────
  if (phase === "result" && result) return (
    <div style={container}>
      <div style={{ flex: 1, padding: "24px 24px 48px", overflowY: "auto" }}>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>

          {/* Score header */}
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <p style={{ fontSize: 13, color: S, margin: "0 0 4px" }}>You rated</p>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: P, margin: "0 0 18px", letterSpacing: "-0.02em", lineHeight: 1.2 }}>
              {result.name || result.food_name || foodName}
            </h2>
            <ScoreRing score={result.overallScore || 0} />
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.6 } }}
              style={{ display: "inline-block", marginTop: 10, padding: "6px 16px", borderRadius: 20, background: (result.overallScore || 0) >= 70 ? "rgba(99,153,34,0.12)" : (result.overallScore || 0) >= 40 ? "rgba(186,117,23,0.12)" : "rgba(163,45,45,0.12)" }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: (result.overallScore || 0) >= 70 ? "#639922" : (result.overallScore || 0) >= 40 ? "#BA7517" : "#A32D2D", margin: 0 }}>
                {result.verdict}
              </p>
            </motion.div>
          </div>

          {/* For your condition */}
          {result.forYourCondition && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.4 } }}
              style={{ background: "rgba(83,74,183,0.06)", borderRadius: 14, padding: "14px 16px", marginBottom: 16, border: "1px solid rgba(83,74,183,0.15)" }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: PRI, textTransform: "uppercase", letterSpacing: 0.8, margin: "0 0 6px" }}>For your condition</p>
              <p style={{ fontSize: 14, color: P, margin: 0, lineHeight: 1.65 }}>{result.forYourCondition}</p>
            </motion.div>
          )}

          {/* 4 dimensions */}
          {result.dimensions && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.5 } }} style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: S, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>Full breakdown</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <DimCard label="Naturalness" data={result.dimensions.naturalness} />
                <DimCard label="Hormonal Impact" data={result.dimensions.hormonalImpact} />
                <DimCard label="Inflammation" data={result.dimensions.inflammation} />
                <DimCard label="Gut Health" data={result.dimensions.gutHealth} />
              </div>
            </motion.div>
          )}

          {/* Flags */}
          {result.flags && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.6 } }} style={{ marginBottom: 16 }}>
              {result.flags.positives?.slice(0, 2).map((pos, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 14 }}>✅</span>
                  <p style={{ fontSize: 13, color: S, margin: 0, lineHeight: 1.4 }}>{pos}</p>
                </div>
              ))}
              {result.flags.warnings?.slice(0, 2).map((w, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 14 }}>⚠️</span>
                  <p style={{ fontSize: 13, color: S, margin: 0, lineHeight: 1.4 }}>{w}</p>
                </div>
              ))}
            </motion.div>
          )}

          {/* Alternatives */}
          {result.alternatives?.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.7 } }} style={{ marginBottom: 28 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: S, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>Better alternatives for you</p>
              {result.alternatives.slice(0, 3).map((alt, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "var(--bg-card)", borderRadius: 10, marginBottom: 6, border: "1px solid var(--border)" }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: P, margin: 0 }}>{alt.name}</p>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#639922" }}>{alt.predictedScore}/100</span>
                </div>
              ))}
            </motion.div>
          )}

          {/* Transition pitch + CTA */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.8 } }}>
            <div style={{ background: `linear-gradient(135deg, ${PRI}, #756AD9)`, borderRadius: 16, padding: "18px 20px", marginBottom: 16, textAlign: "center" }}>
              <p style={{ color: "#fff", fontWeight: 800, fontSize: 16, margin: "0 0 4px", letterSpacing: "-0.01em" }}>
                That's what Flourish does for every food, every day.
              </p>
              <p style={{ color: "rgba(255,255,255,0.82)", fontSize: 13, margin: 0, lineHeight: 1.5 }}>
                Unlimited scans. Full breakdown. Personalised to your exact conditions.
              </p>
            </div>

            <motion.button whileTap={{ scale: 0.97 }} onClick={onComplete}
              style={{ width: "100%", border: "none", borderRadius: 14, padding: "18px 24px", fontSize: 16, fontWeight: 700, cursor: "pointer", background: `linear-gradient(135deg, ${PRI}, #756AD9)`, color: "#fff", boxShadow: "0 4px 20px rgba(83,74,183,0.30)", marginBottom: 0, minHeight: 56, letterSpacing: "-0.01em" }}>
              See your plan options →
            </motion.button>
          </motion.div>

        </motion.div>
      </div>
    </div>
  );

  return null;
}
