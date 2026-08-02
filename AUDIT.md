# Flourish Pre-Launch Audit

Read-only code review, section by section. Each entry cites file:line and states severity.
Nothing in this document has been fixed — this is the ledger the fix pass will work from.

Legend:
- 🔴 **Launch blocker** — must fix before public launch
- 🟡 **Medium** — should fix before launch or immediately after
- 🟠 **Low** — real bug, small blast radius, post-launch OK
- 🟢 **Polish / observation** — cosmetic, perf, or note only
- ⏸ **Deferred pending decision** — flagged, awaiting user call

Baseline commit: `3995196` (pre-fix checkpoint). Working copy has an uncommitted
Bug 1 refactor in `backend/server.py` — findings marked **LIVE** describe the deployed
behavior on `3995196`.

---

## Section 1 — Auth

**Scope:** signup, login, JWT storage/rehydration, token expiry, logout, admin path,
AuthContext network-failure logout.

**Functions audited:**
Backend — `hash_password` (server.py:416), `verify_password` (server.py:420),
`get_jwt_secret` (server.py:424), `create_access_token` (server.py:427),
`get_current_user` (server.py:438), `get_optional_user` (server.py:465),
`require_admin_user` (server.py:471), `_set_auth_cookie` (server.py:379),
`_verify_admin` (server.py:227), `_verify_admin_secret` (server.py:235),
`register` (server.py:604), `login` (server.py:668), `me` (server.py:701),
`logout` (server.py:711), `admin_login` (server.py:2243),
`admin_users` (server.py:2284), `grant_admin` (server.py:2297),
`delete_account` (server.py:2611), `forgot_password` (server.py:2629),
`reset_password` (server.py:2655).
Frontend — `AuthProvider`, `getHeaders`, `useEffect` rehydration, `register`,
`login`, `logout`, `refreshUser`, `updateProfile` (all AuthContext.js),
`AuthScreen.handleSubmit` (AuthScreen.jsx:25).

### Findings

| # | Severity | Finding | File:line | Fix |
|---|---|---|---|---|
| 1.A | 🔴 | PWA aggressive logout — `/auth/me` catch clears token on ANY failure (500 / network / timeout / cancel). Currently-deployed users get evicted on any Railway hiccup. | `frontend/src/context/AuthContext.js:39-45` | Only clear token on `err.response?.status === 401`; keep it on network/5xx/timeout/cancel. (This is Bug 2.) |
| 1.B | 🟠 | `logout` deletes cookie without matching original `SameSite=None; Secure; Path=/` attributes. Cross-site browser refuses to clear the cookie; stale cookie lingers client-side. Not a security hole (server-side `token_version` bump revokes the token) but user-visible. | `backend/server.py:724` and `backend/server.py:2623` (delete_account) | `resp.delete_cookie("access_token", samesite="none" if IS_PRODUCTION else "lax", secure=IS_PRODUCTION, path="/")` |
| 1.C | 🟠 | `refreshUser` silently swallows 401 — stale user object stays in state; app appears logged in until next axios call fails somewhere else. | `frontend/src/context/AuthContext.js:127-129` | On `e.response?.status === 401`, `localStorage.removeItem(TOKEN_KEY); setUser(null)`. |
| 1.D | 🟠 | No global axios 401 interceptor — mid-session 401s (revoked token, JWT_SECRET rotated) leave the app in zombie state. | Missing feature — belongs in `AuthProvider` mount effect (`frontend/src/context/AuthContext.js`) | Register `axios.interceptors.response.use` that clears token + user on 401; eject on unmount. |
| 1.E | 🟢 | Login logs `is_admin`, `is_premium`, `role` per request at INFO. Faint info-leak in log tails. | `backend/server.py:676-681`, `693` | Drop to DEBUG or remove. |
| 1.F | 🟢 | `admin_login` retains verbose "TEMP DEBUG" length-logging labelled "remove after diagnosing" — diagnosis is done. | `backend/server.py:2247-2253` | Delete the debug block. |
| 1.G | 🟢 | Admin-password compared with plain `!=`. High-entropy secret + 3/min limit make timing-attack unlikely, but `secrets.compare_digest` is one line. | `backend/server.py:2257` | Use `secrets.compare_digest(data.password.strip(), admin_password.strip())`. |
| 1.H | 🟢 | Stale comment claims "auth is httpOnly cookie only — no localStorage token" but the code returns a token in the JSON body and the frontend does store it. | `backend/server.py:696` | Delete the comment (or drop `token` from response body — trickier for PWA rehydration; leave as-is). |

---

## Section 2 — Scan + Scoring

**Scope:** `rate_food` end to end, free-scan gating on both cache-hit and cache-miss,
premium bypass, scoring rubric.

**Functions audited:**
Backend — `call_anthropic` (server.py:62), `_effective_premium` (server.py:869),
`_maybe_mark_abandoned` (server.py:886), `_refresh_streak` (server.py:846),
`_compute_streak_from_diary` (server.py:798), `rate_food` (server.py:915),
`FoodRatingRequest` model (server.py:511).
Frontend — `HomeScreen.rateFood` (HomeScreen.jsx:321), `HomeScreen.handleSearch`
(HomeScreen.jsx:352), `HomeScreen.handleBarcodeResult` (HomeScreen.jsx:362),
`FreeScanScreen.handleScan` (FreeScanScreen.jsx:103).

**Config:** `ANTHROPIC_MODEL = "claude-haiku-4-5-20251001"` (server.py:44),
temperature 0 at server.py:1070, 60s httpx timeout, 20/min IP rate limit
(server.py:914), barcode_cache TTL 86400s + unique index (server.py:261-262).

### Findings

