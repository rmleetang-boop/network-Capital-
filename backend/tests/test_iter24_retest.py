"""
Iteration 24 — Retest of 4 fixes from iter23.
1. BE: duplicate POST /api/jobs/{id}/apply returns 409 (was 400).
2. Regression: minimal critical paths (signup OTP fallback, jobs list, /score/summary, posts CRUD, account deactivate/reactivate).

Frontend retests (FE BUG #1 JobRow click nav, FE BUG #2 user_kind toggle, FE BUG #3 unlock CTA)
are exercised via Playwright in a separate run.
"""
import os
import time
import base64
import uuid
import requests
import pytest
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

_mongo = MongoClient(MONGO_URL)
_db = _mongo[DB_NAME]


def _signup(user_kind: str = "social"):
    email = f"TEST_iter24_{uuid.uuid4().hex[:8]}@example.com"
    password = "Test123!"

    r = requests.post(f"{API}/auth/progressive-signup",
                      json={"email": email, "password": password, "step": 1}, timeout=30)
    assert r.status_code == 200, f"signup failed: {r.status_code} {r.text}"
    token = r.json()["token"]
    h = {"Authorization": f"Bearer {token}"}

    r = requests.post(f"{API}/auth/send-otp", headers=h, json={"email": email}, timeout=30)
    assert r.status_code == 200
    code = r.json().get("_mock_code")
    assert code

    r = requests.post(f"{API}/auth/verify-otp", headers=h, json={"email": email, "code": code}, timeout=30)
    assert r.status_code == 200

    r = requests.post(f"{API}/auth/complete-profile", headers=h, json={
        "full_name": "Iter24 QA",
        "username": f"iter24_{uuid.uuid4().hex[:8]}",
        "bio": "qa", "intent": "member", "terms_accepted": True,
        "birth_month": 6, "user_kind": user_kind,
    }, timeout=30)
    assert r.status_code == 200, f"complete-profile failed: {r.status_code} {r.text}"

    me = requests.get(f"{API}/users/me", headers=h, timeout=30).json()
    return token, email, me["id"], me, h


@pytest.fixture(scope="module")
def poster():
    """Professional user with job_post_unlocked=true (set via direct DB update)."""
    token, email, uid, me, h = _signup("professional")
    _db.users.update_one({"id": uid}, {"$set": {"user_kind": "professional", "job_post_unlocked": True}})
    return {"token": token, "email": email, "id": uid, "headers": h}


@pytest.fixture(scope="module")
def applicant():
    """Standard social user with high enough score (we'll create a min_score=0 job, so any score works)."""
    token, email, uid, me, h = _signup("social")
    return {"token": token, "email": email, "id": uid, "headers": h}


@pytest.fixture(scope="module")
def open_job(poster):
    """Job with min_network_score=0 so applicant can apply."""
    payload = {
        "title": "QA Open Role iter24",
        "description": "Open to all for testing duplicate-apply 409.",
        "company": "QA Co",
        "location": "Remote",
        "min_network_score": 0,
    }
    r = requests.post(f"{API}/jobs", headers=poster["headers"], json=payload, timeout=30)
    assert r.status_code in (200, 201), f"create job failed: {r.status_code} {r.text}"
    job = r.json()
    return job


# ============================================ FIX #4: duplicate-apply → 409 ===

class TestDuplicateApply409:
    def _pdf_data_url(self):
        pdf = b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"
        return "data:application/pdf;base64," + base64.b64encode(pdf).decode()

    def test_first_apply_succeeds(self, applicant, open_job):
        r = requests.post(
            f"{API}/jobs/{open_job['id']}/apply",
            headers=applicant["headers"],
            json={"cv_filename": "cv.pdf", "cv_data_url": self._pdf_data_url(), "cover_note": "First try"},
            timeout=30,
        )
        assert r.status_code == 200, f"first apply should succeed, got {r.status_code}: {r.text}"
        body = r.json()
        assert body.get("id") or body.get("ok") or body.get("application_id") or "status" in body

    def test_duplicate_apply_returns_409(self, applicant, open_job):
        r = requests.post(
            f"{API}/jobs/{open_job['id']}/apply",
            headers=applicant["headers"],
            json={"cv_filename": "cv.pdf", "cv_data_url": self._pdf_data_url(), "cover_note": "Try 2"},
            timeout=30,
        )
        assert r.status_code == 409, f"duplicate apply must be 409, got {r.status_code}: {r.text}"
        assert "already applied" in r.text.lower()


# ============================================ Regression sanity ===============

class TestRegression:
    def test_jobs_list_seed_present(self):
        r = requests.get(f"{API}/jobs", timeout=30)
        assert r.status_code == 200
        jobs = r.json()
        assert any(j.get("title") == "Business Developer Agent" for j in jobs)
        for j in jobs:
            assert "_id" not in j

    def test_score_summary(self, applicant):
        r = requests.get(f"{API}/score/summary", headers=applicant["headers"], timeout=30)
        assert r.status_code == 200

    def test_posts_crud(self, applicant):
        h = applicant["headers"]
        r = requests.post(f"{API}/posts", headers=h, json={"content": "iter24 retest"}, timeout=30)
        assert r.status_code in (200, 201), r.text
        post_id = r.json().get("id") or r.json().get("post", {}).get("id")
        assert post_id
        r = requests.patch(f"{API}/posts/{post_id}", headers=h, json={"content": "edited iter24"}, timeout=30)
        assert r.status_code == 200
        r = requests.delete(f"{API}/posts/{post_id}", headers=h, timeout=30)
        assert r.status_code in (200, 204)

    def test_account_deactivate_then_login_reactivates(self):
        token, email, uid, me, h = _signup("social")
        r = requests.post(f"{API}/account/deactivate", headers=h, json={"reason": "test"}, timeout=30)
        assert r.status_code == 200, r.text
        r = requests.post(f"{API}/auth/login", json={"email": email, "password": "Test123!"}, timeout=30)
        assert r.status_code == 200, f"login should reactivate: {r.text}"

    def test_user_kind_put_persistence(self, applicant):
        h = applicant["headers"]
        r = requests.put(f"{API}/users/me", headers=h, json={"user_kind": "professional"}, timeout=30)
        assert r.status_code == 200
        me = requests.get(f"{API}/users/me", headers=h, timeout=30).json()
        assert me["user_kind"] == "professional"
        # toggle back
        r = requests.put(f"{API}/users/me", headers=h, json={"user_kind": "social"}, timeout=30)
        assert r.status_code == 200

    def test_jobs_checkout_url(self, poster):
        r = requests.post(f"{API}/jobs/checkout", headers=poster["headers"], json={"origin_url": BASE_URL}, timeout=30)
        assert r.status_code == 200
        body = r.json()
        assert body["url"].startswith("https://")
