"""Iter 20 backend regression — monthly cap (10,000) + parity + month rollover.

Covers spec items:
  • /api/score/summary returns monthly_cap=10000 and lifetime_score == monthly_score.
  • award_points monthly cap clamping & daily-checkin idempotency.
  • monthly cap halts further awards.
  • month rollover via direct DB write resets BOTH monthly_score AND network_score.
  • parity: /api/users/me network_score == /api/score/summary monthly_score.
"""
import os
import time
import uuid
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"
MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")

assert BASE_URL, "REACT_APP_BACKEND_URL not set"


def _signup_and_verify():
    """Create a fresh signed-up + email-verified + profile-completed user. Returns (token, user_id, email)."""
    email = f"TEST_iter20_{uuid.uuid4().hex[:10]}@example.com"
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})

    r = s.post(f"{API}/auth/progressive-signup",
               json={"email": email, "password": "Test123!", "step": 1}, timeout=30)
    assert r.status_code == 200, f"signup failed: {r.status_code} {r.text}"
    data = r.json()
    token = data["token"]
    user_id = data["user"]["id"]
    s.headers.update({"Authorization": f"Bearer {token}"})

    r = s.post(f"{API}/auth/send-otp", json={"email": email}, timeout=15)
    assert r.status_code == 200, f"send-otp failed: {r.text}"
    code = r.json().get("_mock_code")
    assert code, "no _mock_code"

    r = s.post(f"{API}/auth/verify-otp", json={"email": email, "code": code}, timeout=15)
    assert r.status_code == 200, f"verify-otp failed: {r.text}"

    uname = f"qa20_{uuid.uuid4().hex[:6]}"
    r = s.post(f"{API}/auth/complete-profile",
               json={"full_name": "Iter20 QA", "username": uname, "bio": "qa",
                     "intent": "member", "terms_accepted": True, "birth_month": 6}, timeout=15)
    assert r.status_code == 200, f"complete-profile failed: {r.text}"
    return s, token, user_id, email


@pytest.fixture(scope="module")
def session_and_user():
    return _signup_and_verify()


# ============== /score/summary =================================================

