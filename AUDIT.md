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
