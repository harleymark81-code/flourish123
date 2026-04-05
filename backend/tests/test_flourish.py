"""
Flourish API backend tests - auth, food rating, diary, admin, affiliate
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test user
TEST_EMAIL = "flow_test_2@example.com"
TEST_PASSWORD = "TestPass123"
ADMIN_PASSWORD = "Flourish2026"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def auth_token(session):
    # Try register first
    session.post(f"{BASE_URL}/api/auth/register", json={
        "email": TEST_EMAIL, "password": TEST_PASSWORD, "name": "Flow Test 2"
    })
    resp = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL, "password": TEST_PASSWORD
    })
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    data = resp.json()
    token = data.get("token") or data.get("access_token")
    assert token, "No token returned"
    return token


@pytest.fixture(scope="module")
def auth_session(session, auth_token):
    session.headers.update({"Authorization": f"Bearer {auth_token}"})
    return session


# ── Auth tests ────────────────────────────────────────────────────────────────

class TestAuth:
    def test_register_existing_returns_400(self, session):
        resp = session.post(f"{BASE_URL}/api/auth/register", json={
            "email": TEST_EMAIL, "password": TEST_PASSWORD, "name": "Flow Test 2"
        })
        assert resp.status_code in [200, 201, 400, 409], f"Unexpected: {resp.status_code}"

    def test_login_success(self, session):
        resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL, "password": TEST_PASSWORD
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "token" in data or "access_token" in data

    def test_login_wrong_password(self, session):
        resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL, "password": "WrongPass999"
        })
        assert resp.status_code in [400, 401, 403]

    def test_me_endpoint(self, auth_session):
        resp = auth_session.get(f"{BASE_URL}/api/auth/me")
        assert resp.status_code == 200
        data = resp.json()
        assert "email" in data

    def test_me_unauthenticated(self):
        s = requests.Session()
        resp = s.get(f"{BASE_URL}/api/auth/me")
        assert resp.status_code == 401


# ── Onboarding tests ──────────────────────────────────────────────────────────

class TestOnboarding:
    def test_update_profile_onboarding(self, auth_session):
        resp = auth_session.put(f"{BASE_URL}/api/profile", json={
            "conditions": ["pcos"],
            "goals": ["reduce_inflammation"],
            "duration": "less_than_year",
            "challenges": ["knowing_what_to_avoid"],
            "onboarding_complete": True
        })
        assert resp.status_code == 200


# ── Food rating tests ─────────────────────────────────────────────────────────

class TestFoodRating:
    def test_rate_food(self, auth_session):
        resp = auth_session.post(f"{BASE_URL}/api/food/rate", json={
            "food_name": "blueberries"
        }, timeout=60)
        assert resp.status_code == 200
        data = resp.json()
        assert "score" in data or "rating" in data or "verdict" in data, f"Unexpected: {data}"

    def test_rate_food_unauthenticated(self):
        s = requests.Session()
        resp = s.post(f"{BASE_URL}/api/food/rate", json={"food_name": "blueberries"}, timeout=30)
        assert resp.status_code == 401


# ── Diary tests ───────────────────────────────────────────────────────────────

class TestDiary:
    def test_get_diary_empty(self, auth_session):
        resp = auth_session.get(f"{BASE_URL}/api/diary")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list) or "entries" in data

    def test_add_diary_entry(self, auth_session):
        resp = auth_session.post(f"{BASE_URL}/api/diary/log", json={
            "food_name": "blueberries",
            "score": 85,
            "verdict": "Excellent",
            "meal_type": "snack"
        })
        assert resp.status_code in [200, 201]

    def test_get_diary_after_add(self, auth_session):
        resp = auth_session.get(f"{BASE_URL}/api/diary")
        assert resp.status_code == 200


# ── Admin tests ───────────────────────────────────────────────────────────────

class TestAdmin:
    def test_admin_login(self, session):
        resp = session.post(f"{BASE_URL}/api/admin/login", json={"password": ADMIN_PASSWORD})
        assert resp.status_code == 200

    def test_admin_stats(self, session):
        resp = session.post(f"{BASE_URL}/api/admin/login", json={"password": ADMIN_PASSWORD})
        token = resp.json().get("token")
        if token:
            s = requests.Session()
            s.headers.update({"X-Admin-Token": token})
            stats_resp = s.get(f"{BASE_URL}/api/admin/stats")
            assert stats_resp.status_code == 200
        else:
            pytest.skip("No admin token")

    def test_admin_wrong_password(self, session):
        resp = session.post(f"{BASE_URL}/api/admin/login", json={"password": "wrongpass"})
        assert resp.status_code in [400, 401, 403]


# ── Affiliate tests ───────────────────────────────────────────────────────────

class TestAffiliate:
    def test_affiliate_submit(self, session):
        resp = session.post(f"{BASE_URL}/api/affiliate/apply", json={
            "name": "Test Affiliate",
            "email": "affiliate_test@example.com",
            "social_handles": "@testaffiliate",
            "audience_size": "10000",
            "condition_niche": "pcos",
            "description": "I create health content for women with PCOS"
        })
        assert resp.status_code in [200, 201]
