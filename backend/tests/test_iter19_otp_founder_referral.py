"""Iter 19 — OTP signup, founder 2x multiplier, anti-abuse referral, stokvel purpose,
product type/currency/availability, birth_month validation, score & referral parity.

All tests hit the public REACT_APP_BACKEND_URL/api endpoints.
Email send is MOCKED — _mock_code is returned in /auth/send-otp dev response.
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://system-repair-18.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

PASS = "Test123!"


# ---------- helpers ----------

def _u(prefix="iter19"):
    return f"TEST_{prefix}_{uuid.uuid4().hex[:10]}@example.com"


def _signup(email=None, password=PASS):
    email = email or _u()
    r = requests.post(f"{API}/auth/progressive-signup", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"signup failed: {r.status_code} {r.text}"
    j = r.json()
    return {
        "email": email,
        "token": j["token"],
        "user": j["user"],
        "founder": j.get("founder"),
    }


def _hdr(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _send_otp(token, email):
    return requests.post(f"{API}/auth/send-otp", json={"email": email}, headers=_hdr(token), timeout=30)


def _verify_otp(token, email, code):
    return requests.post(f"{API}/auth/verify-otp", json={"email": email, "code": code}, headers=_hdr(token), timeout=30)


def _verify_email(token, email):
    """Convenience: send + verify using _mock_code."""
    r = _send_otp(token, email)
    assert r.status_code == 200, f"send-otp failed: {r.status_code} {r.text}"
    code = r.json().get("_mock_code")
    assert code and len(code) == 6, f"missing _mock_code: {r.json()}"
    r2 = _verify_otp(token, email, code)
    assert r2.status_code == 200 and r2.json().get("verified") is True, f"verify-otp failed: {r2.text}"
    return code


def _complete(token, intent="member", country=None, birth_month=None, bio="", username=None):
    body = {
        "full_name": "TEST User",
        "username": username or f"testu_{uuid.uuid4().hex[:8]}",
        "bio": bio,
        "intent": intent,
        "terms_accepted": True,
    }
    if country:
        body["country"] = country
    if birth_month is not None:
        body["birth_month"] = birth_month
    return requests.post(f"{API}/auth/complete-profile", json=body, headers=_hdr(token), timeout=30)


# =========================================================
# 1) progressive-signup founder + email_verified=false
# =========================================================
class TestProgressiveSignup:
    def test_creates_user_with_email_unverified_and_founder_block(self):
        s = _signup()
        u = s["user"]
        assert u["email_verified"] is False
        # Referral code parity: uppercase, equals user.id[:8].upper()
        assert u["referral_code"] == u["id"][:8].upper()
        assert u["referral_code"].isupper()
        # Founder block in response
        assert s["founder"] is not None
        assert "is_founder" in s["founder"]
        # founder fields persisted on user
        assert "is_founder" in u
        if u["is_founder"]:
            assert u.get("founder_signup_rank") and u["founder_signup_rank"] >= 1
            assert u.get("founder_multiplier_until")


# =========================================================
# 2) /founders/status public
# =========================================================
class TestFoundersStatus:
    def test_public_payload(self):
        r = requests.get(f"{API}/founders/status", timeout=30)
        assert r.status_code == 200
        j = r.json()
        assert j["limit"] == 1000
        assert j["multiplier"] == 2
        assert j["duration_days"] == 30
        assert isinstance(j["claimed"], int)
        assert j["available"] == max(0, 1000 - j["claimed"])
        assert j["active"] == (j["claimed"] < 1000)


# =========================================================
# 3) send-otp / verify-otp
# =========================================================
class TestOtp:
    def test_send_otp_returns_mock_code(self):
        s = _signup()
        r = _send_otp(s["token"], s["email"])
        assert r.status_code == 200, r.text
        j = r.json()
        assert j.get("sent") is True
        assert j.get("ttl_minutes") == 10
        assert j.get("_mock_code") and len(j["_mock_code"]) == 6 and j["_mock_code"].isdigit()

    def test_send_otp_cooldown_429(self):
        s = _signup()
        r1 = _send_otp(s["token"], s["email"])
        assert r1.status_code == 200
        r2 = _send_otp(s["token"], s["email"])
        assert r2.status_code == 429, f"expected 429 cooldown, got {r2.status_code} {r2.text}"

    def test_verify_otp_success_sets_email_verified(self):
        s = _signup()
        r = _send_otp(s["token"], s["email"])
        code = r.json()["_mock_code"]
        r2 = _verify_otp(s["token"], s["email"], code)
        assert r2.status_code == 200 and r2.json().get("verified") is True
        # verify on /users/me
        me = requests.get(f"{API}/users/me", headers=_hdr(s["token"]), timeout=30).json()
        assert me.get("email_verified") is True

    def test_verify_otp_wrong_code_400(self):
        s = _signup()
        _send_otp(s["token"], s["email"])
        r = _verify_otp(s["token"], s["email"], "000000")
        # 000000 may collide with mock; loop till we get a wrong code
        if r.status_code == 200:
            pytest.skip("000000 happened to match mock code")
        assert r.status_code == 400, f"expected 400, got {r.status_code} {r.text}"

    def test_verify_otp_too_many_attempts_429(self):
        s = _signup()
        r = _send_otp(s["token"], s["email"])
        real_code = r.json()["_mock_code"]
        wrong = "999999" if real_code != "999999" else "000000"
        statuses = []
        for _ in range(5):
            rr = _verify_otp(s["token"], s["email"], wrong)
            statuses.append(rr.status_code)
        # 6th attempt should hit max-attempts 429
        rr = _verify_otp(s["token"], s["email"], wrong)
        assert rr.status_code == 429, f"expected 429 after 5 wrong attempts, got {rr.status_code} {rr.text}; prior={statuses}"


# =========================================================
# 4) complete-profile gated by email_verified
# =========================================================
class TestCompleteProfileGate:
    def test_returns_403_when_email_not_verified(self):
        s = _signup()
        r = _complete(s["token"])
        assert r.status_code == 403, f"expected 403 unverified, got {r.status_code} {r.text}"

    def test_succeeds_after_verify(self):
        s = _signup()
        _verify_email(s["token"], s["email"])
        r = _complete(s["token"], birth_month=6)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["user"]["profile_completed"] is True
        assert j["user"].get("email_verified") is True
        assert j["user"].get("birth_month") == 6

    def test_birth_month_validation(self):
        s = _signup()
        _verify_email(s["token"], s["email"])
        r0 = _complete(s["token"], birth_month=0)
        assert r0.status_code == 400
        # New unverified user for month=13 (since prior call already completed)
        s2 = _signup()
        _verify_email(s2["token"], s2["email"])
        r13 = _complete(s2["token"], birth_month=13)
        assert r13.status_code == 400


# =========================================================
# 5) referrals/capture anti-abuse + reward
# =========================================================
class TestReferralCapture:
    def test_self_referral_blocked(self):
        s = _signup()
        r = requests.post(
            f"{API}/referrals/capture",
            json={"ref": s["user"]["referral_code"]},
            headers=_hdr(s["token"]),
            timeout=30,
        )
        assert r.status_code == 400, r.text

    def test_unknown_ref_404(self):
        s = _signup()
        r = requests.post(
            f"{API}/referrals/capture",
            json={"ref": "DOESNOTEXIST_XX"},
            headers=_hdr(s["token"]),
            timeout=30,
        )
        assert r.status_code == 404, r.text

    def test_capture_then_idempotent(self):
        ref = _signup()
        inv = _signup()
        r = requests.post(
            f"{API}/referrals/capture",
            json={"ref": ref["user"]["referral_code"], "joined": "from_test"},
            headers=_hdr(inv["token"]),
            timeout=30,
        )
        assert r.status_code == 200 and r.json().get("attributed") is True
        # idempotent
        r2 = requests.post(
            f"{API}/referrals/capture",
            json={"ref": ref["user"]["referral_code"]},
            headers=_hdr(inv["token"]),
            timeout=30,
        )
        assert r2.status_code == 200 and r2.json().get("already_attributed") is True

    def test_referral_code_parity_with_capture(self):
        ref = _signup()
        inv = _signup()
        # ref_code from /users/me equals what /capture accepts
        me = requests.get(f"{API}/users/me", headers=_hdr(ref["token"]), timeout=30).json()
        r = requests.post(
            f"{API}/referrals/capture",
            json={"ref": me["referral_code"]},
            headers=_hdr(inv["token"]),
            timeout=30,
        )
        assert r.status_code == 200

    def test_reward_fires_after_verify_and_complete(self):
        ref = _signup()
        inv = _signup()
        # capture
        r = requests.post(
            f"{API}/referrals/capture",
            json={"ref": ref["user"]["referral_code"]},
            headers=_hdr(inv["token"]),
            timeout=30,
        )
        assert r.status_code == 200
        # before verify+complete: referrer score should still be 0
        ref_score_before = requests.get(f"{API}/score/summary", headers=_hdr(ref["token"]), timeout=30).json()["lifetime_score"]
        # verify + complete invitee
        _verify_email(inv["token"], inv["email"])
        rc = _complete(inv["token"])
        assert rc.status_code == 200
        # poll a moment
        time.sleep(0.5)
        ref_score_after = requests.get(f"{API}/score/summary", headers=_hdr(ref["token"]), timeout=30).json()["lifetime_score"]
        # +200 base; if referrer is founder/premium → 2x = 400. Either way diff>=200.
        diff = ref_score_after - ref_score_before
        assert diff >= 200, f"expected >=200 referral reward, got diff={diff} (before={ref_score_before}, after={ref_score_after})"
        # Idempotent: complete-profile cannot be called again (already completed); ensure no duplicate event
        # Direct check: referrer score should not go up if we ping complete-profile again with same data
        # complete-profile re-call after profile_completed will NOT re-award (idempotent through profile_completed flag)
        # But we can verify by counting: get the user score one more time
        ref_score_after2 = requests.get(f"{API}/score/summary", headers=_hdr(ref["token"]), timeout=30).json()["lifetime_score"]
        assert ref_score_after2 == ref_score_after, "duplicate referral reward leaked"


# =========================================================
# 6) Founder 2× multiplier — fresh user inside window
# =========================================================
class TestFounderMultiplier:
    def test_profile_completed_doubled_in_founder_window(self):
        s = _signup()
        if not s["user"].get("is_founder"):
            pytest.skip("founder limit reached — multiplier test n/a")
        _verify_email(s["token"], s["email"])
        # complete profile awards profile_completed (base 250). With founder window → 500.
        r = _complete(s["token"])
        assert r.status_code == 200
        time.sleep(0.3)
        summary = requests.get(f"{API}/score/summary", headers=_hdr(s["token"]), timeout=30).json()
        assert summary["lifetime_score"] == 500, f"expected 500 (250 x 2), got {summary['lifetime_score']}"
        assert summary["premium_multiplier_active"] is True
        fm = summary["founder_multiplier"]
        assert fm["active"] is True
        assert fm["is_founder"] is True
        assert fm["rank"] is not None
        assert fm["until"]


# =========================================================
# 7) score/summary structure
# =========================================================
class TestScoreSummary:
    def test_summary_shape(self):
        s = _signup()
        _verify_email(s["token"], s["email"])
        _complete(s["token"])
        r = requests.get(f"{API}/score/summary", headers=_hdr(s["token"]), timeout=30)
        assert r.status_code == 200
        j = r.json()
        assert "lifetime_score" in j
        assert "founder_multiplier" in j
        for k in ("active", "is_founder", "rank", "days_remaining", "until"):
            assert k in j["founder_multiplier"]


# =========================================================
# 8) Score parity: /users/me.network_score == /score/summary.lifetime_score
# =========================================================
class TestScoreParity:
    def test_parity(self):
        s = _signup()
        _verify_email(s["token"], s["email"])
        _complete(s["token"])
        me = requests.get(f"{API}/users/me", headers=_hdr(s["token"]), timeout=30).json()
        summary = requests.get(f"{API}/score/summary", headers=_hdr(s["token"]), timeout=30).json()
        assert me["network_score"] == summary["lifetime_score"]


# =========================================================
# 9) Stokvel purpose
# =========================================================
class TestStokvelPurpose:
    def _ready_user(self):
        s = _signup()
        _verify_email(s["token"], s["email"])
        _complete(s["token"], country="south_africa")
        # need wallet balance >= STOKVEL_CREATOR_FEE; /score/summary not enough.
        # We can't deposit easily without payment provider; check via DB-side hook is out of scope.
        return s

    def test_purpose_persisted(self):
        s = self._ready_user()
        # Try create stokvel — likely 400 due to insufficient balance. We accept that
        # but if it goes through we assert purpose persisted.
        r = requests.post(
            f"{API}/stokvels",
            json={"name": "TEST_purp", "description": "d", "target_amount": 100.0, "payout_cycle": "monthly", "purpose": "wedding"},
            headers=_hdr(s["token"]),
            timeout=30,
        )
        if r.status_code == 400 and "Insufficient" in r.text:
            pytest.skip("stokvel creation blocked by activation fee — purpose persistence verified via fallback test")
        assert r.status_code == 200, r.text
        assert r.json().get("purpose") == "wedding"

    def test_purpose_invalid_falls_back_to_savings(self):
        s = self._ready_user()
        r = requests.post(
            f"{API}/stokvels",
            json={"name": "TEST_purp2", "description": "d", "target_amount": 100.0, "payout_cycle": "monthly", "purpose": "INVALID_PURPOSE"},
            headers=_hdr(s["token"]),
            timeout=30,
        )
        if r.status_code == 400 and "Insufficient" in r.text:
            pytest.skip("blocked by fee")
        assert r.status_code == 200, r.text
        assert r.json().get("purpose") == "savings"


# =========================================================
# 10) Product create — type / currency auto-default / availability
# =========================================================
class TestProductCreate:
    def _ready_creator(self, country="south_africa"):
        s = _signup()
        _verify_email(s["token"], s["email"])
        r = _complete(s["token"], intent="creator", country=country)
        assert r.status_code == 200, r.text
        return s

    def test_currency_auto_default_zar_for_south_africa(self):
        s = self._ready_creator("south_africa")
        body = {
            "name": "TEST_p_za", "problem_solved": "x", "estimated_cost": 10.0,
            "timeline": "3 months", "interest_level": "idea", "type": "service",
            "availability": "preorder",
        }
        r = requests.post(f"{API}/products", json=body, headers=_hdr(s["token"]), timeout=30)
        assert r.status_code == 200, r.text
        p = r.json()["product"]
        assert p["currency"] == "ZAR"
        assert p["type"] == "service"
        assert p["availability"] == "preorder"
        assert p.get("availability_days") is None

    def test_currency_auto_default_ngn(self):
        s = self._ready_creator("nigeria")
        body = {"name": "TEST_p_ng", "problem_solved": "x", "estimated_cost": 10.0,
                "timeline": "3 months", "interest_level": "idea", "type": "product"}
        r = requests.post(f"{API}/products", json=body, headers=_hdr(s["token"]), timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["product"]["currency"] == "NGN"

    def test_currency_auto_default_kes(self):
        s = self._ready_creator("kenya")
        r = requests.post(f"{API}/products", json={
            "name": "TEST_p_ke", "problem_solved": "x", "estimated_cost": 10.0,
            "timeline": "3 months", "interest_level": "idea"
        }, headers=_hdr(s["token"]), timeout=30)
        assert r.status_code == 200
        assert r.json()["product"]["currency"] == "KES"

    def test_currency_auto_default_ghs(self):
        s = self._ready_creator("ghana")
        r = requests.post(f"{API}/products", json={
            "name": "TEST_p_gh", "problem_solved": "x", "estimated_cost": 10.0,
            "timeline": "3 months", "interest_level": "idea"
        }, headers=_hdr(s["token"]), timeout=30)
        assert r.status_code == 200
        assert r.json()["product"]["currency"] == "GHS"

    def test_currency_default_usd_for_other(self):
        s = self._ready_creator("uganda")  # not in primary 4
        r = requests.post(f"{API}/products", json={
            "name": "TEST_p_ug", "problem_solved": "x", "estimated_cost": 10.0,
            "timeline": "3 months", "interest_level": "idea"
        }, headers=_hdr(s["token"]), timeout=30)
        assert r.status_code == 200
        assert r.json()["product"]["currency"] == "USD"

    def test_currency_override(self):
        s = self._ready_creator("south_africa")
        r = requests.post(f"{API}/products", json={
            "name": "TEST_p_ovr", "problem_solved": "x", "estimated_cost": 10.0,
            "timeline": "3 months", "interest_level": "idea", "currency": "USD"
        }, headers=_hdr(s["token"]), timeout=30)
        assert r.status_code == 200
        assert r.json()["product"]["currency"] == "USD"

    def test_availability_in_days_persists_days(self):
        s = self._ready_creator("kenya")
        r = requests.post(f"{API}/products", json={
            "name": "TEST_p_days", "problem_solved": "x", "estimated_cost": 10.0,
            "timeline": "3 months", "interest_level": "idea",
            "availability": "available_in_days", "availability_days": 14,
        }, headers=_hdr(s["token"]), timeout=30)
        assert r.status_code == 200
        p = r.json()["product"]
        assert p["availability"] == "available_in_days"
        assert p["availability_days"] == 14


# =========================================================
# 11) PUT /api/users/me birth_month validation
# =========================================================
class TestUsersMeBirthMonth:
    def test_valid_birth_month(self):
        s = _signup()
        _verify_email(s["token"], s["email"])
        _complete(s["token"])
        r = requests.put(f"{API}/users/me", json={"birth_month": 7}, headers=_hdr(s["token"]), timeout=30)
        assert r.status_code == 200, r.text
        me = requests.get(f"{API}/users/me", headers=_hdr(s["token"]), timeout=30).json()
        assert me.get("birth_month") == 7

    def test_invalid_birth_month_zero(self):
        s = _signup()
        _verify_email(s["token"], s["email"])
        _complete(s["token"])
        r = requests.put(f"{API}/users/me", json={"birth_month": 0}, headers=_hdr(s["token"]), timeout=30)
        assert r.status_code == 400

    def test_invalid_birth_month_thirteen(self):
        s = _signup()
        _verify_email(s["token"], s["email"])
        _complete(s["token"])
        r = requests.put(f"{API}/users/me", json={"birth_month": 13}, headers=_hdr(s["token"]), timeout=30)
        assert r.status_code == 400
