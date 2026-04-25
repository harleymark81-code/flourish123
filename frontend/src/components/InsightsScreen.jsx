import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Award, TrendingUp, TrendingDown, Minus, Loader, AlertCircle, ChevronDown } from "lucide-react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { ph } from "../lib/posthog";

const PHASE_INFO = {
  menstrual:  { label: "Menstrual",  color: "#A32D2D", bg: "rgba(163,45,45,0.1)",  tip: "Focus on iron-rich foods like leafy greens and lentils. Rest and gentle nourishment are key." },
  follicular: { label: "Follicular", color: "#639922", bg: "rgba(99,153,34,0.1)",   tip: "Energy is rising. Great time for lighter, energising foods like sprouts, eggs, and fresh vegetables." },
  ovulation:  { label: "Ovulation",  color: "#534AB7", bg: "rgba(83,74,183,0.1)",   tip: "Peak energy phase. Anti-inflammatory foods like berries and salmon support this high-oestrogen period." },
  luteal:     { label: "Luteal",     color: "#BA7517", bg: "rgba(186,117,23,0.1)",  tip: "Cravings may increase. Focus on magnesium-rich foods like dark chocolate, nuts, and seeds." },
};

const SYM_LABELS = {
  energy:    "Energy",
  bloating:  "Bloating",
  brain_fog: "Brain Fog",
  mood:      "Mood",
  skin:      "Skin",
};

function fmtWeek(s) {
  return new Date(s + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
function fmtDay(s) {
  return new Date(s + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

// ── Progress ring ─────────────────────────────────────────────────────────────

function PatternProgress({ count, needed = 7 }) {
  const pct = Math.min(count / needed, 1);
  const r = 38, circ = 2 * Math.PI * r;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "36px 24px 28px" }}>
      <div style={{ position: "relative", width: 108, height: 108, marginBottom: 20 }}>
        <svg width={108} height={108} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={54} cy={54} r={r} fill="none" stroke="var(--border)" strokeWidth={7} />
          <motion.circle cx={54} cy={54} r={r} fill="none" stroke="#534AB7" strokeWidth={7}
            strokeLinecap="round" strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: circ - pct * circ }}
            transition={{ duration: 1.4, ease: "easeOut" }} />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 26, fontWeight: 800, color: "var(--text-primary)", lineHeight: 1 }}>{count}</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>of {needed}</span>
        </div>
      </div>
      <p style={{ fontSize: 17, fontWeight: 800, color: "var(--text-primary)", margin: 0, textAlign: "center", letterSpacing: "-0.02em" }}>
        {needed - count} more {needed - count === 1 ? "log" : "logs"} to unlock your patterns
      </p>
      <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: "10px 0 0", textAlign: "center", lineHeight: 1.55, maxWidth: 280 }}>
        Once you have {needed} diary entries, Flourish will analyse your food and symptom data to find genuine correlations specific to your body.
      </p>
    </div>
  );
}

// ── Pattern card ──────────────────────────────────────────────────────────────

