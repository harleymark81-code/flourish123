import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function SplashScreen({ onComplete }) {
  const [phase, setPhase] = useState("show"); // show -> fade -> done

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("fade"), 400);
    const t2 = setTimeout(() => { setPhase("done"); onComplete(); }, 800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onComplete]);

  if (phase === "done") return null;

  return (
    <motion.div
      animate={{ opacity: phase === "fade" ? 0 : 1 }}
      transition={{ duration: 0.4 }}
      style={{ position: "fixed", inset: 0, background: "#fff", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
      <motion.div
        animate={{ scale: phase === "fade" ? 1 : [1, 1.05, 1] }}
        transition={{ duration: 0.4, times: [0, 0.5, 1] }}>
        <div style={{ width: 88, height: 88, borderRadius: 22, background: "linear-gradient(135deg, #534AB7, #756AD9)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 12px 40px rgba(83,74,183,0.3)" }}>
          <span style={{ fontSize: 44 }}>🌸</span>
        </div>
      </motion.div>
      <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        style={{ fontSize: 32, fontWeight: 700, color: "#1A1A24", marginTop: 16, letterSpacing: -0.5 }}>
        Flourish
      </motion.h1>
    </motion.div>
  );
}
