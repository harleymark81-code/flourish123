import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart2, Flame, Award, TrendingUp, Heart, ChevronRight, Loader, AlertCircle } from "lucide-react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { ph } from "../lib/posthog";

const PHASE_INFO = {
  menstrual:  { label: "Menstrual",  color: "#A32D2D", bg: "rgba(163,45,45,0.1)",  tip: "Focus on iron-rich foods like leafy greens and lentils. Rest and gentle nourishment are key." },
  follicular: { label: "Follicular", color: "#639922", bg: "rgba(99,153,34,0.1)",   tip: "Energy is rising. Great time for lighter, energising foods like sprouts, eggs, and fresh vegetables." },
  ovulation:  { label: "Ovulation",  color: "#534AB7", bg: "rgba(83,74,183,0.1)",   tip: "Peak energy phase. Anti-inflammatory foods like berries and salmon support this high-oestrogen period." },
  luteal:     { label: "Luteal",     color: "#BA7517", bg: "rgba(186,117,23,0.1)",  tip: "Cravings may increase. Focus on magnesium-rich foods like dark chocolate, nuts, and seeds." },
};

function BadgeCard({ badge }) {
  return (
    <motion.div
      whileTap={{ scale: 0.96 }}
      style={{
        background: badge.earned ? "var(--bg-card)" : "var(--bg-elevated)",
        borderRadius: 14, padding: "14px 12px", border: `1px solid ${badge.earned ? "rgba(83,74,183,0.3)" : "var(--border)"}`,
        textAlign: "center", opacity: badge.earned ? 1 : 0.45, position: "relative"
      }}>
      <div style={{ fontSize: 28, marginBottom: 6 }}>{badge.emoji}</div>
      <p style={{ fontSize: 11, fontWeight: 700, color: badge.earned ? "var(--text-primary)" : "var(--text-muted)", margin: "0 0 2px", lineHeight: 1.2 }}>{badge.name}</p>
      <p style={{ fontSize: 10, color: "var(--text-muted)", margin: 0, lineHeight: 1.3 }}>{badge.desc}</p>
      {badge.earned && (
        <div style={{ position: "absolute", top: -4, right: -4, width: 14, height: 14, borderRadius: "50%", background: "#639922", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ color: "#fff", fontSize: 8, fontWeight: 700 }}>✓</span>
        </div>
      )}
    </motion.div>
  );
}

function SymptomBar({ label, value, max = 5 }) {
  const pct = ((value - 1) / (max - 1)) * 100;
  const color = pct >= 70 ? "#639922" : pct >= 40 ? "#BA7517" : "#A32D2D";
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 12, color, fontWeight: 700 }}>{value}/5</span>
      </div>
      <div style={{ background: "var(--border)", borderRadius: 4, height: 6, overflow: "hidden" }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          style={{ height: "100%", borderRadius: 4, background: color }}
        />
      </div>
    </div>
  );
}

