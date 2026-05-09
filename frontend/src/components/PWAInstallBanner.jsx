import React, { useState, useEffect, useRef } from "react";

export default function PWAInstallBanner() {
  const [visible, setVisible] = useState(false);
  const deferredPrompt = useRef(null);

  useEffect(() => {
    if (window.innerWidth >= 768) return;

    const today = new Date().toISOString().split("T")[0];
    if (localStorage.getItem("pwa_banner_dismissed") === today) return;

    const handler = (e) => {
      e.preventDefault();
      deferredPrompt.current = e;
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    const today = new Date().toISOString().split("T")[0];
    localStorage.setItem("pwa_banner_dismissed", today);
    setVisible(false);
  };

  const install = async () => {
    if (!deferredPrompt.current) return;
    deferredPrompt.current.prompt();
    const { outcome } = await deferredPrompt.current.userChoice;
    deferredPrompt.current = null;
    setVisible(false);
    if (outcome === "dismissed") {
      const today = new Date().toISOString().split("T")[0];
      localStorage.setItem("pwa_banner_dismissed", today);
    }
  };

  return (
    <div style={{
      position: "fixed",
      bottom: 70,
      left: 0,
      right: 0,
      maxWidth: 480,
      margin: "0 auto",
      background: "#534AB7",
      padding: "14px 16px",
      borderRadius: "16px 16px 0 0",
      boxShadow: "0 -4px 20px rgba(0,0,0,0.2)",
      zIndex: 8900,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    }}>
      <div style={{ flex: 1 }}>
        <p style={{ color: "#fff", fontWeight: 700, fontSize: 14, margin: 0, lineHeight: 1.3 }}>
          Install Flourish
        </p>
        <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, margin: "2px 0 0" }}>
          Get the best experience on your phone
        </p>
      </div>
      <button
        onClick={install}
        style={{
          background: "#fff",
          color: "#534AB7",
          border: "none",
          borderRadius: 10,
          padding: "8px 14px",
          fontWeight: 700,
          fontSize: 13,
          cursor: "pointer",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        Add to Home Screen
      </button>
      <button
        onClick={dismiss}
        style={{
          background: "transparent",
          border: "none",
          color: "rgba(255,255,255,0.7)",
          cursor: "pointer",
          padding: "4px 6px",
          display: "flex",
          alignItems: "center",
          flexShrink: 0,
          fontSize: 20,
          lineHeight: 1,
        }}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
