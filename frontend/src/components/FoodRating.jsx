import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Share2, BookmarkPlus, Check, Lock, ChevronRight, Bell, X, Heart, ChevronDown } from "lucide-react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { ph } from "../lib/posthog";

const BODY_SYSTEMS = ["Hormones", "Gut", "Immune", "Thyroid", "Energy"];
const SYSTEM_COLORS = { Hormones: "#534AB7", Gut: "#639922", Immune: "#BA7517", Thyroid: "#756AD9", Energy: "#F59E0B" };

function NotificationSheet({ onAllow, onDismiss }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ position: "fixed", inset: 0, zIndex: 9500, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
      onClick={onDismiss}>
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0, transition: { type: "spring", damping: 28, stiffness: 280 } }}
        exit={{ y: "100%" }}
        onClick={e => e.stopPropagation()}
        style={{ background: "var(--bg-elevated)", borderRadius: "24px 24px 0 0", padding: "28px 24px 40px", maxWidth: 480, width: "100%", boxShadow: "0 -8px 40px rgba(83,74,183,0.15)" }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: "var(--border)", margin: "0 auto 24px" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: "linear-gradient(135deg, #534AB7, #756AD9)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 4px 16px rgba(83,74,183,0.25)" }}>
            <Bell size={24} color="#fff" />
          </div>
          <div>
            <p style={{ fontSize: 17, fontWeight: 800, color: "var(--text-primary)", margin: 0, letterSpacing: "-0.02em" }}>Stay on track with reminders</p>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "3px 0 0", lineHeight: 1.4 }}>Get a daily nudge to log your food and check in with how you feel.</p>
          </div>
        </div>
        <div style={{ background: "var(--bg-card)", borderRadius: 14, padding: "12px 16px", marginBottom: 20, border: "1px solid var(--border)" }}>
          <p style={{ fontSize: 13, color: "#534AB7", fontWeight: 600, margin: 0 }}>People who log daily see 3x more improvement in their symptoms.</p>
        </div>
        <motion.button
          data-testid="enable-notifications-btn"
          whileTap={{ scale: 0.96 }}
          onClick={onAllow}
          style={{ width: "100%", background: "linear-gradient(135deg, #534AB7, #756AD9)", color: "#fff", border: "none", borderRadius: 14, padding: "16px 24px", fontSize: 16, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 20px rgba(83,74,183,0.25)", marginBottom: 10, minHeight: 52 }}>
          Enable reminders
        </motion.button>
        <button
          data-testid="dismiss-notifications-btn"
          onClick={onDismiss}
          style={{ width: "100%", background: "none", border: "none", color: "var(--text-muted)", fontSize: 14, cursor: "pointer", padding: "8px 0", fontWeight: 500 }}>
          Not now
        </button>
      </motion.div>
    </motion.div>
  );
}

function getScoreColor(score) {
  if (score >= 70) return "#639922";
  if (score >= 40) return "#BA7517";
  return "#A32D2D";
}

function getVerdict(score) {
  if (score >= 70) return { label: "Excellent", color: "#639922", bg: "rgba(99,153,34,0.12)" };
  if (score >= 55) return { label: "Good", color: "#639922", bg: "rgba(99,153,34,0.08)" };
  if (score >= 40) return { label: "Moderate", color: "#BA7517", bg: "rgba(186,117,23,0.12)" };
  return { label: "Use caution", color: "#A32D2D", bg: "rgba(163,45,45,0.12)" };
}

function PixelatedScore({ score }) {
  // Show number with heavy blur = "pixelated but visible"
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <span style={{ fontSize: 18, fontWeight: 700, color: "#534AB7", filter: "blur(5px)", userSelect: "none" }}>{score}</span>
      <Lock size={13} color="#534AB7" />
    </div>
  );
}