| # | Severity | Finding | File:line | Fix |
|---|---|---|---|---|
| 2.A | 🔴 (LIVE only) | Free-scan paywall bypass on barcode cache-hit — cache-hit branch returns early, skipping the `has_used_free_scan` update. Free users get unlimited scans of any cached product. **Fixed on disk (uncommitted); still LIVE on `3995196`.** | `backend/server.py` `rate_food` (cache-hit branch @ ~928-967 in LIVE) | Bug 1 — refactor into shared exit path. Applied in working copy, awaiting commit + tests. |
| 2.B | ⏸ **Deferred — awaiting user decision** | Cache pollution: per-user narrative fields (`forYourCondition`, `dimensions.*.why`, `flags.warnings`, `flags.tips`, `alternatives`, `bodySystemsAffected`, `verdict`) are stored in `barcode_cache` and served to the next user of that barcode. Personalisation pitch is violated — a coeliac user sees a PCOS user's narrative. | `backend/server.py:1136` | Options: (1) strip per-user fields before caching + re-run AI for narrative, (2) key cache on `(barcode, user_condition_signature)`, (3) disable cache. Awaiting decision. |
| 2.C | 🟡 | `_effective_premium` silently returns False when `premium_expires_at` is missing/None/malformed — even if `is_premium:True`. Any Stripe webhook write that omits or mangles `premium_expires_at` will paywall a paying user. | `backend/server.py:876-884` | Either default to a far-future expiry when `is_premium=True` but expires is missing, OR log a WARNING on the None/parse-fail branches. Revisit in §5 (Stripe). |
| 2.D | 🟠 | Free-scan double-spend race — two concurrent requests both read `has_used_free_scan=False`, both mark `is_free_scan=True`, both run AI call, both write True at end. Result: 2 free scans for 1 quota, 2 Anthropic bills. | `backend/server.py:920-927` (read) + `backend/server.py:1148` (write) | Atomic `find_one_and_update` reservation at top with rollback on AI failure. Post-launch OK. |
| 2.E | 🟢 | `_maybe_mark_abandoned` runs on every authenticated request via `get_current_user`. Wasteful. | `backend/server.py:458` + `886-910` | Move to nightly APScheduler cron. |
| 2.F | 🟢 | Prompt-injection via user profile fields — `food_challenge`, `struggles`, etc. are string-interpolated verbatim into the prompt. Users can inflate their own scores; no cross-user impact. | `backend/server.py:972-986` | Wrap user fields in delimiter tags (`<user_input>…</user_input>`) or scrub. Post-launch. |
| 2.G | 🟢 | `ph.scanLimitReached()` fires on every successful free-scan result, not only when the limit is actually reached. PostHog data quality issue — revisit in §8. | `frontend/src/components/FreeScanScreen.jsx:113` | Only fire when server response indicates the free scan was just consumed. |
| 2.H | 🟢 | Rubric penalties compress at Step 4's floor (5). Many ultra-processed items bottom out at ~15 with reduced granularity. Note only. | `backend/server.py:1000-1017` | None — accept trade-off. |

---

## Section 3 — Barcode

**Scope:** provider lookup, hit / miss / error handling, scanner UX, cache interaction.

**Functions audited:**
Backend — `lookup_barcode` (server.py:2354).
Frontend — `BarcodeScanner` (BarcodeScanner.jsx:23), `BarcodeScanner.useEffect`
camera bring-up (BarcodeScanner.jsx:29-90), `BarcodeScanner.submitManual`
(BarcodeScanner.jsx:92), `BarcodeScanner.handleClose` (BarcodeScanner.jsx:100),
`HomeScreen.handleBarcodeResult` (HomeScreen.jsx:362).

**Config:** zxing formats restricted to product barcodes (EAN_13/EAN_8/UPC_A/UPC_E/
CODE_128/CODE_39/ITF) with TRY_HARDER at BarcodeScanner.jsx:11-21;
`facingMode:{ideal:"environment"}`; 10s httpx timeout on OFF request;
30/min IP rate-limit on `/food/barcode/{barcode}`.

**Provider:** OpenFoodFacts v0 API (`world.openfoodfacts.org`). Unauthenticated,
anonymous fair-use.

### Findings

| # | Severity | Finding | File:line | Fix |
|---|---|---|---|---|
| 3.A | 🟡 | `lookup_barcode` collapses "OFF down / timeout / malformed JSON" and "product not in DB" into the same `{found:False}` response. Frontend / ops cannot distinguish; OFF outage looks like a Flourish bug to users. | `backend/server.py:2376-2378` | Distinct payload on exception (`provider_down:true` or HTTP 502) + separate frontend message + PostHog `ph.barcodeProviderDown()`. |
| 3.B | 🟡 | OFF provider lookup is NOT cached. Every scan hits OFF even for barcodes seen minutes ago. Sustained traffic risks OFF throttling / IP block → all barcode scans break app-wide. | `backend/server.py:2352-2378` (no cache) | New `off_lookup_cache` Mongo collection (barcode PK, TTL 24h), or extend `barcode_cache` to also hold `{off_name, off_ingredients, off_image}`. |
| 3.C | 🟠 | Any authenticated user (incl. paywalled-out free users) can call `lookup_barcode` unlimited (up to 30/min per IP). No `_effective_premium` gate. Not $-costly for Flourish (Anthropic call is elsewhere) but consumes OFF quota + our egress. | `backend/server.py:2354-2378` — missing gate | Optional per-user counter, or accept 30/min IP limit. |
| 3.D | 🟢 | `image_url` from OFF returned unvalidated → stored in diary + cache, rendered client-side as `<img src>`. Subresource request goes to whatever host OFF names. No XSS; OFF is trusted. Very low severity. | `backend/server.py:2367` | Optional allowlist: `image_url.startswith("https://images.openfoodfacts.org/")`. |
| 3.E | 🟢 | `barcode.isalnum()` validation is correct for the format list (CODE_128/39 can carry letters) and rejects empty. No change needed. | `backend/server.py:2355` | None. |
| 3.F | 🟢 | 400 "Invalid barcode format" is masked by frontend catch showing generic "Couldn't look up." | `frontend/src/components/HomeScreen.jsx:388` | Surface `e.response?.data?.detail` when present. |
| 3.G | 🟢 | `ph.manualFoodEntryStarted` fires on both onFocus and submit → duplicate PostHog events per manual entry. | `frontend/src/components/BarcodeScanner.jsx:95` and `:278` | Drop the onFocus binding. Revisit in §8. |
| 3.H | 🟢 | `useEffect` in BarcodeScanner has `[]` deps + eslint-disable. Captures `onResult` closure. Fine in current call sites (parent unmounts scanner on hide) but fragile if reused. | `frontend/src/components/BarcodeScanner.jsx:90` | None — behavior is fine. |
| 3.I | ⏸ (dup §2.B) | Rating cache still carries per-user narrative fields; touches the barcode lookup flow. | `backend/server.py:1136` | Awaiting user decision. |

