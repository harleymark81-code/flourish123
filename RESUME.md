# RESUME.md — Fix Mission Handoff

Session pausing after Batch 3 + Batch 4. Pick up cold from here.

---

## STATUS

- **Full audit** (§1–10): complete. Every finding catalogued in `AUDIT.md`.
- **Priority live-bug fix** (barcode scanner on FreeScanScreen): pushed and live (`a6c6c8b`).
- **Batch 1** (money & access — 🔴 2.A, 5.B/10.D, 🟡 3.A, 3.B): pushed, live, ✅ FIXED.
- **Batch 2** (auth & referrals — 🔴 1.A, 7.A, 7.B, 🟠 1.C, 1.D, 🟡 7.C, 7.D, 7.E): pushed, live, ✅ FIXED.
- **Hotfix — onboarding kickout at screen 12** (`f7d357c`): `updateProfile` was the one authenticated axios call missing `getHeaders()`. Cross-site cookie blocked on Safari PWA → 401 → global interceptor cleared the token → user bounced to login. Also fixed the "free-scan camera button does nothing" symptom (same root cause: zombie auth state).
- **Batch 3** (analytics, legal, cache, gating): pushed, live, ✅ FIXED.
- **Batch 4** (email + config): pushed, live, ✅ FIXED.
- **Working tree**: clean, in sync with `origin/main`.

Total findings closed across all batches so far: **~30**.

---

## GIT STATE

- Branch `main`, in sync with `origin/main`.
- **This session's commit chain (most recent last):**
  ```
  f7d357c  fix: send auth header on updateProfile (login-kickout hotfix)
  01bdf89  fix(8.A, 8.B): loud PostHog startup checks
  b162c4f  fix(8.C, 8.E, 8.F): PostHog identity stitch + maskAllText + scan-limit moved
  19a7a7a  fix(8.D): consent banner + Privacy/Cookie policy shells (GDPR)
  719a0dc  fix(5.A, 6.K): immediate-unlock email + PostHog with CAS idempotency
  c7c9206  fix(2.B, 3.I): strip per-user narrative from barcode_cache (Option A)
  d220dda  fix(9.A, 9.B): /scan-history gate + pattern cache invalidation
  58b8357  fix(6.B, 6.C, 6.D): atomic dual-send guards + Semaphore(10)
  2bd4bbd  fix(6.E): forgot_password fire-and-forget
  37bac56  fix(6.I): reengagement cap + Semaphore(5) + atomic claim
  246c491  fix(10.E, 10.F, 10.G, 10.H, 10.I): config & env consolidation
  2fb5c80  audit: mark Batch 3 + 4 findings ✅ FIXED             ← HEAD
  ```

---

## STILL OPEN

### 🔴 Ops tasks (secret rotation — you, not code)

These are catalogued in AUDIT.md as 🔴 blockers but require Railway console
access, not code changes.

1. **10.A — Rotate `JWT_SECRET` on Railway.** The value
   `flourish_jwt_secret_key_2026_very_secure_64_chars_abcdefghijklmnop` was
   committed to git at `a4474a5:backend/.env`. If Railway's current
   `JWT_SECRET` still matches, anyone with git-history access can mint valid
   JWTs. After rotating, `$inc: {token_version: 1}` on all `users` docs to
   invalidate every outstanding token. Optionally `git filter-repo` to purge
   the value from history.

2. **10.B — Rotate `ADMIN_PASSWORD` on Railway.** `"Flourish2026"` was
   committed at the same `a4474a5`. Also still present in
   `backend/tests/test_flourish.py:14`, `memory/PRD.md:20, 119`, and
   `test_reports/iteration_2.json:51` — delete/update those too. Admin panel
   is protected only by this password + 3/min rate limit.

3. **10.C — Revoke `EMERGENT_LLM_KEY`** (`sk-emergent-4AfB2577e1fEfBcE67`,
   committed at `a4474a5`). Obsolete on emergent.sh's platform if still
   valid. Low blast radius but a real leaked credential.

### 🟠 Ops tasks (env-var verification — you)

The backend now hard-fails at boot if any of these are unset (finding 10.F),
so verifying before your next Railway deploy is important:

4. **Verify Railway env panel has all of:**
   `JWT_SECRET`, `ANTHROPIC_API_KEY`, `STRIPE_SECRET_KEY`,
   `STRIPE_MONTHLY_PRICE_ID`, `STRIPE_ANNUAL_PRICE_ID`,
   `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`. (Plus `MONGO_URL`, `DB_NAME`,
   `ADMIN_PASSWORD` which already failed loudly.) Also set `POSTHOG_API_KEY`
   to match frontend (else backend PostHog silently disabled with a
   `[startup] POSTHOG_API_KEY not set` ERROR line in logs — see 8.B).

5. **Verify Netlify env panel has `REACT_APP_POSTHOG_KEY`** set to a real
   `phc_…` key from PostHog EU cloud. If missing/placeholder, the next
   Netlify build fails with a boxed error (that is intentional — 8.A).

6. **Verify Stripe dashboard webhook URL** is `.../api/webhook/stripe`
   with **no trailing slash** (`redirect_slashes=False` is now enforced in
   code — `21b7445` — so a trailing-slash URL would 404 every delivery).

7. **Confirm Railway is single-instance** before launch. The weekly-report
   cron (6.C) fires once per instance; a horizontally-scaled deployment
   would send N× emails per user despite the new per-week idempotency flag
   (which only prevents duplicates within a single race window). Set
   `MAX_REENGAGEMENT_PER_DAY` env var if your Resend plan differs from the
   90/day default (6.I).

