"""Regression test for finding 5.B / 10.D — trailing-slash webhook risk.

FastAPI's default `redirect_slashes=True` returns 307 on trailing-slash
URLs. Stripe does NOT follow 3xx on webhook delivery — every webhook
would silently fail. The fix sets `redirect_slashes=False` at
FastAPI init, so a trailing-slash POST returns 404 (visible in logs)
rather than a silent 307.

Runs against a deployed backend via REACT_APP_BACKEND_URL. No auth
required — the webhook route is open (its own signature check gates
processing).
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

pytestmark = pytest.mark.skipif(not BASE_URL, reason="REACT_APP_BACKEND_URL not set")


def test_webhook_trailing_slash_returns_404_not_307():
    """POST /api/webhook/stripe/ (trailing slash) must NOT redirect —
    a 307 here would silently break Stripe webhook delivery in prod.
    """
    resp = requests.post(
        f"{BASE_URL}/api/webhook/stripe/",
        headers={"Content-Type": "application/json"},
        data=b"{}",
        allow_redirects=False,
        timeout=10,
    )
    assert resp.status_code != 307, (
        "REGRESSION (5.B/10.D): FastAPI is redirecting trailing-slash "
        "webhook URLs. Stripe drops 3xx on webhook delivery — every "
        "webhook would silently fail. Set redirect_slashes=False."
    )
    # 404 is the expected response now that redirects are disabled.
    # (400 would also be acceptable if FastAPI ever routes it to the
    # webhook handler and the signature check rejects.)
    assert resp.status_code in (404, 400), (
        f"unexpected status {resp.status_code} for trailing-slash webhook"
    )


def test_webhook_no_trailing_slash_reaches_handler():
    """Sanity check: the correct URL (no trailing slash) must still route
    to the webhook handler. Without a valid Stripe signature the handler
    returns 400, which proves the request reached it.
    """
    resp = requests.post(
        f"{BASE_URL}/api/webhook/stripe",
        headers={"Content-Type": "application/json"},
        data=b"{}",
        allow_redirects=False,
        timeout=10,
    )
    # Handler exists and runs; signature check rejects with 400.
    # If STRIPE_WEBHOOK_SECRET is unset on the server it returns 500 (also fine — proves the route matched).
    assert resp.status_code in (400, 500), (
        f"webhook route not reachable: got {resp.status_code}, expected 400 or 500"
    )
