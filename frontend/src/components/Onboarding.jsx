import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Check, Star } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
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

const MEALS = [
  { id: "omad", label: "1 meal (OMAD)" },
  { id: "two", label: "2 meals" },
  { id: "three", label: "3 meals" },
  { id: "four_plus", label: "4+ meals" },
  { id: "varies", label: "It varies" },
];

const FEATURES = [
  { emoji: "📷", name: "Barcode scanner", desc: "Scan any product instantly and get a personalised rating" },
  { emoji: "🔍", name: "Food search", desc: "Search any food by name and get your full analysis" },
  { emoji: "📊", name: "4-dimension ratings", desc: "Naturalness, Hormonal Impact, Inflammation, Gut Health — all scored for your conditions" },
  { emoji: "📓", name: "Food diary", desc: "Log everything you eat and track patterns over time" },
  { emoji: "💜", name: "Symptom tracker", desc: "Log symptoms and see how your food affects how you feel" },
  { emoji: "📈", name: "Weekly reports", desc: "AI-generated insights on your week of eating" },
  { emoji: "🕐", name: "Scan history", desc: "Every food you've ever rated, saved and organised" },
  { emoji: "❤️", name: "Saved foods", desc: "Bookmark your favourite safe foods" },
  { emoji: "🛒", name: "Shopping list", desc: "Build a hormone-friendly shopping list" },
  { emoji: "🔄", name: "Swap suggestions", desc: "Get personalised alternatives to foods that don't suit you" },
  { emoji: "🏆", name: "Badges & streaks", desc: "Stay motivated with rewards for consistency" },
  { emoji: "💡", name: "Daily tips", desc: "Personalised nutrition tips every day based on your conditions" },
  { emoji: "🌙", name: "Cycle tracking", desc: "Track your cycle and see how it affects your food responses" },
  { emoji: "🎁", name: "Referral rewards", desc: "Refer a friend and earn a free personalised 7-day meal plan" },
];

const VALIDATION = {
  pcos: {
    emoji: "💜",
    headline: "Living with PCOS is harder than most people know.",
    body: "Your body processes food differently to most people. What works for others — the standard diets, the generic advice — often doesn't work for you. That's not a failure. That's just PCOS. And it's why you deserve something built specifically for you.\n\nFlourish was designed to understand exactly how food interacts with insulin, testosterone, and inflammation for PCOS — so every rating you get is grounded in what your body actually needs.",
  },
  endometriosis: {
    emoji: "🌸",
    headline: "Endometriosis affects everything — including what you eat.",
    body: "Certain foods fuel inflammation and make your symptoms significantly worse. But nobody ever tells you which ones. You've probably spent years trying to figure it out on your own.\n\nFlourish rates every food specifically for endometriosis — flagging oestrogen disruptors, pro-inflammatory ingredients, and foods that calm the immune response. Finally, food intelligence that actually understands endo.",
  },
  thyroid: {
    emoji: "⚡",
    headline: "Your thyroid is sensitive to what you eat in ways most people never realise.",
    body: "Foods that are perfectly healthy for others can suppress your thyroid function, interfere with your medication, or deplete the very nutrients your thyroid depends on. It's not your fault for not knowing — it's incredibly complex.\n\nFlourish tracks iodine, selenium, goitrogens, and thyroid-interfering compounds in every food — so you eat with confidence, not guesswork.",
  },
  ibs: {
    emoji: "🌿",
    headline: "IBS makes every meal feel like a gamble.",
    body: "You've probably spent years trying to figure out your triggers — the anxiety before eating, the unpredictability, the exhaustion of second-guessing everything. That's an enormous mental load on top of an already difficult condition.\n\nFlourish scores every food for gut sensitivity, FODMAP content, fermentation potential, and microbiome impact — so you can eat without the fear of not knowing.",
  },
  autoimmune: {
    emoji: "🛡️",
    headline: "Your immune system is working overtime, and food matters more than you think.",
    body: "Certain foods trigger inflammatory responses that make autoimmune conditions significantly worse. But it's different for everyone — and generic elimination diets often remove foods you don't even react to while missing ones you do.\n\nFlourish personalises every rating to your exact condition, flagging immune triggers and anti-inflammatory foods specifically for your profile.",
  },
  hormonal_imbalance: {
    emoji: "⚖️",
    headline: "Hormonal imbalance affects every system in your body.",
    body: "Food directly impacts oestrogen, cortisol, and insulin. What you eat either supports your hormones or disrupts them — and the difference isn't always obvious from the outside.\n\nFlourish makes that visible for the first time. Every rating reflects how a food interacts with your specific hormonal landscape, not a generic nutrition label.",
  },
  not_sure: {
    emoji: "💛",
    headline: "Your body is trying to tell you something.",
    body: "You don't need a diagnosis to deserve personalised food intelligence. So many people are navigating unexplained symptoms, chronic fatigue, and a body that doesn't feel quite right — without ever getting clear answers from their GP.\n\nFlourish is built for exactly this. The more you use it, the more it learns about your patterns and helps you make sense of what's going on.",
  },
  other: {
    emoji: "✨",
    headline: "Your health journey is your own.",
    body: "Whatever you're managing — Flourish adapts to your unique situation. The more we know about your body, the more precise and helpful your food ratings become.\n\nEvery score you receive is built around your conditions, your goals, and your specific challenges. Not a generic number. Yours.",
  },
};

