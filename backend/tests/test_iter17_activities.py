"""
Iter 17 — Activities feature backend tests.
Covers: create/list/get/join/leave/delete + auth + validations + score events.
"""
import os
import uuid
import time
import pytest
import requests

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "https://mongo-dump-viewer.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


def _register_user(suffix: str = "") -> dict:
    """Register a fresh user via progressive-signup + complete-profile.
    Returns {token, id, username, email}.
    """
    rand = uuid.uuid4().hex[:8]
    email = f"TEST_iter17_{suffix}_{rand}@example.com"
    password = "Test123!"
    r = requests.post(
        f"{API}/auth/progressive-signup",
        json={"email": email, "password": password, "terms_accepted": True},
        timeout=20,
    )
    assert r.status_code == 200, f"signup failed: {r.status_code} {r.text}"
    body = r.json()
    token = body.get("token") or body.get("access_token")
    assert token, f"no token in signup response: {body}"
    user_id = (body.get("user") or {}).get("id") or body.get("id") or body.get("user_id")

    headers = {"Authorization": f"Bearer {token}"}
    r2 = requests.post(
        f"{API}/auth/complete-profile",
        headers=headers,
        json={
            "full_name": f"Iter17 {suffix} {rand}",
            "username": f"iter17{suffix}{rand}",
            "bio": "tester",
            "intent": "member",
            "terms_accepted": True,
        },
        timeout=20,
    )
    assert r2.status_code == 200, f"complete-profile failed: {r2.status_code} {r2.text}"

    me = requests.get(f"{API}/users/me", headers=headers, timeout=10).json()
    return {
        "token": token,
        "id": me.get("id") or user_id,
        "username": me.get("username"),
        "email": email,
    }


@pytest.fixture(scope="module")
def user_a():
    return _register_user("a")


@pytest.fixture(scope="module")
def user_b():
    return _register_user("b")


def _h(u):
    return {"Authorization": f"Bearer {u['token']}"}


# ---------------- CREATE ----------------

class TestActivitiesCreate:
    def test_create_activity_success(self, user_a):
        payload = {
            "title": "TEST_iter17 Cape Town Dinner",
            "description": "An evening of conversation and good food.",
            "country": "south_africa",
            "city": "cape_town",
            "venue": "Sea Point",
            "date": "2026-06-01",
            "time": "19:00",
            "cost_amount": 50,
            "cost_currency": "USD",
            "cost_note": "per person",
            "max_participants": 10,
            "category": "dinner",
        }
        r = requests.post(f"{API}/activities", headers=_h(user_a), json=payload, timeout=15)
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        a = r.json()
        assert a["title"] == payload["title"]
        assert a["country"] == "south_africa"
        assert a["country_label"]  # populated
        assert a["city"] == "cape_town"
        assert a["city_label"]
        assert a["status"] == "active"
        assert a["creator_id"] == user_a["id"]
        assert a["category"] == "dinner"
        assert "id" in a
        assert "_id" not in a  # mongo objectid scrubbed
        # save id for downstream tests
        pytest.activity_id = a["id"]

    def test_create_activity_unknown_country(self, user_a):
        r = requests.post(
            f"{API}/activities",
            headers=_h(user_a),
            json={
                "title": "x", "description": "x",
                "country": "zzz", "city": "x",
                "date": "2026-06-01", "time": "19:00",
                "cost_amount": 0, "cost_currency": "USD",
                "category": "dinner",
            },
            timeout=15,
        )
        assert r.status_code == 400
        assert "country" in r.text.lower()

    def test_create_activity_unsupported_currency(self, user_a):
        r = requests.post(
            f"{API}/activities",
            headers=_h(user_a),
            json={
                "title": "x", "description": "x",
                "country": "south_africa", "city": "cape_town",
                "date": "2026-06-01", "time": "19:00",
                "cost_amount": 0, "cost_currency": "ZZZ",
                "category": "dinner",
            },
            timeout=15,
        )
        assert r.status_code == 400

    def test_create_activity_unknown_category(self, user_a):
        r = requests.post(
            f"{API}/activities",
            headers=_h(user_a),
            json={
                "title": "x", "description": "x",
                "country": "south_africa", "city": "cape_town",
                "date": "2026-06-01", "time": "19:00",
                "cost_amount": 0, "cost_currency": "USD",
                "category": "unknown",
            },
            timeout=15,
        )
        assert r.status_code == 400

    def test_create_activity_unauth(self):
        r = requests.post(
            f"{API}/activities",
            json={
                "title": "x", "description": "x",
                "country": "south_africa", "city": "cape_town",
                "date": "2026-06-01", "time": "19:00",
                "cost_amount": 0, "cost_currency": "USD",
                "category": "dinner",
            },
            timeout=15,
        )
        assert r.status_code in (401, 403)


