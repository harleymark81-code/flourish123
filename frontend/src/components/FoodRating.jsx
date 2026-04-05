import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Share2, BookmarkPlus, Check, Lock, ChevronRight } from "lucide-react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";

const BODY_SYSTEMS = ["Hormones", "Gut", "Immune", "Thyroid", "Energy"];

const SYSTEM_COLORS = {
  Hormones: "#534AB7",
  Gut: "#639922",
  Immune: "#BA7517",
  Thyroid: "#756AD9",
  Energy: "#F59E0B"
};

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

function ScoreCircle({ score, size = 96 }) {
  const [displayed, setDisplayed] = useState(0);
  const [hasVibrated, setHasVibrated] = useState(false);

  useEffect(() => {
    let start = 0;
    const duration = 1000;
    const startTime = performance.now();

    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Spring-like easing
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(eased * score);
      setDisplayed(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setDisplayed(score);
        if (!hasVibrated && navigator.vibrate) {
          navigator.vibrate(50);
          setHasVibrated(true);
        }
        // Play audio tone
        try {
          const ctx = new AudioContext();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          gain.gain.value = 0.2;
          if (score >= 70) {
            osc.frequency.value = 523;
            osc.start();
            osc.stop(ctx.currentTime + 0.15);
            setTimeout(() => {
              const osc2 = ctx.createOscillator();
              const g2 = ctx.createGain();
              osc2.connect(g2);
              g2.connect(ctx.destination);
              g2.gain.value = 0.2;
              osc2.frequency.value = 659;
              osc2.start();
              osc2.stop(ctx.currentTime + 0.15);
            }, 160);
          } else if (score < 40) {
            osc.frequency.value = 220;
            osc.start();
            osc.stop(ctx.currentTime + 0.2);
          } else {
            osc.frequency.value = 392;
            osc.start();
            osc.stop(ctx.currentTime + 0.15);
          }
        } catch (e) {}
      }
    };
    requestAnimationFrame(animate);
  }, [score]);

  const color = getScoreColor(displayed);
  const radius = (size / 2) - 8;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (displayed / 100) * circumference;

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#E8E6FF" strokeWidth="8" />
        <motion.circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke 0.3s" }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: size / 3.5, fontWeight: 700, color }}>{displayed}</span>
      </div>
    </div>
  );
}

