import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Share2, BookmarkPlus, Check, Lock, ChevronRight, Bell, X } from "lucide-react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";

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
        style={{ background: "#fff", borderRadius: "24px 24px 0 0", padding: "28px 24px 40px", maxWidth: 480, width: "100%", boxShadow: "0 -8px 40px rgba(83,74,183,0.15)" }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: "#E8E6FF", margin: "0 auto 24px" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: "linear-gradient(135deg, #534AB7, #756AD9)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 4px 16px rgba(83,74,183,0.25)" }}>
            <Bell size={24} color="#fff" />
          </div>
          <div>
            <p style={{ fontSize: 17, fontWeight: 800, color: "#1A1A24", margin: 0, letterSpacing: "-0.02em" }}>Stay on track with reminders</p>
            <p style={{ fontSize: 13, color: "#6B6A7C", margin: "3px 0 0", lineHeight: 1.4 }}>Get a daily nudge to log your food and check in with how you feel.</p>
          </div>
        </div>
        <div style={{ background: "#F8F7FF", borderRadius: 14, padding: "12px 16px", marginBottom: 20, border: "1px solid #E8E6FF" }}>
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
          style={{ width: "100%", background: "none", border: "none", color: "#A09FAD", fontSize: 14, cursor: "pointer", padding: "8px 0", fontWeight: 500 }}>
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
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="#E8E6FF" strokeWidth="4" />
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

function DimensionCard({ label, score, summary, locked, pixelated, onUnlock }) {
  const color = getScoreColor(score);
  return (
    <div style={{ background: "#F8F7FF", borderRadius: 14, padding: 14, border: "1px solid #E8E6FF", position: "relative", boxShadow: "0 2px 16px rgba(83,74,183,0.10)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6A7C", textTransform: "uppercase", letterSpacing: 0.7, margin: 0 }}>{label}</p>
        {pixelated ? <PixelatedScore score={score} /> : locked ? (
          <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <span style={{ fontSize: 17, fontWeight: 700, filter: "blur(4px)", color: "#534AB7", userSelect: "none" }}>{score}</span>
            <Lock size={13} color="#534AB7" />
          </div>
        ) : (
          <span style={{ fontSize: 18, fontWeight: 800, color, letterSpacing: "-0.02em" }}>{score}</span>
        )}
      </div>
      <div style={{ height: 5, background: "#E8E6FF", borderRadius: 3, marginBottom: 8, overflow: "hidden" }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: locked || pixelated ? "0%" : `${score}%` }}
          transition={{ type: "spring", stiffness: 180, damping: 22 }}
          style={{ height: "100%", background: color, borderRadius: 3 }}
        />
      </div>
      {locked || pixelated ? (
        <div>
          <p style={{ fontSize: 12, color: "#6B6A7C", margin: "0 0 6px", filter: "blur(3px)", lineHeight: 1.4, userSelect: "none" }}>
            This dimension shows how this food is directly affecting your condition.
          </p>
          <button onClick={onUnlock} style={{ fontSize: 12, color: "#534AB7", fontWeight: 700, background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}>
            Tap to unlock your full breakdown
          </button>
        </div>
      ) : (
        <p style={{ fontSize: 12, color: "#6B6A7C", margin: 0, lineHeight: 1.45 }}>{summary}</p>
      )}
    </div>
  );
}

