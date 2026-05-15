import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import { shouldShowPostInstallWelcome, markPostInstallWelcomeSeen } from "../lib/pwaInstall";

// One-time celebration shown the first time the PWA is launched in standalone
// mode (i.e. from the home screen icon). Subsequent launches skip this — the
// flag is persisted in localStorage.
export default function PostInstallWelcome() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (shouldShowPostInstallWelcome()) setOpen(true);
  }, []);

  const dismiss = () => {
    markPostInstallWelcomeSeen();
    setOpen(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9850,
            background: "linear-gradient(135deg, rgba(83,74,183,0.97), rgba(117,106,217,0.97))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            textAlign: "center",
            padding: 40,
          }}
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 280, damping: 16 }}
            style={{
              width: 96,
              height: 96,
              borderRadius: "50%",
              background: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 24,
              boxShadow: "0 10px 40px rgba(0,0,0,0.25)",
            }}
          >
            <Check size={52} color="#534AB7" strokeWidth={3} />
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            style={{
              color: "#fff",
              fontSize: 28,
              fontWeight: 800,
              margin: "0 0 10px",
              letterSpacing: "-0.02em",
            }}
          >
            You're in.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            style={{
              color: "rgba(255,255,255,0.9)",
              fontSize: 16,
              margin: "0 0 28px",
              lineHeight: 1.5,
              maxWidth: 320,
            }}
          >
            Flourish is now on your home screen. Launch it like any other app — full-screen, fast, and offline-ready.
          </motion.p>
          <motion.button
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            whileTap={{ scale: 0.96 }}
            onClick={dismiss}
            style={{
              background: "#fff",
              color: "#534AB7",
              border: "none",
              borderRadius: 14,
              padding: "14px 36px",
              fontWeight: 800,
              fontSize: 16,
              cursor: "pointer",
            }}
          >
            Let's go
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
