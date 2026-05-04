import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Check, Star } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { ph } from "../lib/posthog";

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

const DURATIONS = ["Just diagnosed", "Less than a year", "1–3 years", "3+ years", "Most of my life"];

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
  { id: "reduce_inflammation", label: "Less pain and inflammation", emoji: "🔥" },
  { id: "balance_hormones", label: "Hormones that feel stable", emoji: "⚖️" },
  { id: "improve_gut", label: "A gut that works with me", emoji: "🌿" },
  { id: "increase_energy", label: "Real, lasting energy", emoji: "⚡" },
  { id: "feel_in_control", label: "Feel like myself again", emoji: "💪" },
];

const DIETS = ["No restrictions", "Gluten free", "Dairy free", "Vegan", "Vegetarian", "Low FODMAP", "Anti-inflammatory", "Other"];

const MEALS = [
  { id: "omad", label: "1 meal (OMAD)" },
  { id: "two", label: "2 meals" },
  { id: "three", label: "3 meals" },
  { id: "four_plus", label: "4+ meals" },
  { id: "varies", label: "It varies" },
];

const FEATURES = [
  { emoji: "📷", name: "Barcode scanner", desc: "Scan any food in seconds and know if it supports or disrupts your hormones before it touches your plate." },
  { emoji: "📊", name: "4-dimension ratings", desc: "Every food scored on Naturalness, Hormonal Impact, Inflammation, and Gut Health — calibrated to your conditions." },
  { emoji: "💜", name: "Symptom tracker", desc: "Log how you feel after eating. Start seeing the patterns that took others years to figure out." },
  { emoji: "🔄", name: "Swap suggestions", desc: "Every red-rated food comes with better alternatives matched to your dietary style and goals." },
  { emoji: "📖", name: "Food diary", desc: "Log every meal and watch your health transform — week by week, in data you can actually see." },
  { emoji: "📈", name: "Weekly insights", desc: "AI-generated weekly reports that connect your food choices to how you're feeling over time." },
];

const CONDITION_MIRROR = {
  pcos: {
    headline: "PCOS is one of the most misunderstood conditions in women's health.",
    body: "Most women with PCOS spend years being told to 'just lose weight' or 'just eat healthy' — without anyone explaining that insulin resistance, androgens, and inflammation make standard nutrition advice work against you, not for you. You're not doing it wrong. You've just never had the right information for your body.",
    quote: "I tried everything. Clean eating, cutting carbs, going vegan. Nothing clicked until I understood how food was actually affecting my hormones specifically.",
    author: "Amara, 28 · PCOS",
  },
  endometriosis: {
    headline: "Endometriosis affects 1 in 10 women. Most wait 8 years for a diagnosis.",
    body: "If you've spent years being told your pain is normal — it wasn't. Endometriosis creates a systemic inflammatory environment that makes certain foods actively worsen symptoms, while others genuinely help. The connection between food and endo pain is real, documented, and almost never explained by doctors.",
    quote: "After my diagnosis I had no idea where to start with food. Flourish was the first thing that actually connected my meals to how I felt the next day.",
    author: "Priya, 31 · Endometriosis",
  },
  thyroid: {
    headline: "Your thyroid controls your metabolism, energy, mood, and weight — all at once.",
    body: "What you eat directly affects thyroid hormone conversion and absorption. Goitrogenic foods, iodine levels, selenium — most people managing a thyroid condition have never been told any of this. You deserve to know exactly which foods support your thyroid and which ones work against it.",
    quote: "My TSH levels were all over the place for two years. Changing how I ate based on my thyroid specifically made a bigger difference than I expected.",
    author: "Claire, 34 · Hashimoto's",
  },
  ibs: {
    headline: "Your gut and your hormones are in constant conversation.",
    body: "IBS isn't just a digestive issue — it's deeply connected to oestrogen, cortisol, and the gut-brain axis. Most IBS advice is generic. What triggers one person's symptoms can be completely fine for another. Flourish scores every food against your specific gut and hormonal profile — not a one-size-fits-all chart.",
    quote: "I used to dread eating because I never knew what would set me off. Having something that tells me in advance changed everything.",
    author: "Sophie, 26 · IBS",
  },
  hormonal_imbalance: {
    headline: "Hormonal imbalance touches everything — sleep, weight, mood, skin, energy.",
    body: "When your hormones are dysregulated, the standard advice doesn't apply to you. Flourish was built specifically for women whose bodies need a different lens — one that accounts for how food interacts with oestrogen, progesterone, cortisol, and insulin in your specific situation.",
    quote: "I finally stopped feeling like I was failing at being healthy. The problem wasn't me — it was the information I was given.",
    author: "Jen, 29 · Hormonal imbalance",
  },
  autoimmune: {
    headline: "Autoimmune conditions mean your body is fighting itself — food can help stop the fire.",
    body: "Inflammation is at the root of every autoimmune condition. What you eat can either dampen that inflammatory response or amplify it — and the difference isn't always obvious. Flourish rates every food against your inflammatory profile so you're never guessing.",
    quote: "Managing an autoimmune condition through food felt overwhelming until I had something that made the decisions simple.",
    author: "Rachel, 33 · Autoimmune",
  },
};

