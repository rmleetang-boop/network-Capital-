"""DM (Direct Messaging) backend tests — iter 11"""
import os
import time
import uuid
import base64
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://system-repair-18.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


def _signup(prefix: str):
    suffix = uuid.uuid4().hex[:8]
    email = f"TEST_{prefix}_{suffix}@example.com"
    password = "Test123!"
    r = requests.post(f"{API}/auth/progressive-signup", json={"email": email, "password": password, "terms_accepted": True})
    assert r.status_code in (200, 201), f"signup failed {r.status_code} {r.text}"
    token = r.json()["token"]
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    cp = requests.post(f"{API}/auth/complete-profile", json={
        "full_name": f"Test {prefix} {suffix}",
        "username": f"test_{prefix}_{suffix}",
        "bio": "test user",
        "intent": "member",
        "terms_accepted": True,
    }, headers=headers)
    assert cp.status_code == 200, f"complete-profile failed {cp.status_code} {cp.text}"
    me = requests.get(f"{API}/users/me", headers=headers).json()
    return {"id": me["id"], "username": me["username"], "token": token, "headers": headers, "email": email}


@pytest.fixture(scope="module")
def user_a():
    return _signup("dmA")


@pytest.fixture(scope="module")
def user_b():
    return _signup("dmB")


# -------- /dm/compliance-check --------
class TestCompliance:
    def test_dirty_text_returns_flags(self, user_a):
        r = requests.post(f"{API}/dm/compliance-check",
                          json={"text": "great investment with 20% returns guaranteed"},
                          headers=user_a["headers"])
        assert r.status_code == 200
        flags = r.json()["flags"]
        words_to_sugg = {f["word"]: f["suggestion"] for f in flags}
        assert words_to_sugg.get("investment") == "contribution"
        assert words_to_sugg.get("returns") == "rewards"
        assert words_to_sugg.get("guaranteed") == "planned"

    def test_clean_text_returns_empty(self, user_a):
        r = requests.post(f"{API}/dm/compliance-check",
                          json={"text": "hello there friend"},
                          headers=user_a["headers"])
        assert r.status_code == 200
        assert r.json()["flags"] == []

    def test_compliance_no_auth_401(self):
        r = requests.post(f"{API}/dm/compliance-check", json={"text": "hi"})
        assert r.status_code in (401, 403)


# -------- /dm/send --------
class TestSend:
    def test_send_clean_text(self, user_a, user_b):
        r = requests.post(f"{API}/dm/send",
                          json={"recipient_id": user_b["id"], "text": "hello"},
                          headers=user_a["headers"])
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["compliance_warnings"] == []
        assert body["message"]["text"] == "hello"
        assert body["message"]["sender_id"] == user_a["id"]
        assert body["message"]["recipient_id"] == user_b["id"]
        assert "id" in body["message"]
        assert "thread_key" in body["message"]

    def test_send_with_compliance_word_still_succeeds(self, user_a, user_b):
        r = requests.post(f"{API}/dm/send",
                          json={"recipient_id": user_b["id"], "text": "we made a profit today"},
                          headers=user_a["headers"])
        assert r.status_code == 200
        warnings = r.json()["compliance_warnings"]
        assert any(w["word"] == "profit" and w["suggestion"] == "support" for w in warnings)
        # message also embeds it
        assert any(w["word"] == "profit" for w in r.json()["message"]["compliance_warnings"])

    def test_send_to_self_400(self, user_a):
        r = requests.post(f"{API}/dm/send",
                          json={"recipient_id": user_a["id"], "text": "hi me"},
                          headers=user_a["headers"])
        assert r.status_code == 400

    def test_send_empty_no_media_400(self, user_a, user_b):
        r = requests.post(f"{API}/dm/send",
                          json={"recipient_id": user_b["id"], "text": ""},
                          headers=user_a["headers"])
        assert r.status_code == 400

    def test_send_unknown_recipient_404(self, user_a):
        r = requests.post(f"{API}/dm/send",
                          json={"recipient_id": "nonexistent-user-id-xyz", "text": "hi"},
                          headers=user_a["headers"])
        assert r.status_code == 404

    def test_send_unknown_shared_post_still_sends(self, user_a, user_b):
        r = requests.post(f"{API}/dm/send",
                          json={"recipient_id": user_b["id"], "shared_post_id": "no-such-post-xyz"},
                          headers=user_a["headers"])
        assert r.status_code == 200
        assert r.json()["message"]["shared_post"] is None

    def test_send_with_real_shared_post_denormalizes(self, user_a, user_b):
        # create a post first (try /api/posts)
        post_payload = {"content": "my latest update", "post_type": "text"}
        pr = requests.post(f"{API}/posts", json=post_payload, headers=user_a["headers"])
        if pr.status_code not in (200, 201):
            pytest.skip(f"posts endpoint not available: {pr.status_code}")
        post_id = pr.json().get("id") or pr.json().get("post", {}).get("id")
        if not post_id:
            pytest.skip("post id missing in response")
        r = requests.post(f"{API}/dm/send",
                          json={"recipient_id": user_b["id"], "shared_post_id": post_id},
                          headers=user_a["headers"])
        assert r.status_code == 200
        sp = r.json()["message"]["shared_post"]
        assert sp is not None
        assert sp["id"] == post_id
        assert sp["username"] == user_a["username"]

    def test_send_oversized_image_413(self, user_a, user_b):
        # ~5MB base64 string
        big = "data:image/png;base64," + ("A" * (5 * 1024 * 1024))
        r = requests.post(f"{API}/dm/send",
                          json={"recipient_id": user_b["id"], "image": big},
                          headers=user_a["headers"])
        assert r.status_code == 413

    def test_send_no_auth_401(self, user_b):
        r = requests.post(f"{API}/dm/send", json={"recipient_id": user_b["id"], "text": "hi"})
        assert r.status_code in (401, 403)


