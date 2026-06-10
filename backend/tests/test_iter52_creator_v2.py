"""Iter 52 — Creator v2 backend tests.

Covers:
- Backfill: existing creators have creator_type=independent; products have slug+creator_username
- POST /api/uploads/file accepts allowed doc mimes, rejects others (415), enforces 100MB (we test small ok)
- Static serving at /api/uploads/files/<name>
- POST /api/products: independent => approved; switch to growth via PUT /api/users/me => pending_review
- Slug auto-generated; unique per creator; classification, tags(<=12), website, contact_email/phone, location, price_min/max persist
- File-as-product: free download requires auth (GET /products/{id}/download), email-gated lead increments download_count,
  paid requires file_price>0, paid GET /download returns 402 without paid order, /file-checkout returns 503 or Stripe URL
- GET /api/products/by-slug/<username>/<slug> returns {product,creator}; bumps view_count; 404 if missing
- GET /api/share/p/<username>/<slug> returns HTML with all OG meta tags
- PUT /api/users/me with invalid creator_type/classification -> 400
"""
import io
import os
import time
import uuid
import pytest
import requests
import jwt
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
JWT_SECRET = os.environ.get("JWT_SECRET_KEY") or "X2wtOCvJr45min9cJeiUaYVG8GgQPPFpJaq7ikUzMN35lwjKOQkWa2xmMyFfGNqc"

assert BASE_URL, "REACT_APP_BACKEND_URL must be set"


def mint_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=120),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


# --- Fixtures ---------------------------------------------------------------

@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    return s


@pytest.fixture(scope="module")
def disposable_user(session):
    """Create a fresh user via /api/auth/progressive-signup; return (user_id, token)."""
    email = f"TEST_iter52_{int(time.time())}_{uuid.uuid4().hex[:6]}@example.com"
    r = session.post(
        f"{BASE_URL}/api/auth/progressive-signup",
        json={"email": email, "password": "Test123!", "step": 1},
        timeout=30,
    )
    assert r.status_code in (200, 201), f"signup failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("token") or data.get("access_token")
    user_id = data.get("user", {}).get("id") or data.get("user_id") or data.get("id")
    if not token or not user_id:
        # fallback: decode token to extract sub
        if token:
            decoded = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
            user_id = decoded.get("sub")
    assert token and user_id, f"could not get token/user_id: {data}"
    return {"user_id": user_id, "token": token, "email": email}


@pytest.fixture(scope="module")
def auth_headers(disposable_user):
    return {"Authorization": f"Bearer {disposable_user['token']}"}


