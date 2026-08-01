# RESUME.md — Pre-Launch Audit Handoff

Session pausing mid-audit. This file captures everything needed to pick up cold.

---

## GIT STATE

- **Branch:** `main`, 5 commits ahead of `origin/main` (all unpushed).
- **Working tree — DO NOT DISCARD:**
  - `backend/server.py` is **modified but uncommitted** — this is the Bug 1 fix
    (cache-hit free-scan consumption) already applied in the working tree.
    ~240 lines changed (+112 / -128) restructuring `rate_food` into one shared
    exit path. Verify with `git diff backend/server.py`.
  - **Rollback point** if needed: `git checkout -- backend/server.py` reverts to
    the pre-fix state (commit `3995196 pre-fix checkpoint`).
- **Recent commits (oldest → newest):**
  ```
  3995196  pre-fix checkpoint
  5c0a513  audit: sections 1-2 findings
  c590d10  audit: section 3 findings
  880105e  audit: section 4 findings
  bc36ae2  audit: section 5 findings          ← HEAD (last audit commit)
  ```
- **Nothing has been pushed.** Fix-pass + push happen AFTER audit is complete.

---

## AUDIT PROGRESS

**Complete and written to `AUDIT.md` (all committed):**
- §1 Auth
- §2 Scan + scoring
- §3 Barcode
- §4 Paywall + onboarding
- §5 Stripe

**NEXT (still to audit):**
- §6 Email / Resend — welcome, all three crons, idempotency, copy accuracy
- §7 Referral — reward grant, self-referral + plus-address bypass, cap
- §8 PostHog — key real (not `.env` placeholder), all events fire
- §9 Diary / Insights / My Foods / Profile / patterns engine
- §10 Config / secrets — env vars, hardcoded values, silent failures on missing keys

**Audit process rule:** after each section, append findings table to `AUDIT.md`
and commit with message `audit: section N findings` (touching AUDIT.md only —
never app code during the audit).

---

## AFTER SECTION 10 — SINGLE FIX PASS

Once §10 lands, one controlled fix pass over ALL confirmed blockers, then push.
No fixes in the working tree yet except Bug 1 (which is already applied,
uncommitted). Fix pass will:

1. Land Bug 1's commit + regression tests.
2. Apply Bug 2 (+ the 2 related spots — refreshUser and global 401 interceptor).
3. Apply cache-pollution fix (option TBD — see pending decision).
4. Apply §3.B, §5.B (+ verify Stripe dashboard URL), and any other blockers
   surfaced by §6-10.
5. Push everything.

---

## PENDING DECISION — cache-pollution fix (server.py:1136)

Findings §2.B / §3.I: `barcode_cache.rating_data` stores per-user narrative
fields (`forYourCondition`, `dimensions.*.why`, `flags.warnings`, `flags.tips`,
`alternatives`, `bodySystemsAffected`, `verdict`). User A (PCOS) scans a
barcode → User B (coeliac) scans the same barcode within 24h → sees User A's
PCOS-flavoured narrative served verbatim. Violates the personalisation pitch.

**Options awaiting your call:**
- **Option A** — Strip per-user fields from the cached payload; keep numeric
  `overallScore` and objective dimension scores; re-run AI for per-user narrative
  on each scan. Preserves cache hit rate for the expensive rubric math.
- **Option B** — Disable the barcode cache entirely for launch. One-line change,
  no correctness risk, costs more per scan.

Not yet chosen. Ask user at start of fix pass.

---

## ENV BLOCKER — Python not on PATH

- `python`, `python3`, `py` all resolve to Windows Store stubs
  (`C:\Users\harle\AppData\Local\Microsoft\WindowsApps\python.exe`).
- Backend regression tests (Bug 1's `test_rate_food_gating.py`, when written)
  cannot run locally until Python is installed and on PATH.
- **Must be sorted BEFORE the fix pass.** Options: install via winget
  (`winget install Python.Python.3.12`), install from python.org, or use pyenv-win.
- Also need to add `pytest>=8.0`, `pytest-asyncio>=0.23`, `mongomock-motor>=0.0.35`
  under a `# --- test-only ---` block in `backend/requirements.txt` before the
  fix pass runs tests.

---

## CONFIRMED BLOCKERS (as of end of §5)

| # | Blocker | Where | Status |
|---|---|---|---|
| 1 | Bug 1: free-scan paywall bypass on barcode cache-hit | `backend/server.py` `rate_food` | Fix applied in working tree, uncommitted, tests not yet written |
| 2 | Bug 2: PWA aggressive logout (3 spots) | `frontend/src/context/AuthContext.js:39-45` (primary), `:127-129` (refreshUser), missing global 401 interceptor | Not started |
| 3 | Cache pollution: per-user narrative served to other users | `backend/server.py:1136` | ⏸ Awaiting option A vs B decision |
| 4 | 3.B: OFF barcode-provider lookup uncached — sustained traffic risks OFF throttling | `backend/server.py:2352-2378` | Not started |
| 5 | 5.B: Trailing-slash webhook URL risk | `backend/server.py:349` (`redirect_slashes=False`) + **verify Stripe dashboard URL has no trailing slash** | Not started |

Additional high-priority items surfaced by §5 that should ship in the same pass
(see AUDIT.md for full context): 5.A (immediate-unlock path skips confirmation
email + PostHog track). §6-10 may surface more.

---

## HOW TO RESUME

1. Read this file, then read `AUDIT.md` to reload full context.
2. `git status` — confirm `backend/server.py` still shows as modified.
3. `git log --oneline -6` — confirm `bc36ae2 audit: section 5 findings` is HEAD.
4. Continue read-only audit at **§6 (Email / Resend)** using the same rules:
   trace every pathway, name every function, `file:line` every finding.
   After the section: append to `AUDIT.md`, commit as `audit: section 6 findings`,
   report to user, wait for go.
