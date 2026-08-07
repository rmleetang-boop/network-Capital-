"""Iter 51 — Carousel + Reels + Admin Announcements backend tests.

Covers:
- POST /api/uploads/media (auth, scopes, mime/size validation, static serving)
- POST /api/posts (carousel, reel, validation: slides<2, slides>10, duration>30)
- POST /api/admin/announce (carousel, reel, non-admin 403, validation)
- GET /api/posts surfaces slides/media_type
"""
import io
import os
import time
import uuid
import jwt
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://system-repair-18.preview.emergentagent.com").rstrip("/")
JWT_SECRET = "X2wtOCvJr45min9cJeiUaYVG8GgQPPFpJaq7ikUzMN35lwjKOQkWa2xmMyFfGNqc"

OWNER_EMAIL = "rmleetang@gmail.com"
OWNER_PASSWORD = "OwnerTest123!"
ADMIN_EMAIL = "rmleetang+nctest1780423349@gmail.com"
ADMIN_PASSWORD = "Test123!"


# ──────────── Fixtures ──────────────────────────────────────────────────
def _login(email: str, password: str) -> str:
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": password},
        timeout=20,
    )
    assert r.status_code == 200, f"Login failed {email}: {r.status_code} {r.text}"
    return r.json()["token"]


def _mint_jwt(user_id: str, email: str, role: str = "user") -> str:
    """HS256 JWT mint shortcut (Brevo OTP is blocked at provider)."""
    payload = {
        "sub": user_id,
        "user_id": user_id,
        "email": email,
        "role": role,
        "exp": int(time.time()) + 3600,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def _create_disposable_user():
    """Create a fresh non-admin user via progressive signup (no OTP needed for our tests –
    we mint our own JWT once we have the user id from the signup response)."""
    email = f"TEST_iter51_{uuid.uuid4().hex[:10]}@example.com"
    r = requests.post(
        f"{BASE_URL}/api/auth/progressive-signup",
        json={"email": email, "password": "Test123!", "step": 1},
        timeout=20,
    )
    assert r.status_code in (200, 201), f"signup failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("token")
    assert token, f"no token in signup response: {data}"
    # Decode to get user id (we trust the server JWT)
    decoded = jwt.decode(token, JWT_SECRET, algorithms=["HS256"], options={"verify_aud": False})
    return token, decoded.get("user_id") or decoded.get("sub"), email


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN_EMAIL, ADMIN_PASSWORD)


@pytest.fixture(scope="module")
def user_session():
    token, uid, email = _create_disposable_user()
    return {"token": token, "id": uid, "email": email}


# ──────────── Helper: minimal valid JPEG / MP4 bytes ────────────────────
# 1x1 JPEG (smallest valid)
_TINY_JPEG = bytes.fromhex(
    "ffd8ffe000104a46494600010100000100010000ffdb004300080606070605080707"
    "07090908 0a0c140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c20242e2720222c231c"
    "1c2837292c30313434341f27393d38323c2e333432ffc0000b08000100010101"
    "1100ffc4001f0000010501010101010100000000000000000102030405060708"
    "090a0bffc400b5100002010303020403050504040000017d010203000411051221"
    "31410613516107227114328191a1082342b1c11552d1f02433627282090a161718"
    "191a25262728292a3435363738393a434445464748494a535455565758595a6364"
    "65666768696a737475767778797a838485868788898a92939495969798999aa2a3"
    "a4a5a6a7a8a9aab2b3b4b5b6b7b8b9bac2c3c4c5c6c7c8c9cad2d3d4d5d6d7d8d9"
    "dae1e2e3e4e5e6e7e8e9eaf1f2f3f4f5f6f7f8f9faffda0008010100003f00fb d0ffd9".replace(" ", "")
)
# minimal mp4 — just enough bytes; mime is what matters for the endpoint
_TINY_MP4 = b"\x00\x00\x00\x18ftypisom\x00\x00\x00\x00isomiso2mp41" + b"\x00" * 64


