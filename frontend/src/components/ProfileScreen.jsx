import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, Crown, Edit2, Share2, Flame, LogOut, ChevronRight, Star, Copy, Check, Trash2, AlertTriangle, CalendarDays, ChevronDown, MessageCircle, Mail, HelpCircle, ArrowLeft, ChevronUp, Send } from "lucide-react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { ph } from "../lib/posthog";

const PHASE_INFO = {
  menstrual:  { label: "Menstrual",  color: "#A32D2D", bg: "rgba(163,45,45,0.08)",  emoji: "🌑", tip: "Rest and nourish. Iron-rich foods like lentils and leafy greens support you now." },
  follicular: { label: "Follicular", color: "#534AB7", bg: "rgba(83,74,183,0.08)",  emoji: "🌱", tip: "Energy is rising. Lean proteins and fermented foods support hormone building." },
  ovulation:  { label: "Ovulation",  color: "#639922", bg: "rgba(99,153,34,0.08)",  emoji: "🌕", tip: "Peak energy. Anti-inflammatory foods like berries and seeds support egg health." },
  luteal:     { label: "Luteal",     color: "#BA7517", bg: "rgba(186,117,23,0.08)", emoji: "🌗", tip: "Cravings may spike. Magnesium-rich foods like dark chocolate and nuts help." },
};

