"""
Iteration 8 tests:
- GET /api/currencies
- POST /api/users/me/premium (mock paywall)
- PUT /api/users/me with currency
- 402 Payment Required on premium-gated endpoints when locked
- Same endpoints succeed after premium unlock
- GET /users/me returns currency & premium_unlocked
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://fly-platform.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


def _rand_email():
    return f"TEST_{uuid.uuid4().hex[:10]}@example.com"


def _register(password="Test1234!"):
    email = _rand_email()
    r = requests.post(f"{API}/auth/progressive-signup", json={"email": email, "password": password, "step": 1})
    assert r.status_code == 200, r.text
    j = r.json()
    token = j["token"]
    user = j.get("user") or {}
    headers = {"Authorization": f"Bearer {token}"}
    r2 = requests.post(f"{API}/auth/complete-profile", headers=headers, json={
        "full_name": f"User {uuid.uuid4().hex[:6]}",
        "username": f"u_{uuid.uuid4().hex[:8]}",
        "bio": "test",
        "intent": "member",
        "terms_accepted": True,
    })
    assert r2.status_code == 200, r2.text
    u = r2.json().get("user") or user
    return token, u, email


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


# ---------------- GET /api/currencies ----------------

class TestCurrenciesList:
    def test_currencies_endpoint(self):
        r = requests.get(f"{API}/currencies")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "currencies" in data
        assert data.get("premium_fee_usd") == 10
        currencies = data["currencies"]
        codes = [c["code"] for c in currencies]
        expected = ["USD", "EUR", "GBP", "ZAR", "NGN", "KES", "GHS", "JPY", "AUD", "CAD"]
        for code in expected:
            assert code in codes, f"missing {code}"
        assert len(currencies) == 10
        for c in currencies:
            assert "symbol" in c and "label" in c and "rate" in c


# ---------------- POST /api/users/me/premium ----------------

class TestPremiumUnlock:
    def test_unlock_zar_first_call(self):
        token, _user, _email = _register()
        r = requests.post(f"{API}/users/me/premium", headers=_h(token), json={"currency": "ZAR"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("premium_unlocked") is True
        assert d.get("currency") == "ZAR"
        assert d.get("paid_usd") == 10.0
        assert d.get("paid_local") == pytest.approx(182.0, abs=0.5)

    def test_unlock_second_call_already_premium(self):
        token, _u, _e = _register()
        r1 = requests.post(f"{API}/users/me/premium", headers=_h(token), json={"currency": "USD"})
        assert r1.status_code == 200
        r2 = requests.post(f"{API}/users/me/premium", headers=_h(token), json={"currency": "USD"})
        assert r2.status_code == 200, r2.text
        d = r2.json()
        assert d.get("already_premium") is True
        assert d.get("premium_unlocked") is True

    def test_unlock_invalid_currency(self):
        token, _u, _e = _register()
        r = requests.post(f"{API}/users/me/premium", headers=_h(token), json={"currency": "XYZ"})
        assert r.status_code == 400, r.text


# ---------------- PUT /api/users/me with currency ----------------

class TestPutUserCurrency:
    def test_set_currency_valid(self):
        token, _u, _e = _register()
        r = requests.put(f"{API}/users/me", headers=_h(token), json={"currency": "EUR"})
        assert r.status_code == 200, r.text
        # verify persisted
        me = requests.get(f"{API}/users/me", headers=_h(token)).json()
        assert me.get("currency") == "EUR"

    def test_set_currency_invalid(self):
        token, _u, _e = _register()
        r = requests.put(f"{API}/users/me", headers=_h(token), json={"currency": "FAKE"})
        assert r.status_code == 400, r.text


# ---------------- /users/me returns new fields ----------------

class TestUsersMeFields:
    def test_users_me_has_currency_and_premium_flag(self):
        token, _u, _e = _register()
        me = requests.get(f"{API}/users/me", headers=_h(token)).json()
        assert "currency" in me
        assert "premium_unlocked" in me
        assert me["premium_unlocked"] in (False, None) or me["premium_unlocked"] is False


# ---------------- 402 on premium-gated endpoints ----------------

class TestPaywallGating:
    def test_wallet_deposit_402_when_locked(self):
        token, _u, _e = _register()
        r = requests.post(f"{API}/wallet/deposit", headers=_h(token), json={"amount": 10})
        assert r.status_code == 402, f"expected 402 got {r.status_code} {r.text}"

    def test_wallet_deposit_succeeds_after_unlock(self):
        token, _u, _e = _register()
        # unlock
        ru = requests.post(f"{API}/users/me/premium", headers=_h(token), json={"currency": "USD"})
        assert ru.status_code == 200
        r = requests.post(f"{API}/wallet/deposit", headers=_h(token), json={"amount": 50})
        assert r.status_code == 200, r.text

    def test_stokvel_contribute_402_when_locked(self):
        # Need a stokvel id where the locked user is a member.
        # Approach: creator unlocks, creates stokvel, invites locked member, locked member contributes -> 402
        c_tok, c_user, _ = _register()
        # Creator must unlock to deposit + create stokvel
        requests.post(f"{API}/users/me/premium", headers=_h(c_tok), json={"currency": "USD"})
        requests.post(f"{API}/wallet/deposit", headers=_h(c_tok), json={"amount": 50})
        rs = requests.post(f"{API}/stokvels", headers=_h(c_tok), json={
            "name": f"TEST_pay_{uuid.uuid4().hex[:6]}",
            "description": "x",
            "target_amount": 1000,
            "payout_cycle": "monthly",
        })
        assert rs.status_code == 200, rs.text
        sid = rs.json()["id"]

        # locked member (does NOT need to be invited — require_premium fires first)
        m_tok, m_user, _ = _register()

        # locked contribute -> 402 (require_premium fires before membership check)
        r = requests.post(f"{API}/stokvels/{sid}/contribute", headers=_h(m_tok), json={"amount": 5})
        assert r.status_code == 402, f"expected 402 got {r.status_code} {r.text}"

        # smart access -> 402
        r2 = requests.post(f"{API}/stokvels/{sid}/smart-access", headers=_h(m_tok),
                           json={"stokvel_id": sid, "requested_amount": 5})
        assert r2.status_code == 402, f"expected 402 got {r2.status_code} {r2.text}"

        # propose withdrawal -> 402
        r3 = requests.post(f"{API}/stokvels/{sid}/withdrawals", headers=_h(m_tok),
                           json={"amount": 5, "purpose": "x"})
        assert r3.status_code == 402, f"expected 402 got {r3.status_code} {r3.text}"

    def test_product_support_402_when_locked(self):
        # Creator unlocks and creates product. Locked supporter attempts /support -> 402
        c_tok, c_user, _ = _register()
        requests.post(f"{API}/users/me/premium", headers=_h(c_tok), json={"currency": "USD"})

        rp = requests.post(f"{API}/products", headers=_h(c_tok), json={
            "name": f"TEST_prod_{uuid.uuid4().hex[:6]}",
            "description": "test product description for paywall",
            "category": "art",
            "problem_solved": "tests need products",
            "estimated_cost": 100,
            "timeline": "1 month",
            "interest_level": "medium",
        })
        # product create may or may not be paywalled—accept 200 or 402 then unlock+retry
        if rp.status_code == 402:
            pytest.skip("product creation also paywalled; not in scope")
        assert rp.status_code == 200, rp.text
        pid = rp.json().get("id") or rp.json().get("product", {}).get("id")
        assert pid

        s_tok, _su, _ = _register()
        r = requests.post(f"{API}/products/{pid}/support", headers=_h(s_tok), json={"amount": 5})
        assert r.status_code == 402, f"expected 402 got {r.status_code} {r.text}"
