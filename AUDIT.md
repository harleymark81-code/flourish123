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



