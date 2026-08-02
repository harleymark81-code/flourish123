# RESUME.md — Fix Mission Handoff

Session pausing after Batch 2. Pick up cold from here.

---

## STATUS

- **Full audit** (§1-10): complete. Every finding catalogued in `AUDIT.md`.
- **Priority live-bug fix** (barcode scanner on FreeScanScreen): pushed and live (`a6c6c8b`).
- **Batch 1** (money & access — 🔴 2.A, 5.B/10.D, 🟡 3.A, 3.B): pushed, live, verified, marked ✅ FIXED.
- **Batch 2** (auth & referrals — 🔴 1.A, 7.A, 7.B, 🟠 1.C, 1.D, 🟡 7.C, 7.D, 7.E): pushed, live, verified, marked ✅ FIXED.
- **Bug 1 is now committed** (`09ae277`) — cache-hit paywall bypass fix + regression test. Working tree no longer carries the uncommitted diff.
- **Working tree**: clean.

---

## GIT STATE

- Branch `main`, in sync with `origin/main`.
- **Recent commit chain (most recent last):**
  ```
  3d2d58c  audit: mark 2.A, 5.B, 10.D, 3.A, 3.B FIXED (Batch 1)
  27290f3  fix(1.A, 1.C, 1.D): only log out on 401
  0e242ba  fix(7.A): normalise referral codes upper+trim
  4c3ae9e  fix(7.B): referral_code unique+sparse + retry helper
  ecd8d0e  fix(7.C): Gmail plus-address / dot-alias dedup guard
  9b41cb5  fix(7.D): strip commission fields from /referral/stats
  5afa3a0  fix(7.E): fresh read of referral_trial_claimed
  0a2d07e  audit: mark Batch 2 findings FIXED           ← HEAD
  ```
- Batches 1+2 combined: **14 findings closed** (5 🔴, 2 🟠, 5 🟡 + the 2 recap references 10.D and audit marks).

---

## NEXT — BATCH 3 (analytics, legal, cache)

Execute in this order, one commit per finding cluster, push at batch boundary
after Harley reviews. All 🔴 + 🟡 in-scope for the fix mission.

1. **8.A + 8.B** — loud startup checks if PostHog keys missing. No silent
   disable. Backend logger.error at lifespan start if `POSTHOG_API_KEY`
   unset. Frontend build-time or boot-time hard-fail if
   `REACT_APP_POSTHOG_KEY` is placeholder / missing.
2. **8.C + 8.E + 8.F** — event/config correctness:
   - 8.C: use MongoDB `_id` string as PostHog distinct_id everywhere on
     backend (currently uses email; frontend uses id → users appear twice).
   - 8.E: gate session_recording off on `/insights`, `/diary`, `/patterns`
     screens (or add `maskAllText:true` for authed views).
   - 8.F: `ph.scanLimitReached()` fires on every free-scan result — fix to
     only fire when the free scan is ACTUALLY consumed (backend response
     should include a flag or frontend infers from the request being the
     first successful scan).
3. **8.D** — consent banner gating PostHog until accepted; no events
   pre-consent. Harley supplies Privacy + Cookie copy separately. This fix
   wires the banner, gates `initPostHog()` on consent state, and links the
   Privacy/Cookie policy pages that will hold Harley's copy.
4. **6.K / 5.A** — immediate-unlock path in `get_payment_status` sends
   `send_subscription_confirmed_email` + PostHog `subscription_started`,
   guarded by a `confirmation_email_sent:True` compare-and-set on
   `payment_transactions` so webhook + poll can race without double-sending.
5. **Cache pollution 2.B / 3.I — OPTION A** (decision made). Strip per-user
   narrative fields (`forYourCondition`, `dimensions.*.why`,
   `flags.warnings`, `flags.tips`, `alternatives`, `bodySystemsAffected`,
   `verdict`) from the `barcode_cache.rating_data` before writing. Preserve
   objective `overallScore` and dimension scores. On cache-hit, re-invoke
   Anthropic just to regenerate the per-user narrative fields (or a
   lighter-weight prompt that only outputs those fields).
6. **9.A + 9.B**:
   - 9.A: gate `/scan-history` on `_effective_premium` OR trim non-premium
     users' response to `{food_name, overall_score, date}`.
   - 9.B: invalidate the pattern cache when a user's `conditions` change
     in `update_profile` (and consider adding conditions to cache key).

## NEXT — BATCH 4 (email + config)

7. **6.B + 6.C + 6.D** — dual-send races → atomic `find_one_and_update`
   compare-and-set for `trial_ending_email_sent`, `weekly_report_sent_YYYY_WW`,
   `scan_limit_email_sent`. Concurrency cap on weekly-report loop.
8. **6.E** — don't await Resend in `forgot_password`. Fire-and-forget with
   `asyncio.create_task`; return the enumeration-safe success message
   immediately.
9. **6.I** — cap reengagement + weekly sends under Resend's 100/day free
   tier + `asyncio.Semaphore(5-10)`. Env-tunable `MAX_REENGAGEMENT_PER_DAY`.
10. **10.E** — `ADMIN_EMAIL` default → `admin@theflourishapp.health` (was
    `admin@flourish.app`, wrong domain).
11. **10.F** — lifespan startup `_check_required_env()` that raises listing
    every missing required var. Non-required vars warn only.
12. **10.G** — remove backend URL from both `_allow_origins` and
    `_ALLOWED_ORIGINS` sets.
13. **10.H** — env-driven CORS allowlist with hardcoded fallback.
14. **10.I** — consolidate `FRONTEND_URL` to one module-level definition,
    read from env at import.

Everything else (🟠 and 🟢 findings) is out of scope for this fix mission
per the master prompt.

---

## POST-DEPLOY OPS TASKS FOR HARLEY

Two things I cannot verify from code — please check:

- **Railway logs after this deploy**: look for any of these warnings from
  the two startup index migrations (Batch 2):
  - `[startup] referral_code has existing duplicates — keeping index sparse-only`
  - `[startup] email_key has existing duplicates — keeping index sparse-only`
  - `[startup] X index migration failed`
  If any appear, the unique constraint was skipped. Not launch-blocking
  (application-level `_generate_unique_referral_code` and `email_key` find_one
  check still enforce uniqueness for new writes), but flag it here and the
  dups can be cleaned in a maintenance pass.

- **Stripe webhook URL**: confirm the dashboard URL is `.../api/webhook/stripe`
  with **no trailing slash**. `redirect_slashes=False` is now enforced in code
  (`21b7445`), so a trailing-slash URL would 404 every webhook delivery.
  Marked ✅ in the audit once you confirm.

---

## HOW TO RESUME

1. Read this file, then `AUDIT.md` (Batch 3 + 4 findings are still open).
2. `git status` — confirm clean tree.
3. `git log --oneline -8` — confirm HEAD is `0a2d07e` or later.
4. Start Batch 3 in the order listed above. One commit per finding
   cluster. Same rules as Batches 1-2: read only files named per finding,
   commit locally, present push checkpoint per BATCH, wait for Harley's
   `push`, then narrow-push, run safe live verifications, mark ✅ FIXED
   in AUDIT.md, commit AUDIT.md, continue.
5. **Consent banner (8.D)**: Harley will supply Privacy + Cookie policy
   copy. Wire the banner + Privacy/Cookie page shells + gating logic
   independently; leave `TODO: paste Harley's copy here` markers where the
   copy goes. Ship the wiring; copy fills in behind it.
6. **Option A** already chosen for cache pollution (2.B / 3.I) — no
   decision needed, just implement.
