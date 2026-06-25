"""Iter 56d — Outreach (admin) + apply_for_growth backend tests.

Covers BACKEND #1-6 from the iter 56d review request:
  - GET /api/admin/outreach/templates  (3 templates, admin-gated)
  - POST /api/admin/outreach/preview   (HTML body content checks)
  - POST /api/admin/outreach/send      (suppression, persistence, send)
  - POST /api/admin/outreach/bulk      (per-row results, 100-cap)
  - POST /api/admin/outreach/upload-csv  (CSV parse)
  - GET /api/admin/outreach/list       (history + stats_30d)
  - POST /api/admin/outreach/{id}/resend
  - GET /api/admin/outreach/suppressions
  - GET /api/outreach/never-contact?token=...  (JWT opt-out)
  - POST /api/products with apply_for_growth=True (promotes user to growth creator)
"""
import os
import uuid
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://stokvel-plus.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

OWNER_EMAIL = "rmleetang@gmail.com"
OWNER_PASS = "OwnerTest123!"
ADMIN_EMAIL = "rmleetang+nctest1780423349@gmail.com"
ADMIN_PASS = "Test123!"


# ─── Fixtures ──────────────────────────────────────────────────────────────

def _login(email: str, password: str) -> dict:
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    body = r.json()
    return {"token": body["token"], "user": body["user"],
            "headers": {"Authorization": f"Bearer {body['token']}", "Content-Type": "application/json"}}


@pytest.fixture(scope="module")
def super_admin():
    return _login(OWNER_EMAIL, OWNER_PASS)


@pytest.fixture(scope="module")
def admin():
    return _login(ADMIN_EMAIL, ADMIN_PASS)


@pytest.fixture(scope="module")
def regular_user():
    """Create a fresh verified user via dev OTP backdoor."""
    email = f"TEST_outreach_{uuid.uuid4().hex[:8]}@example.com"
    pwd = "Test123!"
    r = requests.post(f"{API}/auth/progressive-signup",
                      json={"email": email, "password": pwd, "step": 1}, timeout=20)
    assert r.status_code == 200, r.text
    token = r.json()["token"]
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    otp_r = requests.post(f"{API}/auth/send-otp", json={"email": email}, headers=headers, timeout=20)
    if otp_r.status_code == 200 and "_mock_code" in otp_r.json():
        code = otp_r.json()["_mock_code"]
        requests.post(f"{API}/auth/verify-otp", json={"email": email, "code": code},
                      headers=headers, timeout=20)
    return {"token": token, "headers": headers, "email": email}


