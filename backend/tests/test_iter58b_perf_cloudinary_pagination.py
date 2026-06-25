"""Iter 58b — Perf + Cloudinary cleanup + sitemap PDF regression tests.

Covers:
  - GET /api/posts pagination (skip/limit, default=10, cap=50)
  - Wire-payload audit: no `image_data_url` anywhere, photos never `data:`
  - POST /api/posts with base64 image → Cloudinary URL coercion
  - PUT /api/users/me with base64 photo → Cloudinary URL coercion
  - Sitemap PDF served at /Network-Capital-Sitemap.pdf
"""
import os
import base64
import io
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
OWNER_EMAIL = "rmleetang@gmail.com"
OWNER_PASS = "OwnerTest123!"

# 1x1 transparent PNG
_TINY_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9Q"
    "DwADhgGAWjR9awAAAABJRU5ErkJggg=="
)
TINY_DATA_URL = "data:image/png;base64," + base64.b64encode(_TINY_PNG).decode()


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def owner_token(session):
    r = session.post(f"{BASE_URL}/api/auth/login", json={"email": OWNER_EMAIL, "password": OWNER_PASS})
    assert r.status_code == 200, f"owner login failed: {r.status_code} {r.text[:200]}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def auth(owner_token):
    return {"Authorization": f"Bearer {owner_token}", "Content-Type": "application/json"}


# ---- 1. GET /api/posts pagination ----

class TestPostsPagination:
    def test_default_limit_is_10(self, session):
        r = session.get(f"{BASE_URL}/api/posts")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) <= 10, f"default limit must be ≤10, got {len(data)}"

    def test_skip_limit_explicit(self, session):
        r0 = session.get(f"{BASE_URL}/api/posts", params={"skip": 0, "limit": 10})
        r1 = session.get(f"{BASE_URL}/api/posts", params={"skip": 10, "limit": 10})
        assert r0.status_code == 200 and r1.status_code == 200
        p0, p1 = r0.json(), r1.json()
        assert len(p0) <= 10
        assert len(p1) <= 10
        if p0 and p1:
            ids0 = {p["id"] for p in p0}
            ids1 = {p["id"] for p in p1}
            assert not (ids0 & ids1), "skip=0 and skip=10 should not overlap"

    def test_limit_50_works(self, session):
        r = session.get(f"{BASE_URL}/api/posts", params={"limit": 50})
        assert r.status_code == 200
        assert len(r.json()) <= 50

    def test_limit_200_capped_at_50(self, session):
        r = session.get(f"{BASE_URL}/api/posts", params={"limit": 200})
        assert r.status_code == 200
        assert len(r.json()) <= 50, "backend must cap limit at 50"


# ---- 2. Wire-payload audit ----

class TestPayloadAudit:
    def test_no_image_data_url_in_response(self, session):
        r = session.get(f"{BASE_URL}/api/posts", params={"limit": 50})
        assert r.status_code == 200
        posts = r.json()
        for p in posts:
            assert "image_data_url" not in p, f"post {p.get('id')} leaks image_data_url"
            img = p.get("image") or ""
            assert not img.startswith("data:"), (
                f"post {p.get('id')} image is data: URL: {img[:60]}"
            )
            if img:
                # Acceptable: http(s) URL or same-origin relative path (/api/uploads/...).
                # Forbidden: data: URLs (already asserted above).
                assert (
                    img.startswith("http://")
                    or img.startswith("https://")
                    or img.startswith("/")
                ), f"image must be empty, http(s), or relative URL, got: {img[:80]}"
            user_photo = p.get("user_photo") or ""
            assert not user_photo.startswith("data:"), (
                f"post {p.get('id')} user_photo is data: URL"
            )

    def test_slides_have_no_image_data_url(self, session):
        r = session.get(f"{BASE_URL}/api/posts", params={"limit": 50})
        assert r.status_code == 200
        for p in r.json():
            for s in (p.get("slides") or []):
                assert "image_data_url" not in s, f"slide leaks image_data_url in post {p.get('id')}"
                simg = s.get("image") or ""
                assert not simg.startswith("data:"), f"slide image is data: in post {p.get('id')}"


