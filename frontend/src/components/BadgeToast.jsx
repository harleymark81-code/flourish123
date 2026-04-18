import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const DISMISS_MS = 3500;

export default function BadgeToast({ badge, onDismiss }) {
  useEffect(() => {
    if (!badge) return;
    const t = setTimeout(onDismiss, DISMISS_MS);
    return () => clearTimeout(t);
  }, [badge, onDismiss]);

  return (
    <AnimatePresence>
      {badge && (
        <motion.div
          key={badge.id}
          initial={{ y: -90, opacity: 0 }}
          animate={{ y: 0, opacity: 1, transition: { type: "spring", stiffness: 420, damping: 28 } }}
          exit={{ y: -90, opacity: 0, transition: { duration: 0.22 } }}
          onClick={onDismiss}
          style={{
            position: "fixed",
            top: "calc(16px + env(safe-area-inset-top, 0px))",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 9999,
            background: "linear-gradient(135deg, #534AB7 0%, #756AD9 100%)",
            borderRadius: 18,
            padding: "14px 20px",
            display: "flex",
            alignItems: "center",
            gap: 14,
            boxShadow: "0 10px 36px rgba(83,74,183,0.38)",
            minWidth: 270,
            maxWidth: "calc(100vw - 40px)",
            cursor: "pointer",
            userSelect: "none",
          }}>
          <span style={{ fontSize: 32, lineHeight: 1, flexShrink: 0 }}>{badge.emoji}</span>
          <div>
            <p style={{
              color: "rgba(255,255,255,0.72)",
              fontSize: 10,
              fontWeight: 700,
              margin: "0 0 3px",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}>
              Badge unlocked
            </p>
            <p style={{ color: "#fff", fontSize: 15, fontWeight: 700, margin: 0, lineHeight: 1.2 }}>
              {badge.name}
            </p>
            <p style={{ color: "rgba(255,255,255,0.78)", fontSize: 12, margin: "3px 0 0", lineHeight: 1.3 }}>
              {badge.desc}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
