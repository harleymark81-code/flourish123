// Finding 8.A — build-time hard-fail if REACT_APP_POSTHOG_KEY is missing or a
// known placeholder. Prevents shipping a production build with analytics
// silently disabled. Runs as `npm run build`'s pre-step (see package.json).
//
// The Netlify build sets REACT_APP_POSTHOG_KEY from the dashboard env panel;
// if that panel entry is missing or accidentally set to a placeholder, the
// build fails loudly here rather than deploying a zero-analytics site.

const key = (process.env.REACT_APP_POSTHOG_KEY || "").trim();

const PLACEHOLDERS = new Set([
  "",
  "phc_PLACEHOLDER",
  "phc_REPLACE_WITH_YOUR_KEY",
]);

const looksLikeRealKey = key.startsWith("phc_") && !PLACEHOLDERS.has(key);

if (!looksLikeRealKey) {
  const shown = key ? `'${key}'` : "<unset>";
  console.error("");
  console.error("╔════════════════════════════════════════════════════════════════════╗");
  console.error("║  BUILD BLOCKED — REACT_APP_POSTHOG_KEY missing or placeholder      ║");
  console.error("╠════════════════════════════════════════════════════════════════════╣");
  console.error(`║  Current value: ${shown.padEnd(50)} ║`);
  console.error("║                                                                    ║");
  console.error("║  Set REACT_APP_POSTHOG_KEY in the Netlify env panel to a real      ║");
  console.error("║  phc_… key from PostHog EU cloud, then retry the build.            ║");
  console.error("║                                                                    ║");
  console.error("║  This check exists because a silently-disabled analytics build     ║");
  console.error("║  would ship to production without anyone noticing (finding 8.A).   ║");
  console.error("╚════════════════════════════════════════════════════════════════════╝");
  console.error("");
  process.exit(1);
}

console.log(`[prebuild] REACT_APP_POSTHOG_KEY OK (${key.slice(0, 8)}…)`);
