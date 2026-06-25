"""Iter 56e regression tests.

Covers:
  BE#1 — Influencer outreach template replaces join_the_movement.
  BE#2 — Admin moderation hide/unhide/delete with AuditLog + public feed filter.
  BE#3 — Permission gating (403 for non-admin).
"""
import os
import time
import uuid
import requests
import pytest

# Load REACT_APP_BACKEND_URL from frontend/.env (preview URL used in this env)
def _load_base_url() -> str:
    val = os.environ.get("REACT_APP_BACKEND_URL")
    if val:
        return val.rstrip("/")
    env_path = "/app/frontend/.env"
    if os.path.exists(env_path):
        with open(env_path) as fh:
            for line in fh:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip().rstrip("/")
    raise RuntimeError("REACT_APP_BACKEND_URL not set and /app/frontend/.env missing")


BASE_URL = _load_base_url()
API = f"{BASE_URL}/api"

SUPER_EMAIL = "rmleetang@gmail.com"
SUPER_PASS = "OwnerTest123!"


# ---------- helpers ----------
def _login(email: str, password: str) -> str:
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login {email} failed: {r.status_code} {r.text}"
    return r.json()["token"]


def _signup_regular_user() -> dict:
    """Seed a verified user directly into Mongo and mint a JWT.

    The signup OTP flow now uses real Brevo delivery (no `_mock_code`),
    so we bypass it and mint an HS256 token using JWT_SECRET_KEY.
    """
    import jwt as _jwt
    import asyncio as _asyncio
    from datetime import datetime, timedelta, timezone
    from motor.motor_asyncio import AsyncIOMotorClient

    # Load JWT secret + mongo url from backend/.env
    secret = None
    mongo_url = None
    db_name = None
    with open("/app/backend/.env") as fh:
        for line in fh:
            line = line.strip()
            if line.startswith("JWT_SECRET_KEY="):
                secret = line.split("=", 1)[1].strip().strip('"').strip("'")
            elif line.startswith("MONGO_URL="):
                mongo_url = line.split("=", 1)[1].strip().strip('"').strip("'")
            elif line.startswith("DB_NAME="):
                db_name = line.split("=", 1)[1].strip().strip('"').strip("'")
    assert secret and mongo_url and db_name

    uid = uuid.uuid4().hex
    email = f"test_iter56e_{uid[:8]}@example.com"
    uname = f"u56e_{uid[:6]}"
    now_iso = datetime.now(timezone.utc).isoformat()

    user_doc = {
        "id": uid,
        "email": email,
        "username": uname,
        "full_name": "Iter56e Tester",
        "bio": "qa",
        "photo": "",
        "intent": "member",
        "terms_accepted": True,
        "birth_month": 6,
        "email_verified": True,
        "network_score": 0,
        "rank": "Iron",
        "referral_code": uid[:8].upper(),
        "wallet_balance": 0.0,
        "created_at": now_iso,
        "password_hash": "$2b$12$dummyhashforseeded.user.0000000000000000000",
        "role": "user",
    }

    async def _insert():
        client = AsyncIOMotorClient(mongo_url)
        try:
            await client[db_name].users.insert_one(user_doc)
        finally:
            client.close()

    _asyncio.get_event_loop().run_until_complete(_insert()) if False else _asyncio.new_event_loop().run_until_complete(_insert())

    payload = {
        "user_id": uid,
        "sub": uid,
        "exp": datetime.now(timezone.utc) + timedelta(hours=2),
    }
    token = _jwt.encode(payload, secret, algorithm="HS256")
    if isinstance(token, bytes):
        token = token.decode()
    return {"token": token, "id": uid, "email": email}


@pytest.fixture(scope="module")
def super_token():
    return _login(SUPER_EMAIL, SUPER_PASS)


@pytest.fixture(scope="module")
def regular_user():
    return _signup_regular_user()


