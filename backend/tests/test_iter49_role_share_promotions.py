"""ITER 49 backend tests:
1) Role-management bug fixes (heartbeat, PUT /users/me, /admin/bootstrap, /admin/dashboard/metrics, bootstrap logs)
2) Ambassador share link
3) Public referral landing endpoint
4) Promotion share payload & /share +20pts cooldown
5) /hubs/regions returns 55 entries (54 African + 'other')
"""
import os
import re
import time
import uuid
import jwt
import pytest
import requests
from pymongo import MongoClient


# -------- env / config --------
def _load_env(path: str) -> dict:
    out = {}
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            out[k.strip()] = v.strip().strip('"').strip("'")
    return out


_BE_ENV = _load_env("/app/backend/.env")
_FE_ENV = _load_env("/app/frontend/.env")
BASE_URL = _FE_ENV["REACT_APP_BACKEND_URL"].rstrip("/")
ADMIN_PASSWORD = _BE_ENV["ADMIN_PASSWORD"]
JWT_SECRET = _BE_ENV["JWT_SECRET_KEY"]
MONGO_URL = _BE_ENV.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = _BE_ENV.get("DB_NAME", "test_database")
SUPER_ADMIN_EMAIL = "rmleetang@gmail.com"
STANDING_ADMIN_EMAIL = "rmleetang+nctest1780423349@gmail.com"
SHARE_BASE_URL = "https://networkcapitalapp.co.za"


# -------- helpers --------
@pytest.fixture(scope="module")
def db():
    client = MongoClient(MONGO_URL)
    return client[DB_NAME]


def mint_token(user_id: str) -> str:
    return jwt.encode({"sub": user_id}, JWT_SECRET, algorithm="HS256")


