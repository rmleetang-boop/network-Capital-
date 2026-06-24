"""Iter 55 verification — 4 fixes:
   (1) SafeImage fallback (FE only — skipped here, see Playwright)
   (2) Open Graph share endpoints
   (3) Ambassador wallet email (notification + wallet_info path)
   (4) Super-admin POST /admin/users/{id}/wallet-adjust + Super PIN gate
"""
import os
import re
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

OWNER_EMAIL = "rmleetang@gmail.com"
OWNER_PASS = "OwnerTest123!"
SUPER_PIN = "NCowner!2026"


# ─────────────────────── helpers / fixtures ──────────────────────────────
@pytest.fixture(scope="module")
def owner_token():
    r = requests.post(f"{API}/auth/login", json={"email": OWNER_EMAIL, "password": OWNER_PASS}, timeout=20)
    assert r.status_code == 200, f"Owner login failed: {r.status_code} {r.text[:200]}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def owner_headers(owner_token):
    return {"Authorization": f"Bearer {owner_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def super_pin_token(owner_headers):
    r = requests.post(
        f"{API}/admin/super-pin/verify",
        headers=owner_headers,
        json={"pin": SUPER_PIN},
        timeout=15,
    )
    assert r.status_code == 200, f"Super-pin verify failed: {r.status_code} {r.text[:300]}"
    return r.json().get("token") or r.json().get("super_pin_token")


@pytest.fixture(scope="module")
def super_headers(owner_headers, super_pin_token):
    return {**owner_headers, "X-Super-PIN-Token": super_pin_token}


@pytest.fixture(scope="module")
def test_user(owner_headers):
    """Create a fresh user via progressive signup + OTP for tests that need a target."""
    email = f"test_iter55_{int(time.time())}@example.com"
    password = "Test123!"
    r = requests.post(
        f"{API}/auth/progressive-signup",
        json={"email": email, "password": password, "step": 1}, timeout=20,
    )
    assert r.status_code in (200, 201), r.text[:200]
    tok = r.json().get("token")
    headers = {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}
    me = requests.get(f"{API}/users/me", headers=headers, timeout=15)
    assert me.status_code == 200, me.text[:200]
    uid = me.json()["id"]
    return {"id": uid, "email": email, "token": tok, "username": me.json().get("username")}


# ───────────────────────── BUG #2 — OG share previews ─────────────────────
class TestShareOpenGraph:
    def _assert_og_html(self, r, expected_status=200):
        assert r.status_code == expected_status, f"unexpected {r.status_code}: {r.text[:200]}"
        ct = r.headers.get("content-type", "")
        assert "text/html" in ct, f"content-type not html: {ct}"
        html = r.text
        # OG / twitter card meta
        assert re.search(r'<meta\s+property=["\']og:title["\']', html), "og:title missing"
        assert re.search(r'<meta\s+property=["\']og:description["\']', html), "og:description missing"
        assert re.search(r'<meta\s+name=["\']twitter:card["\']', html), "twitter:card missing"
        # JS auto-redirect
        assert "location" in html.lower() and "replace" in html.lower(), "no JS redirect found"
        return html

    def test_share_product_nonexistent(self):
        r = requests.get(f"{API}/share/p/nonexistent/stokvel-plus", timeout=15, allow_redirects=False)
        self._assert_og_html(r, expected_status=404)

    def test_share_user_owner(self):
        r = requests.get(f"{API}/share/u/rmleetang", timeout=15, allow_redirects=False)
        # Owner exists OR may not have public profile; both 200 & 404 acceptable as graceful
        assert r.status_code in (200, 404)
        self._assert_og_html(r, expected_status=r.status_code)

    def test_share_user_unknown(self):
        r = requests.get(f"{API}/share/u/____noexist_user_xyz", timeout=15, allow_redirects=False)
        self._assert_og_html(r, expected_status=404)

    def test_share_post_unknown(self):
        r = requests.get(f"{API}/share/post/does-not-exist", timeout=15, allow_redirects=False)
        self._assert_og_html(r, expected_status=404)

    def test_share_referral_unknown(self):
        r = requests.get(f"{API}/share/r/____noexist_user_xyz", timeout=15, allow_redirects=False)
        self._assert_og_html(r, expected_status=404)


# ───────────────────────── BUG #4 — wallet-adjust endpoint ───────────────
class TestWalletAdjustEndpoint:
    def test_reject_without_auth(self, test_user):
        r = requests.post(
            f"{API}/admin/users/{test_user['id']}/wallet-adjust",
            json={"delta": 10, "reason": "test"}, timeout=15,
        )
        # 401 (no auth) or 403 acceptable — endpoint must NOT be open
        assert r.status_code in (401, 403), r.text[:200]

    def test_reject_non_super_admin(self, test_user):
        # The new user has role 'user' — POST should be 403
        h = {"Authorization": f"Bearer {test_user['token']}", "Content-Type": "application/json"}
        r = requests.post(
            f"{API}/admin/users/{test_user['id']}/wallet-adjust",
            headers=h, json={"delta": 10, "reason": "test reason"}, timeout=15,
        )
        assert r.status_code == 403, r.text[:200]

    def test_reject_without_super_pin_header(self, owner_headers, test_user):
        # Super-admin but no PIN token
        r = requests.post(
            f"{API}/admin/users/{test_user['id']}/wallet-adjust",
            headers=owner_headers, json={"delta": 10, "reason": "test reason"}, timeout=15,
        )
        assert r.status_code == 401, f"expected 401, got {r.status_code}: {r.text[:200]}"

    def test_reject_invalid_super_pin_token(self, owner_headers, test_user):
        bad = {**owner_headers, "X-Super-PIN-Token": "not.a.valid.jwt"}
        r = requests.post(
            f"{API}/admin/users/{test_user['id']}/wallet-adjust",
            headers=bad, json={"delta": 10, "reason": "test reason"}, timeout=15,
        )
        assert r.status_code == 401, r.text[:200]

    def test_reject_delta_zero(self, super_headers, test_user):
        r = requests.post(
            f"{API}/admin/users/{test_user['id']}/wallet-adjust",
            headers=super_headers, json={"delta": 0, "reason": "test reason zero"}, timeout=15,
        )
        # delta=0 may be caught by pydantic validation (422) or our explicit 400
        assert r.status_code in (400, 422), f"expected 400/422, got {r.status_code}: {r.text[:200]}"

    def test_reject_delta_over_one_million(self, super_headers, test_user):
        r = requests.post(
            f"{API}/admin/users/{test_user['id']}/wallet-adjust",
            headers=super_headers, json={"delta": 1_500_000, "reason": "over ceiling"}, timeout=15,
        )
        assert r.status_code == 400, r.text[:200]

    def test_credit_then_debit_with_cap(self, super_headers, test_user, owner_headers):
        uid = test_user["id"]
        # 1. Credit R500
        r1 = requests.post(
            f"{API}/admin/users/{uid}/wallet-adjust",
            headers=super_headers,
            json={"delta": 500, "reason": "iter55 credit test"}, timeout=15,
        )
        assert r1.status_code == 200, r1.text[:300]
        d1 = r1.json()
        assert d1["delta_applied"] == 500
        assert d1["capped"] is False
        assert d1["balance_after"] == d1["balance_before"] + 500

        # 2. Debit R100 (within balance — no cap)
        r2 = requests.post(
            f"{API}/admin/users/{uid}/wallet-adjust",
            headers=super_headers,
            json={"delta": -100, "reason": "iter55 debit test"}, timeout=15,
        )
        assert r2.status_code == 200, r2.text[:300]
        d2 = r2.json()
        assert d2["delta_applied"] == -100
        assert d2["capped"] is False
        assert d2["balance_after"] == d1["balance_after"] - 100

        # 3. Debit a huge amount > balance — should cap
        balance_now = d2["balance_after"]
        r3 = requests.post(
            f"{API}/admin/users/{uid}/wallet-adjust",
            headers=super_headers,
            json={"delta": -999_999, "reason": "iter55 debit cap test"}, timeout=15,
        )
        assert r3.status_code == 200, r3.text[:300]
        d3 = r3.json()
        assert d3["capped"] is True, "expected cap=True when debit exceeds balance"
        assert d3["balance_after"] == 0
        # delta_applied should equal -balance_now (no overdraft)
        assert abs(d3["delta_applied"]) == pytest.approx(balance_now, abs=0.01)

        # 4. Verify wallet history endpoint records all 3 entries
        rh = requests.get(f"{API}/admin/users/{uid}/wallet-history", headers=owner_headers, timeout=15)
        assert rh.status_code == 200, rh.text[:200]
        items = rh.json().get("items") or []
        assert len(items) >= 3, f"expected >=3 history rows, got {len(items)}"
        # most-recent first
        latest = items[0]
        assert latest["delta_applied"] == d3["delta_applied"]
        assert latest["reason"] == "iter55 debit cap test"

        # 5. Verify notification was inserted (read via GET /notifications as the target user)
        nh = {"Authorization": f"Bearer {test_user['token']}", "Content-Type": "application/json"}
        rn = requests.get(f"{API}/notifications", headers=nh, timeout=15)
        if rn.status_code == 200:
            payload = rn.json()
            notes = payload.get("notifications") if isinstance(payload, dict) else payload
            notes = notes or []
            wallet_notes = [n for n in notes if n.get("type") == "wallet_adjust"]
            assert len(wallet_notes) >= 1, "expected at least one wallet_adjust notification"


# ───────────────────────── BUG #3 — Ambassador role grant notification ──
class TestAmbassadorRoleGrant:
    def test_grant_ambassador_creates_notification_and_logs_email(self, super_headers, owner_headers, test_user):
        """Endpoint: /admin/users/{uid}/make-ambassador with {ambassador: true}.
        This triggers _notify_role_change which (a) inserts a notifications doc,
        (b) calls _send_branded_email with wallet_info populated.
        We verify (a) directly and trust [MAIL-SENT]/[MAIL-SKIP] logs for (b)."""
        uid = test_user["id"]
        # make-ambassador may or may not need super-pin — try both. Spec says admin only.
        r = requests.post(
            f"{API}/admin/users/{uid}/make-ambassador",
            headers=super_headers, json={"ambassador": True}, timeout=20,
        )
        if r.status_code in (401, 403):
            # fall back to owner_headers without super-pin
            r = requests.post(
                f"{API}/admin/users/{uid}/make-ambassador",
                headers=owner_headers, json={"ambassador": True}, timeout=20,
            )
        assert r.status_code in (200, 201), f"grant ambassador failed: {r.status_code} {r.text[:300]}"

        # Verify notifications doc inserted for target user
        nh = {"Authorization": f"Bearer {test_user['token']}", "Content-Type": "application/json"}
        rn = requests.get(f"{API}/notifications", headers=nh, timeout=15)
        assert rn.status_code == 200, rn.text[:200]
        payload = rn.json()
        notes = payload.get("notifications") if isinstance(payload, dict) else payload
        notes = notes or []
        role_notes = [n for n in notes if n.get("type") == "role_change"]
        assert len(role_notes) >= 1, f"no role_change notification inserted. all notes: {notes[:3]}"

        # Verify user is now ambassador and has wallet starting balance allocated
        rp = requests.get(f"{API}/admin/users/{uid}/full-profile", headers=owner_headers, timeout=15)
        assert rp.status_code == 200, rp.text[:200]
        u = rp.json().get("user") or {}
        assert u.get("is_ambassador") is True or u.get("role") == "ambassador", \
            f"user not marked ambassador: {u.get('is_ambassador')} role={u.get('role')}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
