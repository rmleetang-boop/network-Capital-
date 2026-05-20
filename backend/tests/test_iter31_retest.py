"""
Iter31 retest — Focus:
  1) CRITICAL: POST /api/admin/announce produces a Post-shape doc
     so GET /api/posts no longer 500s.
  2) MINOR:    POST /api/admin/users/<bad-id>/restrict -> 404
                POST /api/admin/users/<bad-id>/flag     -> 404
                Valid user still returns 200 with same shape.
  3) Quick regression smokes on related endpoints.
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_PASSWORD = "NetworkCapital2025!"


# --------------- helpers ----------------
def _new_user(prefix="iter31"):
    email = f"TEST_{prefix}_{int(time.time()*1000)}_{uuid.uuid4().hex[:6]}@example.com"
    r = requests.post(
        f"{API}/auth/progressive-signup",
        json={"email": email, "password": "Test123!", "step": 1},
        timeout=20,
    )
    assert r.status_code == 200, f"signup failed: {r.status_code} {r.text}"
    token = r.json()["token"]
    h = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    o = requests.post(f"{API}/auth/send-otp", headers=h, json={"email": email}, timeout=20).json()
    code = o.get("_mock_code") or o.get("code")
    assert code, f"no mock code: {o}"
    requests.post(f"{API}/auth/verify-otp", headers=h, json={"email": email, "code": code}, timeout=20)
    uname = f"u{int(time.time()*1000)}{uuid.uuid4().hex[:4]}"
    requests.post(
        f"{API}/auth/complete-profile",
        headers=h,
        json={
            "full_name": f"Iter31 {prefix}",
            "username": uname,
            "bio": "qa",
            "intent": "member",
            "terms_accepted": True,
            "birth_month": 6,
        },
        timeout=20,
    )
    me = requests.get(f"{API}/users/me", headers=h, timeout=20).json()
    return {"token": token, "headers": h, "id": me["id"], "email": email, "username": me.get("username")}


def _new_admin(prefix="iter31_admin"):
    u = _new_user(prefix)
    r = requests.post(
        f"{API}/admin/bootstrap",
        headers={**u["headers"], "X-Admin-Password": ADMIN_PASSWORD},
        timeout=20,
    )
    assert r.status_code == 200, f"admin bootstrap failed: {r.status_code} {r.text}"
    u["role"] = "admin"
    return u


@pytest.fixture(scope="session")
def admin():
    return _new_admin("admin")


@pytest.fixture(scope="session")
def member():
    return _new_user("member")


# ============== PRE-CHECK: GET /api/posts must work BEFORE creating new announce =========
class TestPostsFeedBaseline:
    """If iter30 broken docs were not purged, /api/posts will already 500."""

    def test_posts_feed_returns_200_before_announce(self, admin):
        r = requests.get(f"{API}/posts", headers=admin["headers"], timeout=20)
        assert r.status_code == 200, (
            f"BACKEND BUG: GET /api/posts already 500ing BEFORE this run, "
            f"meaning iter30 broken announce docs still in db: {r.status_code} {r.text[:300]}"
        )
        body = r.json()
        assert isinstance(body, list)


# ============== 1) CRITICAL: ANNOUNCE SHAPE FIX ==========================
class TestAnnounceShapeFix:
    """The critical iter30 bug — announce doc must now be Post-shape so GET /api/posts works."""

    def test_announce_creates_post_with_correct_shape(self, admin):
        content = f"TEST_iter31 announce {uuid.uuid4().hex[:8]}"
        r = requests.post(
            f"{API}/admin/announce",
            headers=admin["headers"],
            json={"content": content, "pin": True},
            timeout=20,
        )
        assert r.status_code == 200, f"announce failed: {r.status_code} {r.text}"
        post = r.json()
        # Required Post fields present and correct types
        assert isinstance(post.get("likes"), list), f"likes must be list, got {type(post.get('likes')).__name__}: {post.get('likes')!r}"
        assert post["likes"] == []
        assert isinstance(post.get("user_score"), int), f"user_score must be int present, got {post.get('user_score')!r}"
        assert isinstance(post.get("comments"), list)
        assert isinstance(post.get("hashtags"), list)
        assert isinstance(post.get("mentions"), list)
        assert post["content"] == content
        assert post["username"] == "networkcapital"
        # iter28 metadata still tolerated on the response (insert side keeps them)
        assert post.get("official") is True
        assert post.get("is_announcement") is True

    def test_get_posts_returns_200_after_announce(self, admin):
        # Create a fresh announce, then verify feed still works
        content = f"TEST_iter31 feedcheck {uuid.uuid4().hex[:8]}"
        a = requests.post(
            f"{API}/admin/announce",
            headers=admin["headers"],
            json={"content": content},
            timeout=20,
        )
        assert a.status_code == 200, a.text
        announce_id = a.json()["id"]

        f = requests.get(f"{API}/posts", headers=admin["headers"], timeout=20)
        assert f.status_code == 200, (
            f"CRITICAL: GET /api/posts is still 500ing after announce. "
            f"shape fix incomplete. body={f.text[:500]}"
        )
        feed = f.json()
        assert isinstance(feed, list)
        ids = [p.get("id") for p in feed]
        assert announce_id in ids, f"announce post {announce_id} not in feed (got {len(ids)} posts)"
        # Spot-check the announce post in feed has correct list types
        announce_in_feed = next(p for p in feed if p.get("id") == announce_id)
        assert isinstance(announce_in_feed.get("likes"), list)
        assert isinstance(announce_in_feed.get("user_score"), int)

    def test_get_posts_unauth_also_works(self):
        """No-auth feed read should also not 500."""
        r = requests.get(f"{API}/posts", timeout=20)
        # Some envs require auth — accept 401 OR 200, but NEVER 500.
        assert r.status_code != 500, f"GET /api/posts unauth 500: {r.text[:300]}"
        assert r.status_code in (200, 401, 403), f"unexpected status: {r.status_code}"


# ============== 2) MINOR: RESTRICT 404 ON BAD USER ID =====================
class TestRestrict404:
    def test_restrict_bad_user_id_returns_404(self, admin):
        bad_id = f"nonexistent-{uuid.uuid4().hex}"
        r = requests.post(
            f"{API}/admin/users/{bad_id}/restrict",
            headers=admin["headers"],
            json={"can_post": False, "reason": "test"},
            timeout=20,
        )
        assert r.status_code == 404, f"expected 404, got {r.status_code}: {r.text}"

    def test_restrict_valid_user_still_works(self, admin):
        target = _new_user("restrict_target")
        r = requests.post(
            f"{API}/admin/users/{target['id']}/restrict",
            headers=admin["headers"],
            json={"can_post": False, "reason": "spam"},
            timeout=20,
        )
        assert r.status_code == 200, f"restrict valid failed: {r.status_code} {r.text}"
        body = r.json()
        assert body.get("ok") is True
        assert "restrictions" in body

    def test_restrict_empty_body_still_400(self, admin, member):
        r = requests.post(
            f"{API}/admin/users/{member['id']}/restrict",
            headers=admin["headers"],
            json={},
            timeout=20,
        )
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text}"


# ============== 3) MINOR: FLAG 404 ON BAD USER ID =========================
class TestFlag404:
    def test_flag_bad_user_id_returns_404(self, admin):
        bad_id = f"nonexistent-{uuid.uuid4().hex}"
        r = requests.post(
            f"{API}/admin/users/{bad_id}/flag",
            headers=admin["headers"],
            json={"flagged": True, "reason": "review"},
            timeout=20,
        )
        assert r.status_code == 404, f"expected 404, got {r.status_code}: {r.text}"

    def test_flag_valid_user_still_works(self, admin):
        target = _new_user("flag_target")
        r = requests.post(
            f"{API}/admin/users/{target['id']}/flag",
            headers=admin["headers"],
            json={"flagged": True, "reason": "review"},
            timeout=20,
        )
        assert r.status_code == 200, f"flag valid failed: {r.status_code} {r.text}"
        body = r.json()
        assert body.get("ok") is True
        assert body.get("flagged") is True

        # Unflag
        r2 = requests.post(
            f"{API}/admin/users/{target['id']}/flag",
            headers=admin["headers"],
            json={"flagged": False},
            timeout=20,
        )
        assert r2.status_code == 200
        assert r2.json().get("flagged") is False


# ============== 4) QUICK REGRESSION SMOKES ================================
class TestRegressionSmokes:
    def test_feature_flags_public_get(self):
        r = requests.get(f"{API}/feature-flags", timeout=20)
        assert r.status_code == 200
        body = r.json()
        # Should be a dict of flags
        assert isinstance(body, dict)

    def test_ambassadors_leaderboard_public(self):
        r = requests.get(f"{API}/ambassadors/leaderboard", timeout=20)
        assert r.status_code == 200
        body = r.json()
        assert isinstance(body, (list, dict))

    def test_admin_full_profile_404_on_bad_id(self, admin):
        r = requests.get(
            f"{API}/admin/users/nonexistent-xyz/full-profile",
            headers=admin["headers"], timeout=20,
        )
        assert r.status_code == 404
