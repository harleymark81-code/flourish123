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
| 1.A | 🔴 ✅ **FIXED** (`27290f3`) | PWA aggressive logout — `/auth/me` catch clears token on ANY failure (500 / network / timeout / cancel). Currently-deployed users get evicted on any Railway hiccup. | `frontend/src/context/AuthContext.js:39-45` | Init effect's catch now only clears token on `err.response?.status === 401`. Cancel + 5xx paths keep the token so the next request can recover. Bundled with 1.C / 1.D global 401 interceptor. |
| 1.B | 🟠 | `logout` deletes cookie without matching original `SameSite=None; Secure; Path=/` attributes. Cross-site browser refuses to clear the cookie; stale cookie lingers client-side. Not a security hole (server-side `token_version` bump revokes the token) but user-visible. | `backend/server.py:724` and `backend/server.py:2623` (delete_account) | `resp.delete_cookie("access_token", samesite="none" if IS_PRODUCTION else "lax", secure=IS_PRODUCTION, path="/")` |
| 1.C | 🟠 ✅ **FIXED** (`27290f3`) | `refreshUser` silently swallows 401 — stale user object stays in state; app appears logged in until next axios call fails somewhere else. | `frontend/src/context/AuthContext.js:127-129` | `refreshUser` now distinguishes 401 (session dead — handled by global interceptor) from transient failures (state preserved for retry). |
| 1.D | 🟠 ✅ **FIXED** (`27290f3`) | No global axios 401 interceptor — mid-session 401s (revoked token, JWT_SECRET rotated) leave the app in zombie state. | Missing feature — belongs in `AuthProvider` mount effect (`frontend/src/context/AuthContext.js`) | `axios.interceptors.response.use` registered in the mount effect; any 401 anywhere in the app clears the token + user state. Ejected in effect cleanup. |
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
| 2.A | 🔴 ✅ **FIXED** (`09ae277`) | Free-scan paywall bypass on barcode cache-hit — cache-hit branch returns early, skipping the `has_used_free_scan` update. Free users get unlimited scans of any cached product. | `backend/server.py` `rate_food` shared exit path | Bug 1 refactor landed with `test_bug1_free_scan_gating.py`. Live-verified 2026-08-02: 1st scan→200, 2nd→403. |
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
| 3.A | 🟡 ✅ **FIXED** (`12b89ef`) | `lookup_barcode` collapses "OFF down / timeout / malformed JSON" and "product not in DB" into the same `{found:False}` response. Frontend / ops cannot distinguish; OFF outage looks like a Flourish bug to users. | `backend/server.py:2376-2378` | Exception branch now returns `{found:false, provider_down:true, message}`; frontend `handleBarcodeResult` (HomeScreen + FreeScanScreen) branches on `provider_down` and fires new `ph.barcodeProviderDown()` event. Live-verified 2026-08-02: unknown barcode returns `{found:false}` without `provider_down`. |
| 3.B | 🟡 ✅ **FIXED** (`12b89ef`) | OFF provider lookup is NOT cached. Every scan hits OFF even for barcodes seen minutes ago. Sustained traffic risks OFF throttling / IP block → all barcode scans break app-wide. | `backend/server.py:2352-2378` (no cache) | New `off_lookup_cache` collection (barcode unique PK, TTL 86400s), created in lifespan startup. `lookup_barcode` checks cache first, hits OFF only on miss, writes both positive AND negative results back (provider-down NOT cached — transient). Live-verified 2026-08-02: repeat lookup returns identical payload. |
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
| 5.B | 🔴 ✅ **FIXED** (`21b7445`) | **Trailing-slash webhook URL risk.** `FastAPI(...)` at server.py:349 has default `redirect_slashes=True`. If Stripe dashboard URL is `https://…/api/webhook/stripe/` (trailing slash), FastAPI returns 307; Stripe does NOT follow 3xx on webhook delivery — every future webhook fails silently. Users pay but never upgrade (except via poll path when they still have `?success=true` in URL). | `backend/server.py:349` + Stripe dashboard config | `redirect_slashes=False` applied. Live-verified 2026-08-02: POST `/api/webhook/stripe/` returns 404 (was 307). Test `test_webhook_trailing_slash.py` added. **Ops task remaining:** confirm the Stripe dashboard webhook URL has no trailing slash. |
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
| 7.A | 🔴 ✅ **FIXED** (`0e242ba`) | **Referral code case-mismatch silently kills every lowercase referral.** Details as previously catalogued. | 4 sites across backend + frontend | `.strip().upper()` at register (normalized_ref used for user-doc write + affiliate lookup + log), webhook `invoice.payment_succeeded` lookup (legacy row safety), `App.js` URL capture on landing, `AuthContext.register` payload defence-in-depth. Live-verified 2026-08-02: `?referred_by=abc123` stored as `ABC123`. |
| 7.B | 🔴 ✅ **FIXED** (`4c3ae9e`) | **Referral code index is `sparse` but NOT `unique`.** Details as previously catalogued. | `backend/server.py:266` + register + 2 lazy generators | `_generate_unique_referral_code()` helper probes with `find_one` before returning; falls back to 12-char after 5 attempts. Wired into all 3 code-gen sites. Lifespan startup migrates the DB index defensively: drops old sparse-only index and creates `unique=True, sparse=True` if no legacy dups; if dups exist, keeps sparse-only + logs WARNING so server still boots. **Check Railway logs post-deploy for the warning line.** |
| 7.C | 🟡 ✅ **FIXED** (`ecd8d0e`) | **Plus-address referral farming.** Details as previously catalogued. | `backend/server.py` register + webhook | `_normalize_email_key(email)` helper strips dots + plus-addressing for gmail.com / googlemail.com, and plus-addressing only for other domains. Register dedups on `{email OR email_key}`. Webhook self-referral check compares normalised keys. New unique+sparse index on `email_key` at lifespan startup (defensive migration — same pattern as 7.B). User's displayed email is unchanged. **Check Railway logs for the migration warning line.** |
| 7.D | 🟡 ✅ **FIXED** (`9b41cb5`) | **`/referral/stats` returns commission fields** on a free-months reward system. Details as previously catalogued. | `backend/server.py` get_referral_stats | Three commission fields removed. Grep confirmed no frontend consumes them. Affiliate dashboard (a separate cash-payout endpoint) still returns commission fields. Live-verified 2026-08-02: `/referral/stats` response contains only `{referral_code, referral_link, paying_referrals, free_months_earned}`. |
| 7.E | 🟡 ✅ **FIXED** (`5afa3a0`) | **Referral trial (14-day) check is against stale `current_user`.** Details as previously catalogued. | `backend/server.py` create_checkout | Targeted `find_one({_id: uid}, {referred_by:1, referral_rewarded:1, referral_trial_claimed:1})` right before the Stripe call; that fresh snapshot drives the `use_referral_trial` decision, not the request-time cached `current_user`. |
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

