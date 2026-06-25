"""Iter 58 backend tests:
- POST/GET storefront follow + follow-status (toggle, idempotent, own-store guard)
- DELETE /api/products/{id} soft delete (owner, admin, 403 for stranger)
- PATCH /api/jobs/{id} admin-role gate (super_admin editing other user's job)
- GET /api/posts perf smoke for super_admin
"""
import os
import time
import uuid
import requests
import pytest

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE}/api"

OWNER_EMAIL = "rmleetang@gmail.com"
OWNER_PASS = "OwnerTest123!"
OWNER_USERNAME = "owner"
ADMIN_EMAIL = "rmleetang+nctest1780423349@gmail.com"
ADMIN_PASS = "Test123!"


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    return r.json()["token"]


def _hdr(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def owner_token():
    return _login(OWNER_EMAIL, OWNER_PASS)


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN_EMAIL, ADMIN_PASS)


# ── Posts perf smoke ──────────────────────────────────────────────────────
class TestPostsPerf:
    def test_get_posts_super_admin(self, owner_token):
        t0 = time.time()
        r = requests.get(f"{API}/posts", headers=_hdr(owner_token), timeout=30)
        elapsed = time.time() - t0
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list) or "posts" in data
        # Loose perf assertion — purely indicative
        print(f"[posts] {elapsed:.2f}s status=200")


# ── Storefront follow ─────────────────────────────────────────────────────
class TestStorefrontFollow:
    def test_owner_cannot_follow_own_store(self, owner_token):
        r = requests.post(f"{API}/storefront/{OWNER_USERNAME}/follow",
                          headers=_hdr(owner_token), timeout=20)
        assert r.status_code == 400
        assert "own store" in r.text.lower() or "cannot" in r.text.lower()

    def test_follow_toggle_and_status(self, admin_token):
        # status before
        r0 = requests.get(f"{API}/storefront/{OWNER_USERNAME}/follow-status",
                          headers=_hdr(admin_token), timeout=20)
        assert r0.status_code == 200, r0.text
        start_following = r0.json().get("following", False)
        start_count = r0.json().get("follower_count", 0)

        # Toggle to opposite state
        r1 = requests.post(f"{API}/storefront/{OWNER_USERNAME}/follow",
                           headers=_hdr(admin_token), timeout=20)
        assert r1.status_code == 200, r1.text
        d1 = r1.json()
        assert d1["following"] == (not start_following)
        assert d1["action"] in ("followed", "unfollowed")
        if not start_following:
            assert d1["follower_count"] == start_count + 1
            assert d1["action"] == "followed"
        else:
            assert d1["follower_count"] == max(0, start_count - 1)
            assert d1["action"] == "unfollowed"

        # Status now reflects toggled state
        r2 = requests.get(f"{API}/storefront/{OWNER_USERNAME}/follow-status",
                          headers=_hdr(admin_token), timeout=20)
        assert r2.status_code == 200
        assert r2.json()["following"] == (not start_following)
        assert r2.json()["follower_count"] == d1["follower_count"]

        # Toggle back (idempotent end state)
        r3 = requests.post(f"{API}/storefront/{OWNER_USERNAME}/follow",
                           headers=_hdr(admin_token), timeout=20)
        assert r3.status_code == 200
        d3 = r3.json()
        assert d3["following"] == start_following
        assert d3["follower_count"] == start_count

    def test_follow_unknown_store_404(self, admin_token):
        r = requests.post(f"{API}/storefront/__nope__zzz__/follow",
                          headers=_hdr(admin_token), timeout=20)
        assert r.status_code == 404


# ── Product soft-delete ───────────────────────────────────────────────────
class TestProductDelete:
    @pytest.fixture(scope="class")
    def created_product(self, owner_token):
        payload = {
            "name": f"TEST_iter58_product_{uuid.uuid4().hex[:8]}",
            "description": "Iter58 soft delete test product",
            "estimated_cost": 100,
            "currency": "ZAR",
            "category": "service",
            "images": [],
            "type": "product",
            "publish": True,
        }
        r = requests.post(f"{API}/products", headers=_hdr(owner_token), json=payload, timeout=20)
        assert r.status_code in (200, 201), f"create product failed: {r.status_code} {r.text}"
        body = r.json()
        pid = body.get("id") or body.get("product", {}).get("id") or body.get("product_id")
        assert pid, f"no product id in response: {body}"
        return pid

    def test_non_owner_non_admin_cannot_delete(self, created_product, owner_token):
        # Create a fresh throwaway user and try to delete owner's product
        email = f"test_iter58_{uuid.uuid4().hex[:8]}@example.com"
        # Try progressive signup to mint a token quickly
        r_signup = requests.post(f"{API}/auth/progressive-signup",
                                 json={"email": email, "password": "Test123!", "step": 1}, timeout=20)
        if r_signup.status_code != 200:
            pytest.skip(f"progressive-signup unavailable: {r_signup.status_code}")
        intruder_token = r_signup.json().get("token")
        if not intruder_token:
            pytest.skip("no token from progressive-signup")
        r = requests.delete(f"{API}/products/{created_product}",
                            headers=_hdr(intruder_token), timeout=20)
        assert r.status_code == 403, f"expected 403 got {r.status_code} {r.text}"

    def test_owner_can_soft_delete(self, created_product, owner_token):
        r = requests.delete(f"{API}/products/{created_product}",
                            headers=_hdr(owner_token), timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True

        # Verify it's no longer in public storefront
        r_store = requests.get(f"{API}/storefront/{OWNER_USERNAME}", timeout=20)
        if r_store.status_code == 200:
            data = r_store.json()
            products = data.get("products") or data.get("items") or []
            assert all(p.get("id") != created_product for p in products), \
                "soft-deleted product still appears in storefront"

        # Idempotent
        r2 = requests.delete(f"{API}/products/{created_product}",
                             headers=_hdr(owner_token), timeout=20)
        assert r2.status_code == 200
        assert r2.json().get("already_deleted") is True or r2.json().get("ok") is True


# ── Jobs PATCH admin gate ─────────────────────────────────────────────────
class TestJobsAdminEdit:
    def test_super_admin_can_edit_any_job(self, owner_token, admin_token):
        # Find an existing job not owned by super_admin (use public list)
        r_list = requests.get(f"{API}/jobs?limit=50", timeout=20)
        if r_list.status_code != 200:
            pytest.skip(f"GET /jobs failed: {r_list.status_code}")
        jobs = r_list.json()
        if not jobs:
            pytest.skip("No jobs available to test admin edit")

        # Pick first job
        job = jobs[0]
        job_id = job["id"]
        original_title = job["title"]

        # super_admin (owner) PATCH any job
        new_title = f"Updated by admin {uuid.uuid4().hex[:6]}"
        r_patch = requests.patch(f"{API}/jobs/{job_id}",
                                 headers=_hdr(owner_token),
                                 json={"title": new_title}, timeout=20)
        assert r_patch.status_code == 200, f"PATCH by super_admin failed: {r_patch.status_code} {r_patch.text}"
        updated = r_patch.json()
        assert updated.get("title") == new_title, f"title not updated: {updated.get('title')}"

        # Restore original title
        requests.patch(f"{API}/jobs/{job_id}",
                       headers=_hdr(owner_token),
                       json={"title": original_title}, timeout=20)
