"""Commerce foundation API coverage.

Uses standing accounts from memory/test_credentials.md. PayFast is intentionally
not configured yet, so checkout must fail closed instead of returning mock data.
"""
import os
import uuid

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"
OWNER_EMAIL = "rmleetang@gmail.com"
OWNER_PASSWORD = "OwnerTest123!"
BUYER_EMAIL = "rmleetang+nctest1780423349@gmail.com"
BUYER_PASSWORD = "Test123!"


def _login(email, password):
    response = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=20)
    assert response.status_code == 200, response.text
    body = response.json()
    return body["user"], {"Authorization": f"Bearer {body['token']}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def users():
    if not BASE_URL:
        pytest.skip("REACT_APP_BACKEND_URL is not available")
    seller, seller_headers = _login(OWNER_EMAIL, OWNER_PASSWORD)
    buyer, buyer_headers = _login(BUYER_EMAIL, BUYER_PASSWORD)
    return seller, seller_headers, buyer, buyer_headers


@pytest.fixture(scope="module")
def product(users):
    seller, seller_headers, _, _ = users
    payload = {
        "name": f"Commerce Physical {uuid.uuid4().hex[:8]}",
        "type": "product",
        "fulfillment_type": "physical",
        "currency": "ZAR",
        "sale_price": 250.0,
        "price_min": 250.0,
        "price_max": 250.0,
        "inventory_qty": 5,
        "shipping_options": [{"id": "courier", "label": "Courier", "cost": 60}],
        "description": "Commerce order test listing",
        "publish": True,
    }
    response = requests.post(f"{API}/products", json=payload, headers=seller_headers, timeout=20)
    assert response.status_code == 200, response.text
    return response.json()["product"]


def test_public_config_is_canonical_payfast(users):
    response = requests.get(f"{API}/commerce/config", timeout=20)
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["payment_provider"] == "payfast"
    assert data["currency"] == "ZAR"
    assert data["marketplace_fee_percent"] == 5.0
    assert data["seller_payout_mode"] == "automatic_split"
    assert data["fulfillment_types"] == ["digital", "physical", "service"]
    assert data["payment"]["configured"] is False


def test_admin_can_update_and_restore_fee(users):
    _, seller_headers, _, _ = users
    changed = requests.put(
        f"{API}/commerce/admin/config",
        json={"marketplace_fee_percent": 6.25},
        headers=seller_headers,
        timeout=20,
    )
    assert changed.status_code == 200, changed.text
    assert changed.json()["marketplace_fee_percent"] == 6.25
    restored = requests.put(
        f"{API}/commerce/admin/config",
        json={"marketplace_fee_percent": 5},
        headers=seller_headers,
        timeout=20,
    )
    assert restored.status_code == 200, restored.text


def test_cart_rejects_own_listing(users, product):
    _, seller_headers, _, _ = users
    response = requests.post(
        f"{API}/commerce/cart/items",
        json={"product_id": product["id"], "quantity": 1, "shipping_option": "courier"},
        headers=seller_headers,
        timeout=20,
    )
    assert response.status_code == 400


def test_cart_and_seller_split_order(users, product):
    _, _, buyer, buyer_headers = users
    requests.delete(f"{API}/commerce/cart", headers=buyer_headers, timeout=20)
    added = requests.post(
        f"{API}/commerce/cart/items",
        json={"product_id": product["id"], "quantity": 2, "shipping_option": "courier"},
        headers=buyer_headers,
        timeout=20,
    )
    assert added.status_code == 200, added.text
    cart = added.json()
    assert cart["item_count"] == 2
    assert cart["subtotal_cents"] == 50000
    assert cart["shipping_cents"] == 6000
    assert cart["total_cents"] == 56000

    key = f"commerce-{uuid.uuid4()}"
    created = requests.post(
        f"{API}/commerce/orders",
        json={
            "idempotency_key": key,
            "shipping_address": {
                "recipient_name": buyer.get("full_name") or buyer.get("username"),
                "line1": "1 Test Street",
                "city": "Johannesburg",
                "province": "Gauteng",
                "postal_code": "2000",
                "country": "ZA",
            },
        },
        headers=buyer_headers,
        timeout=20,
    )
    assert created.status_code == 200, created.text
    body = created.json()
    assert len(body["orders"]) == 1
    order = body["orders"][0]
    assert order["payment_provider"] == "payfast"
    assert order["platform_fee_bps"] == 500
    assert order["platform_fee_cents"] == 2500
    assert order["status"] == "awaiting_payment"
    assert order["payment_ready"] is False

    replay = requests.post(
        f"{API}/commerce/orders",
        json={"idempotency_key": key, "shipping_address": order["shipping_address"]},
        headers=buyer_headers,
        timeout=20,
    )
    assert replay.status_code == 200, replay.text
    assert replay.json()["idempotent_replay"] is True
    assert replay.json()["orders"][0]["id"] == order["id"]

    checkout = requests.post(
        f"{API}/commerce/orders/{order['id']}/checkout",
        json={"origin_url": "https://networkcapitalapp.co.za"},
        headers=buyer_headers,
        timeout=20,
    )
    assert checkout.status_code == 503
    assert "missing_configuration" in checkout.text

    seller_orders = requests.get(f"{API}/commerce/seller/orders", headers=users[1], timeout=20)
    assert seller_orders.status_code == 200
    assert any(row["id"] == order["id"] for row in seller_orders.json()["orders"])

    cancelled = requests.post(f"{API}/commerce/orders/{order['id']}/cancel", headers=buyer_headers, timeout=20)
    assert cancelled.status_code == 200, cancelled.text
    assert cancelled.json()["order"]["status"] == "cancelled"