---

## Section 4 — Paywall + Onboarding

**Scope:** 16 onboarding screens (15 with progress bar), free-scan gate, hard paywall,
and every possible bypass to a free/unpaid AI scan.

**Functions audited:**
Frontend — `AppContent` routing gate (App.js:110), `StripeReturn` (App.js:53),
`Onboarding` (Onboarding.jsx:113), screen 12 loader effect (Onboarding.jsx:181-207),
screen 16 final save (Onboarding.jsx:641-668), `FreeScanScreen.handleScan`
(FreeScanScreen.jsx:103), `Paywall` (Paywall.jsx:90), `Paywall.handleSubscribe`
(Paywall.jsx:117), `Paywall.handleClose` hardGate guard (Paywall.jsx:152),
`ReturningUserWelcome` (ReturningUserWelcome.jsx:24).
Backend — `update_profile` (server.py:729), `get_daily_tip` (server.py:1164),
`get_meal_plan` gate (server.py:1190), `log_to_diary` gate (server.py:1230),
`get_diary` today-only-for-free (server.py:1272-1281), `get_patterns` gate
(server.py:1316), `log_symptoms` gate (server.py:1421),
`get_streak_reward` ungated info (server.py:1522).

**Onboarding screens:** 1 landing → 2 age → 3 intro → 4 conditions → 5 mirror →
6 duration → 7 challenges → 8 reflection → 9 goal → 10 diet → 11 meals →
12 loader (fire-and-forget save) → 13 theme → 14 education → 15 science →
16 features + FINAL SAVE with `onboarding_completed:true`.

**Bypass check summary:**
- Writers to `has_used_free_scan`: only `register` (init False, server.py:625) and
  `rate_food` (sets True, server.py:1151). `update_profile` whitelist does NOT
  include the flag. **No bypass path.**
- Writers to `is_premium=True`: `stripe_webhook` (4 handlers), `_process_referral_reward`
  in webhook, `grant_admin` (via `is_admin`), and startup owner-grant. **No
  client-facing bypass path.**
- Endpoints that call `call_anthropic`: `/food/rate` (gated), `/food/meal-plan`
  (gated), `/diary/patterns` (gated), `/food/daily-tip` **(NOT gated)** — see 4.C.

### Findings

| # | Severity | Finding | File:line | Fix |
|---|---|---|---|---|
| 4.A | 🟠 | Onboarding screen 12 fires `updateProfile` fire-and-forget; loader advances after fixed 3000ms regardless of save. On flaky networks users may lose all onboarding answers if both screen 12 and screen 16 saves fail. | `frontend/src/components/Onboarding.jsx:190-200` and `:641-668` | Persist form state to localStorage on each advance. On screen 16 failure, keep user on screen 16 with retry; do NOT call `onComplete()`. |
| 4.B | 🟠 | Screen 16 handler always calls `onComplete()` even when save times out (10s Promise.race) or errors. `refreshUser` re-reads DB; if `onboarding_completed:false`, App.js re-routes to Onboarding — but component re-mount wipes React state → user restarts at screen 1. | `frontend/src/components/Onboarding.jsx:641-668` | Only call `onComplete()` on save success. Distinguish timeout from success. |
| 4.C | 🟠 | `/food/daily-tip` has NO `_effective_premium` gate and NO `has_used_free_scan` gate. Any authed user (incl. paywalled) can grind 1 Anthropic call per UTC day via direct API. Frontend never calls it for non-premium (behind hardGate), so exploitable only via API. Blast radius: 1 tip/user/day. | `backend/server.py:1164-1185` | Add `if not _effective_premium(current_user): raise HTTPException(403, ...)`. Or gate on `has_used_free_scan` if it's meant to be a free perk. |
| 4.D | 🟢 | `ReturningUserWelcome` gated by `sessionStorage["welcome_back_seen"]` — re-shows on every new tab/session until subscription. Intentional per code comment. | `frontend/src/App.js:218-223` | None. |
| 4.E | 🟢 | Paywall renders logout button even in hardGate. User can log out → log in as another account (fresh gate). Intentional and correct. | `frontend/src/components/Paywall.jsx:366-371` | None. |
| 4.F | 🟢 | Progress bar formula `((screen - 2) / 14) * 100` reaches 100% at screen 16. Screen 1 (landing) has no progress bar. Correct. | `frontend/src/components/Onboarding.jsx:146` | None. |
| 4.G | 🟢 | `updateProfile(...).catch(e => console.error(...))` at Onboarding.jsx:200 is silent to ops. No PostHog signal on save failure. | `frontend/src/components/Onboarding.jsx:200` | Also fire `ph.apiError("/profile", ...)` on catch. |
| 4.H | 🟢 | Screen 1 "Already have an account? Log in" calls `logout()` on an authed user who hasn't finished onboarding. Correct behavior; adds log noise. | `frontend/src/components/Onboarding.jsx:322-325` | None. |
| 4.I | 🟢 | `update_profile` PUT whitelist excludes `has_used_free_scan`, `is_premium`, `premium_expires_at`, `is_admin`, `token_version`, `referral_code`, `email`, `password_hash`. Confirmed no bypass via `/profile`. | `backend/server.py:729-755` | None. |
| 4.J | ⏸ (revisit §5) | Immediate-unlock at `checkout.session.completed` (server.py:1665) + polling loop in StripeReturn (App.js:69-89). Race window covered by 8×2s poll + payment_pending fallback. Deep audit deferred to §5. | `backend/server.py:1665`, `frontend/src/App.js:69-89` | Re-examine in §5. |

---

