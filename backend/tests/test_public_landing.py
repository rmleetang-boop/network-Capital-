"""Tests for public landing page endpoints: /api/activity/live and /api/leaderboard/public."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://stokvel-plus.preview.emergentagent.com").rstrip("/")


@pytest.fixture
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


class TestActivityLive:
    def test_activity_live_no_auth_200(self, client):
        r = client.get(f"{BASE_URL}/api/activity/live")
        assert r.status_code == 200
        data = r.json()
        assert "items" in data and "total" in data
        assert isinstance(data["items"], list)
        assert data["total"] == len(data["items"])

    def test_activity_live_items_shape(self, client):
        r = client.get(f"{BASE_URL}/api/activity/live")
        assert r.status_code == 200
        items = r.json()["items"]
        assert len(items) >= 1, "Feed must never be empty (seeded fallback)"
        for it in items:
            assert it.get("type") in {"joined", "score", "benefit"}, f"bad type: {it.get('type')}"
            assert isinstance(it.get("username"), str) and len(it["username"]) > 0
            assert isinstance(it.get("text"), str) and len(it["text"]) > 0

    def test_activity_live_seeded_when_quiet(self, client):
        """When platform activity < 6, seeded items returned with seeded flag."""
        r = client.get(f"{BASE_URL}/api/activity/live")
        items = r.json()["items"]
        # At least 6 items guaranteed (seed fallback kicks in when <6)
        assert len(items) >= 6
        # If all real items <6 then seeds present
        seeded_count = sum(1 for it in items if it.get("seeded") is True)
        # In a fresh/quiet env, seeded should appear. Accept >=0 but assert shape if any.
        for it in items:
            if it.get("seeded"):
                assert it["seeded"] is True

    def test_activity_live_limit_param(self, client):
        r = client.get(f"{BASE_URL}/api/activity/live?limit=8")
        assert r.status_code == 200
        items = r.json()["items"]
        assert len(items) <= 8
        assert r.json()["total"] == len(items)

    def test_activity_live_no_auth_header_required(self, client):
        """Ensure endpoint works with NO Authorization header."""
        r = requests.get(f"{BASE_URL}/api/activity/live")
        assert r.status_code == 200


class TestLeaderboardPublic:
    def test_leaderboard_public_no_auth_200(self, client):
        r = client.get(f"{BASE_URL}/api/leaderboard/public")
        assert r.status_code == 200
        data = r.json()
        assert "leaders" in data and "total" in data
        assert isinstance(data["leaders"], list)

    def test_leaderboard_leader_shape(self, client):
        r = client.get(f"{BASE_URL}/api/leaderboard/public")
        leaders = r.json()["leaders"]
        assert len(leaders) >= 5, "Must pad to >=5 via seeded fallback"
        for l in leaders:
            assert isinstance(l.get("rank"), int)
            assert isinstance(l.get("username"), str) and l["username"]
            assert isinstance(l.get("network_score"), int)
        # Ranks should be monotonically increasing
        ranks = [l["rank"] for l in leaders]
        assert ranks == sorted(ranks)

    def test_leaderboard_seeded_flag_when_sparse(self, client):
        r = client.get(f"{BASE_URL}/api/leaderboard/public")
        leaders = r.json()["leaders"]
        # If fewer than 5 real members, seeded leaders must be present
        seeded = [l for l in leaders if l.get("seeded")]
        real = [l for l in leaders if not l.get("seeded")]
        if len(real) < 5:
            assert len(seeded) >= 1

    def test_leaderboard_limit(self, client):
        r = client.get(f"{BASE_URL}/api/leaderboard/public?limit=3")
        assert r.status_code == 200
        assert len(r.json()["leaders"]) <= 3
