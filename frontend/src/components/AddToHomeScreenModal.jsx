import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Share2, Plus, Home, MoreVertical, Download, Smartphone, Check, X,
  ArrowDown, ChevronRight, Compass,
} from "lucide-react";
import {
  detectPlatform,
  isStandaloneInstalled,
  isInstalled,
  useDeferredInstallPrompt,
  tryNativeInstall,
  snoozeReminder,
} from "../lib/pwaInstall";

// Re-export for any older imports that still pull from here.
export { isStandaloneInstalled, detectPlatform };

const PRI = "#534AB7";
const PRI_TINT = "rgba(83,74,183,0.10)";

// ─── iOS step-by-step content ────────────────────────────────────────────────
const IOS_STEPS = [
  {
    title: "Tap the share button below",
    body: "It's in Safari's toolbar at the bottom of your screen — a square with an arrow pointing up.",
    icon: <Share2 size={48} color={PRI} />,
    arrow: true,
  },
  {
    title: "Scroll down and tap “Add to Home Screen”",
    body: "It's about halfway down the share sheet.",
    icon: <Plus size={48} color={PRI} />,
    arrow: false,
  },
  {
    title: "Tap “Add” in the top right",
    body: "Flourish will appear on your home screen, ready to launch like a native app.",
    icon: <Home size={48} color={PRI} />,
    arrow: false,
  },
  {
    title: "Done — open Flourish from your home screen",
    body: "Close Safari and tap the new Flourish icon. You're all set.",
    icon: null, // tick animation rendered inline
    arrow: false,
    isFinal: true,
  },
];

// ─── Android manual-flow content (for non-Chrome Android) ────────────────────
const ANDROID_MANUAL_STEPS = [
  {
    title: "Open the Chrome menu",
    body: "Tap the three dots in the top-right corner of your browser.",
    icon: <MoreVertical size={48} color={PRI} />,
  },
  {
    title: "Pick “Install app”",
    body: "On some devices this reads as “Add to Home screen”.",
    icon: <Download size={48} color={PRI} />,
  },
  {
    title: "Confirm “Install”",
    body: "Flourish will land on your home screen.",
    icon: <Home size={48} color={PRI} />,
  },
];

// ─── Sub-components ──────────────────────────────────────────────────────────

function StepIllustration({ icon, arrow }) {
  return (
    <div style={{
      width: "100%",
      minHeight: 160,
      borderRadius: 20,
      background: PRI_TINT,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 16,
      padding: 24,
      marginBottom: 20,
    }}>
      <div style={{
        width: 84, height: 84, borderRadius: 22,
        background: "#fff",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 8px 28px rgba(83,74,183,0.18)",
      }}>
        {icon}
      </div>
      {arrow && (
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
          style={{ color: PRI, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <ArrowDown size={28} />
        </motion.div>
      )}
    </div>
  );
}

function FinalTick() {
  return (
    <div style={{
      width: "100%",
      minHeight: 160,
      borderRadius: 20,
      background: "rgba(99,153,34,0.10)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 20,
    }}>
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 280, damping: 16 }}
        style={{
          width: 84, height: 84, borderRadius: "50%",
          background: "#639922",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 8px 28px rgba(99,153,34,0.32)",
        }}
      >
        <Check size={44} color="#fff" strokeWidth={3} />
      </motion.div>
    </div>
  );
}

function ProgressDots({ total, current }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 18 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          width: i === current ? 28 : 8,
          height: 8,
          borderRadius: 4,
          background: i <= current ? PRI : "rgba(83,74,183,0.18)",
          transition: "all 240ms ease",
        }} />
      ))}
    </div>
  );
}

// ─── Branches ────────────────────────────────────────────────────────────────