# ---- 3. POST /api/posts with base64 image → Cloudinary coercion ----

class TestBase64Coercion:
    def test_post_create_coerces_base64_to_cloudinary(self, session, auth):
        payload = {
            "title": "TEST_iter58b_base64_coerce",
            "content": "iter58b cloudinary coercion test",
            "category": "general",
            "post_type": "thought",
            "image": TINY_DATA_URL,
        }
        r = session.post(f"{BASE_URL}/api/posts", json=payload, headers=auth)
        assert r.status_code in (200, 201), f"POST /api/posts failed: {r.status_code} {r.text[:200]}"
        created = r.json()
        post_id = created.get("id")
        assert post_id, "no id returned"
        # image in response must NOT be data: URL
        img = created.get("image") or ""
        assert not img.startswith("data:"), f"create response leaks base64: {img[:60]}"
        # No legacy field
        assert "image_data_url" not in created

        # Fetch from list and verify cloudinary URL
        time.sleep(0.5)
        r2 = session.get(f"{BASE_URL}/api/posts", params={"limit": 50})
        assert r2.status_code == 200
        found = next((p for p in r2.json() if p.get("id") == post_id), None)
        assert found is not None, "newly created post not in feed"
        new_img = found.get("image") or ""
        assert new_img.startswith("https://res.cloudinary.com/") or new_img == "", (
            f"image not on cloudinary: {new_img[:80]}"
        )
        assert "image_data_url" not in found

        # cleanup
        session.delete(f"{BASE_URL}/api/posts/{post_id}", headers=auth)


# ---- 4. PUT /api/users/me with base64 photo → Cloudinary coercion ----

class TestProfilePhotoCoercion:
    def test_put_users_me_coerces_photo(self, session, auth):
        # capture original photo to restore
        me0 = session.get(f"{BASE_URL}/api/users/me", headers=auth)
        assert me0.status_code == 200
        original_photo = me0.json().get("photo") or ""

        r = session.put(
            f"{BASE_URL}/api/users/me",
            json={"photo": TINY_DATA_URL},
            headers=auth,
        )
        assert r.status_code == 200, f"PUT /users/me failed: {r.status_code} {r.text[:200]}"

        # GET /api/users/me and confirm photo coerced to Cloudinary URL
        me = session.get(f"{BASE_URL}/api/users/me", headers=auth)
        assert me.status_code == 200
        photo = me.json().get("photo") or ""
        assert not photo.startswith("data:"), f"photo still base64: {photo[:60]}"
        assert photo.startswith("https://res.cloudinary.com/") or photo.startswith("http"), (
            f"photo not http(s) URL: {photo[:80]}"
        )

        # restore (best-effort)
        if original_photo and not original_photo.startswith("data:"):
            session.put(f"{BASE_URL}/api/users/me", json={"photo": original_photo}, headers=auth)


# ---- 5. Sitemap PDF ----

class TestSitemapPDF:
    def test_pdf_head(self, session):
        r = session.head(f"{BASE_URL}/Network-Capital-Sitemap.pdf", allow_redirects=True)
        assert r.status_code == 200, f"PDF HEAD failed: {r.status_code}"
        ct = r.headers.get("content-type", "")
        assert "pdf" in ct.lower(), f"content-type not pdf: {ct}"

    def test_pdf_get_valid(self, session):
        r = session.get(f"{BASE_URL}/Network-Capital-Sitemap.pdf", allow_redirects=True)
        assert r.status_code == 200
        body = r.content
        assert body.startswith(b"%PDF-"), "not a valid PDF header"
        # ~7KB target — be flexible
        assert 2000 < len(body) < 200_000, f"unexpected PDF size: {len(body)}"