function ScoreCircle({ score, size = 92 }) {
  const [displayed, setDisplayed] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const duration = 1100;
    const startTime = performance.now();
    const tick = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.round(eased * score));
      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        setDisplayed(score);
        setDone(true);
        if (navigator.vibrate) navigator.vibrate(50);
        try {
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          if (score >= 70) {
            [{ f: 523, t: 0 }, { f: 659, t: 0.18 }].forEach(({ f, t }) => {
              const o = ctx.createOscillator();
              const g = ctx.createGain();
              o.connect(g); g.connect(ctx.destination);
              o.frequency.value = f; g.gain.value = 0.18;
              o.start(ctx.currentTime + t);
              o.stop(ctx.currentTime + t + 0.14);
            });
          } else if (score < 40) {
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.connect(g); g.connect(ctx.destination);
            o.frequency.value = 220; g.gain.value = 0.15;
            o.start(); o.stop(ctx.currentTime + 0.2);
          } else {
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.connect(g); g.connect(ctx.destination);
            o.frequency.value = 392; g.gain.value = 0.15;
            o.start(); o.stop(ctx.currentTime + 0.15);
          }
        } catch (e) {}
      }
    };
    requestAnimationFrame(tick);
  }, [score]);

  const color = getScoreColor(displayed);
  const radius = (size / 2) - 7;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (displayed / 100) * circumference;

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="var(--border)" strokeWidth="4" />
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={color} strokeWidth="4"
          strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: "stroke 0.3s" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: size / 3.8, fontWeight: 800, color, letterSpacing: "-0.03em" }}>{displayed}</span>
      </div>
    </div>
  );
}

// Handles both 1-10 (new API) and 0-100 (legacy) dimension scores
function getDimScoreColor(score) {
  if (score == null || isNaN(score)) return "var(--text-muted)";
  // If score > 10, treat as 0-100 legacy
  if (score > 10) return getScoreColor(score);
  // 1-10: green 7-10, amber 4-6, red 1-3
  if (score >= 7) return "#639922";
  if (score >= 4) return "#BA7517";
  return "#A32D2D";
}

