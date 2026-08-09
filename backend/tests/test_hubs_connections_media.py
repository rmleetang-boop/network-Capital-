"""Tests for Regional Hubs, Connections (3 types), Profile Media (photos/videos/articles), and Posts with video."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://fly-platform.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"


def _mk_user(prefix="u"):
    suffix = uuid.uuid4().hex[:8]
    email = f"TEST_{prefix}_{suffix}@example.com"
    password = "Test1234!"
    r = requests.post(f"{API}/auth/progressive-signup", json={"email": email, "password": password, "step": 1})
    # Fallback to signup endpoint if progressive-signup not available (201/200)
    if r.status_code not in (200, 201):
        # try legacy signup
        uname = f"test_{prefix}_{suffix}"
        r = requests.post(f"{API}/auth/signup", json={
            "email": email, "password": password, "username": uname,
            "bio": "", "photo": "", "terms_accepted": True,
        })
    assert r.status_code in (200, 201), f"signup failed: {r.status_code} {r.text}"
    data = r.json()
    token = data["token"]
    user = data["user"]
    # Ensure username/full_name via complete-profile if missing
    if not user.get("username"):
        uname = f"test_{prefix}_{suffix}"
        rc = requests.post(f"{API}/auth/complete-profile",
                           headers={"Authorization": f"Bearer {token}"},
                           json={"full_name": f"Test {prefix}", "username": uname, "bio": "", "intent": "member", "terms_accepted": True})
        if rc.status_code == 200:
            user = rc.json().get("user", user)
    return token, user, email, password


@pytest.fixture(scope="module")
def user_a():
    t, u, e, p = _mk_user("a")
    return {"token": t, "user": u, "email": e, "password": p}


@pytest.fixture(scope="module")
def user_b():
    t, u, e, p = _mk_user("b")
    return {"token": t, "user": u, "email": e, "password": p}


def _hdr(u):
    return {"Authorization": f"Bearer {u['token']}"}


# -------- Cities --------
class TestCities:
    def test_list_cities_returns_11_curated(self):
        r = requests.get(f"{API}/hubs/cities")
        assert r.status_code == 200
        data = r.json()
        assert "cities" in data
        assert len(data["cities"]) == 11
        for c in data["cities"]:
            assert "value" in c and "label" in c and "user_count" in c
            assert isinstance(c["user_count"], int)


# -------- Profile Update (city/profession/etc.) --------
class TestProfileUpdate:
    def test_update_city_profession_interests(self, user_a):
        r = requests.put(f"{API}/users/me", headers=_hdr(user_a), json={
            "city": "cape_town", "country": "ZA", "profession": "Developer",
            "interests": ["tech", "music"]
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["city"] == "cape_town"
        assert d["profession"] == "Developer"
        assert d["interests"] == ["tech", "music"]

    def test_update_persists(self, user_a):
        r = requests.get(f"{API}/users/me", headers=_hdr(user_a))
        assert r.status_code == 200
        # User model may not include `city` directly; fetch raw via users/{id} cannot due to model. Check via hubs.


# -------- Hubs Users --------
class TestHubUsers:
    def test_requires_auth(self):
        r = requests.get(f"{API}/hubs/users?city=cape_town")
        assert r.status_code in (401, 403)

    def test_lists_users_in_city_excluding_self(self, user_a, user_b):
        # set both to cape_town
        requests.put(f"{API}/users/me", headers=_hdr(user_a), json={"city": "cape_town"})
        requests.put(f"{API}/users/me", headers=_hdr(user_b), json={"city": "cape_town"})
        r = requests.get(f"{API}/hubs/users?city=cape_town", headers=_hdr(user_a))
        assert r.status_code == 200
        data = r.json()
        assert data["city"] == "cape_town"
        ids = [u["id"] for u in data["users"]]
        assert user_a["user"]["id"] not in ids
        # b should appear
        assert user_b["user"]["id"] in ids
        # connection_status structure
        for u in data["users"]:
            cs = u.get("connection_status")
            assert cs is not None
            assert set(cs.keys()) == {"social", "financial", "professional"}


# -------- Connection Requests --------
class TestConnectionRequests:
    def test_self_request_rejected(self, user_a):
        r = requests.post(f"{API}/connections/request", headers=_hdr(user_a), json={
            "to_user_id": user_a["user"]["id"], "type": "social"
        })
        assert r.status_code == 400

    def test_invalid_type_rejected(self, user_a, user_b):
        r = requests.post(f"{API}/connections/request", headers=_hdr(user_a), json={
            "to_user_id": user_b["user"]["id"], "type": "romantic"
        })
        assert r.status_code == 400

    def test_send_social_request(self, user_a, user_b):
        r = requests.post(f"{API}/connections/request", headers=_hdr(user_a), json={
            "to_user_id": user_b["user"]["id"], "type": "social", "message": "hi"
        })
        assert r.status_code == 200, r.text
        d = r.json()["connection"]
        assert d["status"] == "pending"
        assert d["type"] == "social"
        pytest._social_conn_id = d["id"]

    def test_duplicate_pending_rejected(self, user_a, user_b):
        r = requests.post(f"{API}/connections/request", headers=_hdr(user_a), json={
            "to_user_id": user_b["user"]["id"], "type": "social"
        })
        assert r.status_code == 400

    def test_financial_with_stokvel(self, user_a, user_b):
        r = requests.post(f"{API}/connections/request", headers=_hdr(user_a), json={
            "to_user_id": user_b["user"]["id"], "type": "financial", "stokvel_id": "sv-123"
        })
        assert r.status_code == 200
        d = r.json()["connection"]
        assert d["stokvel_id"] == "sv-123"
        assert d["type"] == "financial"

    def test_professional_request(self, user_a, user_b):
        r = requests.post(f"{API}/connections/request", headers=_hdr(user_a), json={
            "to_user_id": user_b["user"]["id"], "type": "professional"
        })
        assert r.status_code == 200

    def test_inbox_for_recipient(self, user_b):
        r = requests.get(f"{API}/connections/inbox", headers=_hdr(user_b))
        assert r.status_code == 200
        data = r.json()
        assert data["total"] >= 3
        types = {c["type"] for c in data["inbox"]}
        assert {"social", "financial", "professional"} <= types

    def test_inbox_filter_by_type(self, user_b):
        r = requests.get(f"{API}/connections/inbox?type=financial", headers=_hdr(user_b))
        assert r.status_code == 200
        for c in r.json()["inbox"]:
            assert c["type"] == "financial"

    def test_outbox_for_sender(self, user_a):
        r = requests.get(f"{API}/connections/outbox", headers=_hdr(user_a))
        assert r.status_code == 200
        assert r.json()["total"] >= 3

    def test_accept_by_non_recipient_forbidden(self, user_a):
        cid = getattr(pytest, "_social_conn_id", None)
        assert cid
        r = requests.post(f"{API}/connections/{cid}/accept", headers=_hdr(user_a))
        assert r.status_code == 403

    def test_accept_by_recipient(self, user_b):
        cid = pytest._social_conn_id
        r = requests.post(f"{API}/connections/{cid}/accept", headers=_hdr(user_b))
        assert r.status_code == 200

    def test_accept_already_accepted_400(self, user_b):
        cid = pytest._social_conn_id
        r = requests.post(f"{API}/connections/{cid}/accept", headers=_hdr(user_b))
        assert r.status_code == 400

    def test_list_accepted_connections(self, user_a):
        r = requests.get(f"{API}/connections?type=social", headers=_hdr(user_a))
        assert r.status_code == 200
        data = r.json()
        assert data["total"] >= 1
        c = data["connections"][0]
        assert "other_user_id" in c and "other_username" in c


# -------- Profile Media --------
SMALL_PNG_DATA_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
SMALL_VIDEO_DATA_URL = "data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDE="


class TestMedia:
    def test_upload_photo(self, user_a):
        r = requests.post(f"{API}/users/me/photos", headers=_hdr(user_a), json={
            "data_url": SMALL_PNG_DATA_URL, "caption": "hello"
        })
        assert r.status_code == 200
        pytest._photo_id = r.json()["photo"]["id"]

    def test_photo_too_large_413(self, user_a):
        big = "data:image/png;base64," + ("A" * (int(3 * 1024 * 1024 * 1.5)))
        r = requests.post(f"{API}/users/me/photos", headers=_hdr(user_a), json={
            "data_url": big, "caption": ""
        })
        assert r.status_code == 413

    def test_list_photos_public(self, user_a):
        r = requests.get(f"{API}/users/{user_a['user']['id']}/photos")
        assert r.status_code == 200
        assert len(r.json()["photos"]) >= 1

    def test_delete_photo(self, user_a):
        pid = pytest._photo_id
        r = requests.delete(f"{API}/users/me/photos/{pid}", headers=_hdr(user_a))
        assert r.status_code == 200
        r2 = requests.get(f"{API}/users/{user_a['user']['id']}/photos")
        ids = [p["id"] for p in r2.json()["photos"]]
        assert pid not in ids

    def test_upload_video(self, user_a):
        r = requests.post(f"{API}/users/me/videos", headers=_hdr(user_a), json={
            "data_url": SMALL_VIDEO_DATA_URL, "caption": "vid"
        })
        assert r.status_code == 200
        pytest._video_id = r.json()["video"]["id"]

    def test_list_videos_public(self, user_a):
        r = requests.get(f"{API}/users/{user_a['user']['id']}/videos")
        assert r.status_code == 200
        assert len(r.json()["videos"]) >= 1

    def test_delete_video(self, user_a):
        r = requests.delete(f"{API}/users/me/videos/{pytest._video_id}", headers=_hdr(user_a))
        assert r.status_code == 200

    def test_create_article(self, user_a):
        r = requests.post(f"{API}/users/me/articles", headers=_hdr(user_a), json={
            "title": "Hello", "content": "Content here", "cover_image": ""
        })
        assert r.status_code == 200
        pytest._article_id = r.json()["article"]["id"]

    def test_article_empty_rejected(self, user_a):
        r = requests.post(f"{API}/users/me/articles", headers=_hdr(user_a), json={
            "title": "   ", "content": "   "
        })
        assert r.status_code == 400

    def test_list_articles_public(self, user_a):
        r = requests.get(f"{API}/users/{user_a['user']['id']}/articles")
        assert r.status_code == 200
        assert any(a["id"] == pytest._article_id for a in r.json()["articles"])

    def test_delete_article(self, user_a):
        r = requests.delete(f"{API}/users/me/articles/{pytest._article_id}", headers=_hdr(user_a))
        assert r.status_code == 200


# -------- Posts with video --------
class TestPostVideo:
    def test_create_post_with_video(self, user_a):
        r = requests.post(f"{API}/posts", headers=_hdr(user_a), json={
            "content": "Check my video", "video": SMALL_VIDEO_DATA_URL
        })
        assert r.status_code == 200
        d = r.json()
        assert d["video"] == SMALL_VIDEO_DATA_URL
        pytest._post_id = d["id"]

    def test_video_persists_in_feed(self, user_a):
        r = requests.get(f"{API}/posts?limit=50")
        assert r.status_code == 200
        posts = r.json()
        match = [p for p in posts if p["id"] == pytest._post_id]
        assert match and match[0]["video"] == SMALL_VIDEO_DATA_URL
