import React from "react";

// Finding 8.D — Cookie Policy page shell. Copy to be supplied by Harley.
// Route: /cookies (see App.js pathname routing).

export default function CookiePolicy() {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px", minHeight: "100vh", background: "var(--bg-app)", color: "var(--text-primary)" }}>
      <a href="/" style={{ color: "#534AB7", fontSize: 14, fontWeight: 600, textDecoration: "none" }}>← Back to Flourish</a>
      <h1 style={{ fontSize: 32, fontWeight: 800, margin: "24px 0 8px", letterSpacing: "-0.02em" }}>Cookie Policy</h1>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 32px" }}>Last updated: TODO</p>

      <section style={{ fontSize: 15, lineHeight: 1.7, color: "var(--text-secondary)" }}>
        {/* TODO: paste Harley's Cookie Policy copy here.
            Should cover, at minimum:
            - Essential cookies (auth session cookie — access_token, httpOnly, SameSite=None; Secure)
            - Analytics cookies (PostHog EU — only set after explicit consent)
            - localStorage keys we use (fl_token, fl_ref, affiliate_code, fl_consent, welcome_back_seen, splash_shown)
            - How to withdraw consent (link to reset — see below)
            - Third-party cookies via Stripe checkout (during payment only) */}
        <p style={{ margin: 0 }}>
          <em>Cookie Policy copy pending. This shell is in place so the consent banner link resolves.</em>
        </p>
        <p style={{ marginTop: 24 }}>
          <button
            onClick={() => { localStorage.removeItem("fl_consent"); window.location.href = "/"; }}
            style={{
              background: "none", border: "1px solid var(--border)", borderRadius: 10,
              padding: "10px 16px", color: "var(--text-primary)", fontWeight: 600, fontSize: 14,
              cursor: "pointer",
            }}>
            Reset my consent choice
          </button>
        </p>
      </section>
    </div>
  );
}
