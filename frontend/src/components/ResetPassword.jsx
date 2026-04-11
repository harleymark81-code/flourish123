import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { useAuth } from "../context/AuthContext";

export default function ResetPassword() {
  const { API } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const token = new URLSearchParams(window.location.search).get("token");

  useEffect(() => {
    if (!token) setError("Missing reset token. Please request a new password reset link.");
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setLoading(true);
    try {
      await axios.post(`${API}/auth/reset-password`, { token, new_password: password });
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.detail || "Reset failed. The link may have expired — please request a new one.");
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
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
          {done ? "Password updated" : "Set a new password"}
        </h1>
        <p style={{ fontSize: 15, color: "var(--text-secondary)", marginTop: 4 }}>
          {done ? "You can now sign in with your new password." : "Choose a strong password for your Flourish account."}
        </p>
      </div>

      {done ? (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          style={{ background: "rgba(99,153,34,0.08)", border: "1px solid rgba(99,153,34,0.2)", borderRadius: 14, padding: 20, textAlign: "center" }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: "#639922", margin: "0 0 6px" }}>All done!</p>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: "0 0 16px" }}>Your password has been updated. Head back to sign in.</p>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => window.location.href = "/"}
            style={{ background: "#534AB7", color: "#fff", border: "none", borderRadius: 12, padding: "14px 32px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
            Sign in
          </motion.button>
        </motion.div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            type="password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="New password (min 8 characters)"
            style={{ background: "var(--input-bg)", border: "2px solid var(--border)", borderRadius: 12, padding: "15px 16px", fontSize: 15, outline: "none", color: "var(--input-text)" }}
          />
          <input
            type="password"
            required
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            placeholder="Confirm new password"
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
            type="submit"
            whileTap={{ scale: 0.97 }}
            disabled={loading || !token}
            style={{ background: "#534AB7", color: "#fff", border: "none", borderRadius: 12, padding: "16px 24px", fontSize: 16, fontWeight: 600, cursor: "pointer", boxShadow: "0 4px 16px rgba(83,74,183,0.25)", marginTop: 4, opacity: !token ? 0.5 : 1 }}>
            {loading ? "Updating..." : "Update password"}
          </motion.button>

          <button type="button" onClick={() => window.location.href = "/"}
            style={{ background: "none", border: "none", color: "#534AB7", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: "4px 0" }}>
            ← Back to sign in
          </button>
        </form>
      )}
    </div>
  );
}
