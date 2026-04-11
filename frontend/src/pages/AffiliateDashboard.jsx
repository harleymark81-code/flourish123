import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Share2, TrendingUp, Users, DollarSign, Loader } from "lucide-react";
import axios from "axios";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

export default function AffiliateDashboard() {
  const [refCode] = useState(() => new URLSearchParams(window.location.search).get("ref") || "");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!refCode) { setLoading(false); return; }

    // Track click server-side
    axios.post(`${API}/affiliate/track-click`, { ref: refCode }).catch(() => {});

    // Load dashboard data from API
    axios.get(`${API}/affiliate/dashboard?ref=${encodeURIComponent(refCode)}`)
      .then(res => setData(res.data))
      .catch(() => setError("Could not load dashboard. Check your affiliate link."))
      .finally(() => setLoading(false));
  }, [refCode]);

  const affiliateLink = `https://theflourishapp.netlify.app?ref=${refCode || "YOUR_CODE"}`;

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({ title: "Flourish — AI Food Intelligence", text: "Join Flourish and understand how food affects your health!", url: affiliateLink }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(affiliateLink).catch(() => {});
      alert("Link copied!");
    }
  };

  if (!refCode) {
    return (
      <div style={{ maxWidth: 480, margin: "80px auto", padding: 40, textAlign: "center" }}>
        <p style={{ color: "#A32D2D", fontSize: 16 }}>No affiliate code found in URL. Use your unique link: <code>?ref=YOUR_CODE</code></p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <Loader size={28} color="#534AB7" style={{ animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  const stats = data ? [
    { label: "Total Clicks", value: data.clicks, icon: <TrendingUp size={20} />, color: "#534AB7" },
    { label: "Signups", value: data.signups, icon: <Users size={20} />, color: "#639922" },
    { label: "Paying Subscribers", value: data.paying_subscribers, icon: <DollarSign size={20} />, color: "#BA7517" },
    { label: "Commission Earned", value: `£${(data.commission_earned || 0).toFixed(2)}`, icon: <DollarSign size={20} />, color: "#F59E0B" },
  ] : [];

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "60px 24px 80px" }}>
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>Affiliate Dashboard</h1>
        <p style={{ color: "var(--text-secondary)" }}>Track your performance and earnings</p>
        {data?.status === "pending" && (
          <div style={{ background: "rgba(186,117,23,0.1)", border: "1px solid rgba(186,117,23,0.3)", borderRadius: 10, padding: "10px 16px", marginTop: 12 }}>
            <p style={{ color: "#BA7517", fontSize: 13, margin: 0, fontWeight: 600 }}>Your application is pending approval. Commission tracking is already active.</p>
          </div>
        )}
        {error && <p style={{ color: "#A32D2D", fontSize: 14, marginTop: 12 }}>{error}</p>}
      </div>

      {/* Link */}
      <div style={{ background: "var(--bg-card)", borderRadius: 16, padding: 20, marginBottom: 24, border: "1px solid var(--border)" }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", margin: "0 0 8px" }}>Your affiliate link</p>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1, background: "var(--bg-elevated)", borderRadius: 10, padding: "10px 12px", border: "1px solid var(--border)" }}>
            <p style={{ fontSize: 13, color: "#534AB7", margin: 0, wordBreak: "break-all" }}>{affiliateLink}</p>
          </div>
          <motion.button whileTap={{ scale: 0.9 }} onClick={handleShare}
            style={{ background: "#534AB7", border: "none", borderRadius: 10, width: 44, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
            <Share2 size={16} color="#fff" />
          </motion.button>
        </div>
      </div>

      {/* Stats */}
      {data && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
          {stats.map(s => (
            <div key={s.label} style={{ background: "var(--bg-card)", borderRadius: 12, padding: 20, border: "1px solid var(--border)", textAlign: "center" }}>
              <div style={{ color: s.color, marginBottom: 8 }}>{s.icon}</div>
              <p style={{ fontSize: 24, fontWeight: 700, color: s.color, margin: 0 }}>{s.value}</p>
              <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "4px 0 0" }}>{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Commission info */}
      <div style={{ background: "linear-gradient(135deg, #534AB7, #756AD9)", borderRadius: 16, padding: 20, marginBottom: 24 }}>
        <p style={{ color: "#fff", fontWeight: 700, fontSize: 16, margin: "0 0 8px" }}>Commission Structure</p>
        <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 14, margin: "0 0 4px" }}>Monthly subscription: 30% = £3.90 per subscriber/month</p>
        <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 14, margin: 0 }}>Annual subscription: 30% = £15.00 per subscriber</p>
      </div>

      {/* Withdraw */}
      <div style={{ background: "var(--bg-card)", borderRadius: 12, padding: 16, border: "1px solid var(--border)", textAlign: "center" }}>
        <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 4px" }}>Withdraw earnings</p>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>Manual payouts processed monthly — contact us to claim</p>
      </div>
    </div>
  );
}
