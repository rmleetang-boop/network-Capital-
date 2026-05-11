"""
Iter25 backend tests:
- My Places (create/list/get/review/claim/owner-reply)
- My Network (request/accept/reject/summary/list)
- Job reactions (like/dislike/share) + clean share URL
- Admin bootstrap, metrics, role mgmt, users-list
- Score engine: place_review_create +40, connection_made +25 both sides, job_share +20
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_PASSWORD = "NetworkCapital2025!"


# ------------------------- helpers -------------------------
def _new_user(prefix="iter25"):
    email = f"TEST_{prefix}_{int(time.time()*1000)}_{uuid.uuid4().hex[:6]}@example.com"
    r = requests.post(f"{API}/auth/progressive-signup",
                      json={"email": email, "password": "Test123!", "step": 1}, timeout=20)
    assert r.status_code == 200, f"signup failed: {r.status_code} {r.text}"
    token = r.json()["token"]
    h = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    # OTP
    o = requests.post(f"{API}/auth/send-otp", headers=h, json={"email": email}, timeout=20).json()
    code = o.get("_mock_code") or o.get("code")
    assert code, f"no mock code: {o}"
    requests.post(f"{API}/auth/verify-otp", headers=h, json={"email": email, "code": code}, timeout=20)
    # complete profile
    uname = f"u{int(time.time()*1000)}{uuid.uuid4().hex[:4]}"
    requests.post(f"{API}/auth/complete-profile", headers=h,
                  json={"full_name": "Test User", "username": uname,
                        "bio": "qa", "intent": "member", "terms_accepted": True,
                        "birth_month": 6}, timeout=20)
    me = requests.get(f"{API}/users/me", headers=h, timeout=20).json()
    return {"token": token, "headers": h, "id": me["id"], "email": email,
            "username": me.get("username"), "monthly_score": me.get("monthly_score", 0)}


@pytest.fixture(scope="module")
def user_a():
    return _new_user("A")


@pytest.fixture(scope="module")
def user_b():
    return _new_user("B")


@pytest.fixture(scope="module")
def admin_user():
    u = _new_user("ADMIN")
    r = requests.post(f"{API}/admin/bootstrap",
                      headers={**u["headers"], "X-Admin-Password": ADMIN_PASSWORD},
                      timeout=20)
    assert r.status_code == 200, f"bootstrap failed: {r.status_code} {r.text}"
    return u


def _score(headers):
    r = requests.get(f"{API}/users/me", headers=headers, timeout=20).json()
    return r.get("monthly_score", 0)


# ============== MY PLACES =================================
class TestPlaces:
    def test_create_and_get(self, user_a):
        r = requests.post(f"{API}/places", headers=user_a["headers"],
                          json={"name": "TEST_iter25_Cafe", "category": "restaurant",
                                "city": "Cape Town", "description": "QA"}, timeout=20)
        assert r.status_code == 200, r.text
        p = r.json()
        assert p["claim_status"] == "unclaimed"
        assert p["review_count"] == 0
        pytest.shared_place_id = p["id"]
        # GET single
        r = requests.get(f"{API}/places/{p['id']}", timeout=20)
        assert r.status_code == 200 and r.json()["id"] == p["id"]
        # LIST
        r = requests.get(f"{API}/places", params={"category": "restaurant"}, timeout=20)
        assert r.status_code == 200
        assert any(pl["id"] == p["id"] for pl in r.json())

    def test_review_awards_40_and_dup_409(self, user_a, user_b):
        pid = pytest.shared_place_id
        score_before = _score(user_b["headers"])
        r = requests.post(f"{API}/places/{pid}/reviews", headers=user_b["headers"],
                          json={"rating": 5, "title": "Great", "body": "Excellent place!!"}, timeout=20)
        assert r.status_code == 200, r.text
        rev = r.json()
        pytest.shared_review_id = rev["id"]
        score_after = _score(user_b["headers"])
        delta = score_after - score_before
        # Base +40, founder 2× window may yield +80 — accept either (per agent context note)
        assert delta >= 40 and delta % 40 == 0, f"expected +40 (or 2× +80) got {delta}"
        # average updated
        place = requests.get(f"{API}/places/{pid}", timeout=20).json()
        assert place["review_count"] == 1
        assert place["average_rating"] == 5.0
        # dup → 409
        r2 = requests.post(f"{API}/places/{pid}/reviews", headers=user_b["headers"],
                           json={"rating": 4, "body": "trying again duplicate"}, timeout=20)
        assert r2.status_code == 409, r2.text

    def test_delete_review_recomputes(self, user_b):
        pid = pytest.shared_place_id
        rid = pytest.shared_review_id
        # Capture score before delete (after review +40 or +80 due to founder 2×)
        score_before_delete = _score(user_b["headers"])
        r = requests.delete(f"{API}/places/{pid}/reviews/{rid}", headers=user_b["headers"], timeout=20)
        assert r.status_code == 200
        place = requests.get(f"{API}/places/{pid}", timeout=20).json()
        assert place["review_count"] == 0
        assert place["average_rating"] == 0.0
        # iter25 minor #2: delete must revoke the +40 (or +80) score event
        score_after_delete = _score(user_b["headers"])
        revoked = score_before_delete - score_after_delete
        assert revoked >= 40 and revoked % 40 == 0, (
            f"expected score revoke of -40 (or 2× -80) on review delete, got {revoked}"
        )

    def test_claim_flow(self, user_a, user_b, admin_user):
        pid = pytest.shared_place_id
        r = requests.post(f"{API}/places/{pid}/claim", headers=user_b["headers"],
                          json={"proof": "I own this", "contact_email": "x@y.com"}, timeout=20)
        assert r.status_code == 200, r.text
        claim_id = r.json()["id"]
        place = requests.get(f"{API}/places/{pid}", timeout=20).json()
        assert place["claim_status"] == "pending"
        # admin approve
        r = requests.post(f"{API}/admin/places/claims/{claim_id}/approve",
                          headers=admin_user["headers"], timeout=20)
        assert r.status_code == 200, r.text
        place = requests.get(f"{API}/places/{pid}", timeout=20).json()
        assert place["claim_status"] == "claimed"
        assert place["owner_id"] == user_b["id"]

    def test_owner_reply(self, user_a, user_b):
        pid = pytest.shared_place_id
        # Another user adds a review (user_a)
        rr = requests.post(f"{API}/places/{pid}/reviews", headers=user_a["headers"],
                           json={"rating": 4, "body": "Owner reply test review"}, timeout=20)
        assert rr.status_code == 200, rr.text
        rid = rr.json()["id"]
        # user_b is now owner → reply allowed
        r = requests.post(f"{API}/places/{pid}/reviews/{rid}/reply",
                          headers=user_b["headers"], json={"reply": "Thanks!"}, timeout=20)
        assert r.status_code == 200, r.text
        # user_a (non-owner) should be forbidden
        r2 = requests.post(f"{API}/places/{pid}/reviews/{rid}/reply",
                           headers=user_a["headers"], json={"reply": "nope"}, timeout=20)
        assert r2.status_code in (401, 403), r2.text


# ============== MY NETWORK ================================
class TestNetwork:
    def test_request_idempotent(self, user_a, user_b):
        r1 = requests.post(f"{API}/connections/request", headers=user_a["headers"],
                           json={"target_user_id": user_b["id"], "kind": "social"}, timeout=20)
        assert r1.status_code == 200, r1.text
        cid1 = r1.json()["id"]
        r2 = requests.post(f"{API}/connections/request", headers=user_a["headers"],
                           json={"target_user_id": user_b["id"], "kind": "social"}, timeout=20)
        assert r2.status_code == 200
        assert r2.json()["id"] == cid1, "Deterministic conn_id should collide"
        pytest.shared_conn_id = cid1

    def test_accept_awards_25_both_sides(self, user_a, user_b):
        a_before = _score(user_a["headers"])
        b_before = _score(user_b["headers"])
        cid = pytest.shared_conn_id
        # only recipient (user_b) can accept
        bad = requests.post(f"{API}/connections/{cid}/accept", headers=user_a["headers"], timeout=20)
        assert bad.status_code == 403
        r = requests.post(f"{API}/connections/{cid}/accept", headers=user_b["headers"], timeout=20)
        assert r.status_code == 200 and r.json()["status"] == "accepted"
        a_after = _score(user_a["headers"])
        b_after = _score(user_b["headers"])
        # Founder 2x multiplier may apply silently — accept positive multiples of 25
        a_delta = a_after - a_before
        b_delta = b_after - b_before
        assert a_delta >= 25 and a_delta % 25 == 0, f"A expected k*25 got {a_delta}"
        assert b_delta >= 25 and b_delta % 25 == 0, f"B expected k*25 got {b_delta}"
        # duplicate accept → no extra points
        r2 = requests.post(f"{API}/connections/{cid}/accept", headers=user_b["headers"], timeout=20)
        assert r2.status_code == 200
        assert _score(user_a["headers"]) - a_after == 0
        assert _score(user_b["headers"]) - b_after == 0

    def test_summary_counts(self, user_a, user_b):
        r = requests.get(f"{API}/connections/me/summary", headers=user_a["headers"], timeout=20)
        assert r.status_code == 200
        s = r.json()
        assert s["counts"]["social"] >= 1
        assert "pending_incoming" in s
        # network-summary endpoint for another user
        r2 = requests.get(f"{API}/users/{user_b['id']}/network-summary",
                          headers=user_a["headers"], timeout=20)
        assert r2.status_code == 200
        assert r2.json()["counts"]["social"] >= 1

    def test_list_with_filter_and_enrichment(self, user_a, user_b):
        r = requests.get(f"{API}/connections/me",
                         headers=user_a["headers"],
                         params={"kind": "social", "status_filter": "accepted"}, timeout=20)
        assert r.status_code == 200
        rows = r.json()
        assert len(rows) >= 1
        row = next(c for c in rows if c["id"] == pytest.shared_conn_id)
        assert row["other_user"].get("id") == user_b["id"]
        assert "direction" in row

    def test_reject_path(self, user_a, user_b):
        # New pending request → user_a wants professional with user_b → user_b rejects
        r = requests.post(f"{API}/connections/request", headers=user_a["headers"],
                          json={"target_user_id": user_b["id"], "kind": "professional"}, timeout=20)
        cid = r.json()["id"]
        bad = requests.post(f"{API}/connections/{cid}/reject", headers=user_a["headers"], timeout=20)
        assert bad.status_code == 403
        ok = requests.post(f"{API}/connections/{cid}/reject", headers=user_b["headers"], timeout=20)
        assert ok.status_code == 200 and ok.json()["status"] == "rejected"


# ============== JOB REACTIONS & SHARE ======================
@pytest.fixture(scope="module")
def seeded_job_id(admin_user):
    """Find an existing job from the seed, or create one via admin (any open job)."""
    r = requests.get(f"{API}/jobs", timeout=20)
    if r.status_code == 200:
        jobs = r.json() if isinstance(r.json(), list) else r.json().get("jobs") or []
        if jobs:
            return jobs[0]["id"]
    pytest.skip("No seed jobs available to test reactions")


class TestJobReactions:
    def test_react_toggle_and_switch(self, user_a, seeded_job_id):
        # like
        r = requests.post(f"{API}/jobs/{seeded_job_id}/react", headers=user_a["headers"],
                          json={"reaction": "like"}, timeout=20)
        assert r.status_code == 200, r.text
        d1 = r.json()
        assert d1["mine"] == "like"
        # same like again → toggle off
        r = requests.post(f"{API}/jobs/{seeded_job_id}/react", headers=user_a["headers"],
                          json={"reaction": "like"}, timeout=20)
        assert r.status_code == 200 and r.json()["mine"] is None
        # like then switch to dislike
        requests.post(f"{API}/jobs/{seeded_job_id}/react", headers=user_a["headers"],
                      json={"reaction": "like"}, timeout=20)
        r = requests.post(f"{API}/jobs/{seeded_job_id}/react", headers=user_a["headers"],
                         json={"reaction": "dislike"}, timeout=20)
        assert r.status_code == 200 and r.json()["mine"] == "dislike"
        # GET reactions matches
        g = requests.get(f"{API}/jobs/{seeded_job_id}/reactions", headers=user_a["headers"], timeout=20)
        assert g.status_code == 200 and g.json()["mine"] == "dislike"

    def test_react_404_for_bad_job(self, user_a):
        r = requests.post(f"{API}/jobs/nonexistent-job-id/react", headers=user_a["headers"],
                          json={"reaction": "like"}, timeout=20)
        assert r.status_code == 404, r.text

    def test_share_clean_url_and_award(self, user_a, seeded_job_id):
        before = _score(user_a["headers"])
        r = requests.post(f"{API}/jobs/{seeded_job_id}/share", headers=user_a["headers"], timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["ok"] is True
        assert d["url"].startswith("https://networkcapitalapp.co.za/jobs/")
        assert "emergent" not in d["url"].lower()
        assert "preview" not in d["url"].lower()
        after = _score(user_a["headers"])
        delta = after - before
        # Base +20, founder 2× window may yield +40 — accept either
        assert delta >= 20 and delta % 20 == 0, f"expected +20 (or 2× +40) got {delta}"

    def test_share_404_for_bad_job(self, user_a):
        r = requests.post(f"{API}/jobs/nonexistent-job-id/share", headers=user_a["headers"], timeout=20)
        assert r.status_code == 404


# ============== ADMIN ======================================
class TestAdmin:
    def test_bootstrap_wrong_password(self, user_a):
        r = requests.post(f"{API}/admin/bootstrap",
                          headers={**user_a["headers"], "X-Admin-Password": "WRONG"}, timeout=20)
        assert r.status_code == 403

    def test_dashboard_metrics(self, admin_user):
        r = requests.get(f"{API}/admin/dashboard/metrics", headers=admin_user["headers"], timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        for key in ("users", "stokvels", "feed", "jobs", "places", "network", "top_contributors"):
            assert key in d, f"missing key {key}"
        for k in ("total", "new_7d", "new_30d", "premium", "growth_30d_pct"):
            assert k in d["users"], f"users.{k} missing"

    def test_dashboard_metrics_forbidden_for_user(self, user_a):
        r = requests.get(f"{API}/admin/dashboard/metrics", headers=user_a["headers"], timeout=20)
        assert r.status_code == 403

    def test_users_list_filters(self, admin_user, user_a):
        r = requests.get(f"{API}/admin/users-list", headers=admin_user["headers"],
                         params={"q": user_a["email"][:15]}, timeout=20)
        assert r.status_code == 200
        users = r.json()
        assert isinstance(users, list)

    def test_patch_role(self, admin_user, user_a):
        r = requests.patch(f"{API}/admin/users/{user_a['id']}/role",
                           headers=admin_user["headers"],
                           json={"role": "moderator"}, timeout=20)
        assert r.status_code == 200 and r.json()["role"] == "moderator"
        # revert
        r2 = requests.patch(f"{API}/admin/users/{user_a['id']}/role",
                            headers=admin_user["headers"],
                            json={"role": "user"}, timeout=20)
        assert r2.status_code == 200


# ============== REGRESSION ================================
class TestRegression:
    def test_jobs_list(self):
        r = requests.get(f"{API}/jobs", timeout=20)
        assert r.status_code == 200

    def test_score_summary(self, user_a):
        r = requests.get(f"{API}/score/summary", headers=user_a["headers"], timeout=20)
        assert r.status_code == 200, r.text

    def test_user_kind_put(self, user_a):
        r = requests.put(f"{API}/users/me", headers=user_a["headers"],
                         json={"user_kind": "social"}, timeout=20)
        assert r.status_code in (200, 204)

    def test_posts_crud_quick(self, user_a):
        r = requests.post(f"{API}/posts", headers=user_a["headers"],
                          json={"content": "TEST_iter25 post"}, timeout=20)
        assert r.status_code == 200, r.text
        pid = r.json().get("id") or r.json().get("post", {}).get("id")
        if pid:
            d = requests.delete(f"{API}/posts/{pid}", headers=user_a["headers"], timeout=20)
            assert d.status_code in (200, 204)