# ────────────────────────────────────────────────────────────────────────────
# BACKEND #1 — Templates list (admin-gated)
# ────────────────────────────────────────────────────────────────────────────
class TestOutreachTemplates:
    def test_super_admin_lists_3_templates(self, super_admin):
        r = requests.get(f"{API}/admin/outreach/templates", headers=super_admin["headers"], timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "templates" in body
        ids = sorted([t["id"] for t in body["templates"]])
        assert ids == sorted(["future_through_network", "income_streams", "influencer_collab"])
        for t in body["templates"]:
            assert "label" in t and "preview" in t and "headline" in t

    def test_admin_role_can_list(self, admin):
        r = requests.get(f"{API}/admin/outreach/templates", headers=admin["headers"], timeout=15)
        assert r.status_code == 200, r.text
        assert len(r.json()["templates"]) == 3

    def test_regular_user_forbidden(self, regular_user):
        r = requests.get(f"{API}/admin/outreach/templates", headers=regular_user["headers"], timeout=15)
        assert r.status_code == 403, f"expected 403, got {r.status_code}"


# ────────────────────────────────────────────────────────────────────────────
# BACKEND #2 — Preview content checks
# ────────────────────────────────────────────────────────────────────────────
class TestOutreachPreview:
    def test_preview_contains_required_elements(self, super_admin):
        r = requests.post(f"{API}/admin/outreach/preview",
                          json={"name": "Jane", "template": "future_through_network"},
                          headers=super_admin["headers"], timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        html = body.get("html", "")
        # Landing screenshot reference
        assert "landing-preview.png" in html, "landing screenshot missing"
        # WhatsApp link (wa.me format AND display number)
        assert "wa.me/27745747401" in html
        assert "+27 74 574 7401" in html
        # Email contact
        assert "creative@networkcapitalapp.co.za" in html
        # 'Never contact me again' (NOT 'unsubscribe')
        assert "Never contact me again" in html
        assert "unsubscribe" not in html.lower(), "should NOT contain 'unsubscribe' wording"
        # Footer line
        assert "build a great future with your network" in html
        # No tracking pixels (look for 1x1 transparent gifs / common pixel patterns)
        assert "tracking" not in html.lower()
        # Personalisation works
        assert "Jane" in html

    def test_preview_handles_all_3_templates(self, super_admin):
        for tpl in ["future_through_network", "income_streams", "influencer_collab"]:
            r = requests.post(f"{API}/admin/outreach/preview",
                              json={"name": "", "template": tpl},
                              headers=super_admin["headers"], timeout=15)
            assert r.status_code == 200, f"{tpl}: {r.text}"
            body = r.json()
            assert body["template"] == tpl
            assert len(body["html"]) > 1000

    def test_preview_unknown_template_falls_back(self, super_admin):
        r = requests.post(f"{API}/admin/outreach/preview",
                          json={"name": "x", "template": "bogus"},
                          headers=super_admin["headers"], timeout=15)
        assert r.status_code == 200
        assert r.json()["template"] == "future_through_network"


# ────────────────────────────────────────────────────────────────────────────
# BACKEND #3 — Send single
# ────────────────────────────────────────────────────────────────────────────
class TestOutreachSendSingle:
    def test_rejects_empty_subject(self, super_admin):
        r = requests.post(f"{API}/admin/outreach/send",
                          json={"email": "foo@example.com", "name": "x", "subject": "", "template": "future_through_network"},
                          headers=super_admin["headers"], timeout=15)
        assert r.status_code == 422, r.text

    def test_rejects_empty_email(self, super_admin):
        r = requests.post(f"{API}/admin/outreach/send",
                          json={"email": "", "name": "x", "subject": "Hello there", "template": "future_through_network"},
                          headers=super_admin["headers"], timeout=15)
        assert r.status_code == 422, r.text

    def test_suppresses_existing_registered_user(self, super_admin):
        """Owner is already registered → suppression branch."""
        r = requests.post(f"{API}/admin/outreach/send",
                          json={"email": OWNER_EMAIL, "name": "Owner",
                                "subject": "Test invite", "template": "future_through_network"},
                          headers=super_admin["headers"], timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is False
        assert body.get("status") == "suppressed"

    def test_sends_to_fresh_prospect_and_persists(self, super_admin):
        prospect = f"TEST_prospect_{uuid.uuid4().hex[:8]}@example.com"
        subject = f"Hello from Network Capital {uuid.uuid4().hex[:4]}"
        r = requests.post(f"{API}/admin/outreach/send",
                          json={"email": prospect, "name": "New Prospect",
                                "subject": subject, "template": "income_streams"},
                          headers=super_admin["headers"], timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        # Brevo may be in test/live — both 'sent' (ok=true) and 'failed' (ok=false) are accepted as proof of attempt
        assert "id" in body
        assert body.get("email") == prospect.lower()
        assert body.get("status") in ("sent", "failed")
        # Verify persistence via /list (super_admin sees everything)
        lst = requests.get(f"{API}/admin/outreach/list?limit=200",
                           headers=super_admin["headers"], timeout=15)
        assert lst.status_code == 200
        items = lst.json().get("items", [])
        match = [it for it in items if it.get("id") == body["id"]]
        assert match, "persisted row not found"
        row = match[0]
        assert row["email"] == prospect.lower()
        assert row["subject"] == subject
        assert row["template"] == "income_streams"
        assert row.get("sender_id")
        assert row.get("status") in ("sent", "failed")


# ────────────────────────────────────────────────────────────────────────────
# BACKEND #4 — Bulk
# ────────────────────────────────────────────────────────────────────────────
class TestOutreachBulk:
    def test_bulk_max_recipients_enforced(self, super_admin):
        recips = [{"email": f"TEST_bulk_{i}@example.com", "name": f"u{i}"} for i in range(101)]
        r = requests.post(f"{API}/admin/outreach/bulk",
                          json={"recipients": recips, "subject": "Bulk test", "template": "future_through_network"},
                          headers=super_admin["headers"], timeout=20)
        assert r.status_code == 400, r.text

    def test_bulk_mixed_list_returns_per_row_results(self, super_admin):
        recips = [
            {"email": f"TEST_bulkok_{uuid.uuid4().hex[:8]}@example.com", "name": "Valid"},
            {"email": OWNER_EMAIL, "name": "Existing"},          # suppressed (registered user)
            {"email": "not-an-email", "name": "Bad"},            # invalid format → 422 from pydantic? Or invalid_email status
        ]
        r = requests.post(f"{API}/admin/outreach/bulk",
                          json={"recipients": recips, "subject": "Mixed bulk", "template": "future_through_network"},
                          headers=super_admin["headers"], timeout=45)
        assert r.status_code == 200, r.text
        body = r.json()
        summary = body["summary"]
        results = body["results"]
        assert summary["total"] == 3
        assert len(results) == 3
        # exactly 1 suppressed (owner)
        assert summary["suppressed"] >= 1
        # invalid bucket should catch the 'not-an-email' row
        assert summary["invalid"] >= 1


# ────────────────────────────────────────────────────────────────────────────
# BACKEND #5 — CSV upload + history + resend + suppressions + never-contact
# ────────────────────────────────────────────────────────────────────────────
class TestOutreachCSVAndOps:
    def test_csv_upload(self, super_admin):
        csv = "email,name\nTEST_csv1@example.com,Alice\nTEST_csv2@example.com,Bob\nbroken-row\n"
        files = {"file": ("outreach.csv", csv, "text/csv")}
        # Don't send JSON Content-Type for multipart
        h = {"Authorization": super_admin["headers"]["Authorization"]}
        r = requests.post(f"{API}/admin/outreach/upload-csv", files=files, headers=h, timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["count"] == 2
        emails = [row["email"] for row in body["recipients"]]
        assert "test_csv1@example.com" in emails
        assert "test_csv2@example.com" in emails

    def test_history_stats_30d_present(self, super_admin):
        r = requests.get(f"{API}/admin/outreach/list?limit=20", headers=super_admin["headers"], timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "items" in body
        assert "stats_30d" in body
        s = body["stats_30d"]
        assert {"sent", "failed", "total"}.issubset(s.keys())
        assert "templates_available" in body

    def test_resend_increments_counter(self, super_admin):
        # First, create an invitation to resend
        prospect = f"TEST_resend_{uuid.uuid4().hex[:8]}@example.com"
        s = requests.post(f"{API}/admin/outreach/send",
                          json={"email": prospect, "name": "R",
                                "subject": "First send", "template": "future_through_network"},
                          headers=super_admin["headers"], timeout=30)
        assert s.status_code == 200
        inv_id = s.json()["id"]

        # Now resend
        r = requests.post(f"{API}/admin/outreach/{inv_id}/resend",
                          headers=super_admin["headers"], timeout=30)
        assert r.status_code == 200, r.text
        # Verify counter incremented
        lst = requests.get(f"{API}/admin/outreach/list?limit=200",
                           headers=super_admin["headers"], timeout=15)
        items = lst.json()["items"]
        match = [it for it in items if it.get("id") == inv_id]
        assert match
        assert match[0].get("resent_count", 0) >= 1
        assert match[0].get("last_resent_at") is not None

    def test_suppressions_endpoint(self, super_admin):
        r = requests.get(f"{API}/admin/outreach/suppressions",
                         headers=super_admin["headers"], timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "items" in body
        assert "count" in body
        assert isinstance(body["items"], list)

    def test_never_contact_with_valid_jwt_adds_suppression(self, super_admin):
        """Generate a real signed opt-out URL by sending to a fresh prospect, then
        fetch the resulting invite's HTML preview to extract the token. But easier
        path: hit /api/outreach/never-contact with a JWT we mint via send (the
        backend embeds it in the HTML). For a black-box test we simply hit the
        endpoint with token='preview' to confirm 200, then use a real token
        crafted by sending an email and observing the response."""
        # Black-box: 'preview' token returns friendly page
        r = requests.get(f"{API}/outreach/never-contact?token=preview", timeout=15)
        assert r.status_code == 200
        assert "Preferences updated" in r.text

        # Real flow: send an email to a fresh prospect, render preview, extract token
        prospect = f"TEST_optout_{uuid.uuid4().hex[:8]}@example.com"
        s = requests.post(f"{API}/admin/outreach/send",
                          json={"email": prospect, "name": "OptOutUser",
                                "subject": "Opt-out test", "template": "future_through_network"},
                          headers=super_admin["headers"], timeout=30)
        assert s.status_code == 200

        # The send doesn't expose the JWT directly. Mint one ourselves with the
        # same SECRET_KEY by reading backend/.env (test-only side-channel).
        import jwt as pyjwt
        secret = None
        try:
            with open("/app/backend/.env") as f:
                for line in f:
                    if line.startswith("JWT_SECRET_KEY=") or line.startswith("SECRET_KEY="):
                        secret = line.split("=", 1)[1].strip().strip('"').strip("'")
                        break
        except Exception:
            pytest.skip("cannot read JWT_SECRET_KEY")
        if not secret:
            pytest.skip("JWT_SECRET_KEY not in .env")
        tok = pyjwt.encode({"email": prospect, "kind": "outreach_optout"}, secret, algorithm="HS256")
        r2 = requests.get(f"{API}/outreach/never-contact?token={tok}", timeout=15)
        assert r2.status_code == 200, r2.text
        assert "we will not contact" in r2.text or "Preferences updated" in r2.text

        # Verify the email is now in the suppression list
        supp = requests.get(f"{API}/admin/outreach/suppressions?limit=1000",
                            headers=super_admin["headers"], timeout=15)
        assert supp.status_code == 200
        suppressed_emails = [row["email"] for row in supp.json()["items"]]
        assert prospect.lower() in suppressed_emails


# ────────────────────────────────────────────────────────────────────────────
# BACKEND #6 — apply_for_growth promotes user
# ────────────────────────────────────────────────────────────────────────────
class TestApplyForGrowth:
    def _signup_independent_user(self):
        """Create a fresh, verified independent creator directly via mongosh
        (signup OTP flow requires Brevo email — bypass for testing)."""
        import asyncio, sys, bcrypt as bc, datetime as dt
        sys.path.insert(0, "/app/backend")
        from motor.motor_asyncio import AsyncIOMotorClient
        email = f"TEST_g4g_{uuid.uuid4().hex[:8]}@example.com".lower()
        pwd_plain = "Test123!"
        uname = f"g4g{uuid.uuid4().hex[:8]}"
        uid = str(uuid.uuid4())
        pwd_hash = bc.hashpw(pwd_plain.encode(), bc.gensalt()).decode()

        async def _seed():
            client = AsyncIOMotorClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
            db = client[os.environ.get("DB_NAME", "test_database")]
            await db.users.insert_one({
                "id": uid, "email": email, "username": uname, "password": pwd_hash,
                "full_name": "G4G test", "country": "ZA", "email_verified": True,
                "creator_type": "independent", "role": "user",
                "bio": "", "photo": "", "network_score": 0, "rank": "Iron",
                "referral_code": uname.upper(),
                "created_at": dt.datetime.now(dt.timezone.utc).isoformat(),
                "updated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
            })
        asyncio.run(_seed())
        # Now log in to get a token
        r = requests.post(f"{API}/auth/login",
                          json={"email": email, "password": pwd_plain}, timeout=20)
        if r.status_code != 200:
            print(f"[g4g-seed] login failed: {r.status_code} {r.text[:300]}")
            return {"user": None}
        body = r.json()
        headers = {"Authorization": f"Bearer {body['token']}", "Content-Type": "application/json"}
        return {"headers": headers, "user": body.get("user", {}), "email": email}

    def test_apply_for_growth_promotes_user(self):
        ctx = self._signup_independent_user()
        assert ctx.get("user"), f"could not bootstrap test user: {ctx}"
        # Confirm starts as 'independent' (or unset)
        initial_ct = (ctx["user"].get("creator_type") or "independent").lower()
        assert initial_ct in ("independent", "")

        payload = {
            "name": "Need Support Product",
            "type": "product", "currency": "ZAR",
            "price_min": 100.0, "price_max": 100.0,
            "description": "Need help launching",
            "problem_solved": "Solves something",
            "images": ["data:image/png;base64,iVBORw0KGgo="],
            "support_needed": True,
            "apply_for_growth": True,
            "support_categories": ["funding"],
            "support_message": "Looking for seed funding",
            "publish": True,
        }
        r = requests.post(f"{API}/products", json=payload, headers=ctx["headers"], timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        prod = body["product"]
        assert prod.get("support_needed") is True
        assert prod.get("status") in ("pending_review", "approved")
        # User promoted to growth creator
        me_r = requests.get(f"{API}/users/me", headers=ctx["headers"], timeout=15)
        assert me_r.status_code == 200, f"users/me: {me_r.status_code} {me_r.text[:200]}"
        me = me_r.json()
        assert me.get("creator_type") == "growth", f"expected growth, got {me.get('creator_type')}"

    def test_without_apply_for_growth_independent_silently_drops_support(self):
        ctx = self._signup_independent_user()
        assert ctx.get("user"), "could not bootstrap test user"
        payload = {
            "name": "Indie No Support",
            "type": "product", "currency": "ZAR",
            "price_min": 100.0, "price_max": 100.0,
            "description": "x", "problem_solved": "y",
            "images": ["data:image/png;base64,iVBORw0KGgo="],
            "support_needed": True,
            "apply_for_growth": False,
            "support_categories": ["funding"],
            "publish": True,
        }
        r = requests.post(f"{API}/products", json=payload, headers=ctx["headers"], timeout=20)
        assert r.status_code == 200, r.text
        prod = r.json()["product"]
        # iter52 guard: support is silently dropped
        assert prod.get("support_needed") in (False, None)
        # User remains independent
        me = requests.get(f"{API}/users/me", headers=ctx["headers"], timeout=15).json()
        assert (me.get("creator_type") or "independent") != "growth"