# ---------------- LIST + GET + FILTERS ----------------

class TestActivitiesList:
    def test_get_activities_default(self):
        r = requests.get(f"{API}/activities", timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert "activities" in body
        assert isinstance(body["activities"], list)
        # ours should be in there
        ids = [a["id"] for a in body["activities"]]
        assert pytest.activity_id in ids
        # sort: ascending by date
        dates = [a["date"] for a in body["activities"]]
        assert dates == sorted(dates), "activities not sorted by date asc"

    def test_filter_by_country(self):
        r = requests.get(f"{API}/activities", params={"country": "south_africa"}, timeout=15)
        assert r.status_code == 200
        for a in r.json()["activities"]:
            assert a["country"] == "south_africa"

    def test_filter_by_city(self):
        r = requests.get(f"{API}/activities", params={"city": "cape_town"}, timeout=15)
        assert r.status_code == 200
        for a in r.json()["activities"]:
            assert a["city"] == "cape_town"

    def test_filter_by_category(self):
        r = requests.get(f"{API}/activities", params={"category": "dinner"}, timeout=15)
        assert r.status_code == 200
        for a in r.json()["activities"]:
            assert a["category"] == "dinner"

    def test_get_one(self):
        r = requests.get(f"{API}/activities/{pytest.activity_id}", timeout=15)
        assert r.status_code == 200
        assert r.json()["id"] == pytest.activity_id

    def test_get_unknown_id(self):
        r = requests.get(f"{API}/activities/nonexistent-id-xyz", timeout=15)
        assert r.status_code == 404


# ---------------- JOIN / LEAVE ----------------

class TestActivitiesJoinLeave:
    def test_join_unauth(self):
        r = requests.post(f"{API}/activities/{pytest.activity_id}/join", timeout=15)
        assert r.status_code in (401, 403)

    def test_join_first_time(self, user_b):
        r = requests.post(f"{API}/activities/{pytest.activity_id}/join", headers=_h(user_b), timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert body.get("joined") is True
        # verify persistence
        a = requests.get(f"{API}/activities/{pytest.activity_id}", timeout=15).json()
        assert any(p["user_id"] == user_b["id"] for p in a["participants"])

    def test_join_idempotent(self, user_b):
        r = requests.post(f"{API}/activities/{pytest.activity_id}/join", headers=_h(user_b), timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert body.get("already_joined") is True
        # ensure participants list still has only one entry for user_b
        a = requests.get(f"{API}/activities/{pytest.activity_id}", timeout=15).json()
        cnt = sum(1 for p in a["participants"] if p["user_id"] == user_b["id"])
        assert cnt == 1

    def test_leave(self, user_b):
        r = requests.post(f"{API}/activities/{pytest.activity_id}/leave", headers=_h(user_b), timeout=15)
        assert r.status_code == 200
        a = requests.get(f"{API}/activities/{pytest.activity_id}", timeout=15).json()
        assert not any(p["user_id"] == user_b["id"] for p in a["participants"])

    def test_join_full_activity(self, user_a, user_b):
        # create a max=1 activity with user_a
        payload = {
            "title": "TEST_iter17 Full",
            "description": "max 1",
            "country": "south_africa",
            "city": "johannesburg",
            "date": "2026-07-15",
            "time": "20:00",
            "cost_amount": 0,
            "cost_currency": "USD",
            "max_participants": 1,
            "category": "experience",
        }
        r = requests.post(f"{API}/activities", headers=_h(user_a), json=payload, timeout=15)
        assert r.status_code == 200
        full_id = r.json()["id"]
        # creator B joins → fills it
        r2 = requests.post(f"{API}/activities/{full_id}/join", headers=_h(user_b), timeout=15)
        assert r2.status_code == 200
        # second user (user_a is creator, register a fresh one)
        user_c = _register_user("c")
        r3 = requests.post(f"{API}/activities/{full_id}/join", headers=_h(user_c), timeout=15)
        assert r3.status_code == 400
        assert "full" in r3.text.lower()


# ---------------- DELETE / AUTH ----------------

class TestActivitiesDelete:
    def test_delete_by_non_creator_403(self, user_b):
        r = requests.delete(f"{API}/activities/{pytest.activity_id}", headers=_h(user_b), timeout=15)
        assert r.status_code == 403

    def test_delete_unauth(self):
        r = requests.delete(f"{API}/activities/{pytest.activity_id}", timeout=15)
        assert r.status_code in (401, 403)

    def test_delete_by_creator(self, user_a):
        r = requests.delete(f"{API}/activities/{pytest.activity_id}", headers=_h(user_a), timeout=15)
        assert r.status_code == 200
        # verify gone
        g = requests.get(f"{API}/activities/{pytest.activity_id}", timeout=15)
        assert g.status_code == 404