## Section 6 — Email / Resend

**Scope:** every transactional email template, every caller, all three email crons,
idempotency, copy accuracy, silent-failure observability.

**Functions audited:**
Service layer — `_send_sync` (services/email.py:36), `send_email` (services/email.py:53),
`_wrap` (services/email.py:69), `_btn/_h1/_p/_divider/_highlight_box/_check_list/_lock_list`,
and 11 template senders: `send_welcome_email` (:171), `send_subscription_confirmed_email`
(:189), `send_trial_ending_email` (:220), `send_scan_limit_email` (:249),
`send_referral_reward_email` (:273), `send_password_reset_email` (:294),
`send_weekly_report_email` (:309), `send_support_email` (:381),
`send_reengagement_email` (:395), `send_affiliate_application_email` (:447),
`send_cancellation_email` (:490).
Callers — `register` (server.py:663), `support_contact` (server.py:763-774),
`rate_food` free-scan consume (server.py:1156-1159),
`stripe_webhook` handlers (server.py:1807, 1831, 1879, 1937),
`affiliate_apply` (server.py:2107-2118), `forgot_password` (server.py:2642-2650).
Crons — `_send_weekly_reports` (server.py:106-141) `sun 09:00 UTC`,
`_send_reengagement_emails` (server.py:144-146) `daily 10:00 UTC`,
`_send_trial_ending_emails` (server.py:149-180) `daily 09:00 UTC`.

**Config:** `RESEND_API_KEY` env var (services/email.py:38, read on every send);
`FROM_ADDRESS = "Flourish <hello@mail.theflourishapp.health>"`;
`REPLY_TO = "hello@theflourishapp.health"`;
`FRONTEND_URL = "https://theflourishapp.health"` (hardcoded, non-www).

**Idempotency status:**
- `trial_ending_email_sent` flag guards trial-end cron + `trial_will_end` webhook (both writers).
- `reengagement_email_sent` flag guards reengagement cron (single writer).
- `send_password_reset_email` — awaited, no idempotency (tokens themselves are one-use).
- **NO idempotency on:** welcome, subscription-confirmed, scan-limit, referral reward,
  cancellation, weekly report, support, affiliate application.

### Findings