## Section 8 — PostHog Analytics

**Scope:** frontend init, event coverage (52 `ph.*` events), backend
`_ph_capture` calls, API key config, PII / consent posture.

**Functions audited:**
Frontend — `initPostHog` (lib/posthog.js:6-18), `identifyUser` (lib/posthog.js:22-31),
`resetUser` (lib/posthog.js:33), `track` (lib/posthog.js:39-45),
the `ph` object (lib/posthog.js:49-159) — 52 keyed events.
Backend — `_ph_capture` (server.py:36-41). Callers: `get_patterns`
(server.py:1409, 1414), `stripe_webhook.checkout.session.completed`
(server.py:1812), `stripe_webhook.customer.subscription.deleted`
(server.py:1883), `stripe_webhook.invoice.payment_succeeded` referral
(server.py:1942).
Entry point — `index.js:8` calls `initPostHog()` on app boot (pre-auth).

**Config:** `POSTHOG_KEY = process.env.REACT_APP_POSTHOG_KEY || "phc_PLACEHOLDER"`
(lib/posthog.js:3). `POSTHOG_HOST = "https://eu.i.posthog.com"` (EU cloud —
good for GDPR). PostHog options: `capture_pageview:true`, `capture_pageleave:true`,
`session_recording:{maskAllInputs:true}`, `autocapture:true`. Backend
`_ph.project_api_key = os.environ.get("POSTHOG_API_KEY", "")` +
`_ph.disabled = not os.environ.get("POSTHOG_API_KEY", "")` (server.py:31-34).

**Local `.env` state:** `frontend/.env:6` = `REACT_APP_POSTHOG_KEY=phc_REPLACE_WITH_YOUR_KEY`
(placeholder). `backend/.env` does not set `POSTHOG_API_KEY` — backend PostHog
disabled locally.

**Netlify build env:** `netlify.toml:6-8` declares `REACT_APP_BACKEND_URL` and
`REACT_APP_FRONTEND_URL` only. `REACT_APP_POSTHOG_KEY` is NOT declared here —
must be configured in the Netlify dashboard env panel or the placeholder ships.

### Findings