function IOSOtherBrowserBranch({ onRemindLater, onClose }) {
  const url = typeof window !== "undefined" ? window.location.href : "";
  const copyUrl = async () => {
    try { await navigator.clipboard.writeText(url); } catch {}
  };
  return (
    <>
      <div style={{
        width: "100%",
        minHeight: 160,
        borderRadius: 20,
        background: PRI_TINT,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 20,
      }}>
        <div style={{
          width: 84, height: 84, borderRadius: 22, background: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 8px 28px rgba(83,74,183,0.18)",
        }}>
          <Compass size={48} color={PRI} />
        </div>
      </div>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary, #1A1A24)", margin: "0 0 8px", textAlign: "center", letterSpacing: "-0.01em" }}>
        Open this page in Safari
      </h2>
      <p style={{ fontSize: 14, color: "var(--text-secondary, #6B6A7C)", margin: "0 0 16px", textAlign: "center", lineHeight: 1.55 }}>
        On iPhone, Flourish can only be added to your home screen from <strong>Safari</strong> — other browsers don't support it.
      </p>
      <button
        onClick={copyUrl}
        style={{
          width: "100%", background: PRI, color: "#fff", border: "none",
          borderRadius: 14, padding: "14px", fontWeight: 700, fontSize: 15,
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          marginBottom: 10,
        }}
      >
        Copy link
      </button>
      <p style={{ fontSize: 12, color: "var(--text-muted, #9A98AC)", margin: "0 0 18px", textAlign: "center", lineHeight: 1.5 }}>
        Then open Safari, paste the link, and follow the install steps.
      </p>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
        <button
          onClick={onRemindLater}
          style={{ background: "none", border: "none", color: "var(--text-secondary, #6B6A7C)", fontSize: 13, cursor: "pointer", textDecoration: "underline" }}
        >
          Remind me later
        </button>
        <button
          onClick={onClose}
          style={{ background: "none", border: "none", color: "var(--text-muted, #9A98AC)", fontSize: 12, cursor: "pointer", padding: 4 }}
        >
          Close
        </button>
      </div>
    </>
  );
}

function AndroidNativeBranch({ onClose, onRemindLater }) {
  const [installing, setInstalling] = useState(false);
  const [installed, setInstalled] = useState(false);
  const handle = async () => {
    setInstalling(true);
    const ok = await tryNativeInstall();
    setInstalling(false);
    if (ok) {
      setInstalled(true);
      setTimeout(onClose, 1200);
    }
  };

  if (installed) {
    return (
      <>
        <FinalTick />
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary, #1A1A24)", margin: "0 0 8px", textAlign: "center" }}>
          Installed
        </h2>
        <p style={{ fontSize: 14, color: "var(--text-secondary, #6B6A7C)", margin: 0, textAlign: "center" }}>
          Open Flourish from your home screen.
        </p>
      </>
    );
  }

  return (
    <>
      <div style={{
        display: "flex", alignItems: "center", gap: 14,
        background: PRI_TINT,
        padding: 18, borderRadius: 16, marginBottom: 18,
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 14, background: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 16px rgba(83,74,183,0.15)",
          fontSize: 30,
        }}>
          🌸
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary, #1A1A24)", margin: 0 }}>Flourish</p>
          <p style={{ fontSize: 13, color: "var(--text-secondary, #6B6A7C)", margin: "2px 0 0" }}>
            Works offline · Faster than browser
          </p>
        </div>
      </div>
      <button
        onClick={handle}
        disabled={installing}
        style={{
          width: "100%", background: PRI, color: "#fff", border: "none",
          borderRadius: 14, padding: "16px", fontWeight: 800, fontSize: 16,
          cursor: installing ? "default" : "pointer", opacity: installing ? 0.7 : 1,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          marginBottom: 14,
        }}
      >
        <Download size={18} /> {installing ? "Installing…" : "Install Flourish"}
      </button>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <button
          onClick={onRemindLater}
          style={{ background: "none", border: "none", color: "var(--text-secondary, #6B6A7C)", fontSize: 13, cursor: "pointer", textDecoration: "underline" }}
        >
          Remind me later
        </button>
      </div>
    </>
  );
}

function StepByStepBranch({ steps, onClose, onRemindLater, dismissible }) {
  const [i, setI] = useState(0);
  const step = steps[i];
  const isLast = i === steps.length - 1;

  return (
    <>
      <ProgressDots total={steps.length} current={i} />
      <motion.div
        key={i}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.25 }}
      >
        {step.isFinal ? <FinalTick /> : <StepIllustration icon={step.icon} arrow={!!step.arrow} />}
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary, #1A1A24)", margin: "0 0 8px", textAlign: "center", letterSpacing: "-0.01em" }}>
          {step.title}
        </h2>
        <p style={{ fontSize: 14, color: "var(--text-secondary, #6B6A7C)", margin: "0 0 22px", textAlign: "center", lineHeight: 1.55 }}>
          {step.body}
        </p>
      </motion.div>

      <button
        onClick={() => (isLast ? onClose() : setI(i + 1))}
        style={{
          width: "100%", background: PRI, color: "#fff", border: "none",
          borderRadius: 14, padding: "16px", fontWeight: 800, fontSize: 16,
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          marginBottom: 12,
        }}
      >
        {isLast ? "Got it" : "Next"} {!isLast && <ChevronRight size={18} />}
      </button>

      {!isLast && dismissible && (
        <div style={{ display: "flex", justifyContent: "center" }}>
          <button
            onClick={onRemindLater}
            style={{ background: "none", border: "none", color: "var(--text-secondary, #6B6A7C)", fontSize: 13, cursor: "pointer", textDecoration: "underline" }}
          >
            Remind me later
          </button>
        </div>
      )}
    </>
  );
}

