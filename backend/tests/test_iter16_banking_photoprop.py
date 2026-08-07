"""
Iteration 16 backend tests:
- Banking moved off signup -> complete-profile must succeed without banking fields
- POST /api/users/me/banking still works with auth; rejects unauth
- GET /api/users/me/banking masks account_number (no full account_number leak)
- Profile photo propagation to posts.user_photo, stories.user_photo, dm_messages.sender_photo
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://shopify-clone-704.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


def _rand_email(prefix="iter16"):
    return f"TEST_{prefix}_{uuid.uuid4().hex[:8]}@example.com"


def _register(intent="member", with_country=False):
    """Progressive signup + complete-profile (no banking)."""
    email = _rand_email()
    r = requests.post(
        f"{API}/auth/progressive-signup",
        json={"email": email, "password": "Test123!"},
        timeout=20,
    )
    assert r.status_code == 200, f"signup failed: {r.status_code} {r.text}"
    body = r.json()
    token = body.get("access_token") or body.get("token")
    assert token, f"no token in signup response: {body}"
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "full_name": "Iter16 User",
        "username": f"iter16_{uuid.uuid4().hex[:6]}",
        "bio": "test",
        "intent": intent,
        "terms_accepted": True,
    }
    if with_country:
        payload.update({"country": "south_africa", "province": "gauteng", "city": "johannesburg"})

    r2 = requests.post(f"{API}/auth/complete-profile", json=payload, headers=headers, timeout=20)
    assert r2.status_code == 200, f"complete-profile failed: {r2.status_code} {r2.text}"
    user = r2.json()["user"]
    return {"token": token, "headers": headers, "user": user, "email": email}


# ===== Banking endpoints =====

class TestBankingEndpoints:
    def test_complete_profile_without_banking_succeeds(self):
        ctx = _register()
        assert ctx["user"]["id"]
        assert ctx["user"].get("banking") in (None, {}, ""), "Banking should NOT be set when not provided"

    def test_get_banking_returns_on_file_false_when_unset(self):
        ctx = _register()
        r = requests.get(f"{API}/users/me/banking", headers=ctx["headers"], timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert body == {"on_file": False}

    def test_post_banking_unauth_rejected(self):
        r = requests.post(
            f"{API}/users/me/banking",
            json={
                "bank_name": "Standard Bank",
                "account_number": "1234567890",
                "swift_code": "sbzazajj",
                "branch_number": "051001",
            },
            timeout=15,
        )
        assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code}"

    def test_post_banking_auth_persists_and_get_masks(self):
        ctx = _register()
        r = requests.post(
            f"{API}/users/me/banking",
            json={
                "bank_name": "Standard Bank",
                "account_number": "1234567890",
                "swift_code": "sbzazajj",
                "branch_number": "051001",
            },
            headers=ctx["headers"],
            timeout=15,
        )
        assert r.status_code == 200, r.text
        assert r.json().get("banking_saved") is True

        g = requests.get(f"{API}/users/me/banking", headers=ctx["headers"], timeout=15)
        assert g.status_code == 200
        body = g.json()
        assert body["on_file"] is True
        assert body["account_last4"] == "7890"
        assert body["account_masked"].endswith("7890")
        assert "•" in body["account_masked"]
        assert body["swift_code"] == "SBZAZAJJ"  # uppercased
        # Critical: no full account_number leak
        assert "account_number" not in body, f"Full account_number leaked! {body}"


# ===== Photo propagation =====

class TestPhotoPropagation:
    def _make_post(self, headers):
        r = requests.post(
            f"{API}/posts",
            json={"content": f"iter16 propagation test {uuid.uuid4().hex[:6]}"},
            headers=headers,
            timeout=20,
        )
        assert r.status_code == 200, r.text
        return r.json()

    def _update_photo(self, headers, photo):
        r = requests.put(f"{API}/users/me", json={"photo": photo}, headers=headers, timeout=20)
        assert r.status_code == 200, r.text
        return r.json()

    def test_post_user_photo_updates_after_put_users_me(self):
        ctx = _register()
        post = self._make_post(ctx["headers"])
        post_id = post["id"]
        # initially user_photo is empty
        assert post.get("user_photo", "") == ""

        new_photo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wt5l00AAAAASUVORK5CYII="
        self._update_photo(ctx["headers"], new_photo)
        time.sleep(0.5)

        r = requests.get(f"{API}/posts", headers=ctx["headers"], timeout=20)
        assert r.status_code == 200
        posts = r.json()
        my_post = next((p for p in posts if p.get("id") == post_id), None)
        assert my_post is not None, "created post not visible in /api/posts"
        assert my_post.get("user_photo") == new_photo, f"user_photo did NOT propagate: got {my_post.get('user_photo')!r}"

    def test_story_user_photo_updates_after_put_users_me(self):
        ctx = _register()
        # Create story (image required by /api/stories)
        story_img = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wt5l00AAAAASUVORK5CYII="
        cs = requests.post(
            f"{API}/stories",
            json={"media_type": "image", "media_url": story_img, "caption": "iter16"},
            headers=ctx["headers"],
            timeout=20,
        )
        assert cs.status_code == 200, f"/api/stories: {cs.status_code} {cs.text[:300]}"

        new_photo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wt5l00AAAAASUVORK5CYII="
        self._update_photo(ctx["headers"], new_photo)
        time.sleep(0.5)

        # Use stories/feed which lists current user's stories
        r = requests.get(f"{API}/stories/feed", headers=ctx["headers"], timeout=20)
        assert r.status_code == 200, r.text
        feed = r.json()
        # feed structure may vary; flatten any list of stories or buckets
        stories = []
        if isinstance(feed, list):
            for item in feed:
                if isinstance(item, dict) and item.get("user_id"):
                    stories.append(item)
                elif isinstance(item, dict) and isinstance(item.get("stories"), list):
                    stories.extend(item["stories"])
        elif isinstance(feed, dict):
            for grp in feed.get("groups", []) or []:
                stories.extend(grp.get("stories") or [])
            stories.extend(feed.get("stories") or [])
        mine = [s for s in stories if s.get("user_id") == ctx["user"]["id"]]
        assert mine, f"no stories returned for current user; feed={feed}"
        assert all(s.get("user_photo") == new_photo for s in mine), \
            f"story user_photo did NOT propagate: {[s.get('user_photo') for s in mine]}"

    def test_dm_sender_photo_updates_after_put_users_me(self):
        a = _register()
        b = _register()
        # A sends DM to B
        send = requests.post(
            f"{API}/dm/send",
            json={"recipient_id": b["user"]["id"], "text": "hello iter16"},
            headers=a["headers"],
            timeout=20,
        )
        assert send.status_code == 200, f"/api/dm/send: {send.status_code} {send.text[:300]}"

        new_photo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wt5l00AAAAASUVORK5CYII="
        self._update_photo(a["headers"], new_photo)
        time.sleep(0.5)

        # B fetches thread with A
        r = requests.get(f"{API}/dm/threads/{a['user']['id']}", headers=b["headers"], timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        msgs = body.get("messages") if isinstance(body, dict) else body
        assert msgs, f"empty thread response: {body}"
        # find messages where sender_id == A
        from_a = [m for m in msgs if m.get("sender_id") == a["user"]["id"]]
        assert from_a, "no messages from A in thread"
        assert all(m.get("sender_photo") == new_photo for m in from_a), \
            f"sender_photo did NOT propagate: {[m.get('sender_photo') for m in from_a]}"


# ===== Regression: complete-profile no banking =====

class TestCompleteProfileRegression:
    def test_complete_profile_with_country_only(self):
        ctx = _register(with_country=True)
        u = ctx["user"]
        assert u.get("country") == "south_africa"
        assert u.get("province") == "gauteng"
        assert u.get("city") == "johannesburg"
        assert not u.get("banking"), "banking should NOT be set"
