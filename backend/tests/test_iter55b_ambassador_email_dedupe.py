"""Iter 55b — Ambassador welcome email de-duplication

Code under review (since iter 55):
  • server.py:7499  _allocate_ambassador_balance — email send block REMOVED.
                    The old "Welcome to the Network Capital Ambassador Program" mail
                    must NO LONGER fire.
  • server.py:6405  _role_change_html — now also injects How-to-earn +
                    Withdrawal-rules sections when granted+ambassador+wallet_info.
  • server.py:10605 admin_make_ambassador — _notify_role_change is the SOLE
                    email path, fired only when prev_was_ambassador != is_amb.

Tests cover:
  (1) HTML body of _role_change_html (direct import — pure function)
      — must contain R 8,500.00, "Your ambassador wallet", "How to earn",
        "Withdrawal rules", "10 qualifying direct referrals".
  (2) End-to-end make-ambassador grant fires EXACTLY ONE [MAIL-SENT]
      event, subject = "Welcome to the Network Capital Ambassador programme",
      and ZERO of the older "Welcome to the Network Capital Ambassador Program".
  (3) Idempotent grant — calling make-ambassador with {ambassador:true} on a
      user who is already an ambassador does NOT fire another email.
"""
import os
import sys
import time
import re
import uuid
import pytest
import requests

# Allow importing backend.server (for HTML body unit test)
sys.path.insert(0, "/app/backend")

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
BACKEND_LOG = "/var/log/supervisor/backend.err.log"

OWNER_EMAIL = "rmleetang@gmail.com"
OWNER_PASS  = "OwnerTest123!"
SUPER_PIN   = "NCowner!2026"

OLD_SUBJ = "Welcome to the Network Capital Ambassador Program"     # deprecated
NEW_SUBJ = "Welcome to the Network Capital Ambassador programme"   # iter 55+


