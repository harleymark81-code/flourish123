import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check } from "lucide-react";
import { useAuth } from "../context/AuthContext";

// Option sets mirror the onboarding personalisation questions. Kept local so
// the main onboarding flow is never touched by edits to this screen.
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

const PRI = "#534AB7";
const P = "var(--text-primary)";
const S = "var(--text-secondary)";

const eqArr = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

export default function EditProfile({ onClose }) {
  const { user, updateProfile } = useAuth();

  // Pre-fill from the user's existing onboarding answers.
  const initial = useMemo(() => ({
    age: user?.age != null ? String(user.age) : "",
    conditions: user?.conditions || [],
    howLong: user?.managing_duration || "",
    struggles: user?.struggles || [],
    goal: user?.goal || user?.goals?.[0] || "",
    dietStyle: user?.diet_style || [],
    mealsPerDay: user?.meals_per_day || "",
  }), [user]);

  const [age, setAge] = useState(initial.age);
  const [conditions, setConditions] = useState(initial.conditions);
  const [howLong, setHowLong] = useState(initial.howLong);
  const [struggles, setStruggles] = useState(initial.struggles);
  const [goal, setGoal] = useState(initial.goal);
  const [dietStyle, setDietStyle] = useState(initial.dietStyle);
  const [mealsPerDay, setMealsPerDay] = useState(initial.mealsPerDay);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [showDiscard, setShowDiscard] = useState(false);

  const ageNum = parseInt(age, 10);
  const ageValid = age === "" || (!isNaN(ageNum) && ageNum >= 16 && ageNum <= 80);

  const hasChanges =
    age !== initial.age ||
    !eqArr(conditions, initial.conditions) ||
    howLong !== initial.howLong ||
    !eqArr(struggles, initial.struggles) ||
    goal !== initial.goal ||
    !eqArr(dietStyle, initial.dietStyle) ||
    mealsPerDay !== initial.mealsPerDay;

  const canSave = conditions.length > 0 && ageValid && !saving;

  // X / close — discard unsaved changes and return to Profile. Confirm only
  // when the user has actually made changes.
  const handleClose = () => {
    if (hasChanges) setShowDiscard(true);
    else onClose();
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setSaveError("");
    try {
      // Send the edited personalisation fields. Preserve the fields the
      // backend would otherwise reset (it overwrites these unconditionally),
      // so editing here never wipes data set elsewhere. onboarding_completed
      // is intentionally NOT sent — the user stays fully onboarded.
      await updateProfile({
        age: age ? parseInt(age, 10) : undefined,
        conditions,
        goals: [goal].filter(Boolean),
        goal,
        managing_duration: howLong,
        struggles,
        diet_style: dietStyle,
        meals_per_day: mealsPerDay,
        appearance_preference: user?.appearance_preference,
        food_challenge: user?.food_challenge || "",
        severity: user?.severity || "",
        medications: user?.medications || "",
        cycle_tracking: user?.cycle_tracking || false,
        current_symptoms: user?.current_symptoms,
      });
      onClose();
    } catch (e) {
      console.error("[EditProfile] save failed:", e);
      setSaveError("Couldn't save your changes. Please try again.");
      setSaving(false);
    }
  };

  const toggle = (setter) => (item) =>
    setter((prev) => (prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]));

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

  const Section = ({ title, subtitle, children }) => (
    <div style={{ marginBottom: 28 }}>
      <h3 style={{ fontSize: 17, fontWeight: 800, color: P, margin: "0 0 4px", letterSpacing: "-0.01em" }}>{title}</h3>
      {subtitle && <p style={{ fontSize: 13, color: S, margin: "0 0 14px", lineHeight: 1.5 }}>{subtitle}</p>}
      {children}
    </div>
  );

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", background: "var(--bg-app)", display: "flex", flexDirection: "column" }}>

      {/* Top bar — X (top left) + title */}
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: "var(--bg-app)", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", paddingTop: "calc(14px + env(safe-area-inset-top, 0px))" }}>
        <motion.button whileTap={{ scale: 0.9 }} onClick={handleClose} aria-label="Close"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
          <X size={18} color="var(--text-secondary)" />
        </motion.button>
        <h1 style={{ fontSize: 18, fontWeight: 800, color: P, margin: 0, letterSpacing: "-0.01em" }}>Edit My Personalisation</h1>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "24px 20px 24px" }}>
        <p style={{ fontSize: 14, color: S, lineHeight: 1.6, margin: "0 0 28px" }}>
          Update your answers below. Your food scores, insights, and suggestions recalibrate to match.
        </p>

        <Section title="How old are you?" subtitle="Helps calibrate scores to where your body is right now.">
          <input
            inputMode="numeric"
            pattern="[0-9]*"
            value={age}
            onChange={(e) => setAge(e.target.value.replace(/\D/g, "").slice(0, 2))}
            placeholder="Your age"
            style={{
              background: "var(--bg-card)", border: `2px solid ${age && !ageValid ? "#e05555" : "var(--border)"}`,
              borderRadius: 14, padding: "14px 18px", fontSize: 18, fontWeight: 700,
              color: "var(--text-primary)", outline: "none", width: "100%", boxSizing: "border-box",
            }}
          />
          {age && !ageValid && (
            <p style={{ fontSize: 13, color: "#e05555", margin: "8px 0 0" }}>Please enter an age between 16 and 80.</p>
          )}
        </Section>

        <Section title="What are you living with?" subtitle="Select everything that applies.">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {CONDITIONS.map((c) => {
              const sel = conditions.includes(c.id);
              return (
                <motion.button key={c.id} whileTap={{ scale: 0.93 }} onClick={() => toggle(setConditions)(c.id)}
                  style={{ padding: "16px 12px", borderRadius: 14, cursor: "pointer", textAlign: "center", border: `2px solid ${sel ? PRI : "var(--border)"}`, background: sel ? `linear-gradient(135deg, ${PRI}, #756AD9)` : "var(--bg-card)", boxShadow: sel ? "0 4px 16px rgba(83,74,183,0.25)" : "none", transition: "border-color 0.15s" }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: sel ? "#fff" : P, margin: 0, lineHeight: 1.35 }}>{c.label}</p>
                </motion.button>
              );
            })}
          </div>
          {conditions.length === 0 && (
            <p style={{ fontSize: 13, color: "#e05555", margin: "10px 0 0" }}>Select at least one.</p>
          )}
        </Section>

        <Section title="How long has this been part of your life?">
          {DURATIONS.map((d) => <Option key={d} label={d} selected={howLong === d} onSelect={() => setHowLong(d)} />)}
        </Section>

        <Section title="What does this feel like, day to day?" subtitle="Select everything that's affecting you.">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {STRUGGLES.map((s) => (
              <Pill key={s} label={s} selected={struggles.includes(s)} onToggle={() => toggle(setStruggles)(s)} />
            ))}
          </div>
        </Section>

        <Section title="What's your biggest goal?">
          {GOALS.map((g) => <Option key={g.id} label={g.label} emoji={g.emoji} selected={goal === g.id} onSelect={() => setGoal(g.id)} />)}
        </Section>

        <Section title="Do you follow a specific way of eating?">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {DIETS.map((d) => (
              <Pill key={d} label={d} selected={dietStyle.includes(d)} onToggle={() => toggle(setDietStyle)(d)} />
            ))}
          </div>
        </Section>

        <Section title="How do you typically eat through the day?">
          {MEALS.map((m) => <Option key={m.id} label={m.label} selected={mealsPerDay === m.id} onSelect={() => setMealsPerDay(m.id)} />)}
        </Section>

        {saveError && (
          <p style={{ fontSize: 14, color: "#e05555", margin: "0 0 12px", textAlign: "center" }}>{saveError}</p>
        )}
      </div>

      {/* Sticky Save bar */}
      <div style={{ position: "sticky", bottom: 0, background: "var(--bg-app)", borderTop: "1px solid var(--border)", padding: "14px 20px", paddingBottom: "calc(14px + env(safe-area-inset-bottom, 0px))" }}>
        <motion.button whileTap={{ scale: canSave ? 0.97 : 1 }} onClick={handleSave} disabled={!canSave}
          style={{
            width: "100%", border: "none", borderRadius: 14, padding: "18px 24px", fontSize: 16, fontWeight: 700,
            cursor: canSave ? "pointer" : "not-allowed", minHeight: 56, letterSpacing: "-0.01em",
            background: canSave ? `linear-gradient(135deg, ${PRI}, #756AD9)` : "var(--border)",
            color: canSave ? "#fff" : "var(--text-muted)",
            boxShadow: canSave ? "0 4px 20px rgba(83,74,183,0.30)" : "none",
          }}>
          {saving ? "Saving..." : "Save changes"}
        </motion.button>
      </div>

      {/* Discard confirmation */}
      <AnimatePresence>
        {showDiscard && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowDiscard(false)}
            style={{ position: "fixed", inset: 0, zIndex: 9500, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
            <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              style={{ background: "var(--bg-card)", borderRadius: 18, padding: 24, width: "100%", maxWidth: 340, border: "1px solid var(--border)" }}>
              <h3 style={{ fontSize: 19, fontWeight: 800, color: P, margin: "0 0 8px", letterSpacing: "-0.01em" }}>Discard changes?</h3>
              <p style={{ fontSize: 14, color: S, lineHeight: 1.5, margin: "0 0 20px" }}>Your edits won't be saved.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <motion.button whileTap={{ scale: 0.97 }} onClick={onClose}
                  style={{ width: "100%", border: "none", borderRadius: 12, padding: "14px", fontSize: 15, fontWeight: 700, cursor: "pointer", background: "#e05555", color: "#fff" }}>
                  Discard
                </motion.button>
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowDiscard(false)}
                  style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 12, padding: "14px", fontSize: 15, fontWeight: 700, cursor: "pointer", background: "var(--bg-card)", color: S }}>
                  Keep editing
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
