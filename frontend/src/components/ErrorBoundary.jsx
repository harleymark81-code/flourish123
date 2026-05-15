import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("[Flourish] ErrorBoundary caught:", error, info);
  }

  handleReload = () => {
    // Reload bypassing cache so a stale chunk can't trap the user.
    if (typeof window !== "undefined") window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        onClick={this.handleReload}
        style={{
          position: "fixed",
          inset: 0,
          background: "#F8F7FF",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 32,
          textAlign: "center",
          cursor: "pointer",
          fontFamily: "Inter, system-ui, -apple-system, sans-serif",
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 16,
            background: "linear-gradient(135deg, #534AB7, #756AD9)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 20,
            boxShadow: "0 8px 32px rgba(83,74,183,0.3)",
          }}
        >
          <span style={{ fontSize: 30 }}>🌸</span>
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1A1A24", margin: "0 0 8px", letterSpacing: "-0.02em" }}>
          Something went wrong
        </h1>
        <p style={{ fontSize: 15, color: "#6B6A7C", margin: "0 0 24px", lineHeight: 1.5, maxWidth: 320 }}>
          Tap anywhere to reload Flourish.
        </p>
        <button
          onClick={this.handleReload}
          style={{
            background: "#534AB7",
            color: "#fff",
            border: "none",
            borderRadius: 12,
            padding: "14px 32px",
            fontWeight: 700,
            fontSize: 15,
            cursor: "pointer",
          }}
        >
          Reload app
        </button>
      </div>
    );
  }
}
