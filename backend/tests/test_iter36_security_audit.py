"""ITER 36 — Security & permission audit.

Coverage:
- POST /wallet/deposit → 410 for ALL roles; wallet_balance unchanged
- POST /admin/credit-grants → 403 for user/ambassador/moderator/admin; 200 for super_admin
    * wallet_adjustments_audit row written with prev/new balance + actor
    * user.wallet_balance updated to new_balance_usd
- POST /admin/credit-grants/{id}/co-approve → 403 non-super_admin
- POST /ads/watch — all 8 sub-behaviours (no ad_id, missing, inactive, expired,
  outside window, inventory exhausted, valid first watch, duplicate dedup,
  same user + different event_kind succeeds)
- Role-change email fan-out on make-ambassador (grant + revoke) and
  ambassador-applications/approve → notification doc + audit_log row
- Role-check fixes — super_admin now accepted on feature-flags / announce / dm /
  make-ambassador (no longer 403'd)
- Startup hooks — ad_reward_claims.key unique index + wallet_adjustments_audit indexes
"""

import os
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
    sfx = uuid.uuid4().hex[:8]
    doc = {
        "id": uid,
        "email": f"TEST_iter36_{sfx}@test.local",
        "username": f"t36_{sfx}",
        "full_name": "Iter36 Tester",
        "password": "x",
        "role": role,
        "is_ambassador": False,
        "email_verified": True,
        "photo": "",
        "network_score": 0,
        "monthly_score": 0,
        "rank": "Newbie",
        "wallet_balance": 0.0,
        "promotion_zar_balance": 0.0,
        "terms_accepted": True,
        "intent": "member",
        "birth_month": 6,
        "created_at": dt.datetime.now(dt.timezone.utc).isoformat(),
    }
    doc.update(extra)
    db.users.insert_one(doc)
    return uid, _mint(uid), doc


@pytest.fixture(scope="module")
def ctx(db):
    users = {}
    for role in ("user", "ambassador", "moderator", "admin", "super_admin"):
        uid, tok, doc = _make_user(
            db,
            role="user" if role == "ambassador" else role,
            is_ambassador=(role == "ambassador"),
            wallet_balance=10.0,
        )
        users[role] = {"id": uid, "token": tok}
    yield users
    db.users.delete_many({"id": {"$in": [u["id"] for u in users.values()]}})
    db.wallet_adjustments_audit.delete_many({"target_user_id": {"$in": [u["id"] for u in users.values()]}})
    db.credit_grants.delete_many({"target_id": {"$in": [u["id"] for u in users.values()]}})
    db.notifications.delete_many({"user_id": {"$in": [u["id"] for u in users.values()]}})
    db.audit_log.delete_many({"actor_id": {"$in": [u["id"] for u in users.values()]}})


# ============================================================================
# 1) /wallet/deposit must be 410 for ALL roles and wallet untouched
# ============================================================================
class TestDepositRetired:
    @pytest.mark.parametrize("role", ["user", "ambassador", "moderator", "admin", "super_admin"])
    def test_deposit_returns_410(self, ctx, db, role):
        c = ctx[role]
        prev = db.users.find_one({"id": c["id"]}, {"_id": 0, "wallet_balance": 1})["wallet_balance"]
        r = requests.post(
            f"{BASE_URL}/api/wallet/deposit",
            headers=_h(c["token"]),
            json={"amount": 5.0, "method": "stripe"},
            timeout=15,
        )
        assert r.status_code == 410, f"role={role} got {r.status_code} body={r.text}"
        after = db.users.find_one({"id": c["id"]}, {"_id": 0, "wallet_balance": 1})["wallet_balance"]
        assert after == prev, f"role={role} balance changed from {prev} -> {after}"


