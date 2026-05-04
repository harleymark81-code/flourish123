/**
 * Referral flow end-to-end test (Node.js native fetch)
 * Run: node backend/tests/test_referral_flow.mjs
 */
const BASE = "https://flourish123-production.up.railway.app";
const TS   = Date.now();
const REFERRER_EMAIL  = `ref_referrer_${TS}@test.flourish`;
const REFERRED_EMAIL  = `ref_referred_${TS}@test.flourish`;
const FRESH_EMAIL     = `ref_fresh_${TS}@test.flourish`;
const PASSWORD        = "TestRef2026!";

let pass = 0, fail = 0;

function ok(label, cond, detail = "") {
  if (cond) { console.log(`  ✓  ${label}`); pass++; }
  else       { console.error(`  ✗  ${label}${detail ? " — " + detail : ""}`); fail++; }
}

async function api(method, path, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await r.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { _raw: text }; }
  return { status: r.status, json };
}

async function register(email, name, referred_by) {
  const payload = { email, password: PASSWORD, name };
  if (referred_by) payload.referred_by = referred_by;
  return api("POST", "/api/auth/register", payload);
}

async function login(email) {
  const { status, json } = await api("POST", "/api/auth/login", { email, password: PASSWORD });
  if (status !== 200) throw new Error(`Login ${email} failed ${status}: ${JSON.stringify(json)}`);
  return json.token || json.access_token;
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nFLOURISH REFERRAL FLOW TEST — ${new Date().toISOString()}`);
  console.log(`Backend: ${BASE}\n`);

  // ── 1. Register referrer ─────────────────────────────────────────────────
  console.log("1. Referrer registration");
  {
    const { status } = await register(REFERRER_EMAIL, "Ref Referrer");
    ok("register returns 200/201", [200, 201].includes(status), `got ${status}`);
  }

  const referrerToken = await login(REFERRER_EMAIL);

  const { status: s1, json: stats1 } = await api("GET", "/api/referrals/stats", null, referrerToken);
  ok("/api/referrals/stats endpoint exists (200)", s1 === 200, `got ${s1} — ${JSON.stringify(stats1)}`);
  ok("referral_code present", !!stats1.referral_code, stats1.referral_code);
  ok("referral_code length ≥ 6", (stats1.referral_code || "").length >= 6);
  ok("referral_link contains theflourishapp.health", (stats1.referral_link || "").includes("theflourishapp.health"), stats1.referral_link);
  ok(`referral_link contains ref= code`, (stats1.referral_link || "").includes(`ref=${stats1.referral_code}`));
  ok("referral_count = 0 initially", stats1.referral_count === 0, `got ${stats1.referral_count}`);
  ok("referral_rewarded = false initially", stats1.referral_rewarded === false, `got ${stats1.referral_rewarded}`);

  const referrerCode = stats1.referral_code;
  console.log(`   referral_code: ${referrerCode}`);

  // ── 2. Register referred user with referred_by ───────────────────────────
  console.log("\n2. Referred user registration");
  {
    const { status } = await register(REFERRED_EMAIL, "Ref Referred", referrerCode);
    ok("referred user registers 200/201", [200, 201].includes(status), `got ${status}`);
  }

  const referredToken = await login(REFERRED_EMAIL);

  // ── 3. Verify referred_by stored on user ─────────────────────────────────
  console.log("\n3. referred_by stored correctly");
  {
    const { status, json: me } = await api("GET", "/api/auth/me", null, referredToken);
    ok("/api/auth/me returns 200", status === 200, `got ${status}`);
    const user = me.user || me;
    ok(`referred_by = referrer code`, user.referred_by === referrerCode,
       `got "${user.referred_by}", expected "${referrerCode}"`);
    ok("referral_rewarded = false on referred user", user.referral_rewarded === false,
       `got ${user.referral_rewarded}`);
    ok("referral_count = 0 on referred user", user.referral_count === 0,
       `got ${user.referral_count}`);
    ok("14-day trial eligible (referred_by set + referral_rewarded=false)",
       !!user.referred_by && user.referral_rewarded === false);
  }

  // ── 4. Referred user /api/referrals/stats ───────────────────────────────
  console.log("\n4. Referred user referrals/stats");
  {
    const { status, json: stats } = await api("GET", "/api/referrals/stats", null, referredToken);
    ok("returns 200", status === 200, `got ${status}`);
    ok("has referral_code", !!stats.referral_code);
    ok("has referral_link with theflourishapp.health", (stats.referral_link || "").includes("theflourishapp.health"), stats.referral_link);
    ok("has referral_count = 0", stats.referral_count === 0, `got ${stats.referral_count}`);
    ok("has referral_rewarded = false", stats.referral_rewarded === false, `got ${stats.referral_rewarded}`);
  }

  // ── 5. Old /api/referral/stats still works (singular) ───────────────────
  console.log("\n5. Old /api/referral/stats (singular) still works");
  {
    const { status } = await api("GET", "/api/referral/stats", null, referrerToken);
    ok("old endpoint still returns 200", status === 200, `got ${status}`);
  }

  // ── 6. Referrer count unchanged before subscription ──────────────────────
  console.log("\n6. Referrer stats unchanged (referred user hasn't subscribed yet)");
  {
    const { json: stats } = await api("GET", "/api/referrals/stats", null, referrerToken);
    ok("referral_count still 0 before subscription", stats.referral_count === 0,
       `got ${stats.referral_count}`);
  }

  // ── 7. Fresh user has new fields ─────────────────────────────────────────
  console.log("\n7. Any new user gets referral_rewarded + referral_count fields");
  {
    await register(FRESH_EMAIL, "Fresh User");
    const freshToken = await login(FRESH_EMAIL);
    const { json: me } = await api("GET", "/api/auth/me", null, freshToken);
    const user = me.user || me;
    ok("referral_rewarded field exists", "referral_rewarded" in user, JSON.stringify(Object.keys(user)));
    ok("referral_count field exists",    "referral_count" in user,    JSON.stringify(Object.keys(user)));
    ok("referral_rewarded = false",      user.referral_rewarded === false, `got ${user.referral_rewarded}`);
    ok("referral_count = 0",             user.referral_count === 0,        `got ${user.referral_count}`);
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log(`\n${"─".repeat(50)}`);
  console.log(`Passed: ${pass}  Failed: ${fail}`);

  if (fail > 0) {
    console.log(`\nWEBHOOK NOTE: The referral reward (referrer +30 days, referral_count++,`);
    console.log(`referral_rewarded=True) fires inside the Stripe webhook which requires`);
    console.log(`signature verification. To test it manually:`);
    console.log(`  1. Install Stripe CLI`);
    console.log(`  2. stripe listen --forward-to ${BASE}/api/payments/webhook`);
    console.log(`  3. Complete a real checkout as the referred user`);
    console.log(`  4. Check Railway logs for "Referral reward granted:"`);
    process.exit(1);
  } else {
    console.log(`\nAll pre-webhook checks passed.`);
    console.log(`Webhook reward logic (referrer +30 days, count++, rewarded flag) requires`);
    console.log(`a real Stripe checkout to trigger — use Stripe CLI or test in production.`);
  }
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
