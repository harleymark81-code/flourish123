import React from "react";

// Finding 8.D — Privacy Policy page shell. Copy to be supplied by Harley.
// Route: /privacy (see App.js pathname routing).

export default function PrivacyPolicy() {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px", minHeight: "100vh", background: "var(--bg-app)", color: "var(--text-primary)" }}>
      <a href="/" style={{ color: "#534AB7", fontSize: 14, fontWeight: 600, textDecoration: "none" }}>← Back to Flourish</a>
      <h1 style={{ fontSize: 32, fontWeight: 800, margin: "24px 0 8px", letterSpacing: "-0.02em" }}>Privacy Policy</h1>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 32px" }}>Last updated: TODO</p>

      <section style={{ fontSize: 15, lineHeight: 1.7, color: "var(--text-secondary)" }}>
        {/* TODO: paste Harley's Privacy Policy copy here.
            Should cover, at minimum:
            - Data controller identity + contact
            - What data we collect (account, health conditions, symptoms, food logs)
            - Legal basis (consent for analytics + health data, contract for service)
            - Third-party processors (Stripe, Resend, PostHog EU, Anthropic, MongoDB Atlas)
            - Data retention + deletion
            - User rights (access, rectification, erasure, portability)
            - International transfers
            - Complaints (ICO for UK users) */}
        <p style={{ margin: 0 }}>
          <em>Privacy Policy copy pending. This shell is in place so the consent banner and footer links resolve.</em>
        </p>
      </section>
    </div>
  );
}
