import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";

function formatApiError(detail) {
  if (!detail) return "Something went wrong. Let us try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map(e => e?.msg || JSON.stringify(e)).filter(Boolean).join(". ");
  if (detail?.msg) return detail.msg;
  return String(detail);
}

export default function AuthScreen() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(email, password, name);
      }
    } catch (err) {
      if (err.response?.data?.detail) {
        setError(formatApiError(err.response.data.detail));
      } else if (err.message) {
        setError(err.message);
      } else {
        setError("Something went wrong. Please try again.");
      }
      console.error("[Flourish] Auth error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", background: "var(--bg-app)", display: "flex", flexDirection: "column", justifyContent: "center", padding: "40px 24px" }}>
      {/* Logo */}
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <div style={{ width: 72, height: 72, borderRadius: 18, background: "linear-gradient(135deg, #534AB7, #756AD9)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", boxShadow: "0 8px 32px rgba(83,74,183,0.25)" }}>
          <span style={{ fontSize: 36 }}>🌸</span>
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Flourish</h1>
        <p style={{ fontSize: 15, color: "var(--text-secondary)", marginTop: 4 }}>Food intelligence for your health</p>
      </div>

      {/* Toggle */}
      <div style={{ display: "flex", background: "var(--bg-card)", borderRadius: 12, padding: 4, marginBottom: 28, border: "1px solid var(--border)" }}>
        {["login", "register"].map(m => (
          <button key={m} onClick={() => { setMode(m); setError(""); }}
            style={{ flex: 1, padding: "10px", borderRadius: 10, border: "none", background: mode === m ? "var(--bg-elevated)" : "transparent", fontWeight: 600, fontSize: 15, color: mode === m ? "#534AB7" : "var(--text-secondary)", cursor: "pointer", boxShadow: mode === m ? "0 2px 8px rgba(83,74,183,0.1)" : "none", transition: "all 0.3s" }}>
            {m === "login" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <AnimatePresence>
          {mode === "register" && (
            <motion.input
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              data-testid="register-name-input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your name"
              style={{ background: "var(--input-bg)", border: "2px solid var(--border)", borderRadius: 12, padding: "15px 16px", fontSize: 15, outline: "none", color: "var(--input-text)", transition: "border 0.3s" }}
            />
          )}
        </AnimatePresence>

        <input
          data-testid="auth-email-input"
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="Email address"
          style={{ background: "var(--input-bg)", border: "2px solid var(--border)", borderRadius: 12, padding: "15px 16px", fontSize: 15, outline: "none", color: "var(--input-text)" }}
        />
        <input
          data-testid="auth-password-input"
          type="password"
          required
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Password"
          style={{ background: "var(--input-bg)", border: "2px solid var(--border)", borderRadius: 12, padding: "15px 16px", fontSize: 15, outline: "none", color: "var(--input-text)" }}
        />

        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={{ color: "#A32D2D", fontSize: 14, margin: 0, background: "rgba(163,45,45,0.08)", padding: "10px 14px", borderRadius: 10 }}>
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        <motion.button
          data-testid="auth-submit-btn"
          type="submit"
          whileTap={{ scale: 0.97 }}
          disabled={loading}
          style={{ background: "#534AB7", color: "#fff", border: "none", borderRadius: 12, padding: "16px 24px", fontSize: 16, fontWeight: 600, cursor: "pointer", boxShadow: "0 4px 16px rgba(83,74,183,0.25)", marginTop: 4 }}>
          {loading ? "..." : mode === "login" ? "Sign in" : "Create my account"}
        </motion.button>
      </form>

      <p style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", lineHeight: 1.5, marginTop: 20 }}>
        By continuing, you agree to Flourish's Terms of Service and Privacy Policy.
      </p>
    </div>
  );
}