| # | Severity | Finding | File:line | Fix |
|---|---|---|---|---|
| 8.A | 🔴 | **PostHog silently disabled in production if Netlify env panel doesn't override `REACT_APP_POSTHOG_KEY`.** Local `frontend/.env:6` value is the placeholder `phc_REPLACE_WITH_YOUR_KEY`; `netlify.toml` does not set the var; `initPostHog` short-circuits with only a `console.warn` (posthog.js:7-10). If the Netlify dashboard var was ever unset, rotated, or the build cache was corrupted, the deploy ships with zero analytics and there is no runtime error. **Verify Netlify dashboard has `REACT_APP_POSTHOG_KEY` set to the real phc_… key BEFORE launch.** | `frontend/src/lib/posthog.js:3-10`, `frontend/.env:6`, `netlify.toml` | (1) Add a build-time hard-fail: in `frontend/scripts/prebuild.js`, throw if `process.env.REACT_APP_POSTHOG_KEY?.startsWith("phc_") && !== "phc_PLACEHOLDER" && !== "phc_REPLACE_WITH_YOUR_KEY"`. (2) Add the key to `netlify.toml` as a build var reference (not the value). (3) Optional runtime beacon: fire a one-shot fetch to a `/healthz` endpoint with `has_analytics: true/false` on boot. |
| 8.B | 🔴 | **Backend PostHog silently disabled if `POSTHOG_API_KEY` env var is unset on Railway** — `_ph_capture` guards on `_ph.project_api_key`, no-ops silently (server.py:36-41). No startup log, no metric, no alert. Every backend-side conversion event (subscription_started, subscription_cancelled, referral_reward_earned, patterns_viewed) drops silently. | `backend/server.py:31-41` | Add to lifespan startup: `if not os.environ.get("POSTHOG_API_KEY","").strip(): logger.error("[startup] POSTHOG_API_KEY not set — server-side analytics disabled")`. Verify Railway env panel has the same key that frontend uses. |
| 8.C | 🟡 | **`distinct_id` mismatch between frontend and backend splits users into two PostHog identities.** Frontend calls `posthog.identify(user.id || user._id, …)` at posthog.js:24 (uses MongoDB ObjectId string). Backend uses **email** as distinct_id at every `_ph_capture` call site (server.py:1409, 1414, 1812, 1883, 1942). Same real user appears twice in PostHog dashboards; funnels crossing frontend→backend events (e.g., `upgrade_cta_clicked` → `subscription_started`) will not stitch. | `backend/server.py:1409, 1414, 1812, 1883, 1942` (all `_ph_capture` calls use email) | Use the MongoDB `_id` string as distinct_id everywhere: `_ph_capture(str(uid), "event", {"email": email, ...})`. Alternatively, use `posthog.alias(email, user_id)` on the backend at signup. |
| 8.D | 🔴 (**consent / GDPR**) | **No cookie / analytics consent banner anywhere in the app.** `initPostHog()` fires at `index.js:8` before any user interaction; `autocapture:true` immediately starts sending clicks, pageviews, and (unmasked) attribute values. `identifyUser` sends `email`, `name`, `conditions` (health data) to PostHog EU. For UK/EU users this is unlawful under UK-GDPR/PECR without prior explicit consent — and health data is a special category requiring opt-in. | `frontend/src/index.js:8`, `frontend/src/lib/posthog.js:6-31`, entire app | (1) Add a consent banner that must be accepted before `initPostHog()` runs. (2) Split consent: essential (analytics) vs marketing (identifiable). (3) Move `identifyUser`'s `conditions` field behind explicit medical-data consent. (4) Add a Privacy Policy + Cookie Policy page. **Non-negotiable for UK launch.** |
| 8.E | 🟡 | **Session recording enabled with `maskAllInputs:true`** — good for passwords, but session recording still captures DOM text (rendered rating narratives include user conditions and personalised medical text). If a user logs symptoms and sees their patterns page, the recording contains the personalised medical content even though input values are masked. | `frontend/src/lib/posthog.js:15` | Add `maskAllText: true` in session_recording options for authenticated views, or disable session_recording on `/insights`, `/diary`, `/patterns` via `posthog.stopSessionRecording()` guards. Gate all recording on explicit consent (8.D). |
| 8.F | 🟡 | **`ph.scanLimitReached()` fires on every successful free scan** (FreeScanScreen.jsx:113) — not only when the limit is actually reached. Skews the conversion funnel: every free-scan event pretends to be a paywall trigger. Recap of 2.G. | `frontend/src/components/FreeScanScreen.jsx:113` | Fire only if backend response indicates the scan was consumed (e.g., response includes `free_scan_consumed: true`). Or fire on the NEXT scan attempt when the paywall is actually shown. |
| 8.G | 🟠 | **`ph.manualFoodEntryStarted` double-fires** — once on `onFocus` (BarcodeScanner.jsx:278) and again on submit (BarcodeScanner.jsx:95). Recap of 3.G. Inflates the manual-entry event count by 2×. | `frontend/src/components/BarcodeScanner.jsx:95` and `278` | Drop the `onFocus` binding; keep the submit fire. |
| 8.H | 🟠 | **`ph.foodSearched(query)` at HomeScreen.jsx:358 and FreeScanScreen.jsx:107 sends the raw search query.** Users may search for health-sensitive terms ("PCOS-friendly bread", "endo-safe snacks"). Under UK-GDPR this is category-9 health data being transmitted to a processor without explicit consent (see 8.D). | `frontend/src/components/HomeScreen.jsx:358`, `frontend/src/components/FreeScanScreen.jsx:107` | Truncate to first token, hash, or omit the query. Alternatively gate on medical-data consent. |
| 8.I | 🟠 | **`identifyUser` sends `conditions` field to PostHog** (lib/posthog.js:28) — this is medical data. Even after 8.D consent is added, `conditions` should be a separate opt-in. | `frontend/src/lib/posthog.js:22-31` | Strip `conditions` from identify by default; only include if user opts into "personalised analytics." |
| 8.J | 🟢 | **PostHog client-side errors swallowed silently.** `track()` has a bare `try/catch` (lib/posthog.js:39-45) that neither re-throws nor logs. Same for `_ph_capture` on backend. Debugging a broken analytics pipeline requires PostHog's dashboard to notice. | `frontend/src/lib/posthog.js:39-45`, `backend/server.py:36-41` | Add `console.warn` on catch in frontend; `logger.warning` on backend catch. Cheap ops-visibility. |
| 8.K | 🟢 | **No PostHog event when `call_anthropic` fails** (server.py:62-95). Backend has no `_ph_capture("system","ai_error",{...})` — outages invisible to analytics. Frontend logs `ph.apiError("/food/rate", ...)` on the client side, which catches user-visible failures but not backend Anthropic outages that succeed at HTTP layer but with bad JSON. | `backend/server.py:62-95` (`call_anthropic`) | Fire `_ph_capture("system","anthropic_error",{"model":ANTHROPIC_MODEL,"exc_type":type(exc).__name__})` in the retry/reraise path. |
| 8.L | 🟢 | **No PostHog on `/support/contact`, `/auth/forgot-password`, `/auth/reset-password` completion.** Support-funnel and password-reset-recovery cohorts are invisible. | `backend/server.py:766`, `2629-2670` | Add `_ph_capture(email, "support_ticket_sent")` and `_ph_capture(email, "password_reset_completed")`. |
| 8.M | 🟢 | **No PostHog on `/affiliate/apply`.** Affiliate signup funnel invisible. | `backend/server.py:2107` | Add `_ph_capture(email, "affiliate_application_submitted", {"niche":condition_niche})`. |
| 8.N | 🟢 | **`autocapture:true`** (lib/posthog.js:16) captures every click and form interaction. Combined with `maskAllInputs:true` this is generally OK, but click-target `aria-label`/`data-testid` attrs are captured and may leak internal names. | `frontend/src/lib/posthog.js:16` | Consider `autocapture:{dom_event_allowlist:["click"], element_allowlist:["a","button"]}` to restrict scope. |
| 8.O | 🟢 | **`identifyUser(user)` sends `plan: user.is_premium ? "premium" : "free"`** but reads `user.is_premium` from the client-side snapshot — trial users may show `premium` while their `_effective_premium` server-side check is more nuanced. Cohort accuracy drift. | `frontend/src/lib/posthog.js:27` | Include `is_trialing` and `premium_expires_at` fields; recompute on refreshUser. |
| 8.P | 🟢 | **PostHog EU host hardcoded** (`https://eu.i.posthog.com` at posthog.js:4 and server.py:33) — correct for GDPR. Note only. | `frontend/src/lib/posthog.js:4`, `backend/server.py:33` | None. |
| 8.Q | 🟢 | **Backend PostHog uses sync `_ph.capture` from a request handler.** The Python posthog SDK is thread-based (non-blocking) so this is OK, but a wedged posthog thread could accumulate memory. Note only. | `backend/server.py:39` | None. |