# ============================================================================
# 2) /admin/credit-grants → super_admin only + audit row written
# ============================================================================
class TestCreditGrants:
    @pytest.mark.parametrize("role", ["user", "ambassador", "moderator", "admin"])
    def test_non_super_blocked(self, ctx, role):
        c = ctx[role]
        target = ctx["user"]
        r = requests.post(
            f"{BASE_URL}/api/admin/credit-grants",
            headers=_h(c["token"]),
            json={
                "target_type": "user",
                "target_id": target["id"],
                "amount": 5,
                "currency": "USD",
                "reason": "Test grant from non-super admin (should fail)",
            },
            timeout=15,
        )
        assert r.status_code == 403, f"role={role} should be 403 got {r.status_code}"

    def test_super_admin_succeeds_and_audits(self, ctx, db):
        super_c = ctx["super_admin"]
        target = ctx["user"]
        prev_balance = db.users.find_one({"id": target["id"]}, {"_id": 0, "wallet_balance": 1})["wallet_balance"]
        amount = 12.34
        r = requests.post(
            f"{BASE_URL}/api/admin/credit-grants",
            headers=_h(super_c["token"]),
            json={
                "target_type": "user",
                "target_id": target["id"],
                "amount": amount,
                "currency": "USD",
                "reason": "Iter36 audit test grant — credit verification flow",
            },
            timeout=15,
        )
        assert r.status_code == 200, f"super_admin grant failed: {r.status_code} {r.text}"
        body = r.json()
        assert body["status"] == "applied"
        grant_id = body["id"]
        new_balance = db.users.find_one({"id": target["id"]}, {"_id": 0, "wallet_balance": 1})["wallet_balance"]
        assert abs(new_balance - (prev_balance + amount)) < 0.01
        audit = db.wallet_adjustments_audit.find_one({"grant_id": grant_id}, {"_id": 0})
        assert audit, "wallet_adjustments_audit row missing"
        assert audit["target_user_id"] == target["id"]
        assert audit["amount_usd"] == amount
        assert audit["previous_balance_usd"] == prev_balance
        assert abs(audit["new_balance_usd"] - new_balance) < 0.01
        assert audit["actor_id"] == super_c["id"]
        assert audit["actor_role"] == "super_admin"
        assert audit.get("target_email") and audit.get("target_username")
        assert audit.get("reason")
        assert audit.get("created_at")

    @pytest.mark.parametrize("role", ["user", "ambassador", "moderator", "admin"])
    def test_co_approve_blocked_for_non_super(self, ctx, role):
        c = ctx[role]
        # We don't need a real pending grant: 403 must come BEFORE the lookup
        r = requests.post(
            f"{BASE_URL}/api/admin/credit-grants/non-existent-grant/co-approve",
            headers=_h(c["token"]),
            timeout=15,
        )
        assert r.status_code == 403, f"role={role} got {r.status_code} {r.text}"


# ============================================================================
# 3) /ads/watch — all 8 sub-behaviours
# ============================================================================
@pytest.fixture(scope="module")
def ad_factory(db):
    created = []

    def _make(**fields):
        aid = str(uuid.uuid4())
        now = dt.datetime.now(dt.timezone.utc)
        doc = {
            "id": aid,
            "title": "TEST_iter36 ad",
            "is_active": True,
            "status": "active",
            "starts_at": (now - dt.timedelta(days=1)).isoformat(),
            "ends_at": (now + dt.timedelta(days=7)).isoformat(),
            "rewards_used": 0,
            "engagements": 0,
            "shares": 0,
            "created_at": now.isoformat(),
        }
        doc.update(fields)
        db.ads.insert_one(doc)
        created.append(aid)
        return doc

    yield _make
    db.ads.delete_many({"id": {"$in": created}})
    db.ad_reward_claims.delete_many({"ad_id": {"$in": created}})


