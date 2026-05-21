"""ITER 34 — Withdrawals (Wallet + Promotion ZAR) backend tests.

Covers:
- /api/withdrawals (eligibility, MIME + size validation, balance check, reservation)
- /api/withdrawals/me (list shape, masked account, eligibility, processing_window)
- /api/withdrawals/me/{id}/proof
- /api/admin/withdrawals (list, status_filter, q, summary tiles)
- /api/admin/withdrawals/{id}/approve|reject|mark-paid|note|proof
- Non-admin gating on /admin/* routes
- promotion_zar_balance auto-credit inside _record_promotion_event
"""
import os
import time
import uuid
import base64
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL must be set"
API = f"{BASE_URL}/api"
ADMIN_PW = "NetworkCapital2025!"

# Direct mongo handle for score boost / cleanup (allowed per system prompt)
_MONGO = MongoClient((os.environ.get("MONGO_URL") or "mongodb://localhost:27017").strip('"').strip("'"))
_DB = _MONGO[(os.environ.get("DB_NAME") or "test_database").strip('"').strip("'")]


# ------------------------------------------------------------------ helpers
def _signup(prefix: str) -> dict:
    ts = int(time.time() * 1000)
    email = f"TEST_{prefix}_{ts}_{uuid.uuid4().hex[:6]}@example.com"
    r = requests.post(f"{API}/auth/progressive-signup",
                      json={"email": email, "password": "Test123!", "step": 1}, timeout=20)
    assert r.status_code == 200, r.text
    token = r.json()["token"]
    h = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    otp_resp = requests.post(f"{API}/auth/send-otp", headers=h, json={"email": email}, timeout=20).json()
    code = otp_resp.get("_mock_code")
    assert code, otp_resp
    requests.post(f"{API}/auth/verify-otp", headers=h, json={"email": email, "code": code}, timeout=20)
    requests.post(f"{API}/auth/complete-profile", headers=h, json={
        "full_name": "ITER34 Tester", "username": f"iter34_{ts}_{uuid.uuid4().hex[:4]}",
        "bio": "qa", "intent": "member", "terms_accepted": True, "birth_month": 6,
    }, timeout=20)
    me = requests.get(f"{API}/users/me", headers=h, timeout=20).json()
    return {"email": email, "token": token, "headers": h, "id": me["id"], "user": me}


def _boost(user_id: str, net_score=5000, wallet=500.0, promo=200.0) -> None:
    _DB.users.update_one({"id": user_id},
                         {"$set": {"network_score": net_score, "wallet_balance": wallet,
                                   "promotion_zar_balance": promo}})


def _make_admin(user_id: str) -> None:
    _DB.users.update_one({"id": user_id}, {"$set": {"role": "admin"}})


def _png_data_url(kb: int = 1) -> str:
    return "data:image/png;base64," + base64.b64encode(b"\x89PNG\r\n" + b"x" * (kb * 1024)).decode()


def _pdf_data_url() -> str:
    return "data:application/pdf;base64," + base64.b64encode(b"%PDF-1.4 test").decode()


# ------------------------------------------------------------------ fixtures
@pytest.fixture(scope="module")
def admin_user():
    u = _signup("adm34")
    _make_admin(u["id"])
    yield u
    _DB.users.delete_one({"id": u["id"]})
    _DB.withdrawals.delete_many({"user_id": u["id"]})


@pytest.fixture(scope="module")
def eligible_user():
    u = _signup("usr34")
    _boost(u["id"])
    yield u
    _DB.users.delete_one({"id": u["id"]})
    _DB.withdrawals.delete_many({"user_id": u["id"]})


@pytest.fixture(scope="module")
def ineligible_user():
    u = _signup("low34")
    # Make sure score is low
    _DB.users.update_one({"id": u["id"]},
                         {"$set": {"network_score": 500, "monthly_score": 100,
                                   "wallet_balance": 100.0, "promotion_zar_balance": 50.0}})
    yield u
    _DB.users.delete_one({"id": u["id"]})


