import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

export default function AffiliateApplication() {
  const [formData, setFormData] = useState({
    name: "", email: "", social_handles: "", audience_size: "", condition_niche: "", description: ""
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = "Name is required";
    if (!formData.email.trim() || !/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = "Valid email is required";
    if (!formData.social_handles.trim()) newErrors.social_handles = "Social media handles are required";
    if (!formData.audience_size.trim()) newErrors.audience_size = "Audience size is required";
    if (!formData.condition_niche.trim()) newErrors.condition_niche = "Condition niche is required";
    if (!formData.description.trim()) newErrors.description = "Description is required";
    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const v = validate();
    if (Object.keys(v).length > 0) { setErrors(v); return; }
    setLoading(true);
    try {
      await axios.post(`${API}/affiliate/apply`, formData);

      // EmailJS notification
      try {
        const emailjs = await import("@emailjs/browser");
        await emailjs.default.send(
          process.env.REACT_APP_EMAILJS_SERVICE_ID,
          process.env.REACT_APP_EMAILJS_TEMPLATE_ID,
          {
            event_type: "New Affiliate Application",
            user_email: formData.email,
            details: `Name: ${formData.name} | Social: ${formData.social_handles} | Audience: ${formData.audience_size} | Niche: ${formData.condition_niche} | Bio: ${formData.description}`,
            time: new Date().toLocaleString("en-GB")
          },
          process.env.REACT_APP_EMAILJS_PUBLIC_KEY
        );
      } catch (emailErr) {
        console.warn("EmailJS error:", emailErr);
      }

      setSuccess(true);
    } catch (e) {
      if (e.response?.data?.detail) {
        setErrors({ submit: e.response.data.detail });
      } else {
        setErrors({ submit: "Something went wrong. Let us try again." });
      }
    }
    setLoading(false);
  };

  const fields = [
    { key: "name", label: "Full name", type: "text", placeholder: "Your full name" },
    { key: "email", label: "Email address", type: "email", placeholder: "your@email.com" },
    { key: "social_handles", label: "Social media handles", type: "text", placeholder: "@yourusername" },
    { key: "audience_size", label: "Audience size", type: "text", placeholder: "e.g. 10,000 followers" },
    { key: "condition_niche", label: "Primary condition niche", type: "text", placeholder: "e.g. PCOS, thyroid, autoimmune" },
  ];

  if (success) {
    return (
      <div style={{ maxWidth: 480, margin: "80px auto", padding: 40, textAlign: "center" }}>
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300 }}
          style={{ width: 80, height: 80, borderRadius: "50%", background: "rgba(99,153,34,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
          <span style={{ fontSize: 40 }}>✓</span>
        </motion.div>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>Application submitted!</h2>
        <p style={{ fontSize: 16, color: "var(--text-secondary)" }}>Your application has been submitted. We will be in touch within 48 hours.</p>
        <button onClick={() => window.location.href = "/"} style={{ marginTop: 20, background: "#534AB7", color: "#fff", border: "none", borderRadius: 12, padding: "14px 28px", fontWeight: 600, cursor: "pointer" }}>
          Back to Flourish
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "60px 24px 80px" }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <div style={{ width: 72, height: 72, borderRadius: 18, background: "linear-gradient(135deg, #534AB7, #756AD9)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <span style={{ fontSize: 36 }}>🌸</span>
        </div>
        <h1 style={{ fontSize: 30, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Become a Flourish Affiliate</h1>
        <p style={{ fontSize: 16, color: "var(--text-secondary)", marginTop: 8 }}>Earn 30% commission helping people with hormonal conditions live better.</p>
      </div>

      {/* Benefits */}
      <div style={{ background: "var(--bg-card)", borderRadius: 16, padding: 20, marginBottom: 32, border: "1px solid var(--border)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {[
            ["30%", "Commission rate"],
            ["£3.90", "Per monthly referral"],
            ["£25.50", "Per annual referral"],
            ["Monthly", "Payouts"],
          ].map(([val, label]) => (
            <div key={label} style={{ textAlign: "center" }}>
              <p style={{ fontSize: 22, fontWeight: 700, color: "#534AB7", margin: 0 }}>{val}</p>
              <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {fields.map(field => (
          <div key={field.key}>
            <label style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", display: "block", marginBottom: 6 }}>{field.label}</label>
            <input
              data-testid={`affiliate-${field.key}`}
              type={field.type}
              value={formData[field.key]}
              onChange={e => { setFormData(prev => ({ ...prev, [field.key]: e.target.value })); setErrors(prev => ({ ...prev, [field.key]: "" })); }}
              placeholder={field.placeholder}
              style={{ width: "100%", background: "var(--input-bg)", border: `2px solid ${errors[field.key] ? "#A32D2D" : "var(--border)"}`, borderRadius: 12, padding: "13px 16px", fontSize: 15, outline: "none", color: "var(--input-text)", boxSizing: "border-box" }}
            />
            {errors[field.key] && <p style={{ color: "#A32D2D", fontSize: 12, margin: "4px 0 0" }}>{errors[field.key]}</p>}
          </div>
        ))}

        <div>
          <label style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", display: "block", marginBottom: 6 }}>Tell us about your audience</label>
          <textarea
            data-testid="affiliate-description"
            value={formData.description}
            onChange={e => { setFormData(prev => ({ ...prev, description: e.target.value })); setErrors(prev => ({ ...prev, description: "" })); }}
            placeholder="Describe your audience, content style, and why Flourish is a good fit..."
            rows={4}
            style={{ width: "100%", background: "var(--input-bg)", border: `2px solid ${errors.description ? "#A32D2D" : "var(--border)"}`, borderRadius: 12, padding: "13px 16px", fontSize: 15, outline: "none", color: "var(--input-text)", resize: "none", boxSizing: "border-box" }}
          />
          {errors.description && <p style={{ color: "#A32D2D", fontSize: 12, margin: "4px 0 0" }}>{errors.description}</p>}
        </div>

        {errors.submit && <p style={{ color: "#A32D2D", fontSize: 14, background: "rgba(163,45,45,0.08)", padding: "10px 14px", borderRadius: 10 }}>{errors.submit}</p>}

        <motion.button
          data-testid="affiliate-submit-btn"
          type="submit"
          whileTap={{ scale: 0.97 }}
          disabled={loading}
          style={{ background: "#534AB7", color: "#fff", border: "none", borderRadius: 12, padding: "16px 24px", fontSize: 16, fontWeight: 600, cursor: "pointer", boxShadow: "0 4px 16px rgba(83,74,183,0.25)", marginTop: 4 }}>
          {loading ? "Submitting..." : "Submit my application"}
        </motion.button>
      </form>
    </div>
  );
}