# -------- /dm/threads --------
class TestThreads:
    def test_threads_list_sorted_desc(self, user_a, user_b):
        # Make sure A->B has at least one msg
        requests.post(f"{API}/dm/send",
                      json={"recipient_id": user_b["id"], "text": "thread test 1"},
                      headers=user_a["headers"])
        time.sleep(0.3)
        r = requests.get(f"{API}/dm/threads", headers=user_a["headers"])
        assert r.status_code == 200
        body = r.json()
        threads = body["threads"]
        assert len(threads) >= 1
        # Find the thread with user_b
        t = next((x for x in threads if x["other_user_id"] == user_b["id"]), None)
        assert t is not None
        assert t["other_username"] == user_b["username"]
        # ordering check (descending by last_at)
        if len(threads) >= 2:
            for i in range(len(threads) - 1):
                assert threads[i]["last_at"] >= threads[i + 1]["last_at"]

    def test_threads_no_auth_401(self):
        r = requests.get(f"{API}/dm/threads")
        assert r.status_code in (401, 403)


# -------- /dm/threads/:other_user_id --------
class TestThreadMessages:
    def test_thread_messages_ascending(self, user_a, user_b):
        requests.post(f"{API}/dm/send",
                      json={"recipient_id": user_b["id"], "text": "msg-asc-1"},
                      headers=user_a["headers"])
        time.sleep(0.2)
        requests.post(f"{API}/dm/send",
                      json={"recipient_id": user_b["id"], "text": "msg-asc-2"},
                      headers=user_a["headers"])
        time.sleep(0.2)
        r = requests.get(f"{API}/dm/threads/{user_b['id']}", headers=user_a["headers"])
        assert r.status_code == 200
        body = r.json()
        assert body["other_user"]["id"] == user_b["id"]
        assert body["other_user"]["username"] == user_b["username"]
        assert "thread_key" in body
        msgs = body["messages"]
        assert len(msgs) >= 2
        for i in range(len(msgs) - 1):
            assert msgs[i]["created_at"] <= msgs[i + 1]["created_at"]

    def test_thread_messages_self_400(self, user_a):
        r = requests.get(f"{API}/dm/threads/{user_a['id']}", headers=user_a["headers"])
        assert r.status_code == 400

    def test_thread_messages_unknown_user_404(self, user_a):
        r = requests.get(f"{API}/dm/threads/no-such-user-xyz-zzz", headers=user_a["headers"])
        assert r.status_code == 404

    def test_both_participants_see_same_messages(self, user_a, user_b):
        unique = uuid.uuid4().hex[:6]
        text = f"shared-vis-{unique}"
        requests.post(f"{API}/dm/send",
                      json={"recipient_id": user_b["id"], "text": text},
                      headers=user_a["headers"])
        time.sleep(0.3)
        ra = requests.get(f"{API}/dm/threads/{user_b['id']}", headers=user_a["headers"]).json()
        rb = requests.get(f"{API}/dm/threads/{user_a['id']}", headers=user_b["headers"]).json()
        assert ra["thread_key"] == rb["thread_key"]
        a_texts = [m["text"] for m in ra["messages"]]
        b_texts = [m["text"] for m in rb["messages"]]
        assert text in a_texts
        assert text in b_texts

    def test_thread_messages_no_auth_401(self, user_b):
        r = requests.get(f"{API}/dm/threads/{user_b['id']}")
        assert r.status_code in (401, 403)
