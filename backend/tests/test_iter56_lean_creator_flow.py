"""Iter 56 — Lean independent-creator flow backend tests.

Covers BACKEND #1-4 from the iter 56 review request:
  • POST /products lean payload (publish=True vs publish=False, defaults, More Options).
  • GET /products/me/dashboard payload.
  • GET /storefront/{username} (public, drafts hidden, 404 path).
  • PUT /storefront/me customisation + reflection in storefront.
"""
import os
import time
import uuid
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://stokvel-plus.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


def _signup_and_complete():
    """Login as standing Super-Admin owner (rmleetang@gmail.com). Brevo is live —
    OTP no longer returned in response, so we use the standing verified account.
    Owner has username='owner', creator_type='independent' by default. Suitable
    for testing the lean-creator flow."""
    r = requests.post(f"{API}/auth/login", json={
        "email": "rmleetang@gmail.com", "password": "OwnerTest123!",
    }, timeout=20)
    assert r.status_code == 200, f"owner login failed: {r.status_code} {r.text}"
    body = r.json()
    return body["token"], body["user"]


@pytest.fixture(scope="module")
def user_ctx():
    token, me = _signup_and_complete()
    return {"token": token, "user": me,
            "headers": {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}}


# ────────────────────────────────────────────────────────────────────────────
# BACKEND #1 — lean POST /products
# ────────────────────────────────────────────────────────────────────────────
class TestLeanCreateProduct:
    def test_publish_true_produces_approved_with_defaults(self, user_ctx):
        payload = {
            "name": "Test Lean Product",
            "type": "product",
            "currency": "ZAR",
            "price_min": 150.0, "price_max": 150.0,
            "description": "Hello",
            "problem_solved": "Solves QA",
            "images": ["data:image/png;base64,iVBORw0KGgo="],
            "publish": True,
        }
        r = requests.post(f"{API}/products", json=payload, headers=user_ctx["headers"], timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        prod = body["product"]
        assert body["message"] == "Published"
        assert prod["status"] == "approved"
        # Defaults
        assert prod["estimated_cost"] == 150.0, "estimated_cost should fall back to price_min"
        assert prod["timeline"] == "now"
        assert prod["interest_level"] == "ready_to_launch"
        assert prod["currency"] == "ZAR"
        assert prod["slug"], "slug must be generated"
        assert prod["creator_username"], "creator_username must be denormalised"
        # GET to verify persistence
        gr = requests.get(f"{API}/products/{prod['id']}", timeout=15)
        assert gr.status_code == 200
        assert gr.json()["product"]["status"] == "approved"

    def test_publish_false_saves_as_draft(self, user_ctx):
        payload = {
            "name": "Test Draft",
            "type": "service",
            "currency": "ZAR",
            "price_min": 99.0,
            "description": "draft body",
            "publish": False,
        }
        r = requests.post(f"{API}/products", json=payload, headers=user_ctx["headers"], timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["message"] == "Saved as draft"
        assert body["product"]["status"] == "draft"

    def test_more_options_fields_persist(self, user_ctx):
        payload = {
            "name": "Test More Options",
            "type": "product",
            "currency": "ZAR",
            "price_min": 200.0,
            "description": "extras",
            "publish": True,
            "inventory_qty": 5,
            "shipping_options": [{"method": "courier", "cost": 50}],
            "refund_policy": "7-day refund",
            "variants": [{"size": "M", "color": "red"}],
            "delivery_options": ["pickup", "courier"],
            "contact_email": "seller@example.com",
            "contact_phone": "+27123456789",
            "availability": "available_in_days",
            "availability_days": 3,
        }
        r = requests.post(f"{API}/products", json=payload, headers=user_ctx["headers"], timeout=20)
        assert r.status_code == 200, r.text
        prod = r.json()["product"]
        for k, expected in [
            ("inventory_qty", 5),
            ("refund_policy", "7-day refund"),
            ("availability", "available_in_days"),
            ("availability_days", 3),
            ("contact_email", "seller@example.com"),
            ("contact_phone", "+27123456789"),
        ]:
            assert prod[k] == expected, f"{k} mismatch: {prod.get(k)} != {expected}"
        assert prod["shipping_options"] == [{"method": "courier", "cost": 50}]
        assert prod["variants"] == [{"size": "M", "color": "red"}]
        assert prod["delivery_options"] == ["pickup", "courier"]


# ────────────────────────────────────────────────────────────────────────────
# BACKEND #2 — /products/me/dashboard
# ────────────────────────────────────────────────────────────────────────────
class TestSellerDashboard:
    def test_dashboard_returns_all_required_fields(self, user_ctx):
        r = requests.get(f"{API}/products/me/dashboard", headers=user_ctx["headers"], timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ["wallet_balance", "total_sales", "sales_count", "active_orders",
                  "product_views", "followers_count", "product_count",
                  "draft_count", "store_name", "store_username", "recent_products"]:
            assert k in d, f"missing key {k}"
        assert isinstance(d["recent_products"], list)
        # store_name defaults to "<first_name>'s Store"
        assert d["store_name"].endswith("'s Store") or len(d["store_name"]) >= 2
        assert d["store_username"] == user_ctx["user"]["username"]

    def test_dashboard_requires_auth(self):
        r = requests.get(f"{API}/products/me/dashboard", timeout=15)
        assert r.status_code in (401, 403)


# ────────────────────────────────────────────────────────────────────────────
# BACKEND #3 — Public /storefront/{username}
# ────────────────────────────────────────────────────────────────────────────
class TestPublicStorefront:
    def test_storefront_is_public_no_auth_required(self, user_ctx):
        uname = user_ctx["user"]["username"]
        r = requests.get(f"{API}/storefront/{uname}", timeout=20)  # NO auth header
        assert r.status_code == 200, r.text
        body = r.json()
        assert "store" in body and "products" in body
        assert body["store"]["owner_username"].lower() == uname.lower()

    def test_storefront_hides_drafts_shows_approved(self, user_ctx):
        uname = user_ctx["user"]["username"]
        # Drop one fresh draft + one fresh published
        for pub, label in [(True, "PUB iter56 visible"), (False, "DRAFT iter56 hidden")]:
            requests.post(f"{API}/products", json={
                "name": label, "type": "product", "currency": "ZAR",
                "price_min": 10, "description": "x", "publish": pub,
            }, headers=user_ctx["headers"], timeout=15)
        r = requests.get(f"{API}/storefront/{uname}", timeout=20)
        assert r.status_code == 200
        names = [p["name"] for p in r.json()["products"]]
        assert any("PUB iter56 visible" in n for n in names), "published product must be visible"
        assert not any("DRAFT iter56 hidden" in n for n in names), "draft must be hidden in public storefront"

    def test_storefront_returns_404_for_unknown(self):
        r = requests.get(f"{API}/storefront/__no_such_user_{uuid.uuid4().hex[:8]}", timeout=15)
        assert r.status_code == 404


# ────────────────────────────────────────────────────────────────────────────
# BACKEND #4 — PUT /storefront/me
# ────────────────────────────────────────────────────────────────────────────
class TestCustomizeStorefront:
    def test_update_name_and_bio_reflects_in_storefront(self, user_ctx):
        new_name = "QA Custom Store"
        new_bio = "Hello from the QA harness."
        r = requests.put(f"{API}/storefront/me",
                         json={"name": new_name, "bio": new_bio},
                         headers=user_ctx["headers"], timeout=15)
        assert r.status_code == 200, r.text
        # Reflected in public storefront
        uname = user_ctx["user"]["username"]
        s = requests.get(f"{API}/storefront/{uname}", timeout=15).json()
        assert s["store"]["name"] == new_name, f"store name not reflected: {s['store']}"
        assert s["store"]["bio"] == new_bio

    def test_name_length_validation(self, user_ctx):
        r = requests.put(f"{API}/storefront/me",
                         json={"name": "A"},  # too short
                         headers=user_ctx["headers"], timeout=15)
        assert r.status_code == 400
        r = requests.put(f"{API}/storefront/me",
                         json={"name": "B" * 61},  # too long
                         headers=user_ctx["headers"], timeout=15)
        assert r.status_code == 400

    def test_bio_length_validation(self, user_ctx):
        r = requests.put(f"{API}/storefront/me",
                         json={"bio": "X" * 281},
                         headers=user_ctx["headers"], timeout=15)
        assert r.status_code == 400

    def test_requires_auth(self):
        r = requests.put(f"{API}/storefront/me", json={"name": "x"}, timeout=15)
        assert r.status_code in (401, 403)