8. **Check Railway startup logs** for these WARNING lines (Batch 2
   defensive migrations):
   - `[startup] referral_code has existing duplicates — keeping index sparse-only`
   - `[startup] email_key has existing duplicates — keeping index sparse-only`
   - `[startup] X index migration failed`

   Not launch-blocking (app-level `_generate_unique_referral_code` and
   `email_key` find_one check still enforce uniqueness for new writes), but
   flag here for a maintenance-pass dedup if any appear.

### ⏸ Content tasks (Privacy + Cookie policy copy — you)

9. **`frontend/src/pages/PrivacyPolicy.jsx`** — replace the
   `{/* TODO: paste Harley's Privacy Policy copy here */}` block. Checklist
   is in the file:
   - Data controller identity + contact
   - What data we collect (account, health conditions, symptoms, food logs)
   - Legal basis (consent for analytics + health data, contract for service)
   - Third-party processors (Stripe, Resend, PostHog EU, Anthropic, MongoDB Atlas)
   - Retention + deletion
   - User rights (access, rectification, erasure, portability)
   - International transfers
   - Complaints (ICO for UK users)

10. **`frontend/src/pages/CookiePolicy.jsx`** — replace the TODO block.
    Checklist is in the file:
    - Essential cookies (auth session `access_token`, httpOnly, SameSite=None; Secure)
    - Analytics cookies (PostHog EU — only after consent)
    - localStorage keys we use (`fl_token`, `fl_ref`, `affiliate_code`,
      `fl_consent`, `welcome_back_seen`, `splash_shown`)
    - How to withdraw consent (button already wired to reset `fl_consent`)
    - Third-party cookies via Stripe checkout (during payment only)

    The consent banner and both policy pages are already fully wired at
    `/privacy` and `/cookies`; only the copy is missing.

### 🟠 / 🟡 Code tasks (you'll want a Claude session)

11. **Affiliate back-button bug** — needs a diagnosis pass. Symptoms and
    reproduction steps not yet captured; pick up by running the affiliate
    flow (`/affiliate` + `/affiliate/dashboard`) and noting where the back
    button misbehaves.

12. **8.I — `identifyUser` sends `conditions` (medical data) to PostHog.**
    Currently gated only by top-level analytics consent (8.D). Should be a
    *separate* medical-data opt-in for UK-GDPR special category compliance.
    Strip `conditions` from `identifyUser` by default; only include if user
    opts into "personalised analytics." One-line + a UI toggle.

13. **Global axios default `Authorization` header** (low-priority, task #3
    in in-flight tasks). Refactor so any future call site can't accidentally
    omit auth like `updateProfile` did (the login-kickout hotfix
    `f7d357c`). Would eliminate this class of bug at the source. Not
    urgent; defer to the light code-review pass.

### Rest of AUDIT.md

Everything else in AUDIT.md marked 🟠 (Low) or 🟢 (Polish) is out of scope
for this fix mission per the master prompt. Some notable ones worth
flagging for post-launch review:
- **10.K** — no error tracking (Sentry/Rollbar). Recommended before scale.
- **10.O** — Dockerfile runs as root, no HEALTHCHECK.
- **9.L** — streak boundary is UTC, not user-local time. UX bug for global users.
- **6.T** — no real unsubscribe endpoint; weekly report + reengagement
  emails are arguably marketing. Compliance concern once volume grows.

---

## PICK UP FIRST TOMORROW

Ordered by leverage:

1. **Ops env verification (item 4).** Fastest thing to do first. Take
   5 minutes to spot-check the Railway env panel against the required-vars
   list above. If any are missing, the next backend deploy will crash at
   boot (which is the correct new behavior — 10.F — but you want to know
   before that happens).

2. **Netlify env verification (item 5).** Same — the prebuild will fail
   loudly on the next Netlify build if `REACT_APP_POSTHOG_KEY` is missing
   or a placeholder. Fastest is to just look.

3. **Secret rotation (10.A, 10.B, 10.C).** Rotate `JWT_SECRET` and
   `ADMIN_PASSWORD` on Railway, then `$inc: {token_version: 1}` across
   `users`. This is the most consequential security item still open.

4. **Privacy + Cookie policy copy (items 9, 10).** GDPR-blocker for UK
   launch. The banner and pages are already wired; only the copy is
   missing. Once pasted in, launch is unblocked from a compliance angle.

5. **Affiliate back-button bug (item 11).** Repro + fix in a Claude
   session. Should be quick once the steps are captured.

6. **Post-launch:** 8.I (medical-data opt-in), axios global-header
   refactor, then the 🟠 backlog per priority.

---

## HOW TO RESUME

1. Read this file, then skim `AUDIT.md` for anything you want context on.
2. `git status` — should be clean.
3. `git log --oneline -12` — HEAD should be `2fb5c80` (or later if you
   pushed anything in between).
4. Start with **item 1** (Ops env verification) above — 5 minutes to gain
   confidence before any new deploy.
5. Continue in the priority order above unless a specific launch blocker
   overrides.

Same rules as before if you spawn a Claude session:
- One commit per finding cluster.
- Diff + plain-English summary presented before push (unless you say
  "approve all and push").
- Live-verify what you can; flag what needs your device (Safari PWA
  behaviors etc.) explicitly.