function PatternCard({ pattern, index }) {
  const pos = pattern.type === "positive";
  const neg = pattern.type === "negative";
  const accent = pos ? "#639922" : neg ? "#A32D2D" : "#534AB7";
  const bg     = pos ? "rgba(99,153,34,0.07)"  : neg ? "rgba(163,45,45,0.07)"  : "rgba(83,74,183,0.06)";
  const border = pos ? "rgba(99,153,34,0.2)"   : neg ? "rgba(163,45,45,0.2)"   : "rgba(83,74,183,0.18)";
  const icon   = pos ? "✅" : neg ? "⚠️" : "💡";
  const dp = pattern.data_points || 0;
  const confLevel = dp >= 10 ? 3 : dp >= 5 ? 2 : 1;
  const confLabel = dp >= 10 ? "High" : dp >= 5 ? "Medium" : "Low";
  const confColor = dp >= 10 ? "#639922" : dp >= 5 ? "#BA7517" : "#6B6A7C";

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0, transition: { delay: index * 0.08 } }}
      style={{ background: bg, border: `1px solid ${border}`, borderRadius: 16, overflow: "hidden", marginBottom: 12 }}>
      <div style={{ padding: "14px 16px 12px", borderBottom: `1px solid ${border}` }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <span style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}>{icon}</span>
          <p style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)", margin: 0, lineHeight: 1.3, letterSpacing: "-0.01em" }}>
            {pattern.headline}
          </p>
        </div>
      </div>
      <div style={{ padding: "12px 16px 14px" }}>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 12px", lineHeight: 1.6 }}>
          {pattern.explanation}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 3 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: i <= confLevel ? confColor : "var(--border)" }} />
            ))}
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: confColor, textTransform: "uppercase", letterSpacing: 0.5 }}>
            {confLabel} confidence
          </span>
          {dp > 0 && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>· {dp} data points</span>}
        </div>
        <div style={{ background: "var(--bg-elevated)", borderRadius: 10, padding: "10px 12px", borderLeft: `3px solid ${accent}` }}>
          <p style={{ fontSize: 11, fontWeight: 800, color: accent, textTransform: "uppercase", letterSpacing: 0.8, margin: "0 0 4px" }}>What to do</p>
          <p style={{ fontSize: 13, color: "var(--text-primary)", margin: 0, lineHeight: 1.45 }}>{pattern.action}</p>
        </div>
      </div>
    </motion.div>
  );
}

// ── Sparkline ─────────────────────────────────────────────────────────────────

