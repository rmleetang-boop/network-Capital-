"""Iter 53 — Ambassador Program backend tests.

Verifies the post-iter-50 Ambassador logic:
 - first-withdrawal threshold lowered 20 → 10 referrals
 - admin bonus + bonus-adjust endpoints + AuditLog
 - wallet fees removed (no wallet deduction on withdrawal-request)
 - /ambassador/incentive payload shape (for Dashboard 2.0)
 - June Payout Block (current date Feb 2026 → blocked, expected 403)
 - admin overview/detail/earnings-history/config gating
 - /ambassadors/me + /ambassadors/apply (application flow)
 - regression: legacy /admin/ambassadors listing + make-ambassador
"""
import os
import time
import uuid
from datetime import datetime, timezone

import jwt as _jwt
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
JWT_SECRET = os.environ.get(
    "JWT_SECRET_KEY",
    "X2wtOCvJr45min9cJeiUaYVG8GgQPPFpJaq7ikUzMN35lwjKOQkWa2xmMyFfGNqc",
)
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

OWNER_EMAIL = "rmleetang@gmail.com"
OWNER_PASSWORD = "OwnerTest123!"
STANDING_ADMIN_EMAIL = "rmleetang+nctest1780423349@gmail.com"
STANDING_ADMIN_PASSWORD = "Test123!"


# ---------- helpers ----------
def _mint_token(user_id: str) -> str:
    return _jwt.encode(
        {"user_id": user_id, "exp": int(time.time()) + 3600},
        JWT_SECRET,
        algorithm="HS256",
    )


def _login(email: str, password: str) -> dict:
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": password},
        timeout=20,
    )
    assert r.status_code == 200, f"login {email} -> {r.status_code} {r.text[:200]}"
    return r.json()


def _new_user(prefix: str = "ambassador") -> dict:
    """Mint a disposable user via progressive-signup (Brevo blocked, that's OK)."""
    email = f"TEST_iter53_{prefix}_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(
        f"{BASE_URL}/api/auth/progressive-signup",
        json={"email": email, "password": "Test123!", "step": 1},
        timeout=20,
    )
    assert r.status_code in (200, 201), f"signup {email} -> {r.status_code} {r.text[:200]}"
    data = r.json()
    return {"email": email, "token": data["token"], "user_id": data.get("user", {}).get("id") or data.get("user_id")}


@pytest.fixture(scope="session")
def mongo():
    client = MongoClient(MONGO_URL)
    yield client[DB_NAME]
    client.close()


@pytest.fixture(scope="session")
def owner():
    """Platform owner / super_admin."""
    data = _login(OWNER_EMAIL, OWNER_PASSWORD)
    token = data["token"]
    return {"token": token, "user_id": data["user"]["id"], "role": data["user"].get("role")}


@pytest.fixture(scope="session")
def standing_admin():
    data = _login(STANDING_ADMIN_EMAIL, STANDING_ADMIN_PASSWORD)
    return {"token": data["token"], "user_id": data["user"]["id"], "role": data["user"].get("role")}


@pytest.fixture(scope="session")
def ambassador_user(owner, mongo):
    """Create a fresh user, grant ambassador role via admin endpoint."""
    u = _new_user("amb")
    # Promote to ambassador via admin endpoint (use owner who is super_admin -> also has admin powers)
    r = requests.post(
        f"{BASE_URL}/api/admin/users/{u['user_id']}/make-ambassador",
        headers={"Authorization": f"Bearer {owner['token']}"},
        json={"ambassador": True},
        timeout=20,
    )
    assert r.status_code == 200, f"make-ambassador -> {r.status_code} {r.text[:200]}"
    # Verify in DB
    doc = mongo.users.find_one({"id": u["user_id"]})
    assert doc and doc.get("is_ambassador") is True
    u["mongo_doc"] = doc
    return u


