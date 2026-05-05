"""
Iteration 15 backend tests:
- Hubs regions / cities (African Country->Province->City catalogue)
- Complete-profile with banking + region cascade
- Banking get/post (masking, auth)
- Validation errors for region cascade
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://stokvel-plus.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _signup(session, with_banking=True, with_region=True, country=None, province=None, city=None):
    email = f"TEST_iter15_{uuid.uuid4().hex[:10]}@example.com"
    r = session.post(f"{API}/auth/progressive-signup", json={"email": email, "password": "Test123!"})
    assert r.status_code == 200, r.text
    token = r.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "full_name": "Iter15 Tester",
        "username": f"iter15_{uuid.uuid4().hex[:8]}",
        "bio": "test",
        "intent": "member",
        "terms_accepted": True,
    }
    if with_region:
        payload.update({
            "country": country or "south_africa",
            "province": province or "gauteng",
            "city": city or "johannesburg",
        })
    if with_banking:
        payload.update({
            "bank_name": "Standard Bank",
            "account_number": "1234567890",
            "swift_code": "sbzaza22",
            "branch_number": "051001",
        })
    r2 = session.post(f"{API}/auth/complete-profile", json=payload, headers=headers)
    return r2, token, email, payload


# ============== /api/hubs/regions ==============
class TestHubsRegions:
    def test_regions_returns_all_african_countries(self, session):
        r = session.get(f"{API}/hubs/regions")
        assert r.status_code == 200
        data = r.json()
        assert "countries" in data
        slugs = [c["value"] for c in data["countries"]]
        for required in [
            "south_africa", "nigeria", "kenya", "ghana", "zimbabwe",
            "tanzania", "uganda", "senegal", "egypt", "morocco",
            "ethiopia", "rwanda", "other",
        ]:
            assert required in slugs, f"Missing country: {required}"
        # Each country has provinces[] with cities[]
        sa = next(c for c in data["countries"] if c["value"] == "south_africa")
        assert isinstance(sa["provinces"], list) and len(sa["provinces"]) >= 5
        gauteng = next(p for p in sa["provinces"] if p["value"] == "gauteng")
        assert any(c["value"] == "johannesburg" for c in gauteng["cities"])

    def test_cities_returns_100_plus_with_full_metadata(self, session):
        r = session.get(f"{API}/hubs/cities")
        assert r.status_code == 200
        data = r.json()
        assert "cities" in data or isinstance(data, dict)
        cities = data.get("cities", data if isinstance(data, list) else [])
        # Endpoint may return {cities:[...]} or just a list — accept both
        if isinstance(data, dict) and "cities" not in data:
            # try first list-valued key
            for v in data.values():
                if isinstance(v, list):
                    cities = v
                    break
        assert len(cities) >= 100, f"Got only {len(cities)} cities"
        sample = cities[0]
        for k in ("value", "label", "country", "country_label", "province"):
            assert k in sample, f"missing {k} in city object"


# ============== complete-profile + banking ==============
class TestCompleteProfileBanking:
    def test_complete_profile_with_banking_persists_uppercased_swift(self, session):
        r2, token, email, _ = _signup(session, with_banking=True, with_region=True)
        assert r2.status_code == 200, r2.text
        user = r2.json()["user"]
        assert user.get("country") == "south_africa"
        assert user.get("province") == "gauteng"
        assert user.get("city") == "johannesburg"
        bank = user.get("banking") or {}
        assert bank.get("swift_code") == "SBZAZA22"  # uppercased
        assert bank.get("bank_name") == "Standard Bank"
        assert bank.get("account_number") == "1234567890"
        # GET banking should mask
        h = {"Authorization": f"Bearer {token}"}
        rb = session.get(f"{API}/users/me/banking", headers=h)
        assert rb.status_code == 200
        b = rb.json()
        assert b["on_file"] is True
        assert b["account_last4"] == "7890"
        assert "1234567890" not in b.get("account_masked", "")
        assert b["account_masked"].endswith("7890")
        assert len(b["account_masked"]) >= len("1234567890")
        # Full account_number must NOT be returned anywhere
        assert "account_number" not in b
        assert b["swift_code"] == "SBZAZA22"

    def test_complete_profile_without_banking_succeeds(self, session):
        r2, token, _, _ = _signup(session, with_banking=False, with_region=True)
        assert r2.status_code == 200, r2.text
        h = {"Authorization": f"Bearer {token}"}
        rb = session.get(f"{API}/users/me/banking", headers=h)
        assert rb.status_code == 200
        assert rb.json() == {"on_file": False}

    def test_post_banking_endpoint_updates_user(self, session):
        r2, token, _, _ = _signup(session, with_banking=False, with_region=False)
        assert r2.status_code == 200
        h = {"Authorization": f"Bearer {token}"}
        r = session.post(f"{API}/users/me/banking", json={
            "bank_name": "ABSA",
            "account_number": "9988776655",
            "swift_code": "absazajj",
            "branch_number": "632005",
        }, headers=h)
        assert r.status_code == 200, r.text
        rb = session.get(f"{API}/users/me/banking", headers=h)
        b = rb.json()
        assert b["on_file"] is True
        assert b["swift_code"] == "ABSAZAJJ"
        assert b["account_last4"] == "6655"

    def test_banking_endpoints_require_auth(self, session):
        r = session.get(f"{API}/users/me/banking")
        assert r.status_code in (401, 403)
        r2 = session.post(f"{API}/users/me/banking", json={
            "bank_name": "x", "account_number": "1", "swift_code": "x", "branch_number": "1"
        })
        assert r2.status_code in (401, 403)

    def test_complete_profile_invalid_country(self, session):
        r2, token, _, _ = _signup(session, with_banking=False, with_region=False)
        assert r2.status_code == 200
        h = {"Authorization": f"Bearer {token}"}
        # Re-call with bad country
        r = session.post(f"{API}/auth/complete-profile", json={
            "full_name": "X", "username": f"badc_{uuid.uuid4().hex[:6]}",
            "bio": "", "intent": "member", "terms_accepted": True,
            "country": "zzz",
        }, headers=h)
        assert r.status_code == 400
        assert "country" in r.text.lower()

    def test_complete_profile_invalid_province(self, session):
        r2, token, _, _ = _signup(session, with_banking=False, with_region=False)
        assert r2.status_code == 200
        h = {"Authorization": f"Bearer {token}"}
        r = session.post(f"{API}/auth/complete-profile", json={
            "full_name": "X", "username": f"badp_{uuid.uuid4().hex[:6]}",
            "bio": "", "intent": "member", "terms_accepted": True,
            "country": "south_africa", "province": "zzz",
        }, headers=h)
        assert r.status_code == 400
        assert "province" in r.text.lower()