const SCIENCE_CARDS = {
  pcos: [
    { emoji: "🔬", title: "Hormonal nutrition research", desc: "Insulin resistance affects 70–80% of women with PCOS. Flourish flags foods that spike blood sugar and disrupt androgen balance, based on clinical endocrinology research." },
    { emoji: "🧬", title: "Anti-inflammatory science", desc: "Chronic low-grade inflammation is a core driver of PCOS symptoms. Every rating uses established inflammatory markers to score foods for your specific condition." },
    { emoji: "🎯", title: "Personalised to your body", desc: "Your conditions, goals, and struggles shape every single score. No generic advice, no one-size-fits-all ratings — just food intelligence built around you." },
  ],
  endometriosis: [
    { emoji: "🔬", title: "Hormonal nutrition research", desc: "Oestrogen dominance is linked to endometriosis progression. Flourish identifies phytoestrogens, xenoestrogens, and cruciferous compounds that help your body regulate oestrogen." },
    { emoji: "🧬", title: "Anti-inflammatory science", desc: "Prostaglandins drive endo pain. Foods high in omega-6 and trans fats increase prostaglandin production — Flourish flags these and highlights omega-3 rich alternatives." },
    { emoji: "🎯", title: "Personalised to your body", desc: "Your conditions, goals, and struggles shape every single score. No generic advice, no one-size-fits-all ratings — just food intelligence built around you." },
  ],
  thyroid: [
    { emoji: "🔬", title: "Hormonal nutrition research", desc: "Selenium, iodine, and zinc are essential for thyroid hormone conversion. Flourish tracks these micronutrients and flags foods that interfere with T3/T4 function." },
    { emoji: "🧬", title: "Anti-inflammatory science", desc: "Autoimmune thyroid conditions like Hashimoto's are worsened by gut inflammation. Flourish scores foods for intestinal permeability and immune modulation." },
    { emoji: "🎯", title: "Personalised to your body", desc: "Your conditions, goals, and struggles shape every single score. No generic advice, no one-size-fits-all ratings — just food intelligence built around you." },
  ],
  ibs: [
    { emoji: "🔬", title: "Hormonal nutrition research", desc: "The gut-brain axis means stress hormones directly affect IBS symptoms. Flourish incorporates both FODMAP research and cortisol-related gut sensitivity into every rating." },
    { emoji: "🧬", title: "Anti-inflammatory science", desc: "Intestinal permeability and microbiome diversity are central to IBS. Flourish scores probiotic-rich foods highly and flags fermentable fibres that may trigger symptoms for you." },
    { emoji: "🎯", title: "Personalised to your body", desc: "Your conditions, goals, and struggles shape every single score. No generic advice, no one-size-fits-all ratings — just food intelligence built around you." },
  ],
  default: [
    { emoji: "🔬", title: "Hormonal nutrition research", desc: "Insulin, oestrogen, and thyroid responses to food are grounded in peer-reviewed clinical studies. Flourish translates this research into actionable scores for your exact conditions." },
    { emoji: "🧬", title: "Anti-inflammatory science", desc: "Foods are rated using established inflammation and gut health research — the same science used in clinical nutrition, applied to every item you scan." },
    { emoji: "🎯", title: "Personalised to your body", desc: "Your conditions, goals, and struggles shape every single score. No generic advice, no one-size-fits-all ratings — just food intelligence built around you." },
  ],
};