export default function InsightsScreen({ onOpenPaywall }) {
  const { user, isPremium, getHeaders, API } = useAuth();
  const [badges, setBadges] = useState(null);
  const [report, setReport] = useState(null);
  const [patterns, setPatterns] = useState(null);
  const [cycleInfo, setCycleInfo] = useState(null);
  const [loadingBadges, setLoadingBadges] = useState(true);
  const [loadingReport, setLoadingReport] = useState(true);
  const [badgesError, setBadgesError] = useState(false);
  const [activeSection, setActiveSection] = useState("progress");

  useEffect(() => {
    ph.insightsViewed();
    loadBadges();
    loadWeeklyReport();
    loadCycle();
    loadPatterns();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadBadges = async () => {
    try {
      const res = await axios.get(`${API}/badges`, { headers: getHeaders(), withCredentials: true });
      setBadges(res.data);
    } catch (e) {
      console.error("[Flourish] InsightsScreen loadBadges error:", e);
      setBadgesError(true);
    } finally {
      setLoadingBadges(false);
    }
  };

  const loadWeeklyReport = async () => {
    try {
      const res = await axios.get(`${API}/insights/weekly-report`, { headers: getHeaders(), withCredentials: true });
      setReport(res.data);
    } catch (e) {
      console.error("[Flourish] InsightsScreen loadWeeklyReport error:", e);
    } finally {
      setLoadingReport(false);
    }
  };

  const loadPatterns = async () => {
    try {
      const res = await axios.get(`${API}/diary/patterns`, { headers: getHeaders(), withCredentials: true });
      setPatterns(res.data);
    } catch (e) {
      console.error("[Flourish] InsightsScreen loadPatterns error:", e);
    }
  };

  const loadCycle = async () => {
    if (!user?.cycle_tracking) return;
    try {
      const res = await axios.get(`${API}/cycle/current`, { headers: getHeaders(), withCredentials: true });
      if (res.data.phase) setCycleInfo(res.data);
    } catch (e) {
      console.error("[Flourish] InsightsScreen loadCycle error:", e);
    }
  };

  const sections = [
    { id: "progress", label: "Progress" },
    { id: "weekly",   label: "This Week" },
    { id: "patterns", label: "Patterns" },
  ];

  // Free users see a gated preview screen
  if (!isPremium) {
    return (
      <div style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", background: "var(--bg-app)", paddingBottom: "calc(90px + env(safe-area-inset-bottom, 0px))" }}>
        <div style={{ background: "var(--bg-card)", padding: "52px 20px 16px", borderBottom: "1px solid var(--border)" }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Insights</h1>
        </div>
        <div style={{ position: "relative", padding: "16px 20px" }}>
          {/* Blurred preview of what premium looks like */}
          <div style={{ filter: "blur(4px)", userSelect: "none", pointerEvents: "none" }}>
            <div style={{ background: "linear-gradient(135deg, #F97316, #EA580C)", borderRadius: 16, padding: 20, marginBottom: 16, display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ fontSize: 44 }}>🔥</div>
              <div>
                <p style={{ color: "#fff", fontSize: 13, fontWeight: 600, margin: "0 0 2px" }}>Current streak</p>
                <p style={{ color: "#fff", fontSize: 32, fontWeight: 800, margin: 0 }}>7 days</p>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
              <div style={{ background: "var(--bg-card)", borderRadius: 14, padding: 16, border: "1px solid var(--border)", textAlign: "center" }}>
                <p style={{ fontSize: 28, fontWeight: 700, color: "#534AB7", margin: 0 }}>24</p>
                <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "4px 0 0" }}>Foods rated</p>
              </div>
              <div style={{ background: "var(--bg-card)", borderRadius: 14, padding: 16, border: "1px solid var(--border)", textAlign: "center" }}>
                <p style={{ fontSize: 28, fontWeight: 700, color: "#639922", margin: 0 }}>12</p>
                <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "4px 0 0" }}>Check-ins</p>
              </div>
            </div>
            <div style={{ background: "linear-gradient(135deg, #534AB7, #756AD9)", borderRadius: 16, padding: 20, marginBottom: 16 }}>
              <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, margin: "0 0 12px" }}>This week at a glance</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                <div style={{ textAlign: "center" }}><p style={{ color: "#fff", fontSize: 24, fontWeight: 700, margin: 0 }}>8</p><p style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, margin: 0 }}>Foods rated</p></div>
                <div style={{ textAlign: "center" }}><p style={{ color: "#fff", fontSize: 24, fontWeight: 700, margin: 0 }}>74</p><p style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, margin: 0 }}>Avg score</p></div>
                <div style={{ textAlign: "center" }}><p style={{ color: "#fff", fontSize: 24, fontWeight: 700, margin: 0 }}>5</p><p style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, margin: 0 }}>Days logged</p></div>
              </div>
            </div>
          </div>
          {/* Upgrade overlay */}
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 32px", textAlign: "center" }}>
            <div style={{ fontSize: 52, marginBottom: 12 }}>📊</div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", margin: "0 0 8px", letterSpacing: "-0.02em" }}>Insights is Premium</h2>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.55, margin: "0 0 24px" }}>
              Track your streaks, weekly food scores, symptom patterns, and personalised badges — all in one place.
            </p>
            <motion.button whileTap={{ scale: 0.96 }} onClick={() => onOpenPaywall("insights")}
              style={{ background: "linear-gradient(135deg, #534AB7, #756AD9)", color: "#fff", border: "none", borderRadius: 14, padding: "16px 32px", fontWeight: 800, fontSize: 16, cursor: "pointer", boxShadow: "0 4px 20px rgba(83,74,183,0.3)", width: "100%", maxWidth: 280 }}>
              Unlock Insights
            </motion.button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", background: "var(--bg-app)", paddingBottom: "calc(90px + env(safe-area-inset-bottom, 0px))" }}>
      {/* Header */}
      <div style={{ background: "var(--bg-card)", padding: "52px 20px 16px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Insights</h1>
          {badges && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(83,74,183,0.08)", borderRadius: 10, padding: "6px 12px" }}>
              <Award size={14} color="#534AB7" />
              <span style={{ fontSize: 12, fontWeight: 700, color: "#534AB7" }}>{badges.earned_count}/{badges.total_count} badges</span>
            </div>
          )}
        </div>

        {/* Section tabs */}
        <div style={{ display: "flex", gap: 8 }}>
          {sections.map(s => (
            <motion.button
              key={s.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => { setActiveSection(s.id); ph.insightsSectionChanged(s.id); }}
              style={{
                background: activeSection === s.id ? "#534AB7" : "var(--bg-elevated)",
                color: activeSection === s.id ? "#fff" : "var(--text-secondary)",
                border: `1px solid ${activeSection === s.id ? "#534AB7" : "var(--border)"}`,
                borderRadius: 20, padding: "6px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer"
              }}>
              {s.label}
            </motion.button>
          ))}
        </div>
      </div>

      <div style={{ padding: "16px 20px" }}>
        <AnimatePresence mode="wait">
          {/* ── PROGRESS ── */}
          {activeSection === "progress" && (
            <motion.div key="progress" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>

              {/* Streak banner */}
              {badges && (
                <div style={{ background: "linear-gradient(135deg, #F97316, #EA580C)", borderRadius: 16, padding: 20, marginBottom: 16, display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ fontSize: 44 }}>🔥</div>
                  <div>
                    <p style={{ color: "#fff", fontSize: 13, fontWeight: 600, margin: "0 0 2px", opacity: 0.85 }}>Current streak</p>
                    <p style={{ color: "#fff", fontSize: 32, fontWeight: 800, margin: 0, lineHeight: 1 }}>{badges.streak} {badges.streak === 1 ? "day" : "days"}</p>
                    {badges.longest_streak > 0 && (
                      <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, margin: "4px 0 0" }}>Best: {badges.longest_streak} days</p>
                    )}
                  </div>
                </div>
              )}

              {/* Cycle phase card */}
              {cycleInfo && PHASE_INFO[cycleInfo.phase] && (
                <div style={{ background: PHASE_INFO[cycleInfo.phase].bg, border: `1px solid ${PHASE_INFO[cycleInfo.phase].color}30`, borderRadius: 16, padding: 16, marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: PHASE_INFO[cycleInfo.phase].color, textTransform: "uppercase", letterSpacing: 1, margin: 0 }}>Cycle Phase</p>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Day {cycleInfo.day}</span>
                  </div>
                  <p style={{ fontSize: 18, fontWeight: 700, color: PHASE_INFO[cycleInfo.phase].color, margin: "0 0 6px" }}>{PHASE_INFO[cycleInfo.phase].label}</p>
                  <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 6px", lineHeight: 1.5 }}>{PHASE_INFO[cycleInfo.phase].tip}</p>
                  {cycleInfo.next_period && (
                    <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>Next period: {new Date(cycleInfo.next_period).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</p>
                  )}
                </div>
              )}

              {/* Stats summary */}
              {badges && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
                  <div style={{ background: "var(--bg-card)", borderRadius: 14, padding: 16, border: "1px solid var(--border)", textAlign: "center" }}>
                    <p style={{ fontSize: 28, fontWeight: 700, color: "#534AB7", margin: 0 }}>{badges.total_diary}</p>
                    <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "4px 0 0" }}>Foods rated</p>
                  </div>
                  <div style={{ background: "var(--bg-card)", borderRadius: 14, padding: 16, border: "1px solid var(--border)", textAlign: "center" }}>
                    <p style={{ fontSize: 28, fontWeight: 700, color: "#639922", margin: 0 }}>{badges.total_symptoms}</p>
                    <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "4px 0 0" }}>Check-ins</p>
                  </div>
                </div>
              )}

              {/* Badges */}
              {loadingBadges ? (
                <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
                  <Loader size={24} color="#534AB7" style={{ animation: "spin 1s linear infinite" }} />
                </div>
              ) : badgesError ? (
                <div style={{ textAlign: "center", padding: 24 }}>
                  <AlertCircle size={24} color="#A32D2D" style={{ marginBottom: 8 }} />
                  <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: 0 }}>Couldn't load badges. Pull to refresh.</p>
                </div>
              ) : badges ? (
                <div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>Your badges</p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                    {badges.badges.map(b => <BadgeCard key={b.id} badge={b} />)}
                  </div>
                </div>
              ) : null}
            </motion.div>
          )}

          {/* ── WEEKLY REPORT ── */}
          {activeSection === "weekly" && (
            <motion.div key="weekly" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {loadingReport ? (
                <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
                  <Loader size={24} color="#534AB7" style={{ animation: "spin 1s linear infinite" }} />
                </div>
              ) : report ? (
                <>
                  {/* Week summary card */}
                  <div style={{ background: "linear-gradient(135deg, #534AB7, #756AD9)", borderRadius: 16, padding: 20, marginBottom: 16 }}>
                    <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, margin: "0 0 12px" }}>This week at a glance</p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                      <div style={{ textAlign: "center" }}>
                        <p style={{ color: "#fff", fontSize: 24, fontWeight: 700, margin: 0 }}>{report.total_ratings}</p>
                        <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, margin: 0 }}>Foods rated</p>
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <p style={{ color: "#fff", fontSize: 24, fontWeight: 700, margin: 0 }}>{report.avg_score}</p>
                        <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, margin: 0 }}>Avg score</p>
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <p style={{ color: "#fff", fontSize: 24, fontWeight: 700, margin: 0 }}>{report.days_logged}</p>
                        <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, margin: 0 }}>Days logged</p>
                      </div>
                    </div>
                  </div>

                  {/* Symptom averages */}
                  {(report.avg_energy || report.avg_bloating) && (
                    <div style={{ background: "var(--bg-card)", borderRadius: 16, padding: 16, marginBottom: 16, border: "1px solid var(--border)" }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 12px" }}>Symptom averages this week</p>
                      {report.avg_energy && <SymptomBar label="Energy" value={Math.round(report.avg_energy)} />}
                      {report.avg_bloating && <SymptomBar label="Bloating" value={Math.round(report.avg_bloating)} />}
                    </div>
                  )}

                  {/* Top green foods */}
                  {report.green_foods?.length > 0 && (
                    <div style={{ background: "rgba(99,153,34,0.06)", borderRadius: 16, padding: 16, marginBottom: 12, border: "1px solid rgba(99,153,34,0.2)" }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "#639922", margin: "0 0 10px" }}>✓ Your green foods this week</p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {report.green_foods.map(f => (
                          <span key={f} style={{ background: "rgba(99,153,34,0.12)", color: "#639922", borderRadius: 20, padding: "4px 10px", fontSize: 12, fontWeight: 600 }}>{f}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Watch list */}
                  {report.red_foods?.length > 0 && (
                    <div style={{ background: "rgba(163,45,45,0.06)", borderRadius: 16, padding: 16, marginBottom: 12, border: "1px solid rgba(163,45,45,0.2)" }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "#A32D2D", margin: "0 0 10px" }}>⚠ Worth reviewing</p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {report.red_foods.map(f => (
                          <span key={f} style={{ background: "rgba(163,45,45,0.12)", color: "#A32D2D", borderRadius: 20, padding: "4px 10px", fontSize: 12, fontWeight: 600 }}>{f}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {report.total_ratings === 0 && (
                    <div style={{ textAlign: "center", padding: 32, color: "var(--text-muted)" }}>
                      <BarChart2 size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
                      <p style={{ fontSize: 14, margin: 0 }}>No foods logged this week yet.</p>
                      <p style={{ fontSize: 13, margin: "6px 0 0" }}>Start scanning to see your weekly report here.</p>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ textAlign: "center", padding: 32 }}>
                  <AlertCircle size={32} color="#A32D2D" style={{ marginBottom: 8 }} />
                  <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>Could not load weekly report.</p>
                </div>
              )}
            </motion.div>
          )}

          {/* ── PATTERNS ── */}
          {activeSection === "patterns" && (
            <motion.div key="patterns" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {!isPremium ? (
                <div style={{ textAlign: "center", padding: "40px 20px" }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
                  <h3 style={{ color: "var(--text-primary)", fontSize: 18, fontWeight: 700, margin: "0 0 8px" }}>Patterns unlock at Premium</h3>
                  <p style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.5, margin: "0 0 24px" }}>
                    After 14+ days of logging, we identify patterns between what you eat and how you feel — personalised to your condition.
                  </p>
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={() => onOpenPaywall("patterns")}
                    style={{ background: "#534AB7", color: "#fff", border: "none", borderRadius: 14, padding: "14px 28px", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
                    Unlock Patterns
                  </motion.button>
                </div>
              ) : !patterns ? (
                <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
                  <Loader size={24} color="#534AB7" style={{ animation: "spin 1s linear infinite" }} />
                </div>
              ) : patterns.patterns?.length === 0 ? (
                <div style={{ textAlign: "center", padding: 32, color: "var(--text-muted)" }}>
                  <TrendingUp size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
                  <p style={{ fontSize: 14, margin: 0 }}>Keep logging to reveal patterns.</p>
                  <p style={{ fontSize: 13, margin: "6px 0 0" }}>{patterns.message || "Patterns appear after 14+ days of data."}</p>
                </div>
              ) : (
                <div>
                  <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16, lineHeight: 1.5 }}>
                    Based on your last 14 days of food and symptom data:
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {patterns.patterns.map((p, i) => (
                      <div key={i} style={{
                        background: p.type === "positive" ? "rgba(99,153,34,0.06)" : p.type === "negative" ? "rgba(163,45,45,0.06)" : "var(--bg-card)",
                        border: `1px solid ${p.type === "positive" ? "rgba(99,153,34,0.2)" : p.type === "negative" ? "rgba(163,45,45,0.2)" : "var(--border)"}`,
                        borderRadius: 14, padding: 16
                      }}>
                        <div style={{ display: "flex", gap: 10 }}>
                          <span style={{ fontSize: 18 }}>{p.type === "positive" ? "✅" : p.type === "negative" ? "⚠️" : "ℹ️"}</span>
                          <p style={{ fontSize: 14, color: "var(--text-primary)", margin: 0, lineHeight: 1.5 }}>{p.insight}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