const CONDITION_MIRROR_GENERAL = {
  headline: "Not having a diagnosis doesn't mean your symptoms aren't real.",
  body: "Many women spend years knowing something is wrong without a clear answer. Flourish works for you too — by understanding your symptoms, challenges, and how you feel day to day, it builds a profile that makes sense of your body even without a formal diagnosis.",
  quote: "I didn't have a label for what I was dealing with. But Flourish still gave me answers no one else had.",
  author: "Maya, 27",
};

const MIRROR_PRIORITY = ["pcos", "endometriosis", "thyroid", "ibs", "hormonal_imbalance", "autoimmune"];

const SCIENCE_CARDS = [
  { emoji: "🔬", title: "Hormonal nutrition research", desc: "Insulin, oestrogen, and thyroid responses to food are grounded in peer-reviewed clinical studies. Flourish translates this into scores built for your conditions — not population averages." },
  { emoji: "🧬", title: "Anti-inflammatory science", desc: "Inflammation drives most hormonal conditions. Every food is rated against established inflammatory and gut health research — the same science used in clinical nutrition." },
  { emoji: "🎯", title: "Built around you, not averages", desc: "Your conditions, goals, struggles, and dietary style shape every single score. No two Flourish profiles produce the same ratings." },
];

export default function Onboarding({ onComplete }) {
  const { user, updateProfile, logout } = useAuth();
  const { isDark, setTheme } = useTheme();

  const [screen, setScreen] = useState(1);
  const [dir, setDir] = useState(1);
  const [age, setAge] = useState("");
  const [conditions, setConditions] = useState([]);
  const [howLong, setHowLong] = useState("");
  const [struggles, setStruggles] = useState([]);
  const [goal, setGoal] = useState("");
  const [dietStyle, setDietStyle] = useState([]);
  const [mealsPerDay, setMealsPerDay] = useState("");
  const [appearance, setAppearance] = useState(isDark ? "dark" : "light");
  const [loadingPct, setLoadingPct] = useState(0);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [featuresShown, setFeaturesShown] = useState(0);
  const [saving, setSaving] = useState(false);

  const firstName = user?.name?.split(" ")[0] || "";

  const conditionMirror = (() => {
    for (const id of MIRROR_PRIORITY) {
      if (conditions.includes(id)) return CONDITION_MIRROR[id];
    }
    return CONDITION_MIRROR_GENERAL;
  })();

  const primaryConditionLabel = conditions.length > 0
    ? CONDITIONS.find(c => c.id === conditions[0])?.label || "your conditions"
    : "your conditions";

  const showProgress = screen >= 2 && screen <= 16;
  const progress = showProgress ? ((screen - 2) / 14) * 100 : 0;

  const ageNum = parseInt(age, 10);
  const ageValid = !isNaN(ageNum) && ageNum >= 16 && ageNum <= 80;

  const conditionLabels = conditions.map(c => CONDITIONS.find(x => x.id === c)?.label || c).join(" and ");
  const struggleCount = struggles.length;
  const struggleSummary = struggleCount === 0
    ? "your daily challenges"
    : struggleCount === 1
      ? struggles[0]
      : `${struggles[0]} and ${struggles[1]}`;
  const durationLower = howLong ? howLong.toLowerCase() : "some time";
  const reflectionText = `Based on what you've shared, ${firstName || "you"} ${firstName ? "has" : "have"} been managing ${conditionLabels || "your conditions"} for ${durationLower}. Your biggest day-to-day ${struggles.length === 1 ? "struggle is" : "struggles are"} ${struggleSummary}. This tells us a lot — and it means your food ratings, insights, and suggestions will be calibrated specifically around this picture of your health.`;

  const loadingMsgs = [
    "Mapping your hormonal profile...",
    `Calibrating food scores for ${primaryConditionLabel}...`,
    "Analysing your gut health priorities...",
    "Setting your inflammation baseline...",
    "Personalising your swap suggestions...",
    "Your profile is almost ready...",
  ];

  const goTo = (s) => {
    setDir(s > screen ? 1 : -1);
    setScreen(s);
    ph.onboardingStepViewed(`step_${s}`, s);
  };

  const pickTheme = (dark) => {
    setAppearance(dark ? "dark" : "light");
    setTheme(dark);
  };

  useEffect(() => {
    if (screen !== 12) return;
    const DURATION = 3000;
    const t0 = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - t0;
      setLoadingPct(Math.min((elapsed / DURATION) * 100, 98));
      setLoadingMsgIdx(Math.min(Math.floor((elapsed / (DURATION / loadingMsgs.length))), loadingMsgs.length - 1));
    }, 120);
    updateProfile({
      age: age ? parseInt(age, 10) : undefined,
      conditions,
      goals: [goal].filter(Boolean),
      managing_duration: howLong,
      struggles,
      diet_style: dietStyle,
      goal,
      meals_per_day: mealsPerDay,
      appearance_preference: appearance,
    }).catch(e => console.error("[Onboarding] save failed:", e));
    const timer = setTimeout(() => {
      clearInterval(interval);
      setLoadingPct(100);
      setTimeout(() => goTo(13), 350);
    }, DURATION);
    return () => { clearInterval(interval); clearTimeout(timer); };
  }, [screen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (screen !== 16) return;
    setFeaturesShown(0);
    let i = 0;
    const t = setInterval(() => {
      i++;
      setFeaturesShown(i);
      if (i >= FEATURES.length) clearInterval(t);
    }, 140);
    return () => clearInterval(t);
  }, [screen]);

  const variants = {
    initial: (d) => ({ opacity: 0, x: d > 0 ? 56 : -56 }),
    animate: { opacity: 1, x: 0, transition: { type: "spring", damping: 26, stiffness: 320 } },
    exit: (d) => ({ opacity: 0, x: d > 0 ? -56 : 56, transition: { duration: 0.16 } }),
  };

  const PRI = "#534AB7";
  const P = "var(--text-primary)";
  const S = "var(--text-secondary)";

  const Btn = ({ onClick, disabled, loading: ld, children, secondary }) => (
    <motion.button whileTap={{ scale: 0.97 }} onClick={onClick} disabled={disabled || ld}
      style={{
        width: "100%", border: secondary ? "1px solid var(--border)" : "none", borderRadius: 14,
        padding: "18px 24px", fontSize: 16, fontWeight: 700, cursor: disabled || ld ? "not-allowed" : "pointer",
        background: secondary ? "var(--bg-card)" : disabled ? "var(--border)" : `linear-gradient(135deg, ${PRI}, #756AD9)`,
        color: secondary ? S : disabled ? "var(--text-muted)" : "#fff",
        boxShadow: (!disabled && !secondary) ? "0 4px 20px rgba(83,74,183,0.30)" : "none",
        marginTop: 8, minHeight: 56, letterSpacing: "-0.01em",
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
        border: `2px solid ${selected ? PRI : "var(--border)"}`,
        background: selected ? `linear-gradient(135deg, ${PRI}, #756AD9)` : "var(--bg-card)",
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
        border: `2px solid ${selected ? PRI : "var(--border)"}`,
        background: selected ? "rgba(83,74,183,0.06)" : "var(--bg-card)",
        textAlign: "left", display: "flex", alignItems: "center", gap: 14, marginBottom: 8,
        transition: "border-color 0.15s",
      }}>
      {emoji && <span style={{ fontSize: 22 }}>{emoji}</span>}
      <p style={{ fontSize: 15, fontWeight: 600, color: selected ? PRI : P, margin: 0, flex: 1 }}>{label}</p>
      {selected && (
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
          style={{ width: 22, height: 22, borderRadius: "50%", background: PRI, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Check size={12} color="#fff" />
        </motion.div>
      )}
    </motion.button>
  );

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", background: "var(--bg-app)", display: "flex", flexDirection: "column", overflowX: "hidden" }}>

      {showProgress && (
        <div style={{ height: 4, background: "var(--border)", position: "fixed", top: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, zIndex: 100 }}>
          <motion.div style={{ height: "100%", background: `linear-gradient(90deg, ${PRI}, #756AD9)`, borderRadius: 4 }}
            animate={{ width: `${progress}%` }} transition={{ type: "spring", stiffness: 140, damping: 24 }} />
        </div>
      )}

      <div style={{ flex: 1, padding: `${showProgress ? 60 : 0}px 24px 48px`, overflowY: "auto" }}>
        <AnimatePresence mode="wait" custom={dir}>

          {/* ── 1 · Landing ──────────────────────────────────────────────────── */}
          {screen === 1 && (
            <motion.div key="s1" custom={dir} variants={variants} initial="initial" animate="animate" exit="exit"
              style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "0 0 60px" }}>
              <div style={{ position: "relative", marginBottom: 32 }}>
                {[...Array(5)].map((_, i) => (
                  <motion.div key={i} animate={{ scale: [1, 1.7 + i * 0.15, 1], opacity: [0.12, 0, 0.12] }}
                    transition={{ duration: 2.6, repeat: Infinity, delay: i * 0.45, ease: "easeInOut" }}
                    style={{ position: "absolute", inset: -((i + 1) * 16), borderRadius: "50%", background: "rgba(83,74,183,0.07)", pointerEvents: "none" }} />
                ))}
                <motion.div animate={{ scale: [1, 1.07, 1], rotate: [0, 4, -4, 0] }} transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
                  style={{ width: 92, height: 92, borderRadius: 24, background: `linear-gradient(135deg, ${PRI}, #756AD9)`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 12px 44px rgba(83,74,183,0.4)", position: "relative" }}>
                  <span style={{ fontSize: 46 }}>🌸</span>
                </motion.div>
              </div>
              <h1 style={{ fontSize: 40, fontWeight: 800, color: P, margin: "0 0 16px", letterSpacing: "-0.03em" }}>Flourish</h1>
              <h1 style={{ fontSize: 27, fontWeight: 800, color: P, margin: "0 0 16px", letterSpacing: "-0.02em", lineHeight: 1.2 }}>Your body isn't broken. It's been misunderstood.</h1>
              <p style={{ fontSize: 17, color: S, margin: "0 0 52px", lineHeight: 1.55 }}>Flourish reads every food through the lens of your condition — telling you exactly what it does to your hormones.</p>
              <motion.button data-testid="onboarding-get-started-btn" whileTap={{ scale: 0.97 }} onClick={() => goTo(2)}
                style={{ width: "100%", background: `linear-gradient(135deg, ${PRI}, #756AD9)`, color: "#fff", border: "none", borderRadius: 14, padding: "20px 24px", fontSize: 18, fontWeight: 700, cursor: "pointer", boxShadow: "0 6px 30px rgba(83,74,183,0.4)", letterSpacing: "-0.01em" }}>
                Start my personalisation →
              </motion.button>
              <button onClick={logout}
                style={{ background: "none", border: "none", color: PRI, fontSize: 14, fontWeight: 600, cursor: "pointer", padding: "16px 0 0", display: "block" }}>
                Already have an account? Log in
              </button>
            </motion.div>
          )}

          {/* ── 2 · Age input ────────────────────────────────────────────────── */}
          {screen === 2 && (
            <motion.div key="s2" custom={dir} variants={variants} initial="initial" animate="animate" exit="exit">
              <BackBtn />
              <h2 style={{ fontSize: 26, fontWeight: 800, color: P, marginBottom: 8, letterSpacing: "-0.02em" }}>
                {`First — how old are you${firstName ? `, ${firstName}` : ""}?`}
              </h2>
              <p style={{ fontSize: 15, color: S, marginBottom: 28, lineHeight: 1.6 }}>
                Hormonal health changes significantly across your 20s, 30s, and 40s. Your age helps us calibrate every score specifically to where your body is right now.
              </p>
              <input
                inputMode="numeric"
                pattern="[0-9]*"
                value={age}
                onChange={(e) => setAge(e.target.value.replace(/\D/g, "").slice(0, 2))}
                placeholder="Your age"
                style={{
                  background: "var(--bg-card)", border: `2px solid ${age && !ageValid ? "#e05555" : "var(--border)"}`,
                  borderRadius: 14, padding: "16px 20px", fontSize: 22, fontWeight: 700,
                  textAlign: "center", color: "var(--text-primary)", outline: "none",
                  width: "100%", boxSizing: "border-box", marginBottom: 8,
                }}
              />
              {age && !ageValid && (
                <p style={{ fontSize: 13, color: "#e05555", margin: "0 0 16px", textAlign: "center" }}>Please enter an age between 16 and 80.</p>
              )}
              <div style={{ marginTop: 16 }}>
                <Btn onClick={() => goTo(3)} disabled={!ageValid}>Continue →</Btn>
              </div>
            </motion.div>
          )}

          {/* ── 3 · Personalisation intro ────────────────────────────────────── */}
          {screen === 3 && (
            <motion.div key="s3" custom={dir} variants={variants} initial="initial" animate="animate" exit="exit">
              <BackBtn />
              <h2 style={{ fontSize: 26, fontWeight: 800, color: P, marginBottom: 20, letterSpacing: "-0.02em" }}>
                {`What you share here changes everything${firstName ? `, ${firstName}` : ""}.`}
              </h2>
              <div style={{ background: "var(--bg-card)", borderRadius: 16, padding: "18px 20px", marginBottom: 36, border: "1px solid var(--border)" }}>
                <p style={{ fontSize: 16, color: S, lineHeight: 1.65, margin: 0 }}>
                  Most apps give everyone the same advice. Flourish doesn't. Every food score, every insight, every swap suggestion you see will be built specifically around your body, your condition, and your goals. This takes 2 minutes — and it's worth it.
                </p>
              </div>
              <Btn onClick={() => goTo(4)}>Let's do this →</Btn>
            </motion.div>
          )}

          {/* ── 4 · Condition selector ───────────────────────────────────────── */}
          {screen === 4 && (
            <motion.div key="s4" custom={dir} variants={variants} initial="initial" animate="animate" exit="exit">
              <BackBtn />
              <h2 style={{ fontSize: 26, fontWeight: 800, color: P, marginBottom: 6, letterSpacing: "-0.02em" }}>
                {`What are you living with${firstName ? `, ${firstName}` : ""}?`}
              </h2>
              <p style={{ fontSize: 15, color: S, marginBottom: 22 }}>You didn't choose this. But understanding it starts here.</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 24 }}>
                {CONDITIONS.map((c) => {
                  const sel = conditions.includes(c.id);
                  return (
                    <motion.button key={c.id} data-testid={`condition-${c.id}`} whileTap={{ scale: 0.93 }}
                      onClick={() => { setConditions(prev => sel ? prev.filter(x => x !== c.id) : [...prev, c.id]); if (!sel) ph.conditionSelected(c.id); }}
                      style={{ padding: "16px 12px", borderRadius: 14, cursor: "pointer", textAlign: "center", border: `2px solid ${sel ? PRI : "var(--border)"}`, background: sel ? `linear-gradient(135deg, ${PRI}, #756AD9)` : "var(--bg-card)", boxShadow: sel ? "0 4px 16px rgba(83,74,183,0.25)" : "none", transition: "border-color 0.15s" }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: sel ? "#fff" : P, margin: 0, lineHeight: 1.35 }}>{c.label}</p>
                      {sel && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} style={{ marginTop: 5 }}><Check size={13} color="rgba(255,255,255,0.9)" /></motion.div>}
                    </motion.button>
                  );
                })}
              </div>
              <Btn onClick={() => goTo(5)} disabled={conditions.length === 0}>Continue →</Btn>
            </motion.div>
          )}

          {/* ── 5 · Condition Mirror ─────────────────────────────────────────── */}
          {screen === 5 && (
            <motion.div key="s5" custom={dir} variants={variants} initial="initial" animate="animate" exit="exit">
              <BackBtn />
              <p style={{ fontSize: 11, fontWeight: 700, color: PRI, textTransform: "uppercase", letterSpacing: 1, margin: "0 0 12px" }}>YOUR STORY</p>
              <h2 style={{ fontSize: 24, fontWeight: 800, color: P, marginBottom: 20, letterSpacing: "-0.02em", lineHeight: 1.25 }}>{conditionMirror.headline}</h2>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.15 } }}
                style={{ background: "var(--bg-card)", borderRadius: 16, padding: "18px 20px", marginBottom: 16, border: "1px solid var(--border)" }}>
                <p style={{ fontSize: 15, color: S, lineHeight: 1.7, margin: 0 }}>{conditionMirror.body}</p>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.3 } }}
                style={{ borderLeft: `3px solid ${PRI}`, paddingLeft: 16, marginBottom: 32 }}>
                <p style={{ fontSize: 15, color: S, fontStyle: "italic", lineHeight: 1.65, margin: "0 0 8px" }}>"{conditionMirror.quote}"</p>
                <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0, fontWeight: 600 }}>— {conditionMirror.author}</p>
              </motion.div>
              <Btn onClick={() => goTo(6)}>This is exactly it →</Btn>
            </motion.div>
          )}

          {/* ── 6 · Duration ─────────────────────────────────────────────────── */}
          {screen === 6 && (
            <motion.div key="s6" custom={dir} variants={variants} initial="initial" animate="animate" exit="exit">
              <BackBtn />
              <h2 style={{ fontSize: 26, fontWeight: 800, color: P, marginBottom: 8, letterSpacing: "-0.02em" }}>How long has this been part of your life?</h2>
              <p style={{ fontSize: 15, color: S, marginBottom: 22, lineHeight: 1.6 }}>Your history shapes how Flourish calibrates your ratings. Someone newly diagnosed needs different guidance than someone who's been managing this for years.</p>
              <div style={{ marginBottom: 24 }}>
                {DURATIONS.map((d) => <Option key={d} label={d} selected={howLong === d} onSelect={() => setHowLong(d)} />)}
              </div>
              <Btn onClick={() => goTo(7)} disabled={!howLong}>Continue →</Btn>
            </motion.div>
          )}

          {/* ── 7 · Challenges ───────────────────────────────────────────────── */}
          {screen === 7 && (
            <motion.div key="s7" custom={dir} variants={variants} initial="initial" animate="animate" exit="exit">
              <BackBtn />
              <h2 style={{ fontSize: 26, fontWeight: 800, color: P, marginBottom: 8, letterSpacing: "-0.02em" }}>What does this actually feel like, day to day?</h2>
              <p style={{ fontSize: 15, color: S, marginBottom: 22, lineHeight: 1.6 }}>Don't minimise it. Select everything that's genuinely affecting your life right now.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
                {STRUGGLES.map((s) => {
                  const sel = struggles.includes(s);
                  return <Pill key={s} label={s} selected={sel} onToggle={() => setStruggles(prev => sel ? prev.filter(x => x !== s) : [...prev, s])} />;
                })}
              </div>
              <Btn onClick={() => goTo(8)} disabled={struggles.length === 0}>Continue →</Btn>
            </motion.div>
          )}

          {/* ── 8 · Reflection Mirror ────────────────────────────────────────── */}
          {screen === 8 && (
            <motion.div key="s8" custom={dir} variants={variants} initial="initial" animate="animate" exit="exit">
              <BackBtn />
              <p style={{ fontSize: 11, fontWeight: 700, color: PRI, textTransform: "uppercase", letterSpacing: 1, margin: "0 0 12px" }}>YOUR PROFILE SO FAR</p>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.1 } }}
                style={{ background: "var(--bg-card)", borderRadius: 16, padding: "18px 20px", marginBottom: 16, border: "1px solid var(--border)" }}>
                <p style={{ fontSize: 15, color: S, lineHeight: 1.7, margin: 0 }}>{reflectionText}</p>
              </motion.div>
              <p style={{ fontSize: 14, color: S, lineHeight: 1.6, marginBottom: 32 }}>Flourish will use this to build your personalised food intelligence.</p>
              <Btn onClick={() => goTo(9)}>That's exactly right →</Btn>
            </motion.div>
          )}

          {/* ── 9 · Goal ─────────────────────────────────────────────────────── */}
          {screen === 9 && (
            <motion.div key="s9" custom={dir} variants={variants} initial="initial" animate="animate" exit="exit">
              <BackBtn />
              <h2 style={{ fontSize: 26, fontWeight: 800, color: P, marginBottom: 8, letterSpacing: "-0.02em", lineHeight: 1.2 }}>When your body finally feels like yours again — what's the first thing that changes?</h2>
              <p style={{ fontSize: 15, color: S, marginBottom: 22, lineHeight: 1.6 }}>Your answer shapes which foods Flourish puts first for you.</p>
              <div style={{ marginBottom: 24 }}>
                {GOALS.map((g) => <Option key={g.id} label={g.label} emoji={g.emoji} selected={goal === g.id} onSelect={() => setGoal(g.id)} />)}
              </div>
              <Btn onClick={() => goTo(10)} disabled={!goal}>Continue →</Btn>
            </motion.div>
          )}

          {/* ── 10 · Diet style ──────────────────────────────────────────────── */}
          {screen === 10 && (
            <motion.div key="s10" custom={dir} variants={variants} initial="initial" animate="animate" exit="exit">
              <BackBtn />
              <h2 style={{ fontSize: 26, fontWeight: 800, color: P, marginBottom: 8, letterSpacing: "-0.02em" }}>Do you follow a specific way of eating?</h2>
              <p style={{ fontSize: 15, color: S, marginBottom: 22, lineHeight: 1.6 }}>Your dietary choices change how foods interact with your hormones. This helps Flourish score foods accurately for your lifestyle.</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
                {DIETS.map((d) => {
                  const sel = dietStyle.includes(d);
                  return <Pill key={d} label={d} selected={sel} onToggle={() => setDietStyle(prev => sel ? prev.filter(x => x !== d) : [...prev, d])} />;
                })}
              </div>
              <Btn onClick={() => goTo(11)}>Continue →</Btn>
            </motion.div>
          )}

          {/* ── 11 · Meals per day ───────────────────────────────────────────── */}
          {screen === 11 && (
            <motion.div key="s11" custom={dir} variants={variants} initial="initial" animate="animate" exit="exit">
              <BackBtn />
              <h2 style={{ fontSize: 26, fontWeight: 800, color: P, marginBottom: 8, letterSpacing: "-0.02em" }}>How do you typically eat through the day?</h2>
              <p style={{ fontSize: 15, color: S, marginBottom: 22, lineHeight: 1.6 }}>Meal frequency directly affects cortisol and blood sugar — both central to hormonal balance.</p>
              <div style={{ marginBottom: 24 }}>
                {MEALS.map((m) => <Option key={m.id} label={m.label} selected={mealsPerDay === m.id} onSelect={() => setMealsPerDay(m.id)} />)}
              </div>
              <Btn onClick={() => goTo(12)} disabled={!mealsPerDay}>Continue →</Btn>
            </motion.div>
          )}

          {/* ── 12 · Profile Building Loader ────────────────────────────────── */}
          {screen === 12 && (
            <motion.div key="s12" custom={dir} variants={variants} initial="initial" animate="animate" exit="exit"
              style={{ minHeight: "82vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
              <motion.div animate={{ scale: [1, 1.09, 1], rotate: [0, 6, -6, 0] }} transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                style={{ width: 84, height: 84, borderRadius: 22, background: `linear-gradient(135deg, ${PRI}, #756AD9)`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 32, boxShadow: "0 10px 40px rgba(83,74,183,0.4)" }}>
                <span style={{ fontSize: 42 }}>🌸</span>
              </motion.div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: P, marginBottom: 6, letterSpacing: "-0.02em" }}>
                {`Building your personalised profile${firstName ? `, ${firstName}` : ""}.`}
              </h2>
              <p style={{ fontSize: 15, color: S, marginBottom: 28 }}>This is where Flourish becomes yours.</p>
              <div style={{ height: 28, overflow: "hidden", marginBottom: 32 }}>
                <AnimatePresence mode="wait">
                  <motion.p key={loadingMsgIdx} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                    style={{ fontSize: 15, color: PRI, fontWeight: 600, margin: 0 }}>
                    {loadingMsgs[loadingMsgIdx]}
                  </motion.p>
                </AnimatePresence>
              </div>
              <div style={{ width: 260, background: "var(--border)", borderRadius: 6, height: 6, overflow: "hidden" }}>
                <motion.div style={{ height: "100%", background: `linear-gradient(90deg, ${PRI}, #756AD9)`, borderRadius: 6 }}
                  animate={{ width: `${loadingPct}%` }} transition={{ duration: 0.15 }} />
              </div>
            </motion.div>
          )}

          {/* ── 13 · Dark/light mode ─────────────────────────────────────────── */}
          {screen === 13 && (
            <motion.div key="s13" custom={dir} variants={variants} initial="initial" animate="animate" exit="exit">
              <BackBtn />
              <h2 style={{ fontSize: 26, fontWeight: 800, color: P, marginBottom: 8, letterSpacing: "-0.02em" }}>
                {`Almost there${firstName ? `, ${firstName}` : ""} — how would you like Flourish to look?`}
              </h2>
              <p style={{ fontSize: 15, color: S, marginBottom: 24 }}>You can change this anytime from your profile.</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 28 }}>
                {[
                  { dark: false, label: "Light mode", emoji: "☀️", bg: "#FFFFFF", textCol: "#1A1A24", cardBg: "#F8F7FF", border: "#E8E6FF" },
                  { dark: true, label: "Dark mode", emoji: "🌙", bg: "#141319", textCol: "#F1F0F8", cardBg: "#1E1C27", border: "#2E2C3E" },
                ].map(({ dark, label, emoji, bg, textCol, cardBg, border: bd }) => {
                  const sel = appearance === (dark ? "dark" : "light");
                  return (
                    <motion.button key={label} whileTap={{ scale: 0.95 }} onClick={() => pickTheme(dark)}
                      style={{ borderRadius: 18, border: `2px solid ${sel ? PRI : "var(--border)"}`, overflow: "hidden", cursor: "pointer", padding: 0, background: "none", boxShadow: sel ? "0 4px 20px rgba(83,74,183,0.3)" : "none", transition: "border-color 0.2s" }}>
                      <div style={{ background: bg, padding: "14px 12px 10px" }}>
                        <div style={{ background: cardBg, borderRadius: 10, padding: "8px 10px", marginBottom: 6, border: `1px solid ${bd}` }}>
                          <div style={{ width: 40, height: 6, borderRadius: 3, background: PRI, marginBottom: 5 }} />
                          <div style={{ width: 60, height: 4, borderRadius: 2, background: `${textCol}30` }} />
                        </div>
                        <div style={{ background: cardBg, borderRadius: 10, padding: "8px 10px", border: `1px solid ${bd}`, display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#639922" }} />
                          <div style={{ width: 40, height: 4, borderRadius: 2, background: `${textCol}30` }} />
                        </div>
                      </div>
                      <div style={{ background: sel ? `linear-gradient(135deg, ${PRI}, #756AD9)` : "var(--bg-card)", padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                        <span style={{ fontSize: 14 }}>{emoji}</span>
                        <p style={{ fontSize: 13, fontWeight: 700, color: sel ? "#fff" : P, margin: 0 }}>{label}</p>
                        {sel && <Check size={13} color="#fff" />}
                      </div>
                    </motion.button>
                  );
                })}
              </div>
              <Btn onClick={() => goTo(14)}>Continue →</Btn>
            </motion.div>
          )}

          {/* ── 14 · Education — hormonal ────────────────────────────────────── */}
          {screen === 14 && (
            <motion.div key="s14" custom={dir} variants={variants} initial="initial" animate="animate" exit="exit">
              <BackBtn />
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", paddingTop: 16 }}>
                <motion.div initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 280, damping: 18 }}
                  style={{ fontSize: 64, marginBottom: 24 }}>
                  💜
                </motion.div>
                <h2 style={{ fontSize: 24, fontWeight: 800, color: P, marginBottom: 18, letterSpacing: "-0.02em", lineHeight: 1.25 }}>Hormonal imbalance affects every system in your body.</h2>
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.25 } }}
                  style={{ background: "var(--bg-card)", borderRadius: 16, padding: "20px", marginBottom: 36, border: "1px solid var(--border)", textAlign: "left" }}>
                  <p style={{ fontSize: 15, color: S, lineHeight: 1.7, margin: "0 0 14px" }}>Food directly influences oestrogen, cortisol, progesterone, and insulin — the hormones driving your symptoms.</p>
                  <p style={{ fontSize: 15, color: S, lineHeight: 1.7, margin: "0 0 14px" }}>Most people never make this connection. They eat 'healthy' and still feel terrible. That's because what's healthy for one body can be actively harmful for another.</p>
                  <p style={{ fontSize: 15, color: S, lineHeight: 1.7, margin: 0 }}>Flourish makes the invisible visible. Every rating shows you exactly how a food interacts with your specific hormonal profile — not a generic nutrition label.</p>
                </motion.div>
                <Btn onClick={() => goTo(15)}>I feel seen →</Btn>
              </div>
            </motion.div>
          )}

          {/* ── 15 · Science / Trust ─────────────────────────────────────────── */}
          {screen === 15 && (
            <motion.div key="s15" custom={dir} variants={variants} initial="initial" animate="animate" exit="exit">
              <BackBtn />
              <div style={{ textAlign: "center", marginBottom: 28 }}>
                <h2 style={{ fontSize: 26, fontWeight: 800, color: P, marginBottom: 8, letterSpacing: "-0.02em" }}>Every score is built on real science.</h2>
                <p style={{ fontSize: 15, color: S, lineHeight: 1.6 }}>Not influencer advice. Not generic nutrition charts. Peer-reviewed research, applied to your exact conditions.</p>
              </div>
              {SCIENCE_CARDS.map((c, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0, transition: { delay: i * 0.1 } }}
                  style={{ background: "var(--bg-card)", borderRadius: 16, padding: "16px 18px", marginBottom: 12, border: "1px solid var(--border)", display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(83,74,183,0.09)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 22 }}>{c.emoji}</div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: P, margin: "0 0 4px" }}>{c.title}</p>
                    <p style={{ fontSize: 13, color: S, margin: 0, lineHeight: 1.5 }}>{c.desc}</p>
                  </div>
                </motion.div>
              ))}
              <div style={{ marginTop: 8 }}>
                <Btn onClick={() => goTo(16)}>I trust this →</Btn>
              </div>
            </motion.div>
          )}

          {/* ── 16 · Features ────────────────────────────────────────────────── */}
          {screen === 16 && (
            <motion.div key="s16" custom={dir} variants={variants} initial="initial" animate="animate" exit="exit">
              <BackBtn />
              <h2 style={{ fontSize: 26, fontWeight: 800, color: P, marginBottom: 6, letterSpacing: "-0.02em" }}>
                {`Here's what changes when you have Flourish${firstName ? `, ${firstName}` : ""}.`}
              </h2>
              <p style={{ fontSize: 15, color: S, marginBottom: 24 }}>Every feature below is personalised to your exact profile.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 28 }}>
                {FEATURES.map((f, i) => (
                  <motion.div key={f.name}
                    initial={{ opacity: 0, x: -20 }}
                    animate={featuresShown > i ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
                    transition={{ type: "spring", damping: 20, stiffness: 300 }}
                    style={{ background: "var(--bg-card)", borderRadius: 12, padding: "12px 14px", border: "1px solid var(--border)", display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <span style={{ fontSize: 22, flexShrink: 0 }}>{f.emoji}</span>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: P, margin: "0 0 2px" }}>{f.name}</p>
                      <p style={{ fontSize: 12, color: S, margin: 0, lineHeight: 1.4 }}>{f.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
              <Btn loading={saving} onClick={async () => {
                setSaving(true);
                try {
                  await updateProfile({
                    age: age ? parseInt(age, 10) : undefined,
                    conditions,
                    goals: [goal].filter(Boolean),
                    managing_duration: howLong,
                    onboarding_completed: true,
                    struggles,
                    diet_style: dietStyle,
                    goal,
                    meals_per_day: mealsPerDay,
                    appearance_preference: appearance,
                  });
                } catch (e) {
                  console.error("[Onboarding] completion save failed:", e);
                }
                onComplete();
              }}>Scan my first food free →</Btn>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