| # | Severity | Finding | File:line | Fix |
|---|---|---|---|---|
| 6.A | 🟡 | Startup does not verify `RESEND_API_KEY`. If key is missing/rotated on Railway, every subsequent email silently drops with only a per-call `logger.warning`; the deployer sees a running app and no user complaints for hours. | `backend/server.py:253-346` (lifespan) + `backend/services/email.py:38-41` | Add `if not os.environ.get("RESEND_API_KEY","").strip(): logger.error("[startup] RESEND_API_KEY not set — all outbound email will fail")` at lifespan startup. Optional: probe with `resend.Domains.list()` or a lightweight self-send at startup. |
| 6.B | 🟡 | `send_scan_limit_email` fires on every write of the free-scan-consumed block with no idempotency flag. Combined with 2.D's double-spend race → same user emailed twice. Also, any manual DB reset of `has_used_free_scan` sends a second email. | `backend/server.py:1147-1159` | Bundle into 2.D's atomic reservation: `find_one_and_update({..., "scan_limit_email_sent":{"$ne":True}}, {"$set":{...,"scan_limit_email_sent":True}})`; only send if the pre-update doc did not already have the flag. |
| 6.C | 🟡 | Weekly report cron (`_send_weekly_reports`) has NO per-user-per-week idempotency AND awaits Resend serially. At ~1000+ users the loop runs for minutes, blocks other scheduler jobs on the same event loop, and if Resend returns 429 mid-loop the run partially completes with no retry. Any container restart between 08:59 and 09:00 UTC that recovers within APScheduler's `misfire_grace_time` (default 1s) → cron fires; if already fired that Sunday it won't refire, but a horizontally-scaled deployment would fire once per instance → N× emails per user. | `backend/server.py:106-141` | (1) Add `weekly_report_sent_yyyy_ww:True` marker per user (or an ISO-week entry in a `cron_runs` collection). (2) Batch with `asyncio.gather(*chunk, return_exceptions=True)` + `asyncio.Semaphore(10)` to bound concurrency. (3) Confirm Railway is single-instance before launch. |
| 6.D | 🟠 | Trial-ending email dual-send race — cron (server.py:159-179) and webhook `customer.subscription.trial_will_end` (server.py:1825-1840) each `find_one({..., "trial_ending_email_sent":{"$ne":True}})` then `update_one` in **separate** operations. Two overlapping executions both pass the check, both send, both mark True. Duplicate emails. | `backend/server.py:159-179` and `1825-1840` | Use atomic `find_one_and_update({"_id":ObjectId(uid),"trial_ending_email_sent":{"$ne":True}}, {"$set":{"trial_ending_email_sent":True}}, return_document=False)`; if pre-update doc is None, another writer already claimed it — do NOT send. |
| 6.E | 🟠 | `forgot_password` **awaits** `send_password_reset_email` before returning. Resend degradation or outage blocks the response for the full Resend SDK timeout (default ~30s). Enumeration-safe response text is identical either way — no reason to block on the send. | `backend/server.py:2642-2650` | `asyncio.create_task(send_password_reset_email(...))` and return immediately. Log the failure inside the task. |
| 6.F | 🟠 | `/support/contact` has NO `@limiter.limit(...)` decorator. An authenticated user can flood `hello@theflourishapp.health` with up to 2000-char messages, subject 200 chars, unbounded rate. No PostHog signal on abuse. | `backend/server.py:763-774` | Add `@limiter.limit("5/hour")` and a per-user daily counter (`support_msgs_today` with UTC-date reset) capping at ~10/day. |
| 6.G | 🟠 | `send_support_email` (services/email.py:381-390) interpolates `user_name`, `user_email`, `subject`, and `message` UNESCAPED into the HTML body sent to the admin inbox. Attacker-controlled name/subject can break rendering, spoof "From:" line visually, or embed misleading markup. Email clients strip `<script>` so no XSS — trust-boundary/UX issue only. `send_affiliate_application_email` already uses `html.escape` correctly; this endpoint doesn't. | `backend/services/email.py:381-390` | `from html import escape as _esc`; wrap every interpolated user field: `_esc(user_name or "Unknown")`, `_esc(user_email)`, `_esc(subject)`, `_esc(message)`. Match the pattern used at services/email.py:457-465. |
| 6.H | 🟠 | `send_referral_reward_email` and every other name-personalised email (welcome, subscription-confirmed, trial-ending, scan-limit, cancellation, weekly-report, reengagement) interpolates `first = name.split()[0]` UNESCAPED into HTML. Attacker sets their own display name to markup; email is sent to the REFERRER (not attacker) — attacker can hide the pitch text, spoof the referrer's real name, or insert misleading tags. No XSS in modern clients, but real spoofing surface for the referral flow. | `backend/services/email.py:172`, `190`, `221`, `250`, `274-275`, `295`, `317`, `422`, `491` | Escape every `first`/`first_name`/`referred_first`/`referrer_first` via `html.escape` at the point of interpolation. Register a helper `_safe(name)` in email.py. |
| 6.I | 🟠 | Reengagement cron sends serially with no concurrency cap and no per-day send limit. Resend's free tier is 100 emails/day; at 100+ abandoned users the daily run partially succeeds, unsuccessful sends never mark `reengagement_email_sent:True` (correct per the code), and the same users retry every day — but always cap out at 100. Throughput never catches up beyond ~100. | `backend/services/email.py:395-440` | (1) Verify Resend plan tier is above free before launch (paid = 3000/mo minimum). (2) `asyncio.Semaphore(5)` around `send_email` inside the loop. (3) `MAX_REENGAGEMENT_PER_DAY` env cap with resume-cursor semantics. |
| 6.J | 🟠 (**recap of 5.D**) | Cancellation email fires on every `customer.subscription.deleted` webhook delivery with no idempotency. Stripe re-delivery → duplicate cancellation emails. | `backend/server.py:1877-1883` | `find_one_and_update({..., "cancellation_email_sent":{"$ne":True}}, {"$set":{"cancellation_email_sent":True}})` before sending. Same shape as 5.D and 6.D. |
| 6.K | 🟠 (**recap of 5.A**) | Immediate-unlock path (server.py:1614-1682) grants premium but does NOT send `send_subscription_confirmed_email` and does NOT `_ph_capture("subscription_started", ...)`. Only the webhook path does. If Stripe webhook is misconfigured (5.B trailing-slash) or its endpoint secret is wrong, users pay, get access, but never receive confirmation and never appear in conversion analytics. | `backend/server.py:1614-1682` (missing) vs `1804-1812` (has both) | Copy the email + PostHog block into immediate-unlock, guarded by `confirmation_email_sent:True` compare-and-set on `payment_transactions`. |
| 6.L | 🟠 | Every fire-and-forget email caller discards the `bool` returned by `send_email`. Silent failures — no PostHog event, no counter, no alert. Ops only learns of email outages via user complaints or manual log inspection. | Every `asyncio.create_task(send_*_email(...))` site: server.py:663, 766, 1156, 1807, 1830-1840, 1879, 1937, 2107 | Inside `services/email.py:53-64`, emit `_ph_capture("system", "email_send_failed", {"subject":subject,"reason":str(exc)})` on the False/exception branch. Add a Prometheus/PostHog counter `email.sent` / `email.failed`. |
| 6.M | 🟢 | `_send_sync` re-reads `RESEND_API_KEY` from `os.environ` and re-sets `resend.api_key` on every call. Redundant, but cheap and stateless. | `backend/services/email.py:38-42` | Cache at module load: `_API_KEY = os.environ.get("RESEND_API_KEY","").strip()`. |
| 6.N | 🟢 | `send_reengagement_email` subject-line builder interpolates raw `first_name`. If DB name contains CR/LF characters, Resend may reject the request as header-injection; if it accepts, the extra whitespace could mangle the subject in some clients. Pydantic Name validator should reject control chars but there's no explicit check. | `backend/services/email.py:433` | Sanitize before subject build: `first = first.replace("\r","").replace("\n","").strip()[:80]`. |
| 6.O | 🟢 | Password reset link uses `FRONTEND_URL` env override defaulting to `https://theflourishapp.health` (non-www). www users get bounced cross-origin after reset — potential cookie loss (same class as 5.H). | `backend/server.py:2640-2641` and `backend/services/email.py:23` | Consolidate to a single `frontend_url()` helper that derives from `Origin` header where available, else env, else default. |
| 6.P | 🟢 | Weekly report copy: red_foods empty branch renders "None this week -- great work!" — but empty could also mean "user only logged 3 items and none were <40" or "user logged nothing worth flagging." Slight overclaim on light-usage weeks. | `backend/services/email.py:334` | Change copy to "No low-scoring foods logged this week." |
| 6.Q | 🟢 | `send_scan_limit_email` closer copy "Less than 43p a day. Less than one coffee a week." maps to the MONTHLY plan (£12.99/30 ≈ 43.3p/day). Correct for monthly; misleading if the app's CTA leads with annual (£49.99/yr ≈ 13.7p/day). Marketing decision. | `backend/services/email.py:266` | Align copy with primary in-app CTA; consider "From 14p/day on annual, less than 43p/day monthly." |
| 6.R | 🟢 | Hardcoded admin inbox strings: `theflourishfoodapp@gmail.com` (server.py:2109) and `hello@theflourishapp.health` (server.py:767). Fine for launch; moves the surface into code review for any rebrand. | `backend/server.py:766-772` and `2107-2118` | Env-driven: `ADMIN_INBOX` and `SUPPORT_INBOX`. |
| 6.S | 🟢 | `FRONTEND_URL` is duplicated between `backend/services/email.py:23` (hardcoded) and `backend/server.py:2640` (env-driven). Two sources of truth → future drift. | `backend/services/email.py:23`, `backend/server.py:2640` | Read env in email.py at module init: `FRONTEND_URL = os.environ.get("FRONTEND_URL", "https://theflourishapp.health")`. |
| 6.T | 🟢 | Unsubscribe link in email footer (`_wrap`, services/email.py:104) points to `FRONTEND_URL` (`https://theflourishapp.health`) — same as the main app link. There is no actual unsubscribe endpoint. If a user clicks "Unsubscribe" expecting to opt out, they land on the app and remain subscribed to transactional email. Compliance concern once you send marketing (weekly report is arguably marketing). | `backend/services/email.py:103-104` | Add a real unsubscribe endpoint that flips a `marketing_opt_out:True` flag; gate weekly report + reengagement on `marketing_opt_out !== True`. Transactional emails (welcome, subscription confirmed, password reset, cancellation) can ignore the flag. |

