import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Share2, TrendingUp, Users, DollarSign } from "lucide-react";

export default function AffiliateDashboard() {
  const [refCode] = useState(() => new URLSearchParams(window.location.search).get("ref") || "");
  const [clicks] = useState(parseInt(localStorage.getItem(`aff_clicks_${refCode}`) || "0"));

  // Track click via URL ref param
  useEffect(() => {
    const urlRef = new URLSearchParams(window.location.search).get("ref");
    if (urlRef) {
      const key = `aff_clicks_${urlRef}`;
      const current = parseInt(localStorage.getItem(key) || "0");
      localStorage.setItem(key, String(current + 1));
    }
  }, []);

  const stats = [
    { label: "Total Clicks", value: clicks, icon: <TrendingUp size={20} />, color: "#534AB7" },
    { label: "Signups", value: 0, icon: <Users size={20} />, color: "#639922" },
    { label: "Paying Subscribers", value: 0, icon: <DollarSign size={20} />, color: "#BA7517" },
    { label: "Commission Earned", value: "£0.00", icon: <DollarSign size={20} />, color: "#F59E0B" },
  ];

  const affiliateLink = `https://69d3f4f94ab7f09ab2fa371d--lovely-chaja-e17ca9.netlify.app?ref=${refCode || "YOUR_CODE"}`;

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({ title: "Flourish — AI Food Intelligence", text: "Join Flourish and understand how food affects your health!", url: affiliateLink }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(affiliateLink).catch(() => {});
      alert("Link copied!");
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "60px 24px 80px" }}>
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "#1A1A24", marginBottom: 8 }}>Affiliate Dashboard</h1>
        <p style={{ color: "#6B6A7C" }}>Track your performance and earnings</p>
      </div>

      {/* Link */}
      <div style={{ background: "#F8F7FF", borderRadius: 16, padding: 20, marginBottom: 24, border: "1px solid #E8E6FF" }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "#6B6A7C", margin: "0 0 8px" }}>Your affiliate link</p>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1, background: "#fff", borderRadius: 10, padding: "10px 12px", border: "1px solid #E8E6FF" }}>
            <p style={{ fontSize: 13, color: "#534AB7", margin: 0, wordBreak: "break-all" }}>{affiliateLink}</p>
          </div>
          <motion.button whileTap={{ scale: 0.9 }} onClick={handleShare}
            style={{ background: "#534AB7", border: "none", borderRadius: 10, width: 44, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
            <Share2 size={16} color="#fff" />
          </motion.button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
        {stats.map(s => (
          <div key={s.label} style={{ background: "#F8F7FF", borderRadius: 12, padding: 20, border: "1px solid #E8E6FF", textAlign: "center" }}>
            <div style={{ color: s.color, marginBottom: 8 }}>{s.icon}</div>
            <p style={{ fontSize: 24, fontWeight: 700, color: s.color, margin: 0 }}>{s.value}</p>
            <p style={{ fontSize: 12, color: "#6B6A7C", margin: "4px 0 0" }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Commission info */}
      <div style={{ background: "linear-gradient(135deg, #534AB7, #756AD9)", borderRadius: 16, padding: 20, marginBottom: 24 }}>
        <p style={{ color: "#fff", fontWeight: 700, fontSize: 16, margin: "0 0 8px" }}>Commission Structure</p>
        <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 14, margin: "0 0 4px" }}>Monthly subscription: 30% = £3.90 per subscriber</p>
        <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 14, margin: 0 }}>Annual subscription: 30% = £25.50 per subscriber</p>
      </div>

      {/* Withdraw */}
      <div style={{ background: "#F8F7FF", borderRadius: 12, padding: 16, border: "1px solid #E8E6FF", textAlign: "center" }}>
        <p style={{ fontSize: 15, fontWeight: 600, color: "#1A1A24", margin: "0 0 4px" }}>Withdraw earnings</p>
        <p style={{ fontSize: 13, color: "#6B6A7C", margin: 0 }}>Coming soon — manual payouts processed monthly</p>
      </div>
    </div>
  );
}
