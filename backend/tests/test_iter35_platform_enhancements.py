"""ITER 35 — Platform-enhancements backend test suite.

Uses pymongo + direct JWT minting (bypasses Brevo-delivered OTP flow, which
no longer returns _mock_code when Brevo accepts the message).

Coverage:
- Super-admin bootstrap idempotency
- Credit-grants gated to super_admin
- June 2026 payout block (status / create / approve / mark-paid)
- /admin/users/by-score (bracket + min/max) + /admin/users/{id}/score-breakdown
- PATCH /admin/users/{id}/role fires notification + audit
- award_points: no hard cap; top_contributor_at on first 10k cross
- /api/posts user_score reflects LIVE network_score (not stale snapshot)
"""

import os
import time
import uuid
import datetime as dt
import pytest
import requests
import jwt
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")
JWT_SECRET = os.environ.get("JWT_SECRET_KEY", "your-secret-key-change-in-production")
JWT_ALG = "HS256"

assert BASE_URL, "REACT_APP_BACKEND_URL missing"


@pytest.fixture(scope="module")
def db():
    client = MongoClient(MONGO_URL)
    yield client[DB_NAME]
    client.close()


def _mint(uid):
    exp = dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=1)
    return jwt.encode({"sub": uid, "exp": exp}, JWT_SECRET, algorithm=JWT_ALG)


def _h(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _make_user(db, role="user", **extra):
    uid = str(uuid.uuid4())
    suffix = uuid.uuid4().hex[:8]
    doc = {
        "id": uid,
        "email": f"TEST_iter35_{suffix}@test.local",
        "username": f"tu_{suffix}",
        "full_name": "Iter35 Tester",
        "password": "x",
        "role": role,
        "is_ambassador": False,
        "email_verified": True,
        "photo": "",
        "network_score": 0,
        "monthly_score": 0,
        "rank": "Newbie",
        "wallet_balance": 0,
        "promotion_zar_balance": 0,
        "terms_accepted": True,
        "intent": "member",
        "birth_month": 6,
        "created_at": dt.datetime.now(dt.timezone.utc).isoformat(),
    }
    doc.update(extra)
    db.users.insert_one(doc)
    return uid, _mint(uid), doc


@pytest.fixture(scope="module")
def admin_ctx(db):
    uid, token, _ = _make_user(db, role="admin")
    yield {"id": uid, "token": token}
    db.users.delete_one({"id": uid})


@pytest.fixture(scope="module")
def super_ctx(db):
    uid, token, _ = _make_user(db, role="super_admin")
    yield {"id": uid, "token": token}
    db.users.delete_one({"id": uid})


@pytest.fixture(scope="module")
def member_ctx(db):
    uid, token, _ = _make_user(db, role="user", network_score=2500, monthly_score=2500)
    yield {"id": uid, "token": token}
    db.users.delete_one({"id": uid})


# ============================================================================
# 1) Super-admin bootstrap (idempotent)
# ============================================================================
class TestBootstrapSuperAdmin:
    def test_bootstrap_state(self, db):
        target = "rmleetang@gmail.com"
        existing = db.users.find_one({"email": target}, {"_id": 0, "role": 1})
        if not existing:
            pytest.skip("rmleetang@gmail.com not present in dev DB; bootstrap is a no-op.")
        assert existing.get("role") == "super_admin", (
            f"Bootstrap did not promote target email; current role={existing.get('role')}"
        )


# ============================================================================
# 2) Credit-grants — super_admin only
# ============================================================================
class TestCreditGrantRoleGating:
    def test_admin_role_blocked(self, admin_ctx, member_ctx):
        r = requests.post(
            f"{BASE_URL}/api/admin/credit-grants",
            headers=_h(admin_ctx["token"]),
            json={"user_id": member_ctx["id"], "amount": 10, "source": "wallet", "reason": "test"},
            timeout=20,
        )
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text}"

    def test_member_blocked(self, member_ctx):
        r = requests.post(
            f"{BASE_URL}/api/admin/credit-grants",
            headers=_h(member_ctx["token"]),
            json={"user_id": member_ctx["id"], "amount": 10, "source": "wallet", "reason": "test"},
            timeout=20,
        )
        assert r.status_code == 403

    def test_super_admin_allowed(self, super_ctx, member_ctx):
        r = requests.post(
            f"{BASE_URL}/api/admin/credit-grants",
            headers=_h(super_ctx["token"]),
            json={"user_id": member_ctx["id"], "amount": 5.0, "source": "wallet", "reason": "iter35"},
            timeout=20,
        )
        # Must not be 403 (the role gate cleared).
        assert r.status_code != 403, f"super_admin still blocked: {r.text}"


