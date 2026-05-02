"""
Backend tests for iteration 7: Multi-signature wallet withdrawals + signatories,
plus smart-access regression check.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://stokvel-plus.preview.emergentagent.com").rstrip("/")

API = f"{BASE_URL}/api"


def _rand_email():
    return f"TEST_{uuid.uuid4().hex[:10]}@example.com"


def _register_user(password="Test1234!"):
    """Register a fresh user via progressive signup + complete profile. Returns (token, user)."""
    email = _rand_email()
    r = requests.post(f"{API}/auth/progressive-signup", json={"email": email, "password": password, "step": 1})
    assert r.status_code == 200, f"progressive-signup failed: {r.status_code} {r.text}"
    jd = r.json()
    token = jd["token"]
    user = jd.get("user") or {}
    headers = {"Authorization": f"Bearer {token}"}
    r2 = requests.post(
        f"{API}/auth/complete-profile",
        headers=headers,
        json={
            "full_name": f"Test User {uuid.uuid4().hex[:6]}",
            "username": f"tst_{uuid.uuid4().hex[:8]}",
            "bio": "test bio",
            "intent": "member",
            "terms_accepted": True,
        },
    )
    assert r2.status_code == 200, f"complete-profile failed: {r2.status_code} {r2.text}"
    u2 = r2.json().get("user") or {}
    if u2:
        user = u2
    assert user.get("id"), f"no user id; user={user}"
    # Unlock premium so financial endpoints (deposit/contribute/withdraw/etc) work
    rp = requests.post(
        f"{API}/users/me/premium",
        headers={"Authorization": f"Bearer {token}"},
        json={"currency": "USD"},
    )
    assert rp.status_code == 200, f"premium unlock: {rp.status_code} {rp.text}"
    return token, user


def _deposit(token, amount):
    r = requests.post(
        f"{API}/wallet/deposit",
        headers={"Authorization": f"Bearer {token}"},
        json={"amount": amount},
    )
    assert r.status_code == 200, f"deposit: {r.status_code} {r.text}"


def _create_stokvel(token, name=None):
    _deposit(token, 50.0)  # creator fee $10
    payload = {
        "name": name or f"TEST_Group_{uuid.uuid4().hex[:6]}",
        "description": "Test group",
        "target_amount": 1000.0,
        "payout_cycle": "monthly",
    }
    r = requests.post(f"{API}/stokvels", headers={"Authorization": f"Bearer {token}"}, json=payload)
    assert r.status_code == 200, f"create stokvel: {r.status_code} {r.text}"
    return r.json()["id"]


def _invite(creator_token, stokvel_id, user_id):
    r = requests.post(
        f"{API}/stokvels/{stokvel_id}/invite",
        headers={"Authorization": f"Bearer {creator_token}"},
        json={"user_id": user_id},
    )
    assert r.status_code == 200, f"invite: {r.status_code} {r.text}"


def _contribute(token, stokvel_id, amount):
    r = requests.post(
        f"{API}/stokvels/{stokvel_id}/contribute",
        headers={"Authorization": f"Bearer {token}"},
        json={"amount": amount},
    )
    assert r.status_code == 200, f"contribute: {r.status_code} {r.text}"


@pytest.fixture(scope="module")
def three_members():
    """Create creator + 2 additional members all in same stokvel with pool funded."""
    c_token, creator = _register_user()
    m1_token, m1 = _register_user()
    m2_token, m2 = _register_user()
    # fund m1/m2 for member fee
    _deposit(m1_token, 50.0)
    _deposit(m2_token, 50.0)
    sid = _create_stokvel(c_token)
    _invite(c_token, sid, m1["id"])
    _invite(c_token, sid, m2["id"])
    # Creator contributes a chunk, so there's a pool
    _contribute(c_token, sid, 500.0)
    _contribute(m1_token, sid, 100.0)
    return {
        "stokvel_id": sid,
        "creator": {"token": c_token, "user": creator},
        "m1": {"token": m1_token, "user": m1},
        "m2": {"token": m2_token, "user": m2},
    }


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


# ------------- SIGNATORIES -------------

class TestSignatories:
    def test_creator_sets_signatories(self, three_members):
        s = three_members
        r = requests.put(
            f"{API}/stokvels/{s['stokvel_id']}/signatories",
            headers=_h(s["creator"]["token"]),
            json={"signatory_ids": [s["creator"]["user"]["id"]]},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["signatory_ids"] == [s["creator"]["user"]["id"]]
        assert data["required_approvals"] == 1

    def test_non_creator_forbidden(self, three_members):
        s = three_members
        r = requests.put(
            f"{API}/stokvels/{s['stokvel_id']}/signatories",
            headers=_h(s["m1"]["token"]),
            json={"signatory_ids": [s["m1"]["user"]["id"]]},
        )
        assert r.status_code == 403, r.text

    def test_too_many_signatories(self, three_members):
        s = three_members
        r = requests.put(
            f"{API}/stokvels/{s['stokvel_id']}/signatories",
            headers=_h(s["creator"]["token"]),
            json={"signatory_ids": [s["creator"]["user"]["id"], s["m1"]["user"]["id"],
                                     s["m2"]["user"]["id"], s["creator"]["user"]["id"]]},
        )
        assert r.status_code == 400, r.text

    def test_non_member_signatory(self, three_members):
        s = three_members
        r = requests.put(
            f"{API}/stokvels/{s['stokvel_id']}/signatories",
            headers=_h(s["creator"]["token"]),
            json={"signatory_ids": ["non-existent-user-id"]},
        )
        assert r.status_code == 400, r.text


# ------------- WITHDRAWALS CRUD -------------

class TestWithdrawalsCrud:
    def test_create_withdrawal_valid(self, three_members):
        s = three_members
        # Ensure 1 signatory = creator so approvals=1
        requests.put(
            f"{API}/stokvels/{s['stokvel_id']}/signatories",
            headers=_h(s["creator"]["token"]),
            json={"signatory_ids": [s["creator"]["user"]["id"]]},
        )
        r = requests.post(
            f"{API}/stokvels/{s['stokvel_id']}/withdrawals",
            headers=_h(s["m1"]["token"]),
            json={"amount": 10.0, "purpose": "TEST purpose"},
        )
        assert r.status_code == 200, r.text
        w = r.json()["withdrawal"]
        assert w["status"] == "pending"
        assert w["amount"] == 10.0
        assert w["required_approvals"] == 1
        assert w["recipient_id"] == s["m1"]["user"]["id"]

    def test_create_withdrawal_zero_amount(self, three_members):
        s = three_members
        r = requests.post(
            f"{API}/stokvels/{s['stokvel_id']}/withdrawals",
            headers=_h(s["creator"]["token"]),
            json={"amount": 0, "purpose": "x"},
        )
        assert r.status_code == 400

    def test_create_withdrawal_exceeds_pool(self, three_members):
        s = three_members
        r = requests.post(
            f"{API}/stokvels/{s['stokvel_id']}/withdrawals",
            headers=_h(s["creator"]["token"]),
            json={"amount": 10_000_000, "purpose": "x"},
        )
        assert r.status_code == 400

    def test_list_withdrawals_member(self, three_members):
        s = three_members
        r = requests.get(
            f"{API}/stokvels/{s['stokvel_id']}/withdrawals",
            headers=_h(s["creator"]["token"]),
        )
        assert r.status_code == 200
        data = r.json()
        assert "withdrawals" in data
        assert "signatories" in data

    def test_list_withdrawals_non_member_forbidden(self, three_members):
        s = three_members
        other_token, _ = _register_user()
        r = requests.get(
            f"{API}/stokvels/{s['stokvel_id']}/withdrawals",
            headers=_h(other_token),
        )
        assert r.status_code == 403


# ------------- VOTING + EXECUTION -------------

class TestVotingExecution:
    def test_one_of_one_executes_and_credits(self, three_members):
        s = three_members
        # 1 signatory = creator
        requests.put(
            f"{API}/stokvels/{s['stokvel_id']}/signatories",
            headers=_h(s["creator"]["token"]),
            json={"signatory_ids": [s["creator"]["user"]["id"]]},
        )
        # Member m2 proposes $25 payout to themselves
        me_before = requests.get(f"{API}/users/me", headers=_h(s["m2"]["token"])).json()
        bal_before = me_before.get("wallet_balance", 0.0)
        r = requests.post(
            f"{API}/stokvels/{s['stokvel_id']}/withdrawals",
            headers=_h(s["m2"]["token"]),
            json={"amount": 25.0, "purpose": "exec test", "recipient_user_id": s["m2"]["user"]["id"]},
        )
        assert r.status_code == 200, r.text
        wid = r.json()["withdrawal"]["id"]
        # creator approves → should execute
        r2 = requests.post(
            f"{API}/stokvels/{s['stokvel_id']}/withdrawals/{wid}/approve",
            headers=_h(s["creator"]["token"]),
        )
        assert r2.status_code == 200, r2.text
        assert r2.json()["status"] == "executed"

        me_after = requests.get(f"{API}/users/me", headers=_h(s["m2"]["token"])).json()
        assert me_after["wallet_balance"] == pytest.approx(bal_before + 25.0, abs=0.01)

    def test_non_signatory_cannot_vote(self, three_members):
        s = three_members
        # 1 signatory = creator
        requests.put(
            f"{API}/stokvels/{s['stokvel_id']}/signatories",
            headers=_h(s["creator"]["token"]),
            json={"signatory_ids": [s["creator"]["user"]["id"]]},
        )
        r = requests.post(
            f"{API}/stokvels/{s['stokvel_id']}/withdrawals",
            headers=_h(s["m1"]["token"]),
            json={"amount": 5.0, "purpose": "p"},
        )
        wid = r.json()["withdrawal"]["id"]
        # m1 is not a signatory
        r2 = requests.post(
            f"{API}/stokvels/{s['stokvel_id']}/withdrawals/{wid}/approve",
            headers=_h(s["m1"]["token"]),
        )
        assert r2.status_code == 403

    def test_vote_twice_and_resolved(self, three_members):
        s = three_members
        # Set 3 signatories → need 2 approvals
        requests.put(
            f"{API}/stokvels/{s['stokvel_id']}/signatories",
            headers=_h(s["creator"]["token"]),
            json={"signatory_ids": [
                s["creator"]["user"]["id"],
                s["m1"]["user"]["id"],
                s["m2"]["user"]["id"],
            ]},
        )
        r = requests.post(
            f"{API}/stokvels/{s['stokvel_id']}/withdrawals",
            headers=_h(s["m1"]["token"]),
            json={"amount": 15.0, "purpose": "dual"},
        )
        wid = r.json()["withdrawal"]["id"]
        # Creator approves (1/2)
        r1 = requests.post(
            f"{API}/stokvels/{s['stokvel_id']}/withdrawals/{wid}/approve",
            headers=_h(s["creator"]["token"]),
        )
        assert r1.status_code == 200
        assert r1.json()["status"] == "pending"
        # Creator approves again → 400
        r2 = requests.post(
            f"{API}/stokvels/{s['stokvel_id']}/withdrawals/{wid}/approve",
            headers=_h(s["creator"]["token"]),
        )
        assert r2.status_code == 400
        # m1 approves → executes
        r3 = requests.post(
            f"{API}/stokvels/{s['stokvel_id']}/withdrawals/{wid}/approve",
            headers=_h(s["m1"]["token"]),
        )
        assert r3.status_code == 200, r3.text
        assert r3.json()["status"] == "executed"
        # already-resolved: m2 approves → 400
        r4 = requests.post(
            f"{API}/stokvels/{s['stokvel_id']}/withdrawals/{wid}/approve",
            headers=_h(s["m2"]["token"]),
        )
        assert r4.status_code == 400

    def test_two_of_two_requires_both(self, three_members):
        s = three_members
        # 2 signatories: creator + m1, need 2
        requests.put(
            f"{API}/stokvels/{s['stokvel_id']}/signatories",
            headers=_h(s["creator"]["token"]),
            json={"signatory_ids": [s["creator"]["user"]["id"], s["m1"]["user"]["id"]]},
        )
        r = requests.post(
            f"{API}/stokvels/{s['stokvel_id']}/withdrawals",
            headers=_h(s["m2"]["token"]),
            json={"amount": 5.0, "purpose": "two of two"},
        )
        wid = r.json()["withdrawal"]["id"]
        r1 = requests.post(
            f"{API}/stokvels/{s['stokvel_id']}/withdrawals/{wid}/approve",
            headers=_h(s["creator"]["token"]),
        )
        assert r1.status_code == 200
        assert r1.json()["status"] == "pending"
        r2 = requests.post(
            f"{API}/stokvels/{s['stokvel_id']}/withdrawals/{wid}/approve",
            headers=_h(s["m1"]["token"]),
        )
        assert r2.status_code == 200
        assert r2.json()["status"] == "executed"

    def test_rejections_reach_threshold(self, three_members):
        s = three_members
        # 3 signatories, need 2 approvals → 2 rejections cannot be overcome
        requests.put(
            f"{API}/stokvels/{s['stokvel_id']}/signatories",
            headers=_h(s["creator"]["token"]),
            json={"signatory_ids": [
                s["creator"]["user"]["id"],
                s["m1"]["user"]["id"],
                s["m2"]["user"]["id"],
            ]},
        )
        r = requests.post(
            f"{API}/stokvels/{s['stokvel_id']}/withdrawals",
            headers=_h(s["m1"]["token"]),
            json={"amount": 3.0, "purpose": "rej"},
        )
        wid = r.json()["withdrawal"]["id"]
        # 2 rejections → sig_count=3, needed=2; rejections> sig-needed=1; so after 2 rej status=rejected
        r1 = requests.post(
            f"{API}/stokvels/{s['stokvel_id']}/withdrawals/{wid}/reject",
            headers=_h(s["creator"]["token"]),
        )
        assert r1.status_code == 200
        r2 = requests.post(
            f"{API}/stokvels/{s['stokvel_id']}/withdrawals/{wid}/reject",
            headers=_h(s["m1"]["token"]),
        )
        assert r2.status_code == 200
        assert r2.json()["status"] == "rejected"


# ------------- SMART ACCESS REGRESSION -------------

class TestSmartAccessRegression:
    def test_eligibility_endpoint_works(self, three_members):
        s = three_members
        r = requests.get(
            f"{API}/stokvels/{s['stokvel_id']}/smart-access-eligibility",
            headers=_h(s["creator"]["token"]),
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "eligible" in data
        assert "tier" in data
        assert "max_access_amount" in data
