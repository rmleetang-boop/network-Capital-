"""iter47 — Forgot/Reset password + lockout + admin unlock E2E tests."""
import os
import time
import requests

API = (os.environ.get("REACT_APP_BACKEND_URL") or "https://system-repair-18.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "rmleetang+nctest1780423349@gmail.com"
ADMIN_PASSWORD = "Test123!"


def _signup(email, password="Test123!"):
    r = requests.post(f"{API}/api/auth/progressive-signup", json={"email": email, "password": password, "step": 1})
    assert r.status_code == 200, r.text
    return r.json()


def _login(email, password):
    return requests.post(f"{API}/api/auth/login", json={"email": email, "password": password})


def _admin_token():
    r = _login(ADMIN_EMAIL, ADMIN_PASSWORD)
    assert r.status_code == 200, r.text
    return r.json()["token"]


def test_forgot_password_returns_generic_ok_for_unknown_email():
    r = requests.post(f"{API}/api/auth/forgot-password", json={"email": "ghost@example.com"})
    assert r.status_code == 200
    assert r.json()["ok"] is True


def test_forgot_password_returns_generic_ok_for_known_email():
    email = f"pwgood+{int(time.time())}@gmail.com"
    _signup(email)
    r = requests.post(f"{API}/api/auth/forgot-password", json={"email": email})
    assert r.status_code == 200
    assert r.json()["ok"] is True


def test_reset_password_with_bad_token_returns_400():
    r = requests.post(f"{API}/api/auth/reset-password", json={
        "token": "definitely-not-a-real-token",
        "new_password": "GoodPass123",
    })
    assert r.status_code == 400


def test_password_strength_policy_rejects_weak():
    r = requests.post(f"{API}/api/auth/reset-password", json={
        "token": "x" * 32,
        "new_password": "short",
    })
    assert r.status_code == 400
    assert "8 chars" in r.json()["detail"]


def test_lockout_after_5_requests_in_7_days_and_admin_can_unlock():
    email = f"pwlock+{int(time.time())}@gmail.com"
    _signup(email)
    # 5 requests should trip the lock on the 5th
    for _ in range(5):
        r = requests.post(f"{API}/api/auth/forgot-password", json={"email": email})
        assert r.status_code == 200
    # Login must now 423
    r = _login(email, "Test123!")
    assert r.status_code == 423, r.text

    # Admin lists locked accounts and sees this email
    admin_tk = _admin_token()
    r = requests.get(f"{API}/api/admin/locked-accounts", headers={"Authorization": f"Bearer {admin_tk}"})
    assert r.status_code == 200
    locked_emails = [u["email"] for u in r.json()["users"]]
    assert email in locked_emails

    # Get user id
    user_id = next(u["id"] for u in r.json()["users"] if u["email"] == email)
    # Unlock
    r = requests.post(
        f"{API}/api/admin/users/{user_id}/unlock-password-reset",
        headers={"Authorization": f"Bearer {admin_tk}"},
        json={"reason": "QA-pytest auto-unlock"},
    )
    assert r.status_code == 200
    assert r.json()["ok"] is True

    # Login should now succeed
    r = _login(email, "Test123!")
    assert r.status_code == 200, r.text


def test_locked_accounts_endpoint_requires_admin():
    # Sign up a regular user
    email = f"pwregular+{int(time.time())}@gmail.com"
    su = _signup(email)
    tk = su["token"]
    r = requests.get(f"{API}/api/admin/locked-accounts", headers={"Authorization": f"Bearer {tk}"})
    assert r.status_code == 403