function Sparkline({ values, trend, symKey }) {
  const W = 220, H = 44, PAD = 4;
  const color = trend === "improving" ? "#639922" : trend === "declining" ? "#A32D2D" : "#BA7517";
  const gid = `sg-${symKey}`;
  const pts = values.map((v, i) => {
    if (v == null) return null;
    return {
      x: PAD + (i / Math.max(values.length - 1, 1)) * (W - PAD * 2),
      y: PAD + (H - PAD * 2) * (1 - (v - 1) / 4),
    };
  });
  const valid = pts.filter(Boolean);
  if (valid.length < 2) return null;
  const line = valid.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `${line} L${valid[valid.length - 1].x.toFixed(1)},${H} L${valid[0].x.toFixed(1)},${H} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H, display: "block" }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => p && (
        <circle key={i} cx={p.x} cy={p.y} r={3.5} fill={color} stroke="var(--bg-elevated)" strokeWidth={1.5} />
      ))}
    </svg>
  );
}

// ── Symptom trend card ────────────────────────────────────────────────────────

function SymptomTrendCard({ symKey, weeks, summary, trend }) {
  const label = SYM_LABELS[symKey] || symKey;
  const values = weeks.map(w => w.avgs[symKey]);
  const trendColor = trend === "improving" ? "#639922" : trend === "declining" ? "#A32D2D" : "#BA7517";
  const TrendIcon = trend === "improving" ? TrendingUp : trend === "declining" ? TrendingDown : Minus;
  const idxList = [0, Math.floor(weeks.length / 2), weeks.length - 1].filter((v, i, a) => a.indexOf(v) === i && v < weeks.length);
  return (
    <div style={{ background: "var(--bg-card)", borderRadius: 14, padding: "14px 16px 12px", border: "1px solid var(--border)", marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{label}</p>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <TrendIcon size={13} color={trendColor} />
          <span style={{ fontSize: 11, fontWeight: 700, color: trendColor, textTransform: "capitalize" }}>{trend}</span>
        </div>
      </div>
      <Sparkline values={values} trend={trend} symKey={symKey} />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        {idxList.map(idx => (
          <span key={idx} style={{ fontSize: 9, color: "var(--text-muted)" }}>{fmtWeek(weeks[idx].week_start)}</span>
        ))}
      </div>
      {summary && (
        <p style={{ fontSize: 12, color: trendColor, fontWeight: 600, margin: "8px 0 0", lineHeight: 1.4 }}>{summary}</p>
      )}
    </div>
  );
}

// ── Week row (expandable day-by-day) ─────────────────────────────────────────

function WeekRow({ week, expanded, onToggle }) {
  const syms = ["energy", "bloating", "brain_fog", "mood"];
  const availableSyms = syms.filter(s => Object.values(week.days).some(d => d[s] != null));
  const sortedDays = Object.entries(week.days).sort(([a], [b]) => a.localeCompare(b));

  function scoreColor(val, sym) {
    if (val == null) return "var(--text-muted)";
    const score = sym === "bloating" ? (6 - val) : val;
    return score >= 4 ? "#639922" : score >= 3 ? "#BA7517" : "#A32D2D";
  }

  return (
    <div style={{ background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border)", marginBottom: 8, overflow: "hidden" }}>
      <button onClick={onToggle}
        style={{ width: "100%", background: "none", border: "none", padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ textAlign: "left" }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Week of {fmtWeek(week.week_start)}</p>
          <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "2px 0 0" }}>
            {week.check_ins} check-{week.check_ins === 1 ? "in" : "ins"}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {week.avgs.energy != null && (
            <span style={{ fontSize: 11, background: "rgba(83,74,183,0.08)", color: "#534AB7", borderRadius: 8, padding: "3px 8px", fontWeight: 600 }}>
              Energy {week.avgs.energy}/5
            </span>
          )}
          <ChevronDown size={16} color="var(--text-muted)"
            style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
        </div>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }} style={{ overflow: "hidden", borderTop: "1px solid var(--border)" }}>
            <div style={{ padding: "10px 16px 14px" }}>
              <div style={{ display: "flex", padding: "0 0 6px", borderBottom: "1px solid var(--border)", marginBottom: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", flex: 2, textTransform: "uppercase", letterSpacing: 0.5 }}>Day</span>
                {availableSyms.map(s => (
                  <span key={s} style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", flex: 1, textAlign: "center", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    {(SYM_LABELS[s] || s).split(" ")[0]}
                  </span>
                ))}
              </div>
              {sortedDays.map(([date, dayData]) => (
                <div key={date} style={{ display: "flex", alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ fontSize: 12, color: "var(--text-secondary)", flex: 2 }}>{fmtDay(date)}</span>
                  {availableSyms.map(s => (
                    <span key={s} style={{ fontSize: 12, fontWeight: 700, flex: 1, textAlign: "center", color: scoreColor(dayData[s], s) }}>
                      {dayData[s] != null ? `${dayData[s]}/5` : "—"}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Badge card ────────────────────────────────────────────────────────────────

function BadgeCard({ badge }) {
  return (
    <motion.div whileTap={{ scale: 0.96 }}
      style={{ background: badge.earned ? "var(--bg-card)" : "var(--bg-elevated)", borderRadius: 14, padding: "14px 12px", border: `1px solid ${badge.earned ? "rgba(83,74,183,0.3)" : "var(--border)"}`, textAlign: "center", opacity: badge.earned ? 1 : 0.45, position: "relative" }}>
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

// ── Symptom bar (weekly report) ───────────────────────────────────────────────

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
        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: "easeOut" }}
          style={{ height: "100%", borderRadius: 4, background: color }} />
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function InsightsScreen() {
  const { user, getHeaders, API } = useAuth();
  const [badges, setBadges] = useState(null);
  const [report, setReport] = useState(null);
  const [patterns, setPatterns] = useState(null);
  const [cycleInfo, setCycleInfo] = useState(null);
  const [symptomHistory, setSymptomHistory] = useState(null);
  const [loadingBadges, setLoadingBadges] = useState(true);
  const [loadingReport, setLoadingReport] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [badgesError, setBadgesError] = useState(false);
  const [activeSection, setActiveSection] = useState("progress");
  const [expandedWeek, setExpandedWeek] = useState(null);

  useEffect(() => {
    ph.insightsViewed();
    loadBadges();
    loadWeeklyReport();
    loadCycle();
    loadPatterns();
  }, []); // eslint-disable-line

  useEffect(() => {
    if (activeSection === "weekly" && !symptomHistory && !loadingHistory) {
      loadSymptomHistory();
    }
  }, [activeSection]); // eslint-disable-line

  const loadBadges = async () => {
    try {
      const res = await axios.get(`${API}/badges`, { headers: getHeaders(), withCredentials: true });
      setBadges(res.data);
    } catch (e) {
      console.error("[Flourish] loadBadges:", e);
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
      console.error("[Flourish] loadWeeklyReport:", e);
    } finally {
      setLoadingReport(false);
    }
  };

  const loadPatterns = async () => {
    try {
      const res = await axios.get(`${API}/diary/patterns`, { headers: getHeaders(), withCredentials: true });
      setPatterns(res.data);
    } catch (e) {
      console.error("[Flourish] loadPatterns:", e);
    }
  };

  const loadCycle = async () => {
    if (!user?.cycle_tracking) return;
    try {
      const res = await axios.get(`${API}/cycle/current`, { headers: getHeaders(), withCredentials: true });
      if (res.data.phase) setCycleInfo(res.data);
    } catch (e) {
      console.error("[Flourish] loadCycle:", e);
    }
  };

  const loadSymptomHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await axios.get(`${API}/insights/symptom-history`, { headers: getHeaders(), withCredentials: true });
      setSymptomHistory(res.data);
    } catch (e) {
      console.error("[Flourish] loadSymptomHistory:", e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const sections = [
    { id: "progress", label: "Progress" },
    { id: "weekly",   label: "This Week" },
    { id: "patterns", label: "Patterns" },
  ];

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
        <div style={{ display: "flex", gap: 8 }}>
          {sections.map(s => (
            <motion.button key={s.id} whileTap={{ scale: 0.95 }}
              onClick={() => { setActiveSection(s.id); ph.insightsSectionChanged(s.id); }}
              style={{ background: activeSection === s.id ? "#534AB7" : "var(--bg-elevated)", color: activeSection === s.id ? "#fff" : "var(--text-secondary)", border: `1px solid ${activeSection === s.id ? "#534AB7" : "var(--border)"}`, borderRadius: 20, padding: "6px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              {s.label}
            </motion.button>
          ))}
        </div>
      </div>

      <div style={{ padding: "16px 20px" }}>
        <AnimatePresence mode="wait">

          {/* ── PROGRESS ─────────────────────────────────────────────────────── */}
          {activeSection === "progress" && (
            <motion.div key="progress" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>

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

          {/* ── THIS WEEK ────────────────────────────────────────────────────── */}
          {activeSection === "weekly" && (
            <motion.div key="weekly" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {loadingReport ? (
                <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
                  <Loader size={24} color="#534AB7" style={{ animation: "spin 1s linear infinite" }} />
                </div>
              ) : report ? (
                <>
                  {/* Week at a glance */}
                  <div style={{ background: "linear-gradient(135deg, #534AB7, #756AD9)", borderRadius: 16, padding: 20, marginBottom: 16 }}>
                    <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, margin: "0 0 12px" }}>This week at a glance</p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                      {[["total_ratings", "Foods rated"], ["avg_score", "Avg score"], ["days_logged", "Days logged"]].map(([k, lbl]) => (
                        <div key={k} style={{ textAlign: "center" }}>
                          <p style={{ color: "#fff", fontSize: 24, fontWeight: 700, margin: 0 }}>{report[k]}</p>
                          <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, margin: 0 }}>{lbl}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {(report.avg_energy || report.avg_bloating) && (
                    <div style={{ background: "var(--bg-card)", borderRadius: 16, padding: 16, marginBottom: 16, border: "1px solid var(--border)" }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 12px" }}>Symptom averages this week</p>
                      {report.avg_energy   && <SymptomBar label="Energy"   value={Math.round(report.avg_energy)} />}
                      {report.avg_bloating && <SymptomBar label="Bloating" value={Math.round(report.avg_bloating)} />}
                    </div>
                  )}

                  {report.green_foods?.length > 0 && (
                    <div style={{ background: "rgba(99,153,34,0.06)", borderRadius: 16, padding: 16, marginBottom: 12, border: "1px solid rgba(99,153,34,0.2)" }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "#639922", margin: "0 0 10px" }}>✓ Your green foods this week</p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {report.green_foods.map(f => <span key={f} style={{ background: "rgba(99,153,34,0.12)", color: "#639922", borderRadius: 20, padding: "4px 10px", fontSize: 12, fontWeight: 600 }}>{f}</span>)}
                      </div>
                    </div>
                  )}

                  {report.red_foods?.length > 0 && (
                    <div style={{ background: "rgba(163,45,45,0.06)", borderRadius: 16, padding: 16, marginBottom: 16, border: "1px solid rgba(163,45,45,0.2)" }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "#A32D2D", margin: "0 0 10px" }}>⚠ Worth reviewing</p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {report.red_foods.map(f => <span key={f} style={{ background: "rgba(163,45,45,0.12)", color: "#A32D2D", borderRadius: 20, padding: "4px 10px", fontSize: 12, fontWeight: 600 }}>{f}</span>)}
                      </div>
                    </div>
                  )}

                  {report.total_ratings === 0 && (
                    <div style={{ textAlign: "center", padding: 32, color: "var(--text-muted)" }}>
                      <p style={{ fontSize: 14, margin: 0 }}>No foods logged this week yet.</p>
                      <p style={{ fontSize: 13, margin: "6px 0 0" }}>Start scanning to see your weekly report here.</p>
                    </div>
                  )}

                  {/* ── SYMPTOM TRENDS ── */}
                  {loadingHistory && (
                    <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
                      <Loader size={20} color="#534AB7" style={{ animation: "spin 1s linear infinite" }} />
                    </div>
                  )}

                  {symptomHistory?.has_data && (
                    <>
                      <div style={{ marginTop: 8, marginBottom: 14 }}>
                        <p style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)", margin: "0 0 4px", letterSpacing: "-0.01em" }}>Symptom trends</p>
                        <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>
                          Last {symptomHistory.weeks.length} {symptomHistory.weeks.length === 1 ? "week" : "weeks"}
                        </p>
                      </div>

                      {Object.entries(SYM_LABELS).map(([symKey]) => {
                        const hist = symptomHistory.symptom_summaries[symKey];
                        if (!hist) return null;
                        const hasData = symptomHistory.weeks.some(w => w.avgs[symKey] != null);
                        if (!hasData) return null;
                        return (
                          <SymptomTrendCard
                            key={symKey}
                            symKey={symKey}
                            weeks={symptomHistory.weeks}
                            summary={hist.summary}
                            trend={hist.trend}
                          />
                        );
                      })}

                      <div style={{ marginTop: 8, marginBottom: 12 }}>
                        <p style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)", margin: "0 0 4px", letterSpacing: "-0.01em" }}>Weekly history</p>
                        <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>Tap any week to see the day-by-day breakdown</p>
                      </div>

                      {[...symptomHistory.weeks].reverse().map(week => (
                        <WeekRow
                          key={week.week_start}
                          week={week}
                          expanded={expandedWeek === week.week_start}
                          onToggle={() => setExpandedWeek(expandedWeek === week.week_start ? null : week.week_start)}
                        />
                      ))}
                    </>
                  )}

                  {symptomHistory && !symptomHistory.has_data && !loadingHistory && (
                    <div style={{ background: "var(--bg-card)", borderRadius: 14, padding: 20, marginTop: 8, border: "1px solid var(--border)", textAlign: "center" }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 6px" }}>No symptom history yet</p>
                      <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>Start logging your daily symptoms to see trends here.</p>
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

          {/* ── PATTERNS ─────────────────────────────────────────────────────── */}
          {activeSection === "patterns" && (
            <motion.div key="patterns" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {!patterns ? (
                <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
                  <Loader size={24} color="#534AB7" style={{ animation: "spin 1s linear infinite" }} />
                </div>
              ) : (patterns.total_diary ?? 0) < 7 ? (
                <PatternProgress count={patterns.total_diary || 0} needed={7} />
              ) : patterns.patterns?.length === 0 ? (
                <div style={{ textAlign: "center", padding: 32, color: "var(--text-muted)" }}>
                  <TrendingUp size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
                  <p style={{ fontSize: 14, margin: 0 }}>{patterns.message || "Analysis unavailable right now. Keep logging!"}</p>
                </div>
              ) : (
                <div>
                  <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16, lineHeight: 1.5 }}>
                    Based on your last 30 days of food and symptom data:
                  </p>
                  {patterns.patterns.map((p, i) => <PatternCard key={i} pattern={p} index={i} />)}
                </div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
