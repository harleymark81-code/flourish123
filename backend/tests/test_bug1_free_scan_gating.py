"""Regression test for Bug 1 — cache-hit paywall bypass.

Prior bug: /food/rate's barcode cache-hit branch returned early, skipping
the has_used_free_scan update. Free users could get unlimited scans of any
cached product. The fix moves the consume block into a shared exit path
that runs on BOTH cache-hit and cache-miss.

These tests run against a deployed backend (staging or prod) via
REACT_APP_BACKEND_URL. Each test provisions a disposable user and deletes
it in a finally block, so re-runs are idempotent and no test artefacts
persist. The critical invariant checked: after ONE /food/rate call, the
second call must be HTTP 403.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

pytestmark = pytest.mark.skipif(not BASE_URL, reason="REACT_APP_BACKEND_URL not set")


def _headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _register_fresh_user():
    email = f"bug1-test+{uuid.uuid4().hex[:10]}@example.com"
    password = "Bug1TestPass!"
    resp = requests.post(
        f"{BASE_URL}/api/auth/register",
        json={"email": email, "password": password, "name": "Bug1 Test"},
        timeout=15,
    )
    assert resp.status_code == 200, f"register failed: {resp.status_code} {resp.text}"
    return resp.json()["token"]


def _complete_onboarding(token):
    requests.put(
        f"{BASE_URL}/api/profile",
        headers=_headers(token),
        json={
            "conditions": ["not_sure"],
            "goals": [],
            "managing_duration": "unknown",
            "food_challenge": "",
            "onboarding_completed": True,
        },
        timeout=15,
    )


def _delete_account(token):
    try:
        requests.delete(f"{BASE_URL}/api/auth/account", headers=_headers(token), timeout=15)
    except Exception:
        pass  # cleanup best-effort


def test_second_free_scan_is_paywalled_after_text_scan():
    """Baseline invariant: text-first scan must consume the free scan."""
    token = _register_fresh_user()
    try:
        _complete_onboarding(token)
        r1 = requests.post(
            f"{BASE_URL}/api/food/rate",
            headers=_headers(token),
            json={"food_name": "apple"},
            timeout=60,
        )
        assert r1.status_code == 200, f"first scan failed: {r1.status_code} {r1.text}"

        r2 = requests.post(
            f"{BASE_URL}/api/food/rate",
            headers=_headers(token),
            json={"food_name": "banana"},
            timeout=30,
        )
        assert r2.status_code == 403, (
            f"REGRESSION: second free scan not paywalled — {r2.status_code} {r2.text}"
        )
    finally:
        _delete_account(token)


def test_second_free_scan_is_paywalled_after_barcode_scan():
    """Bug 1 regression: barcode-first scan (may cache-hit) must also
    consume the free scan. This is the exact case Bug 1 broke — cache-hit
    returned early, skipping consume, leaving has_used_free_scan=False.
    """
    token = _register_fresh_user()
    try:
        _complete_onboarding(token)
        # Coca-Cola 330ml — extremely common OFF entry, likely cached
        r1 = requests.post(
            f"{BASE_URL}/api/food/rate",
            headers=_headers(token),
            json={"food_name": "Coca-Cola", "barcode": "5449000000996"},
            timeout=60,
        )
        assert r1.status_code == 200, f"first (barcode) scan failed: {r1.status_code} {r1.text}"

        r2 = requests.post(
            f"{BASE_URL}/api/food/rate",
            headers=_headers(token),
            json={"food_name": "orange"},
            timeout=30,
        )
        assert r2.status_code == 403, (
            f"REGRESSION (Bug 1): second scan not paywalled after "
            f"barcode-first scan — {r2.status_code} {r2.text}"
        )
    finally:
        _delete_account(token)