# ───────────────────────── BE#1 outreach templates ─────────────────────────
class TestOutreachTemplates:
    def test_templates_list_has_influencer_no_join_movement(self, super_token):
        r = requests.get(
            f"{API}/admin/outreach/templates",
            headers={"Authorization": f"Bearer {super_token}"},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        ids = [t["id"] for t in data["templates"]] if isinstance(data, dict) else [t["id"] for t in data]
        assert "influencer_collab" in ids, ids
        assert "join_the_movement" not in ids, ids
        # Sanity: still has the other two
        assert "future_through_network" in ids
        assert "income_streams" in ids

    def test_influencer_preview_contains_required_phrases(self, super_token):
        r = requests.post(
            f"{API}/admin/outreach/preview",
            headers={"Authorization": f"Bearer {super_token}"},
            json={"template": "influencer_collab", "name": "Sarah"},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        html = r.json().get("html", "")
        required = [
            "Claim your founding-creator spot",
            "Your Network Score",
            "opportunities, partnerships and rewards reserved only for high-score members",
            "first wave of web-based members",
            "founding-creator status",
            "Network Score",
            "+27 74 574 7401",
            "creative@networkcapitalapp.co.za",
            "Never contact me again",
            "Sarah",
        ]
        missing = [p for p in required if p not in html]
        assert not missing, f"Missing phrases: {missing}"

        # NO unsubscribe word, NO tracking pixels (1x1 gif/png img)
        assert "unsubscribe" not in html.lower(), "unsubscribe word should be removed"
        assert "width=\"1\"" not in html.lower().replace("'", "\""), "tracking pixel detected"


# ───────────────────────── BE#2 admin moderation hide/unhide/delete ─────────────────────────
class TestAdminModeration:
    @pytest.fixture
    def created_post(self, regular_user):
        r = requests.post(
            f"{API}/posts",
            headers={"Authorization": f"Bearer {regular_user['token']}"},
            json={"content": f"iter56e moderation test {uuid.uuid4().hex[:6]}"},
            timeout=30,
        )
        assert r.status_code in (200, 201), r.text
        return r.json()

    def test_hide_post_sets_flags_and_excludes_from_public_feed(self, super_token, created_post):
        pid = created_post["id"]
        # Hide
        r = requests.post(
            f"{API}/admin/posts/{pid}/hide?reason=spam",
            headers={"Authorization": f"Bearer {super_token}"},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True
        assert body.get("hidden") is True

        # Public feed should NOT include the hidden post
        time.sleep(0.5)
        feed = requests.get(f"{API}/posts?limit=100", timeout=30)
        assert feed.status_code == 200
        ids = [p["id"] for p in feed.json()]
        assert pid not in ids, f"hidden post {pid} should not appear in public feed"

        # Audit log written
        audit = requests.get(
            f"{API}/admin/audit-logs?action=post.hide&limit=20",
            headers={"Authorization": f"Bearer {super_token}"},
            timeout=30,
        )
        if audit.status_code == 200:
            items = audit.json() if isinstance(audit.json(), list) else audit.json().get("items", [])
            target_hits = [it for it in items if it.get("target_id") == pid and it.get("action") == "post.hide"]
            assert target_hits, f"expected post.hide audit log for {pid}"

    def test_unhide_post_restores_visibility(self, super_token, created_post):
        pid = created_post["id"]
        # ensure hidden first
        requests.post(
            f"{API}/admin/posts/{pid}/hide",
            headers={"Authorization": f"Bearer {super_token}"},
            timeout=30,
        )
        r = requests.post(
            f"{API}/admin/posts/{pid}/unhide",
            headers={"Authorization": f"Bearer {super_token}"},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True
        assert body.get("hidden") is False

        # Public feed should include it again
        time.sleep(0.5)
        feed = requests.get(f"{API}/posts?limit=100", timeout=30)
        ids = [p["id"] for p in feed.json()]
        assert pid in ids, f"post {pid} should be visible after unhide"

    def test_hide_unknown_post_404(self, super_token):
        r = requests.post(
            f"{API}/admin/posts/__nope_{uuid.uuid4().hex[:6]}/hide",
            headers={"Authorization": f"Bearer {super_token}"},
            timeout=30,
        )
        assert r.status_code == 404, r.text

    def test_unhide_unknown_post_404(self, super_token):
        r = requests.post(
            f"{API}/admin/posts/__nope_{uuid.uuid4().hex[:6]}/unhide",
            headers={"Authorization": f"Bearer {super_token}"},
            timeout=30,
        )
        assert r.status_code == 404, r.text

    def test_delete_post_still_works_and_404_for_unknown(self, super_token, regular_user):
        # Create a fresh post then delete it via admin
        rp = requests.post(
            f"{API}/posts",
            headers={"Authorization": f"Bearer {regular_user['token']}"},
            json={"content": "iter56e admin delete test"},
            timeout=30,
        )
        assert rp.status_code in (200, 201)
        pid = rp.json()["id"]

        r = requests.delete(
            f"{API}/admin/posts/{pid}?reason=cleanup",
            headers={"Authorization": f"Bearer {super_token}"},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

        # 404 on unknown
        r404 = requests.delete(
            f"{API}/admin/posts/__nope_{uuid.uuid4().hex[:6]}",
            headers={"Authorization": f"Bearer {super_token}"},
            timeout=30,
        )
        assert r404.status_code == 404


# ───────────────────────── BE#3 permission gating ─────────────────────────
class TestModerationPermissionGating:
    @pytest.fixture
    def fresh_post(self, regular_user):
        r = requests.post(
            f"{API}/posts",
            headers={"Authorization": f"Bearer {regular_user['token']}"},
            json={"content": "iter56e gating test"},
            timeout=30,
        )
        assert r.status_code in (200, 201), r.text
        return r.json()["id"]

    def test_hide_forbidden_for_regular_user(self, regular_user, fresh_post):
        r = requests.post(
            f"{API}/admin/posts/{fresh_post}/hide",
            headers={"Authorization": f"Bearer {regular_user['token']}"},
            timeout=30,
        )
        assert r.status_code == 403, f"expected 403 for non-admin, got {r.status_code}: {r.text}"

    def test_unhide_forbidden_for_regular_user(self, regular_user, fresh_post):
        r = requests.post(
            f"{API}/admin/posts/{fresh_post}/unhide",
            headers={"Authorization": f"Bearer {regular_user['token']}"},
            timeout=30,
        )
        assert r.status_code == 403, f"expected 403, got {r.status_code}"

    def test_admin_delete_forbidden_for_regular_user(self, regular_user, fresh_post):
        r = requests.delete(
            f"{API}/admin/posts/{fresh_post}",
            headers={"Authorization": f"Bearer {regular_user['token']}"},
            timeout=30,
        )
        assert r.status_code == 403, f"expected 403, got {r.status_code}"

    def test_public_feed_still_excludes_hidden_for_anonymous(self, super_token, regular_user):
        # create + hide a post
        rp = requests.post(
            f"{API}/posts",
            headers={"Authorization": f"Bearer {regular_user['token']}"},
            json={"content": "iter56e anon-exclusion test"},
            timeout=30,
        )
        pid = rp.json()["id"]
        requests.post(
            f"{API}/admin/posts/{pid}/hide",
            headers={"Authorization": f"Bearer {super_token}"},
            timeout=30,
        )
        time.sleep(0.5)
        feed = requests.get(f"{API}/posts?limit=100", timeout=30)
        ids = [p["id"] for p in feed.json()]
        assert pid not in ids