function CycleTrackingCard({ getHeaders, API, cycleEnabled }) {
  const [cycleData, setCycleData] = useState(null);
  const [showLog, setShowLog] = useState(false);
  const [periodDate, setPeriodDate] = useState("");
  const [cycleLength, setCycleLength] = useState(28);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [cycleError, setCycleError] = useState("");

  useEffect(() => {
    loadCycle();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadCycle = async () => {
    try {
      const res = await axios.get(`${API}/cycle/current`, { headers: getHeaders(), withCredentials: true });
      if (res.data?.phase) setCycleData(res.data);
    } catch (e) {}
  };

  const handleLogPeriod = async () => {
    if (!periodDate) return;
    setSaving(true);
    setCycleError("");
    try {
      await axios.post(`${API}/cycle/log`, { period_start: periodDate, period_length: cycleLength }, { headers: getHeaders(), withCredentials: true });
      setShowLog(false);
      await loadCycle();
    } catch (e) {
      console.error("[Flourish] cycle log error:", e);
      setCycleError("Couldn't save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const phase = cycleData?.phase ? PHASE_INFO[cycleData.phase] : null;

  if (!cycleEnabled) {
    return (
      <div style={{ background: "var(--bg-card)", borderRadius: 16, padding: 16, marginBottom: 16, border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12 }}>
        <CalendarDays size={20} color="#534AB7" />
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 2px" }}>Cycle Tracking</p>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>Enable in your profile to track phases and get phase-specific food advice.</p>
        </div>
      </div>
    );
  }

  // Build a mini 28-cell cycle calendar
  const totalDays = cycleData?.cycle_length || 28;
  const currentDay = cycleData?.day || 0;
  const getPhaseForDay = (d) => {
    if (d <= 5) return "menstrual";
    if (d <= 13) return "follicular";
    if (d <= 16) return "ovulation";
    return "luteal";
  };

  return (
    <div style={{ background: "var(--bg-card)", borderRadius: 16, padding: 16, marginBottom: 16, border: "1px solid var(--border)" }}>
      {/* Header — tappable to expand */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{ width: "100%", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", padding: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <CalendarDays size={18} color="#534AB7" />
          <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Cycle Tracking</p>
          {phase && (
            <span style={{ background: phase.bg, color: phase.color, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20 }}>{phase.emoji} {phase.label}</span>
          )}
        </div>
        <ChevronDown size={16} color="#6B6A7C" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: "hidden" }}>
            <div style={{ paddingTop: 16 }}>
              {/* Phase info card */}
              {phase ? (
                <div style={{ background: phase.bg, borderRadius: 12, padding: "12px 14px", marginBottom: 14, border: `1px solid ${phase.color}30` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: phase.color, margin: 0 }}>Day {cycleData.day} of {totalDays}</p>
                    {cycleData.next_period && (
                      <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>
                        Next period: {new Date(cycleData.next_period).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      </p>
                    )}
                  </div>
                  <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>{phase.tip}</p>
                </div>
              ) : (
                <div style={{ background: "var(--bg-elevated)", borderRadius: 12, padding: "12px 14px", marginBottom: 14, border: "1px solid var(--border)", textAlign: "center" }}>
                  <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>Log your period start date to see your current phase and food recommendations.</p>
                </div>
              )}

              {/* Cycle calendar */}
              {cycleData && (
                <div style={{ marginBottom: 14 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 8px" }}>Cycle calendar</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                    {Array.from({ length: totalDays }, (_, i) => {
                      const dayNum = i + 1;
                      const p = getPhaseForDay(dayNum);
                      const pInfo = PHASE_INFO[p];
                      const isCurrent = dayNum === currentDay;
                      return (
                        <div key={dayNum} style={{
                          width: 22, height: 22, borderRadius: 4,
                          background: isCurrent ? pInfo.color : pInfo.bg,
                          border: `1px solid ${pInfo.color}${isCurrent ? "ff" : "40"}`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          {isCurrent && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff" }} />}
                        </div>
                      );
                    })}
                  </div>
                  {/* Legend */}
                  <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
                    {Object.entries(PHASE_INFO).map(([k, v]) => (
                      <div key={k} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: v.bg, border: `1px solid ${v.color}` }} />
                        <span style={{ fontSize: 10, color: "var(--text-secondary)" }}>{v.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Log period button */}
              {!showLog ? (
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setShowLog(true)}
                  style={{ width: "100%", background: "#534AB7", color: "#fff", border: "none", borderRadius: 10, padding: "11px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                  {cycleData ? "Log new period" : "Log period start"}
                </motion.button>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", margin: "0 0 4px" }}>Period start date</p>
                    <input
                      type="date"
                      value={periodDate}
                      max={new Date().toISOString().split("T")[0]}
                      onChange={e => setPeriodDate(e.target.value)}
                      style={{ width: "100%", background: "var(--input-bg)", border: "2px solid var(--border)", borderRadius: 10, padding: "10px 12px", fontSize: 14, outline: "none", color: "var(--input-text)", boxSizing: "border-box" }}
                    />
                  </div>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", margin: "0 0 4px" }}>Cycle length (days)</p>
                    <div style={{ display: "flex", gap: 6 }}>
                      {[25, 26, 27, 28, 29, 30, 31, 32].map(d => (
                        <button key={d} onClick={() => setCycleLength(d)}
                          style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "none", background: cycleLength === d ? "#534AB7" : "var(--bg-elevated)", color: cycleLength === d ? "#fff" : "var(--text-secondary)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                  {cycleError && (
                    <p style={{ fontSize: 12, color: "#A32D2D", margin: 0, padding: "6px 0" }}>{cycleError}</p>
                  )}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => { setShowLog(false); setCycleError(""); }}
                      style={{ flex: 1, background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 10, padding: "11px", fontSize: 14, cursor: "pointer", color: "var(--text-secondary)" }}>
                      Cancel
                    </button>
                    <motion.button whileTap={{ scale: 0.97 }} onClick={handleLogPeriod} disabled={!periodDate || saving}
                      style={{ flex: 2, background: "#534AB7", color: "#fff", border: "none", borderRadius: 10, padding: "11px", fontSize: 14, fontWeight: 600, cursor: "pointer", opacity: !periodDate ? 0.6 : 1 }}>
                      {saving ? "Saving..." : "Save"}
                    </motion.button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const FAQS = [
  {
    q: "How is my Flourish score calculated?",
    a: "Every food is rated across four dimensions — Naturalness, Hormonal Impact, Inflammation, and Gut Health — using peer-reviewed nutritional research. Your score is then adjusted based on your specific conditions, goals, and dietary style. No two profiles produce the same ratings.",
  },
  {
    q: "Can I cancel my subscription anytime?",
    a: "Yes, always. You can cancel in one tap from your Profile → Manage Subscription. You'll keep access until the end of your billing period.",
  },
  {
    q: "Is my health data safe?",
    a: "Your data is encrypted, never sold, and never shared with third parties. Your health information belongs to you.",
  },
  {
    q: "Why does the same food score differently for different people?",
    a: "Because different conditions respond differently to the same ingredients. Someone with PCOS and someone with IBS will see different scores for the same food — because Flourish is built around your body, not a generic nutrition database.",
  },
  {
    q: "How do I update my health profile?",
    a: "Go to Profile → Edit Profile. You can update your conditions, goals, diet, and any other details at any time.",
  },
];

function SupportScreen({ user, getHeaders, API, onBack }) {
  const [view, setView] = useState("main"); // "main" | "form"
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState("");
  const [openFAQ, setOpenFAQ] = useState(null);

  const handleSend = async () => {
    if (!subject.trim() || !message.trim()) return;
    setSending(true);
    setSendError("");
    try {
      await axios.post(`${API}/support/contact`, { subject: subject.trim(), message: message.trim() }, { headers: getHeaders(), withCredentials: true });
      setSent(true);
    } catch (e) {
      setSendError("Couldn't send your message. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const PRI = "#534AB7";
  const P = "var(--text-primary)";
  const S = "var(--text-secondary)";

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", background: "var(--bg-app)", paddingBottom: "calc(80px + env(safe-area-inset-bottom, 0px))", paddingTop: 56 }}>
      <div style={{ padding: "0 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
          <motion.button whileTap={{ scale: 0.9 }} onClick={onBack}
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
            <ArrowLeft size={16} color={S} />
          </motion.button>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: P, margin: 0 }}>Help &amp; Support</h1>
        </div>

        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 26, fontWeight: 800, color: P, margin: "0 0 8px", letterSpacing: "-0.02em" }}>We're here to help.</h2>
          <p style={{ fontSize: 15, color: S, margin: 0, lineHeight: 1.6 }}>Flourish is built by a small team that genuinely cares. Whatever you need — we'll get back to you within 24 hours.</p>
        </div>

        {/* Card 1 — Send a message */}
        <div style={{ background: "var(--bg-card)", borderRadius: 16, padding: 20, marginBottom: 12, border: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: view === "form" ? 16 : 0 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(83,74,183,0.09)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <MessageCircle size={20} color={PRI} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: P, margin: 0 }}>Send us a message</p>
              <p style={{ fontSize: 13, color: S, margin: "2px 0 0" }}>We'll reply within 24 hours</p>
            </div>
            {view !== "form" && (
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => { setView("form"); setSent(false); setSendError(""); }}
                style={{ background: PRI, border: "none", borderRadius: 10, padding: "8px 16px", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Write
              </motion.button>
            )}
          </div>
          <AnimatePresence>
            {view === "form" && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} style={{ overflow: "hidden" }}>
                {sent ? (
                  <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    style={{ background: "rgba(99,153,34,0.08)", border: "1px solid rgba(99,153,34,0.2)", borderRadius: 12, padding: "14px 16px", textAlign: "center" }}>
                    <p style={{ fontSize: 15, fontWeight: 600, color: "#639922", margin: "0 0 4px" }}>Message sent ✓</p>
                    <p style={{ fontSize: 13, color: S, margin: 0 }}>We'll reply to {user?.email} within 24 hours.</p>
                  </motion.div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 600, color: S, margin: "0 0 6px" }}>Subject</p>
                      <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="What do you need help with?"
                        style={{ width: "100%", background: "var(--input-bg, var(--bg-elevated))", border: "2px solid var(--border)", borderRadius: 10, padding: "11px 14px", fontSize: 14, color: P, outline: "none", boxSizing: "border-box" }} />
                    </div>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 600, color: S, margin: "0 0 6px" }}>Message</p>
                      <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Tell us what's going on..." rows={4}
                        style={{ width: "100%", background: "var(--input-bg, var(--bg-elevated))", border: "2px solid var(--border)", borderRadius: 10, padding: "11px 14px", fontSize: 14, color: P, outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit", lineHeight: 1.55 }} />
                    </div>
                    {sendError && <p style={{ fontSize: 13, color: "#A32D2D", margin: 0 }}>{sendError}</p>}
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => setView("main")}
                        style={{ flex: 1, background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 10, padding: 11, fontSize: 14, cursor: "pointer", color: S }}>
                        Cancel
                      </button>
                      <motion.button whileTap={{ scale: 0.97 }} onClick={handleSend}
                        disabled={sending || !subject.trim() || !message.trim()}
                        style={{ flex: 2, background: !subject.trim() || !message.trim() ? "var(--border)" : PRI, color: "#fff", border: "none", borderRadius: 10, padding: 11, fontSize: 14, fontWeight: 600, cursor: sending || !subject.trim() || !message.trim() ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                        {sending ? "Sending..." : <><Send size={14} /> Send</>}
                      </motion.button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Card 2 — Email directly */}
        <a href="mailto:hello@theflourishapp.health" style={{ textDecoration: "none", display: "block", marginBottom: 12 }}>
          <div style={{ background: "var(--bg-card)", borderRadius: 16, padding: 20, border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(83,74,183,0.09)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Mail size={20} color={PRI} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: P, margin: 0 }}>Email us directly</p>
              <p style={{ fontSize: 13, color: PRI, margin: "2px 0 0", fontWeight: 500 }}>hello@theflourishapp.health</p>
            </div>
            <ChevronRight size={16} color={PRI} />
          </div>
        </a>

        {/* Card 3 — FAQs */}
        <div style={{ background: "var(--bg-card)", borderRadius: 16, padding: 20, border: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(83,74,183,0.09)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <HelpCircle size={20} color={PRI} />
            </div>
            <p style={{ fontSize: 15, fontWeight: 700, color: P, margin: 0 }}>Frequently asked questions</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {FAQS.map((faq, i) => (
              <div key={i} style={{ borderTop: i > 0 ? "1px solid var(--border)" : "none", paddingTop: i > 0 ? 10 : 0 }}>
                <button onClick={() => setOpenFAQ(openFAQ === i ? null : i)}
                  style={{ width: "100%", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, padding: "6px 0", textAlign: "left" }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: P, margin: 0, lineHeight: 1.4, flex: 1 }}>{faq.q}</p>
                  {openFAQ === i ? <ChevronUp size={15} color={S} style={{ flexShrink: 0, marginTop: 2 }} /> : <ChevronDown size={15} color={S} style={{ flexShrink: 0, marginTop: 2 }} />}
                </button>
                <AnimatePresence>
                  {openFAQ === i && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} style={{ overflow: "hidden" }}>
                      <p style={{ fontSize: 13, color: S, margin: "4px 0 10px", lineHeight: 1.6 }}>{faq.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProfileScreen({ onEditProfile }) {
  const { user, isPremium, logout, getHeaders, API } = useAuth();
  const [stats, setStats] = useState(null);
  const [referralStats, setReferralStats] = useState(null);
  const [copied, setCopied] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState("");
  const [showSupport, setShowSupport] = useState(false);

  useEffect(() => {
    loadStats();
    loadReferralStats();
    ph.profileViewed();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadStats = async () => {
    try {
      const res = await axios.get(`${API}/profile/stats`, { headers: getHeaders(), withCredentials: true });
      setStats(res.data);
    } catch (e) {
      console.error("[Flourish] ProfileScreen loadStats error:", e);
    }
  };

  const loadReferralStats = async () => {
    try {
      const res = await axios.get(`${API}/referral/stats`, { headers: getHeaders(), withCredentials: true });
      setReferralStats(res.data);
    } catch (e) {
      console.error("[Flourish] ProfileScreen loadReferralStats error:", e);
    }
  };

  const handleCopyReferral = async () => {
    if (referralStats?.referral_link) {
      await navigator.clipboard.writeText(referralStats.referral_link).catch(() => {});
      ph.referralLinkCopied();
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShareReferral = async () => {
    if (referralStats?.referral_link) {
      ph.referralLinkShared();
      if (navigator.share) {
        await navigator.share({ title: "Join Flourish", text: "I've been using Flourish to understand how food affects my health. Try it free!", url: referralStats.referral_link }).catch(() => {});
      } else {
        handleCopyReferral();
      }
    }
  };

  const handleManageSubscription = async () => {
    ph.manageSubscriptionClicked();
    setPortalLoading(true);
    setPortalError("");
    try {
      const res = await axios.post(`${API}/payments/portal`, {}, { headers: getHeaders(), withCredentials: true });
      window.location.href = res.data.url;
    } catch (e) {
      console.error("[Flourish] portal error:", e);
      setPortalLoading(false);
      setPortalError("Couldn't open subscription portal. Please try again.");
      setTimeout(() => setPortalError(""), 4000);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    setDeleteError("");
    try {
      await axios.delete(`${API}/auth/account`, { headers: getHeaders(), withCredentials: true });
      ph.userDeletedAccount();
      logout();
    } catch (e) {
      console.error("[Flourish] deleteAccount error:", e);
      setDeleting(false);
      setDeleteError(e.response?.data?.detail || "Failed to delete account. Please try again or contact support.");
    }
  };

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("en-GB", { month: "long", year: "numeric" })
    : null;

  const conditionLabels = (user?.conditions || []).map(c => {
    const special = { pcos: "PCOS", ibs: "IBS", type2_diabetes: "Type 2 Diabetes" };
    return special[c] || c.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
  });

  if (showSupport) {
    return <SupportScreen user={user} getHeaders={getHeaders} API={API} onBack={() => setShowSupport(false)} />;
  }

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", background: "var(--bg-app)", paddingBottom: "calc(80px + env(safe-area-inset-bottom, 0px))", paddingTop: 56 }}>
      <div style={{ padding: "0 20px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Profile</h1>
          <motion.button data-testid="logout-btn" whileTap={{ scale: 0.9 }} onClick={logout}
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <LogOut size={16} color="#6B6A7C" />
          </motion.button>
        </div>

        {/* Profile Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ background: "linear-gradient(135deg, #534AB7, #756AD9)", borderRadius: 20, padding: 24, marginBottom: 16, position: "relative", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 60, height: 60, borderRadius: "50%", background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <User size={28} color="#fff" />
              </div>
              <div>
                <p style={{ fontSize: 20, fontWeight: 700, color: "#fff", margin: 0 }}>{user?.name}</p>
                <p style={{ fontSize: 14, color: "rgba(255,255,255,0.75)", margin: "2px 0 0" }}>{user?.email}</p>
                {memberSince && (
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", margin: "2px 0 0" }}>Member since {memberSince}</p>
                )}
                {isPremium && (
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 6 }}>
                    <Crown size={14} color="#F59E0B" />
                    <span style={{ fontSize: 12, color: "#F59E0B", fontWeight: 700 }}>Premium Member</span>
                  </div>
                )}
              </div>
            </div>
            <motion.button whileTap={{ scale: 0.9 }} onClick={onEditProfile}
              style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 10, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <Edit2 size={16} color="#fff" />
            </motion.button>
          </div>
        </motion.div>

        {/* Stats */}
        {stats && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
            {[
              { label: "Current streak", value: stats.streak, icon: <Flame size={16} color={stats.streak >= 7 ? "#534AB7" : "#F97316"} /> },
              { label: "Longest streak", value: stats.longest_streak, icon: <Star size={16} color="#F59E0B" /> },
              { label: "Monthly avg", value: stats.monthly_avg, icon: null }
            ].map((stat, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0, transition: { delay: i * 0.05 } }}
                style={{ background: "var(--bg-card)", borderRadius: 12, padding: "14px 10px", border: "1px solid var(--border)", textAlign: "center" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginBottom: 4 }}>
                  {stat.icon}
                  <span style={{ fontSize: 22, fontWeight: 700, color: "#534AB7" }}>{stat.value}</span>
                </div>
                <p style={{ fontSize: 10, color: "var(--text-secondary)", margin: 0, lineHeight: 1.2 }}>{stat.label}</p>
              </motion.div>
            ))}
          </div>
        )}

        {/* Conditions */}
        {conditionLabels.length > 0 && (
          <div style={{ background: "var(--bg-card)", borderRadius: 16, padding: 16, marginBottom: 16, border: "1px solid var(--border)" }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 12px" }}>Your conditions</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {conditionLabels.map(c => (
                <span key={c} style={{ background: "rgba(83,74,183,0.1)", color: "#534AB7", padding: "5px 12px", borderRadius: 20, fontSize: 13, fontWeight: 600 }}>{c}</span>
              ))}
            </div>
          </div>
        )}

        {/* Referral */}
        {referralStats && (
          <div style={{ background: "var(--bg-card)", borderRadius: 16, padding: 16, marginBottom: 16, border: "1px solid var(--border)" }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 12px" }}>Refer friends & earn</p>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 12px" }}>Earn one free month of Premium for every paying referral.</p>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <div style={{ flex: 1, background: "var(--bg-elevated)", borderRadius: 10, padding: "10px 12px", border: "1px solid var(--border)" }}>
                <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 2px" }}>Referral link</p>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#534AB7", margin: 0, wordBreak: "break-all" }}>{referralStats.referral_link}</p>
              </div>
              <motion.button whileTap={{ scale: 0.9 }} onClick={handleCopyReferral}
                style={{ background: "#534AB7", border: "none", borderRadius: 10, width: 44, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                {copied ? <Check size={16} color="#fff" /> : <Copy size={16} color="#fff" />}
              </motion.button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
              <div style={{ background: "var(--bg-elevated)", borderRadius: 10, padding: 12, textAlign: "center", border: "1px solid var(--border)" }}>
                <p style={{ fontSize: 20, fontWeight: 700, color: "#534AB7", margin: 0 }}>{referralStats.paying_referrals}</p>
                <p style={{ fontSize: 11, color: "var(--text-secondary)", margin: 0 }}>Paying referrals</p>
              </div>
              <div style={{ background: "var(--bg-elevated)", borderRadius: 10, padding: 12, textAlign: "center", border: "1px solid var(--border)" }}>
                <p style={{ fontSize: 20, fontWeight: 700, color: "#639922", margin: 0 }}>{referralStats.free_months_earned}</p>
                <p style={{ fontSize: 11, color: "var(--text-secondary)", margin: 0 }}>Free months earned</p>
              </div>
            </div>
            <motion.button whileTap={{ scale: 0.97 }} onClick={handleShareReferral}
              style={{ width: "100%", background: "#534AB7", color: "#fff", border: "none", borderRadius: 10, padding: "12px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <Share2 size={16} />
              Share referral link
            </motion.button>
          </div>
        )}

        {/* Cycle Tracking */}
        <CycleTrackingCard getHeaders={getHeaders} API={API} cycleEnabled={user?.cycle_tracking} />

        {/* Manage subscription — premium only */}
        {isPremium && (
          <>
            <motion.div whileTap={{ scale: 0.97 }} onClick={handleManageSubscription}
              style={{ background: "var(--bg-card)", borderRadius: 16, padding: 16, border: "1px solid var(--border)", cursor: portalLoading ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: portalError ? 6 : 12, opacity: portalLoading ? 0.7 : 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Crown size={18} color="#F59E0B" />
                <div>
                  <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 2px" }}>{portalLoading ? "Opening portal..." : "Manage subscription"}</p>
                  <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>Cancel, upgrade or view billing</p>
                </div>
              </div>
              <ChevronRight size={16} color="#534AB7" />
            </motion.div>
            <AnimatePresence>
              {portalError && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  style={{ background: "rgba(163,45,45,0.08)", border: "1px solid rgba(163,45,45,0.2)", borderRadius: 10, padding: "10px 14px", marginBottom: 12 }}>
                  <p style={{ fontSize: 13, color: "#A32D2D", margin: 0 }}>{portalError}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        {/* Affiliate Link */}
        <motion.div whileTap={{ scale: 0.97 }} onClick={() => window.location.href = "/affiliate"}
          style={{ background: "var(--bg-card)", borderRadius: 16, padding: 16, border: "1px solid var(--border)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 2px" }}>Become an affiliate</p>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>Earn 30% commission on referrals</p>
          </div>
          <ChevronRight size={16} color="#534AB7" />
        </motion.div>

        {/* Help & Support */}
        <motion.div whileTap={{ scale: 0.97 }} onClick={() => setShowSupport(true)}
          style={{ background: "var(--bg-card)", borderRadius: 16, padding: 16, border: "1px solid var(--border)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <MessageCircle size={18} color="#534AB7" />
            <div>
              <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 2px" }}>Help &amp; Support</p>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>FAQs, contact us, and more</p>
            </div>
          </div>
          <ChevronRight size={16} color="#534AB7" />
        </motion.div>

        {/* Delete account */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => setShowDeleteConfirm(true)}
          style={{ width: "100%", background: "none", border: "1px solid rgba(163,45,45,0.2)", borderRadius: 12, padding: "12px 16px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 20 }}>
          <Trash2 size={14} color="#A32D2D" />
          <span style={{ fontSize: 13, color: "#A32D2D", fontWeight: 600 }}>Delete account</span>
        </motion.button>

        <p style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center", paddingBottom: 8 }}>
          Flourish v1.0 · AI-powered food intelligence
        </p>
      </div>

      {/* Delete account confirm modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 9700, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
            onClick={e => e.target === e.currentTarget && setShowDeleteConfirm(false)}>
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0, transition: { type: "spring", damping: 28, stiffness: 280 } }}
              exit={{ y: "100%" }}
              style={{ background: "var(--bg-elevated)", borderRadius: "24px 24px 0 0", padding: "28px 24px 40px", width: "100%", maxWidth: 480 }}>
              <div style={{ width: 40, height: 4, borderRadius: 2, background: "var(--border)", margin: "0 auto 24px" }} />
              <div style={{ display: "flex", gap: 14, marginBottom: 16 }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: "rgba(163,45,45,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <AlertTriangle size={24} color="#A32D2D" />
                </div>
                <div>
                  <p style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>Delete account?</p>
                  <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: "6px 0 0", lineHeight: 1.5 }}>
                    This will permanently delete your account and all data including diary, symptoms, and progress. This cannot be undone.
                  </p>
                </div>
              </div>
              {deleteError && (
                <div style={{ background: "rgba(163,45,45,0.08)", border: "1px solid rgba(163,45,45,0.2)", borderRadius: 10, padding: "10px 14px", marginBottom: 12 }}>
                  <p style={{ fontSize: 13, color: "#A32D2D", margin: 0 }}>{deleteError}</p>
                </div>
              )}
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleDeleteAccount}
                disabled={deleting}
                style={{ width: "100%", background: "#A32D2D", color: "#fff", border: "none", borderRadius: 14, padding: "16px", fontWeight: 700, fontSize: 15, cursor: "pointer", marginBottom: 10, opacity: deleting ? 0.7 : 1 }}>
                {deleting ? "Deleting..." : "Yes, delete my account"}
              </motion.button>
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteError(""); }}
                style={{ width: "100%", background: "none", border: "none", color: "var(--text-secondary)", fontSize: 14, cursor: "pointer", padding: "8px 0" }}>
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
