import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { enableAnalytics, hasConsentChoice } from "../lib/posthog";

// Finding 8.D — cookie/analytics consent banner. Renders on first visit
// (and after any consent reset) at bottom of viewport, non-modal so users
// can still interact with the app. PostHog does NOT init until Accept is
// clicked — see posthog.js initPostHog for the gating logic.

const PRI = "#534AB7";

export default function ConsentBanner() {
  const { user } = useAuth();
  const [shown, setShown] = useState(false);

  useEffect(() => {
    // Defer the check so we don't flash the banner during initial hydration
    setShown(!hasConsentChoice());
  }, []);

  const accept = () => {
    enableAnalytics(user);
    setShown(false);
  };

  const reject = () => {
    localStorage.setItem("fl_consent", "rejected");
    setShown(false);
  };

  return (
    <AnimatePresence>
      {shown && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", damping: 24, stiffness: 300 }}
          style={{
            position: "fixed",
            bottom: "calc(16px + env(safe-area-inset-bottom, 0px))",
            left: 16,
            right: 16,
            zIndex: 9800,
            maxWidth: 480,
            margin: "0 auto",
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: 16,
            padding: "18px 20px",
            boxShadow: "0 12px 40px rgba(0,0,0,0.24)",
          }}
        >
          <p style={{ fontSize: 14, color: "var(--text-primary)", lineHeight: 1.55, margin: "0 0 14px" }}>
            Flourish uses cookies and analytics to improve the app. You can decide now — see our{" "}
            <a href="/privacy" style={{ color: PRI, textDecoration: "underline", fontWeight: 600 }}>Privacy Policy</a>
            {" "}and{" "}
            <a href="/cookies" style={{ color: PRI, textDecoration: "underline", fontWeight: 600 }}>Cookie Policy</a>
            {" "}for details.
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={reject}
              style={{
                flex: 1, minHeight: 44, border: "1px solid var(--border)",
                borderRadius: 10, background: "var(--bg-app)",
                color: "var(--text-secondary)", fontWeight: 600, fontSize: 14,
                cursor: "pointer",
              }}>
              Reject
            </button>
            <button
              onClick={accept}
              style={{
                flex: 1, minHeight: 44, border: "none", borderRadius: 10,
                background: `linear-gradient(135deg, ${PRI}, #756AD9)`,
                color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer",
                boxShadow: "0 4px 14px rgba(83,74,183,0.30)",
              }}>
              Accept
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
