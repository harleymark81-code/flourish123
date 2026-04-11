import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, Crown, Edit2, Share2, Flame, LogOut, ChevronRight, Star, Copy, Check } from "lucide-react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";

export default function ProfileScreen({ onOpenPaywall, onEditProfile }) {
  const { user, logout, getHeaders, API } = useAuth();
  const [stats, setStats] = useState(null);
  const [referralStats, setReferralStats] = useState(null);
  const [copied, setCopied] = useState(false);
  const isPremium = user?.is_premium;

  useEffect(() => {
    loadStats();
    loadReferralStats();
  }, []);

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
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShareReferral = async () => {
    if (referralStats?.referral_link) {
      if (navigator.share) {
        await navigator.share({ title: "Join Flourish", text: "I've been using Flourish to understand how food affects my health. Try it free!", url: referralStats.referral_link }).catch(() => {});
      } else {
        handleCopyReferral();
      }
    }
  };

  const conditionLabels = (user?.conditions || []).map(c => {
    const special = { pcos: "PCOS", ibs: "IBS", type2_diabetes: "Type 2 Diabetes" };
    return special[c] || c.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
  });

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", background: "var(--bg-app)", paddingBottom: 80, paddingTop: 56 }}>
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

        {/* Premium Upgrade */}
        {!isPremium && (
          <motion.div
            data-testid="upgrade-premium-btn"
            whileTap={{ scale: 0.97 }}
            onClick={onOpenPaywall}
            style={{ background: "linear-gradient(135deg, #F59E0B, #D97706)", borderRadius: 16, padding: 20, marginBottom: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <Crown size={20} color="#fff" />
                <p style={{ color: "#fff", fontWeight: 700, fontSize: 16, margin: 0 }}>Upgrade to Premium</p>
              </div>
              <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, margin: 0 }}>Start your 3-day free trial</p>
            </div>
            <ChevronRight size={20} color="#fff" />
          </motion.div>
        )}

        {/* Referral — Premium only */}
        {isPremium && referralStats && (
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

        {/* Affiliate Link */}
        <motion.div whileTap={{ scale: 0.97 }} onClick={() => window.location.href = "/affiliate"}
          style={{ background: "var(--bg-card)", borderRadius: 16, padding: 16, border: "1px solid var(--border)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 2px" }}>Become an affiliate</p>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>Earn 30% commission on referrals</p>
          </div>
          <ChevronRight size={16} color="#534AB7" />
        </motion.div>
      </div>
    </div>
  );
}