---

## Section 9 — Diary / Insights / My Foods / Profile / Patterns Engine

**Scope:** every endpoint under diary, insights, favourites, shopping list,
scan-history, badges, streaks, symptoms, patterns engine, and profile update.
Focus on gating consistency, IDOR, and personalisation staleness.

**Functions audited:**
Backend — `log_to_diary` (server.py:1229), `get_diary` (server.py:1269),
`get_diary_dates` (server.py:1283), `update_diary_note` (server.py:1297),
`delete_diary_entry` (server.py:1306), `get_patterns` (server.py:1313),
`log_symptoms` (server.py:1419), `get_today_symptoms` (server.py:1448),
`get_symptom_history` (server.py:1457), `get_streak_reward` (server.py:1521),
`get_favourites` (server.py:2381), `toggle_favourite` (server.py:2387),
`check_favourite` (server.py:2403), `get_scan_history` (server.py:2410),
`get_shopping_list` (server.py:2422), `add_shopping_item` (server.py:2429),
`toggle_shopping_item` (server.py:2446), `remove_shopping_item`
(server.py:2460), `clear_checked_items` (server.py:2469), `get_badges`
(server.py:2530), `get_weekly_report` (server.py:2574), `update_profile`
(server.py:728), `_refresh_streak` (server.py:846),
`_compute_streak_from_diary` (server.py:798), diary auto-save inside
`rate_food` (server.py:1097-1119).
Frontend — `MyFoodsScreen` (MyFoodsScreen.jsx:26), `InsightsScreen`
(InsightsScreen.jsx:295), `ProfileScreen` (ProfileScreen.jsx),
`FoodDiary` (FoodDiary.jsx).

**Config:** Diary auto-save runs for EVERY scan (free + premium) via
`rate_food` shared exit path (server.py:1097). `get_diary` gates free
users to today-only (server.py:1277). `get_scan_history` returns ALL
diary entries with no date restriction. Pattern cache TTL: `<7 days` AND
`<5 new logs since last generation`. Weekly report: last 7 UTC days.

### Findings

