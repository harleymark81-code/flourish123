import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Share2, Plus, Home, MoreVertical, Download, Smartphone, Check, X } from "lucide-react";

// ─── Shared install state ──────────────────────────────────────────────────────
// The `beforeinstallprompt` event only fires once per page load on Android
// Chrome. We capture it at module load so the banner AND the Profile tab can
// both trigger the native install prompt from a single shared reference.

let deferredPrompt = null;
const promptSubscribers = new Set();

function notifyPromptChanged() {
  promptSubscribers.forEach((fn) => fn(!!deferredPrompt));
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    notifyPromptChanged();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    notifyPromptChanged();
  });
}

export function isStandaloneInstalled() {
  if (typeof window === "undefined") return false;
  if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) return true;
  if (window.navigator && window.navigator.standalone === true) return true;
  return false;
}

export function detectPlatform() {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent || "";
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  if (isIOS) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

export function useDeferredInstallPrompt() {
  const [available, setAvailable] = useState(!!deferredPrompt);
  useEffect(() => {
    promptSubscribers.add(setAvailable);
    return () => promptSubscribers.delete(setAvailable);
  }, []);
  return available;
}

// Returns true if the user accepted the native install prompt.
async function tryNativeInstall() {
  if (!deferredPrompt) return false;
  try {
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    const accepted = choice?.outcome === "accepted";
    deferredPrompt = null;
    notifyPromptChanged();
    return accepted;
  } catch {
    return false;
  }
}

// ─── Modal ─────────────────────────────────────────────────────────────────────

const PRI = "#534AB7";
const PRI_TINT = "rgba(83,74,183,0.10)";

function StepIcon({ children }) {
  return (
    <div style={{
      width: 44, height: 44, borderRadius: 12, background: PRI_TINT,
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
    }}>
      {children}
    </div>
  );
}

function Step({ n, icon, title, body }) {
  return (
    <li style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "12px 0" }}>
      <StepIcon>{icon}</StepIcon>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin: 0,
          fontSize: 11,
          fontWeight: 800,
          color: PRI,
          textTransform: "uppercase",
          letterSpacing: 0.7,
          marginBottom: 2,
        }}>Step {n}</p>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--text-primary, #1A1A24)", lineHeight: 1.35 }}>{title}</p>
        {body && <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-secondary, #6B6A7C)", lineHeight: 1.5 }}>{body}</p>}
      </div>
    </li>
  );
}

const IOS_STEPS = [
  {
    n: 1,
    icon: <Share2 size={22} color={PRI} />,
    title: "Tap the Share button",
    body: "It sits in the toolbar at the bottom of Safari — the square with an arrow pointing up.",
  },
  {
    n: 2,
    icon: <Plus size={22} color={PRI} />,
    title: "Choose “Add to Home Screen”",
    body: "Scroll down the share sheet until you see it.",
  },
  {
    n: 3,
    icon: <Home size={22} color={PRI} />,
    title: "Tap “Add”",
    body: "Flourish will appear on your home screen, ready to launch like a native app.",
  },
];

const ANDROID_MANUAL_STEPS = [
  {
    n: 1,
    icon: <MoreVertical size={22} color={PRI} />,
    title: "Open the Chrome menu",
    body: "Tap the three dots in the top-right corner of Chrome.",
  },
  {
    n: 2,
    icon: <Download size={22} color={PRI} />,
    title: "Pick “Install app”",
    body: "On some devices this reads as “Add to Home screen”.",
  },
  {
    n: 3,
    icon: <Home size={22} color={PRI} />,
    title: "Confirm “Install”",
    body: "Flourish will land on your home screen.",
  },
];