class TestAdsWatch:
    def test_no_ad_id(self, ctx):
        r = requests.post(f"{BASE_URL}/api/ads/watch", headers=_h(ctx["user"]["token"]),
                          json={"with_engagement": True}, timeout=15)
        assert r.status_code == 200
        b = r.json()
        assert b["awarded"] is False and b["points"] == 0
        assert "No active rewarded" in b["reason"]

    def test_non_existent_ad(self, ctx):
        r = requests.post(f"{BASE_URL}/api/ads/watch", headers=_h(ctx["user"]["token"]),
                          json={"ad_id": "does-not-exist", "with_engagement": True}, timeout=15)
        assert r.status_code == 200
        b = r.json()
        assert b["awarded"] is False and b["points"] == 0

    def test_paused_ad(self, ctx, ad_factory):
        ad = ad_factory(status="paused")
        r = requests.post(f"{BASE_URL}/api/ads/watch", headers=_h(ctx["user"]["token"]),
                          json={"ad_id": ad["id"], "with_engagement": True}, timeout=15)
        b = r.json()
        assert b["awarded"] is False and "not currently rewarding" in b["reason"]

    def test_inactive_ad(self, ctx, ad_factory):
        ad = ad_factory(is_active=False)
        r = requests.post(f"{BASE_URL}/api/ads/watch", headers=_h(ctx["user"]["token"]),
                          json={"ad_id": ad["id"], "with_engagement": True}, timeout=15)
        assert r.json()["awarded"] is False

    def test_inventory_exhausted(self, ctx, ad_factory):
        ad = ad_factory(max_rewards=2, rewards_used=2)
        r = requests.post(f"{BASE_URL}/api/ads/watch", headers=_h(ctx["user"]["token"]),
                          json={"ad_id": ad["id"], "with_engagement": True}, timeout=15)
        b = r.json()
        assert b["awarded"] is False and "inventory exhausted" in b["reason"]

    def test_outside_window(self, ctx, ad_factory):
        past = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=10)
        ad = ad_factory(starts_at=(past - dt.timedelta(days=10)).isoformat(),
                        ends_at=(past).isoformat())
        r = requests.post(f"{BASE_URL}/api/ads/watch", headers=_h(ctx["user"]["token"]),
                          json={"ad_id": ad["id"], "with_engagement": True}, timeout=15)
        b = r.json()
        assert b["awarded"] is False and "ended" in b["reason"].lower()

    def test_valid_award_then_dedup_then_different_kind(self, db, ad_factory):
        # Fresh user to avoid prior state interfering with award_points cooldowns.
        uid, tok, _ = _make_user(db, role="user")
        try:
            ad = ad_factory()
            # i) first watch — engage
            r1 = requests.post(f"{BASE_URL}/api/ads/watch", headers=_h(tok),
                               json={"ad_id": ad["id"], "with_engagement": True}, timeout=15)
            b1 = r1.json()
            assert b1["awarded"] is True, f"first engage should award: {b1}"
            assert b1["points"] > 0
            # ad doc inc
            ad_after = db.ads.find_one({"id": ad["id"]}, {"_id": 0})
            assert ad_after["rewards_used"] == 1
            assert ad_after["engagements"] == 1
            # claim row inserted
            assert db.ad_reward_claims.count_documents({
                "user_id": uid, "ad_id": ad["id"], "event_kind": "engage"
            }) == 1

            # ii) same (user, ad, engage) → dedup, awarded:false, duplicate:true
            r2 = requests.post(f"{BASE_URL}/api/ads/watch", headers=_h(tok),
                               json={"ad_id": ad["id"], "with_engagement": True}, timeout=15)
            b2 = r2.json()
            assert b2["awarded"] is False
            assert b2.get("duplicate") is True

            # iii) same user, DIFFERENT event kind (share) → should award
            r3 = requests.post(f"{BASE_URL}/api/ads/watch", headers=_h(tok),
                               json={"ad_id": ad["id"], "with_share": True}, timeout=15)
            b3 = r3.json()
            # award_points may cap to 0 if a 24h same-source cooldown is in play,
            # but the dedup row MUST still be different. We accept either:
            # awarded True with points>0 OR points==0 from cooldown, AND no `duplicate:true`.
            assert b3.get("duplicate") is not True, f"share should NOT dedup: {b3}"
            assert db.ad_reward_claims.count_documents({
                "user_id": uid, "ad_id": ad["id"], "event_kind": "share"
            }) == 1
        finally:
            db.users.delete_one({"id": uid})
            db.ad_reward_claims.delete_many({"user_id": uid})


# ============================================================================
# 4) Role-change email fan-out on make-ambassador (grant + revoke)
#    and ambassador-applications/approve
# ============================================================================
class TestRoleChangeFanOut:
    def test_make_ambassador_grant_and_revoke(self, ctx, db):
        admin_c = ctx["admin"]
        # Fresh target — not already ambassador
        tid, _, _ = _make_user(db, role="user", is_ambassador=False)
        try:
            # GRANT
            r1 = requests.post(
                f"{BASE_URL}/api/admin/users/{tid}/make-ambassador",
                headers=_h(admin_c["token"]),
                json={"ambassador": True},
                timeout=15,
            )
            assert r1.status_code == 200, r1.text
            assert r1.json()["is_ambassador"] is True
            notes = db.notifications.count_documents({"user_id": tid, "type": "role_change"})
            assert notes >= 1, "role_change notification missing on grant"
            assert db.audit_log.count_documents({"target_id": tid, "action": "user.ambassador_set"}) >= 1

            # REVOKE
            r2 = requests.post(
                f"{BASE_URL}/api/admin/users/{tid}/make-ambassador",
                headers=_h(admin_c["token"]),
                json={"ambassador": False},
                timeout=15,
            )
            assert r2.status_code == 200, r2.text
            assert r2.json()["is_ambassador"] is False
            notes_after = db.notifications.count_documents({"user_id": tid, "type": "role_change"})
            assert notes_after >= notes + 1, "role_change notification missing on revoke"
        finally:
            db.users.delete_one({"id": tid})
            db.notifications.delete_many({"user_id": tid})
            db.audit_log.delete_many({"target_id": tid})

    def test_ambassador_application_approve(self, ctx, db):
        admin_c = ctx["admin"]
        tid, _, _ = _make_user(db, role="user", is_ambassador=False)
        app_id = str(uuid.uuid4())
        now = dt.datetime.now(dt.timezone.utc).isoformat()
        db.ambassador_applications.insert_one({
            "id": app_id, "user_id": tid, "status": "pending",
            "reason": "test", "created_at": now, "updated_at": now,
        })
        try:
            r = requests.post(
                f"{BASE_URL}/api/admin/ambassador-applications/{app_id}/approve",
                headers=_h(admin_c["token"]),
                json={"note": "ok"},
                timeout=15,
            )
            assert r.status_code == 200, r.text
            assert db.notifications.count_documents({"user_id": tid, "type": "role_change"}) >= 1, \
                "role_change notification missing on app approve"
            assert db.audit_log.count_documents({"target_id": tid, "action": "ambassador.approve"}) >= 1
        finally:
            db.users.delete_one({"id": tid})
            db.ambassador_applications.delete_one({"id": app_id})
            db.notifications.delete_many({"user_id": tid})
            db.audit_log.delete_many({"target_id": tid})