| # | Severity | Finding | File:line | Fix |
|---|---|---|---|---|
| 9.A | 🟡 | **Gating inconsistency: `/scan-history` is NOT premium-gated, but `/diary` IS** (free users see today only). `get_scan_history` (server.py:2410) returns ALL diary entries with full personalised rating fields (`dimensions`, `forYourCondition`, `alternatives`, `bodySystemsAffected`, `flags`). A free user has at most 1 auto-saved entry (their free scan), so blast radius is minimal at signup — but a previously-premium user who cancels retains full history access via `/scan-history` despite being paywall-locked out of `/diary`. Confusing gate semantics; potential enabler for churn-then-view workflow. | `backend/server.py:2410-2419` | Add `if not _effective_premium(current_user): raise HTTPException(403, ...)` OR downgrade `/scan-history` to return only `{food_name, overall_score, date}` for non-premium users, matching the free-tier promise. |
| 9.B | 🟡 | **Pattern cache staleness on profile change.** `get_patterns` serves cached patterns for up to 7 days or until 5 new diary logs (server.py:1327-1338). If the user updates their `conditions` in profile (server.py:731), the cache is NOT invalidated — patterns generated for `["pcos"]` continue serving to a user now marked `["endo"]`. Same personalisation-violation class as 2.B / 3.I but for insights. | `backend/server.py:1313-1338` + `update_profile` (server.py:728) | Invalidate pattern cache on any `conditions`-changing PUT: `await db.pattern_cache.delete_one({"user_id": uid})` in `update_profile` when `conditions` differs. Also include the current conditions in the cache key. |
| 9.C | 🟠 | **`update_diary_note` is NOT premium-gated** (server.py:1297). Free users cannot create diary entries (log gate at 1230), but the note-edit path is open. Harmless in practice (nothing to edit) but violates gate consistency. | `backend/server.py:1297-1304` | Add `if not _effective_premium(current_user): raise HTTPException(403, ...)`. |
| 9.D | 🟠 | **`delete_diary_entry` is NOT premium-gated** (server.py:1306). Free user can delete their own auto-saved free-scan entry. Might be intentional UX; document either way. | `backend/server.py:1306-1311` | Product decision: gate or leave. |
| 9.E | 🟠 | **`get_favourites`, `toggle_favourite`, `check_favourite` NOT premium-gated** (server.py:2381-2407). Free users can save unbounded favourites (no limit at DB layer). Cheap but violates the "unlimited favourites" premium promise from the marketing copy in `send_subscription_confirmed_email` (email.py:209). | `backend/server.py:2381-2407` | Add `_effective_premium` gate OR cap free-tier favourites at ~10 with a soft paywall. Align with marketing copy. |
| 9.F | 🟠 | **All shopping-list endpoints NOT premium-gated** (server.py:2422-2476). Same class as 9.E — marketing copy positions "Unlimited favourites and shopping list" as premium. | `backend/server.py:2422-2476` | Same: gate or cap. Align with marketing copy. |
| 9.G | 🟠 | **`get_badges` uses raw `is_premium` field** (server.py:2537, 2556), NOT `_effective_premium`. An expired-premium user (past `premium_expires_at` but before nightly `_sweep_expired_premium` runs at 00:00 UTC) still earns the `premium` badge. Up to 24 hours of stale badge state. | `backend/server.py:2537, 2556` | Replace with `is_premium = _effective_premium(current_user)`. |
| 9.H | 🟠 | **`get_diary` hardcodes `to_list(100)`** (server.py:1280). A premium user with >100 same-day logs (edge case, but possible if importing/backfilling) silently loses entries. | `backend/server.py:1280` | Remove the cap or paginate; realistic max entries per day likely <20 but safer to log with `logger.warning` when the cap is hit. |
| 9.I | 🟠 | **`get_diary_dates` capped at 365 entries** (server.py:1293). Users past 1 year of daily logging get their earliest days trimmed from the date picker. | `backend/server.py:1293` | Remove cap or return "has_older" flag when truncated so UI can prompt for older ranges. |
| 9.J | 🟠 | **Weekly-report symptom cap `to_list(14)`** (server.py:2587) — assumes at most 2 symptoms per day for 7 days. `log_symptoms` uses `update_one({user_id, date}, upsert=True)` — one entry per date. So max entries is 7. Cap of 14 is generous. Note only. | `backend/server.py:2587` | None. |
| 9.K | 🟠 | **Symptom history trend arithmetic amplifies small-number moves.** `pct = round(abs(delta / first_avg) * 100)` (server.py:1507). If first_avg is 0.5 and second_avg is 3.0, pct = 500%. Rendered as "Your energy has improved 500% recently — keep it up." Reads as absurd. | `backend/server.py:1507` | Cap displayed pct at 100% or use `(second_avg - first_avg) / 5` (5 = max scale) for a bounded percentage. |
| 9.L | 🟠 | **Streak boundary is UTC-based** (`datetime.now(timezone.utc).date()` at server.py:819, 1234, 1273, 1424). Users in negative UTC offsets (US Pacific = UTC−8) may see their evening log count as "next day" from the server's perspective. Streak may lag or advance a day early relative to local time. Note-only if user base is UK/EU-heavy; real UX bug for global users. | `backend/server.py:798-843` (`_compute_streak_from_diary`), all diary/symptom `today = datetime.now(timezone.utc).date().isoformat()` sites | Accept user timezone (from profile or `Intl.DateTimeFormat().resolvedOptions().timeZone` at signup) and compute "today" in that zone. |
| 9.M | 🟢 | **Diary auto-save at `rate_food` writes full rating fields** (server.py:1099-1119) with `$setOnInsert` — idempotent, safe on retry. Uses `scan_id` (uuid) as unique key. `db.diary.create_index("scan_id", unique=True, sparse=True)` at server.py:264. Correct. | `backend/server.py:1097-1119` | None. |
| 9.N | 🟢 | **`log_to_diary` spreads `data.model_dump(exclude_none=True)`** then overwrites `user_id` (server.py:1236-1242). Pydantic model does NOT declare a `user_id` field (verified via Field list), so no spoof surface. `entry["user_id"] = uid` is defensive. | `backend/server.py:1236-1242` | None. |
| 9.O | 🟢 | **`delete_diary_entry` filter includes `user_id`** (server.py:1310) — IDOR-safe. | `backend/server.py:1310` | None. |
| 9.P | 🟢 | **`update_diary_note` filter includes `user_id`** (server.py:1301) — IDOR-safe. | `backend/server.py:1301` | None. |
| 9.Q | 🟢 | **`toggle_shopping_item`, `remove_shopping_item`, `clear_checked_items`** all filter by `user_id` — IDOR-safe (server.py:2447-2475). | `backend/server.py:2447-2475` | None. |
| 9.R | 🟢 | **Pattern cache fallback to stale cache on Anthropic failure** (server.py:1411-1416). Correct UX — user sees old patterns rather than empty state. Note only. | `backend/server.py:1411-1416` | None. |
| 9.S | 🟢 | **`get_streak_reward` NOT gated** (server.py:1521-1538). Correct — streaks are free-tier feature; every authed user should see their milestone. | `backend/server.py:1521-1538` | None. |
| 9.T | 🟢 | **`update_profile` whitelist correctness** (already verified as 4.I). Note only. | `backend/server.py:728-756` | None. |
| 9.U | 🟢 | **`_refresh_streak` called from every authenticated request via `get_current_user`** — see 2.E (single aggregate query, cheap but not free). Also called from `log_to_diary`. Redundant. | `backend/server.py:458`, `_refresh_streak` at `846-867` | See 2.E — move to nightly cron. |
| 9.V | 🟢 | **Pattern prompt string-interpolates user conditions** (server.py:1371-1391) — same prompt-injection surface as 2.F. `conditions_str` from user profile → prompt. Low risk (self-harm only). | `backend/server.py:1371-1391` | Wrap in delimiter tags. |
| 9.W | 🟢 | **`log_symptoms` upsert on `(user_id, date)`** — natural idempotency; a re-check-in overwrites the earlier one for that day. Might surprise a user who checks in AM and PM. | `backend/server.py:1441-1445` | Product decision: overwrite (current) vs append multiple check-ins per day. |
| 9.X | 🟢 | **`ProfileScreen.jsx:219` builds referral link with hardcoded `https://theflourishapp.health`** — recap of 7.H. Note only, keep with §7. | `frontend/src/components/ProfileScreen.jsx:216-219` | See 7.H. |
| 9.Y | 🟢 | **`get_weekly_report` divides by counts guarded by ternary** (server.py:2590, 2594, 2595). Safe against div-by-zero. Note only. | `backend/server.py:2590-2595` | None. |

