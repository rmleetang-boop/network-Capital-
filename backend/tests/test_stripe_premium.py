"""Backend tests for Stripe premium checkout integration + legacy Paystack mock unlock.
Covers: POST /api/payments/checkout/session, GET /api/payments/checkout/status/{sid},
POST /api/webhook/stripe (sanity), POST /api/users/me/premium (legacy routing + idempotency).
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://system-repair-18.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
ORIGIN_URL = BASE_URL


def _register(email_prefix: str) -> tuple[str, str]:
    """Register a fresh user via progressive signup + complete profile. Returns (token, user_id)."""
    email = f"TEST_{email_prefix}_{uuid.uuid4().hex[:8]}@test.com"
    password = "Test123!"
    r = requests.post(f"{API}/auth/progressive-signup", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"signup failed: {r.status_code} {r.text}"
    token = r.json().get("token") or r.json().get("access_token")
    assert token, f"no token in signup resp: {r.json()}"
    headers = {"Authorization": f"Bearer {token}"}
    uname = f"testu{uuid.uuid4().hex[:6]}"
    r2 = requests.post(
        f"{API}/auth/complete-profile",
        json={
            "full_name": "Test User",
            "username": uname,
            "bio": "automation",
            "intent": "member",
            "terms_accepted": True,
        },
        headers=headers,
        timeout=30,
    )
    assert r2.status_code == 200, f"complete-profile failed: {r2.status_code} {r2.text}"
    me = requests.get(f"{API}/users/me", headers=headers, timeout=30)
    assert me.status_code == 200
    return token, me.json()["id"]


@pytest.fixture(scope="module")
def user_a():
    return _register("stripe_a")


@pytest.fixture(scope="module")
def user_b_ngn():
    return _register("paystack_b")


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ---------- Stripe checkout session creation ----------

class TestStripeCheckoutSession:
    def test_create_usd_session(self, user_a):
        token, _ = user_a
        r = requests.post(
            f"{API}/payments/checkout/session",
            json={"package_id": "premium_unlock", "currency": "USD", "origin_url": ORIGIN_URL},
            headers=_auth(token),
            timeout=60,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["currency"] == "USD"
        assert data["amount_local"] == 10.0
        assert data["symbol"] == "$"
        assert "session_id" in data and data["session_id"]
        assert data["url"].startswith("https://checkout.stripe.com/"), f"unexpected url: {data['url']}"
        # stash for status test
        pytest.stripe_session_id = data["session_id"]
        pytest.stripe_user_a_token = token

    def test_status_before_payment(self):
        sid = getattr(pytest, "stripe_session_id", None)
        token = getattr(pytest, "stripe_user_a_token", None)
        assert sid, "session id missing from prior test"
        r = requests.get(f"{API}/payments/checkout/status/{sid}", headers=_auth(token), timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        # expected pre-payment: status 'open', payment_status 'unpaid'
        assert data["payment_status"] in ("unpaid", "pending"), data
        assert data.get("premium_unlocked") is False

    def test_status_wrong_user_forbidden(self, user_b_ngn):
        sid = getattr(pytest, "stripe_session_id", None)
        token_b, _ = user_b_ngn
        r = requests.get(f"{API}/payments/checkout/status/{sid}", headers=_auth(token_b), timeout=60)
        assert r.status_code == 403, r.text

    def test_status_unknown_session_404(self, user_a):
        token, _ = user_a
        r = requests.get(f"{API}/payments/checkout/status/cs_unknown_{uuid.uuid4().hex}", headers=_auth(token), timeout=60)
        assert r.status_code == 404, r.text

    def test_ngn_rejected_with_paystack_hint(self, user_a):
        token, _ = user_a
        r = requests.post(
            f"{API}/payments/checkout/session",
            json={"package_id": "premium_unlock", "currency": "NGN", "origin_url": ORIGIN_URL},
            headers=_auth(token),
            timeout=30,
        )
        assert r.status_code == 400, r.text
        assert "paystack" in r.json().get("detail", "").lower() or "not supported by stripe" in r.json().get("detail", "").lower()

    def test_unknown_currency_400(self, user_a):
        token, _ = user_a
        r = requests.post(
            f"{API}/payments/checkout/session",
            json={"package_id": "premium_unlock", "currency": "XYZ", "origin_url": ORIGIN_URL},
            headers=_auth(token),
            timeout=30,
        )
        assert r.status_code == 400, r.text

    def test_no_auth_rejected(self):
        r = requests.post(
            f"{API}/payments/checkout/session",
            json={"package_id": "premium_unlock", "currency": "USD", "origin_url": ORIGIN_URL},
            timeout=30,
        )
        assert r.status_code in (401, 403), r.text

    def test_price_cannot_be_manipulated_jpy_integer(self):
        """Send a bogus 'amount' field + request JPY. Server must ignore frontend amount & use
        SUPPORTED_CURRENCIES rate. JPY amount must be integer (no decimals)."""
        # Fresh user because the previous call already made one pending session and user may be capped
        token, _ = _register("stripe_jpy")
        r = requests.post(
            f"{API}/payments/checkout/session",
            json={
                "package_id": "premium_unlock",
                "currency": "JPY",
                "origin_url": ORIGIN_URL,
                "amount": 0.01,  # bogus — must be ignored
                "amount_local": 1,  # bogus — must be ignored
            },
            headers=_auth(token),
            timeout=60,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["currency"] == "JPY"
        # JPY has no decimals — amount_local must be an int value (either int type or float whose int()==value)
        amt = data["amount_local"]
        assert float(amt).is_integer(), f"JPY amount not integer: {amt}"
        assert amt > 1, f"server used manipulated amount: {amt}"  # real JPY rate would be ~1500
        assert data["url"].startswith("https://checkout.stripe.com/")


# ---------- Legacy /users/me/premium (Paystack mock) ----------

class TestLegacyPremiumEndpoint:
    def test_usd_now_routes_to_stripe_400(self, user_b_ngn):
        token, _ = user_b_ngn
        r = requests.post(f"{API}/users/me/premium", json={"currency": "USD"}, headers=_auth(token), timeout=30)
        assert r.status_code == 400, r.text
        assert "stripe" in r.json().get("detail", "").lower()

    def test_ngn_mock_unlocks_and_awards_bonus(self, user_b_ngn):
        token, uid = user_b_ngn
        r = requests.post(f"{API}/users/me/premium", json={"currency": "NGN"}, headers=_auth(token), timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("premium_unlocked") is True
        assert data.get("mocked") is True
        assert data.get("welcome_bonus_points") == 500
        # Verify via /users/me
        me = requests.get(f"{API}/users/me", headers=_auth(token), timeout=30).json()
        assert me.get("premium_unlocked") is True
        # Verify score event
        events = requests.get(f"{API}/score/events", headers=_auth(token), timeout=30)
        assert events.status_code == 200
        evs = events.json()
        rows = evs.get("events") if isinstance(evs, dict) else evs
        welcome = [e for e in rows if e.get("action") == "premium_welcome_bonus"]
        assert len(welcome) == 1, f"expected exactly 1 welcome bonus event, got {len(welcome)}"
        pytest.b_score_after = me.get("monthly_score", 0)

    def test_idempotent_second_call_does_not_double_award(self, user_b_ngn):
        token, _ = user_b_ngn
        r = requests.post(f"{API}/users/me/premium", json={"currency": "NGN"}, headers=_auth(token), timeout=30)
        # It returns 200 with already_premium, OR 400 — in current impl it returns 200 already_premium
        assert r.status_code in (200, 400), r.text
        if r.status_code == 200:
            assert r.json().get("already_premium") is True or r.json().get("premium_unlocked") is True
        events = requests.get(f"{API}/score/events", headers=_auth(token), timeout=30).json()
        rows = events.get("events") if isinstance(events, dict) else events
        welcome = [e for e in rows if e.get("action") == "premium_welcome_bonus"]
        assert len(welcome) == 1, f"welcome bonus awarded twice: {len(welcome)}"

    def test_already_premium_blocks_stripe_session(self, user_b_ngn):
        token, _ = user_b_ngn
        r = requests.post(
            f"{API}/payments/checkout/session",
            json={"package_id": "premium_unlock", "currency": "USD", "origin_url": ORIGIN_URL},
            headers=_auth(token),
            timeout=30,
        )
        assert r.status_code == 400, r.text
        assert "already" in r.json().get("detail", "").lower()


# ---------- Webhook sanity ----------

class TestStripeWebhook:
    def test_empty_body_does_not_500(self):
        r = requests.post(f"{API}/webhook/stripe", data=b"", timeout=30)
        # must NOT be 500; invalid signature → 400 expected
        assert r.status_code != 500, f"webhook 500'd on empty body: {r.text}"
        assert r.status_code in (400, 401, 422), r.text

    def test_invalid_body_signature_400(self):
        r = requests.post(
            f"{API}/webhook/stripe",
            data=b'{"id":"evt_bogus","type":"checkout.session.completed"}',
            headers={"Stripe-Signature": "t=1,v1=bogus"},
            timeout=30,
        )
        assert r.status_code != 500
        assert r.status_code in (400, 401, 422)