---

## Section 5 — Stripe

**Scope:** checkout session creation, immediate-unlock path, webhook signature +
trailing-slash URL risk, all 6 webhook handlers, cancel, failed payment, portal.
Resolves the two parked items: §2.C `_effective_premium` edge case and §4.J race.

**Functions audited:**
Backend — `create_checkout` (server.py:1542), `get_payment_status` (server.py:1615),
`_find_uid_by_customer` (server.py:1684), `stripe_webhook` (server.py:1714),
handlers `checkout.session.completed` (server.py:1740-1814),
`customer.subscription.trial_will_end` (server.py:1816-1840),
`customer.subscription.updated` (server.py:1842-1865),
`customer.subscription.deleted` (server.py:1867-1883),
`invoice.payment_succeeded` + referral + affiliate ledger (server.py:1885-1977),
`invoice.payment_failed` (server.py:1979-1992),
`create_portal_session` (server.py:2002), `_sweep_expired_premium` cron
(server.py:183), `_effective_premium` (server.py:869), `_ALLOWED_ORIGINS`
(server.py:568), `FastAPI(...)` instantiation (server.py:349).
Frontend — `Paywall.handleSubscribe` (Paywall.jsx:117), `StripeReturn` polling
(App.js:53-108), portal button (ProfileScreen.jsx:252, SubscriptionScreen.jsx:30).

**Webhook route:** `/api/webhook/stripe` (api_router prefix `/api`).
FastAPI `redirect_slashes` NOT set → defaults to True.

**§2.C resolution:** No live code path can create `is_premium=True + premium_expires_at=None`.
All 6 writers of `is_premium=True` co-set `premium_expires_at`; the daily
`_sweep_expired_premium` cron (00:00 UTC) self-heals any anomalous state by
setting `is_premium=False`. Downgrade §2.C to 🟢 with a WARN log recommendation
(see 5.L).

**§4.J resolution:** The immediate-unlock path in `get_payment_status` (server.py:1614)
is race-safe — both webhook and poll write identical `$set` operations. Idempotency
guaranteed. Only gap: poll path skips confirmation email + PostHog track (see 5.A).

### Findings

| # | Severity | Finding | File:line | Fix |
|---|---|---|---|---|
| 5.A | 🟡 | `get_payment_status` immediate-unlock does NOT send `send_subscription_confirmed_email` and does NOT fire PostHog `subscription_started`. If webhook fails silently (misconfigured secret, trailing-slash URL, network), user is upgraded but receives no confirmation and no conversion tracking is recorded. | `backend/server.py:1614-1682` (missing email + PostHog) vs `1804-1812` (webhook path) | Add the same email + PostHog calls after the immediate-unlock, guarded by an idempotency flag on `payment_transactions` (e.g., `confirmation_email_sent:True`). Both paths race for the flag. |
| 5.B | 🔴 | **Trailing-slash webhook URL risk.** `FastAPI(...)` at server.py:349 has default `redirect_slashes=True`. If Stripe dashboard URL is `https://…/api/webhook/stripe/` (trailing slash), FastAPI returns 307; Stripe does NOT follow 3xx on webhook delivery — every future webhook fails silently. Users pay but never upgrade (except via poll path when they still have `?success=true` in URL). | `backend/server.py:349` + Stripe dashboard config | (1) `app = FastAPI(title="Flourish API", lifespan=lifespan, redirect_slashes=False)` so trailing-slash POST returns 404 (visible in logs). (2) **Manually verify Stripe dashboard URL ends in `stripe` with no slash.** Do NOT ship until both confirmed. |
| 5.C | 🟠 | `customer.subscription.updated` treats `past_due` identically to `canceled`/`unpaid` — immediately revokes premium. Stripe treats `past_due` as "we're retrying"; user still has an active card that may succeed. Users hit paywall mid-dunning, restored on next `invoice.payment_succeeded`. | `backend/server.py:1860-1865` | Move `past_due` OUT of the immediate-revoke branch. Let `invoice.payment_failed` (after 3 attempts) be the authoritative revoke signal. Keep `canceled` and `unpaid` immediate. |
| 5.D | 🟠 | `customer.subscription.deleted` sends `send_cancellation_email` with no idempotency guard. Stripe re-delivery → duplicate cancellation emails. | `backend/server.py:1877-1883` | Add `cancellation_email_sent:True` flag on user doc; check-and-set before sending. Same pattern as `trial_ending_email_sent`. |
| 5.E | 🟠 | `invoice.payment_succeeded` sets `premium_expires_at = now + 30/365 days`, NOT `existing_expiry + …`. No invoice-id idempotency — Stripe re-delivery of same invoice event grants extra 30 days each time. | `backend/server.py:1898-1902` | Store `stripe_invoice_id` on `payment_transactions` and check-and-set before extending. Or use `period_end` from the invoice object as source of truth for expiry. |
| 5.F | 🟢 | Referral reward + affiliate ledger inside `invoice.payment_succeeded` correctly guard double-processing via atomic conditions (`referral_rewarded: {$ne:True}` and `conversions.user_id: {$ne: uid}`). Note only. | `backend/server.py:1904-1977` | None. |
| 5.G | 🟠 | `invoice.payment_failed` sends NO email at attempts 1 or 2. Silent premium revoke at attempt 3+, user hits paywall next login with no warning. Churn multiplier. | `backend/server.py:1979-1992` | At attempt 1, send "payment issue — please update your card" email with portal link. Guard via `payment_failed_email_sent_for_invoice` (invoice_id key). |
| 5.H | 🟢 | `create_portal_session` return URL hardcoded to `https://theflourishapp.health` — no www. User on `www.…` gets bounced cross-origin after portal → cookie loss on some browsers. | `backend/server.py:2022` | Derive return URL from Origin header, or accept both www and non-www. |
| 5.I | 🟢 | `create_checkout` writes `payment_transactions` after Stripe session created. If DB insert fails, webhook's `update_one` with default `upsert=False` silently no-ops on the missing row — user still upgraded via `users.update_one`, but transaction row missing → admin dashboard misses it. | `backend/server.py:1592-1606` (insert) and `:1771-1774` (webhook update) | Add `upsert=True` on the webhook's `payment_transactions.update_one` to self-heal. |
| 5.J | 🟢 | `get_payment_status` accepts any `session_id` from any authed user. Upgrade target is `transaction.user_id`, not requester — no self-escalation. Can trigger another user's activation (arguably a feature). Session IDs unguessable. Info leak only. | `backend/server.py:1614-1682` | Optional: `if transaction["user_id"] != uid: raise 403`. |
| 5.K | 🟢 | `Paywall.handleSubscribe` posts `origin_url: window.location.origin`. Always correct for the deployment; verified safe against `_ALLOWED_ORIGINS`. | `frontend/src/components/Paywall.jsx:128` | None. |
| 5.L | 🟢 (**resolves §2.C**) | `_effective_premium` silent False when `premium_expires_at` missing/malformed is defensive; no live code path can produce the state (all writers co-set both fields; daily sweep self-heals). Downgrade §2.C from 🟡 to 🟢. | `backend/server.py:876-884` | Add `logger.warning(...)` in each False branch when `is_premium=True`, so ops can spot the anomaly if it ever occurs. |
| 5.M | 🟢 | `_ALLOWED_ORIGINS` includes `https://flourish123-production.up.railway.app` (backend URL). Harmless — a checkout with that origin returns a URL redirecting to the backend, which has no `/?success=true` route (probably 404). Odd inclusion. | `backend/server.py:568-572` | Remove backend URL from `_ALLOWED_ORIGINS`. |

