import { useEffect, useState } from "react";

// localStorage keys — namespaced so they survive other clears
const VISIT_COUNT_KEY = "fl_pwa_visit_count";
const INSTALLED_KEY = "fl_pwa_installed";
const POST_INSTALL_SEEN_KEY = "fl_pwa_post_install_seen";
const REMIND_LATER_KEY = "fl_pwa_remind_later_until";
// sessionStorage key — clears on real tab close so triggers can re-fire next visit
const PROMPT_SHOWN_SESSION_KEY = "fl_pwa_prompt_shown";
const VISIT_COUNTED_SESSION_KEY = "fl_pwa_visit_counted";

// ─── Platform detection ──────────────────────────────────────────────────────

export function isStandaloneInstalled() {
  if (typeof window === "undefined") return false;
  if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) return true;
  if (window.navigator && window.navigator.standalone === true) return true;
  return false;
}

// Returns one of: "ios-safari" | "ios-other" | "android" | "desktop" | "other".
// We split iOS by browser because add-to-home-screen only works inside Safari
// on iOS — Chrome/Firefox/etc. on iOS use WebKit but lack the share-sheet
// "Add to Home Screen" action.
export function detectPlatform() {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent || "";
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  if (isIOS) {
    // CriOS = Chrome on iOS, FxiOS = Firefox on iOS, EdgiOS = Edge on iOS,
    // OPiOS = Opera on iOS. Safari's UA includes "Safari" but not "CriOS" etc.
    const isNonSafari = /CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua) || !/Safari/.test(ua);
    return isNonSafari ? "ios-other" : "ios-safari";
  }
  if (/Android/i.test(ua)) return "android";
  if (typeof window !== "undefined" && window.innerWidth >= 1024) return "desktop";
  return "other";
}

// ─── Shared beforeinstallprompt capture ──────────────────────────────────────
// The event fires once per page load on Android Chrome — capture it at module
// load so any consumer (banner, modal, profile button) can fire the native
// prompt from the same reference.

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
    markInstalled();
  });
}

export function useDeferredInstallPrompt() {
  const [available, setAvailable] = useState(!!deferredPrompt);
  useEffect(() => {
    promptSubscribers.add(setAvailable);
    return () => promptSubscribers.delete(setAvailable);
  }, []);
  return available;
}

export async function tryNativeInstall() {
  if (!deferredPrompt) return false;
  try {
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    const accepted = choice?.outcome === "accepted";
    deferredPrompt = null;
    notifyPromptChanged();
    if (accepted) markInstalled();
    return accepted;
  } catch {
    return false;
  }
}

// ─── Installed-state persistence ─────────────────────────────────────────────

export function markInstalled() {
  try { localStorage.setItem(INSTALLED_KEY, "1"); } catch {}
}

// Returns true if either we've seen the appinstalled event OR the runtime
// reports standalone mode — once installed we never want to prompt again.
export function isInstalled() {
  if (isStandaloneInstalled()) return true;
  try { return localStorage.getItem(INSTALLED_KEY) === "1"; } catch { return false; }
}

// ─── Visit count ─────────────────────────────────────────────────────────────

export function getVisitCount() {
  try {
    const n = parseInt(localStorage.getItem(VISIT_COUNT_KEY) || "0", 10);
    return Number.isFinite(n) ? n : 0;
  } catch { return 0; }
}

// Increment exactly once per real session (sessionStorage gates this).
export function recordVisitOnce() {
  try {
    if (sessionStorage.getItem(VISIT_COUNTED_SESSION_KEY) === "1") return getVisitCount();
    const next = getVisitCount() + 1;
    localStorage.setItem(VISIT_COUNT_KEY, String(next));
    sessionStorage.setItem(VISIT_COUNTED_SESSION_KEY, "1");
    return next;
  } catch { return getVisitCount(); }
}

// ─── Session-level "already shown" gate ──────────────────────────────────────

export function wasPromptShownThisSession() {
  try { return sessionStorage.getItem(PROMPT_SHOWN_SESSION_KEY) === "1"; } catch { return false; }
}

export function markPromptShownThisSession() {
  try { sessionStorage.setItem(PROMPT_SHOWN_SESSION_KEY, "1"); } catch {}
}

// ─── Remind-me-later ─────────────────────────────────────────────────────────
// Sets a 24h cooldown after which auto triggers re-engage. Manual Profile-tab
// button ignores this — user explicitly asked, so show it anyway.

const REMIND_LATER_HOURS = 24;

export function snoozeReminder() {
  try {
    const until = Date.now() + REMIND_LATER_HOURS * 60 * 60 * 1000;
    localStorage.setItem(REMIND_LATER_KEY, String(until));
  } catch {}
}

export function isReminderSnoozed() {
  try {
    const until = parseInt(localStorage.getItem(REMIND_LATER_KEY) || "0", 10);
    return Number.isFinite(until) && Date.now() < until;
  } catch { return false; }
}

// ─── Post-install welcome ────────────────────────────────────────────────────

export function shouldShowPostInstallWelcome() {
  if (!isStandaloneInstalled()) return false;
  try { return localStorage.getItem(POST_INSTALL_SEEN_KEY) !== "1"; } catch { return false; }
}

export function markPostInstallWelcomeSeen() {
  try { localStorage.setItem(POST_INSTALL_SEEN_KEY, "1"); } catch {}
}

// ─── Trigger decision ────────────────────────────────────────────────────────
// Single source of truth for "is it OK to auto-show the install prompt right
// now?". Trigger-specific reasons (scan/subscribe/visit) layer on top of this.

export function canAutoPrompt() {
  if (isInstalled()) return false;
  if (wasPromptShownThisSession()) return false;
  if (isReminderSnoozed()) return false;
  const platform = detectPlatform();
  // Desktop and unknown-platform users can't install anyway — skip.
  if (platform === "desktop" || platform === "other") return false;
  return true;
}