# ════════════════ /api/uploads/media ═══════════════════════════════════
class TestUploadMedia:

    def test_upload_requires_auth(self):
        r = requests.post(
            f"{BASE_URL}/api/uploads/media",
            files={"file": ("x.jpg", _TINY_JPEG, "image/jpeg")},
            data={"scope": "posts"},
            timeout=20,
        )
        assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code}"

    def test_upload_image_posts_scope_success(self, user_session):
        r = requests.post(
            f"{BASE_URL}/api/uploads/media",
            files={"file": ("test.jpg", _TINY_JPEG, "image/jpeg")},
            data={"scope": "posts"},
            headers={"Authorization": f"Bearer {user_session['token']}"},
            timeout=20,
        )
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        body = r.json()
        assert "url" in body and body["url"].startswith("/api/uploads/posts/")
        assert body["kind"] == "image"
        assert body["size_bytes"] > 0
        assert body["mime"] == "image/jpeg"
        assert body["filename"].endswith(".jpg")
        # ── static file serving check
        url = f"{BASE_URL}{body['url']}"
        s = requests.get(url, timeout=20)
        assert s.status_code == 200, f"static fetch failed: {s.status_code} url={url}"
        assert len(s.content) == body["size_bytes"]

    def test_upload_video_posts_scope_success(self, user_session):
        r = requests.post(
            f"{BASE_URL}/api/uploads/media",
            files={"file": ("test.mp4", _TINY_MP4, "video/mp4")},
            data={"scope": "posts"},
            headers={"Authorization": f"Bearer {user_session['token']}"},
            timeout=20,
        )
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        body = r.json()
        assert body["kind"] == "video"
        assert body["mime"] == "video/mp4"

    def test_upload_announcement_scope_non_admin_403(self, user_session):
        r = requests.post(
            f"{BASE_URL}/api/uploads/media",
            files={"file": ("x.jpg", _TINY_JPEG, "image/jpeg")},
            data={"scope": "announcements"},
            headers={"Authorization": f"Bearer {user_session['token']}"},
            timeout=20,
        )
        assert r.status_code == 403, f"{r.status_code} {r.text}"
        assert "admin-only" in r.text.lower()

    def test_upload_announcement_scope_admin_success(self, admin_token):
        r = requests.post(
            f"{BASE_URL}/api/uploads/media",
            files={"file": ("ann.jpg", _TINY_JPEG, "image/jpeg")},
            data={"scope": "announcements"},
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=20,
        )
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        body = r.json()
        assert body["url"].startswith("/api/uploads/announcements/")

    def test_upload_unknown_scope_400(self, user_session):
        r = requests.post(
            f"{BASE_URL}/api/uploads/media",
            files={"file": ("x.jpg", _TINY_JPEG, "image/jpeg")},
            data={"scope": "garbage"},
            headers={"Authorization": f"Bearer {user_session['token']}"},
            timeout=20,
        )
        assert r.status_code == 400
        assert "scope" in r.text.lower()

    def test_upload_unsupported_mime_415(self, user_session):
        r = requests.post(
            f"{BASE_URL}/api/uploads/media",
            files={"file": ("malicious.exe", b"MZ\x90\x00", "application/x-msdownload")},
            data={"scope": "posts"},
            headers={"Authorization": f"Bearer {user_session['token']}"},
            timeout=20,
        )
        assert r.status_code == 415, f"{r.status_code} {r.text}"

    def test_upload_oversize_image_413(self, user_session):
        # 12MB > 11MB image cap
        big = b"\xff" * (12 * 1024 * 1024)
        r = requests.post(
            f"{BASE_URL}/api/uploads/media",
            files={"file": ("big.jpg", big, "image/jpeg")},
            data={"scope": "posts"},
            headers={"Authorization": f"Bearer {user_session['token']}"},
            timeout=60,
        )
        assert r.status_code == 413, f"{r.status_code} {r.text}"