---




## Section 7 — Referral System

**Scope:** referral code generation and uniqueness, self-referral guard,
plus-address / multi-account fraud, 12-reward cap, reward grant path,
referral-trial (14-day) logic, referral stats endpoints, frontend link capture.

**Functions audited:**
Backend — `register` referral tracking (server.py:629-656),
`create_checkout` referral-trial gating (server.py:1567-1587),
`get_payment_status` extended-trial (server.py:1653-1672),
`stripe_webhook checkout.session.completed` referral-trial mark
(server.py:1779-1802), `stripe_webhook invoice.payment_succeeded` reward grant
+ cap enforcement (server.py:1904-1950), `get_referral_stats`
(server.py:2029-2060), `get_referrals_stats` (server.py:2062-2081).
Frontend — App.js `?ref=` capture (App.js:125-137), `AuthContext.register`
referral payload (AuthContext.js:52-77), `ProfileScreen` referral link
(ProfileScreen.jsx:216-238), `AffiliateDashboard` (AffiliateDashboard.jsx:9).

**Config:** Referral code = `str(uuid.uuid4())[:8].upper()` — 8 hex chars
uppercased = 32 bits ≈ 4.29B combinations. Sparse (NOT unique) index at
server.py:266. Reward: +30 days per paying referral. Cap: 12 rewards per
referrer. Trial extension: 14 days (vs standard 3/7) for referred users.

### Findings