# ───────────────────────── fixtures ──────────────────────────────────────
@pytest.fixture(scope="module")
def owner_token():
    r = requests.post(f"{API}/auth/login",
                      json={"email": OWNER_EMAIL, "password": OWNER_PASS}, timeout=20)
    assert r.status_code == 200, f"Owner login failed: {r.status_code} {r.text[:200]}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def owner_headers(owner_token):
    return {"Authorization": f"Bearer {owner_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def super_pin_token(owner_headers):
    r = requests.post(f"{API}/admin/super-pin/verify",
                      headers=owner_headers, json={"pin": SUPER_PIN}, timeout=15)
    assert r.status_code == 200, r.text[:300]
    return r.json().get("token") or r.json().get("super_pin_token")


@pytest.fixture(scope="module")
def super_headers(owner_headers, super_pin_token):
    return {**owner_headers, "X-Super-PIN-Token": super_pin_token}


def _make_fresh_user():
    """Sign up + OTP-verify + complete profile so user is fully usable."""
    email = f"test_iter55b_{int(time.time()*1000)}_{uuid.uuid4().hex[:6]}@example.com"
    pw = "Test123!"
    r = requests.post(f"{API}/auth/progressive-signup",
                      json={"email": email, "password": pw, "step": 1}, timeout=20)
    assert r.status_code in (200, 201), r.text[:200]
    tok = r.json()["token"]
    h = {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}
    me = requests.get(f"{API}/users/me", headers=h, timeout=15)
    assert me.status_code == 200, me.text[:200]
    return {"id": me.json()["id"], "email": email, "token": tok}


@pytest.fixture
def fresh_user():
    return _make_fresh_user()


# ──────────── (1) HTML body unit test — direct import ────────────────────
class TestRoleChangeHtmlBody:
    def test_ambassador_grant_html_contains_required_sections(self):
        # Import lazily so missing env doesn't break module-collection
        from server import _role_change_html  # noqa: WPS433

        html = _role_change_html(
            name="Test User",
            previous_role="user",
            new_role="ambassador",
            granted=True,
            wallet_info={"starting_balance_zar": 8500.0, "available_zar": 8500.0},
        )
        # (a) Starting balance figure formatted as 'R 8,500.00'
        assert "R 8,500.00" in html, "starting balance R 8,500.00 missing from HTML"
        # (b) Wallet phrase
        assert "Your ambassador wallet" in html, "'Your ambassador wallet' missing"
        # (c) How to earn section
        assert "How to earn" in html, "'How to earn' section missing"
        # (d) Withdrawal rules section + 10 referrals copy
        assert "Withdrawal rules" in html, "'Withdrawal rules' section missing"
        assert "10 qualifying direct referrals" in html, \
            "'10 qualifying direct referrals' copy missing"

    def test_non_ambassador_grant_skips_wallet_block(self):
        from server import _role_change_html
        html = _role_change_html(
            name="Admin User", previous_role="user", new_role="admin",
            granted=True, wallet_info=None,
        )
        assert "Your ambassador wallet" not in html
        assert "Withdrawal rules" not in html

    def test_ambassador_grant_without_wallet_info_no_wallet_block(self):
        """Defensive: if wallet_info is None (e.g. config disabled), we should NOT
        inject the wallet block — guards against R 0.00 sneaking into the email."""
        from server import _role_change_html
        html = _role_change_html(
            name="X", previous_role="user", new_role="ambassador",
            granted=True, wallet_info=None,
        )
        assert "Your ambassador wallet" not in html


# ──────────── log-tail helpers for mail-event introspection ──────────────
def _log_offset() -> int:
    try:
        return os.path.getsize(BACKEND_LOG)
    except OSError:
        return 0


def _read_log_since(offset: int) -> str:
    try:
        with open(BACKEND_LOG, "rb") as f:
            f.seek(offset)
            return f.read().decode(errors="ignore")
    except OSError:
        return ""


def _mail_events_for(log_chunk: str, email: str):
    """Return list of subjects from [MAIL-SENT] lines that mention this email."""
    subs = []
    for line in log_chunk.splitlines():
        if "[MAIL-SENT]" in line and email in line:
            m = re.search(r"subj='([^']+)'", line)
            if m:
                subs.append(m.group(1))
    return subs


# ──────────── (2) End-to-end de-duplication test ─────────────────────────
class TestAmbassadorGrantEmailDedupe:
    def test_grant_fires_exactly_one_email_with_new_subject(
        self, owner_headers, super_headers, fresh_user,
    ):
        uid = fresh_user["id"]
        email = fresh_user["email"]

        # Snapshot log offset BEFORE the grant
        offset_before = _log_offset()

        # Make ambassador (try super-pin first; fall back to owner-only auth)
        r = requests.post(f"{API}/admin/users/{uid}/make-ambassador",
                          headers=super_headers, json={"ambassador": True}, timeout=20)
        if r.status_code in (401, 403):
            r = requests.post(f"{API}/admin/users/{uid}/make-ambassador",
                              headers=owner_headers, json={"ambassador": True}, timeout=20)
        assert r.status_code in (200, 201), f"grant failed: {r.status_code} {r.text[:300]}"
        assert r.json().get("is_ambassador") is True

        # Brevo send is async; wait for the log line to flush
        time.sleep(4.0)
        chunk = _read_log_since(offset_before)
        subjects = _mail_events_for(chunk, email)

        # Diagnostic dump on failure
        diagnostic = f"\nUser email: {email}\nLog chunk snippet:\n{chunk[-2000:]}"

        # (a) No legacy 'Program' email
        assert OLD_SUBJ not in subjects, (
            f"Legacy duplicate email STILL firing! Found subjects: {subjects}{diagnostic}"
        )
        # (b) Exactly one new 'programme' email
        new_hits = [s for s in subjects if s == NEW_SUBJ]
        assert len(new_hits) == 1, (
            f"Expected exactly 1 '{NEW_SUBJ}' email, got {len(new_hits)}. "
            f"All subjects for {email}: {subjects}{diagnostic}"
        )

    def test_repeat_grant_is_idempotent_no_extra_email(
        self, owner_headers, super_headers, fresh_user,
    ):
        """Granting ambassador twice in a row — second call must not fire email."""
        uid = fresh_user["id"]
        email = fresh_user["email"]

        # 1st grant
        def _grant():
            r = requests.post(f"{API}/admin/users/{uid}/make-ambassador",
                              headers=super_headers,
                              json={"ambassador": True}, timeout=20)
            if r.status_code in (401, 403):
                r = requests.post(f"{API}/admin/users/{uid}/make-ambassador",
                                  headers=owner_headers,
                                  json={"ambassador": True}, timeout=20)
            return r

        r1 = _grant()
        assert r1.status_code in (200, 201), r1.text[:300]
        time.sleep(3.0)

        # Snapshot AFTER the first grant, then call again
        offset_mid = _log_offset()
        r2 = _grant()
        assert r2.status_code in (200, 201), r2.text[:300]
        time.sleep(3.0)

        chunk = _read_log_since(offset_mid)
        subjects = _mail_events_for(chunk, email)
        # No welcome emails (neither old nor new) should have been fired on the
        # 2nd grant since prev_was_ambassador == is_amb (guard at server.py:10605)
        assert NEW_SUBJ not in subjects, (
            f"Idempotency guard FAILED — duplicate '{NEW_SUBJ}' fired on repeat grant. "
            f"Subjects: {subjects}\nLog tail:\n{chunk[-1500:]}"
        )
        assert OLD_SUBJ not in subjects, (
            f"Legacy email fired on repeat grant: {subjects}\nLog tail:\n{chunk[-1500:]}"
        )


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
