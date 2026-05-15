import React, { useEffect, useState } from "react";
import AddToHomeScreenModal from "./AddToHomeScreenModal";
import {
  canAutoPrompt,
  isInstalled,
  markPromptShownThisSession,
  recordVisitOnce,
} from "../lib/pwaInstall";

// Custom event names emitted from other parts of the app.
export const EV_SCAN_COMPLETED = "flourish:scan-completed";
export const EV_SUBSCRIBED = "flourish:subscribed";

// Min visits before the silent visit-3+ trigger fires.
const VISIT_THRESHOLD = 3;
// Slight delay on auto-open so the trigger feels reactive but not jarring —
// avoids opening on top of a still-animating success state.
const AUTO_OPEN_DELAY_MS = 900;

export default function InstallPromptManager() {
  const [open, setOpen] = useState(false);

  const tryOpen = () => {
    if (!canAutoPrompt()) return;
    markPromptShownThisSession();
    setOpen(true);
  };

  // Visit-3+ trigger. Increments once per session, then schedules an open if
  // we've cleared the threshold and nothing else has already shown the prompt
  // this session.
  useEffect(() => {
    if (isInstalled()) return;
    const count = recordVisitOnce();
    if (count < VISIT_THRESHOLD) return;
    const t = setTimeout(tryOpen, AUTO_OPEN_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  // Scan-completed + subscribed event triggers.
  useEffect(() => {
    const onTrigger = () => setTimeout(tryOpen, AUTO_OPEN_DELAY_MS);
    window.addEventListener(EV_SCAN_COMPLETED, onTrigger);
    window.addEventListener(EV_SUBSCRIBED, onTrigger);
    return () => {
      window.removeEventListener(EV_SCAN_COMPLETED, onTrigger);
      window.removeEventListener(EV_SUBSCRIBED, onTrigger);
    };
  }, []);

  return <AddToHomeScreenModal open={open} onClose={() => setOpen(false)} />;
}