---

## Section 10 — Config / Secrets / Deployment

**Scope:** every environment variable, every hardcoded URL/email/key,
CORS config, JWT secret handling, redirect_slashes, git history exposure,
Railway + Netlify env expectations, startup checks, error tracking.

**Files audited:**
`backend/.env` (current — untracked), `backend/.env.example`,
`backend/server.py` env reads, `backend/services/email.py` hardcoded URLs,
`frontend/.env` (current — untracked), `frontend/src/lib/posthog.js`,
`frontend/src/context/AuthContext.js`, `netlify.toml`, `railway.json`,
`Dockerfile`, `.gitignore`.
Git history: commits `ab08a64`, `a4474a5`, `26c98bf` (touched `.env` files).

**Env vars read by backend (25 total):**
`MONGO_URL` (server.py:216, required — KeyError at import if missing),
`DB_NAME` (server.py:218, required), `JWT_SECRET` (server.py:425, required —
KeyError at first `create_access_token` call), `ENVIRONMENT` (server.py:222,
defaults to non-production), `ADMIN_SESSION_TOKEN` (server.py:225, 500 on
admin routes if missing), `ADMIN_SECRET` (server.py:242, falls back to
ADMIN_SESSION_TOKEN), `ADMIN_EMAIL` (server.py:303, defaults to
`admin@flourish.app`), `ADMIN_PASSWORD` (server.py:304, raises RuntimeError
at startup if missing), `CORS_ORIGINS` (server.py:361, 1561, optional
non-prod), `ANTHROPIC_API_KEY` (server.py:64, silent until first Anthropic
call then raises ValueError), `POSTHOG_API_KEY` (server.py:32, silent no-op),
`STRIPE_SECRET_KEY` (server.py:1545, 1617, 1697, 1716, 2003 — returns 500
if missing), `STRIPE_MONTHLY_PRICE_ID` (server.py:1552, 500 if missing),
`STRIPE_ANNUAL_PRICE_ID` (server.py:1554, 1854, 1890, 500/silent),
`STRIPE_WEBHOOK_SECRET` (server.py:1717, correctly rejects webhook with
500), `RESEND_API_KEY` (services/email.py:38, silent per-call warn),
`FRONTEND_URL` (server.py:2033, 2078, 2640 — silently defaults to
`https://theflourishapp.health` non-www).

**Env vars read by frontend (7 total):**
`REACT_APP_BACKEND_URL` (AuthContext.js:5, AdminDashboard.jsx:5,
AffiliateDashboard.jsx:6, AffiliateApplication.jsx:5 — defaults to Railway
URL), `REACT_APP_POSTHOG_KEY` (posthog.js:3 — defaults to placeholder,
silent disable), `REACT_APP_EMAILJS_SERVICE_ID`, `REACT_APP_EMAILJS_TEMPLATE_ID`,
`REACT_APP_EMAILJS_PUBLIC_KEY` (App.js:171-179, AuthContext.js:85-93),
`REACT_APP_STRIPE_PUBLISHABLE_KEY` (in `frontend/.env` — publishable key
by design, safe to ship).

**Git history — historical .env commits:**
`ab08a64` (2026-04-05): first `backend/.env` — placeholders only, no
secrets. `a4474a5`: second `backend/.env` — **CONTAINED REAL DEV
SECRETS: `JWT_SECRET`, `ADMIN_PASSWORD`, `EMERGENT_LLM_KEY`.** `26c98bf`:
deletion of both `.env` files. `.gitignore:84-85` now excludes `*.env` and
`*.env.*` — current local files are correctly untracked.

**Current local `backend/.env` (untracked):** contains LIVE
`ANTHROPIC_API_KEY` and LIVE `STRIPE_SECRET_KEY`. Missing every other
required var — server would not start against this file locally.

### Findings

