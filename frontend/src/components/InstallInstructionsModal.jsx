import React from "react";

export default function InstallInstructionsModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);

  const steps = isIOS
    ? [
        { num: "1", text: "Tap the Share button (\u{25A1}↑) at the bottom of Safari" },
        { num: "2", text: "Scroll down and tap “Add to Home Screen”" },
        { num: "3", text: "Tap “Add” in the top right corner" },
      ]
    : [
        { num: "1", text: "Tap the menu (⋮) in the top right of your browser" },
        { num: "2", text: "Tap “Add to Home screen”" },
        { num: "3", text: "Tap “Add” to confirm" },
      ];

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        zIndex: 9900,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        padding: "0 0 80px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 20,
          padding: 24,
          width: "100%",
          maxWidth: 440,
          margin: "0 16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: "#1A1A24", margin: 0 }}>Install Flourish</h3>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#6B6A7C", lineHeight: 1 }}
          >
            ×
          </button>
        </div>
        <p style={{ fontSize: 14, color: "#6B6A7C", marginBottom: 20 }}>
          {isIOS ? "Follow these steps in Safari:" : "Follow these steps in Chrome:"}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {steps.map((step) => (
            <div key={step.num} style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              <div style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "#534AB7",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: 13,
                flexShrink: 0,
              }}>
                {step.num}
              </div>
              <p style={{ fontSize: 14, color: "#1A1A24", margin: "4px 0 0", lineHeight: 1.5 }}>{step.text}</p>
            </div>
          ))}
        </div>
        <button
          onClick={onClose}
          style={{
            width: "100%",
            background: "#534AB7",
            color: "#fff",
            border: "none",
            borderRadius: 12,
            padding: 14,
            fontWeight: 700,
            fontSize: 15,
            cursor: "pointer",
            marginTop: 24,
          }}
        >
          Got it
        </button>
      </div>
    </div>
  );
}