| # | Severity | Finding | File:line | Fix |
|---|---|---|---|---|
| 7.A | 🔴 | **Referral code case-mismatch silently kills every lowercase referral.** `register` stores `referred_by` as-received (server.py:630 — no `.upper()`); `referral_code` is stored uppercased at generation (server.py:629, 2038, 2067); webhook lookup `db.users.find_one({"referral_code": ref_code})` at server.py:1917 uses the referred user's raw stored `referred_by`. If the invitee's URL was `?ref=abc123` (lowercased manually, or via a URL-shortener that normalises case), the DB write stores `abc123`, the referrer's `referral_code` is `ABC123`, and the lookup returns None. Referrer gets nothing; user gets no error; no log. Also affects `affiliate_applications.update_one` at server.py:654. | `backend/server.py:630` (register), `server.py:654` (affiliate app signups), `server.py:1917` (webhook lookup), `frontend/src/App.js:129-137` (URL capture, no `.toUpperCase()`), `frontend/src/context/AuthContext.js:55-67` | Normalise everywhere: `.upper().strip()` on `referred_by` at register, on URL-captured ref in App.js, and on the webhook lookup. Consider adding a unique-partial-index constraint on `referral_code` to catch collisions. |
| 7.B | 🔴 | **Referral code index is `sparse` but NOT `unique`.** With `uuid.uuid4()[:8]` (32 bits) the birthday-collision probability is ~50% around 77k users. On collision, `find_one({"referral_code": X})` returns the FIRST match — silently attributing rewards to the wrong user. Lazy-generation paths (server.py:2038, 2067) don't check for existing codes at all. | `backend/server.py:266` (`create_index("referral_code", sparse=True)` — missing `unique=True`) | Change to `unique=True, sparse=True`. Add retry-on-duplicate loop in `register` and both lazy-generation paths. Consider widening the code (12 chars ≈ 48 bits) to push collision horizon well beyond target user base. |
| 7.C | 🟡 | **Plus-address referral farming.** Self-referral check at server.py:1920 (`referrer.get("email") != claim.get("email")`) compares raw emails. `user@gmail.com` and `user+1@gmail.com` are the same Gmail inbox but distinct DB rows → attacker creates infinite "referred" accounts from a single mailbox, each earns them +30 days (capped at 12 = 12 free months = £155.88 value). No CAPTCHA, no phone/card fingerprint. | `backend/server.py:1920` and `604-644` (register — no dedupe on normalised email) | Normalise on register: strip Gmail plus-addressing (`local.split("+")[0]` for `@gmail.com`, `@googlemail.com`) and lowercase the domain, then unique-check the normalised email. Alternatively: gate referral rewards behind first successful payment on a distinct Stripe `payment_method.fingerprint` from the referrer's own methods. |
| 7.D | 🟡 | **`/referral/stats` returns commission fields** (`monthly_commission`, `annual_commission`, `total_commission` at server.py:2057-2059) despite the user-referral system paying in FREE MONTHS, not cash commission. If any UI surfaces these fields, users expect £ payouts — leads to support tickets and potential misrepresentation claims. `/referrals/stats` (server.py:2062) is the clean version and returns only free-month counts. | `backend/server.py:2029-2060` | Delete `/referral/stats` or strip the three commission fields. Confirm no frontend depends on the commission values (grep for `monthly_commission`, `total_commission` in frontend/src). |
| 7.E | 🟡 | **Referral trial (14-day) check is against stale `current_user`.** `create_checkout` reads `current_user.get("referral_trial_claimed")` from the request-time snapshot (server.py:1571-1575). Between two rapid checkout creations, the first hasn't yet marked the flag (marked only after webhook/poll upgrade at server.py:1798/1672). Attacker abandons checkout #1 → creates checkout #2, both get 14-day trial metadata. First to pay wins the mark; second orphan carries the 14-day trial too. Downside limited (only ONE subscription actually completes) but the metadata inconsistency could confuse trial-ending logic. | `backend/server.py:1571-1587` | Read `is_trialing`/`referral_trial_claimed` via a fresh `db.users.find_one` inside `create_checkout` right before the Stripe call, or gate on an atomic reservation of `referral_trial_claimed`. |
| 7.F | 🟠 | **`referral_count` grows past the 12-reward cap** (server.py:1943-1947 increments even when `>=12`). `/referrals/stats` returns the raw count — a user who referred 25 people sees "referred 25, rewarded 12" only if the UI knows to display "rewarded" separately. Otherwise UX suggests they earned 25 rewards. | `backend/server.py:1943-1947` (unbounded increment) + `2079` (stats returns raw count) | Either stop incrementing past 12, or add a separate `referral_reward_count` capped at 12 while `referral_count` tracks total. UI should display both explicitly. |
| 7.G | 🟠 | **`referred_by` field has no validation beyond `max_length=20`** (server.py:483). Attacker can POST `referred_by="<script>alert(1)</script>"` at register — stored raw in DB, later included in emails (see 6.H) and in log lines (server.py:651 `logger.info(f"[register] referred_by={data.referred_by}...")` — potential log-injection with `\n[fake] ...`). | `backend/server.py:483` (Pydantic model) | Tighten regex: `Field(default=None, pattern=r"^[A-Z0-9]{6,12}$")`; sanitise the value before including in logger.info. |
| 7.H | 🟠 | **Referral link on ProfileScreen hardcodes `https://theflourishapp.health`** (ProfileScreen.jsx:219) instead of using the backend-returned `referral_link`. If FRONTEND_URL changes or user views on www subdomain, the copy-to-clipboard link may not match the canonical form. | `frontend/src/components/ProfileScreen.jsx:216-219` | Use the `referral_link` field returned by `/referral/stats` or `/referrals/stats`. Consolidates with 5.H/6.O. |
| 7.I | 🟠 | **Anonymous referral tracking dies on localStorage eviction.** `?ref=X` is stored in `localStorage.fl_ref` (App.js:131) awaiting a later signup. Incognito browsing, browser storage pressure, or manual clear → attribution lost. No cookie fallback, no server-side click tracking. | `frontend/src/App.js:125-137` | Add a first-party cookie fallback with 30-day expiry; server-side POST `/referral/click` on landing that logs `{ref_code, timestamp, ip_hash}` for later reconciliation. |
| 7.J | 🟠 | **Ghost referral**: if the referrer account is DELETED (server.py:2611 `delete_account`) after a referral was captured but before the referred user pays, the webhook `find_one({"referral_code": ref_code})` returns None (server.py:1917), the reward silently drops, and the referred user still gets the 14-day trial. Not a bug, but no PostHog signal on this path. | `backend/server.py:1916-1917` | Log `logger.warning("Referral code %s has no owner (ghost referral)", ref_code)` and fire `_ph_capture("system","ghost_referral",{...})` for ops visibility. |
| 7.K | 🟢 | **Two overlapping stats endpoints** (`/referral/stats` and `/referrals/stats`) return different-shaped data with overlapping fields. Frontend must know which to call. Refactor risk when one is deleted (7.D). | `backend/server.py:2029` and `2062` | Consolidate to one endpoint returning `{code, link, paying_referrals, free_months_earned, cap_remaining}`. |
| 7.L | 🟢 | **Reward calculation independent of plan.** Referred user paying £49.99 (annual) grants referrer +30 days, same as £12.99 (monthly). Simplification — likely intentional. Note only. | `backend/server.py:1929` (`base + timedelta(days=30)`) | None (product decision). |
| 7.M | 🟢 | **`use_referral_trial` doesn't distinguish first-payment from re-checkout after cancel.** A user who cancelled a subscription then re-checks-out will still get 14-day trial if their `referral_trial_claimed` was never set (webhook may have failed originally). Rare, harmless (worst case: an extra free week for someone already known to churn). | `backend/server.py:1571-1577` | None. |
| 7.N | 🟢 | **Frontend clears `fl_ref` on register** (AuthContext.js:76) — good hygiene, prevents cross-account leakage on same-device signup. Note only. | `frontend/src/context/AuthContext.js:76-77` | None. |
| 7.O | 🟢 | **`payment_transactions.referral_code` set at checkout creation** to the referred user's `referred_by` (server.py:1602). `/referral/stats` count of `paying_referrals` filters on `payment_status="paid"`, so abandoned trials don't inflate the count. Consistent with `referral_count` on webhook path. | `backend/server.py:1593-1604` + `2044-2050` | None. |

---