export default function AddToHomeScreenModal({ open, onClose, onDismissForever }) {
  const platform = detectPlatform();
  const nativeAvailable = useDeferredInstallPrompt();
  const [installing, setInstalling] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (!open) {
      setInstalling(false);
      setInstalled(false);
    }
  }, [open]);

  const handleNativeInstall = async () => {
    setInstalling(true);
    const ok = await tryNativeInstall();
    setInstalling(false);
    if (ok) {
      setInstalled(true);
      setTimeout(() => onClose?.(), 1200);
    }
  };

  // If we somehow opened the modal on an unsupported platform, render a generic
  // "open this on your phone" message rather than nothing — easier to debug.
  const isUnsupported = platform === "other";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          style={{
            position: "fixed", inset: 0, zIndex: 9700,
            background: "rgba(15,12,40,0.6)",
            display: "flex", alignItems: "flex-end", justifyContent: "center",
          }}>
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0, transition: { type: "spring", damping: 30, stiffness: 280 } }}
            exit={{ y: "100%" }}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--bg-card, #fff)",
              borderRadius: "24px 24px 0 0",
              maxWidth: 480, width: "100%",
              padding: "10px 22px calc(28px + env(safe-area-inset-bottom, 0px))",
              boxShadow: "0 -8px 32px rgba(0,0,0,0.25)",
              maxHeight: "92vh", overflowY: "auto",
            }}>
            <div style={{ width: 44, height: 4, background: "rgba(0,0,0,0.15)", borderRadius: 4, margin: "8px auto 18px" }} />

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: PRI_TINT, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Smartphone size={18} color={PRI} />
                </div>
                <p style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary, #1A1A24)", margin: 0, letterSpacing: "-0.01em" }}>Install Flourish</p>
              </div>
              <button onClick={onClose} aria-label="Close"
                style={{ background: "transparent", border: "none", padding: 8, cursor: "pointer", color: "var(--text-secondary, #6B6A7C)", lineHeight: 0 }}>
                <X size={20} />
              </button>
            </div>
            <p style={{ fontSize: 13, color: "var(--text-secondary, #6B6A7C)", margin: "4px 0 18px", lineHeight: 1.5 }}>
              {platform === "ios"
                ? "Add Flourish to your iPhone home screen — it’ll open like a native app, full-screen, with offline support."
                : platform === "android"
                  ? "Add Flourish to your Android home screen — opens like a native app, full-screen."
                  : "Open this page on your phone’s browser to install Flourish on your home screen."}
            </p>

            {installed ? (
              <div style={{
                display: "flex", alignItems: "center", gap: 12, padding: 16,
                background: "rgba(99,153,34,0.10)", border: "1px solid rgba(99,153,34,0.3)",
                borderRadius: 14, marginBottom: 8,
              }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "#639922", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Check size={18} color="#fff" />
                </div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--text-primary, #1A1A24)" }}>Installed — find Flourish on your home screen.</p>
              </div>
            ) : isUnsupported ? (
              <div style={{
                padding: 16, background: "rgba(83,74,183,0.06)",
                border: "1px solid rgba(83,74,183,0.18)", borderRadius: 14, marginBottom: 8,
              }}>
                <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary, #6B6A7C)", lineHeight: 1.55 }}>
                  Visit <strong>theflourishapp.health</strong> from your phone’s browser to add Flourish to your home screen.
                </p>
              </div>
            ) : platform === "android" && nativeAvailable ? (
              <>
                <p style={{ margin: "0 0 14px", fontSize: 14, color: "var(--text-primary, #1A1A24)", lineHeight: 1.5 }}>
                  Your browser supports one-tap install — no manual steps required.
                </p>
                <button
                  onClick={handleNativeInstall}
                  disabled={installing}
                  style={{
                    width: "100%", background: PRI, color: "#fff", border: "none",
                    borderRadius: 14, padding: "16px", fontWeight: 700, fontSize: 15,
                    cursor: installing ? "default" : "pointer", opacity: installing ? 0.7 : 1,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  }}>
                  <Download size={18} /> {installing ? "Installing…" : "Install Flourish"}
                </button>
              </>
            ) : (
              <>
                <ol style={{ listStyle: "none", padding: 0, margin: "0 0 12px" }}>
                  {(platform === "ios" ? IOS_STEPS : ANDROID_MANUAL_STEPS).map((s) => (
                    <Step key={s.n} {...s} />
                  ))}
                </ol>
                {platform === "ios" && (
                  <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--text-muted, #9A98AC)", lineHeight: 1.5 }}>
                    Note: this only works inside Safari — other iOS browsers can’t add to the home screen.
                  </p>
                )}
              </>
            )}

            {!installed && !isUnsupported && (
              <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
                {onDismissForever && (
                  <button onClick={onDismissForever}
                    style={{ flex: 1, background: "transparent", color: "var(--text-secondary, #6B6A7C)", border: "1px solid var(--border, #E0DEF2)", borderRadius: 12, padding: "12px", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
                    Don’t show again
                  </button>
                )}
                <button onClick={onClose}
                  style={{ flex: 1, background: onDismissForever ? PRI : "var(--bg-card, #fff)",
                           color: onDismissForever ? "#fff" : "var(--text-primary, #1A1A24)",
                           border: onDismissForever ? "none" : "1px solid var(--border, #E0DEF2)",
                           borderRadius: 12, padding: "12px", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                  Got it
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