export default function FoodRating({ rating, onBack, onOpenPaywall }) {
  const { user, getHeaders, API } = useAuth();
  const [logged, setLogged] = useState(false);
  const [particles, setParticles] = useState([]);
  const [showNotifSheet, setShowNotifSheet] = useState(false);
  const isPremium = user?.is_premium;

  // Show notification prompt after first food rating completes (not on app open)
  useEffect(() => {
    const alreadyAsked = localStorage.getItem("notif_asked");
    if (!alreadyAsked && "Notification" in window && Notification.permission === "default") {
      const timer = setTimeout(() => setShowNotifSheet(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);
  const verdict = getVerdict(rating.overallScore);

  // Free: show naturalness + hormonal fully; inflammation + gut = pixelated
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
    const text = `I just rated ${rating.food_name || rating.name} on Flourish — score: ${rating.overallScore}/100.\n\n${rating.verdict}\n\nGet Flourish: https://theflourishapp.netlify.app`;
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
      style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", background: "#fff", overflowY: "auto", WebkitOverflowScrolling: "touch", paddingBottom: 120 }}>

      {/* Header */}
      <div style={{ position: "sticky", top: 0, background: "rgba(255,255,255,0.92)", backdropFilter: "blur(20px)", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 20, borderBottom: "1px solid #E8E6FF" }}>
        <motion.button whileTap={{ scale: 0.88 }} onClick={onBack}
          style={{ background: "#F8F7FF", border: "1px solid #E8E6FF", borderRadius: 10, width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <ArrowLeft size={20} color="#534AB7" />
        </motion.button>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1A1A24", margin: 0 }}>Food Rating</h2>
        <motion.button whileTap={{ scale: 0.88 }} onClick={handleShare}
          style={{ background: "#F8F7FF", border: "1px solid #E8E6FF", borderRadius: 10, width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <Share2 size={18} color="#534AB7" />
        </motion.button>
      </div>

      <div style={{ padding: "20px 20px 0" }}>
        {/* Food image */}
        <div style={{ width: "100%", height: 180, borderRadius: 18, background: "#F8F7FF", border: "1px solid #E8E6FF", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", boxShadow: "0 2px 16px rgba(83,74,183,0.10)" }}>
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
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1A1A24", margin: "0 0 8px", letterSpacing: "-0.02em", lineHeight: 1.2 }}>
              {rating.food_name || rating.name}
            </h1>
            <span style={{ background: verdict.bg, color: verdict.color, fontWeight: 700, padding: "5px 14px", borderRadius: 20, fontSize: 13 }}>
              {verdict.label}
            </span>
          </div>
        </div>

        {/* Verdict — always shown in full */}
        <p style={{ fontSize: 15, color: "#6B6A7C", lineHeight: 1.65, marginBottom: 20 }}>{rating.verdict}</p>

        {/* For your conditions */}
        <div style={{ borderLeft: "3px solid #534AB7", background: "#F8F7FF", borderRadius: "0 14px 14px 0", padding: "16px 16px 16px 18px", marginBottom: 20, boxShadow: "0 2px 16px rgba(83,74,183,0.10)" }}>
          <p style={{ fontSize: 11, fontWeight: 800, color: "#534AB7", textTransform: "uppercase", letterSpacing: 1, margin: "0 0 8px" }}>For your conditions</p>
          {isPremium ? (
            <p style={{ fontSize: 14, color: "#1A1A24", lineHeight: 1.65, margin: 0 }}>{rating.forYourCondition}</p>
          ) : (
            <div>
              <p style={{ fontSize: 14, color: "#1A1A24", lineHeight: 1.65, margin: "0 0 10px" }}>{freeInsight}</p>
              {hasMoreInsight && (
                <div style={{ position: "relative" }}>
                  <p style={{ fontSize: 14, color: "#1A1A24", lineHeight: 1.65, margin: 0, filter: "blur(5px)", userSelect: "none", pointerEvents: "none" }}>
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
        <p style={{ fontSize: 17, fontWeight: 800, color: "#1A1A24", marginBottom: 12, letterSpacing: "-0.02em" }}>Health dimensions</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
          {/* Free: naturalness + hormonal in full */}
          <DimensionCard label="Naturalness" score={rating.dimensions?.naturalness?.score} summary={rating.dimensions?.naturalness?.summary} locked={false} />
          <DimensionCard label="Hormonal" score={rating.dimensions?.hormonalImpact?.score} summary={rating.dimensions?.hormonalImpact?.summary} locked={false} />
          {/* Free: inflammation + gut = pixelated */}
          <DimensionCard label="Inflammation" score={rating.dimensions?.inflammation?.score} summary={rating.dimensions?.inflammation?.summary}
            locked={false} pixelated={!isPremium} onUnlock={() => onOpenPaywall("inflammation")} />
          <DimensionCard label="Gut Health" score={rating.dimensions?.gutHealth?.score} summary={rating.dimensions?.gutHealth?.summary}
            locked={false} pixelated={!isPremium} onUnlock={() => onOpenPaywall("gut_health")} />
        </div>

        {/* Positives — always shown in full */}
        {rating.flags?.positives?.length > 0 && (
          <div style={{ background: "rgba(99,153,34,0.07)", borderRadius: 14, padding: 16, marginBottom: 12, border: "1px solid rgba(99,153,34,0.18)", boxShadow: "0 2px 16px rgba(83,74,183,0.05)" }}>
            <p style={{ fontSize: 13, fontWeight: 800, color: "#639922", margin: "0 0 10px" }}>Positives</p>
            {rating.flags.positives.map((p, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                <Check size={14} color="#639922" style={{ flexShrink: 0, marginTop: 2 }} />
                <p style={{ fontSize: 13, color: "#1A1A24", margin: 0, lineHeight: 1.45 }}>{p}</p>
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
              <p style={{ fontSize: 13, color: "#1A1A24", margin: 0, lineHeight: 1.45 }}>{rating.flags.warnings[0]}</p>
            </div>
            {!isPremium && rating.flags.warnings.length > 1 && (
              <div style={{ position: "relative", marginTop: 6 }}>
                {rating.flags.warnings.slice(1).map((w, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, marginBottom: 4, filter: "blur(4px)", userSelect: "none", pointerEvents: "none" }}>
                    <span style={{ fontSize: 13, color: "#A32D2D" }}>⚠</span>
                    <p style={{ fontSize: 13, color: "#1A1A24", margin: 0 }}>{w}</p>
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
                <p style={{ fontSize: 13, color: "#1A1A24", margin: 0, lineHeight: 1.45 }}>{w}</p>
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
                <p style={{ fontSize: 13, color: "#1A1A24", margin: 0, lineHeight: 1.45 }}>{t}</p>
              </div>
            ))}
          </div>
        )}

        {/* Body systems */}
        <p style={{ fontSize: 17, fontWeight: 800, color: "#1A1A24", marginBottom: 10, letterSpacing: "-0.02em" }}>Body systems affected</p>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 20 }}>
          {BODY_SYSTEMS.map(sys => {
            const affected = rating.bodySystemsAffected?.includes(sys);
            return (
              <div key={sys} style={{ padding: "6px 14px", borderRadius: 20, background: affected ? SYSTEM_COLORS[sys] + "18" : "#F8F7FF", border: `1px solid ${affected ? SYSTEM_COLORS[sys] : "#E8E6FF"}`, transition: "all 0.3s" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: affected ? SYSTEM_COLORS[sys] : "#C4C3CE" }}>{sys}</span>
              </div>
            );
          })}
        </div>

        {/* Alternatives */}
        <p style={{ fontSize: 17, fontWeight: 800, color: "#1A1A24", marginBottom: 10, letterSpacing: "-0.02em" }}>Better alternatives for you</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
          {/* First alternative always shown in full */}
          {rating.alternatives?.[0] && (
            <div style={{ background: "#F8F7FF", borderRadius: 14, padding: "13px 16px", border: "1px solid #E8E6FF", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 2px 16px rgba(83,74,183,0.10)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 26 }}>🥗</span>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#1A1A24", margin: 0 }}>{rating.alternatives[0].name}</p>
              </div>
              <div style={{ width: 38, height: 38, borderRadius: "50%", background: getScoreColor(rating.alternatives[0].predictedScore), display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ color: "#fff", fontWeight: 800, fontSize: 12 }}>{rating.alternatives[0].predictedScore}</span>
              </div>
            </div>
          )}
          {/* Remaining 2 — free: blurred */}
          {(rating.alternatives || []).slice(1).map((alt, i) =>
            isPremium ? (
              <div key={i} style={{ background: "#F8F7FF", borderRadius: 14, padding: "13px 16px", border: "1px solid #E8E6FF", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 26 }}>🥗</span>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#1A1A24", margin: 0 }}>{alt.name}</p>
                </div>
                <div style={{ width: 38, height: 38, borderRadius: "50%", background: getScoreColor(alt.predictedScore), display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ color: "#fff", fontWeight: 800, fontSize: 12 }}>{alt.predictedScore}</span>
                </div>
              </div>
            ) : (
              <div key={i} style={{ background: "#F8F7FF", borderRadius: 14, padding: "13px 16px", border: "1px solid #E8E6FF", display: "flex", alignItems: "center", justifyContent: "space-between", filter: "blur(4px)", userSelect: "none", pointerEvents: "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 26 }}>🥗</span>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#1A1A24", margin: 0 }}>{alt.name}</p>
                </div>
              </div>
            )
          )}
          {!isPremium && rating.alternatives?.length > 1 && (
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => onOpenPaywall("alternatives")}
              style={{ background: "rgba(83,74,183,0.08)", border: "1px dashed #534AB7", borderRadius: 12, padding: "11px 16px", cursor: "pointer", color: "#534AB7", fontWeight: 700, fontSize: 13 }}>
              See 2 more condition-friendly alternatives — unlock with free trial
            </motion.button>
          )}
        </div>

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

        <p style={{ fontSize: 11, color: "#B0AEBB", textAlign: "center", lineHeight: 1.6, marginTop: 8 }}>
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