function DimensionCard({ label, score, summary, locked, onUnlock }) {
  const color = getScoreColor(score);
  return (
    <div style={{ background: "#F8F7FF", borderRadius: 12, padding: 16, border: "1px solid #E8E6FF", position: "relative", overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6A7C", textTransform: "uppercase", letterSpacing: 0.5, margin: 0 }}>{label}</p>
        {locked ? (
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ filter: "blur(4px)", fontSize: 18, fontWeight: 700 }}>{score}</div>
            <Lock size={14} color="#534AB7" />
          </div>
        ) : (
          <span style={{ fontSize: 18, fontWeight: 700, color }}>{score}</span>
        )}
      </div>
      <div style={{ height: 6, background: "#E8E6FF", borderRadius: 3, marginBottom: 8, overflow: "hidden" }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${locked ? 0 : score}%` }}
          transition={{ type: "spring", stiffness: 200, damping: 25 }}
          style={{ height: "100%", background: color, borderRadius: 3 }}
        />
      </div>
      {locked ? (
        <div>
          <p style={{ fontSize: 12, color: "#6B6A7C", margin: "0 0 8px", filter: "blur(3px)" }}>
            This dimension shows important insights about how this food affects you.
          </p>
          <button onClick={onUnlock} style={{ fontSize: 11, color: "#534AB7", fontWeight: 600, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            Tap to unlock your full breakdown
          </button>
        </div>
      ) : (
        <p style={{ fontSize: 12, color: "#6B6A7C", margin: 0, lineHeight: 1.4 }}>{summary}</p>
      )}
    </div>
  );
}

export default function FoodRating({ rating, onBack, onOpenPaywall }) {
  const { user, getHeaders, API } = useAuth();
  const [logged, setLogged] = useState(false);
  const [particles, setParticles] = useState([]);
  const isPremium = user?.is_premium;
  const verdict = getVerdict(rating.overallScore);

  const handleLog = async () => {
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
      // Haptic
      if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
      // Particles
      const newParticles = Array.from({ length: 12 }, (_, i) => ({
        id: i,
        angle: (i / 12) * 360,
        distance: 40 + Math.random() * 30
      }));
      setParticles(newParticles);
      setTimeout(() => setParticles([]), 700);
    } catch (e) {}
  };

  const handleShare = async () => {
    const text = `I just rated ${rating.food_name || rating.name} on Flourish — score: ${rating.overallScore}/100. ${rating.verdict}`;
    if (navigator.share) {
      await navigator.share({ title: "Flourish Food Rating", text, url: window.location.href }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(text).catch(() => {});
      alert("Rating copied to clipboard!");
    }
  };

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 30, stiffness: 300 }}
      style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", background: "#fff", overflowY: "auto", paddingBottom: 100 }}>

      {/* Header */}
      <div style={{ position: "sticky", top: 0, background: "rgba(255,255,255,0.95)", backdropFilter: "blur(10px)", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 10, borderBottom: "1px solid #E8E6FF" }}>
        <motion.button whileTap={{ scale: 0.9 }} onClick={onBack} style={{ background: "#F8F7FF", border: "1px solid #E8E6FF", borderRadius: 10, width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <ArrowLeft size={20} color="#534AB7" />
        </motion.button>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1A1A24", margin: 0 }}>Food Rating</h2>
        <motion.button whileTap={{ scale: 0.9 }} onClick={handleShare} style={{ background: "#F8F7FF", border: "1px solid #E8E6FF", borderRadius: 10, width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <Share2 size={18} color="#534AB7" />
        </motion.button>
      </div>

      <div style={{ padding: "20px 20px 0" }}>
        {/* Food Image */}
        <div style={{ width: "100%", height: 200, borderRadius: 16, background: "#F8F7FF", border: "1px solid #E8E6FF", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          {rating.product_image ? (
            <img src={rating.product_image} alt={rating.food_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <span style={{ fontSize: 80 }}>🍽️</span>
          )}
        </div>

        {/* Score + Name */}
        <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 16 }}>
          <ScoreCircle score={rating.overallScore} size={88} />
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1A1A24", margin: "0 0 8px" }}>{rating.food_name || rating.name}</h1>
            <span style={{ background: verdict.bg, color: verdict.color, fontWeight: 700, padding: "4px 12px", borderRadius: 20, fontSize: 13 }}>
              {verdict.label}
            </span>
          </div>
        </div>

        {/* Verdict */}
        <p style={{ fontSize: 14, color: "#6B6A7C", lineHeight: 1.6, marginBottom: 20 }}>{rating.verdict}</p>

        {/* For Your Conditions */}
        <div style={{ borderLeft: "3px solid #534AB7", paddingLeft: 16, marginBottom: 20, background: "#F8F7FF", borderRadius: "0 12px 12px 0", padding: "16px 16px 16px 20px" }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#534AB7", textTransform: "uppercase", letterSpacing: 1, margin: "0 0 8px" }}>For your conditions</p>
          {isPremium ? (
            <p style={{ fontSize: 14, color: "#1A1A24", lineHeight: 1.6, margin: 0 }}>{rating.forYourCondition}</p>
          ) : (
            <div>
              <p style={{ fontSize: 14, color: "#1A1A24", lineHeight: 1.6, margin: "0 0 8px" }}>
                {rating.forYourCondition?.split(". ")[0]}.
              </p>
              <div style={{ position: "relative" }}>
                <p style={{ fontSize: 14, color: "#1A1A24", lineHeight: 1.6, margin: 0, filter: "blur(5px)", userSelect: "none" }}>
                  This insight contains 3 specific findings about how this food affects your condition. The inflammatory markers in this food directly impact hormonal signalling.
                </p>
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <button onClick={onOpenPaywall} style={{ background: "#534AB7", color: "#fff", border: "none", borderRadius: 10, padding: "8px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    Unlock with 3-day free trial
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Dimension Grid */}
        <p style={{ fontSize: 16, fontWeight: 700, color: "#1A1A24", marginBottom: 12 }}>Health dimensions</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
          <DimensionCard label="Naturalness" score={rating.dimensions?.naturalness?.score} summary={rating.dimensions?.naturalness?.summary} locked={false} />
          <DimensionCard label="Hormonal" score={rating.dimensions?.hormonalImpact?.score} summary={rating.dimensions?.hormonalImpact?.summary} locked={!isPremium} onUnlock={onOpenPaywall} />
          <DimensionCard label="Inflammation" score={rating.dimensions?.inflammation?.score} summary={rating.dimensions?.inflammation?.summary} locked={!isPremium} onUnlock={onOpenPaywall} />
          <DimensionCard label="Gut Health" score={rating.dimensions?.gutHealth?.score} summary={rating.dimensions?.gutHealth?.summary} locked={!isPremium} onUnlock={onOpenPaywall} />
        </div>

        {/* Positives */}
        {rating.flags?.positives?.length > 0 && (
          <div style={{ background: "rgba(99,153,34,0.08)", borderRadius: 12, padding: 16, marginBottom: 12, border: "1px solid rgba(99,153,34,0.2)" }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#639922", margin: "0 0 8px" }}>Positives</p>
            {rating.flags.positives.map((p, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
                <Check size={14} color="#639922" style={{ flexShrink: 0, marginTop: 2 }} />
                <p style={{ fontSize: 13, color: "#1A1A24", margin: 0 }}>{p}</p>
              </div>
            ))}
          </div>
        )}

        {/* Warnings */}
        {rating.flags?.warnings?.length > 0 && (
          <div style={{ background: "rgba(163,45,45,0.08)", borderRadius: 12, padding: 16, marginBottom: 12, border: "1px solid rgba(163,45,45,0.2)" }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#A32D2D", margin: "0 0 8px" }}>Watch out</p>
            {rating.flags.warnings.map((w, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: "#A32D2D", flexShrink: 0, marginTop: 1 }}>⚠</span>
                <p style={{ fontSize: 13, color: "#1A1A24", margin: 0 }}>{w}</p>
              </div>
            ))}
          </div>
        )}

        {/* Tips */}
        {rating.flags?.tips?.length > 0 && (
          <div style={{ background: "rgba(186,117,23,0.08)", borderRadius: 12, padding: 16, marginBottom: 20, border: "1px solid rgba(186,117,23,0.2)" }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#BA7517", margin: "0 0 8px" }}>Tips</p>
            {rating.flags.tips.map((t, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: "#BA7517", flexShrink: 0, marginTop: 1 }}>i</span>
                <p style={{ fontSize: 13, color: "#1A1A24", margin: 0 }}>{t}</p>
              </div>
            ))}
          </div>
        )}

        {/* Body Systems */}
        <p style={{ fontSize: 16, fontWeight: 700, color: "#1A1A24", marginBottom: 12 }}>Body systems affected</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
          {BODY_SYSTEMS.map(sys => {
            const affected = rating.bodySystemsAffected?.includes(sys);
            return (
              <div key={sys} style={{ padding: "6px 14px", borderRadius: 20, background: affected ? SYSTEM_COLORS[sys] + "20" : "#F8F7FF", border: `1px solid ${affected ? SYSTEM_COLORS[sys] : "#E8E6FF"}`, opacity: affected ? 1 : 0.5 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: affected ? SYSTEM_COLORS[sys] : "#A09FAD" }}>{sys}</span>
              </div>
            );
          })}
        </div>

        {/* Alternatives */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: "#1A1A24", marginBottom: 12 }}>Better alternatives for you</p>
          {isPremium ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(rating.alternatives || []).map((alt, i) => (
                <div key={i} style={{ background: "#F8F7FF", borderRadius: 12, padding: "12px 16px", border: "1px solid #E8E6FF", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 24 }}>🥗</span>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "#1A1A24", margin: 0 }}>{alt.name}</p>
                  </div>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: getScoreColor(alt.predictedScore), display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ color: "#fff", fontWeight: 700, fontSize: 11 }}>{alt.predictedScore}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ position: "relative" }}>
              {(rating.alternatives || []).map((alt, i) => (
                <div key={i} style={{ background: "#F8F7FF", borderRadius: 12, padding: "12px 16px", border: "1px solid #E8E6FF", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, filter: "blur(3px)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 24 }}>🥗</span>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "#1A1A24", margin: 0 }}>{alt.name}</p>
                  </div>
                </div>
              ))}
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8 }}>
                <Lock size={20} color="#534AB7" />
                <button onClick={onOpenPaywall} style={{ background: "#534AB7", color: "#fff", border: "none", borderRadius: 10, padding: "8px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  See 3 better alternatives — unlock with free trial
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Log Button */}
        <div style={{ position: "relative" }}>
          <motion.button
            data-testid="log-to-diary-btn"
            whileTap={{ scale: 0.95 }}
            onClick={handleLog}
            disabled={logged}
            style={{
              width: "100%", background: logged ? "#639922" : "#534AB7",
              color: "#fff", border: "none", borderRadius: 12, padding: "16px 24px",
              fontSize: 16, fontWeight: 600, cursor: logged ? "default" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              marginBottom: 12, transition: "background 0.3s", boxShadow: "0 4px 16px rgba(83,74,183,0.2)"
            }}>
            {logged ? <Check size={18} /> : <BookmarkPlus size={18} />}
            {logged ? "Logged" : "Log to diary"}
          </motion.button>
          {particles.map(p => (
            <motion.div
              key={p.id}
              initial={{ opacity: 1, x: 0, y: 0 }}
              animate={{ opacity: 0, x: Math.cos(p.angle * Math.PI / 180) * p.distance, y: Math.sin(p.angle * Math.PI / 180) * p.distance }}
              transition={{ duration: 0.6 }}
              style={{ position: "absolute", top: "50%", left: "50%", width: 6, height: 6, borderRadius: "50%", background: "#639922", transform: "translate(-50%, -50%)" }}
            />
          ))}
        </div>

        {!isPremium && (
          <motion.div
            style={{ background: "linear-gradient(135deg, #534AB7, #756AD9)", borderRadius: 12, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
            onClick={onOpenPaywall}
            whileTap={{ scale: 0.97 }}>
            <div>
              <p style={{ color: "#fff", fontWeight: 700, fontSize: 14, margin: "0 0 2px" }}>Unlock full analysis</p>
              <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, margin: 0 }}>Start your 3-day free trial</p>
            </div>
            <ChevronRight size={20} color="#fff" />
          </motion.div>
        )}

        {/* Disclaimer */}
        <p style={{ fontSize: 11, color: "#A09FAD", textAlign: "center", lineHeight: 1.5, marginTop: 16 }}>
          This is AI powered guidance based on current nutritional research. Always consult your doctor or healthcare provider for medical advice.
        </p>
      </div>
    </motion.div>
  );
}