# ════════════════ /api/posts — carousel + reels ════════════════════════
class TestPostCarouselReel:

    def _upload(self, token, kind="image"):
        if kind == "image":
            files = {"file": ("p.jpg", _TINY_JPEG, "image/jpeg")}
        else:
            files = {"file": ("p.mp4", _TINY_MP4, "video/mp4")}
        r = requests.post(
            f"{BASE_URL}/api/uploads/media",
            files=files,
            data={"scope": "posts"},
            headers={"Authorization": f"Bearer {token}"},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        return r.json()["url"]

    def test_carousel_post_persists_slides(self, user_session):
        tok = user_session["token"]
        slide_urls = [self._upload(tok) for _ in range(3)]
        body = {
            "content": "TEST_iter51 carousel",
            "media_type": "carousel",
            "slides": [{"type": "image", "image": u, "caption": f"s{i}"} for i, u in enumerate(slide_urls)],
        }
        r = requests.post(
            f"{BASE_URL}/api/posts",
            json=body,
            headers={"Authorization": f"Bearer {tok}"},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        post = r.json()
        assert post["media_type"] == "carousel"
        assert isinstance(post.get("slides"), list)
        assert len(post["slides"]) == 3
        assert post["slides"][0]["image"] == slide_urls[0]
        post_id = post["id"]

        # GET /api/posts — verify slides/media_type surfaced
        g = requests.get(f"{BASE_URL}/api/posts", headers={"Authorization": f"Bearer {tok}"}, timeout=20)
        assert g.status_code == 200
        match = [p for p in g.json() if p.get("id") == post_id]
        assert match, "created carousel post not found in feed"
        assert match[0]["media_type"] == "carousel"
        assert len(match[0]["slides"]) == 3

    def test_carousel_less_than_2_slides_400(self, user_session):
        tok = user_session["token"]
        u = self._upload(tok)
        r = requests.post(
            f"{BASE_URL}/api/posts",
            json={
                "content": "x",
                "media_type": "carousel",
                "slides": [{"type": "image", "image": u}],
            },
            headers={"Authorization": f"Bearer {tok}"},
            timeout=20,
        )
        assert r.status_code == 400
        assert "at least 2" in r.text.lower()

    def test_carousel_more_than_10_slides_400(self, user_session):
        tok = user_session["token"]
        u = self._upload(tok)
        r = requests.post(
            f"{BASE_URL}/api/posts",
            json={
                "content": "x",
                "media_type": "carousel",
                "slides": [{"type": "image", "image": u} for _ in range(11)],
            },
            headers={"Authorization": f"Bearer {tok}"},
            timeout=20,
        )
        assert r.status_code == 400
        assert "at most 10" in r.text.lower()

    def test_reel_post_persists(self, user_session):
        tok = user_session["token"]
        vurl = self._upload(tok, "video")
        r = requests.post(
            f"{BASE_URL}/api/posts",
            json={
                "content": "TEST_iter51 reel",
                "media_type": "reel",
                "video": vurl,
                "duration_seconds": 15,
            },
            headers={"Authorization": f"Bearer {tok}"},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        post = r.json()
        assert post["media_type"] == "reel"
        assert post["video"] == vurl
        assert post["duration_seconds"] == 15

    def test_reel_duration_over_30_returns_400(self, user_session):
        tok = user_session["token"]
        vurl = self._upload(tok, "video")
        r = requests.post(
            f"{BASE_URL}/api/posts",
            json={
                "content": "x",
                "media_type": "reel",
                "video": vurl,
                "duration_seconds": 45,
            },
            headers={"Authorization": f"Bearer {tok}"},
            timeout=20,
        )
        assert r.status_code == 400
        assert "30 seconds" in r.text.lower() or "capped" in r.text.lower()

    def test_legacy_single_image_post_still_works(self, user_session):
        tok = user_session["token"]
        u = self._upload(tok)
        r = requests.post(
            f"{BASE_URL}/api/posts",
            json={"content": "TEST_iter51 single image", "image": u},
            headers={"Authorization": f"Bearer {tok}"},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        post = r.json()
        assert post["image"] == u
        assert post["media_type"] in (None, "single")


# ════════════════ /api/admin/announce ═════════════════════════════════
class TestAdminAnnounce:

    def _upload_announcement(self, token, kind="image"):
        files = (
            {"file": ("a.jpg", _TINY_JPEG, "image/jpeg")}
            if kind == "image"
            else {"file": ("a.mp4", _TINY_MP4, "video/mp4")}
        )
        r = requests.post(
            f"{BASE_URL}/api/uploads/media",
            files=files,
            data={"scope": "announcements"},
            headers={"Authorization": f"Bearer {token}"},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        return r.json()["url"]

    def test_non_admin_forbidden(self, user_session):
        r = requests.post(
            f"{BASE_URL}/api/admin/announce",
            json={"content": "should fail"},
            headers={"Authorization": f"Bearer {user_session['token']}"},
            timeout=20,
        )
        assert r.status_code in (401, 403), r.text

    def test_announce_carousel(self, admin_token):
        urls = [self._upload_announcement(admin_token) for _ in range(2)]
        r = requests.post(
            f"{BASE_URL}/api/admin/announce",
            json={
                "content": "TEST_iter51 announce carousel",
                "media_type": "carousel",
                "slides": [{"type": "image", "image": u} for u in urls],
            },
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["media_type"] == "carousel"
        assert len(body["slides"]) == 2
        assert body.get("is_announcement") is True
        assert body.get("official") is True

    def test_announce_reel(self, admin_token):
        vurl = self._upload_announcement(admin_token, "video")
        r = requests.post(
            f"{BASE_URL}/api/admin/announce",
            json={
                "content": "TEST_iter51 announce reel",
                "media_type": "reel",
                "video": vurl,
                "duration_seconds": 20,
            },
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["media_type"] == "reel"
        assert body["video"] == vurl
        assert body["duration_seconds"] == 20

    def test_announce_carousel_under_2_slides_400(self, admin_token):
        url = self._upload_announcement(admin_token)
        r = requests.post(
            f"{BASE_URL}/api/admin/announce",
            json={
                "content": "needs at least one slide test",
                "media_type": "carousel",
                "slides": [{"type": "image", "image": url}],
            },
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=20,
        )
        assert r.status_code == 400
        assert "at least 2" in r.text.lower()

    def test_announce_reel_over_30s_400(self, admin_token):
        vurl = self._upload_announcement(admin_token, "video")
        r = requests.post(
            f"{BASE_URL}/api/admin/announce",
            json={
                "content": "reel over 30s cap test",
                "media_type": "reel",
                "video": vurl,
                "duration_seconds": 60,
            },
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=20,
        )
        assert r.status_code == 400
        assert "30 seconds" in r.text.lower() or "capped" in r.text.lower()