// ─── Main modal ──────────────────────────────────────────────────────────────

export default function AddToHomeScreenModal({ open, onClose, onDismissForever }) {
  const platform = detectPlatform();
  const nativeAvailable = useDeferredInstallPrompt();

  // Don't render if the user already installed — belt-and-braces; the manager
  // also gates this, but Profile can open the modal directly.
  if (open && isInstalled()) {
    // Schedule close on next tick so the parent can react.
    setTimeout(onClose, 0);
    return null;
  }

  const handleRemindLater = () => {
    snoozeReminder();
    onClose?.();
  };

  // iOS Safari & Android-manual: the spec says step-by-step "cannot be
  // dismissed by tapping outside (too important)". Android one-tap and
  // iOS-other are short single-screens — they can dismiss freely.
  const isStepByStep =
    platform === "ios-safari" ||
    (platform === "android" && !nativeAvailable);

  const canDismissBackdrop = !isStepByStep;

  let bodyContent;
  if (platform === "ios-safari") {
    bodyContent = (
      <StepByStepBranch
        steps={IOS_STEPS}
        onClose={onClose}
        onRemindLater={handleRemindLater}
        dismissible
      />
    );
  } else if (platform === "ios-other") {
    bodyContent = <IOSOtherBrowserBranch onRemindLater={handleRemindLater} onClose={onClose} />;
  } else if (platform === "android" && nativeAvailable) {
    bodyContent = <AndroidNativeBranch onClose={onClose} onRemindLater={handleRemindLater} />;
  } else if (platform === "android") {
    bodyContent = (
      <StepByStepBranch
        steps={ANDROID_MANUAL_STEPS}
        onClose={onClose}
        onRemindLater={handleRemindLater}
        dismissible
      />
    );
  } else {
    // desktop / unknown
    bodyContent = (
      <div style={{
        padding: 18, background: PRI_TINT,
        border: `1px solid ${PRI_TINT}`, borderRadius: 14, marginBottom: 12,
      }}>
        <p style={{ margin: 0, fontSize: 14, color: "var(--text-secondary, #6B6A7C)", lineHeight: 1.55 }}>
          Open <strong>theflourishapp.health</strong> on your phone's browser to add Flourish to your home screen.
        </p>
      </div>
    );
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => canDismissBackdrop && onClose?.()}
          style={{
            position: "fixed", inset: 0, zIndex: 9700,
            background: "rgba(15,12,40,0.65)",
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
              padding: "10px 22px calc(24px + env(safe-area-inset-bottom, 0px))",
              boxShadow: "0 -8px 32px rgba(0,0,0,0.25)",
              maxHeight: "94vh", overflowY: "auto",
            }}>
            <div style={{ width: 44, height: 4, background: "rgba(0,0,0,0.15)", borderRadius: 4, margin: "8px auto 16px" }} />

            {/* Header — close button only on dismissible branches */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: PRI_TINT, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Smartphone size={18} color={PRI} />
                </div>
                <p style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary, #1A1A24)", margin: 0, letterSpacing: "-0.01em" }}>Install Flourish</p>
              </div>
              {canDismissBackdrop && (
                <button onClick={onClose} aria-label="Close"
                  style={{ background: "transparent", border: "none", padding: 8, cursor: "pointer", color: "var(--text-secondary, #6B6A7C)", lineHeight: 0 }}>
                  <X size={20} />
                </button>
              )}
            </div>

            {bodyContent}

            {/* Legacy "Don't show again" path — only the old Profile-tab call
                site passes onDismissForever. New triggers use snoozeReminder
                via the "Remind me later" link. */}
            {onDismissForever && !isStepByStep && (
              <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
                <button onClick={onDismissForever}
                  style={{ background: "none", border: "none", color: "var(--text-muted, #9A98AC)", fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>
                  Don't show again
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
