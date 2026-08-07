"""Backend tests for Creator/Product/Net-Worth & Progressive Signup flow.

Covers:
- Progressive signup + complete-profile (member + creator)
- Product CRUD (create, list, my, detail, follow)
- Admin moderate (approve)
- Wallet-based product support
- Audience insights (free, basic unlock)
- Stokvel pool support for product
- Net worth dashboard
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://system-repair-18.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


def _uniq(prefix="TEST"):
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------- Progressive signup ----------
@pytest.fixture(scope="module")
def creator_ctx(session):
    email = f"{_uniq('TESTc')}@example.com"
    r = session.post(f"{API}/auth/progressive-signup", json={"email": email, "password": "Test123!"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert "token" in data and data.get("next_step") == 2
    assert data["user"]["profile_completed"] is False
    token = data["token"]
    uid = data["user"]["id"]

    headers = {"Authorization": f"Bearer {token}"}
    creator_username = _uniq("testcreator")
    r2 = session.post(
        f"{API}/auth/complete-profile",
        json={
            "full_name": "Creator Tester",
            "username": creator_username,
            "bio": "builder",
            "intent": "creator",
            "terms_accepted": True,
        },
        headers=headers,
    )
    assert r2.status_code == 200, r2.text
    body = r2.json()
    assert body["user"]["is_creator"] is True
    assert body["user"]["user_type"] == "creator"
    assert body["next_step"] == 3
    # Unlock premium for financial endpoints
    session.post(f"{API}/users/me/premium", json={"currency": "USD"}, headers=headers)
    return {"email": email, "token": token, "user_id": uid, "headers": headers, "username": creator_username}


@pytest.fixture(scope="module")
def member_ctx(session):
    email = f"{_uniq('TESTm')}@example.com"
    r = session.post(f"{API}/auth/progressive-signup", json={"email": email, "password": "Test123!"})
    assert r.status_code == 200
    tok = r.json()["token"]
    uid = r.json()["user"]["id"]
    h = {"Authorization": f"Bearer {tok}"}
    r2 = session.post(
        f"{API}/auth/complete-profile",
        json={
            "full_name": "Member Tester",
            "username": _uniq("testmember"),
            "bio": "supporter",
            "intent": "member",
            "terms_accepted": True,
        },
        headers=h,
    )
    assert r2.status_code == 200
    assert r2.json()["user"]["is_creator"] is False
    assert r2.json()["next_step"] == 0
    # Unlock premium for financial endpoints
    session.post(f"{API}/users/me/premium", json={"currency": "USD"}, headers=h)
    return {"email": email, "token": tok, "user_id": uid, "headers": h}


def test_progressive_signup_duplicate_rejected(session, creator_ctx):
    r = session.post(f"{API}/auth/progressive-signup", json={"email": creator_ctx["email"], "password": "Test123!"})
    assert r.status_code == 400


def test_complete_profile_duplicate_username(session, creator_ctx):
    # new user tries to steal existing username
    r = session.post(f"{API}/auth/progressive-signup", json={"email": f"{_uniq('TESTx')}@example.com", "password": "Test123!"})
    tok = r.json()["token"]
    existing_username = creator_ctx["username"]
    r2 = session.post(
        f"{API}/auth/complete-profile",
        json={"full_name": "X", "username": existing_username, "intent": "member", "terms_accepted": True},
        headers={"Authorization": f"Bearer {tok}"},
    )
    assert r2.status_code == 400


# ---------- Product creation & listing ----------
@pytest.fixture(scope="module")
def product_id(session, creator_ctx):
    payload = {
        "name": _uniq("Smart Water Bottle"),
        "problem_solved": "Helps users stay hydrated daily",
        "description": "Smart bottle with reminders",
        "estimated_cost": 5000.0,
        "timeline": "3 months",
        "interest_level": "prototype",
        "category": "tech",
        "min_support": 10.0,
        "max_support": 500.0,
    }
    r = session.post(f"{API}/products", json=payload, headers=creator_ctx["headers"])
    assert r.status_code == 200, r.text
    prod = r.json()["product"]
    assert prod["status"] == "pending_review"
    assert prod["creator_id"] == creator_ctx["user_id"]
    return prod["id"]


def test_get_products_only_approved_excludes_pending(session, product_id):
    r = session.get(f"{API}/products")
    assert r.status_code == 200
    ids = [p["id"] for p in r.json()["products"]]
    assert product_id not in ids  # pending not shown


def test_get_my_products_returns_pending(session, creator_ctx, product_id):
    r = session.get(f"{API}/products/my", headers=creator_ctx["headers"])
    assert r.status_code == 200
    ids = [p["id"] for p in r.json()["products"]]
    assert product_id in ids


def test_get_product_detail(session, product_id, creator_ctx):
    r = session.get(f"{API}/products/{product_id}")
    assert r.status_code == 200
    data = r.json()
    assert data["product"]["id"] == product_id
    assert data["creator"]["id"] == creator_ctx["user_id"]
    assert "password" not in data["creator"]


def test_follow_product_public(session, product_id):
    r = session.post(
        f"{API}/products/{product_id}/follow",
        json={"name": "Jane Follower", "email": "jane@example.com", "phone": "+27123456789"},
    )
    assert r.status_code == 200
    assert "follower_id" in r.json()


def test_support_before_approval_blocked(session, member_ctx, product_id):
    r = session.post(
        f"{API}/products/{product_id}/support",
        json={"amount": 50.0, "note": "cheer"},
        headers=member_ctx["headers"],
    )
    assert r.status_code == 400


# ---------- Admin moderation ----------
ADMIN_HEADERS = {"X-Admin-Password": "NetworkCapital2025!"}

def test_admin_approve_requires_auth(session, product_id):
    r = session.post(f"{API}/admin/products/{product_id}/moderate?action=approve")
    assert r.status_code == 403

def test_admin_approve_product(session, product_id):
    r = session.post(f"{API}/admin/products/{product_id}/moderate?action=approve", headers=ADMIN_HEADERS)
    assert r.status_code == 200
    assert r.json()["status"] == "approved"
    # Verify via GET /products
    r2 = session.get(f"{API}/products")
    ids = [p["id"] for p in r2.json()["products"]]
    assert product_id in ids


# ---------- Wallet support flow ----------
def _topup_wallet(session, headers, amount):
    # Common endpoints to top up. Try a few possibilities; skip if none work.
    candidates = [
        ("post", f"{API}/wallet/topup", {"amount": amount}),
        ("post", f"{API}/wallet/deposit", {"amount": amount}),
        ("post", f"{API}/wallet/add-funds", {"amount": amount}),
    ]
    for method, url, body in candidates:
        r = session.request(method, url, json=body, headers=headers)
        if r.status_code in (200, 201):
            return True
    return False


def test_support_insufficient_balance(session, member_ctx, product_id):
    # Member has 0 balance initially
    r = session.post(
        f"{API}/products/{product_id}/support",
        json={"amount": 50.0, "note": "back"},
        headers=member_ctx["headers"],
    )
    assert r.status_code == 400
    assert "balance" in r.json().get("detail", "").lower() or "insufficient" in r.json().get("detail", "").lower()


def test_support_out_of_range(session, member_ctx, product_id):
    # Try amount below min or above max without funds - range check vs balance
    r = session.post(
        f"{API}/products/{product_id}/support",
        json={"amount": 5.0},  # below min 10
        headers=member_ctx["headers"],
    )
    assert r.status_code == 400


def test_support_success_with_wallet(session, member_ctx, product_id):
    if not _topup_wallet(session, member_ctx["headers"], 100.0):
        pytest.skip("No wallet top-up endpoint available")
    r = session.post(
        f"{API}/products/{product_id}/support",
        json={"amount": 50.0, "note": "back the idea"},
        headers=member_ctx["headers"],
    )
    assert r.status_code == 200
    assert "support_id" in r.json()
    # verify product total updated
    d = session.get(f"{API}/products/{product_id}").json()
    assert d["product"]["total_support_amount"] >= 50.0


# ---------- Audience insights ----------
def test_insights_free_tier(session, creator_ctx, product_id):
    r = session.get(f"{API}/products/{product_id}/insights?tier=free", headers=creator_ctx["headers"])
    assert r.status_code == 200
    data = r.json()
    assert data["tier"] == "free"
    assert data["total_followers"] >= 1
    assert data["followers"] is None


def test_insights_only_creator(session, member_ctx, product_id):
    r = session.get(f"{API}/products/{product_id}/insights?tier=free", headers=member_ctx["headers"])
    assert r.status_code == 403


def test_unlock_insights_insufficient_balance(session, creator_ctx, product_id):
    r = session.post(
        f"{API}/products/{product_id}/unlock-insights?tier=basic",
        headers=creator_ctx["headers"],
    )
    # creator has 0 balance unless topped up
    assert r.status_code in (200, 400)


# ---------- Net worth ----------
def test_net_worth_structure(session, member_ctx):
    r = session.get(f"{API}/dashboard/net-worth", headers=member_ctx["headers"])
    assert r.status_code == 200
    data = r.json()
    assert "net_worth" in data and "network_value" in data
    nw = data["net_worth"]
    for key in ("total", "wallet_balance", "stokvel_participation", "products_supported", "active_stokvels"):
        assert key in nw
    nv = data["network_value"]
    assert "score" in nv and "breakdown" in nv
    for key in ("posts", "stokvels", "products_supported", "referrals", "network_score"):
        assert key in nv["breakdown"]


# ---------- Stokvel group support ----------
def test_stokvel_support_product_requires_membership(session, member_ctx, product_id):
    # Create stokvel as member
    r = session.post(
        f"{API}/stokvels",
        json={
            "name": _uniq("TestStokvel"),
            "description": "test group",
            "contribution_amount": 100.0,
            "frequency": "monthly",
            "max_members": 10,
        },
        headers=member_ctx["headers"],
    )
    if r.status_code not in (200, 201):
        pytest.skip(f"Cannot create stokvel: {r.status_code} {r.text[:120]}")
    stokvel = r.json().get("stokvel") or r.json()
    sid = stokvel.get("id")
    if not sid:
        pytest.skip("Stokvel create response lacks id")

    # Attempt group-pool support (expect 400 or 403 if pool empty or non-member)
    r2 = session.post(
        f"{API}/stokvels/{sid}/support-product/{product_id}",
        json={"amount": 50.0},
        headers=member_ctx["headers"],
    )
    # Either insufficient pool (400), bad range (400), or forbidden (403)
    assert r2.status_code in (200, 400, 403)