# =================================================================== TESTS
class TestEligibilityGate:
    def test_low_score_returns_403(self, ineligible_user):
        body = _valid_body("wallet", 10.0)
        r = requests.post(f"{API}/withdrawals", headers=ineligible_user["headers"], json=body, timeout=20)
        assert r.status_code == 403
        assert "3500" in r.json().get("detail", "")

    def test_unauth_returns_401_or_403(self):
        r = requests.post(f"{API}/withdrawals",
                          headers={"Content-Type": "application/json"},
                          json=_valid_body("wallet", 10.0), timeout=20)
        assert r.status_code in (401, 403)


def _valid_body(source: str, amount: float, proof: str = None) -> dict:
    return {
        "source": source, "amount_zar": amount,
        "full_name": "Test User", "bank_name": "Test Bank",
        "account_number": "1234567890", "branch_code": "250655",
        "swift_code": "ABSAZAJJ", "address": "1 Test Street, Cape Town",
        "proof_data_url": proof or _png_data_url(),
    }


class TestProofValidation:
    def test_bad_mime_rejected(self, eligible_user):
        body = _valid_body("wallet", 10.0, proof="data:text/plain;base64," + base64.b64encode(b"hello").decode())
        r = requests.post(f"{API}/withdrawals", headers=eligible_user["headers"], json=body, timeout=20)
        assert r.status_code == 400
        assert "PDF" in r.json()["detail"]

    def test_oversize_rejected(self, eligible_user):
        # ~6 MB image > 5 MB limit
        body = _valid_body("wallet", 10.0, proof=_png_data_url(kb=6 * 1024))
        r = requests.post(f"{API}/withdrawals", headers=eligible_user["headers"], json=body, timeout=30)
        assert r.status_code == 400
        assert "5 MB" in r.json()["detail"] or "5MB" in r.json()["detail"]

    def test_pdf_accepted(self, eligible_user):
        # Refresh balances first
        _boost(eligible_user["id"])
        body = _valid_body("wallet", 5.0, proof=_pdf_data_url())
        r = requests.post(f"{API}/withdrawals", headers=eligible_user["headers"], json=body, timeout=20)
        assert r.status_code == 200, r.text
        # cleanup
        _DB.withdrawals.delete_one({"id": r.json()["id"]})


class TestPydanticValidation:
    def test_invalid_source(self, eligible_user):
        body = _valid_body("wallet", 10.0); body["source"] = "crypto"
        r = requests.post(f"{API}/withdrawals", headers=eligible_user["headers"], json=body, timeout=20)
        assert r.status_code == 422

    def test_negative_amount(self, eligible_user):
        body = _valid_body("wallet", -5.0)
        r = requests.post(f"{API}/withdrawals", headers=eligible_user["headers"], json=body, timeout=20)
        assert r.status_code == 422

    def test_short_full_name(self, eligible_user):
        body = _valid_body("wallet", 10.0); body["full_name"] = "A"
        r = requests.post(f"{API}/withdrawals", headers=eligible_user["headers"], json=body, timeout=20)
        assert r.status_code == 422


class TestBalanceCheckAndReservation:
    def test_wallet_over_balance_rejected(self, eligible_user):
        _boost(eligible_user["id"], wallet=100.0, promo=50.0)
        body = _valid_body("wallet", 999.0)
        r = requests.post(f"{API}/withdrawals", headers=eligible_user["headers"], json=body, timeout=20)
        assert r.status_code == 400
        assert "exceeds" in r.json()["detail"].lower()

    def test_promotion_over_balance_rejected(self, eligible_user):
        _boost(eligible_user["id"], wallet=100.0, promo=50.0)
        body = _valid_body("promotion", 999.0)
        r = requests.post(f"{API}/withdrawals", headers=eligible_user["headers"], json=body, timeout=20)
        assert r.status_code == 400

    def test_wallet_debited_on_create(self, eligible_user):
        _boost(eligible_user["id"], wallet=300.0, promo=200.0)
        body = _valid_body("wallet", 150.0)
        r = requests.post(f"{API}/withdrawals", headers=eligible_user["headers"], json=body, timeout=20)
        assert r.status_code == 200
        u = _DB.users.find_one({"id": eligible_user["id"]})
        assert abs(u["wallet_balance"] - 150.0) < 1e-6
        assert abs(u["promotion_zar_balance"] - 200.0) < 1e-6  # promo untouched
        _DB.withdrawals.delete_one({"id": r.json()["id"]})

    def test_promotion_debited_on_create(self, eligible_user):
        _boost(eligible_user["id"], wallet=300.0, promo=200.0)
        body = _valid_body("promotion", 75.0)
        r = requests.post(f"{API}/withdrawals", headers=eligible_user["headers"], json=body, timeout=20)
        assert r.status_code == 200
        u = _DB.users.find_one({"id": eligible_user["id"]})
        assert abs(u["promotion_zar_balance"] - 125.0) < 1e-6
        assert abs(u["wallet_balance"] - 300.0) < 1e-6
        _DB.withdrawals.delete_one({"id": r.json()["id"]})


