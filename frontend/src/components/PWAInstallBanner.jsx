import React, { useState, useEffect } from "react";
import AddToHomeScreenModal, { isStandaloneInstalled, detectPlatform } from "./AddToHomeScreenModal";

const DISMISS_KEY = "pwa_banner_dismissed";

export default function PWAInstallBanner() {
  const [visible, setVisible] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (isStandaloneInstalled()) return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;
    if (typeof window !== "undefined" && window.innerWidth >= 1024) return;
    if (detectPlatform() === "other") return;
    setVisible(true);

    const installedHandler = () => {
      localStorage.setItem(DISMISS_KEY, "1");
      setVisible(false);
      setShowModal(false);
    };
    window.addEventListener("appinstalled", installedHandler);
    return () => window.removeEventListener("appinstalled", installedHandler);
  }, []);

  const dismissForever = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
    setShowModal(false);
  };

  if (!visible && !showModal) return null;

  return (
    <>
      {visible && (
        <div style={{
          position: "fixed",
          bottom: "calc(78px + env(safe-area-inset-bottom, 0px))",
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
            <p style={{ color: "#fff", fontWeight: 700, fontSize: 14, margin: 0, lineHeight: 1.3 }}>Install Flourish</p>
            <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 12, margin: "2px 0 0" }}>Add to your home screen for the best experience</p>
          </div>
          <button onClick={() => setShowModal(true)}
            style={{ background: "#fff", color: "#534AB7", border: "none", borderRadius: 10, padding: "8px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
            Install
          </button>
          <button onClick={dismissForever} aria-label="Dismiss"
            style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.75)", cursor: "pointer", padding: "4px 6px", fontSize: 22, lineHeight: 1, flexShrink: 0 }}>
            ×
          </button>
        </div>
      )}

      <AddToHomeScreenModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onDismissForever={dismissForever}
      />
    </>
  );
}