@pytest.fixture(scope="module")
def me(session, auth_headers):
    r = session.get(f"{BASE_URL}/api/users/me", headers=auth_headers, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


# --- Tests ------------------------------------------------------------------

# Backfill — every historic product has slug + creator_username
class TestBackfill:
    def test_existing_products_have_slug_and_creator_username(self, session):
        r = session.get(f"{BASE_URL}/api/products?status=approved", timeout=15)
        assert r.status_code == 200, r.text
        products = r.json().get("products", [])
        if not products:
            pytest.skip("No historic approved products to check")
        # Check first 5
        for p in products[:5]:
            assert p.get("slug"), f"product {p.get('id')} missing slug"
            assert p.get("creator_username"), f"product {p.get('id')} missing creator_username"


# /api/uploads/file (Iter 52 — downloadable assets)
class TestUploadsFile:
    def test_upload_pdf_returns_url(self, session, auth_headers):
        pdf_bytes = b"%PDF-1.4\n%TEST iter52 small pdf payload\n%%EOF\n"
        files = {"file": ("TEST_iter52.pdf", io.BytesIO(pdf_bytes), "application/pdf")}
        r = session.post(f"{BASE_URL}/api/uploads/file", files=files, headers=auth_headers, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["url"].startswith("/api/uploads/files/")
        assert data["file_name"].startswith("TEST_iter52")
        assert data["size_bytes"] == len(pdf_bytes)
        assert data["mime"] == "application/pdf"
        # Static serving
        url = f"{BASE_URL}{data['url']}"
        rr = session.get(url, timeout=15)
        assert rr.status_code == 200, f"static file fetch failed: {rr.status_code}"

    def test_upload_wrong_mime_returns_415(self, session, auth_headers):
        # video/mp4 is NOT in _ALLOWED_DOC_MIME
        files = {"file": ("TEST_iter52.mp4", io.BytesIO(b"\x00\x00\x00\x20ftyp"), "video/mp4")}
        r = session.post(f"{BASE_URL}/api/uploads/file", files=files, headers=auth_headers, timeout=15)
        assert r.status_code == 415, r.text

    def test_upload_requires_auth(self, session):
        files = {"file": ("TEST.pdf", io.BytesIO(b"%PDF-1.4\n"), "application/pdf")}
        r = session.post(f"{BASE_URL}/api/uploads/file", files=files, timeout=15)
        assert r.status_code in (401, 403), r.text


# Profile update — creator_type / classification validation
class TestProfileUpdate:
    def test_set_creator_type_independent(self, session, auth_headers):
        r = session.put(
            f"{BASE_URL}/api/users/me",
            json={"creator_type": "independent"},
            headers=auth_headers,
            timeout=15,
        )
        assert r.status_code == 200, r.text
        # verify via /me
        me = session.get(f"{BASE_URL}/api/users/me", headers=auth_headers, timeout=15).json()
        assert me.get("creator_type") == "independent"

    def test_invalid_creator_type_400(self, session, auth_headers):
        r = session.put(
            f"{BASE_URL}/api/users/me",
            json={"creator_type": "supercreator"},
            headers=auth_headers,
            timeout=15,
        )
        assert r.status_code == 400, r.text

    def test_invalid_classification_400(self, session, auth_headers):
        r = session.put(
            f"{BASE_URL}/api/users/me",
            json={"creator_classification": "wizard"},
            headers=auth_headers,
            timeout=15,
        )
        assert r.status_code == 400, r.text

    def test_valid_classification(self, session, auth_headers):
        r = session.put(
            f"{BASE_URL}/api/users/me",
            json={"creator_classification": "freelancer"},
            headers=auth_headers,
            timeout=15,
        )
        assert r.status_code == 200, r.text


# Product creation, slug, autopublish
class TestCreateProduct:
    INDEPENDENT_PRODUCT_ID = None
    INDEPENDENT_SLUG = None

    def test_create_independent_autopublishes(self, session, auth_headers, me):
        # ensure independent
        session.put(f"{BASE_URL}/api/users/me",
                    json={"creator_type": "independent"}, headers=auth_headers, timeout=15)
        payload = {
            "name": "TEST iter52 Independent Widget",
            "problem_solved": "Tests auto-publish flow",
            "description": "iter52 test product",
            "estimated_cost": 100,
            "timeline": "2 weeks",
            "interest_level": "high",
            "category": "general",
            "release_date": "2026-02-01",
            "min_support": 10,
            "max_support": 500,
            "images": [],
            "tags": ["t1", "t2", "t3"] + [f"x{i}" for i in range(15)],  # >12 — should be capped
            "classification": "freelancer",
            "website": "https://example.com",
            "contact_email": "ping@example.com",
            "contact_phone": "+27123456789",
            "location": "Cape Town",
            "price_min": 50,
            "price_max": 200,
            "type": "product",
        }
        r = session.post(f"{BASE_URL}/api/products", json=payload, headers=auth_headers, timeout=20)
        assert r.status_code in (200, 201), r.text
        prod = r.json()["product"]
        assert prod["status"] == "approved", f"independent should auto-publish but got status={prod['status']}"
        assert prod.get("slug"), "slug must be auto-generated"
        assert prod["slug"].startswith("test-iter52-independent-widget")
        # creator_username denormalized
        assert prod.get("creator_username")
        # tags capped to 12
        assert len(prod["tags"]) <= 12
        # classification, website, contact fields persist
        assert prod["classification"] == "freelancer"
        assert prod["website"] == "https://example.com"
        assert prod["contact_email"] == "ping@example.com"
        assert prod["contact_phone"] == "+27123456789"
        assert prod["location"] == "Cape Town"
        assert prod["price_min"] == 50
        assert prod["price_max"] == 200
        TestCreateProduct.INDEPENDENT_PRODUCT_ID = prod["id"]
        TestCreateProduct.INDEPENDENT_SLUG = prod["slug"]

    def test_create_growth_pending_review(self, session, auth_headers):
        # Switch to growth
        r = session.put(f"{BASE_URL}/api/users/me",
                        json={"creator_type": "growth"}, headers=auth_headers, timeout=15)
        assert r.status_code == 200, r.text
        payload = {
            "name": "TEST iter52 Growth Service",
            "problem_solved": "Tests moderation flow",
            "description": "",
            "estimated_cost": 0,
            "timeline": "",
            "interest_level": "medium",
            "category": "general",
            "type": "service",
            "support_needed": True,
            "support_categories": ["funding", "mentorship", "bogus_cat"],
            "support_message": "Looking for mentors",
        }
        r = session.post(f"{BASE_URL}/api/products", json=payload, headers=auth_headers, timeout=20)
        assert r.status_code in (200, 201), r.text
        prod = r.json()["product"]
        assert prod["status"] == "pending_review", f"growth should be pending but got {prod['status']}"
        # support filtered to allowed only
        assert "bogus_cat" not in prod["support_categories"]
        assert "funding" in prod["support_categories"]
        assert prod["support_needed"] is True

    def test_slug_unique_per_creator(self, session, auth_headers):
        # Switch back to independent
        session.put(f"{BASE_URL}/api/users/me",
                    json={"creator_type": "independent"}, headers=auth_headers, timeout=15)
        # Create two products with same name; expect slug-2 suffix
        payload = {
            "name": "TEST iter52 Unique Slug",
            "problem_solved": "p",
            "description": "",
            "estimated_cost": 0,
            "timeline": "",
            "interest_level": "low",
            "category": "general",
        }
        r1 = session.post(f"{BASE_URL}/api/products", json=payload, headers=auth_headers, timeout=20)
        r2 = session.post(f"{BASE_URL}/api/products", json=payload, headers=auth_headers, timeout=20)
        assert r1.status_code in (200, 201) and r2.status_code in (200, 201)
        s1 = r1.json()["product"]["slug"]
        s2 = r2.json()["product"]["slug"]
        assert s1 != s2, f"slugs must differ but got {s1} == {s2}"


# Slug lookup + view_count bump
class TestSlugLookup:
    def test_by_slug_returns_product_and_creator(self, session, me, auth_headers):
        # use product created above
        pid = TestCreateProduct.INDEPENDENT_PRODUCT_ID
        slug = TestCreateProduct.INDEPENDENT_SLUG
        assert pid and slug, "previous test must have created a product"
        # Need creator_username — pull from product
        prod_resp = session.get(f"{BASE_URL}/api/products/{pid}", timeout=15).json()
        uname = prod_resp["product"]["creator_username"]

        # call by-slug twice and check view_count bumps
        r1 = session.get(f"{BASE_URL}/api/products/by-slug/{uname}/{slug}", timeout=15)
        assert r1.status_code == 200, r1.text
        d1 = r1.json()
        assert "product" in d1 and "creator" in d1
        assert d1["product"]["id"] == pid
        v1 = d1["product"].get("view_count", 0)

        time.sleep(0.3)
        r2 = session.get(f"{BASE_URL}/api/products/by-slug/{uname}/{slug}", timeout=15)
        assert r2.status_code == 200
        v2 = r2.json()["product"].get("view_count", 0)
        assert v2 > v1, f"view_count should bump: {v1} -> {v2}"

    def test_by_slug_404(self, session):
        r = session.get(f"{BASE_URL}/api/products/by-slug/nosuchuser/nosuchslug-xyz", timeout=15)
        assert r.status_code == 404


# Share OG HTML
class TestShareOG:
    def test_share_og_returns_meta(self, session):
        pid = TestCreateProduct.INDEPENDENT_PRODUCT_ID
        slug = TestCreateProduct.INDEPENDENT_SLUG
        assert pid and slug
        prod = session.get(f"{BASE_URL}/api/products/{pid}", timeout=15).json()["product"]
        uname = prod["creator_username"]
        r = session.get(f"{BASE_URL}/api/share/p/{uname}/{slug}", timeout=15)
        assert r.status_code == 200
        body = r.text
        assert 'property="og:title"' in body
        assert 'property="og:description"' in body
        assert 'property="og:url"' in body
        assert 'name="twitter:card"' in body
        assert 'rel="canonical"' in body
        assert "http-equiv=\"refresh\"" in body


# Files-as-products: free / email-gated / paid
class TestFilesAsProducts:
    FREE_ID = None
    GATED_ID = None
    PAID_ID = None

    def _upload_pdf(self, session, auth_headers):
        files = {"file": ("TEST.pdf", io.BytesIO(b"%PDF-1.4\nhello\n%%EOF"), "application/pdf")}
        r = session.post(f"{BASE_URL}/api/uploads/file", files=files, headers=auth_headers, timeout=20)
        assert r.status_code == 200
        return r.json()

    def test_paid_requires_price(self, session, auth_headers):
        # Set to independent so auto-publishes
        session.put(f"{BASE_URL}/api/users/me",
                    json={"creator_type": "independent"}, headers=auth_headers, timeout=15)
        upload = self._upload_pdf(session, auth_headers)
        payload = {
            "name": "TEST iter52 Paid No Price",
            "problem_solved": "p",
            "estimated_cost": 0,
            "timeline": "",
            "interest_level": "low",
            "file_url": upload["url"],
            "file_name": upload["file_name"],
            "file_size_bytes": upload["size_bytes"],
            "file_mime": upload["mime"],
            "file_access": "paid",
            # no file_price -> should 400
        }
        r = session.post(f"{BASE_URL}/api/products", json=payload, headers=auth_headers, timeout=15)
        assert r.status_code == 400, r.text

    def test_create_free_gated_paid(self, session, auth_headers):
        upload = self._upload_pdf(session, auth_headers)
        common = {
            "problem_solved": "p",
            "estimated_cost": 0,
            "timeline": "",
            "interest_level": "low",
            "file_url": upload["url"],
            "file_name": upload["file_name"],
            "file_size_bytes": upload["size_bytes"],
            "file_mime": upload["mime"],
        }
        free = {**common, "name": "TEST iter52 Free File", "file_access": "free"}
        gated = {**common, "name": "TEST iter52 Gated File", "file_access": "email_gated"}
        paid = {**common, "name": "TEST iter52 Paid File", "file_access": "paid", "file_price": 9.99}
        for body, key in [(free, "FREE_ID"), (gated, "GATED_ID"), (paid, "PAID_ID")]:
            r = session.post(f"{BASE_URL}/api/products", json=body, headers=auth_headers, timeout=20)
            assert r.status_code in (200, 201), f"{key}: {r.status_code} {r.text}"
            setattr(TestFilesAsProducts, key, r.json()["product"]["id"])

    def test_free_download_requires_auth(self, session):
        pid = TestFilesAsProducts.FREE_ID
        assert pid
        r = session.get(f"{BASE_URL}/api/products/{pid}/download", timeout=15)
        assert r.status_code in (401, 403)

    def test_free_download_authed(self, session, auth_headers):
        pid = TestFilesAsProducts.FREE_ID
        r = session.get(f"{BASE_URL}/api/products/{pid}/download", headers=auth_headers, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json().get("url")

    def test_email_gated_lead_increments_count(self, session):
        pid = TestFilesAsProducts.GATED_ID
        assert pid
        before = session.get(f"{BASE_URL}/api/products/{pid}", timeout=15).json()["product"].get("download_count", 0)
        r = session.post(
            f"{BASE_URL}/api/products/{pid}/file-lead",
            json={"name": "Lead Tester", "email": "TEST_lead@example.com", "phone": "12345"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        assert body["url"]
        after = session.get(f"{BASE_URL}/api/products/{pid}", timeout=15).json()["product"].get("download_count", 0)
        assert after == before + 1, f"download_count should bump: {before} -> {after}"

    def test_paid_lead_blocked_402(self, session):
        pid = TestFilesAsProducts.PAID_ID
        assert pid
        r = session.post(
            f"{BASE_URL}/api/products/{pid}/file-lead",
            json={"name": "X", "email": "x@example.com"},
            timeout=15,
        )
        assert r.status_code == 402, r.text

    def test_paid_download_402_without_order(self, session, auth_headers):
        pid = TestFilesAsProducts.PAID_ID
        r = session.get(f"{BASE_URL}/api/products/{pid}/download", headers=auth_headers, timeout=15)
        assert r.status_code == 402, r.text

    def test_paid_checkout_endpoint(self, session, auth_headers):
        pid = TestFilesAsProducts.PAID_ID
        r = session.post(
            f"{BASE_URL}/api/products/{pid}/file-checkout",
            json={},
            headers=auth_headers,
            timeout=20,
        )
        # 200 (with stripe URL) or 503 (stripe not configured) acceptable
        assert r.status_code in (200, 503), r.text
        if r.status_code == 200:
            assert r.json().get("url", "").startswith("http")