class TestListAndProof:
    def test_my_list_shape_and_masking(self, eligible_user):
        _boost(eligible_user["id"], wallet=400.0, promo=200.0)
        body = _valid_body("wallet", 25.0)
        post = requests.post(f"{API}/withdrawals", headers=eligible_user["headers"], json=body, timeout=20).json()
        wid = post["id"]

        lst = requests.get(f"{API}/withdrawals/me", headers=eligible_user["headers"], timeout=20).json()
        assert "withdrawals" in lst and "balances" in lst and "eligibility" in lst
        assert lst["processing_window_hours"] == "24-48"
        assert lst["eligibility"]["min_score_required"] == 3500
        assert lst["eligibility"]["eligible"] is True
        # Find our row, ensure proof blob NOT present, masked account is
        row = next(x for x in lst["withdrawals"] if x["id"] == wid)
        assert "proof_data_url" not in row
        assert "account_number" not in row
        assert row["account_number_masked"].endswith("7890")
        assert "•" in row["account_number_masked"]

        # Proof endpoint returns full data url
        pr = requests.get(f"{API}/withdrawals/me/{wid}/proof", headers=eligible_user["headers"], timeout=20).json()
        assert pr["proof_data_url"].startswith("data:image/png")
        _DB.withdrawals.delete_one({"id": wid})


# ------------------------------------------------------------ admin tests
def _admin_headers(admin_user):
    return admin_user["headers"]


class TestAdminGating:
    def test_non_admin_blocked_on_list(self, eligible_user):
        r = requests.get(f"{API}/admin/withdrawals", headers=eligible_user["headers"], timeout=20)
        assert r.status_code == 403

    def test_non_admin_blocked_on_approve(self, eligible_user):
        r = requests.post(f"{API}/admin/withdrawals/nope/approve",
                          headers=eligible_user["headers"], json={"note": "x"}, timeout=20)
        assert r.status_code in (403, 404)
        if r.status_code == 404:
            # If 404, must be after role-check — verify by checking another endpoint:
            r2 = requests.get(f"{API}/admin/withdrawals", headers=eligible_user["headers"], timeout=20)
            assert r2.status_code == 403


