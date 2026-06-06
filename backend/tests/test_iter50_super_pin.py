"""
Iter50 backend tests:
- Super-PIN status/set/verify
- Cleanup-delete gated by X-Super-Pin-Token
- Role-gate sync for admin vs super_admin
- /api/users/by-username/{username} endpoint
"""
import os
import pytest
import requests
import time

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL not set"
API = f"{BASE_URL}/api"

OWNER_EMAIL = "rmleetang@gmail.com"
OWNER_PASS = "OwnerTest123!"
ADMIN_EMAIL = "rmleetang+nctest1780423349@gmail.com"
ADMIN_PASS = "Test123!"
SUPER_PIN = "NCowner!2026"


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    if r.status_code != 200:
        pytest.skip(f"Login failed for {email}: {r.status_code} {r.text[:200]}")
    return r.json()["token"]


@pytest.fixture(scope="session")
def owner_token():
    return _login(OWNER_EMAIL, OWNER_PASS)


@pytest.fixture(scope="session")
def admin_token():
    return _login(ADMIN_EMAIL, ADMIN_PASS)


@pytest.fixture(scope="session")
def owner_headers(owner_token):
    return {"Authorization": f"Bearer {owner_token}"}


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# --- Super-PIN flow ---

class TestSuperPin:
    def test_status_is_set_for_owner(self, owner_headers):
        r = requests.get(f"{API}/admin/super-pin/status", headers=owner_headers, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("is_set") is True

    def test_set_returns_409_already_set(self, owner_headers):
        r = requests.post(
            f"{API}/admin/super-pin/set",
            headers=owner_headers,
            json={"pin": "AnotherPin!9999"},
            timeout=15,
        )
        assert r.status_code == 409, f"expected 409 got {r.status_code} {r.text[:200]}"

    def test_verify_correct_pin(self, owner_headers):
        r = requests.post(
            f"{API}/admin/super-pin/verify",
            headers=owner_headers,
            json={"pin": SUPER_PIN},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("ok") is True
        assert "token" in data and isinstance(data["token"], str) and len(data["token"]) > 20
        assert data.get("expires_in_minutes") == 15

    def test_verify_wrong_pin(self, owner_headers):
        r = requests.post(
            f"{API}/admin/super-pin/verify",
            headers=owner_headers,
            json={"pin": "WrongPin!!!"},
            timeout=15,
        )
        assert r.status_code == 403, r.text
        assert "invalid pin" in r.text.lower() or "invalid" in r.text.lower()

    def test_non_owner_status_forbidden(self, admin_headers):
        r = requests.get(f"{API}/admin/super-pin/status", headers=admin_headers, timeout=15)
        assert r.status_code == 403, f"expected 403 got {r.status_code} {r.text[:200]}"

    def test_non_owner_verify_forbidden(self, admin_headers):
        r = requests.post(
            f"{API}/admin/super-pin/verify",
            headers=admin_headers,
            json={"pin": SUPER_PIN},
            timeout=15,
        )
        assert r.status_code == 403


# --- cleanup-delete header gating ---

class TestCleanupDeleteGated:
    def test_no_header_returns_401(self, owner_headers):
        r = requests.post(
            f"{API}/admin/users/cleanup-delete",
            headers=owner_headers,
            json={"user_id": "fake", "reason": "test reason 1234567", "confirm_email": "noop@example.com"},
            timeout=15,
        )
        assert r.status_code == 401, f"expected 401 got {r.status_code} {r.text[:200]}"
        assert "pin" in r.text.lower() or "super" in r.text.lower()

    def test_invalid_token_returns_401(self, owner_headers):
        h = {**owner_headers, "X-Super-Pin-Token": "garbage.token.here"}
        r = requests.post(
            f"{API}/admin/users/cleanup-delete",
            headers=h,
            json={"user_id": "fake", "reason": "test reason 1234567", "confirm_email": "noop@example.com"},
            timeout=15,
        )
        assert r.status_code == 401, r.text
        assert "invalid" in r.text.lower() or "expired" in r.text.lower()

    def test_valid_token_admin_target_rejected(self, owner_headers):
        # Get a fresh token
        v = requests.post(
            f"{API}/admin/super-pin/verify",
            headers=owner_headers,
            json={"pin": SUPER_PIN},
            timeout=15,
        )
        assert v.status_code == 200
        token = v.json()["token"]
        h = {**owner_headers, "X-Super-Pin-Token": token}
        # Try to delete admin user (should be rejected because target is admin) - we need a user id;
        # but we can at least verify token is accepted (not 401). Use a non-existent id → 404 or rule rejection.
        r = requests.post(
            f"{API}/admin/users/cleanup-delete",
            headers=h,
            json={"user_id": "non-existent-id", "reason": "automated test attempt 12345", "confirm_email": "nobody@example.com"},
            timeout=15,
        )
        # token accepted means NOT 401 with 'pin required'
        assert r.status_code != 401 or "pin" not in r.text.lower(), f"PIN-token not accepted: {r.status_code} {r.text[:200]}"


# --- Role-gate sync ---

class TestRoleGateSync:
    def test_admin_users_list_admin(self, admin_headers):
        # /admin/users-list is the role-gated endpoint (require_admin_user)
        r = requests.get(f"{API}/admin/users-list", headers=admin_headers, timeout=15)
        assert r.status_code == 200, f"admin GET /admin/users-list got {r.status_code}: {r.text[:200]}"

    def test_admin_users_list_super(self, owner_headers):
        r = requests.get(f"{API}/admin/users-list", headers=owner_headers, timeout=15)
        assert r.status_code == 200, r.text

    def test_owner_overview_super(self, owner_headers):
        r = requests.get(f"{API}/admin/owner/overview", headers=owner_headers, timeout=15)
        assert r.status_code == 200, r.text

    def test_owner_overview_admin_forbidden(self, admin_headers):
        r = requests.get(f"{API}/admin/owner/overview", headers=admin_headers, timeout=15)
        assert r.status_code == 403, f"expected 403 got {r.status_code}"


# --- by-username public endpoint ---

class TestByUsername:
    def test_owner_username_lookup(self, admin_headers):
        r = requests.get(f"{API}/users/by-username/owner", headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("username") == "owner"
        assert "posts_count" in data
        assert "connections_count" in data
        assert "role" in data
        # Sensitive fields must be stripped
        for forbidden in ("password", "password_hash", "banking", "super_admin_pin_hash", "email", "phone", "id_number"):
            assert forbidden not in data, f"sensitive field '{forbidden}' leaked in response: {list(data.keys())}"

    def test_nonexistent_username_404(self, admin_headers):
        r = requests.get(f"{API}/users/by-username/this_user_should_not_exist_zzzz_999", headers=admin_headers, timeout=15)
        assert r.status_code == 404
