import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Check, Star, Crown } from "lucide-react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { ph } from "../lib/posthog";

// ── Static data ────────────────────────────────────────────────────────────────

const CONDITIONS = [
  { id: "pcos", label: "PCOS" },
  { id: "endometriosis", label: "Endometriosis" },
  { id: "thyroid", label: "Thyroid condition" },
  { id: "ibs", label: "IBS / gut issues" },
  { id: "autoimmune", label: "Autoimmune condition" },
  { id: "hormonal_imbalance", label: "Hormonal imbalance" },
  { id: "not_sure", label: "I'm not sure yet" },
  { id: "other", label: "Other" },
];

const DURATIONS = [
  "Just diagnosed",
  "Less than a year",
  "1–3 years",
  "3+ years",
  "Most of my life",
];

const STRUGGLES = [
  "Not knowing what to eat",
  "Inflammation and pain",
  "Fatigue and low energy",
  "Hormonal breakouts",
  "Bloating and digestive issues",
  "Weight management",
  "Brain fog",
  "Mood swings",
];

const GOALS = [
  { id: "reduce_inflammation", label: "Reduce inflammation", emoji: "🔥" },
  { id: "balance_hormones", label: "Balance my hormones", emoji: "⚖️" },
  { id: "improve_gut", label: "Improve gut health", emoji: "🌿" },
  { id: "increase_energy", label: "Increase my energy", emoji: "⚡" },
  { id: "feel_in_control", label: "Feel in control of my body", emoji: "💪" },
];

const DIETS = [
  "No restrictions",
  "Gluten free",
  "Dairy free",
  "Vegan",
  "Vegetarian",
  "Low FODMAP",
  "Anti-inflammatory",
  "Other",
];

const VALIDATION = {
  pcos: {
    emoji: "💜",
    headline: "Living with PCOS is harder than most people know.",
    body: "Your body processes food differently to most people. What works for others — the standard diets, the generic advice — often doesn't work for you. That's not a failure. That's just PCOS. Flourish is built to understand that.",
  },
  endometriosis: {
    emoji: "🌸",
    headline: "Endometriosis affects everything — including what you eat.",
    body: "Certain foods fuel inflammation and make your symptoms significantly worse. But nobody ever tells you which ones. Flourish rates every food specifically for endometriosis, so you can finally eat with confidence.",
  },
  thyroid: {
    emoji: "⚡",
    headline: "Your thyroid is sensitive to what you eat in ways most people never realise.",
    body: "Foods that are perfectly healthy for others can suppress your thyroid function or interfere with your medication. Flourish tracks this so you don't have to figure it out alone.",
  },
  ibs: {
    emoji: "🌿",
    headline: "IBS makes every meal feel like a gamble.",
    body: "You've probably spent years trying to figure out your triggers — the anxiety before eating, the unpredictability. Flourish scores every food for gut sensitivity so you can eat without the fear of not knowing.",
  },
  autoimmune: {
    emoji: "🛡️",
    headline: "Your immune system is working overtime, and food matters more than you think.",
    body: "Certain foods trigger inflammatory responses that make autoimmune conditions significantly worse. It's different for everyone — but Flourish personalises every rating to your exact condition.",
  },
  hormonal_imbalance: {
    emoji: "⚖️",
    headline: "Hormonal imbalance affects every system in your body.",
    body: "Food directly impacts oestrogen, cortisol, and insulin. What you eat either supports your hormones or disrupts them. Flourish makes that visible for the first time.",
  },
  not_sure: {
    emoji: "💛",
    headline: "Your body is trying to tell you something.",
    body: "You don't need a diagnosis to deserve personalised food intelligence. Flourish is built for everyone navigating unexplained symptoms, chronic fatigue, and a body that doesn't feel quite right.",
  },
  other: {
    emoji: "✨",
    headline: "Your health journey is your own.",
    body: "Flourish adapts to your unique situation. The more we know about your body, the more precise and helpful your food ratings become — starting right now.",
  },
};

const INSIGHTS = {
  pcos: [
    "Foods high in refined sugar spike your insulin — we'll flag these instantly.",
    "Certain dairy products disrupt testosterone balance — Flourish scores these accurately.",
    "Anti-inflammatory foods like salmon and flaxseeds can reduce PCOS symptoms — we highlight them.",
  ],
  endometriosis: [
    "Red meat and processed foods fuel oestrogen dominance — we'll flag every one.",
    "Cruciferous vegetables help your body clear excess oestrogen — marked green for you.",
    "Gluten can increase inflammation in many people with endo — we track this.",
  ],
  thyroid: [
    "Soy and cruciferous vegetables can interfere with thyroid medication — flagged for you.",
    "Selenium-rich foods like Brazil nuts directly support thyroid function — scored highly.",
    "Iodine plays a key role in thyroid health — Flourish tracks dietary iodine sources.",
  ],
  ibs: [
    "High-FODMAP foods are common IBS triggers — we'll flag every one of them.",
    "Probiotic-rich foods can calm your gut microbiome — scored highly for you.",
    "Certain artificial sweeteners cause major bloating — Flourish spots them in ingredients.",
  ],
  autoimmune: [
    "Nightshade vegetables can trigger flares in autoimmune conditions — flagged for you.",
    "Omega-3 rich foods actively reduce systemic inflammation — highlighted green.",
    "Processed seed oils drive inflammation — scored very poorly for your condition.",
  ],
  hormonal_imbalance: [
    "Sugar and refined carbs spike cortisol and disrupt hormone balance — flagged.",
    "Phytoestrogen-rich foods can help balance oestrogen naturally — we track these.",
    "Alcohol significantly disrupts hormonal signalling — scored accurately for you.",
  ],
  not_sure: [
    "We'll help you identify which foods may be triggering your symptoms.",
    "Every rating is personalised to your experience, not a generic score.",
    "As you log more, Flourish learns your patterns and improves your insights.",
  ],
  other: [
    "Every food gets a personalised score based on your health profile.",
    "We flag ingredients that may conflict with your specific health needs.",
    "Your ratings improve the more we know about your body.",
  ],
};

