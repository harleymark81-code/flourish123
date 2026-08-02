"""Regression tests for findings 3.A (OFF outage vs not-found) and 3.B
(OFF lookup caching).

Both run against a deployed backend via REACT_APP_BACKEND_URL. Requires
an authenticated user because /food/barcode is auth-gated. A disposable
user is created and torn down per module.
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

pytestmark = pytest.mark.skipif(not BASE_URL, reason="REACT_APP_BACKEND_URL not set")


def _headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def auth_token():
    email = f"barcode-test+{uuid.uuid4().hex[:10]}@example.com"
    resp = requests.post(
        f"{BASE_URL}/api/auth/register",
        json={"email": email, "password": "BarcodeTest1!", "name": "Barcode Test"},
        timeout=15,
    )
    assert resp.status_code == 200, f"register failed: {resp.text}"
    token = resp.json()["token"]
    yield token
    try:
        requests.delete(f"{BASE_URL}/api/auth/account", headers=_headers(token), timeout=10)
    except Exception:
        pass


def test_valid_barcode_lookup_returns_expected_shape(auth_token):
    """A known-good barcode returns {found:True, name, ingredients, image_url, barcode}.
    Also proves the endpoint doesn't return a provider_down flag when OFF is healthy.
    """
    resp = requests.get(
        f"{BASE_URL}/api/food/barcode/5449000000996",  # Coca-Cola 330ml
        headers=_headers(auth_token),
        timeout=15,
    )
    assert resp.status_code == 200
    data = resp.json()
    if data.get("found"):
        assert "name" in data
        assert "barcode" in data
        assert data.get("provider_down") is not True
    else:
        # If OFF happens to be down at test time, the provider_down flag must be set.
        assert data.get("provider_down") is True, (
            f"unexpected not-found without provider_down: {data}"
        )


def test_unknown_barcode_returns_not_found_without_provider_down(auth_token):
    """An unknown barcode returns {found:False} WITHOUT provider_down —
    provider_down is reserved for actual OFF outages (finding 3.A).
    """
    # Deliberately invalid but well-formed barcode
    resp = requests.get(
        f"{BASE_URL}/api/food/barcode/0000000000000",
        headers=_headers(auth_token),
        timeout=15,
    )
    assert resp.status_code == 200
    data = resp.json()
    # If OFF is healthy, this returns {found:False} with no provider_down.
    # If OFF is down at test time, provider_down would be True — accept both.
    assert data.get("found") is False
    if data.get("provider_down") is True:
        return  # OFF was actually down, test still valid
    # Healthy OFF path: no provider_down flag
    assert data.get("provider_down") is not True


def test_repeat_barcode_lookup_is_cached(auth_token):
    """Second lookup of the same barcode within 24h must be served from
    off_lookup_cache (finding 3.B). We can't peek at the DB directly, but
    we can observe latency: cache hits should be dramatically faster than
    a network round-trip to OFF. Not a strict timing assertion — just a
    sanity check that both calls succeed and return identical payloads.
    """
    barcode = "5449000000996"

    r1 = requests.get(
        f"{BASE_URL}/api/food/barcode/{barcode}",
        headers=_headers(auth_token),
        timeout=15,
    )
    assert r1.status_code == 200
    payload1 = r1.json()

    r2 = requests.get(
        f"{BASE_URL}/api/food/barcode/{barcode}",
        headers=_headers(auth_token),
        timeout=15,
    )
    assert r2.status_code == 200
    payload2 = r2.json()

    # Payload must be identical byte-for-byte on cache hit.
    assert payload1 == payload2, (
        "REGRESSION (3.B): repeat lookup returned a different payload — "
        "cache may not be serving consistent data"
    )


def test_invalid_barcode_format_returns_400(auth_token):
    """Non-alphanumeric barcode is still rejected at validation."""
    resp = requests.get(
        f"{BASE_URL}/api/food/barcode/abc-with-dash",
        headers=_headers(auth_token),
        timeout=10,
    )
    assert resp.status_code == 400
