import React, { useState, useEffect, useRef } from "react";

const DISMISS_KEY = "pwa_banner_dismissed";

function isStandalone() {
  if (typeof window === "undefined") return false;
  if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) return true;
  if (window.navigator && window.navigator.standalone === true) return true;
  return false;
}

function detectPlatform() {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent || "";
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  if (isIOS) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

export default function PWAInstallBanner() {
  const [visible, setVisible] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [platform, setPlatform] = useState("other");
  const deferredPrompt = useRef(null);

  useEffect(() => {
    if (isStandalone()) return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;
    if (typeof window !== "undefined" && window.innerWidth >= 1024) return;

    const detected = detectPlatform();
    if (detected === "other") return;
    setPlatform(detected);
    setVisible(true);

    const handler = (e) => {
      e.preventDefault();
      deferredPrompt.current = e;
    };
    window.addEventListener("beforeinstallprompt", handler);

    const installedHandler = () => {
      localStorage.setItem(DISMISS_KEY, "1");
      setVisible(false);
      setShowModal(false);
    };
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
    setShowModal(false);
  };

  const openInstructions = async () => {
    if (platform === "android" && deferredPrompt.current) {
      try {
        deferredPrompt.current.prompt();
        const { outcome } = await deferredPrompt.current.userChoice;
        deferredPrompt.current = null;
        if (outcome === "accepted") {
          localStorage.setItem(DISMISS_KEY, "1");
          setVisible(false);
        }
        return;
      } catch {
        // fall through to instructions modal
      }
    }
    setShowModal(true);
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
          <button onClick={openInstructions}
            style={{ background: "#fff", color: "#534AB7", border: "none", borderRadius: 10, padding: "8px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
            Install
          </button>
          <button onClick={dismiss} aria-label="Dismiss"
            style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.75)", cursor: "pointer", padding: "4px 6px", fontSize: 22, lineHeight: 1, flexShrink: 0 }}>
            ×
          </button>
        </div>
      )}

      {showModal && (
        <div onClick={() => setShowModal(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(15,12,40,0.6)", zIndex: 9500, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 0 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: "var(--bg-card, #fff)", maxWidth: 480, width: "100%", borderRadius: "20px 20px 0 0", padding: "24px 22px calc(28px + env(safe-area-inset-bottom, 0px))", boxShadow: "0 -8px 32px rgba(0,0,0,0.25)" }}>
            <div style={{ width: 40, height: 4, background: "rgba(0,0,0,0.15)", borderRadius: 4, margin: "0 auto 18px" }} />
            <p style={{ fontSize: 19, fontWeight: 800, color: "var(--text-primary, #1A1A24)", margin: "0 0 4px", letterSpacing: "-0.01em" }}>Install Flourish</p>
            <p style={{ fontSize: 13, color: "var(--text-secondary, #6B6A7C)", margin: "0 0 18px" }}>
              {platform === "ios" ? "Add to your iPhone home screen in 3 quick steps." : "Add to your Android home screen in 3 quick steps."}
            </p>

            {platform === "ios" ? (
              <Steps
                steps={[
                  { n: 1, body: <>Tap the <strong>Share</strong> button <span aria-hidden style={{ display: "inline-block", verticalAlign: "middle", marginLeft: 4 }}>
                    <svg width="16" height="20" viewBox="0 0 16 20" fill="none"><path d="M8 13V2M8 2L4 6M8 2L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /><path d="M2 10v6a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                  </span> at the bottom of Safari.</> },
                  { n: 2, body: <>Scroll down and tap <strong>Add to Home Screen</strong>.</> },
                  { n: 3, body: <>Tap <strong>Add</strong> in the top right. Flourish will appear on your home screen.</> },
                ]}
              />
            ) : (
              <Steps
                steps={[
                  { n: 1, body: <>Tap the <strong>menu</strong> icon (three dots ⋮) in the top right of Chrome.</> },
                  { n: 2, body: <>Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.</> },
                  { n: 3, body: <>Tap <strong>Install</strong> or <strong>Add</strong>. Flourish will appear on your home screen.</> },
                ]}
              />
            )}

            {platform === "ios" && (
              <p style={{ fontSize: 12, color: "var(--text-muted, #9A98AC)", margin: "16px 0 0", lineHeight: 1.5 }}>
                Note: this only works in Safari on iOS — not Chrome or other browsers.
              </p>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
              <button onClick={dismiss}
                style={{ flex: 1, background: "transparent", color: "var(--text-secondary, #6B6A7C)", border: "1px solid var(--border, #E0DEF2)", borderRadius: 12, padding: "12px", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
                Don't show again
              </button>
              <button onClick={() => setShowModal(false)}
                style={{ flex: 1, background: "#534AB7", color: "#fff", border: "none", borderRadius: 12, padding: "12px", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Steps({ steps }) {
  return (
    <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
      {steps.map(s => (
        <li key={s.n} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <span style={{ flexShrink: 0, width: 26, height: 26, borderRadius: "50%", background: "rgba(83,74,183,0.12)", color: "#534AB7", fontWeight: 800, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}>{s.n}</span>
          <span style={{ fontSize: 14, color: "var(--text-primary, #1A1A24)", lineHeight: 1.5 }}>{s.body}</span>
        </li>
      ))}
    </ol>
  );
}