| # | Severity | Finding | File:line | Fix |
|---|---|---|---|---|
| 10.A | 🔴 | **`JWT_SECRET` value was committed to git history** at `a4474a5` (visible via `git show a4474a5:backend/.env`): `flourish_jwt_secret_key_2026_very_secure_64_chars_abcdefghijklmnop`. If Railway's production `JWT_SECRET` env var is this same value (either through migration from the committed file or by the deployer copy-pasting from the dev file), **anyone with git-history access can mint valid JWTs for any user, bypassing all auth**. `create_access_token` uses HS256 (server.py:221, 436) so knowing the secret is enough to forge tokens. `token_version` revocation only helps AFTER an admin sees a compromise. | git commit `a4474a5:backend/.env`, `backend/server.py:425` (only reader) | **Verify Railway env panel** — if `JWT_SECRET` matches the committed string, rotate immediately AND `$inc: {token_version: 1}` on all `users` docs to invalidate every outstanding token. Consider `git filter-repo` to purge the value from history + force-push (destroys history but limits blast radius). |
| 10.B | 🔴 | **`ADMIN_PASSWORD="Flourish2026"` committed to git history** (`a4474a5:backend/.env`) AND still present in `backend/tests/test_flourish.py:14`, `memory/PRD.md:20, 119`, `test_reports/iteration_2.json:51`. Admin panel is protected only by this password + 3/min rate limit (server.py:2244-2257). If Railway `ADMIN_PASSWORD` still matches, an attacker with git-history access can log in as admin and use admin routes (list users, grant admin, delete accounts). | git `a4474a5:backend/.env`, `backend/tests/test_flourish.py:14`, `memory/PRD.md:20`, `test_reports/iteration_2.json:51`, `backend/server.py:304, 2244-2257` | **Rotate `ADMIN_PASSWORD` on Railway to a new high-entropy value.** Update `test_flourish.py` to read from env, not hardcode. Delete the password from `PRD.md` and `test_reports/iteration_2.json` (docs / test artifacts). Consider `git filter-repo` for history. |
| 10.C | 🟠 | **`EMERGENT_LLM_KEY="sk-emergent-4AfB2577e1fEfBcE67"` committed at `a4474a5`**. Not referenced anywhere in current code (verified via grep) — obsolete key from emergent.sh scaffolding. If the key is still valid on emergent.sh's platform, an attacker can drain the associated credit. Low blast radius (not Flourish's own key) but a real leaked credential in permanent git history. | git `a4474a5:backend/.env` | Revoke the key on emergent.sh. Include in the same `git filter-repo` cleanup as 10.A/10.B if pursued. |
| 10.D | 🔴 ✅ **FIXED** (`21b7445`, recap of 5.B) | **Trailing-slash webhook URL risk.** Resolved by the same one-line change as 5.B. See 5.B row for verification. | `backend/server.py:349` + Stripe dashboard URL | See 5.B. Ops task: verify Stripe dashboard URL has no trailing slash. |
| 10.E | 🟡 | **`ADMIN_EMAIL` default is `admin@flourish.app`** (server.py:303) — WRONG DOMAIN. The real domain is `theflourishapp.health` (matches the Netlify site). If `ADMIN_EMAIL` env var is unset on Railway, the startup owner-grant creates an admin user for a bogus email. Password reset for the real admin then goes to a mailbox no one owns. | `backend/server.py:303` | Default to `admin@theflourishapp.health` or (safer) make required — raise if missing at startup. |
| 10.F | 🟡 | **Missing startup validation for critical env vars.** `MONGO_URL`, `DB_NAME`, `ADMIN_PASSWORD` fail loudly (KeyError/RuntimeError at import/startup) — good. But `ANTHROPIC_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_MONTHLY_PRICE_ID`, `STRIPE_ANNUAL_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `POSTHOG_API_KEY`, `JWT_SECRET` (raises only at first token mint) can all be missing/typo'd on Railway and the server will still start. Users hit 500s or silent-drop features. Recap of 6.A, 8.B; consolidated here. | `backend/server.py:253-346` (lifespan) | Add a `_check_required_env()` call at top of `lifespan` that raises `RuntimeError` listing every missing required var. Non-required vars (POSTHOG, FRONTEND_URL) warn only. |
| 10.G | 🟡 | **CORS `_allow_origins` at server.py:355-359 includes `https://flourish123-production.up.railway.app`** (backend URL). Harmless origin (no valid callback URL there) but semantically odd and appears twice — also in `_ALLOWED_ORIGINS` set at server.py:568-572 used by `create_checkout` (recap of 5.M). | `backend/server.py:355-359` + `568-572` | Remove `flourish123-production.up.railway.app` from both. |
| 10.H | 🟡 | **CORS `allow_origins` list is hardcoded** (server.py:355-359). Any future domain migration (staging.theflourishapp.health, app.theflourishapp.health, mobile-webview.theflourishapp.health) requires a code change + redeploy. | `backend/server.py:355-359` | Move to env: `CORS_ORIGINS_ALLOWLIST=https://theflourishapp.health,https://www.theflourishapp.health` and parse at startup. Keep the fallback hardcoded list for safety if env is unset. |
| 10.I | 🟡 | **`FRONTEND_URL` silently defaults to `https://theflourishapp.health`** (non-www) at `server.py:2033, 2078, 2640` and hardcoded at `services/email.py:23`. All password-reset links, referral links, and email CTAs go to non-www. Users on `www.theflourishapp.health` get bounced cross-origin, potentially losing httpOnly cookie context. Recap of 5.H, 6.O, 7.H. | `backend/server.py:2033, 2078, 2640` + `backend/services/email.py:23` | Consolidate to a single module-level `FRONTEND_URL = os.environ.get("FRONTEND_URL", "https://theflourishapp.health")`. Also treat www + non-www as equivalent when redirecting from Stripe checkout. |
| 10.J | 🟠 | **Hardcoded admin/support emails throughout backend.** `theflourishfoodapp@gmail.com` at server.py:331 (owner-grant startup), server.py:2109 (affiliate application recipient); `hello@theflourishapp.health` at server.py:767 (support inbox), services/email.py:22 (reply-to). Any rebrand or address rotation requires code changes. | `backend/server.py:331, 767, 2109` + `backend/services/email.py:21-23` | Env-driven: `ADMIN_INBOX_EMAIL`, `SUPPORT_INBOX_EMAIL`, `OWNER_GRANT_EMAIL`. |
| 10.K | 🟠 | **No error tracking / crash reporting installed** (no Sentry, Rollbar, Bugsnag). Production 500s are only visible if someone tails Railway logs. Unhandled frontend exceptions bubble to the ErrorBoundary (index.js:5) but never phone home. First user complaint is the first signal of a crash. | Missing dependency, both `backend/requirements.txt` and `frontend/package.json` | Add `sentry-sdk[fastapi]` on backend (initialize in lifespan startup gated on `SENTRY_DSN`) + `@sentry/react` on frontend. Free tier covers small apps. |
| 10.L | 🟠 | **`.env.example` missing `ADMIN_SECRET`** — referenced at server.py:242 for the standalone affiliate admin endpoints, not documented in the example file. Deployer setting up a fresh Railway instance will not know to set it; will silently fall back to `ADMIN_SESSION_TOKEN` (fine but undocumented). | `backend/.env.example` (missing entry) | Add `# ADMIN_SECRET=<optional-separate-affiliate-admin-secret>` to `.env.example`. |
| 10.M | 🟠 | **Backend log level is INFO in production** (server.py:209). Every login writes `is_admin`, `is_premium`, `role` at INFO (1.E), `[register] referred_by=<raw>` at INFO (7.G exploit surface), `Stripe webhook received: <type>` at INFO (server.py:1738). Log tails aggregate PII. | `backend/server.py:209` | Set via env: `LOG_LEVEL = os.environ.get("LOG_LEVEL", "WARNING").upper()`. Keep DEBUG for troubleshooting; default to WARN in production. |
| 10.N | 🟠 | **`netlify.toml:6-8` declares only 2 build env vars** (`REACT_APP_BACKEND_URL`, `REACT_APP_FRONTEND_URL`). The other 5 (`REACT_APP_POSTHOG_KEY`, `REACT_APP_EMAILJS_SERVICE_ID`, `REACT_APP_EMAILJS_TEMPLATE_ID`, `REACT_APP_EMAILJS_PUBLIC_KEY`, `REACT_APP_STRIPE_PUBLISHABLE_KEY`) must be set in the Netlify dashboard env panel. If any are missing at build time, they ship as `undefined` and features silently break: PostHog disabled (8.A), EmailJS signup notifications throw at runtime (AuthContext.js:83-97 already wrapped in try/catch), Stripe.js not initialised. | `netlify.toml` | Either declare all vars in `netlify.toml` (values still come from Netlify dashboard via `${VAR}` reference syntax) OR add a `frontend/scripts/prebuild.js` that hard-fails when any required `REACT_APP_*` var is unset. |
| 10.O | 🟠 | **`Dockerfile` does not run as non-root** (implicit root). Also no `HEALTHCHECK` directive, so Railway relies on TCP-level checks only — a stuck asyncio event loop that stops responding to HTTP won't be detected. | `Dockerfile:1-13` | Add `RUN adduser --system --group flourish && USER flourish` (chown app dir). Add `HEALTHCHECK --interval=30s CMD curl -f http://localhost:${PORT:-8000}/api/ || exit 1`. |
| 10.P | 🟠 | **`railway.json` `restartPolicyMaxRetries: 10`** with default backoff — 10 restart attempts on failure before Railway gives up. During a bad env-var rotation this could burn credits fast; more importantly, once retries exhaust, the app is DOWN with no auto-recovery until manual intervention. No paging/alert. | `railway.json:8` | Consider raising to a higher number (Railway max is often 50) OR wire Railway's built-in alert email to the on-call inbox. |
| 10.Q | 🟢 | **`.gitignore:84-85`** correctly excludes `*.env` and `*.env.*`. Current local `.env` files are untracked. Note only — historical exposure is 10.A/10.B/10.C above. | `.gitignore:84-85` | None (already correct). |
| 10.R | 🟢 | **`STRIPE_WEBHOOK_SECRET` missing check is correct** — server.py:1720-1722 raises 500 if unset, preventing unauthenticated webhook processing. Note only. | `backend/server.py:1720-1722` | None. |
| 10.S | 🟢 | **JWT algorithm is HS256** (server.py:221) with symmetric secret — appropriate for single-service backend. Note only. `alg=none` vulnerability not possible with `jwt.encode(..., algorithm=JWT_ALGORITHM)` since PyJWT rejects algorithm-confusion by default. | `backend/server.py:221, 436, 446` | None. |
| 10.T | 🟢 | **`Dockerfile` uses `python:3.11-slim`** — pinned major.minor but not patch. Weekly Docker rebuild picks up 3.11.x security patches automatically. Acceptable trade-off. | `Dockerfile:1` | None (or pin to `python:3.11.11-slim` if reproducibility trumps auto-patch). |
| 10.U | 🟢 | **`Dockerfile` copies `backend/` only** — no test dir, no docs, no secrets from repo root. Image surface is minimal. Note only. | `Dockerfile:5` | None. |
| 10.V | 🟢 | **PostHog EU host hardcoded** (server.py:33, posthog.js:4) — correct for GDPR posture. Note only, recap of 8.P. | `backend/server.py:33`, `frontend/src/lib/posthog.js:4` | None. |
| 10.W | 🟢 | **Frontend `build/` contains no Stripe live key** (verified via `grep -E "pk_live_[A-Za-z0-9]{20}" build/`). Local `REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_live_...` only ships when Netlify build runs, and publishable keys are safe to expose (they authorize Stripe.js in the browser). Note only. | `frontend/.env:5`, `frontend/build/` | None. |
| 10.X | 🟢 | **`ADMIN_EMAIL` password rewrite on every startup** if password doesn't match (server.py:324-328) — allows env-driven password rotation without a manual DB step. Note only (defensive, correct). | `backend/server.py:324-328` | None. |

---