class TestAdminWorkflow:
    def test_wallet_full_flow_reject_refund(self, admin_user, eligible_user):
        _boost(eligible_user["id"], wallet=300.0, promo=200.0)
        post = requests.post(f"{API}/withdrawals", headers=eligible_user["headers"],
                             json=_valid_body("wallet", 150.0), timeout=20).json()
        wid = post["id"]
        # Debit verified
        assert abs(_DB.users.find_one({"id": eligible_user["id"]})["wallet_balance"] - 150.0) < 1e-6

        # Admin list with status_filter=pending should include this
        lst = requests.get(f"{API}/admin/withdrawals?status_filter=pending",
                           headers=_admin_headers(admin_user), timeout=20).json()
        assert any(w["id"] == wid for w in lst["withdrawals"])
        assert lst["summary"]["pending"] >= 1
        # account_number still present for admin (full bank details)
        row = next(w for w in lst["withdrawals"] if w["id"] == wid)
        assert "account_number" in row

        # Reject → refunds
        r = requests.post(f"{API}/admin/withdrawals/{wid}/reject",
                          headers=_admin_headers(admin_user),
                          json={"note": "incomplete docs"}, timeout=20)
        assert r.status_code == 200
        u = _DB.users.find_one({"id": eligible_user["id"]})
        assert abs(u["wallet_balance"] - 300.0) < 1e-6  # refunded
        w = _DB.withdrawals.find_one({"id": wid})
        assert w["status"] == "rejected"
        assert len(w["admin_notes"]) == 1 and w["admin_notes"][0]["action"] == "reject"
        _DB.withdrawals.delete_one({"id": wid})

    def test_promotion_approve_then_mark_paid(self, admin_user, eligible_user):
        _boost(eligible_user["id"], wallet=300.0, promo=200.0)
        post = requests.post(f"{API}/withdrawals", headers=eligible_user["headers"],
                             json=_valid_body("promotion", 100.0), timeout=20).json()
        wid = post["id"]

        # Approve
        r = requests.post(f"{API}/admin/withdrawals/{wid}/approve",
                          headers=_admin_headers(admin_user), json={"note": "verified"}, timeout=20)
        assert r.status_code == 200, r.text
        assert _DB.withdrawals.find_one({"id": wid})["status"] == "approved"

        # Add free-form note
        r = requests.post(f"{API}/admin/withdrawals/{wid}/note",
                          headers=_admin_headers(admin_user), json={"note": "EFT initiated"}, timeout=20)
        assert r.status_code == 200

        # Mark paid (only allowed on approved)
        r = requests.post(f"{API}/admin/withdrawals/{wid}/mark-paid",
                          headers=_admin_headers(admin_user), json={"note": "ref 12345"}, timeout=20)
        assert r.status_code == 200
        w = _DB.withdrawals.find_one({"id": wid})
        assert w["status"] == "paid"
        notes_actions = [n["action"] for n in w["admin_notes"]]
        assert "approve" in notes_actions and "note" in notes_actions and "paid" in notes_actions

        # Promo balance NOT refunded
        u = _DB.users.find_one({"id": eligible_user["id"]})
        assert abs(u["promotion_zar_balance"] - 100.0) < 1e-6  # 200 - 100, not refunded
        _DB.withdrawals.delete_one({"id": wid})

    def test_cannot_mark_paid_without_approve(self, admin_user, eligible_user):
        _boost(eligible_user["id"], wallet=300.0)
        post = requests.post(f"{API}/withdrawals", headers=eligible_user["headers"],
                             json=_valid_body("wallet", 10.0), timeout=20).json()
        wid = post["id"]
        r = requests.post(f"{API}/admin/withdrawals/{wid}/mark-paid",
                          headers=_admin_headers(admin_user), json={"note": ""}, timeout=20)
        assert r.status_code == 400
        # cleanup (reject + delete)
        requests.post(f"{API}/admin/withdrawals/{wid}/reject",
                      headers=_admin_headers(admin_user), json={"note": "test cleanup"}, timeout=20)
        _DB.withdrawals.delete_one({"id": wid})

    def test_status_filter_all_returns_everything(self, admin_user, eligible_user):
        _boost(eligible_user["id"], wallet=300.0)
        post = requests.post(f"{API}/withdrawals", headers=eligible_user["headers"],
                             json=_valid_body("wallet", 5.0), timeout=20).json()
        wid = post["id"]
        lst = requests.get(f"{API}/admin/withdrawals?status_filter=all",
                           headers=_admin_headers(admin_user), timeout=20).json()
        assert any(w["id"] == wid for w in lst["withdrawals"])
        # search by username
        q = eligible_user["user"]["username"]
        lst2 = requests.get(f"{API}/admin/withdrawals?q={q}",
                            headers=_admin_headers(admin_user), timeout=20).json()
        assert any(w["id"] == wid for w in lst2["withdrawals"])
        # admin proof
        pr = requests.get(f"{API}/admin/withdrawals/{wid}/proof",
                          headers=_admin_headers(admin_user), timeout=20).json()
        assert pr["proof_data_url"].startswith("data:")
        # cleanup
        requests.post(f"{API}/admin/withdrawals/{wid}/reject",
                      headers=_admin_headers(admin_user), json={"note": ""}, timeout=20)
        _DB.withdrawals.delete_one({"id": wid})


