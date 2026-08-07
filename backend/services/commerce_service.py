"""Marketplace commerce foundation for Network Capital.

PayFast is the canonical marketplace payment provider. This module intentionally
keeps checkout unavailable until real platform credentials and Split Payments
approval are present; no payment response is mocked.
"""
from __future__ import annotations

from collections import OrderedDict, defaultdict
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from hashlib import md5
import hmac
import json
import os
import re
from typing import Any, Callable, Dict, List, Optional
from urllib.parse import quote_plus, urlencode, urlparse
import uuid

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field


COMMERCE_POLICY_ID = "commerce_policy"
DEFAULT_COMMERCE_POLICY = {
    "id": COMMERCE_POLICY_ID,
    "payment_provider": "payfast",
    "currency": "ZAR",
    "marketplace_fee_bps": 500,
    "seller_payout_mode": "automatic_split",
    "multi_seller_checkout": "split_orders",
}
PAYFAST_REQUIRED_ENV = (
    "PAYFAST_MERCHANT_ID",
    "PAYFAST_MERCHANT_KEY",
    "PAYFAST_PASSPHRASE",
)
PAYFAST_ACTIONS = {
    "sandbox": "https://sandbox.payfast.co.za/eng/process",
    "live": "https://www.payfast.co.za/eng/process",
}
PAYFAST_VALIDATE_URLS = {
    "sandbox": "https://sandbox.payfast.co.za/eng/query/validate",
    "live": "https://www.payfast.co.za/eng/query/validate",
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _money_to_cents(value: Any) -> int:
    try:
        amount = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid monetary amount.")
    if not amount.is_finite():
        raise HTTPException(status_code=400, detail="Invalid monetary amount.")
    return int((amount * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def _cents_to_amount(value: int) -> float:
    return float((Decimal(int(value)) / Decimal(100)).quantize(Decimal("0.01")))


def _payment_readiness() -> Dict[str, Any]:
    missing = [name for name in PAYFAST_REQUIRED_ENV if not os.environ.get(name)]
    split_enabled = os.environ.get("PAYFAST_SPLIT_ENABLED", "").strip().lower() in {
        "1", "true", "yes", "on",
    }
    if not split_enabled:
        missing.append("PAYFAST_SPLIT_ENABLED")
    return {
        "provider": "payfast",
        "configured": not missing,
        "split_payments_enabled": split_enabled,
        "missing_configuration": missing,
        "message": (
            "PayFast marketplace checkout is ready."
            if not missing
            else "PayFast checkout will be enabled after merchant credentials and Split Payments approval are configured."
        ),
    }


def _fulfillment_type(product: Dict[str, Any]) -> str:
    explicit = (product.get("fulfillment_type") or "").strip().lower()
    if explicit in {"digital", "physical", "service"}:
        return explicit
    if (product.get("type") or "product").strip().lower() == "service":
        return "service"
    if product.get("file_url"):
        return "digital"
    return "physical"


def _unit_price_cents(product: Dict[str, Any], variant_key: Optional[str] = None) -> int:
    variant_price = None
    if variant_key:
        for variant in product.get("variants") or []:
            candidate = str(
                variant.get("id") or variant.get("sku") or variant.get("name") or ""
            ).strip()
            if candidate == variant_key:
                variant_price = variant.get("price")
                break
        if variant_price is None:
            raise HTTPException(status_code=400, detail="Selected product variant is unavailable.")

    fulfillment = _fulfillment_type(product)
    raw_price = variant_price
    if raw_price is None:
        raw_price = product.get("sale_price")
    if raw_price is None and fulfillment == "digital" and product.get("file_access") == "paid":
        raw_price = product.get("file_price")
    if raw_price is None:
        raw_price = product.get("price_min")
    cents = _money_to_cents(raw_price or 0)
    if cents <= 0:
        raise HTTPException(
            status_code=422,
            detail="This listing needs an exact sale price before it can be purchased.",
        )
    return cents


def _shipping_snapshot(product: Dict[str, Any], selected: Optional[str]) -> Dict[str, Any]:
    if _fulfillment_type(product) != "physical":
        return {"key": None, "label": None, "cost_cents": 0}
    options = product.get("shipping_options") or []
    if not options:
        return {"key": "seller_arranged", "label": "Delivery arranged with seller", "cost_cents": 0}
    if not selected:
        raise HTTPException(status_code=400, detail=f"Choose a shipping option for {product.get('name', 'this product')}.")
    for option in options:
        key = str(option.get("id") or option.get("method") or option.get("name") or "").strip()
        if key == selected:
            return {
                "key": key,
                "label": option.get("label") or option.get("name") or option.get("method") or key,
                "cost_cents": max(0, _money_to_cents(option.get("cost") or 0)),
            }
    raise HTTPException(status_code=400, detail="Selected shipping option is unavailable.")


def _payfast_signature(data: OrderedDict[str, Any], passphrase: str) -> str:
    pairs = [
        f"{key}={quote_plus(str(value).strip())}"
        for key, value in data.items()
        if str(value).strip() != "" and key != "setup"
    ]
    pairs.append(f"passphrase={quote_plus(passphrase.strip())}")
    return md5("&".join(pairs).encode()).hexdigest()


def _validated_origin(raw: str) -> str:
    value = (raw or "").strip().rstrip("/")
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise HTTPException(status_code=400, detail="A valid checkout origin URL is required.")
    return value


class CommercePolicyUpdate(BaseModel):
    marketplace_fee_percent: Decimal = Field(ge=0, le=30)


class SellerPaymentProfileIn(BaseModel):
    payfast_merchant_id: str = Field(min_length=5, max_length=32)


class SellerPaymentStatusIn(BaseModel):
    status: str
    note: Optional[str] = Field(default=None, max_length=500)


class CartItemIn(BaseModel):
    product_id: str
    quantity: int = Field(default=1, ge=1, le=99)
    variant_key: Optional[str] = Field(default=None, max_length=120)
    shipping_option: Optional[str] = Field(default=None, max_length=120)


class CartItemUpdate(BaseModel):
    quantity: int = Field(ge=1, le=99)


class ShippingAddress(BaseModel):
    recipient_name: str = Field(min_length=2, max_length=120)
    line1: str = Field(min_length=3, max_length=180)
    line2: Optional[str] = Field(default=None, max_length=180)
    city: str = Field(min_length=2, max_length=120)
    province: Optional[str] = Field(default=None, max_length=120)
    postal_code: str = Field(min_length=2, max_length=20)
    country: str = Field(default="ZA", min_length=2, max_length=2)
    phone: Optional[str] = Field(default=None, max_length=30)


class CreateOrdersIn(BaseModel):
    idempotency_key: str = Field(min_length=8, max_length=128)
    shipping_address: Optional[ShippingAddress] = None
    service_notes: Optional[str] = Field(default=None, max_length=2000)


class CheckoutStartIn(BaseModel):
    origin_url: str


class FulfillmentUpdateIn(BaseModel):
    status: str
    tracking_number: Optional[str] = Field(default=None, max_length=120)
    note: Optional[str] = Field(default=None, max_length=1000)


async def _get_policy(db: Any) -> Dict[str, Any]:
    stored = await db.platform_settings.find_one({"id": COMMERCE_POLICY_ID}, {"_id": 0})
    policy = {**DEFAULT_COMMERCE_POLICY, **(stored or {})}
    policy["marketplace_fee_percent"] = float(Decimal(policy["marketplace_fee_bps"]) / Decimal(100))
    return policy


async def _seller_profile(db: Any, seller_id: str) -> Optional[Dict[str, Any]]:
    return await db.seller_payment_profiles.find_one({"seller_id": seller_id}, {"_id": 0})


async def _hydrate_cart(db: Any, user_id: str) -> Dict[str, Any]:
    cart = await db.commerce_carts.find_one({"user_id": user_id}, {"_id": 0})
    if not cart:
        return {
            "id": None,
            "user_id": user_id,
            "items": [],
            "item_count": 0,
            "subtotal_cents": 0,
            "shipping_cents": 0,
            "total_cents": 0,
            "currency": "ZAR",
            "seller_count": 0,
            "checkout_strategy": "split_orders",
        }

    output_items: List[Dict[str, Any]] = []
    subtotal = 0
    shipping_total = 0
    seller_ids = set()
    for row in cart.get("items") or []:
        product = await db.products.find_one({"id": row["product_id"]}, {"_id": 0})
        if not product or product.get("status") != "approved":
            continue
        price_cents = _unit_price_cents(product, row.get("variant_key"))
        shipping = _shipping_snapshot(product, row.get("shipping_option"))
        quantity = int(row.get("quantity") or 1)
        line_subtotal = price_cents * quantity
        subtotal += line_subtotal
        shipping_total += shipping["cost_cents"]
        seller_ids.add(product["creator_id"])
        output_items.append({
            "line_id": row["line_id"],
            "product_id": product["id"],
            "seller_id": product["creator_id"],
            "seller_name": product.get("creator_name"),
            "name": product.get("name"),
            "slug": product.get("slug"),
            "creator_username": product.get("creator_username"),
            "image": (product.get("images") or [None])[0],
            "fulfillment_type": _fulfillment_type(product),
            "quantity": quantity,
            "variant_key": row.get("variant_key"),
            "shipping": shipping,
            "unit_price_cents": price_cents,
            "line_subtotal_cents": line_subtotal,
            "currency": "ZAR",
        })
    total = subtotal + shipping_total
    return {
        **cart,
        "items": output_items,
        "item_count": sum(item["quantity"] for item in output_items),
        "subtotal_cents": subtotal,
        "shipping_cents": shipping_total,
        "total_cents": total,
        "subtotal": _cents_to_amount(subtotal),
        "shipping": _cents_to_amount(shipping_total),
        "total": _cents_to_amount(total),
        "currency": "ZAR",
        "seller_count": len(seller_ids),
        "checkout_strategy": "split_orders",
    }


def create_commerce_router(
    db: Any,
    get_current_user: Callable[..., Any],
    require_admin_user: Callable[..., Any],
) -> APIRouter:
    router = APIRouter(prefix="/api/commerce", tags=["commerce"])

    @router.get("/config")
    async def get_commerce_config():
        policy = await _get_policy(db)
        return {
            **policy,
            "payment": _payment_readiness(),
            "fulfillment_types": ["digital", "physical", "service"],
            "fee_applies_to": "item_subtotal",
            "fee_charged_to": "seller",
            "processor_fees": "separate",
        }

    @router.put("/admin/config")
    async def update_commerce_config(
        payload: CommercePolicyUpdate,
        admin: dict = Depends(require_admin_user),
    ):
        fee_bps = int((payload.marketplace_fee_percent * Decimal(100)).quantize(Decimal("1")))
        now = _now()
        await db.platform_settings.update_one(
            {"id": COMMERCE_POLICY_ID},
            {"$set": {
                **DEFAULT_COMMERCE_POLICY,
                "marketplace_fee_bps": fee_bps,
                "updated_at": now,
                "updated_by": admin["id"],
            }},
            upsert=True,
        )
        return await get_commerce_config()

    @router.get("/seller/payment-profile")
    async def get_seller_payment_profile(current_user: dict = Depends(get_current_user)):
        profile = await _seller_profile(db, current_user["id"])
        return {
            "profile": profile,
            "platform_payment": _payment_readiness(),
            "ready_for_sales": bool(profile and profile.get("status") == "approved" and _payment_readiness()["configured"]),
        }

    @router.put("/seller/payment-profile")
    async def save_seller_payment_profile(
        payload: SellerPaymentProfileIn,
        current_user: dict = Depends(get_current_user),
    ):
        merchant_id = payload.payfast_merchant_id.strip()
        if not re.fullmatch(r"[A-Za-z0-9_-]{5,32}", merchant_id):
            raise HTTPException(status_code=400, detail="Invalid PayFast merchant ID format.")
        now = _now()
        await db.seller_payment_profiles.update_one(
            {"seller_id": current_user["id"]},
            {"$set": {
                "id": str(uuid.uuid4()),
                "seller_id": current_user["id"],
                "provider": "payfast",
                "payfast_merchant_id": merchant_id,
                "status": "pending",
                "submitted_at": now,
                "updated_at": now,
            }, "$unset": {"reviewed_at": "", "reviewed_by": "", "review_note": ""}},
            upsert=True,
        )
        return {"profile": await _seller_profile(db, current_user["id"]), "ready_for_sales": False}

    @router.patch("/admin/sellers/{seller_id}/payment-profile")
    async def review_seller_payment_profile(
        seller_id: str,
        payload: SellerPaymentStatusIn,
        admin: dict = Depends(require_admin_user),
    ):
        new_status = payload.status.strip().lower()
        if new_status not in {"approved", "pending", "suspended"}:
            raise HTTPException(status_code=400, detail="Status must be approved, pending, or suspended.")
        existing = await _seller_profile(db, seller_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Seller payment profile not found.")
        await db.seller_payment_profiles.update_one(
            {"seller_id": seller_id},
            {"$set": {
                "status": new_status,
                "review_note": (payload.note or "").strip() or None,
                "reviewed_at": _now(),
                "reviewed_by": admin["id"],
            }},
        )
        return {"profile": await _seller_profile(db, seller_id)}

    @router.get("/cart")
    async def get_cart(current_user: dict = Depends(get_current_user)):
        return await _hydrate_cart(db, current_user["id"])

    @router.post("/cart/items")
    async def add_cart_item(payload: CartItemIn, current_user: dict = Depends(get_current_user)):
        product = await db.products.find_one({"id": payload.product_id}, {"_id": 0})
        if not product or product.get("status") != "approved":
            raise HTTPException(status_code=404, detail="Product is not available.")
        if product.get("creator_id") == current_user["id"]:
            raise HTTPException(status_code=400, detail="You cannot buy your own listing.")
        currency = (product.get("currency") or "").upper()
        if currency != "ZAR":
            raise HTTPException(status_code=422, detail="PayFast marketplace checkout currently requires a ZAR listing price.")
        _unit_price_cents(product, payload.variant_key)
        _shipping_snapshot(product, payload.shipping_option)
        if _fulfillment_type(product) == "physical" and product.get("inventory_qty") is not None:
            if int(product.get("inventory_qty") or 0) < payload.quantity:
                raise HTTPException(status_code=409, detail="Requested quantity is not in stock.")

        cart = await db.commerce_carts.find_one({"user_id": current_user["id"]})
        now = _now()
        items = list((cart or {}).get("items") or [])
        matching = next((item for item in items if item.get("product_id") == payload.product_id and item.get("variant_key") == payload.variant_key and item.get("shipping_option") == payload.shipping_option), None)
        if matching:
            new_quantity = int(matching.get("quantity") or 0) + payload.quantity
            if new_quantity > 99:
                raise HTTPException(status_code=400, detail="Cart quantity cannot exceed 99.")
            if _fulfillment_type(product) == "physical" and product.get("inventory_qty") is not None and int(product.get("inventory_qty") or 0) < new_quantity:
                raise HTTPException(status_code=409, detail="Requested quantity is not in stock.")
            matching["quantity"] = new_quantity
        else:
            items.append({
                "line_id": str(uuid.uuid4()),
                "product_id": payload.product_id,
                "quantity": payload.quantity,
                "variant_key": payload.variant_key,
                "shipping_option": payload.shipping_option,
                "added_at": now,
            })
        await db.commerce_carts.update_one(
            {"user_id": current_user["id"]},
            {"$set": {
                "id": (cart or {}).get("id") or str(uuid.uuid4()),
                "user_id": current_user["id"],
                "items": items,
                "updated_at": now,
            }, "$setOnInsert": {"created_at": now}},
            upsert=True,
        )
        return await _hydrate_cart(db, current_user["id"])

    @router.patch("/cart/items/{line_id}")
    async def update_cart_item(line_id: str, payload: CartItemUpdate, current_user: dict = Depends(get_current_user)):
        cart = await db.commerce_carts.find_one({"user_id": current_user["id"]})
        if not cart:
            raise HTTPException(status_code=404, detail="Cart item not found.")
        row = next((item for item in cart.get("items") or [] if item.get("line_id") == line_id), None)
        if not row:
            raise HTTPException(status_code=404, detail="Cart item not found.")
        product = await db.products.find_one({"id": row["product_id"]}, {"_id": 0})
        if not product or product.get("status") != "approved":
            raise HTTPException(status_code=409, detail="Product is no longer available.")
        if _fulfillment_type(product) == "physical" and product.get("inventory_qty") is not None and int(product.get("inventory_qty") or 0) < payload.quantity:
            raise HTTPException(status_code=409, detail="Requested quantity is not in stock.")
        await db.commerce_carts.update_one(
            {"user_id": current_user["id"], "items.line_id": line_id},
            {"$set": {"items.$.quantity": payload.quantity, "updated_at": _now()}},
        )
        return await _hydrate_cart(db, current_user["id"])

    @router.delete("/cart/items/{line_id}")
    async def remove_cart_item(line_id: str, current_user: dict = Depends(get_current_user)):
        result = await db.commerce_carts.update_one(
            {"user_id": current_user["id"]},
            {"$pull": {"items": {"line_id": line_id}}, "$set": {"updated_at": _now()}},
        )
        if not result.modified_count:
            raise HTTPException(status_code=404, detail="Cart item not found.")
        return await _hydrate_cart(db, current_user["id"])

    @router.delete("/cart")
    async def clear_cart(current_user: dict = Depends(get_current_user)):
        await db.commerce_carts.delete_one({"user_id": current_user["id"]})
        return await _hydrate_cart(db, current_user["id"])

    @router.post("/orders")
    async def create_orders(payload: CreateOrdersIn, current_user: dict = Depends(get_current_user)):
        prior = await db.commerce_orders.find(
            {"buyer_id": current_user["id"], "idempotency_key": payload.idempotency_key},
            {"_id": 0},
        ).sort("created_at", 1).to_list(length=None)
        if prior:
            return {"orders": prior, "idempotent_replay": True}

        cart = await _hydrate_cart(db, current_user["id"])
        if not cart["items"]:
            raise HTTPException(status_code=400, detail="Your cart is empty.")
        has_physical = any(item["fulfillment_type"] == "physical" for item in cart["items"])
        if has_physical and not payload.shipping_address:
            raise HTTPException(status_code=400, detail="A delivery address is required for physical products.")

        policy = await _get_policy(db)
        fee_bps = int(policy["marketplace_fee_bps"])
        grouped: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        for item in cart["items"]:
            product = await db.products.find_one({"id": item["product_id"]}, {"_id": 0})
            if not product or product.get("status") != "approved":
                raise HTTPException(status_code=409, detail=f"{item['name']} is no longer available.")
            if item["fulfillment_type"] == "physical" and product.get("inventory_qty") is not None and int(product.get("inventory_qty") or 0) < item["quantity"]:
                raise HTTPException(status_code=409, detail=f"{item['name']} no longer has enough stock.")
            grouped[item["seller_id"]].append(item)

        now = _now()
        readiness = _payment_readiness()
        docs = []
        for seller_id, items in grouped.items():
            subtotal_cents = sum(item["line_subtotal_cents"] for item in items)
            shipping_cents = sum(item["shipping"]["cost_cents"] for item in items)
            fee_cents = int((Decimal(subtotal_cents) * Decimal(fee_bps) / Decimal(10000)).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
            total_cents = subtotal_cents + shipping_cents
            seller_profile = await _seller_profile(db, seller_id)
            seller_ready = bool(seller_profile and seller_profile.get("status") == "approved")
            issues = list(readiness["missing_configuration"])
            if not seller_ready:
                issues.append("SELLER_PAYFAST_APPROVAL")
            order_id = str(uuid.uuid4())
            docs.append({
                "id": order_id,
                "order_number": f"NC-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{order_id[:8].upper()}",
                "buyer_id": current_user["id"],
                "buyer_email": current_user.get("email"),
                "buyer_name": current_user.get("full_name") or current_user.get("username"),
                "seller_id": seller_id,
                "seller_name": items[0].get("seller_name"),
                "items": items,
                "currency": "ZAR",
                "subtotal_cents": subtotal_cents,
                "shipping_cents": shipping_cents,
                "platform_fee_bps": fee_bps,
                "platform_fee_cents": fee_cents,
                "seller_proceeds_before_processor_fees_cents": total_cents - fee_cents,
                "total_cents": total_cents,
                "subtotal": _cents_to_amount(subtotal_cents),
                "shipping": _cents_to_amount(shipping_cents),
                "platform_fee": _cents_to_amount(fee_cents),
                "total": _cents_to_amount(total_cents),
                "payment_provider": "payfast",
                "payment_status": "pending",
                "status": "awaiting_payment",
                "fulfillment_status": "unfulfilled",
                "payment_ready": readiness["configured"] and seller_ready,
                "payment_readiness_issues": issues,
                "shipping_address": payload.shipping_address.model_dump() if payload.shipping_address and any(i["fulfillment_type"] == "physical" for i in items) else None,
                "service_notes": (payload.service_notes or "").strip() or None,
                "idempotency_key": payload.idempotency_key,
                "created_at": now,
                "updated_at": now,
            })
        await db.commerce_orders.insert_many(docs)
        await db.commerce_carts.delete_one({"user_id": current_user["id"]})
        return {"orders": [{k: v for k, v in doc.items() if k != "_id"} for doc in docs], "idempotent_replay": False}

    @router.get("/orders/mine")
    async def get_my_orders(limit: int = 50, current_user: dict = Depends(get_current_user)):
        rows = await db.commerce_orders.find(
            {"buyer_id": current_user["id"]}, {"_id": 0}
        ).sort("created_at", -1).limit(min(max(limit, 1), 100)).to_list(length=None)
        return {"orders": rows, "count": len(rows)}

    @router.get("/seller/orders")
    async def get_seller_orders(limit: int = 50, current_user: dict = Depends(get_current_user)):
        rows = await db.commerce_orders.find(
            {"seller_id": current_user["id"]}, {"_id": 0}
        ).sort("created_at", -1).limit(min(max(limit, 1), 100)).to_list(length=None)
        return {"orders": rows, "count": len(rows)}

    @router.get("/orders/{order_id}")
    async def get_order(order_id: str, current_user: dict = Depends(get_current_user)):
        order = await db.commerce_orders.find_one({"id": order_id}, {"_id": 0})
        if not order:
            raise HTTPException(status_code=404, detail="Order not found.")
        is_party = current_user["id"] in {order["buyer_id"], order["seller_id"]}
        is_admin = current_user.get("role") in {"admin", "moderator", "super_admin"}
        if not is_party and not is_admin:
            raise HTTPException(status_code=403, detail="You cannot view this order.")
        return {"order": order}

    @router.post("/orders/{order_id}/cancel")
    async def cancel_order(order_id: str, current_user: dict = Depends(get_current_user)):
        order = await db.commerce_orders.find_one({"id": order_id, "buyer_id": current_user["id"]}, {"_id": 0})
        if not order:
            raise HTTPException(status_code=404, detail="Order not found.")
        if order.get("payment_status") == "paid":
            raise HTTPException(status_code=409, detail="Paid orders require the refund process.")
        if order.get("status") == "cancelled":
            return {"order": order, "already_cancelled": True}
        await db.commerce_orders.update_one(
            {"id": order_id},
            {"$set": {"status": "cancelled", "payment_status": "cancelled", "cancelled_at": _now(), "updated_at": _now()}},
        )
        return {"order": await db.commerce_orders.find_one({"id": order_id}, {"_id": 0}), "already_cancelled": False}

    @router.patch("/seller/orders/{order_id}/fulfillment")
    async def update_fulfillment(
        order_id: str,
        payload: FulfillmentUpdateIn,
        current_user: dict = Depends(get_current_user),
    ):
        order = await db.commerce_orders.find_one({"id": order_id, "seller_id": current_user["id"]}, {"_id": 0})
        if not order:
            raise HTTPException(status_code=404, detail="Order not found.")
        if order.get("payment_status") != "paid":
            raise HTTPException(status_code=409, detail="Fulfillment can start only after verified payment.")
        new_status = payload.status.strip().lower()
        allowed = {"processing", "accepted", "in_progress", "ready_for_collection", "shipped", "delivered", "completed"}
        if new_status not in allowed:
            raise HTTPException(status_code=400, detail="Invalid fulfillment status.")
        await db.commerce_orders.update_one(
            {"id": order_id},
            {"$set": {
                "fulfillment_status": new_status,
                "tracking_number": (payload.tracking_number or "").strip() or None,
                "fulfillment_note": (payload.note or "").strip() or None,
                "updated_at": _now(),
            }},
        )
        return {"order": await db.commerce_orders.find_one({"id": order_id}, {"_id": 0})}

    @router.post("/orders/{order_id}/checkout")
    async def start_payfast_checkout(
        order_id: str,
        payload: CheckoutStartIn,
        request: Request,
        current_user: dict = Depends(get_current_user),
    ):
        order = await db.commerce_orders.find_one({"id": order_id, "buyer_id": current_user["id"]}, {"_id": 0})
        if not order:
            raise HTTPException(status_code=404, detail="Order not found.")
        if order.get("status") != "awaiting_payment" or order.get("payment_status") != "pending":
            raise HTTPException(status_code=409, detail="Order is not payable.")
        readiness = _payment_readiness()
        if not readiness["configured"]:
            raise HTTPException(status_code=503, detail={"message": readiness["message"], "missing_configuration": readiness["missing_configuration"]})
        seller_profile = await _seller_profile(db, order["seller_id"])
        if not seller_profile or seller_profile.get("status") != "approved":
            raise HTTPException(status_code=422, detail="Seller is not yet approved for PayFast Split Payments.")

        mode = os.environ.get("PAYFAST_MODE", "sandbox").strip().lower()
        if mode not in PAYFAST_ACTIONS:
            raise HTTPException(status_code=500, detail="Invalid PayFast mode configured.")
        origin = _validated_origin(payload.origin_url)
        base_url = str(request.base_url).rstrip("/")
        names = (order.get("buyer_name") or "Network Capital Buyer").split(maxsplit=1)
        merchant_id = os.environ["PAYFAST_MERCHANT_ID"]
        merchant_key = os.environ["PAYFAST_MERCHANT_KEY"]
        data: OrderedDict[str, Any] = OrderedDict([
            ("merchant_id", merchant_id),
            ("merchant_key", merchant_key),
            ("return_url", f"{origin}/orders/{order_id}?payment=returned"),
            ("cancel_url", f"{origin}/orders/{order_id}?payment=cancelled"),
            ("notify_url", f"{base_url}/api/commerce/payfast/itn"),
            ("name_first", names[0]),
            ("name_last", names[1] if len(names) > 1 else ""),
            ("email_address", order.get("buyer_email") or ""),
            ("m_payment_id", order["order_number"]),
            ("amount", f"{Decimal(order['total_cents']) / Decimal(100):.2f}"),
            ("item_name", f"Network Capital order {order['order_number']}"),
            ("item_description", ", ".join(item["name"] for item in order["items"])[:255]),
        ])
        fee_percent = Decimal(order["platform_fee_bps"]) / Decimal(100)
        seller_percent = (Decimal(100) - fee_percent).quantize(Decimal("0.01"))
        setup = json.dumps({
            "split_payment": {
                "merchant_id": seller_profile["payfast_merchant_id"],
                "percentage": float(seller_percent),
            }
        }, separators=(",", ":"))
        fields = dict(data)
        fields["setup"] = setup
        fields["signature"] = _payfast_signature(data, os.environ["PAYFAST_PASSPHRASE"])
        await db.commerce_orders.update_one(
            {"id": order_id},
            {"$set": {"checkout_started_at": _now(), "updated_at": _now()}},
        )
        return {"provider": "payfast", "action": PAYFAST_ACTIONS[mode], "fields": fields, "order_id": order_id}

    @router.post("/payfast/itn")
    async def payfast_itn(request: Request):
        mode = os.environ.get("PAYFAST_MODE", "sandbox").strip().lower()
        readiness = _payment_readiness()
        if mode not in PAYFAST_VALIDATE_URLS or not readiness["configured"]:
            return Response("payment provider unavailable", status_code=503)
        form = await request.form()
        posted: OrderedDict[str, Any] = OrderedDict((key, str(value)) for key, value in form.multi_items())
        supplied_signature = str(posted.pop("signature", ""))
        expected_signature = _payfast_signature(posted, os.environ["PAYFAST_PASSPHRASE"])
        if not hmac.compare_digest(supplied_signature, expected_signature):
            return Response("invalid signature", status_code=400)
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                verification = await client.post(
                    PAYFAST_VALIDATE_URLS[mode],
                    content=urlencode(posted),
                    headers={"Content-Type": "application/x-www-form-urlencoded"},
                )
            if verification.text.strip().upper() != "VALID":
                return Response("not validated", status_code=400)
        except httpx.HTTPError:
            return Response("validation unavailable", status_code=503)

        order = await db.commerce_orders.find_one({"order_number": posted.get("m_payment_id")}, {"_id": 0})
        if not order or posted.get("merchant_id") != os.environ["PAYFAST_MERCHANT_ID"]:
            return Response("order mismatch", status_code=400)
        if _money_to_cents(posted.get("amount_gross") or 0) != int(order["total_cents"]):
            return Response("amount mismatch", status_code=400)
        if posted.get("payment_status") != "COMPLETE":
            await db.commerce_orders.update_one(
                {"id": order["id"], "payment_status": {"$ne": "paid"}},
                {"$set": {"payment_status": "failed", "status": "payment_failed", "updated_at": _now()}},
            )
            return Response("OK", status_code=200)

        pf_payment_id = posted.get("pf_payment_id")
        if not pf_payment_id:
            return Response("missing payment id", status_code=400)
        existing = await db.commerce_payments.find_one({"pf_payment_id": pf_payment_id}, {"_id": 0})
        if existing:
            return Response("OK", status_code=200)
        await db.commerce_payments.insert_one({
            "id": str(uuid.uuid4()),
            "order_id": order["id"],
            "provider": "payfast",
            "pf_payment_id": pf_payment_id,
            "amount_gross_cents": _money_to_cents(posted.get("amount_gross") or 0),
            "status": "COMPLETE",
            "validated_at": _now(),
        })
        for item in order["items"]:
            if item["fulfillment_type"] == "physical":
                await db.products.update_one(
                    {"id": item["product_id"], "$or": [{"inventory_qty": None}, {"inventory_qty": {"$exists": False}}, {"inventory_qty": {"$gte": item["quantity"]}}]},
                    {"$inc": {"inventory_qty": -item["quantity"]}} if (await db.products.find_one({"id": item["product_id"]}, {"inventory_qty": 1})).get("inventory_qty") is not None else {"$set": {"last_sale_at": _now()}},
                )
            elif item["fulfillment_type"] == "digital":
                await db.product_file_orders.update_one(
                    {"product_id": item["product_id"], "user_id": order["buyer_id"], "commerce_order_id": order["id"]},
                    {"$set": {
                        "id": str(uuid.uuid4()),
                        "product_id": item["product_id"],
                        "user_id": order["buyer_id"],
                        "commerce_order_id": order["id"],
                        "amount": _cents_to_amount(item["line_subtotal_cents"]),
                        "currency": "ZAR",
                        "status": "paid",
                        "paid_at": _now(),
                    }},
                    upsert=True,
                )
        digital_only = all(item["fulfillment_type"] == "digital" for item in order["items"])
        await db.commerce_orders.update_one(
            {"id": order["id"], "payment_status": {"$ne": "paid"}},
            {"$set": {
                "payment_status": "paid",
                "status": "completed" if digital_only else "paid",
                "fulfillment_status": "delivered" if digital_only else "unfulfilled",
                "payfast_payment_id": pf_payment_id,
                "paid_at": _now(),
                "updated_at": _now(),
            }},
        )
        return Response("OK", status_code=200)

    return router


async def ensure_commerce_indexes(db: Any) -> None:
    specs = (
        (db.commerce_carts, "user_id", {"unique": True, "name": "commerce_cart_user_unique"}),
        (db.commerce_orders, "id", {"unique": True, "name": "commerce_order_id_unique"}),
        (db.commerce_orders, "order_number", {"unique": True, "name": "commerce_order_number_unique"}),
        (db.commerce_orders, [("buyer_id", 1), ("created_at", -1)], {"name": "commerce_orders_buyer"}),
        (db.commerce_orders, [("seller_id", 1), ("created_at", -1)], {"name": "commerce_orders_seller"}),
        (db.commerce_orders, [("buyer_id", 1), ("idempotency_key", 1), ("seller_id", 1)], {"unique": True, "name": "commerce_orders_idempotency"}),
        (db.commerce_payments, "pf_payment_id", {"unique": True, "name": "commerce_payfast_payment_unique"}),
        (db.seller_payment_profiles, "seller_id", {"unique": True, "name": "seller_payment_profile_unique"}),
    )
    for collection, keys, kwargs in specs:
        await collection.create_index(keys, background=True, **kwargs)