# ============================================================================
# 5) Role-check fixes — super_admin accepted on feature-flags/announce/dm/make-amb
# ============================================================================
class TestSuperAdminAccess:
    def test_feature_flags_super_admin(self, ctx, db):
        c = ctx["super_admin"]
        key = f"TEST_iter36_flag_{uuid.uuid4().hex[:6]}"
        try:
            r = requests.put(
                f"{BASE_URL}/api/admin/feature-flags/{key}",
                headers=_h(c["token"]),
                json={"value": True},
                timeout=15,
            )
            assert r.status_code != 403, f"super_admin should NOT be 403 on feature-flags, got {r.status_code} {r.text}"
            assert r.status_code == 200, r.text
        finally:
            db.feature_flags.delete_many({"key": key})

    def test_announce_super_admin(self, ctx, db):
        c = ctx["super_admin"]
        r = requests.post(
            f"{BASE_URL}/api/admin/announce",
            headers=_h(c["token"]),
            json={"content": "TEST_iter36 announcement post — please ignore"},
            timeout=15,
        )
        assert r.status_code != 403, f"super_admin should NOT be 403 on announce, got {r.status_code} {r.text}"
        if r.status_code == 200:
            body = r.json()
            pid = body.get("id")
            if pid:
                db.posts.delete_one({"id": pid})

    def test_dm_super_admin(self, ctx, db):
        c = ctx["super_admin"]
        target = ctx["user"]
        r = requests.post(
            f"{BASE_URL}/api/admin/dm",
            headers=_h(c["token"]),
            json={"to_user_id": target["id"], "message": "TEST_iter36 system DM"},
            timeout=15,
        )
        assert r.status_code != 403, f"super_admin should NOT be 403 on dm, got {r.status_code} {r.text}"
        if r.status_code == 200:
            mid = r.json().get("id")
            if mid:
                db.messages.delete_one({"id": mid})

    def test_make_ambassador_super_admin(self, ctx, db):
        c = ctx["super_admin"]
        tid, _, _ = _make_user(db, role="user", is_ambassador=False)
        try:
            r = requests.post(
                f"{BASE_URL}/api/admin/users/{tid}/make-ambassador",
                headers=_h(c["token"]),
                json={"ambassador": True},
                timeout=15,
            )
            assert r.status_code != 403, f"super_admin should NOT be 403 on make-ambassador, got {r.status_code}"
            assert r.status_code == 200, r.text
        finally:
            db.users.delete_one({"id": tid})
            db.notifications.delete_many({"user_id": tid})
            db.audit_log.delete_many({"target_id": tid})


# ============================================================================
# 6) Startup indexes
# ============================================================================
class TestIndexes:
    def test_ad_reward_claims_unique_key(self, db):
        idx = db.ad_reward_claims.index_information()
        # find an index over field 'key' with unique=True
        found = False
        for name, spec in idx.items():
            keys = spec.get("key", [])
            if any(k[0] == "key" for k in keys) and spec.get("unique"):
                found = True
                break
        assert found, f"unique index on ad_reward_claims.key missing — got {idx}"

    def test_wallet_audit_indexes(self, db):
        idx = db.wallet_adjustments_audit.index_information()
        fields = set()
        for spec in idx.values():
            for k in spec.get("key", []):
                fields.add(k[0])
        assert "created_at" in fields, f"created_at index missing — got {idx}"
        assert "target_user_id" in fields, f"target_user_id index missing — got {idx}"