const LOADING_MSGS = [
  "Analysing your conditions...",
  "Calibrating your food ratings...",
  "Setting up your hormone tracker...",
  "Personalising your experience...",
  "Almost ready...",
];

// ── Sub-components ─────────────────────────────────────────────────────────────

function ScoreRing({ score }) {
  const [displayed, setDisplayed] = useState(0);
  useEffect(() => {
    const dur = 1200;
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min((now - t0) / dur, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setDisplayed(Math.round(e * score));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [score]);
  const color = score >= 70 ? "#639922" : score >= 40 ? "#BA7517" : "#A32D2D";
  const r = 44;
  const circ = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: 100, height: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg width={100} height={100} style={{ position: "absolute", transform: "rotate(-90deg)" }}>
        <circle cx={50} cy={50} r={r} fill="none" stroke="var(--border)" strokeWidth={7} />
        <motion.circle cx={50} cy={50} r={r} fill="none" stroke={color} strokeWidth={7}
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - (displayed / 100) * circ }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          strokeLinecap="round"
        />
      </svg>
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: 26, fontWeight: 800, color, margin: 0, lineHeight: 1 }}>{displayed}</p>
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", margin: 0 }}>{label}</p>
        <span style={{ fontSize: 15, fontWeight: 800, color: col }}>{s}/10</span>
      </div>
      <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0, lineHeight: 1.45 }}>{data.summary}</p>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function Onboarding({ onComplete }) {
  const { user, updateProfile, API, getHeaders } = useAuth();

  const [screen, setScreen] = useState(1);
  const [dir, setDir] = useState(1);

  // Answers
  const [conditions, setConditions] = useState([]);
  const [howLong, setHowLong] = useState("");
  const [struggles, setStruggles] = useState([]);
  const [goal, setGoal] = useState("");
  const [dietStyle, setDietStyle] = useState([]);

  // Loading screen state
  const [loadingPct, setLoadingPct] = useState(0);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);

  // Free scan state
  const [scanFood, setScanFood] = useState("");
  const [scanLoading, setScanLoading] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [scanError, setScanError] = useState("");

  // Post-scan paywall
  const [planLoading, setPlanLoading] = useState(null);
  const [planError, setPlanError] = useState("");

  const primaryCondition = conditions[0] || "other";
  const validation = VALIDATION[primaryCondition] || VALIDATION.other;
  const insights = INSIGHTS[primaryCondition] || INSIGHTS.other;

  // Progress bar: screens 2–11 → 0% to 100%
  const showProgress = screen >= 2 && screen <= 11;
  const progress = showProgress ? ((screen - 2) / 9) * 100 : 0;

  const goTo = (s) => {
    setDir(s > screen ? 1 : -1);
    setScreen(s);
    ph.onboardingStepViewed(`step_${s}`, s);
  };

  // Loading screen: animate bar, save profile, then advance
  useEffect(() => {
    if (screen !== 10) return;
    const DURATION = 4000;
    const t0 = Date.now();

    const interval = setInterval(() => {
      const elapsed = Date.now() - t0;
      setLoadingPct(Math.min((elapsed / DURATION) * 100, 98));
      setLoadingMsgIdx(Math.min(
        Math.floor((elapsed / DURATION) * LOADING_MSGS.length),
        LOADING_MSGS.length - 1
      ));
    }, 120);

    updateProfile({
      conditions,
      goals: [goal].filter(Boolean),
      managing_duration: howLong,
      onboarding_completed: true,
      struggles,
      diet_style: dietStyle,
      goal,
    }).catch(e => console.error("[Onboarding] save failed:", e));

    const timer = setTimeout(() => {
      clearInterval(interval);
      setLoadingPct(100);
      setTimeout(() => goTo(11), 350);
    }, DURATION);

    return () => { clearInterval(interval); clearTimeout(timer); };
  }, [screen]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleScan = async () => {
    if (!scanFood.trim() || scanLoading) return;
    setScanLoading(true);
    setScanError("");
    try {
      const res = await axios.post(`${API}/food/rate`, { food_name: scanFood.trim() }, {
        headers: getHeaders(), withCredentials: true,
      });
      setScanResult(res.data);
      goTo(13);
    } catch (e) {
      const msg = e.response?.data?.detail;
      setScanError(typeof msg === "string" ? msg : "Could not rate this food. Please try again.");
    } finally {
      setScanLoading(false);
    }
  };

  const handlePlan = async (plan) => {
    if (planLoading) return;
    setPlanLoading(plan);
    setPlanError("");
    try {
      const res = await axios.post(`${API}/payments/checkout`, {
        plan,
        origin_url: window.location.origin,
      }, { headers: getHeaders(), withCredentials: true });
      if (res.data.url) window.location.href = res.data.url;
    } catch (e) {
      const msg = e.response?.data?.detail || "Something went wrong. Please try again.";
      setPlanError(typeof msg === "string" ? msg : "Something went wrong.");
      setPlanLoading(null);
    }
  };

  // Animation variants with direction
  const variants = {
    initial: (d) => ({ opacity: 0, x: d > 0 ? 56 : -56 }),
    animate: { opacity: 1, x: 0, transition: { type: "spring", damping: 26, stiffness: 320 } },
    exit: (d) => ({ opacity: 0, x: d > 0 ? -56 : 56, transition: { duration: 0.16 } }),
  };

  const P = "var(--text-primary)";
  const S = "var(--text-secondary)";
  const PURPLE = "#534AB7";

  const Btn = ({ onClick, disabled, loading: ld, children, secondary }) => (
    <motion.button whileTap={{ scale: 0.97 }} onClick={onClick} disabled={disabled || ld}
      style={{
        width: "100%", border: "none", borderRadius: 14,
        padding: "18px 24px", fontSize: 16, fontWeight: 700, cursor: disabled || ld ? "not-allowed" : "pointer",
        background: secondary ? "var(--bg-card)" : disabled ? "var(--border)" : `linear-gradient(135deg, ${PURPLE}, #756AD9)`,
        color: secondary ? S : disabled ? "var(--text-muted)" : "#fff",
        boxShadow: (!disabled && !secondary) ? "0 4px 20px rgba(83,74,183,0.30)" : "none",
        marginTop: 8, minHeight: 56, letterSpacing: "-0.01em",
        border: secondary ? "1px solid var(--border)" : "none",
      }}>
      {ld ? "..." : children}
    </motion.button>
  );

  const BackBtn = () => (
    <motion.button whileTap={{ scale: 0.9 }} onClick={() => goTo(screen - 1)}
      style={{ background: "none", border: "none", color: S, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, padding: "0 0 20px", fontSize: 14, fontWeight: 500 }}>
      <ArrowLeft size={15} /> Back
    </motion.button>
  );

  const Pill = ({ label, selected, onToggle }) => (
    <motion.button whileTap={{ scale: 0.93 }} onClick={onToggle}
      style={{
        padding: "12px 16px", borderRadius: 12, cursor: "pointer", textAlign: "left",
        border: `2px solid ${selected ? PURPLE : "var(--border)"}`,
        background: selected ? `linear-gradient(135deg, ${PURPLE}, #756AD9)` : "var(--bg-card)",
        color: selected ? "#fff" : P, fontWeight: 600, fontSize: 14,
        display: "flex", alignItems: "center", gap: 8, transition: "border-color 0.15s",
        boxShadow: selected ? "0 2px 12px rgba(83,74,183,0.22)" : "none",
      }}>
      {selected && <Check size={13} />}
      {label}
    </motion.button>
  );

  const Option = ({ label, emoji, selected, onSelect }) => (
    <motion.button whileTap={{ scale: 0.97 }} onClick={onSelect}
      style={{
        width: "100%", padding: "15px 20px", borderRadius: 14, cursor: "pointer",
        border: `2px solid ${selected ? PURPLE : "var(--border)"}`,
        background: selected ? "rgba(83,74,183,0.06)" : "var(--bg-card)",
        textAlign: "left", display: "flex", alignItems: "center", gap: 14, marginBottom: 8,
        transition: "border-color 0.15s",
      }}>
      {emoji && <span style={{ fontSize: 22 }}>{emoji}</span>}
      <p style={{ fontSize: 15, fontWeight: 600, color: selected ? PURPLE : P, margin: 0, flex: 1 }}>{label}</p>
      {selected && (
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
          style={{ width: 22, height: 22, borderRadius: "50%", background: PURPLE, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Check size={12} color="#fff" />
        </motion.div>
      )}
    </motion.button>
  );

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", background: "var(--bg-app)", display: "flex", flexDirection: "column", overflowX: "hidden" }}>

      {/* Progress bar */}
      {showProgress && (
        <div style={{ height: 4, background: "var(--border)", position: "fixed", top: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, zIndex: 100 }}>
          <motion.div style={{ height: "100%", background: `linear-gradient(90deg, ${PURPLE}, #756AD9)`, borderRadius: 4 }}
            animate={{ width: `${progress}%` }}
            transition={{ type: "spring", stiffness: 140, damping: 24 }} />
        </div>
      )}

      <div style={{ flex: 1, padding: `${showProgress ? 60 : 0}px 24px 48px`, overflowY: "auto" }}>
        <AnimatePresence mode="wait" custom={dir}>

          {/* ── 1 · Welcome ─────────────────────────────────────────────────── */}
          {screen === 1 && (
            <motion.div key="s1" custom={dir} variants={variants} initial="initial" animate="animate" exit="exit"
              style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "0 0 60px" }}>

              {/* Bloom */}
              <div style={{ position: "relative", marginBottom: 32 }}>
                {[...Array(5)].map((_, i) => (
                  <motion.div key={i}
                    animate={{ scale: [1, 1.7 + i * 0.15, 1], opacity: [0.12, 0, 0.12] }}
                    transition={{ duration: 2.6, repeat: Infinity, delay: i * 0.45, ease: "easeInOut" }}
                    style={{ position: "absolute", inset: -((i + 1) * 16), borderRadius: "50%", background: "rgba(83,74,183,0.07)", pointerEvents: "none" }}
                  />
                ))}
                <motion.div
                  animate={{ scale: [1, 1.07, 1], rotate: [0, 4, -4, 0] }}
                  transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
                  style={{ width: 92, height: 92, borderRadius: 24, background: `linear-gradient(135deg, ${PURPLE}, #756AD9)`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 12px 44px rgba(83,74,183,0.4)", position: "relative" }}>
                  <span style={{ fontSize: 46 }}>🌸</span>
                </motion.div>
              </div>

              <h1 style={{ fontSize: 40, fontWeight: 800, color: P, margin: "0 0 10px", letterSpacing: "-0.03em" }}>Flourish</h1>
              <p style={{ fontSize: 18, color: S, margin: "0 0 52px", lineHeight: 1.5 }}>Food intelligence built for your body.</p>

              <motion.button data-testid="onboarding-get-started-btn"
                whileTap={{ scale: 0.97 }} onClick={() => goTo(2)}
                style={{ width: "100%", background: `linear-gradient(135deg, ${PURPLE}, #756AD9)`, color: "#fff", border: "none", borderRadius: 14, padding: "20px 24px", fontSize: 18, fontWeight: 700, cursor: "pointer", boxShadow: "0 6px 30px rgba(83,74,183,0.4)", letterSpacing: "-0.01em" }}>
                Get started
              </motion.button>
              <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "18px 0 0" }}>Free to try. No card needed to start.</p>
            </motion.div>
          )}

          {/* ── 2 · Hook ─────────────────────────────────────────────────────── */}
          {screen === 2 && (
            <motion.div key="s2" custom={dir} variants={variants} initial="initial" animate="animate" exit="exit">
              <BackBtn />
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28 }}>
                <div style={{ width: 50, height: 50, borderRadius: 14, background: `linear-gradient(135deg, ${PURPLE}, #756AD9)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: 24 }}>✨</span>
                </div>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: PURPLE, textTransform: "uppercase", letterSpacing: 1, margin: 0 }}>Personalisation</p>
                  <h2 style={{ fontSize: 24, fontWeight: 800, color: P, margin: 0, letterSpacing: "-0.02em" }}>First, let's get to know you.</h2>
                </div>
              </div>
              <div style={{ background: "var(--bg-card)", borderRadius: 16, padding: "18px 20px", marginBottom: 36, border: "1px solid var(--border)" }}>
                <p style={{ fontSize: 16, color: S, lineHeight: 1.65, margin: 0 }}>
                  Your experience will be <strong style={{ color: P }}>completely personalised</strong> to your body and conditions. Take 2 minutes — the more you share, the smarter Flourish gets.
                </p>
              </div>
              <Btn onClick={() => goTo(3)}>Continue →</Btn>
            </motion.div>
          )}

          {/* ── 3 · Conditions ───────────────────────────────────────────────── */}
          {screen === 3 && (
            <motion.div key="s3" custom={dir} variants={variants} initial="initial" animate="animate" exit="exit">
              <BackBtn />
              <h2 style={{ fontSize: 26, fontWeight: 800, color: P, marginBottom: 6, letterSpacing: "-0.02em" }}>What condition are you managing?</h2>
              <p style={{ fontSize: 15, color: S, marginBottom: 22 }}>Select all that apply</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 24 }}>
                {CONDITIONS.map((c) => {
                  const sel = conditions.includes(c.id);
                  return (
                    <motion.button key={c.id} data-testid={`condition-${c.id}`} whileTap={{ scale: 0.93 }}
                      onClick={() => {
                        setConditions(prev => sel ? prev.filter(x => x !== c.id) : [...prev, c.id]);
                        if (!sel) ph.conditionSelected(c.id);
                      }}
                      style={{
                        padding: "16px 12px", borderRadius: 14, cursor: "pointer", textAlign: "center",
                        border: `2px solid ${sel ? PURPLE : "var(--border)"}`,
                        background: sel ? `linear-gradient(135deg, ${PURPLE}, #756AD9)` : "var(--bg-card)",
                        boxShadow: sel ? "0 4px 16px rgba(83,74,183,0.25)" : "none",
                        transition: "border-color 0.15s",
                      }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: sel ? "#fff" : P, margin: 0, lineHeight: 1.35 }}>{c.label}</p>
                      {sel && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} style={{ marginTop: 5 }}><Check size={13} color="rgba(255,255,255,0.9)" /></motion.div>}
                    </motion.button>
                  );
                })}
              </div>
              <Btn onClick={() => goTo(4)} disabled={conditions.length === 0}>Continue →</Btn>
            </motion.div>
          )}

          {/* ── 4 · Duration ─────────────────────────────────────────────────── */}
          {screen === 4 && (
            <motion.div key="s4" custom={dir} variants={variants} initial="initial" animate="animate" exit="exit">
              <BackBtn />
              <h2 style={{ fontSize: 26, fontWeight: 800, color: P, marginBottom: 6, letterSpacing: "-0.02em" }}>How long have you been dealing with this?</h2>
              <p style={{ fontSize: 15, color: S, marginBottom: 22 }}>Choose one</p>
              <div style={{ marginBottom: 24 }}>
                {DURATIONS.map((d) => <Option key={d} label={d} selected={howLong === d} onSelect={() => setHowLong(d)} />)}
              </div>
              <Btn onClick={() => goTo(5)} disabled={!howLong}>Continue →</Btn>
            </motion.div>
          )}

          {/* ── 5 · Struggles ────────────────────────────────────────────────── */}
          {screen === 5 && (
            <motion.div key="s5" custom={dir} variants={variants} initial="initial" animate="animate" exit="exit">
              <BackBtn />
              <h2 style={{ fontSize: 26, fontWeight: 800, color: P, marginBottom: 6, letterSpacing: "-0.02em" }}>What's your biggest challenge right now?</h2>
              <p style={{ fontSize: 15, color: S, marginBottom: 22 }}>Select all that apply</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
                {STRUGGLES.map((s) => {
                  const sel = struggles.includes(s);
                  return <Pill key={s} label={s} selected={sel} onToggle={() => setStruggles(prev => sel ? prev.filter(x => x !== s) : [...prev, s])} />;
                })}
              </div>
              <Btn onClick={() => goTo(6)} disabled={struggles.length === 0}>Continue →</Btn>
            </motion.div>
          )}

          {/* ── 6 · Goal ─────────────────────────────────────────────────────── */}
          {screen === 6 && (
            <motion.div key="s6" custom={dir} variants={variants} initial="initial" animate="animate" exit="exit">
              <BackBtn />
              <h2 style={{ fontSize: 26, fontWeight: 800, color: P, marginBottom: 6, letterSpacing: "-0.02em" }}>What's your main goal with Flourish?</h2>
              <p style={{ fontSize: 15, color: S, marginBottom: 22 }}>Choose one</p>
              <div style={{ marginBottom: 24 }}>
                {GOALS.map((g) => <Option key={g.id} label={g.label} emoji={g.emoji} selected={goal === g.id} onSelect={() => setGoal(g.id)} />)}
              </div>
              <Btn onClick={() => goTo(7)} disabled={!goal}>Continue →</Btn>
            </motion.div>
          )}

          {/* ── 7 · Diet ─────────────────────────────────────────────────────── */}
          {screen === 7 && (
            <motion.div key="s7" custom={dir} variants={variants} initial="initial" animate="animate" exit="exit">
              <BackBtn />
              <h2 style={{ fontSize: 26, fontWeight: 800, color: P, marginBottom: 6, letterSpacing: "-0.02em" }}>Do you follow any specific diet?</h2>
              <p style={{ fontSize: 15, color: S, marginBottom: 22 }}>Select all that apply</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
                {DIETS.map((d) => {
                  const sel = dietStyle.includes(d);
                  return <Pill key={d} label={d} selected={sel} onToggle={() => setDietStyle(prev => sel ? prev.filter(x => x !== d) : [...prev, d])} />;
                })}
              </div>
              <Btn onClick={() => goTo(8)}>Continue →</Btn>
            </motion.div>
          )}

          {/* ── 8 · Emotional validation ─────────────────────────────────────── */}
          {screen === 8 && (
            <motion.div key="s8" custom={dir} variants={variants} initial="initial" animate="animate" exit="exit">
              <BackBtn />
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", paddingTop: 16 }}>
                <motion.div initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 280, damping: 18 }}
                  style={{ fontSize: 64, marginBottom: 24 }}>
                  {validation.emoji}
                </motion.div>
                <h2 style={{ fontSize: 24, fontWeight: 800, color: P, marginBottom: 18, letterSpacing: "-0.02em", lineHeight: 1.25 }}>
                  {validation.headline}
                </h2>
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.25 } }}
                  style={{ background: "var(--bg-card)", borderRadius: 16, padding: "20px", marginBottom: 36, border: "1px solid var(--border)", textAlign: "left" }}>
                  <p style={{ fontSize: 16, color: S, lineHeight: 1.7, margin: 0 }}>{validation.body}</p>
                </motion.div>
                <Btn onClick={() => goTo(9)}>I feel seen →</Btn>
              </div>
            </motion.div>
          )}

          {/* ── 9 · Science ──────────────────────────────────────────────────── */}
          {screen === 9 && (
            <motion.div key="s9" custom={dir} variants={variants} initial="initial" animate="animate" exit="exit">
              <BackBtn />
              <div style={{ textAlign: "center", marginBottom: 28 }}>
                <h2 style={{ fontSize: 26, fontWeight: 800, color: P, marginBottom: 8, letterSpacing: "-0.02em" }}>Built on science you can trust.</h2>
                <p style={{ fontSize: 15, color: S, lineHeight: 1.6 }}>Every rating is grounded in peer-reviewed research and clinical nutrition principles.</p>
              </div>
              {[
                { emoji: "🔬", title: "Hormonal nutrition research", desc: "Insulin, oestrogen, and thyroid responses to food, backed by clinical studies." },
                { emoji: "🧬", title: "Anti-inflammatory science", desc: "Foods rated using established inflammation and gut health research." },
                { emoji: "🎯", title: "Personalised to your body", desc: "Your conditions shape every score — no generic advice, ever." },
              ].map((c, i) => (
                <motion.div key={i}
                  initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0, transition: { delay: i * 0.1 } }}
                  style={{ background: "var(--bg-card)", borderRadius: 16, padding: "16px 18px", marginBottom: 12, border: "1px solid var(--border)", display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(83,74,183,0.09)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 22 }}>
                    {c.emoji}
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: P, margin: "0 0 4px" }}>{c.title}</p>
                    <p style={{ fontSize: 13, color: S, margin: 0, lineHeight: 1.5 }}>{c.desc}</p>
                  </div>
                </motion.div>
              ))}
              <Btn onClick={() => goTo(10)} style={{ marginTop: 12 }}>Build my personalised plan →</Btn>
            </motion.div>
          )}

          {/* ── 10 · Loading ─────────────────────────────────────────────────── */}
          {screen === 10 && (
            <motion.div key="s10" custom={dir} variants={variants} initial="initial" animate="animate" exit="exit"
              style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "82vh", textAlign: "center" }}>
              <motion.div
                animate={{ scale: [1, 1.09, 1], rotate: [0, 6, -6, 0] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                style={{ width: 84, height: 84, borderRadius: 22, background: `linear-gradient(135deg, ${PURPLE}, #756AD9)`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 32, boxShadow: "0 10px 40px rgba(83,74,183,0.4)" }}>
                <span style={{ fontSize: 42 }}>🌸</span>
              </motion.div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: P, marginBottom: 6, letterSpacing: "-0.02em" }}>Building your plan</h2>
              <div style={{ height: 28, overflow: "hidden", marginBottom: 32 }}>
                <AnimatePresence mode="wait">
                  <motion.p key={loadingMsgIdx}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                    style={{ fontSize: 15, color: PURPLE, fontWeight: 600, margin: 0 }}>
                    {LOADING_MSGS[loadingMsgIdx]}
                  </motion.p>
                </AnimatePresence>
              </div>
              <div style={{ width: 260, background: "var(--border)", borderRadius: 6, height: 6, overflow: "hidden" }}>
                <motion.div style={{ height: "100%", background: `linear-gradient(90deg, ${PURPLE}, #756AD9)`, borderRadius: 6 }}
                  animate={{ width: `${loadingPct}%` }} transition={{ duration: 0.15 }} />
              </div>
            </motion.div>
          )}

          {/* ── 11 · Plan reveal ─────────────────────────────────────────────── */}
          {screen === 11 && (
            <motion.div key="s11" custom={dir} variants={variants} initial="initial" animate="animate" exit="exit">
              <div style={{ textAlign: "center", marginBottom: 22 }}>
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 17 }}
                  style={{ width: 58, height: 58, borderRadius: "50%", background: "linear-gradient(135deg, #639922, #7ab82a)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", boxShadow: "0 4px 20px rgba(99,153,34,0.3)" }}>
                  <Check size={26} color="#fff" />
                </motion.div>
                <h2 style={{ fontSize: 26, fontWeight: 800, color: P, marginBottom: 5, letterSpacing: "-0.02em" }}>Your plan is ready.</h2>
                <p style={{ fontSize: 14, color: S }}>Personalised for {conditions.map(c => CONDITIONS.find(x => x.id === c)?.label || c).join(", ")}</p>
              </div>

              {/* Summary card */}
              <div style={{ background: "rgba(83,74,183,0.06)", borderRadius: 16, padding: "16px 18px", marginBottom: 20, border: "1px solid rgba(83,74,183,0.18)" }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
                  {user?.name && (
                    <div><p style={{ fontSize: 11, fontWeight: 700, color: PURPLE, textTransform: "uppercase", letterSpacing: 0.8, margin: 0 }}>Name</p>
                      <p style={{ fontSize: 14, fontWeight: 700, color: P, margin: "2px 0 0" }}>{user.name}</p></div>
                  )}
                  <div><p style={{ fontSize: 11, fontWeight: 700, color: PURPLE, textTransform: "uppercase", letterSpacing: 0.8, margin: 0 }}>Conditions</p>
                    <p style={{ fontSize: 14, fontWeight: 700, color: P, margin: "2px 0 0" }}>{conditions.map(c => CONDITIONS.find(x => x.id === c)?.label || c).join(", ")}</p></div>
                  {goal && <div><p style={{ fontSize: 11, fontWeight: 700, color: PURPLE, textTransform: "uppercase", letterSpacing: 0.8, margin: 0 }}>Goal</p>
                    <p style={{ fontSize: 14, fontWeight: 700, color: P, margin: "2px 0 0" }}>{GOALS.find(g => g.id === goal)?.label || goal}</p></div>}
                </div>
              </div>

              {/* Tailored insights */}
              <p style={{ fontSize: 12, fontWeight: 700, color: S, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 }}>3 tailored insights for you</p>
              {insights.map((insight, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0, transition: { delay: i * 0.12 } }}
                  style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 10, padding: "13px 15px", background: "var(--bg-card)", borderRadius: 12, border: "1px solid var(--border)" }}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: PURPLE, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                    <Star size={10} color="#fff" fill="#fff" />
                  </div>
                  <p style={{ fontSize: 14, color: P, margin: 0, lineHeight: 1.5 }}>{insight}</p>
                </motion.div>
              ))}
              <Btn onClick={() => goTo(12)} style={{ marginTop: 10 }}>See it in action →</Btn>
            </motion.div>
          )}

          {/* ── 12 · Free scan input ─────────────────────────────────────────── */}
          {screen === 12 && (
            <motion.div key="s12" custom={dir} variants={variants} initial="initial" animate="animate" exit="exit">
              <div style={{ textAlign: "center", marginBottom: 28 }}>
                <div style={{ width: 56, height: 56, borderRadius: 16, background: `linear-gradient(135deg, ${PURPLE}, #756AD9)`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 28, boxShadow: "0 4px 20px rgba(83,74,183,0.3)" }}>🔍</div>
                <h2 style={{ fontSize: 24, fontWeight: 800, color: P, marginBottom: 10, letterSpacing: "-0.02em", lineHeight: 1.2 }}>Let's show you what Flourish can do.</h2>
                <p style={{ fontSize: 15, color: S, lineHeight: 1.55 }}>Rate any food right now. Full premium experience — no limits, no locks.</p>
              </div>

              <input
                value={scanFood}
                onChange={e => setScanFood(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleScan()}
                placeholder="e.g. Greek yoghurt, Peanut butter, Oat milk..."
                style={{ width: "100%", boxSizing: "border-box", background: "var(--input-bg)", border: "2px solid var(--border)", borderRadius: 14, padding: "18px 20px", fontSize: 16, outline: "none", color: "var(--input-text)", fontFamily: "inherit", marginBottom: 4 }}
              />

              {scanError && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  style={{ fontSize: 14, color: "#A32D2D", background: "rgba(163,45,45,0.08)", borderRadius: 10, padding: "10px 14px", margin: "8px 0" }}>
                  {scanError}
                </motion.p>
              )}

              <Btn onClick={handleScan} disabled={!scanFood.trim()} loading={scanLoading}>
                {scanLoading ? "Analysing your food..." : `Rate "${scanFood || "your food"}" →`}
              </Btn>

              <button onClick={() => onComplete()}
                style={{ width: "100%", background: "none", border: "none", color: "var(--text-muted)", fontSize: 13, cursor: "pointer", padding: "16px 0 0", fontWeight: 500 }}>
                Skip for now
              </button>
            </motion.div>
          )}

          {/* ── 13 · Free scan result ────────────────────────────────────────── */}
          {screen === 13 && scanResult && (
            <motion.div key="s13" custom={dir} variants={variants} initial="initial" animate="animate" exit="exit">
              <div style={{ textAlign: "center", marginBottom: 20 }}>
                <p style={{ fontSize: 13, color: S, margin: "0 0 4px" }}>You rated</p>
                <h2 style={{ fontSize: 21, fontWeight: 800, color: P, margin: "0 0 18px", letterSpacing: "-0.02em" }}>{scanResult.name || scanResult.food_name || scanFood}</h2>
                <ScoreRing score={scanResult.overallScore || 0} />
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.5 } }}
                  style={{ display: "inline-block", marginTop: 10, padding: "5px 14px", borderRadius: 20, background: (scanResult.overallScore || 0) >= 70 ? "rgba(99,153,34,0.12)" : "rgba(186,117,23,0.12)" }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: (scanResult.overallScore || 0) >= 70 ? "#639922" : "#BA7517", margin: 0 }}>{scanResult.verdict}</p>
                </motion.div>
              </div>

              {scanResult.forYourCondition && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.4 } }}
                  style={{ background: "rgba(83,74,183,0.06)", borderRadius: 14, padding: "14px 16px", marginBottom: 14, border: "1px solid rgba(83,74,183,0.15)" }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: PURPLE, textTransform: "uppercase", letterSpacing: 0.8, margin: "0 0 5px" }}>For your condition</p>
                  <p style={{ fontSize: 14, color: P, margin: 0, lineHeight: 1.6 }}>{scanResult.forYourCondition}</p>
                </motion.div>
              )}

              {scanResult.dimensions && (
                <div style={{ marginBottom: 14 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: S, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>Full breakdown</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <DimCard label="Naturalness" data={scanResult.dimensions.naturalness} />
                    <DimCard label="Hormonal Impact" data={scanResult.dimensions.hormonalImpact} />
                    <DimCard label="Inflammation" data={scanResult.dimensions.inflammation} />
                    <DimCard label="Gut Health" data={scanResult.dimensions.gutHealth} />
                  </div>
                </div>
              )}

              {scanResult.flags && (
                <div style={{ marginBottom: 14 }}>
                  {scanResult.flags.warnings?.slice(0, 2).map((w, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 14 }}>⚠️</span>
                      <p style={{ fontSize: 13, color: S, margin: 0, lineHeight: 1.4 }}>{w}</p>
                    </div>
                  ))}
                  {scanResult.flags.positives?.slice(0, 2).map((p, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 14 }}>✅</span>
                      <p style={{ fontSize: 13, color: S, margin: 0, lineHeight: 1.4 }}>{p}</p>
                    </div>
                  ))}
                </div>
              )}

              {scanResult.alternatives?.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: S, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>Better alternatives</p>
                  {scanResult.alternatives.slice(0, 3).map((alt, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "var(--bg-card)", borderRadius: 10, marginBottom: 6, border: "1px solid var(--border)" }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: P, margin: 0 }}>{alt.name}</p>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#639922" }}>{alt.predictedScore}/100</span>
                    </div>
                  ))}
                </div>
              )}

              <Btn onClick={() => goTo(14)}>See your options →</Btn>
            </motion.div>
          )}

          {/* ── 14 · Post-scan paywall ───────────────────────────────────────── */}
          {screen === 14 && (
            <motion.div key="s14" custom={dir} variants={variants} initial="initial" animate="animate" exit="exit">
              <div style={{ textAlign: "center", marginBottom: 28 }}>
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 18 }}
                  style={{ fontSize: 52, marginBottom: 14 }}>🎯</motion.div>
                <h2 style={{ fontSize: 25, fontWeight: 800, color: P, marginBottom: 10, letterSpacing: "-0.02em", lineHeight: 1.2 }}>
                  That's what Flourish does for every food, every day.
                </h2>
                <p style={{ fontSize: 15, color: S, lineHeight: 1.6 }}>
                  Unlimited scans. Full breakdown. Personalised to your exact conditions. Start your free trial — no card charged until it ends.
                </p>
              </div>

              {/* Annual */}
              <motion.div whileTap={{ scale: 0.98 }}
                onClick={() => !planLoading && handlePlan("annual")}
                style={{ background: `linear-gradient(135deg, ${PURPLE}, #756AD9)`, borderRadius: 18, padding: "20px 22px", marginBottom: 12, position: "relative", overflow: "hidden", boxShadow: "0 6px 28px rgba(83,74,183,0.35)", cursor: "pointer" }}>
                <div style={{ position: "absolute", top: 12, right: 12, background: "rgba(255,255,255,0.22)", borderRadius: 8, padding: "3px 10px" }}>
                  <p style={{ color: "#fff", fontSize: 10, fontWeight: 800, margin: 0, textTransform: "uppercase", letterSpacing: 0.8 }}>Most popular</p>
                </div>
                <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, margin: "0 0 4px", fontWeight: 600 }}>Annual plan</p>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4 }}>
                  <span style={{ color: "#fff", fontSize: 30, fontWeight: 800 }}>£49.99</span>
                  <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 15 }}>/year</span>
                  <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, textDecoration: "line-through", marginLeft: 4 }}>£79</span>
                </div>
                <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                  <span style={{ background: "rgba(255,255,255,0.2)", color: "#fff", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6 }}>Save 68%</span>
                  <span style={{ color: "rgba(255,255,255,0.75)", fontSize: 12 }}>£4.17/month</span>
                </div>
                <div style={{ background: "#fff", borderRadius: 12, padding: "13px 0", textAlign: "center" }}>
                  <p style={{ color: PURPLE, fontWeight: 800, fontSize: 15, margin: 0 }}>
                    {planLoading === "annual" ? "Creating your trial..." : "Start 7-Day Free Trial →"}
                  </p>
                </div>
              </motion.div>

              {/* Monthly */}
              <motion.div whileTap={{ scale: 0.98 }}
                onClick={() => !planLoading && handlePlan("monthly")}
                style={{ background: "var(--bg-card)", borderRadius: 18, padding: "18px 22px", marginBottom: 16, border: "2px solid var(--border)", cursor: "pointer" }}>
                <p style={{ color: S, fontSize: 12, margin: "0 0 4px", fontWeight: 600 }}>Monthly plan</p>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 14 }}>
                  <span style={{ color: P, fontSize: 26, fontWeight: 800 }}>£12.99</span>
                  <span style={{ color: S, fontSize: 14 }}>/month</span>
                </div>
                <div style={{ background: "var(--bg-elevated)", borderRadius: 12, padding: "12px 0", textAlign: "center", border: "1px solid var(--border)" }}>
                  <p style={{ color: PURPLE, fontWeight: 700, fontSize: 14, margin: 0 }}>
                    {planLoading === "monthly" ? "Creating your trial..." : "Start 3-Day Free Trial →"}
                  </p>
                </div>
              </motion.div>

              {planError && (
                <p style={{ fontSize: 14, color: "#A32D2D", background: "rgba(163,45,45,0.08)", borderRadius: 10, padding: "10px 14px", marginBottom: 12 }}>{planError}</p>
              )}

              <p style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", lineHeight: 1.6, marginBottom: 12 }}>
                Cancel anytime during your trial — you won't be charged a penny.
              </p>

              <button onClick={() => onComplete()}
                style={{ width: "100%", background: "none", border: "none", color: "var(--text-muted)", fontSize: 14, cursor: "pointer", padding: "8px 0 0", fontWeight: 500 }}>
                Maybe later
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