const INSIGHTS = {
  pcos: ["Foods high in refined sugar spike your insulin — we'll flag these instantly.", "Certain dairy products disrupt testosterone balance — Flourish scores these accurately.", "Anti-inflammatory foods like salmon and flaxseeds can reduce PCOS symptoms — we highlight them."],
  endometriosis: ["Red meat and processed foods fuel oestrogen dominance — we'll flag every one.", "Cruciferous vegetables help your body clear excess oestrogen — marked green for you.", "Gluten can increase inflammation in many people with endo — we track this."],
  thyroid: ["Soy and cruciferous vegetables can interfere with thyroid medication — flagged for you.", "Selenium-rich foods like Brazil nuts directly support thyroid function — scored highly.", "Iodine plays a key role in thyroid health — Flourish tracks dietary iodine sources."],
  ibs: ["High-FODMAP foods are common IBS triggers — we'll flag every one of them.", "Probiotic-rich foods can calm your gut microbiome — scored highly for you.", "Certain artificial sweeteners cause major bloating — Flourish spots them in ingredients."],
  autoimmune: ["Nightshade vegetables can trigger flares in autoimmune conditions — flagged for you.", "Omega-3 rich foods actively reduce systemic inflammation — highlighted green.", "Processed seed oils drive inflammation — scored very poorly for your condition."],
  hormonal_imbalance: ["Sugar and refined carbs spike cortisol and disrupt hormone balance — flagged.", "Phytoestrogen-rich foods can help balance oestrogen naturally — we track these.", "Alcohol significantly disrupts hormonal signalling — scored accurately for you."],
  not_sure: ["We'll help you identify which foods may be triggering your symptoms.", "Every rating is personalised to your experience, not a generic score.", "As you log more, Flourish learns your patterns and improves your insights."],
  other: ["Every food gets a personalised score based on your health profile.", "We flag ingredients that may conflict with your specific health needs.", "Your ratings improve the more we know about your body."],
};

const LOADING_MSGS = [
  "Analysing your conditions...",
  "Calibrating your food ratings...",
  "Setting up your hormone tracker...",
  "Personalising your experience...",
  "Almost ready...",
];

// ── Main ───────────────────────────────────────────────────────────────────────