# =====================================================================
# AUTH SANITY
# =====================================================================
class TestAuth:
    def test_owner_login(self, owner):
        assert owner["role"] == "super_admin", f"expected super_admin, got {owner['role']}"

    def test_standing_admin_login(self, standing_admin):
        assert standing_admin["role"] in ("admin", "super_admin"), f"role={standing_admin['role']}"


# =====================================================================
# AMBASSADOR CONFIG — threshold migrated 20 → 10
# =====================================================================
class TestAmbassadorConfig:
    def test_get_config_super_admin_only(self, owner):
        r = requests.get(
            f"{BASE_URL}/api/admin/ambassador/config",
            headers={"Authorization": f"Bearer {owner['token']}"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        cfg = r.json()
        assert cfg["tier_referrals_required"][0] == 10, \
            f"first-tier threshold should be 10, got {cfg['tier_referrals_required'][0]}"
        assert cfg["tier_referrals_required"] == [10, 20, 40, 60, 100]

    def test_admin_role_gets_403(self, standing_admin):
        # standing_admin has role=admin, NOT super_admin
        r = requests.get(
            f"{BASE_URL}/api/admin/ambassador/config",
            headers={"Authorization": f"Bearer {standing_admin['token']}"},
            timeout=15,
        )
        if standing_admin["role"] == "admin":
            assert r.status_code == 403, f"admin should get 403, got {r.status_code}"
        else:
            # standing admin was bootstrapped to super_admin somehow — skip assertion
            pytest.skip("standing_admin is not 'admin' role")

    def test_patch_config_super_admin(self, owner):
        r = requests.patch(
            f"{BASE_URL}/api/admin/ambassador/config",
            headers={"Authorization": f"Bearer {owner['token']}"},
            json={"referral_min_score": 1000},  # no-op set, restore default
            timeout=15,
        )
        assert r.status_code == 200, r.text
        assert r.json()["referral_min_score"] == 1000


# =====================================================================
# /ambassador/incentive payload shape (Dashboard 2.0 contract)
# =====================================================================
class TestIncentivePayloadShape:
    def test_payload_shape(self, ambassador_user):
        r = requests.get(
            f"{BASE_URL}/api/ambassador/incentive",
            headers={"Authorization": f"Bearer {ambassador_user['token']}"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        body = r.json()

        # Asserted fields (current contract)
        for k in (
            "enabled", "is_ambassador", "starting_balance_zar", "paid_zar",
            "available_zar", "referral_pot_zar", "activity_pot_zar",
            "activity_unlocked", "qualified_referrals_count", "tiers_completed",
            "tier_referrals_required", "next_tier_required", "next_amount_zar",
            "eligible_to_withdraw", "activity_progress", "display",
            "june_payout_locked", "config_snapshot",
        ):
            assert k in body, f"missing field: {k}"

        # New ambassador starts at tier 0 with 0 qualified referrals
        assert body["is_ambassador"] is True
        assert body["tiers_completed"] == 0
        assert body["tier_referrals_required"][0] == 10
        assert body["next_tier_required"] == 10
        assert body["eligible_to_withdraw"] is False  # 0 referrals
        assert body["activity_unlocked"] is False
        assert body["june_payout_locked"] is True  # Feb 2026 → blocked

    def test_dashboard_v2_field_aliases_missing(self, ambassador_user):
        """Dashboard 2.0 spec asked for wallet_balance / ambassador_balance /
        first_withdrawal_threshold field names. Test what's actually returned so
        the main agent can decide whether to alias or rename for FE consumers."""
        r = requests.get(
            f"{BASE_URL}/api/ambassador/incentive",
            headers={"Authorization": f"Bearer {ambassador_user['token']}"},
            timeout=15,
        )
        body = r.json()
        # These keys are mentioned in the spec but NOT currently in payload.
        # We assert their absence and document it for the FE team.
        for missing_alias in ("wallet_balance", "ambassador_balance", "first_withdrawal_threshold"):
            assert missing_alias not in body, (
                f"unexpected — {missing_alias} is now present; update test + Dashboard 2.0 contract"
            )


# =====================================================================
# Activity unlock — _check_ambassador_activity_unlock uses 10 threshold
# in tier_referrals_required (separate from activity targets)
# =====================================================================
class TestActivityUnlock:
    def test_activity_targets_unchanged(self, ambassador_user):
        """Activity unlock is independent of referral threshold — confirm targets
        still 20 posts / 100 likes / 5 ad_shares."""
        r = requests.get(
            f"{BASE_URL}/api/ambassador/incentive",
            headers={"Authorization": f"Bearer {ambassador_user['token']}"},
            timeout=15,
        )
        cfg_snapshot = r.json()["config_snapshot"]
        assert cfg_snapshot["activity_targets"] == {"posts": 20, "likes": 100, "ad_shares": 5}


# =====================================================================
# WITHDRAW — 10-referral threshold, June lock
# =====================================================================
class TestWithdrawalEligibility:
    def test_below_threshold_returns_400_or_403(self, ambassador_user):
        """Brand-new ambassador with 0 referrals → June lock fires first (403)."""
        r = requests.post(
            f"{BASE_URL}/api/ambassador/incentive/withdraw",
            headers={"Authorization": f"Bearer {ambassador_user['token']}"},
            timeout=15,
        )
        # Feb 2026 → June payout locked → 403 from server.py:7501
        assert r.status_code == 403, f"expected 403 (june lock), got {r.status_code}: {r.text}"
        assert "June" in r.text or "30 June" in r.text

    def test_unlocks_at_10_qualifying_referrals(self, owner, mongo):
        """Manually seed 10 qualified referrals for a fresh ambassador, then
        confirm `eligible_to_withdraw` flips True (June lock still blocks the
        POST /withdraw call — that's separately tested above)."""
        amb = _new_user("threshold")
        mongo.users.update_one(
            {"id": amb["user_id"]},
            {"$set": {"is_ambassador": True, "email_verified": True,
                      "ambassador_balance_zar": 8500.0,
                      "ambassador_paid_zar": 0.0,
                      "ambassador_tiers_completed": 0,
                      "ambassador_role_granted_at": datetime.now(timezone.utc).isoformat()}},
        )

        # Seed 10 qualifying referrals — each verified, score≥1000, unique phone/email
        now_iso = datetime.now(timezone.utc).isoformat()
        for i in range(10):
            mongo.users.insert_one({
                "id": f"TEST_iter53_ref_{amb['user_id'][:8]}_{i}",
                "email": f"TEST_iter53_ref_{amb['user_id'][:8]}_{i}@example.com",
                "username": f"TEST_iter53_ref_{amb['user_id'][:8]}_{i}",
                "referred_by": amb["user_id"],
                "email_verified": True,
                "network_score": 1500,
                "phone": f"+2700000{amb['user_id'][:5]}{i:02d}",
                "created_at": now_iso,
                "role": "user",
            })

        r = requests.get(
            f"{BASE_URL}/api/ambassador/incentive",
            headers={"Authorization": f"Bearer {amb['token']}"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["qualified_referrals_count"] == 10
        assert body["next_tier_required"] == 10
        assert body["eligible_to_withdraw"] is True, "should be eligible at 10 referrals"
        assert body["next_amount_zar"] == 500.0

        # Cleanup
        mongo.users.delete_many({"id": {"$regex": f"^TEST_iter53_ref_{amb['user_id'][:8]}_"}})

    def test_withdraw_blocked_by_june_payout(self, ambassador_user):
        """Even an eligible ambassador is blocked until 30 June 2026."""
        # ambassador_user is the base fixture (still 0 refs), but we test the
        # block message anyway — it fires before eligibility check.
        r = requests.post(
            f"{BASE_URL}/api/ambassador/incentive/withdraw",
            headers={"Authorization": f"Bearer {ambassador_user['token']}"},
            timeout=15,
        )
        assert r.status_code == 403


# =====================================================================
# WALLET FEES — none deducted on withdraw request (iter 50 spec)
# =====================================================================
class TestNoWalletFees:
    def test_no_wallet_deduction_on_request(self, owner, mongo):
        """Seed an ambassador with wallet_balance, fire a withdraw request
        (will fail with June lock but should NOT mutate wallet_balance)."""
        amb = _new_user("fees")
        mongo.users.update_one(
            {"id": amb["user_id"]},
            {"$set": {"is_ambassador": True, "wallet_balance": 1000.0,
                      "ambassador_balance_zar": 8500.0,
                      "ambassador_paid_zar": 0.0,
                      "ambassador_tiers_completed": 0,
                      "ambassador_role_granted_at": datetime.now(timezone.utc).isoformat()}},
        )
        before = mongo.users.find_one({"id": amb["user_id"]})["wallet_balance"]
        r = requests.post(
            f"{BASE_URL}/api/ambassador/incentive/withdraw",
            headers={"Authorization": f"Bearer {amb['token']}"},
            timeout=15,
        )
        # Whatever the response (403 due to June, or otherwise), wallet must not be touched.
        after = mongo.users.find_one({"id": amb["user_id"]})["wallet_balance"]
        assert before == after, f"wallet_balance changed: {before} → {after}"


# =====================================================================
# ADMIN BONUS endpoints
# =====================================================================
class TestAdminBonus:
    def test_award_bonus_super_admin_only(self, owner, ambassador_user, mongo):
        r = requests.post(
            f"{BASE_URL}/api/admin/ambassadors/{ambassador_user['user_id']}/bonus",
            headers={"Authorization": f"Bearer {owner['token']}"},
            json={"amount_zar": 250.0, "reason": "TEST_iter53 promotional bonus"},
            timeout=15,
        )
        assert r.status_code == 200, f"bonus -> {r.status_code} {r.text}"
        data = r.json()
        assert data["amount_zar"] == 250.0

        # Verify DB updated
        doc = mongo.users.find_one({"id": ambassador_user["user_id"]})
        assert float(doc.get("ambassador_bonus_zar") or 0) >= 250.0
        assert float(doc.get("ambassador_balance_zar") or 0) >= 8500.0 + 250.0 - 0.01

        # AuditLog written
        log = mongo.audit_log.find_one(
            {"target_id": ambassador_user["user_id"], "action": "ambassador.bonus_awarded"},
            sort=[("created_at", -1)],
        )
        assert log is not None, "AuditLog row for ambassador.bonus_awarded missing"

    def test_award_bonus_non_admin_403(self, ambassador_user):
        """Ambassador user trying to award themselves a bonus -> 403."""
        r = requests.post(
            f"{BASE_URL}/api/admin/ambassadors/{ambassador_user['user_id']}/bonus",
            headers={"Authorization": f"Bearer {ambassador_user['token']}"},
            json={"amount_zar": 100.0, "reason": "self-award attempt"},
            timeout=15,
        )
        assert r.status_code == 403

    def test_award_bonus_admin_role_403(self, standing_admin, ambassador_user):
        """Standing admin (role=admin) — NOT super_admin — should get 403."""
        r = requests.post(
            f"{BASE_URL}/api/admin/ambassadors/{ambassador_user['user_id']}/bonus",
            headers={"Authorization": f"Bearer {standing_admin['token']}"},
            json={"amount_zar": 50.0, "reason": "TEST admin attempt"},
            timeout=15,
        )
        if standing_admin["role"] == "admin":
            assert r.status_code == 403, f"admin should be denied, got {r.status_code}"
        else:
            pytest.skip("standing admin elevated; cannot assert 403")

    def test_bonus_adjust_positive(self, owner, ambassador_user, mongo):
        before_doc = mongo.users.find_one({"id": ambassador_user["user_id"]})
        before_bal = float(before_doc.get("ambassador_balance_zar") or 0)

        r = requests.post(
            f"{BASE_URL}/api/admin/ambassadors/{ambassador_user['user_id']}/bonus-adjust",
            headers={"Authorization": f"Bearer {owner['token']}"},
            json={"delta_zar": 100.0, "reason": "TEST_iter53 adjust up"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        after_doc = mongo.users.find_one({"id": ambassador_user["user_id"]})
        assert abs(float(after_doc["ambassador_balance_zar"]) - (before_bal + 100.0)) < 0.01

        # Audit log
        log = mongo.audit_log.find_one(
            {"target_id": ambassador_user["user_id"], "action": "ambassador.bonus_adjusted"},
            sort=[("created_at", -1)],
        )
        assert log is not None
        assert log["metadata"]["delta_zar"] == 100.0

    def test_bonus_adjust_negative_refuses_below_paid(self, owner, ambassador_user):
        """Adjustment that would push balance below already-paid should 400."""
        r = requests.post(
            f"{BASE_URL}/api/admin/ambassadors/{ambassador_user['user_id']}/bonus-adjust",
            headers={"Authorization": f"Bearer {owner['token']}"},
            json={"delta_zar": -999999.0, "reason": "TEST_iter53 forced underflow"},
            timeout=15,
        )
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text}"


# =====================================================================
# ADMIN OVERVIEW / DETAIL / EARNINGS-HISTORY
# =====================================================================
class TestAdminAmbassadorViews:
    def test_overview(self, owner, ambassador_user):
        r = requests.get(
            f"{BASE_URL}/api/admin/ambassadors/overview",
            headers={"Authorization": f"Bearer {owner['token']}"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert "rows" in body and "count" in body
        # Our fixture ambassador should appear
        ids = {row["id"] for row in body["rows"]}
        assert ambassador_user["user_id"] in ids
        for row in body["rows"]:
            if row["id"] == ambassador_user["user_id"]:
                assert "qualified_referrals_count" in row
                assert "first_tier_required" in row
                assert row["first_tier_required"] == 10
                assert "is_eligible_first_withdrawal" in row

    def test_detail(self, owner, ambassador_user):
        r = requests.get(
            f"{BASE_URL}/api/admin/ambassadors/{ambassador_user['user_id']}",
            headers={"Authorization": f"Bearer {owner['token']}"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["user"]["id"] == ambassador_user["user_id"]
        assert "state" in body and "audit" in body and "withdrawals" in body
        assert body["state"]["tier_referrals_required"][0] == 10

    def test_earnings_history(self, owner, ambassador_user):
        r = requests.get(
            f"{BASE_URL}/api/admin/ambassadors/{ambassador_user['user_id']}/earnings-history",
            headers={"Authorization": f"Bearer {owner['token']}"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["user_id"] == ambassador_user["user_id"]
        assert isinstance(body["audit"], list)
        assert isinstance(body["withdrawals"], list)
        # Should have at least the balance_allocated + bonus_awarded entries
        events = [a["event"] for a in body["audit"]]
        assert "balance_allocated" in events


# =====================================================================
# /ambassadors/me dashboard payload
# =====================================================================
class TestAmbassadorsMe:
    def test_me_payload(self, ambassador_user):
        r = requests.get(
            f"{BASE_URL}/api/ambassadors/me",
            headers={"Authorization": f"Bearer {ambassador_user['token']}"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        for k in ("rank", "recruit_count", "new_7d", "new_30d",
                  "total_contribution", "targets", "recent_recruits", "performance"):
            assert k in body, f"/ambassadors/me missing {k}"
        assert isinstance(body["targets"], list)
        assert isinstance(body["recent_recruits"], list)
        assert isinstance(body["performance"], dict)
        # Default rank for fresh ambassador
        assert body["rank"] in ("Rising Star", "Ambassador", "Senior Ambassador",
                                 "Elite Ambassador", "Network Legend")

    def test_me_403_non_ambassador(self):
        u = _new_user("nonamb")
        r = requests.get(
            f"{BASE_URL}/api/ambassadors/me",
            headers={"Authorization": f"Bearer {u['token']}"},
            timeout=15,
        )
        assert r.status_code == 403


# =====================================================================
# /ambassadors/apply flow
# =====================================================================
class TestAmbassadorApplication:
    def test_apply_low_score_403(self):
        u = _new_user("apply_low")
        r = requests.post(
            f"{BASE_URL}/api/ambassadors/apply",
            headers={"Authorization": f"Bearer {u['token']}"},
            json={"why": "TEST_iter53 — I want to help grow the network capital community in SA",
                  "links": ["https://linkedin.com/in/test"]},
            timeout=15,
        )
        # New user has 0 score — should be denied (AMBASSADOR_MIN_SCORE)
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text}"

    def test_apply_then_approve_flow(self, owner, mongo):
        """Bump score, apply, then admin approves."""
        u = _new_user("apply_flow")
        mongo.users.update_one(
            {"id": u["user_id"]},
            {"$set": {"network_score": 99999, "monthly_score": 99999, "email_verified": True}},
        )
        r = requests.post(
            f"{BASE_URL}/api/ambassadors/apply",
            headers={"Authorization": f"Bearer {u['token']}"},
            json={"why": "TEST_iter53 application — strong community engagement focus",
                  "links": ["https://example.com"]},
            timeout=15,
        )
        assert r.status_code == 200, f"apply -> {r.status_code}: {r.text}"
        app_id = r.json()["id"]
        assert r.json()["status"] == "pending"

        # Confirm via /me/application
        r2 = requests.get(
            f"{BASE_URL}/api/ambassadors/me/application",
            headers={"Authorization": f"Bearer {u['token']}"},
            timeout=15,
        )
        assert r2.status_code == 200
        assert r2.json()["application"]["id"] == app_id

        # Admin approve
        r3 = requests.post(
            f"{BASE_URL}/api/admin/ambassador-applications/{app_id}/approve",
            headers={"Authorization": f"Bearer {owner['token']}"},
            json={"note": "TEST_iter53 approval"},
            timeout=20,
        )
        assert r3.status_code == 200, r3.text

        # Verify user is now ambassador
        doc = mongo.users.find_one({"id": u["user_id"]})
        assert doc["is_ambassador"] is True
        assert float(doc.get("ambassador_balance_zar") or 0) == 8500.0


# =====================================================================
# Regression — legacy /admin/ambassadors + make-ambassador
# =====================================================================
class TestRegression:
    def test_legacy_admin_ambassadors_listing(self, owner):
        r = requests.get(
            f"{BASE_URL}/api/admin/ambassadors",
            headers={"Authorization": f"Bearer {owner['token']}"},
            timeout=20,
        )
        assert r.status_code == 200, r.text

    def test_make_ambassador_grants_role_and_audit(self, owner, mongo):
        u = _new_user("makeamb")
        r = requests.post(
            f"{BASE_URL}/api/admin/users/{u['user_id']}/make-ambassador",
            headers={"Authorization": f"Bearer {owner['token']}"},
            json={"ambassador": True},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        doc = mongo.users.find_one({"id": u["user_id"]})
        assert doc["is_ambassador"] is True
        # Initial allocation written
        audit = mongo.ambassador_audit.find_one(
            {"user_id": u["user_id"], "event": "balance_allocated"},
        )
        assert audit is not None
        assert audit["amount_zar"] == 8500.0


# =====================================================================
# /admin/ambassador/audit
# =====================================================================
class TestAuditEndpoint:
    def test_audit_listing(self, owner, ambassador_user):
        r = requests.get(
            f"{BASE_URL}/api/admin/ambassador/audit",
            params={"user_id": ambassador_user["user_id"]},
            headers={"Authorization": f"Bearer {owner['token']}"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert "rows" in body
        assert all(r["user_id"] == ambassador_user["user_id"] for r in body["rows"])