# ============================================================================
# 3) June 2026 payout block
# ============================================================================
class TestJunePayoutBlock:
    def test_status_locked(self):
        r = requests.get(f"{BASE_URL}/api/payouts/status", timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["locked"] is True
        assert "2026-06-30" in body["release_at"]
        assert "30 June" in body["message"] or "June" in body["message"]

    def test_create_withdrawal_blocked(self, db):
        uid, token, _ = _make_user(db, role="user", network_score=5000, monthly_score=5000, wallet_balance=500)
        try:
            tiny_pdf = "data:application/pdf;base64," + ("A" * 100)
            r = requests.post(
                f"{BASE_URL}/api/withdrawals",
                headers=_h(token),
                json={
                    "amount_zar": 100,
                    "source": "wallet",
                    "full_name": "QA Tester",
                    "bank_name": "FNB",
                    "branch_code": "250655",
                    "account_number": "1234567890",
                    "account_type": "cheque",
            "address": "1 QA Street, Cape Town",
                    "proof_data_url": tiny_pdf,
                },
                timeout=20,
            )
            assert r.status_code == 403, f"expected 403 (June lock), got {r.status_code}: {r.text}"
            assert "June" in r.text or "30 June" in r.text
        finally:
            db.users.delete_one({"id": uid})

    def test_admin_approve_blocked(self, admin_ctx):
        r = requests.post(
            f"{BASE_URL}/api/admin/withdrawals/nonexistent-id/approve",
            headers=_h(admin_ctx["token"]),
            json={"note": "test"},
            timeout=15,
        )
        assert r.status_code == 403
        assert "June" in r.text or "30 June" in r.text

    def test_admin_mark_paid_blocked(self, admin_ctx):
        r = requests.post(
            f"{BASE_URL}/api/admin/withdrawals/nonexistent-id/mark-paid",
            headers=_h(admin_ctx["token"]),
            json={"note": "test"},
            timeout=15,
        )
        assert r.status_code == 403
        assert "June" in r.text or "30 June" in r.text


# ============================================================================
# 4) Score-bracket endpoint
# ============================================================================
class TestScoreBracketEndpoint:
    def test_bracket_param(self, admin_ctx, db):
        # Use a narrow bracket so seeded users definitely land in the top of the sort
        # (descending score), avoiding limit=200 truncation when many low-score users exist.
        ids = []
        for score in (995, 998):
            uid, _, _ = _make_user(db, network_score=score, monthly_score=score)
            ids.append(uid)
        try:
            r = requests.get(
                f"{BASE_URL}/api/admin/users/by-score?bracket=900-1000&limit=1000",
                headers=_h(admin_ctx["token"]),
                timeout=20,
            )
            assert r.status_code == 200, r.text
            body = r.json()
            assert body["bracket"] == [900, 1000]
            for u in body["users"]:
                assert 900 <= int(u.get("network_score") or 0) < 1000
            returned_ids = {u["id"] for u in body["users"]}
            for sid in ids:
                assert sid in returned_ids, f"seeded user {sid} missing from result"
        finally:
            for sid in ids:
                db.users.delete_one({"id": sid})

    def test_min_max_params(self, admin_ctx, db):
        uid, _, _ = _make_user(db, network_score=3000, monthly_score=3000)
        try:
            r = requests.get(
                f"{BASE_URL}/api/admin/users/by-score?min_score=2000&max_score=5000",
                headers=_h(admin_ctx["token"]),
                timeout=20,
            )
            assert r.status_code == 200, r.text
            body = r.json()
            assert body["bracket"] == [2000, 5000]
            for u in body["users"]:
                s = int(u.get("network_score") or 0)
                assert 2000 <= s < 5000
            assert uid in {u["id"] for u in body["users"]}
        finally:
            db.users.delete_one({"id": uid})

    def test_requires_admin(self, member_ctx):
        r = requests.get(
            f"{BASE_URL}/api/admin/users/by-score?bracket=0-1000",
            headers=_h(member_ctx["token"]),
            timeout=15,
        )
        assert r.status_code == 403

    def test_invalid_bracket(self, admin_ctx):
        r = requests.get(
            f"{BASE_URL}/api/admin/users/by-score?bracket=garbage",
            headers=_h(admin_ctx["token"]),
            timeout=10,
        )
        assert r.status_code == 400


# ============================================================================
# 5) Score-breakdown endpoint
# ============================================================================
class TestScoreBreakdown:
    def test_breakdown_shape(self, admin_ctx, db):
        uid, _, _ = _make_user(db, network_score=300, monthly_score=300)
        now_iso = dt.datetime.now(dt.timezone.utc).isoformat()
        db.score_events.insert_many([
            {"id": str(uuid.uuid4()), "user_id": uid, "action": "post_create",
             "points": 100, "base_points": 100, "multiplier": 1,
             "created_at": now_iso, "source_id": "s1"},
            {"id": str(uuid.uuid4()), "user_id": uid, "action": "post_create",
             "points": 100, "base_points": 100, "multiplier": 1,
             "created_at": now_iso, "source_id": "s2"},
            {"id": str(uuid.uuid4()), "user_id": uid, "action": "post_like",
             "points": 5, "base_points": 5, "multiplier": 1,
             "created_at": now_iso, "source_id": "s3"},
        ])
        try:
            r = requests.get(
                f"{BASE_URL}/api/admin/users/{uid}/score-breakdown?days=30",
                headers=_h(admin_ctx["token"]),
                timeout=20,
            )
            assert r.status_code == 200, r.text
            body = r.json()
            assert body["user"]["id"] == uid
            assert body["window_days"] == 30
            assert body["totals"]["events"] == 3
            assert body["totals"]["points"] == 205
            actions = {row["action"]: row for row in body["by_action"]}
            assert "post_create" in actions and actions["post_create"]["points"] == 200
            assert "post_like" in actions and actions["post_like"]["count"] == 1
            assert len(body["events"]) == 3
        finally:
            db.score_events.delete_many({"user_id": uid})
            db.users.delete_one({"id": uid})

    def test_requires_admin(self, member_ctx):
        r = requests.get(
            f"{BASE_URL}/api/admin/users/{member_ctx['id']}/score-breakdown?days=30",
            headers=_h(member_ctx["token"]),
            timeout=15,
        )
        assert r.status_code == 403


# ============================================================================
# 6) Role-change email + audit + notification
# ============================================================================
class TestRoleChangeEmailAndAudit:
    def test_creates_notification_and_audit(self, admin_ctx, db):
        # Fresh target so we can verify exactly one role_change notification
        uid, _, _ = _make_user(db, role="user")
        try:
            r = requests.patch(
                f"{BASE_URL}/api/admin/users/{uid}/role",
                headers=_h(admin_ctx["token"]),
                json={"role": "moderator"},
                timeout=20,
            )
            assert r.status_code == 200, r.text
            # wait briefly for fire-and-forget side effects to commit
            time.sleep(0.5)
            n = db.notifications.find_one({"user_id": uid, "type": "role_change"}, {"_id": 0})
            assert n is not None, "no role_change notification doc"
            audit = db.audit_log.find_one({"action": "role.change", "target_id": uid}, {"_id": 0})
            assert audit is not None, "no audit_logs row written"
            assert audit.get("metadata", {}).get("new") in ("moderator", "ambassador", "admin", "super_admin")
            # Also test revoke: change back to 'user'
            r2 = requests.patch(
                f"{BASE_URL}/api/admin/users/{uid}/role",
                headers=_h(admin_ctx["token"]),
                json={"role": "user"},
                timeout=20,
            )
            assert r2.status_code == 200
            time.sleep(0.3)
            count_notifs = db.notifications.count_documents({"user_id": uid, "type": "role_change"})
            assert count_notifs >= 2, f"revoke did not fire notification; got {count_notifs}"
        finally:
            db.notifications.delete_many({"user_id": uid})
            db.audit_log.delete_many({"target_id": uid})
            db.users.delete_one({"id": uid})


# ============================================================================
# 7) award_points: no hard cap; top_contributor_at set on first 10k crossing
# ============================================================================
class TestNoHardCap:
    def test_score_grows_past_10k(self, db):
        # Use current month_key so _ensure_month_window doesn't reset monthly_score
        from datetime import datetime as _dt, timezone as _tz
        mk = _dt.now(_tz.utc).strftime("%Y-%m")
        uid, token, _ = _make_user(db, role="user", network_score=9990, monthly_score=9990, month_key=mk)
        try:
            r = requests.post(
                f"{BASE_URL}/api/posts",
                headers=_h(token),
                json={"content": "TEST iter35 nocap " + uuid.uuid4().hex[:6]},
                timeout=20,
            )
            assert r.status_code in (200, 201), r.text
            after = db.users.find_one(
                {"id": uid},
                {"_id": 0, "monthly_score": 1, "network_score": 1,
                 "cap_reached_at": 1, "top_contributor_at": 1},
            )
            assert after["monthly_score"] > 10000, f"expected >10000 got {after}"
            assert after["network_score"] == after["monthly_score"]
            assert after.get("cap_reached_at"), "cap_reached_at not set on first 10k cross"
            assert after.get("top_contributor_at"), "top_contributor_at not set"
        finally:
            db.posts.delete_many({"user_id": uid})
            db.score_events.delete_many({"user_id": uid})
            db.users.delete_one({"id": uid})


# ============================================================================
# 8) /api/posts user_score is LIVE (not stale)
# ============================================================================
class TestLivePostScore:
    def test_user_score_reflects_live(self, db):
        uid, token, _ = _make_user(db, role="user", network_score=100, monthly_score=100)
        post_id = None
        try:
            cr = requests.post(
                f"{BASE_URL}/api/posts",
                headers=_h(token),
                json={"content": "TEST iter35 live-score " + uuid.uuid4().hex[:6]},
                timeout=20,
            )
            assert cr.status_code in (200, 201), cr.text
            post_id = cr.json().get("id")
            # Bump network_score directly to 700
            db.users.update_one({"id": uid}, {"$set": {"network_score": 700}})
            r = requests.get(f"{BASE_URL}/api/posts?limit=200", headers=_h(token), timeout=20)
            assert r.status_code == 200, r.text
            ours = next((p for p in r.json() if p.get("id") == post_id), None)
            assert ours is not None, "post not present in feed"
            assert int(ours.get("user_score") or 0) == 700, (
                f"expected user_score=700, got {ours.get('user_score')}"
            )
        finally:
            db.posts.delete_many({"user_id": uid})
            db.score_events.delete_many({"user_id": uid})
            db.users.delete_one({"id": uid})


# ============================================================================
# 9) is_official broadcast regression
# ============================================================================
class TestIsOfficialBroadcast:
    def test_admin_post_official(self, admin_ctx, db):
        r = requests.post(
            f"{BASE_URL}/api/posts",
            headers=_h(admin_ctx["token"]),
            json={"content": "TEST iter35 official " + uuid.uuid4().hex[:6], "is_official": True},
            timeout=30,
        )
        assert r.status_code in (200, 201), r.text
        body = r.json()
        assert body.get("is_official") is True
        db.posts.delete_many({"id": body.get("id")})
