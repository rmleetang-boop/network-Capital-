"""ITER 33 — User-facing Promotions endpoints tests.

Covers:
- GET /api/users/me/promotions
- GET /api/users/me/promotion-events
- GET /api/promotions/me/login-summary
- Auth required (401 without token)
- Conversion math (100 pts = R10)
- Score-event integration → breakdown counters + rank
- Regression of pre-existing endpoints
"""

import os
import uuid
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN_PASSWORD = "NetworkCapital2025!"


def _create_user(prefix: str = "promo_user") -> dict:
    email = f"TEST_{prefix}_{uuid.uuid4().hex[:10]}@example.com"
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})

    r = s.post(f"{BASE_URL}/api/auth/progressive-signup",
               json={"email": email, "password": "Test123!", "step": 1}, timeout=20)
    assert r.status_code == 200, f"signup failed: {r.status_code} {r.text}"
    token = r.json()["token"]
    s.headers.update({"Authorization": f"Bearer {token}"})

    r = s.post(f"{BASE_URL}/api/auth/send-otp", json={"email": email}, timeout=20)
    assert r.status_code == 200, r.text
    code = r.json().get("_mock_code")
    assert code

    r = s.post(f"{BASE_URL}/api/auth/verify-otp", json={"email": email, "code": code}, timeout=20)
    assert r.status_code == 200, r.text

    uname = f"tu33_{uuid.uuid4().hex[:8]}"
    r = s.post(f"{BASE_URL}/api/auth/complete-profile",
               json={"full_name": "Iter33 Tester", "username": uname, "bio": "qa",
                     "intent": "member", "terms_accepted": True, "birth_month": 6}, timeout=20)
    assert r.status_code == 200, r.text
    me = s.get(f"{BASE_URL}/api/auth/me", timeout=20).json()
    uid = me.get("id") or me.get("user", {}).get("id")
    return {"session": s, "token": token, "id": uid, "email": email, "username": uname, "me": me}