function DimensionCard({ label, score, summary, why, locked, pixelated, onUnlock }) {
  const [showWhy, setShowWhy] = useState(false);
  const safeScore = score ?? 0;
  const isNewScale = score != null && safeScore <= 10;
  const color = getDimScoreColor(score);
  const barPct = isNewScale ? (safeScore / 10) * 100 : safeScore;

  return (
    <div style={{ background: "var(--bg-card)", borderRadius: 14, padding: 14, border: "1px solid var(--border)", position: "relative", boxShadow: "0 2px 16px rgba(83,74,183,0.10)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.7, margin: 0 }}>{label}</p>
        {pixelated ? <PixelatedScore score={score} /> : locked ? (
          <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <span style={{ fontSize: 17, fontWeight: 700, filter: "blur(4px)", color: "#534AB7", userSelect: "none" }}>{score}</span>
            <Lock size={13} color="#534AB7" />
          </div>
        ) : (
          <span style={{ fontSize: 18, fontWeight: 800, color, letterSpacing: "-0.02em" }}>
            {score != null ? `${score}${isNewScale ? "/10" : ""}` : "—"}
          </span>
        )}
      </div>
      <div style={{ height: 5, background: "var(--border)", borderRadius: 3, marginBottom: 8, overflow: "hidden" }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: locked || pixelated ? "0%" : `${barPct}%` }}
          transition={{ type: "spring", stiffness: 180, damping: 22 }}
          style={{ height: "100%", background: color, borderRadius: 3 }}
        />
      </div>
      {locked || pixelated ? (
        <div>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 6px", filter: "blur(3px)", lineHeight: 1.4, userSelect: "none" }}>
            This dimension shows how this food is directly affecting your condition.
          </p>
          <button onClick={onUnlock} style={{ fontSize: 12, color: "#534AB7", fontWeight: 700, background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}>
            Unlock with Premium →
          </button>
        </div>
      ) : (
        <div>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0, lineHeight: 1.45 }}>{summary}</p>
          {why && (
            <div>
              <button
                onClick={() => { setShowWhy(v => !v); if (!showWhy) ph.ingredientDetailExpanded("", label); }}
                style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: "#534AB7", fontWeight: 700, background: "none", border: "none", cursor: "pointer", padding: "6px 0 0", marginTop: 2 }}>
                Why this score?
                <ChevronDown size={11} style={{ transform: showWhy ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
              </button>
              <AnimatePresence>
                {showWhy && (
                  <motion.p
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ fontSize: 11, color: color, margin: "4px 0 0", fontWeight: 600, lineHeight: 1.4, overflow: "hidden" }}>
                    {why}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function FoodRating({ rating, onBack, onOpenPaywall, onRateFood }) {
  const { user, isPremium, getHeaders, API } = useAuth();
  const [logged, setLogged] = useState(false);
  const [particles, setParticles] = useState([]);
  const [showNotifSheet, setShowNotifSheet] = useState(false);
  const [isFavourite, setIsFavourite] = useState(false);
  const [savingFav, setSavingFav] = useState(false);

  const foodName = rating.food_name || rating.name;

  useEffect(() => {
    // Check if already favourited
    axios.get(`${API}/favourites/check/${encodeURIComponent(foodName)}`, { headers: getHeaders(), withCredentials: true })
      .then(res => setIsFavourite(res.data.saved))
      .catch(() => {});
  }, [foodName]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggleFavourite = async () => {
    setSavingFav(true);
    try {
      const res = await axios.post(`${API}/favourites`, {
        food_name: foodName,
        rating_data: { overallScore: rating.overallScore, dimensions: rating.dimensions }
      }, { headers: getHeaders(), withCredentials: true });
      setIsFavourite(res.data.saved);
      ph.favouriteToggled(foodName, res.data.saved);
    } catch (e) {
      if (e.response?.status === 403) {
        onOpenPaywall && onOpenPaywall("favourites");
      } else {
        console.error("[Flourish] toggleFavourite error:", e);
      }
    } finally {
      setSavingFav(false);
    }
  };

  // Show notification prompt after first food rating completes (not on app open)
  useEffect(() => {
    const alreadyAsked = localStorage.getItem("notif_asked");
    if (!alreadyAsked && "Notification" in window && Notification.permission === "default") {
      const timer = setTimeout(() => setShowNotifSheet(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);
  const verdict = getVerdict(rating.overallScore);

  // Free: Overall score + Naturalness shown; Hormonal Impact, Inflammation, Gut Health locked
  // Free: show forYourCondition first 2 sentences, then blur
  const sentences = (rating.forYourCondition || "").split(/(?<=\.)\s+/);
  const freeInsight = sentences.slice(0, 2).join(" ");
  const hasMoreInsight = sentences.length > 2;

  const handleLog = async () => {
    if (logged) return;
    try {
      await axios.post(`${API}/diary/log`, {
        food_name: rating.food_name || rating.name,
        overall_score: rating.overallScore,
        verdict: rating.verdict,
        dimensions: rating.dimensions,
        flags: rating.flags,
        forYourCondition: rating.forYourCondition,
        alternatives: rating.alternatives,
        bodySystemsAffected: rating.bodySystemsAffected,
        product_image: rating.product_image,
        barcode: rating.barcode
      }, { headers: getHeaders(), withCredentials: true });
      setLogged(true);
      ph.ratingSaved(rating.food_name || rating.name, rating.overallScore);
      ph.diaryEntryAdded(rating.food_name || rating.name, rating.overallScore);
    } catch (e) {
      if (e.response?.status === 403) {
        ph.diaryLockedHit();
        onOpenPaywall && onOpenPaywall("diary");
      } else {
        ph.apiError("/diary/log", e.message, e.response?.status);
        console.error("[Flourish] handleLog error:", e);
      }
      return;
    }
    try {
      if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
      const newParticles = Array.from({ length: 14 }, (_, i) => ({
        id: i,
        angle: (i / 14) * 360,
        dist: 45 + Math.random() * 35
      }));
      setParticles(newParticles);
      setTimeout(() => setParticles([]), 700);
    } catch (e) {}
  };

  const handleShare = async () => {
    ph.ratingShared(foodName, rating.overallScore);
    const text = `I just rated ${foodName} on Flourish — score: ${rating.overallScore}/100.\n\n${rating.verdict}\n\nGet Flourish: https://theflourishapp.netlify.app`;
    if (navigator.share) {
      await navigator.share({ title: "Flourish Food Rating", text }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(text).catch(() => {});
    }
  };

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 30, stiffness: 280 }}
      style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", background: "var(--bg-elevated)", overflowY: "auto", WebkitOverflowScrolling: "touch", paddingBottom: 120 }}>

      {/* Header */}
      <div style={{ position: "sticky", top: 0, background: "var(--header-sticky)", backdropFilter: "blur(20px)", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 20, borderBottom: "1px solid var(--border)" }}>
        <motion.button whileTap={{ scale: 0.88 }} onClick={onBack}
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <ArrowLeft size={20} color="#534AB7" />
        </motion.button>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Food Rating</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <motion.button whileTap={{ scale: 0.88 }} onClick={handleToggleFavourite} disabled={savingFav}
            style={{ background: isFavourite ? "rgba(163,45,45,0.1)" : "var(--bg-card)", border: `1px solid ${isFavourite ? "rgba(163,45,45,0.3)" : "var(--border)"}`, borderRadius: 10, width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <Heart size={18} color={isFavourite ? "#A32D2D" : "#534AB7"} fill={isFavourite ? "#A32D2D" : "none"} />
          </motion.button>
          <motion.button whileTap={{ scale: 0.88 }} onClick={handleShare}
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <Share2 size={18} color="#534AB7" />
          </motion.button>
        </div>
      </div>

      <div style={{ padding: "20px 20px 0" }}>
        {/* Food image */}
        <div style={{ width: "100%", height: 180, borderRadius: 18, background: "var(--bg-card)", border: "1px solid var(--border)", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", boxShadow: "0 2px 16px rgba(83,74,183,0.10)" }}>
          {rating.product_image ? (
            <img src={rating.product_image} alt={rating.food_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { e.target.style.display = "none"; }} />
          ) : (
            <span style={{ fontSize: 88 }}>🍽️</span>
          )}
        </div>

        {/* Score + name */}
        <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 16 }}>
          <ScoreCircle score={rating.overallScore} size={92} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", margin: "0 0 8px", letterSpacing: "-0.02em", lineHeight: 1.2 }}>
              {foodName}
            </h1>
            <span style={{ background: verdict.bg, color: verdict.color, fontWeight: 700, padding: "5px 14px", borderRadius: 20, fontSize: 13 }}>
              {verdict.label}
            </span>
          </div>
        </div>

        {/* Verdict — always shown in full */}
        <p style={{ fontSize: 15, color: "var(--text-secondary)", lineHeight: 1.65, marginBottom: 20 }}>{rating.verdict}</p>

        {/* For your conditions */}
        <div style={{ borderLeft: "3px solid #534AB7", background: "var(--bg-card)", borderRadius: "0 14px 14px 0", padding: "16px 16px 16px 18px", marginBottom: 20, boxShadow: "0 2px 16px rgba(83,74,183,0.10)" }}>
          <p style={{ fontSize: 11, fontWeight: 800, color: "#534AB7", textTransform: "uppercase", letterSpacing: 1, margin: "0 0 8px" }}>For your conditions</p>
          {isPremium ? (
            <p style={{ fontSize: 14, color: "var(--text-primary)", lineHeight: 1.65, margin: 0 }}>{rating.forYourCondition}</p>
          ) : (
            <div>
              <p style={{ fontSize: 14, color: "var(--text-primary)", lineHeight: 1.65, margin: "0 0 10px" }}>{freeInsight}</p>
              {hasMoreInsight && (
                <div style={{ position: "relative" }}>
                  <p style={{ fontSize: 14, color: "var(--text-primary)", lineHeight: 1.65, margin: 0, filter: "blur(5px)", userSelect: "none", pointerEvents: "none" }}>
                    {sentences.slice(2).join(" ")} This is where the specific hormonal interactions become clear for your condition.
                  </p>
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <motion.button whileTap={{ scale: 0.95 }} onClick={() => onOpenPaywall("condition_insight")}
                      style={{ background: "#534AB7", color: "#fff", border: "none", borderRadius: 10, padding: "9px 18px", fontSize: 12, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 12px rgba(83,74,183,0.3)" }}>
                      This insight contains specific findings — unlock
                    </motion.button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Health dimensions */}
        <p style={{ fontSize: 17, fontWeight: 800, color: "var(--text-primary)", marginBottom: 12, letterSpacing: "-0.02em" }}>Health dimensions</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
          {/* Free: Overall score + Naturalness shown; Hormonal Impact, Inflammation, Gut Health locked */}
          <DimensionCard label="Naturalness" score={rating.dimensions?.naturalness?.score} summary={rating.dimensions?.naturalness?.summary} why={rating.dimensions?.naturalness?.why} locked={false} />
          <DimensionCard label="Hormonal Impact" score={rating.dimensions?.hormonalImpact?.score} summary={rating.dimensions?.hormonalImpact?.summary} why={rating.dimensions?.hormonalImpact?.why}
            locked={!isPremium} onUnlock={() => onOpenPaywall("hormonal")} />
          <DimensionCard label="Inflammation" score={rating.dimensions?.inflammation?.score} summary={rating.dimensions?.inflammation?.summary} why={rating.dimensions?.inflammation?.why}
            locked={!isPremium} onUnlock={() => onOpenPaywall("inflammation")} />
          <DimensionCard label="Gut Health" score={rating.dimensions?.gutHealth?.score} summary={rating.dimensions?.gutHealth?.summary} why={rating.dimensions?.gutHealth?.why}
            locked={!isPremium} onUnlock={() => onOpenPaywall("gut_health")} />
        </div>

        {/* Positives — always shown in full */}
        {rating.flags?.positives?.length > 0 && (
          <div style={{ background: "rgba(99,153,34,0.07)", borderRadius: 14, padding: 16, marginBottom: 12, border: "1px solid rgba(99,153,34,0.18)", boxShadow: "0 2px 16px rgba(83,74,183,0.05)" }}>
            <p style={{ fontSize: 13, fontWeight: 800, color: "#639922", margin: "0 0 10px" }}>Positives</p>
            {rating.flags.positives.map((p, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                <Check size={14} color="#639922" style={{ flexShrink: 0, marginTop: 2 }} />
                <p style={{ fontSize: 13, color: "var(--text-primary)", margin: 0, lineHeight: 1.45 }}>{p}</p>
              </div>
            ))}
          </div>
        )}

        {/* Watch out — free: first warning only, rest blurred */}
        {rating.flags?.warnings?.length > 0 && (
          <div style={{ background: "rgba(163,45,45,0.07)", borderRadius: 14, padding: 16, marginBottom: 12, border: "1px solid rgba(163,45,45,0.18)", boxShadow: "0 2px 16px rgba(83,74,183,0.05)" }}>
            <p style={{ fontSize: 13, fontWeight: 800, color: "#A32D2D", margin: "0 0 10px" }}>Watch out</p>
            {/* Always show first warning */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: "#A32D2D", flexShrink: 0, marginTop: 1 }}>⚠</span>
              <p style={{ fontSize: 13, color: "var(--text-primary)", margin: 0, lineHeight: 1.45 }}>{rating.flags.warnings[0]}</p>
            </div>
            {!isPremium && rating.flags.warnings.length > 1 && (
              <div style={{ position: "relative", marginTop: 6 }}>
                {rating.flags.warnings.slice(1).map((w, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, marginBottom: 4, filter: "blur(4px)", userSelect: "none", pointerEvents: "none" }}>
                    <span style={{ fontSize: 13, color: "#A32D2D" }}>⚠</span>
                    <p style={{ fontSize: 13, color: "var(--text-primary)", margin: 0 }}>{w}</p>
                  </div>
                ))}
                <div style={{ background: "rgba(255,255,255,0.8)", borderRadius: 8, padding: "6px 10px", marginTop: 4 }}>
                  <button onClick={() => onOpenPaywall("default")} style={{ fontSize: 12, color: "#A32D2D", fontWeight: 700, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                    See all warnings for your condition — unlock with free trial
                  </button>
                </div>
              </div>
            )}
            {isPremium && rating.flags.warnings.slice(1).map((w, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 13, color: "#A32D2D", flexShrink: 0, marginTop: 1 }}>⚠</span>
                <p style={{ fontSize: 13, color: "var(--text-primary)", margin: 0, lineHeight: 1.45 }}>{w}</p>
              </div>
            ))}
          </div>
        )}

        {/* Tips — free: first 2 shown */}
        {rating.flags?.tips?.length > 0 && (
          <div style={{ background: "rgba(186,117,23,0.07)", borderRadius: 14, padding: 16, marginBottom: 20, border: "1px solid rgba(186,117,23,0.18)" }}>
            <p style={{ fontSize: 13, fontWeight: 800, color: "#BA7517", margin: "0 0 10px" }}>Tips</p>
            {(isPremium ? rating.flags.tips : rating.flags.tips.slice(0, 2)).map((t, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#BA7517", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                  <span style={{ color: "#fff", fontSize: 9, fontWeight: 800 }}>i</span>
                </div>
                <p style={{ fontSize: 13, color: "var(--text-primary)", margin: 0, lineHeight: 1.45 }}>{t}</p>
              </div>
            ))}
          </div>
        )}

        {/* Body systems */}
        <p style={{ fontSize: 17, fontWeight: 800, color: "var(--text-primary)", marginBottom: 10, letterSpacing: "-0.02em" }}>Body systems affected</p>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 20 }}>
          {BODY_SYSTEMS.map(sys => {
            const affected = rating.bodySystemsAffected?.includes(sys);
            return (
              <div key={sys} style={{ padding: "6px 14px", borderRadius: 20, background: affected ? SYSTEM_COLORS[sys] + "18" : "var(--bg-card)", border: `1px solid ${affected ? SYSTEM_COLORS[sys] : "var(--border)"}`, transition: "all 0.3s" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: affected ? SYSTEM_COLORS[sys] : "#C4C3CE" }}>{sys}</span>
              </div>
            );
          })}
        </div>

        {/* Try These Instead — premium only; teaser for free users */}
        {(() => {
          if (!rating.alternatives?.length) return null;
          if (!isPremium) {
            // Blurred teaser for free users
            return (
              <div style={{ position: "relative", borderRadius: 16, marginBottom: 20, overflow: "hidden" }}>
                <div style={{ background: "rgba(163,45,45,0.06)", borderRadius: 16, padding: 16, border: "1px solid rgba(163,45,45,0.15)", filter: "blur(3px)", userSelect: "none", pointerEvents: "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <span style={{ fontSize: 18 }}>⚠️</span>
                    <p style={{ fontSize: 15, fontWeight: 800, color: "#A32D2D", margin: 0 }}>Try These Instead</p>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {rating.alternatives.slice(0, 2).map((alt, i) => (
                      <div key={i} style={{ background: "var(--bg-card)", borderRadius: 12, padding: "12px 14px", border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 22 }}>🥗</span>
                        <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{alt.name}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(var(--bg-elevated-rgb, 255,255,255),0.6)", backdropFilter: "blur(2px)", borderRadius: 16, padding: 16, textAlign: "center" }}>
                  <p style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)", margin: "0 0 4px" }}>Swap suggestions are Premium</p>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 14px", lineHeight: 1.4 }}>See personalised swaps tailored to your conditions.</p>
                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => onOpenPaywall("swaps")}
                    style={{ background: "#534AB7", color: "#fff", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 12px rgba(83,74,183,0.3)" }}>
                    Unlock swap suggestions
                  </motion.button>
                </div>
              </div>
            );
          }
          return (
            <div style={{ background: "rgba(163,45,45,0.06)", borderRadius: 16, padding: 16, marginBottom: 20, border: "1px solid rgba(163,45,45,0.15)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 18 }}>⚠️</span>
                <p style={{ fontSize: 15, fontWeight: 800, color: "#A32D2D", margin: 0 }}>Try These Instead</p>
              </div>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 12px", lineHeight: 1.5 }}>
                Based on your health profile, these alternatives may suit you better:
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {rating.alternatives.slice(0, 3).map((alt, i) => (
                  <motion.button
                    key={i}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => { ph.recommendationClicked(foodName, alt.name); if (onRateFood) onRateFood(alt.name); }}
                    style={{
                      background: "var(--bg-card)", borderRadius: 12, padding: "12px 14px", border: "1px solid var(--border)",
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      cursor: onRateFood ? "pointer" : "default", width: "100%", textAlign: "left",
                      boxShadow: "0 1px 8px rgba(83,74,183,0.06)"
                    }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 22 }}>🥗</span>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{alt.name}</p>
                        {onRateFood && (
                          <p style={{ fontSize: 11, color: "#534AB7", fontWeight: 600, margin: "2px 0 0" }}>Tap to rate this food →</p>
                        )}
                      </div>
                    </div>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: getScoreColor(alt.predictedScore), display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <span style={{ color: "#fff", fontWeight: 800, fontSize: 11 }}>{alt.predictedScore}</span>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Log button */}
        <div style={{ position: "relative", marginBottom: 12 }}>
          <motion.button
            data-testid="log-to-diary-btn"
            whileTap={{ scale: 0.94 }}
            onClick={handleLog}
            disabled={logged}
            style={{
              width: "100%", background: logged ? "#639922" : "#534AB7",
              color: "#fff", border: "none", borderRadius: 14, padding: "17px 24px",
              fontSize: 16, fontWeight: 800, cursor: logged ? "default" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              transition: "background 0.3s",
              boxShadow: logged ? "0 4px 16px rgba(99,153,34,0.25)" : "0 4px 20px rgba(83,74,183,0.25), inset 0 1px 0 rgba(255,255,255,0.15)",
              minHeight: 56
            }}>
            {logged ? <Check size={18} /> : <BookmarkPlus size={18} />}
            {logged ? "Logged to diary" : "Log to diary"}
          </motion.button>
          {particles.map(p => (
            <motion.div key={p.id}
              initial={{ opacity: 1, x: 0, y: 0 }}
              animate={{ opacity: 0, x: Math.cos(p.angle * Math.PI / 180) * p.dist, y: Math.sin(p.angle * Math.PI / 180) * p.dist }}
              transition={{ duration: 0.65 }}
              style={{ position: "absolute", top: "50%", left: "50%", width: 7, height: 7, borderRadius: "50%", background: "#639922", transform: "translate(-50%, -50%)", pointerEvents: "none" }}
            />
          ))}
        </div>

        {/* Upgrade banner */}
        {!isPremium && (
          <motion.div whileTap={{ scale: 0.97 }} onClick={() => onOpenPaywall("default")}
            style={{ background: "linear-gradient(135deg, #534AB7, #756AD9)", borderRadius: 14, padding: "14px 18px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", boxShadow: "0 4px 16px rgba(83,74,183,0.22)" }}>
            <div>
              <p style={{ color: "#fff", fontWeight: 800, fontSize: 14, margin: "0 0 2px" }}>Unlock the full analysis</p>
              <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 12, margin: 0 }}>Start your 3-day free trial</p>
            </div>
            <ChevronRight size={20} color="#fff" />
          </motion.div>
        )}

        <p style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center", lineHeight: 1.6, marginTop: 8 }}>
          AI powered nutritional guidance. Always consult your doctor or healthcare provider for medical advice.
        </p>
      </div>
      
      {/* Notification permission bottom sheet */}
      <AnimatePresence>
        {showNotifSheet && (
          <NotificationSheet
            onAllow={() => {
              localStorage.setItem("notif_asked", "1");
              setShowNotifSheet(false);
              Notification.requestPermission().catch(() => {});
            }}
            onDismiss={() => {
              localStorage.setItem("notif_asked", "1");
              setShowNotifSheet(false);
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