def auth_headers(user_id: str) -> dict:
    return {"Authorization": f"Bearer {mint_token(user_id)}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def super_admin_user(db):
    u = db.users.find_one({"email": {"$regex": f"^{re.escape(SUPER_ADMIN_EMAIL)}$", "$options": "i"}})
    if not u:
        pytest.skip(f"Super admin user {SUPER_ADMIN_EMAIL} not seeded")
    return u


@pytest.fixture(scope="module")
def standing_admin_user(db):
    u = db.users.find_one({"email": STANDING_ADMIN_EMAIL})
    if not u:
        pytest.skip(f"Standing admin {STANDING_ADMIN_EMAIL} not seeded")
    return u


@pytest.fixture
def fresh_user(db):
    """Create a fresh 'user' role user for role-bug tests."""
    uid = str(uuid.uuid4())
    username = f"iter49u_{int(time.time())}_{uid[:6]}"
    doc = {
        "id": uid,
        "email": f"TEST_iter49_{uid[:8]}@example.com",
        "password": "x",
        "username": username,
        "full_name": "Iter49 Test User",
        "role": "user",
        "email_verified": True,
        "is_premium": False,
        "is_ambassador": False,
        "created_at": "2026-01-01T00:00:00+00:00",
        "city": "johannesburg",
        "country": "south_africa",
        "share_code": uid[:8],
        "bio": "",
        "photo": "",
        "network_score": 0,
        "rank": "Bronze",
        "referral_code": uid[:8],
        "interests": [],
        "profession": "",
    }
    db.users.insert_one(doc)
    yield doc
    db.users.delete_one({"id": uid})
    db.point_transactions.delete_many({"user_id": uid})


# ============================================================
# Bug #1: heartbeat MUST NOT modify user.role
# ============================================================
class TestHeartbeatRoleStability:
    def _check(self, user):
        uid = user["id"]
        h = auth_headers(uid)
        me = requests.get(f"{BASE_URL}/api/users/me", headers=h)
        assert me.status_code == 200, me.text
        role_before = me.json().get("role")
        for _ in range(3):
            r = requests.post(f"{BASE_URL}/api/users/me/heartbeat", headers=h)
            assert r.status_code == 200, r.text
        me2 = requests.get(f"{BASE_URL}/api/users/me", headers=h)
        role_after = me2.json().get("role")
        assert role_before == role_after, f"role changed: {role_before}->{role_after}"
        return role_before

    def test_heartbeat_preserves_super_admin(self, super_admin_user):
        assert self._check(super_admin_user) == "super_admin"

    def test_heartbeat_preserves_admin(self, standing_admin_user):
        assert self._check(standing_admin_user) == "admin"

    def test_heartbeat_preserves_user(self, fresh_user):
        assert self._check(fresh_user) == "user"


# ============================================================
# Bug #2: PUT /users/me must NOT accept 'role' field
# ============================================================
class TestUpdateProfileNoRole:
    def test_role_not_accepted_in_body(self, fresh_user, db):
        uid = fresh_user["id"]
        h = auth_headers(uid)
        r = requests.put(
            f"{BASE_URL}/api/users/me",
            headers=h,
            json={"role": "super_admin", "city": "gabon"},
        )
        # Either 200 (silently ignored) or 422 (rejected) — both are acceptable, role must NOT change
        assert r.status_code in (200, 422), r.text
        doc = db.users.find_one({"id": uid})
        assert doc.get("role") == "user", f"role escalated to {doc.get('role')}"
        # city change either succeeded (if 200) or not changed (if 422). Accept either.
        if r.status_code == 200:
            assert doc.get("city") == "gabon"


# ============================================================
# Bug #3: /admin/bootstrap promotes SUPER_ADMIN_EMAIL only
# ============================================================
class TestAdminBootstrap:
    def test_bad_password_403(self, fresh_user):
        h = auth_headers(fresh_user["id"])
        h["X-Admin-Password"] = "WRONG"
        r = requests.post(f"{BASE_URL}/api/admin/bootstrap", headers=h)
        assert r.status_code == 403

    def test_valid_password_promotes_super_admin_email_not_caller(
        self, fresh_user, super_admin_user, db
    ):
        h = auth_headers(fresh_user["id"])
        h["X-Admin-Password"] = ADMIN_PASSWORD
        r = requests.post(f"{BASE_URL}/api/admin/bootstrap", headers=h)
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ("matched_count", "modified_count", "target_email", "target_user_id",
                  "previous_role", "new_role"):
            assert k in data, f"missing {k} in response: {data}"
        assert data["target_email"] == SUPER_ADMIN_EMAIL
        assert data["target_user_id"] == super_admin_user["id"]
        assert data["new_role"] == "super_admin"
        assert data["matched_count"] == 1
        # Caller must NOT be promoted
        caller = db.users.find_one({"id": fresh_user["id"]})
        assert caller.get("role") == "user", f"caller escalated to {caller.get('role')}"
        # Owner is super_admin
        owner = db.users.find_one({"id": super_admin_user["id"]})
        assert owner.get("role") == "super_admin"


# ============================================================
# Bug #4: /admin/dashboard/metrics must NOT auto-promote caller
# ============================================================
class TestDashboardMetricsNoAutoPromote:
    def test_user_with_admin_pw_not_promoted(self, fresh_user, db):
        uid = fresh_user["id"]
        h = auth_headers(uid)
        h["X-Admin-Password"] = ADMIN_PASSWORD
        before = db.users.find_one({"id": uid}).get("role")
        r = requests.get(f"{BASE_URL}/api/admin/dashboard/metrics", headers=h)
        assert r.status_code == 200, r.text
        after = db.users.find_one({"id": uid}).get("role")
        assert before == "user" and after == "user", f"role changed: {before}->{after}"


# ============================================================
# Bug #5: bootstrap_super_admin logs explicit update_one result
# ============================================================
class TestBootstrapLog:
    def test_log_line_present(self):
        # Look at backend logs for the [BOOTSTRAP] Promote line
        out = ""
        for p in ("/var/log/supervisor/backend.err.log", "/var/log/supervisor/backend.out.log"):
            if os.path.exists(p):
                with open(p) as f:
                    out += f.read()
        pattern = re.compile(
            rf"\[BOOTSTRAP\] Promote {re.escape(SUPER_ADMIN_EMAIL)} to super_admin → matched=\d+, modified=\d+"
        )
        assert pattern.search(out), "Bootstrap log line not found in backend logs"


# ============================================================
# /hubs/regions returns 55 entries
# ============================================================
class TestHubsRegions:
    def test_55_entries_and_required_countries(self):
        r = requests.get(f"{BASE_URL}/api/hubs/regions")
        assert r.status_code == 200, r.text
        countries = r.json().get("countries", [])
        assert len(countries) == 55, f"expected 55, got {len(countries)}"
        slugs = {c["value"] for c in countries}
        for needed in ("gabon", "drc", "algeria", "cote_divoire", "eswatini",
                       "mauritius", "zambia", "madagascar", "other"):
            assert needed in slugs, f"missing country slug: {needed}"
        # Spot-check structure
        for c in countries:
            if c["value"] == "other":
                continue
            assert c.get("provinces"), f"{c['value']} missing provinces"
            assert any(p.get("cities") for p in c["provinces"]), f"{c['value']} has no cities"
        # Specific newly-added must have ≥1 province with ≥1 city
        check = [c for c in countries if c["value"] in
                 ("gabon", "drc", "algeria", "cote_divoire", "eswatini",
                  "mauritius", "zambia", "madagascar")]
        for c in check:
            assert len(c["provinces"]) >= 1
            assert len(c["provinces"][0].get("cities", [])) >= 1


# ============================================================
# Ambassador share-link
# ============================================================
class TestAmbassadorShareLink:
    def test_403_for_non_ambassador(self, fresh_user):
        h = auth_headers(fresh_user["id"])
        r = requests.get(f"{BASE_URL}/api/ambassador/share-link", headers=h)
        assert r.status_code == 403

    def test_payload_for_standing_admin_ambassador(self, standing_admin_user, db):
        # Ensure is_ambassador=true
        if not standing_admin_user.get("is_ambassador"):
            db.users.update_one({"id": standing_admin_user["id"]},
                                {"$set": {"is_ambassador": True}})
        h = auth_headers(standing_admin_user["id"])
        r = requests.get(f"{BASE_URL}/api/ambassador/share-link", headers=h)
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ("url", "username", "share_text", "share_code"):
            assert k in data
        assert data["url"] == f"{SHARE_BASE_URL}/r/{data['username']}"
        assert "Network Capital" in data["share_text"]
        assert data["url"] in data["share_text"]


# ============================================================
# /referral/{username} public landing
# ============================================================
class TestReferralLanding:
    def test_404_for_bogus(self):
        r = requests.get(f"{BASE_URL}/api/referral/nonexistent_user_xyz_abc_999")
        assert r.status_code == 404

    def test_public_no_auth_required(self, standing_admin_user):
        username = standing_admin_user.get("username")
        if not username:
            pytest.skip("standing admin missing username")
        # No auth header at all
        r = requests.get(f"{BASE_URL}/api/referral/{username}")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["username"] == username
        assert data["referrer_id"] == standing_admin_user["id"]
        assert data["url"] == f"{SHARE_BASE_URL}/r/{username}"
        assert "full_name" in data and "photo" in data
        assert "network_score" in data and "is_ambassador" in data


# ============================================================
# /promotions/{id}/share-payload + /share +20 pts cooldown
# ============================================================
@pytest.fixture
def seeded_promo(db):
    pid = str(uuid.uuid4())
    promo = {
        "id": pid,
        "name": "Iter49 Test Promo",
        "zar_per_point": 0.10,
        "min_network_score": 500,
        "schedule": {"ends_at": "2026-12-31T23:59:59Z"},
        "status": "active",
        "created_at": "2026-01-01T00:00:00+00:00",
    }
    db.promotions.insert_one(promo)
    yield promo
    db.promotions.delete_one({"id": pid})


class TestPromotionShare:
    def test_share_payload(self, seeded_promo):
        pid = seeded_promo["id"]
        r = requests.get(f"{BASE_URL}/api/promotions/{pid}/share-payload")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["promotion_id"] == pid
        assert data["url"] == f"{SHARE_BASE_URL}/promotions/{pid}"
        assert data["title"] == "Iter49 Test Promo"
        assert "share_text" in data and "blurb" in data
        assert len(data["share_text"]) < 240
        assert "Iter49 Test Promo" in data["share_text"]
        assert "Ends 31 Dec 2026" in data["share_text"]

    def test_share_payload_404(self):
        r = requests.get(f"{BASE_URL}/api/promotions/nope_xxx/share-payload")
        assert r.status_code == 404

    def test_share_awards_then_cooldown(self, seeded_promo, fresh_user, db):
        pid = seeded_promo["id"]
        h = auth_headers(fresh_user["id"])
        r1 = requests.post(f"{BASE_URL}/api/promotions/{pid}/share", headers=h)
        assert r1.status_code == 200, r1.text
        d1 = r1.json()
        assert d1.get("ok") is True
        assert d1.get("promotion_id") == pid
        assert d1.get("awarded", 0) == 20, f"expected 20pts, got {d1}"
        # Second call within 24h should award 0
        r2 = requests.post(f"{BASE_URL}/api/promotions/{pid}/share", headers=h)
        assert r2.status_code == 200, r2.text
        assert r2.json().get("awarded", 0) == 0, "cooldown failed — awarded twice"

    def test_share_404_unknown_promo(self, fresh_user):
        h = auth_headers(fresh_user["id"])
        r = requests.post(f"{BASE_URL}/api/promotions/nope_xxx/share", headers=h)
        assert r.status_code == 404