def test_score_summary_returns_monthly_cap_10000(session_and_user):
    s, _, _, _ = session_and_user
    r = s.get(f"{API}/score/summary", timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d["monthly_cap"] == 10000, f"expected monthly_cap=10000 got {d['monthly_cap']}"
    assert "monthly_score" in d
    assert "lifetime_score" in d


def test_lifetime_mirrors_monthly(session_and_user):
    """After complete-profile awarded ~250 points (or 500 founder-window), lifetime_score == monthly_score."""
    s, _, _, _ = session_and_user
    r = s.get(f"{API}/score/summary", timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d["monthly_score"] > 0, "expected non-zero score after complete-profile bonus"
    assert d["lifetime_score"] == d["monthly_score"], (
        f"parity broken: lifetime={d['lifetime_score']} monthly={d['monthly_score']}"
    )


def test_users_me_network_score_matches_summary_monthly(session_and_user):
    s, _, _, _ = session_and_user
    r1 = s.get(f"{API}/users/me", timeout=15)
    r2 = s.get(f"{API}/score/summary", timeout=15)
    assert r1.status_code == 200 and r2.status_code == 200
    me = r1.json()
    summ = r2.json()
    assert me["network_score"] == summ["monthly_score"], (
        f"network_score={me['network_score']} monthly_score={summ['monthly_score']}"
    )


# ============== daily-checkin idempotency ======================================

def test_daily_checkin_awards_then_idempotent(session_and_user):
    """First call gives 10 (or 20 if founder/premium); second call same day returns 0."""
    s, _, user_id, _ = session_and_user
    # baseline
    before = s.get(f"{API}/score/summary", timeout=15).json()["monthly_score"]
    r1 = s.post(f"{API}/score/daily-checkin", timeout=15)
    assert r1.status_code == 200, r1.text
    j1 = r1.json()
    after_first = s.get(f"{API}/score/summary", timeout=15).json()["monthly_score"]
    if j1.get("awarded", 0) > 0:
        delta = after_first - before
        assert delta == j1["awarded"], f"summary delta {delta} != awarded {j1['awarded']}"
    # second call - must be idempotent for the day
    r2 = s.post(f"{API}/score/daily-checkin", timeout=15)
    assert r2.status_code == 200
    j2 = r2.json()
    assert j2.get("awarded", 0) == 0, f"expected 0 on second checkin, got {j2}"
    assert j2.get("already_today") is True


def test_network_score_mirrored_after_award(session_and_user):
    s, _, _, _ = session_and_user
    me = s.get(f"{API}/users/me", timeout=15).json()
    summ = s.get(f"{API}/score/summary", timeout=15).json()
    assert me["network_score"] == summ["monthly_score"]


# ============== Month rollover via direct DB write =============================

def test_month_rollover_resets_both_scores():
    """Manually set users.month_key to a previous month → /score/summary should return 0
    (and network_score is also reset to 0)."""
    if not MONGO_URL or not DB_NAME:
        pytest.skip("MONGO_URL/DB_NAME not set in env")

    s, token, user_id, _ = _signup_and_verify()
    # Bump score so we have something to reset
    s.post(f"{API}/score/daily-checkin", timeout=15)
    before = s.get(f"{API}/score/summary", timeout=15).json()
    assert before["monthly_score"] > 0

    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    res = db.users.update_one(
        {"id": user_id},
        {"$set": {"month_key": "1999-01"}},   # ancient month → should trigger reset
    )
    assert res.modified_count == 1

    after = s.get(f"{API}/score/summary", timeout=15).json()
    assert after["monthly_score"] == 0, f"monthly_score should reset, got {after['monthly_score']}"

    me = s.get(f"{API}/users/me", timeout=15).json()
    assert me["network_score"] == 0, f"network_score should also reset, got {me['network_score']}"
    client.close()


# ============== Cap saturation: pushing to 10k blocks further awards ==========

def test_award_zero_when_monthly_cap_reached():
    """Set monthly_score=10000 directly in DB → daily-checkin returns 0."""
    if not MONGO_URL or not DB_NAME:
        pytest.skip("MONGO_URL/DB_NAME not set in env")

    s, _, user_id, _ = _signup_and_verify()
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    db.users.update_one(
        {"id": user_id},
        {"$set": {"monthly_score": 10000, "network_score": 10000,
                  "cap_reached_at": "2030-01-01T00:00:00+00:00"}},
    )
    r = s.post(f"{API}/score/daily-checkin", timeout=15)
    assert r.status_code == 200
    j = r.json()
    assert j.get("awarded", 0) == 0, f"expected 0 at cap, got {j}"

    summ = s.get(f"{API}/score/summary", timeout=15).json()
    assert summ["monthly_score"] == 10000
    assert summ["cap_reached"] is True
    assert summ["percentage"] == 100.0
    client.close()


# ============== Iter 19 regression — public payloads ==========================

def test_founders_status_public():
    r = requests.get(f"{API}/founders/status", timeout=10)
    assert r.status_code == 200
    d = r.json()
    assert d.get("limit") == 1000
    assert d.get("multiplier") == 2
    assert d.get("duration_days") == 30


def test_score_tiers_public_lifetime_cap_10000():
    r = requests.get(f"{API}/score/tiers", timeout=10)
    assert r.status_code == 200
    d = r.json()
    assert d["lifetime_cap"] == 10000


def test_referral_code_uppercase_present(session_and_user):
    s, _, user_id, _ = session_and_user
    me = s.get(f"{API}/users/me", timeout=15).json()
    code = me.get("referral_code")
    assert code, "referral_code missing on /users/me"
    assert code == code.upper(), f"referral_code should be uppercase, got {code}"
    assert code == user_id[:8].upper()