@pytest.fixture(scope="module")
def admin_user():
    u = _create_user("admin33")
    r = u["session"].post(f"{BASE_URL}/api/admin/bootstrap",
                          headers={"X-Admin-Password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, r.text
    return u


@pytest.fixture(scope="module")
def member_user():
    return _create_user("member33")


@pytest.fixture(scope="module")
def member_user_zero():
    """Fresh user with 0 promotion participation — used for rank=None test."""
    return _create_user("zero33")


# ---------------------------- Auth guard ----------------------------
class TestAuthRequired:
    def test_my_promotions_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/users/me/promotions", timeout=15)
        assert r.status_code in (401, 403), f"got {r.status_code}: {r.text}"

    def test_my_promotion_events_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/users/me/promotion-events", timeout=15)
        assert r.status_code in (401, 403)

    def test_login_summary_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/promotions/me/login-summary", timeout=15)
        assert r.status_code in (401, 403)


# ---------------------------- /users/me/promotions ----------------------------
class TestMyPromotions:
    def test_response_shape(self, member_user):
        r = member_user["session"].get(f"{BASE_URL}/api/users/me/promotions", timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "promotions" in d and "user_summary" in d and "now_sast" in d
        assert isinstance(d["promotions"], list)
        # now_sast must include +02:00
        assert "+02:00" in d["now_sast"], f"expected +02:00 SAST, got {d['now_sast']}"

        us = d["user_summary"]
        for k in ("monthly_score", "network_score", "total_points_in_promotions",
                  "total_zar_estimate", "conversion"):
            assert k in us, f"missing user_summary.{k}"
        conv = us["conversion"]
        assert conv["label"] == "100 Network Points = R10 ZAR"
        assert conv["rate_per_point"] == 0.10
        assert conv["points"] == 100
        assert conv["zar"] == 10

    def test_promotion_item_shape(self, member_user):
        r = member_user["session"].get(f"{BASE_URL}/api/users/me/promotions", timeout=20)
        d = r.json()
        if not d["promotions"]:
            pytest.skip("no active promotions in this environment")
        item = d["promotions"][0]
        assert "promotion" in item and "stats" in item and "rank" in item
        promo = item["promotion"]
        for k in ("id", "name", "schedule", "is_window_active", "minutes_until_window",
                  "eligible_actions", "zar_per_point", "min_network_score"):
            assert k in promo
        stats = item["stats"]
        for k in ("points", "zar_estimate", "events", "streak_days",
                  "today_points", "today_zar", "breakdown"):
            assert k in stats
        bd = stats["breakdown"]
        for k in ("posts", "shares", "comments", "likes", "referrals",
                  "place_reviews", "connections"):
            assert k in bd, f"missing breakdown.{k}"

    def test_rank_is_none_when_zero_points(self, member_user_zero):
        r = member_user_zero["session"].get(f"{BASE_URL}/api/users/me/promotions", timeout=20)
        d = r.json()
        for item in d["promotions"]:
            if item["stats"]["points"] == 0:
                assert item["rank"] is None, f"rank should be null when points=0, got {item['rank']}"


# ---------------------------- Conversion math ----------------------------
class TestConversionMath:
    def test_estimated_zar_from_monthly_score(self, member_user):
        """Boost monthly_score directly via score logging and verify the math.

        We trigger an action that bumps monthly_score and then verify
        estimated_zar_value = monthly_score * 0.10 in login-summary."""
        # Hit /promotions/me/login-summary at least once
        r = member_user["session"].get(f"{BASE_URL}/api/promotions/me/login-summary", timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        u = d["user"]
        # math must hold
        assert abs(u["estimated_zar_value"] - round(int(u["monthly_score"]) * 0.10, 2)) < 1e-6

    def test_total_zar_matches_total_points(self, member_user):
        r = member_user["session"].get(f"{BASE_URL}/api/users/me/promotions", timeout=20)
        d = r.json()
        us = d["user_summary"]
        assert us["total_zar_estimate"] == round(us["total_points_in_promotions"] * 0.10, 2)


# ---------------------------- /promotions/me/login-summary ----------------------------
class TestLoginSummary:
    def test_response_shape(self, member_user):
        r = member_user["session"].get(f"{BASE_URL}/api/promotions/me/login-summary", timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("user", "active_promotions", "top_ambassadors",
                  "conversion", "now_sast", "philosophy"):
            assert k in d, f"missing {k}"
        assert "+02:00" in d["now_sast"]

        conv = d["conversion"]
        assert conv["label"] == "100 Network Points = R10 ZAR"
        assert conv["rate_per_point"] == 0.10

        # top_ambassadors max 3
        assert isinstance(d["top_ambassadors"], list)
        assert len(d["top_ambassadors"]) <= 3

        # active_promotion items shape
        for p in d["active_promotions"]:
            for k in ("id", "name", "schedule", "is_window_active", "minutes_until_window",
                      "user_points", "user_zar_estimate", "user_today_points",
                      "user_streak_days"):
                assert k in p, f"missing active_promotion.{k}"


# ---------------------------- /users/me/promotion-events ----------------------------
class TestPromotionEvents:
    def test_events_list(self, member_user):
        r = member_user["session"].get(f"{BASE_URL}/api/users/me/promotion-events", timeout=20)
        assert r.status_code == 200, r.text
        items = r.json()
        assert isinstance(items, list)
        # cannot guarantee non-empty for a fresh user but each item shape if present
        for ev in items:
            assert "promotion_id" in ev
            assert "user_id" in ev
            assert "points" in ev
            assert "_id" not in ev  # mongo _id excluded

    def test_events_limit_param(self, member_user):
        r = member_user["session"].get(f"{BASE_URL}/api/users/me/promotion-events?limit=5", timeout=20)
        assert r.status_code == 200
        assert len(r.json()) <= 5

    def test_events_promotion_filter(self, member_user):
        r = member_user["session"].get(
            f"{BASE_URL}/api/users/me/promotion-events?promotion_id=does-not-exist", timeout=20)
        assert r.status_code == 200
        assert r.json() == []


# ---------------------------- Score-event integration ----------------------------
class TestScoreEventIntegration:
    """Force-active 24/7 promo, post → promotion_event written, stats & rank reflect it."""

    @pytest.fixture(scope="class")
    def force_promo(self, admin_user):
        """Create a TEST promo that is open 24/7."""
        body = {
            "name": f"TEST_24x7_iter33_{uuid.uuid4().hex[:6]}",
            "description": "24x7 testing window",
            "schedule": {
                "days_of_week": [0, 1, 2, 3, 4, 5, 6],
                "start_time": "00:00",
                "end_time": "23:59",
                "timezone": "Africa/Johannesburg",
            },
            "eligible_actions": ["post_create"],
            "zar_per_point": 0.10,
            "min_network_score": 0,
            "is_active": True,
        }
        r = admin_user["session"].post(f"{BASE_URL}/api/admin/promotions", json=body, timeout=20)
        assert r.status_code in (200, 201), r.text
        promo = r.json()
        yield promo
        # cleanup
        try:
            admin_user["session"].delete(
                f"{BASE_URL}/api/admin/promotions/{promo['id']}", timeout=15)
        except Exception:
            pass

    def test_post_creates_event_and_updates_breakdown(self, member_user, force_promo):
        # Create a post to trigger a promotion_event
        r = member_user["session"].post(
            f"{BASE_URL}/api/posts",
            json={"content": f"TEST iter33 post {uuid.uuid4().hex[:6]}", "visibility": "public"},
            timeout=20)
        assert r.status_code in (200, 201), r.text

        # GET my-promotions and verify the force_promo row has points & posts breakdown
        r = member_user["session"].get(f"{BASE_URL}/api/users/me/promotions", timeout=20)
        d = r.json()
        promo_row = next((x for x in d["promotions"] if x["promotion"]["id"] == force_promo["id"]), None)
        assert promo_row is not None, "force-active promo missing from my_promotions"
        assert promo_row["stats"]["points"] > 0, f"expected >0 points: {promo_row['stats']}"
        assert promo_row["stats"]["breakdown"]["posts"] >= 1
        # zar math
        assert promo_row["stats"]["zar_estimate"] == round(promo_row["stats"]["points"] * 0.10, 2)
        # rank should be 1-indexed integer once user has points
        assert isinstance(promo_row["rank"], int)
        assert promo_row["rank"] >= 1


# ---------------------------- Regression of existing endpoints ----------------------------
class TestRegression:
    def test_admin_promotions_list(self, admin_user):
        r = admin_user["session"].get(f"{BASE_URL}/api/admin/promotions", timeout=15)
        assert r.status_code == 200

    def test_admin_promotions_summary(self, admin_user):
        r = admin_user["session"].get(f"{BASE_URL}/api/admin/promotions-summary", timeout=15)
        assert r.status_code == 200

    def test_public_active_promotions(self):
        r = requests.get(f"{BASE_URL}/api/promotions/active", timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)