class TestAdminNotifications:
    def test_create_withdrawal_notifies_admins(self, admin_user, eligible_user):
        _boost(eligible_user["id"], wallet=300.0)
        _DB.notifications.delete_many({"user_id": admin_user["id"], "type": "withdrawal"})
        post = requests.post(f"{API}/withdrawals", headers=eligible_user["headers"],
                             json=_valid_body("wallet", 20.0), timeout=20).json()
        wid = post["id"]
        count = _DB.notifications.count_documents({"user_id": admin_user["id"], "type": "withdrawal", "withdrawal_id": wid})
        assert count == 1
        _DB.withdrawals.delete_one({"id": wid})


class TestPromotionAutoCredit:
    """Verify _record_promotion_event increments user.promotion_zar_balance during an active 24x7 promo."""

    def test_post_create_credits_promotion_zar(self, admin_user):
        # Create a fresh user for clean accounting
        user = _signup("promo34")
        try:
            _boost(user["id"], promo=0.0)  # zero out
            # Create 24x7 force-active promo using actual PromotionIn schema
            payload = {
                "name": f"TEST_iter34_24x7_{uuid.uuid4().hex[:6]}",
                "description": "auto-credit test",
                "eligible_actions": ["post_create"],
                "min_network_score": 0,
                "schedule": {"days_of_week": [0, 1, 2, 3, 4, 5, 6],
                             "start_time": "00:00", "end_time": "23:59"},
                "starts_at": "2020-01-01T00:00:00+02:00",
                "ends_at": "2099-01-01T00:00:00+02:00",
                "zar_per_point": 0.10,
                "is_active": True,
            }
            r = requests.post(f"{API}/admin/promotions", headers=admin_user["headers"], json=payload, timeout=20)
            assert r.status_code == 200, f"promo create: {r.status_code} {r.text[:300]}"
            promo_id = r.json()["id"]

            # Trigger a post_create
            body = {"content": "iter34 promo trigger " + uuid.uuid4().hex[:8], "visibility": "public"}
            pr = requests.post(f"{API}/posts", headers=user["headers"], json=body, timeout=20)
            assert pr.status_code in (200, 201), pr.text

            # Wait briefly for async event recording
            time.sleep(2.0)
            u = _DB.users.find_one({"id": user["id"]})
            ev_count = _DB.promotion_events.count_documents({"promotion_id": promo_id, "user_id": user["id"]})
            assert ev_count >= 1, f"No promotion_events recorded for user (got {ev_count})"
            # promotion_zar_balance must have been incremented by zar_estimate (>0)
            assert (u.get("promotion_zar_balance") or 0) > 0, \
                f"Expected promotion_zar_balance>0 after post_create; got {u.get('promotion_zar_balance')}"

            # Cleanup promo
            _DB.promotions.delete_one({"id": promo_id})
            _DB.promotion_events.delete_many({"promotion_id": promo_id})
        finally:
            _DB.users.delete_one({"id": user["id"]})


class TestRegression:
    def test_admin_promotions_list_still_works(self, admin_user):
        r = requests.get(f"{API}/admin/promotions", headers=admin_user["headers"], timeout=20)
        assert r.status_code == 200

    def test_active_promotions(self, eligible_user):
        r = requests.get(f"{API}/promotions/active", headers=eligible_user["headers"], timeout=20)
        assert r.status_code == 200

    def test_user_my_promotions(self, eligible_user):
        r = requests.get(f"{API}/users/me/promotions", headers=eligible_user["headers"], timeout=20)
        assert r.status_code == 200

    def test_my_login_summary(self, eligible_user):
        r = requests.get(f"{API}/promotions/me/login-summary", headers=eligible_user["headers"], timeout=20)
        assert r.status_code == 200