export default function Onboarding({ onComplete }) {
  const { user, updateProfile, logout } = useAuth();
  const { isDark, setTheme } = useTheme();

  const [screen, setScreen] = useState(1);
  const [dir, setDir] = useState(1);

  // Answers
  const [conditions, setConditions] = useState([]);
  const [howLong, setHowLong] = useState("");
  const [struggles, setStruggles] = useState([]);
  const [goal, setGoal] = useState("");
  const [dietStyle, setDietStyle] = useState([]);
  const [mealsPerDay, setMealsPerDay] = useState("");
  const [appearance, setAppearance] = useState(isDark ? "dark" : "light");

  // Loading screen (13)
  const [loadingPct, setLoadingPct] = useState(0);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);

  // Feature showcase (12) — stagger
  const [featuresShown, setFeaturesShown] = useState(0);

  const primaryCondition = conditions[0] || "other";
  const validation = VALIDATION[primaryCondition] || VALIDATION.other;
  const scienceCards = SCIENCE_CARDS[primaryCondition] || SCIENCE_CARDS.default;
  const insights = INSIGHTS[primaryCondition] || INSIGHTS.other;

  // Progress bar: screens 2–14 → 0% to 100% (13 steps, screen 1 and free-scan excluded)
  const showProgress = screen >= 2 && screen <= 14;
  const progress = showProgress ? ((screen - 2) / 12) * 100 : 0;

  const goTo = (s) => {
    setDir(s > screen ? 1 : -1);
    setScreen(s);
    ph.onboardingStepViewed(`step_${s}`, s);
  };

  // Appearance preference: apply live immediately
  const pickTheme = (dark) => {
    setAppearance(dark ? "dark" : "light");
    setTheme(dark);
  };

  // Feature showcase stagger on screen 12
  useEffect(() => {
    if (screen !== 12) return;
    setFeaturesShown(0);
    let i = 0;
    const t = setInterval(() => {
      i++;
      setFeaturesShown(i);
      if (i >= FEATURES.length) clearInterval(t);
    }, 140);
    return () => clearInterval(t);
  }, [screen]);

  // Loading screen (13): animate + save profile
  useEffect(() => {
    if (screen !== 13) return;
    const DURATION = 4000;
    const t0 = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - t0;
      setLoadingPct(Math.min((elapsed / DURATION) * 100, 98));
      setLoadingMsgIdx(Math.min(Math.floor((elapsed / DURATION) * LOADING_MSGS.length), LOADING_MSGS.length - 1));
    }, 120);
    updateProfile({
      conditions,
      goals: [goal].filter(Boolean),
      managing_duration: howLong,
      onboarding_completed: true,
      struggles,
      diet_style: dietStyle,
      goal,
      meals_per_day: mealsPerDay,
      appearance_preference: appearance,
    }).catch(e => console.error("[Onboarding] save failed:", e));
    const timer = setTimeout(() => {
      clearInterval(interval);
      setLoadingPct(100);
      setTimeout(() => goTo(14), 350);
    }, DURATION);
    return () => { clearInterval(interval); clearTimeout(timer); };
  }, [screen]); // eslint-disable-line react-hooks/exhaustive-deps

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

          {/* ── 1 · Welcome ─────────────────────────────────────────────────── */}
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
              <h1 style={{ fontSize: 40, fontWeight: 800, color: P, margin: "0 0 10px", letterSpacing: "-0.03em" }}>Flourish</h1>
              <p style={{ fontSize: 18, color: S, margin: "0 0 52px", lineHeight: 1.5 }}>Food intelligence built for your body.</p>
              <motion.button data-testid="onboarding-get-started-btn" whileTap={{ scale: 0.97 }} onClick={() => goTo(2)}
                style={{ width: "100%", background: `linear-gradient(135deg, ${PRI}, #756AD9)`, color: "#fff", border: "none", borderRadius: 14, padding: "20px 24px", fontSize: 18, fontWeight: 700, cursor: "pointer", boxShadow: "0 6px 30px rgba(83,74,183,0.4)", letterSpacing: "-0.01em" }}>
                Get started
              </motion.button>
              <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "18px 0 8px" }}>Free to try. No card needed to start.</p>
              <button onClick={logout}
                style={{ background: "none", border: "none", color: PRI, fontSize: 14, fontWeight: 600, cursor: "pointer", padding: "4px 0" }}>
                Already have an account? Log in
              </button>
            </motion.div>
          )}

          {/* ── 2 · Personalisation hook ─────────────────────────────────────── */}
          {screen === 2 && (
            <motion.div key="s2" custom={dir} variants={variants} initial="initial" animate="animate" exit="exit">
              <BackBtn />
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28 }}>
                <div style={{ width: 50, height: 50, borderRadius: 14, background: `linear-gradient(135deg, ${PRI}, #756AD9)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: 24 }}>✨</span>
                </div>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: PRI, textTransform: "uppercase", letterSpacing: 1, margin: 0 }}>Personalisation</p>
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

          {/* ── 3 · Conditions (multi-select) ────────────────────────────────── */}
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
                      onClick={() => { setConditions(prev => sel ? prev.filter(x => x !== c.id) : [...prev, c.id]); if (!sel) ph.conditionSelected(c.id); }}
                      style={{ padding: "16px 12px", borderRadius: 14, cursor: "pointer", textAlign: "center", border: `2px solid ${sel ? PRI : "var(--border)"}`, background: sel ? `linear-gradient(135deg, ${PRI}, #756AD9)` : "var(--bg-card)", boxShadow: sel ? "0 4px 16px rgba(83,74,183,0.25)" : "none", transition: "border-color 0.15s" }}>
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

          {/* ── 5 · Struggles (multi-select) ─────────────────────────────────── */}
          {screen === 5 && (
            <motion.div key="s5" custom={dir} variants={variants} initial="initial" animate="animate" exit="exit">
              <BackBtn />
              <h2 style={{ fontSize: 26, fontWeight: 800, color: P, marginBottom: 6, letterSpacing: "-0.02em" }}>What's your biggest challenge right now?</h2>
              <p style={{ fontSize: 15, color: S, marginBottom: 22 }}>Select all that apply</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
                {STRUGGLES.map((s) => { const sel = struggles.includes(s); return <Pill key={s} label={s} selected={sel} onToggle={() => setStruggles(prev => sel ? prev.filter(x => x !== s) : [...prev, s])} />; })}
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

          {/* ── 7 · Diet style (multi-select) ────────────────────────────────── */}
          {screen === 7 && (
            <motion.div key="s7" custom={dir} variants={variants} initial="initial" animate="animate" exit="exit">
              <BackBtn />
              <h2 style={{ fontSize: 26, fontWeight: 800, color: P, marginBottom: 6, letterSpacing: "-0.02em" }}>Do you follow any specific diet?</h2>
              <p style={{ fontSize: 15, color: S, marginBottom: 22 }}>Select all that apply</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
                {DIETS.map((d) => { const sel = dietStyle.includes(d); return <Pill key={d} label={d} selected={sel} onToggle={() => setDietStyle(prev => sel ? prev.filter(x => x !== d) : [...prev, d])} />; })}
              </div>
              <Btn onClick={() => goTo(8)}>Continue →</Btn>
            </motion.div>
          )}

          {/* ── 8 · Meals per day ────────────────────────────────────────────── */}
          {screen === 8 && (
            <motion.div key="s8" custom={dir} variants={variants} initial="initial" animate="animate" exit="exit">
              <BackBtn />
              <h2 style={{ fontSize: 26, fontWeight: 800, color: P, marginBottom: 6, letterSpacing: "-0.02em" }}>How many meals do you eat per day?</h2>
              <p style={{ fontSize: 15, color: S, marginBottom: 22 }}>Choose one</p>
              <div style={{ marginBottom: 24 }}>
                {MEALS.map((m) => <Option key={m.id} label={m.label} selected={mealsPerDay === m.id} onSelect={() => setMealsPerDay(m.id)} />)}
              </div>
              <Btn onClick={() => goTo(9)} disabled={!mealsPerDay}>Continue →</Btn>
            </motion.div>
          )}

          {/* ── 9 · Appearance ───────────────────────────────────────────────── */}
          {screen === 9 && (
            <motion.div key="s9" custom={dir} variants={variants} initial="initial" animate="animate" exit="exit">
              <BackBtn />
              <h2 style={{ fontSize: 26, fontWeight: 800, color: P, marginBottom: 8, letterSpacing: "-0.02em" }}>How would you like Flourish to look?</h2>
              <p style={{ fontSize: 15, color: S, marginBottom: 24 }}>Tap to preview — changes apply instantly.</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 28 }}>
                {[
                  { dark: false, label: "Light mode", emoji: "☀️", bg: "#FFFFFF", textCol: "#1A1A24", cardBg: "#F8F7FF", border: "#E8E6FF" },
                  { dark: true,  label: "Dark mode",  emoji: "🌙", bg: "#141319", textCol: "#F1F0F8", cardBg: "#1E1C27", border: "#2E2C3E" },
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
              <Btn onClick={() => goTo(10)}>Continue →</Btn>
            </motion.div>
          )}

          {/* ── 10 · Emotional validation (personalised to condition) ────────── */}
          {screen === 10 && (
            <motion.div key="s10" custom={dir} variants={variants} initial="initial" animate="animate" exit="exit">
              <BackBtn />
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", paddingTop: 16 }}>
                <motion.div initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 280, damping: 18 }}
                  style={{ fontSize: 64, marginBottom: 24 }}>
                  {validation.emoji}
                </motion.div>
                <h2 style={{ fontSize: 24, fontWeight: 800, color: P, marginBottom: 18, letterSpacing: "-0.02em", lineHeight: 1.25 }}>{validation.headline}</h2>
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.25 } }}
                  style={{ background: "var(--bg-card)", borderRadius: 16, padding: "20px", marginBottom: 36, border: "1px solid var(--border)", textAlign: "left" }}>
                  {validation.body.split("\n\n").map((para, i) => (
                    <p key={i} style={{ fontSize: 16, color: S, lineHeight: 1.7, margin: i > 0 ? "14px 0 0" : 0 }}>{para}</p>
                  ))}
                </motion.div>
                <Btn onClick={() => goTo(11)}>I feel seen →</Btn>
              </div>
            </motion.div>
          )}

          {/* ── 11 · Built on science (personalised to condition) ────────────── */}
          {screen === 11 && (
            <motion.div key="s11" custom={dir} variants={variants} initial="initial" animate="animate" exit="exit">
              <BackBtn />
              <div style={{ textAlign: "center", marginBottom: 28 }}>
                <h2 style={{ fontSize: 26, fontWeight: 800, color: P, marginBottom: 8, letterSpacing: "-0.02em" }}>Built on science you can trust.</h2>
                <p style={{ fontSize: 15, color: S, lineHeight: 1.6 }}>Every rating is grounded in peer-reviewed research and clinical nutrition principles — tried, tested, and proven.</p>
              </div>
              {scienceCards.map((c, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0, transition: { delay: i * 0.1 } }}
                  style={{ background: "var(--bg-card)", borderRadius: 16, padding: "16px 18px", marginBottom: 12, border: "1px solid var(--border)", display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(83,74,183,0.09)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 22 }}>{c.emoji}</div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: P, margin: "0 0 4px" }}>{c.title}</p>
                    <p style={{ fontSize: 13, color: S, margin: 0, lineHeight: 1.5 }}>{c.desc}</p>
                  </div>
                </motion.div>
              ))}
              <Btn onClick={() => goTo(12)}>Continue →</Btn>
            </motion.div>
          )}

          {/* ── 12 · Feature showcase (all features, animated) ───────────────── */}
          {screen === 12 && (
            <motion.div key="s12" custom={dir} variants={variants} initial="initial" animate="animate" exit="exit">
              <BackBtn />
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 26, fontWeight: 800, color: P, marginBottom: 6, letterSpacing: "-0.02em" }}>Here's everything Flourish does for you.</h2>
                <p style={{ fontSize: 15, color: S }}>All of this. Personalised to your conditions.</p>
              </div>
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
              <Btn onClick={() => goTo(13)}>Build my plan →</Btn>
            </motion.div>
          )}

          {/* ── 13 · Building your plan (loading) ─────────────────────────────── */}
          {screen === 13 && (
            <motion.div key="s13" custom={dir} variants={variants} initial="initial" animate="animate" exit="exit"
              style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "82vh", textAlign: "center" }}>
              <motion.div animate={{ scale: [1, 1.09, 1], rotate: [0, 6, -6, 0] }} transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                style={{ width: 84, height: 84, borderRadius: 22, background: `linear-gradient(135deg, ${PRI}, #756AD9)`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 32, boxShadow: "0 10px 40px rgba(83,74,183,0.4)" }}>
                <span style={{ fontSize: 42 }}>🌸</span>
              </motion.div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: P, marginBottom: 6, letterSpacing: "-0.02em" }}>Building your plan</h2>
              <div style={{ height: 28, overflow: "hidden", marginBottom: 32 }}>
                <AnimatePresence mode="wait">
                  <motion.p key={loadingMsgIdx} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                    style={{ fontSize: 15, color: PRI, fontWeight: 600, margin: 0 }}>
                    {LOADING_MSGS[loadingMsgIdx]}
                  </motion.p>
                </AnimatePresence>
              </div>
              <div style={{ width: 260, background: "var(--border)", borderRadius: 6, height: 6, overflow: "hidden" }}>
                <motion.div style={{ height: "100%", background: `linear-gradient(90deg, ${PRI}, #756AD9)`, borderRadius: 6 }}
                  animate={{ width: `${loadingPct}%` }} transition={{ duration: 0.15 }} />
              </div>
            </motion.div>
          )}

          {/* ── 14 · Plan reveal (name + conditions + goal + 3 tailored insights) */}
          {screen === 14 && (
            <motion.div key="s14" custom={dir} variants={variants} initial="initial" animate="animate" exit="exit">
              <div style={{ textAlign: "center", marginBottom: 22, paddingTop: 8 }}>
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 17 }}
                  style={{ width: 58, height: 58, borderRadius: "50%", background: "linear-gradient(135deg, #639922, #7ab82a)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", boxShadow: "0 4px 20px rgba(99,153,34,0.3)" }}>
                  <Check size={26} color="#fff" />
                </motion.div>
                <h2 style={{ fontSize: 26, fontWeight: 800, color: P, marginBottom: 6, letterSpacing: "-0.02em" }}>
                  {user?.name ? `${user.name}, your plan is ready.` : "Your plan is ready."}
                </h2>
                <p style={{ fontSize: 14, color: S, lineHeight: 1.55, margin: 0 }}>
                  Here's what we built for you, based on what you told us.
                </p>
              </div>

              {/* Personalised summary card */}
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.1 } }}
                style={{ background: "rgba(83,74,183,0.06)", borderRadius: 16, padding: "16px 18px", marginBottom: 18, border: "1px solid rgba(83,74,183,0.18)" }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
                  {user?.name && (
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 700, color: PRI, textTransform: "uppercase", letterSpacing: 0.8, margin: 0 }}>Name</p>
                      <p style={{ fontSize: 14, fontWeight: 700, color: P, margin: "2px 0 0" }}>{user.name}</p>
                    </div>
                  )}
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: PRI, textTransform: "uppercase", letterSpacing: 0.8, margin: 0 }}>Conditions</p>
                    <p style={{ fontSize: 14, fontWeight: 700, color: P, margin: "2px 0 0" }}>
                      {conditions.map(c => CONDITIONS.find(x => x.id === c)?.label || c).join(", ")}
                    </p>
                  </div>
                  {goal && (
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 700, color: PRI, textTransform: "uppercase", letterSpacing: 0.8, margin: 0 }}>Goal</p>
                      <p style={{ fontSize: 14, fontWeight: 700, color: P, margin: "2px 0 0" }}>{GOALS.find(g => g.id === goal)?.label || goal}</p>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* 3 tailored insights for the user's exact condition */}
              <div style={{ marginBottom: 8 }}>
                <p style={{ fontSize: 12, fontWeight: 800, color: S, textTransform: "uppercase", letterSpacing: 1, margin: "0 0 12px" }}>3 things Flourish will track for you</p>
                {insights.map((insight, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0, transition: { delay: 0.18 + i * 0.15 } }}
                    style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 10, padding: "14px 16px", background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border)" }}>
                    <div style={{ width: 26, height: 26, borderRadius: "50%", background: `linear-gradient(135deg, ${PRI}, #756AD9)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                      <Star size={11} color="#fff" fill="#fff" />
                    </div>
                    <p style={{ fontSize: 14, color: P, margin: 0, lineHeight: 1.55 }}>{insight}</p>
                  </motion.div>
                ))}
              </div>

              <div style={{ marginTop: 20 }}>
                <Btn onClick={onComplete}>Let's rate your first food →</Btn>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
