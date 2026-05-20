"""
Iter28 backend tests — Feature Flags + System Account + Announce-as-NC +
DM-as-NC + Restrict/Flag/FullProfile + Admin Deletes + Ambassador Role +
Ambassador Dashboard + Public Leaderboard + Stokvel+ Coming-Soon gate.
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
def _new_user(prefix="iter28", complete=True, referred_by_code=None):
    email = f"TEST_{prefix}_{int(time.time()*1000)}_{uuid.uuid4().hex[:6]}@example.com"
    r = requests.post(
        f"{API}/auth/progressive-signup",
        json={"email": email, "password": "Test123!", "step": 1},
        timeout=20,
    )
    assert r.status_code == 200, f"signup failed: {r.status_code} {r.text}"
    token = r.json()["token"]
    h = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    o = requests.post(f"{API}/auth/send-otp", headers=h, json={"email": email}, timeout=20).json()
    code = o.get("_mock_code") or o.get("code")
    assert code, f"no mock code: {o}"
    requests.post(f"{API}/auth/verify-otp", headers=h, json={"email": email, "code": code}, timeout=20)
    if complete:
        uname = f"u{int(time.time()*1000)}{uuid.uuid4().hex[:4]}"
        payload = {
            "full_name": f"Iter28 {prefix}",
            "username": uname,
            "bio": "qa",
            "intent": "member",
            "terms_accepted": True,
            "birth_month": 6,
        }
        if referred_by_code:
            payload["referral_code"] = referred_by_code
        requests.post(f"{API}/auth/complete-profile", headers=h, json=payload, timeout=20)
    me = requests.get(f"{API}/users/me", headers=h, timeout=20).json()
    return {"token": token, "headers": h, "id": me["id"], "email": email,
            "username": me.get("username"), "role": me.get("role"),
            "share_code": me.get("share_code"), "referral_code": me.get("referral_code")}


def _new_admin(prefix="iter28_admin"):
    u = _new_user(prefix)
    r = requests.post(
        f"{API}/admin/bootstrap",
        headers={**u["headers"], "X-Admin-Password": ADMIN_PASSWORD},
        timeout=20,
    )
    assert r.status_code == 200, f"admin bootstrap failed: {r.status_code} {r.text}"
    u["role"] = "admin"
    return u


def _set_flag(admin_headers, key, value):
    return requests.put(
        f"{API}/admin/feature-flags/{key}",
        headers=admin_headers,
        json={"value": value},
        timeout=20,
    )


def _credit_grant(admin_headers, target_user_id, amount_usd):
    return requests.post(
        f"{API}/admin/credit-grants",
        headers=admin_headers,
        json={
            "target_type": "user",
            "target_id": target_user_id,
            "amount": amount_usd,
            "currency": "USD",
            "reason": "iter28 wallet seed for tests",
        },
        timeout=20,
    )


# ---------------- session-scoped fixtures ----------------
@pytest.fixture(scope="session")
def admin1():
    return _new_admin("admin1")


@pytest.fixture(scope="session")
def admin2(admin1):
    u = _new_user("admin2")
    r = requests.patch(
        f"{API}/admin/users/{u['id']}/role",
        headers=admin1["headers"],
        json={"role": "admin"},
        timeout=20,
    )
    assert r.status_code == 200, f"role promote failed: {r.status_code} {r.text}"
    u["role"] = "admin"
    return u


@pytest.fixture(scope="session")
def moderator(admin1):
    u = _new_user("moderator")
    r = requests.patch(
        f"{API}/admin/users/{u['id']}/role",
        headers=admin1["headers"],
        json={"role": "moderator"},
        timeout=20,
    )
    assert r.status_code == 200
    u["role"] = "moderator"
    return u


@pytest.fixture(scope="session")
def member():
    return _new_user("member")


@pytest.fixture(scope="session", autouse=True)
def _ensure_flag_off_at_end(admin1):
    """Make sure stokvel_plus_enabled is OFF after the entire suite."""
    yield
    try:
        _set_flag(admin1["headers"], "stokvel_plus_enabled", False)
    except Exception:
        pass


# ====================== 1) SYSTEM ACCOUNT ==========================
class TestSystemAccount:
    def test_networkcapital_seeded(self, admin1):
        r = requests.get(
            f"{API}/admin/users-list?q=networkcapital",
            headers=admin1["headers"], timeout=20,
        )
        assert r.status_code == 200
        data = r.json()
        if isinstance(data, dict):
            users = data.get("users") or data.get("rows") or []
        else:
            users = data
        match = [u for u in users if u.get("username") == "networkcapital"]
        assert match, f"networkcapital account not found in admin list: {users[:3]}"
        nc = match[0]
        assert nc.get("role") == "admin"
        assert nc.get("official") is True


# ====================== 2) FEATURE FLAGS ===========================
class TestFeatureFlags:
    def test_public_get_no_auth(self):
        r = requests.get(f"{API}/feature-flags", timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert "stokvel_plus_enabled" in data
        assert isinstance(data["stokvel_plus_enabled"], bool)

    def test_default_is_false(self, admin1):
        # Make sure flag is reset to default false first
        _set_flag(admin1["headers"], "stokvel_plus_enabled", False)
        r = requests.get(f"{API}/feature-flags", timeout=20)
        assert r.status_code == 200
        assert r.json()["stokvel_plus_enabled"] is False

    def test_admin_can_toggle(self, admin1):
        r = _set_flag(admin1["headers"], "stokvel_plus_enabled", True)
        assert r.status_code == 200
        assert r.json()["value"] is True
        # verify persisted
        r2 = requests.get(f"{API}/feature-flags", timeout=20)
        assert r2.json()["stokvel_plus_enabled"] is True
        # reset to false
        _set_flag(admin1["headers"], "stokvel_plus_enabled", False)

    def test_moderator_cannot_toggle(self, moderator):
        r = _set_flag(moderator["headers"], "stokvel_plus_enabled", True)
        assert r.status_code == 403

    def test_non_admin_cannot_toggle(self, member):
        r = _set_flag(member["headers"], "stokvel_plus_enabled", True)
        assert r.status_code == 403


# ====================== 3) STOKVEL+ GATE ===========================
class TestStokvelPlusGate:
    def _make_stokvel(self, headers):
        return requests.post(
            f"{API}/stokvels",
            headers=headers,
            json={
                "name": f"TEST_iter28_{uuid.uuid4().hex[:6]}",
                "description": "iter28 gate test",
                "target_amount": 100.0,
                "payout_cycle": "monthly",
                "purpose": "savings",
            },
            timeout=20,
        )

    def test_creation_blocked_when_flag_off(self, admin1, member):
        _set_flag(admin1["headers"], "stokvel_plus_enabled", False)
        r = self._make_stokvel(member["headers"])
        assert r.status_code == 503
        assert "coming soon" in (r.json().get("detail") or "").lower()

    def test_invite_blocked_when_flag_off(self, admin1, member):
        _set_flag(admin1["headers"], "stokvel_plus_enabled", False)
        # Invite endpoint should also be gated even if stokvel doesn't exist
        r = requests.post(
            f"{API}/stokvels/nonexistent-id/invite",
            headers=member["headers"],
            json={"user_id": "doesnt-matter"},
            timeout=20,
        )
        assert r.status_code == 503
        assert "coming soon" in (r.json().get("detail") or "").lower()

    def test_creation_succeeds_when_flag_on(self, admin1, member):
        # Seed wallet
        _credit_grant(admin1["headers"], member["id"], 20)
        _set_flag(admin1["headers"], "stokvel_plus_enabled", True)
        try:
            r = self._make_stokvel(member["headers"])
            assert r.status_code == 200, f"create failed: {r.status_code} {r.text}"
            assert r.json()["name"].startswith("TEST_iter28_")
        finally:
            _set_flag(admin1["headers"], "stokvel_plus_enabled", False)


# ====================== 4) ADMIN ANNOUNCE ==========================
class TestAdminAnnounce:
    def test_admin_announce_creates_nc_post(self, admin1):
        content = f"TEST_iter28 announce {uuid.uuid4().hex[:6]}"
        r = requests.post(
            f"{API}/admin/announce",
            headers=admin1["headers"],
            json={"content": content, "pin": True},
            timeout=20,
        )
        assert r.status_code == 200, f"announce failed: {r.status_code} {r.text}"
        post = r.json()
        assert post["username"] == "networkcapital"
        assert post["official"] is True
        assert post["is_announcement"] is True
        assert post["content"] == content
        # Verify appears in feed — KNOWN BACKEND BUG: announce inserts
        # `likes: 0` (int) and omits `user_score`, while Post response_model
        # requires `likes: List[str]` and `user_score: int`. This makes the
        # entire /api/posts feed return 500 once any announce exists.
        f = requests.get(f"{API}/posts", headers=admin1["headers"], timeout=20)
        if f.status_code == 500:
            pytest.fail(
                "BACKEND BUG: /api/posts returns 500 after announce. "
                "Announce post is missing `user_score` and `likes` is int "
                "instead of List[str]. Fix in admin_announce_as_network_capital "
                "(server.py ~L7379)."
            )
        assert f.status_code == 200
        feed = f.json()
        assert any(p.get("id") == post["id"] for p in feed), "announce post not in feed"

    def test_moderator_cannot_announce(self, moderator):
        r = requests.post(
            f"{API}/admin/announce",
            headers=moderator["headers"],
            json={"content": "should be blocked"},
            timeout=20,
        )
        assert r.status_code == 403

    def test_empty_content_rejected(self, admin1):
        r = requests.post(
            f"{API}/admin/announce",
            headers=admin1["headers"],
            json={"content": ""},
            timeout=20,
        )
        assert r.status_code == 422


# ====================== 5) ADMIN DM as NC ==========================
class TestAdminDM:
    def test_admin_can_dm_as_nc(self, admin1, member):
        msg = f"TEST_iter28 DM {uuid.uuid4().hex[:6]}"
        r = requests.post(
            f"{API}/admin/dm",
            headers=admin1["headers"],
            json={"to_user_id": member["id"], "message": msg},
            timeout=20,
        )
        assert r.status_code == 200, f"dm failed: {r.status_code} {r.text}"
        body = r.json()
        assert body["sender_username"] == "networkcapital"
        assert body["recipient_id"] == member["id"]
        assert body["content"] == msg
        # Notification badge - check via notifications endpoint
        n = requests.get(f"{API}/notifications", headers=member["headers"], timeout=20)
        assert n.status_code == 200
        notif_data = n.json()
        notifs = notif_data.get("notifications", notif_data) if isinstance(notif_data, dict) else notif_data
        assert any(x.get("type") == "system_message" for x in notifs), \
            f"system_message notification not found: {notifs[:3]}"

    def test_dm_unknown_user_404(self, admin1):
        r = requests.post(
            f"{API}/admin/dm",
            headers=admin1["headers"],
            json={"to_user_id": "nonexistent-uid", "message": "hi"},
            timeout=20,
        )
        assert r.status_code == 404

    def test_moderator_cannot_dm_as_nc(self, moderator, member):
        r = requests.post(
            f"{API}/admin/dm",
            headers=moderator["headers"],
            json={"to_user_id": member["id"], "message": "denied"},
            timeout=20,
        )
        assert r.status_code == 403


# ====================== 6) RESTRICT USER ===========================
class TestRestrictUser:
    def test_restrict_sets_field(self, admin1):
        target = _new_user("restrict_tgt")
        r = requests.post(
            f"{API}/admin/users/{target['id']}/restrict",
            headers=admin1["headers"],
            json={"can_post": False, "reason": "spam"},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        # Verify via full-profile
        fp = requests.get(
            f"{API}/admin/users/{target['id']}/full-profile",
            headers=admin1["headers"], timeout=20,
        )
        assert fp.status_code == 200
        restrictions = fp.json()["user"].get("restrictions", {})
        assert restrictions.get("can_post") is False

    def test_empty_body_400(self, admin1, member):
        r = requests.post(
            f"{API}/admin/users/{member['id']}/restrict",
            headers=admin1["headers"],
            json={},
            timeout=20,
        )
        assert r.status_code == 400


# ====================== 7) FLAG USER ===============================
class TestFlagUser:
    def test_flag_and_unflag(self, admin1):
        target = _new_user("flag_tgt")
        r = requests.post(
            f"{API}/admin/users/{target['id']}/flag",
            headers=admin1["headers"],
            json={"flagged": True, "reason": "review"},
            timeout=20,
        )
        assert r.status_code == 200
        fp = requests.get(
            f"{API}/admin/users/{target['id']}/full-profile",
            headers=admin1["headers"], timeout=20,
        )
        assert fp.json()["user"].get("flagged_for_review") is True

        r2 = requests.post(
            f"{API}/admin/users/{target['id']}/flag",
            headers=admin1["headers"],
            json={"flagged": False},
            timeout=20,
        )
        assert r2.status_code == 200
        fp2 = requests.get(
            f"{API}/admin/users/{target['id']}/full-profile",
            headers=admin1["headers"], timeout=20,
        )
        assert fp2.json()["user"].get("flagged_for_review") is False

        # Audit row for flag action
        al = requests.get(
            f"{API}/admin/audit-log?target_id={target['id']}",
            headers=admin1["headers"], timeout=20,
        )
        assert al.status_code == 200
        body = al.json()
        if isinstance(body, list):
            rows = body
        else:
            rows = body.get("rows") or body.get("entries") or []
        actions = {r.get("action") for r in rows}
        assert "user.flag" in actions
        assert "user.unflag" in actions


# ====================== 8) FULL PROFILE ============================
class TestFullProfile:
    def test_full_profile_shape(self, admin1, member):
        r = requests.get(
            f"{API}/admin/users/{member['id']}/full-profile",
            headers=admin1["headers"], timeout=20,
        )
        assert r.status_code == 200
        body = r.json()
        assert "user" in body
        assert "counts" in body
        assert "recent_posts" in body
        for k in ("posts", "comments", "messages", "place_reviews",
                  "jobs_posted", "applications", "stokvels_member_of", "referrals"):
            assert k in body["counts"], f"missing count key: {k}"

    def test_full_profile_404(self, admin1):
        r = requests.get(
            f"{API}/admin/users/nonexistent-uid/full-profile",
            headers=admin1["headers"], timeout=20,
        )
        assert r.status_code == 404


# ====================== 9) ADMIN DELETE CASCADES ===================
class TestAdminDeletes:
    def test_delete_stokvel_cascade(self, admin1, member):
        # Enable flag, seed wallet, create stokvel
        _credit_grant(admin1["headers"], member["id"], 20)
        _set_flag(admin1["headers"], "stokvel_plus_enabled", True)
        try:
            cr = requests.post(
                f"{API}/stokvels",
                headers=member["headers"],
                json={
                    "name": f"TEST_iter28_del_{uuid.uuid4().hex[:6]}",
                    "description": "delete test",
                    "target_amount": 50.0,
                    "payout_cycle": "monthly",
                    "purpose": "savings",
                },
                timeout=20,
            )
            assert cr.status_code == 200, cr.text
            sid = cr.json()["id"]
        finally:
            _set_flag(admin1["headers"], "stokvel_plus_enabled", False)

        d = requests.delete(
            f"{API}/admin/stokvels/{sid}",
            headers=admin1["headers"], timeout=20,
        )
        assert d.status_code == 200
        assert d.json().get("ok") is True

        # 404 on unknown
        d2 = requests.delete(
            f"{API}/admin/stokvels/nonexistent",
            headers=admin1["headers"], timeout=20,
        )
        assert d2.status_code == 404

    def test_delete_job_404(self, admin1):
        r = requests.delete(
            f"{API}/admin/jobs/nonexistent",
            headers=admin1["headers"], timeout=20,
        )
        assert r.status_code == 404

    def test_delete_place_404(self, admin1):
        r = requests.delete(
            f"{API}/admin/places/nonexistent",
            headers=admin1["headers"], timeout=20,
        )
        assert r.status_code == 404

    def test_delete_activity_404(self, admin1):
        r = requests.delete(
            f"{API}/admin/activities/nonexistent",
            headers=admin1["headers"], timeout=20,
        )
        assert r.status_code == 404


# ====================== 10) ADMIN LISTS ============================
class TestAdminLists:
    def test_admin_jobs_list(self, admin1):
        r = requests.get(f"{API}/admin/jobs?q=zzznomatchtest", headers=admin1["headers"], timeout=20)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_admin_places_list(self, admin1):
        r = requests.get(f"{API}/admin/places?q=zzznomatchtest", headers=admin1["headers"], timeout=20)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_admin_activities_list(self, admin1):
        r = requests.get(f"{API}/admin/activities?q=zzznomatchtest", headers=admin1["headers"], timeout=20)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_admin_lists_moderator_allowed(self, moderator):
        # require_admin_user admits both admin AND moderator
        r = requests.get(f"{API}/admin/jobs", headers=moderator["headers"], timeout=20)
        assert r.status_code == 200

    def test_admin_ambassadors_list(self, admin1):
        r = requests.get(f"{API}/admin/ambassadors", headers=admin1["headers"], timeout=20)
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ====================== 11) AMBASSADOR ROLE ========================
class TestAmbassadorRole:
    def test_admin_makes_ambassador(self, admin1):
        target = _new_user("amb_target")
        r = requests.post(
            f"{API}/admin/users/{target['id']}/make-ambassador",
            headers=admin1["headers"],
            json={"ambassador": True},
            timeout=20,
        )
        assert r.status_code == 200
        assert r.json()["is_ambassador"] is True
        # Verify via full-profile
        fp = requests.get(
            f"{API}/admin/users/{target['id']}/full-profile",
            headers=admin1["headers"], timeout=20,
        )
        u = fp.json()["user"]
        assert u.get("is_ambassador") is True
        assert u.get("ambassador_rank") == "Rising Star"

    def test_admin_clears_ambassador(self, admin1):
        target = _new_user("amb_clear")
        requests.post(
            f"{API}/admin/users/{target['id']}/make-ambassador",
            headers=admin1["headers"],
            json={"ambassador": True}, timeout=20,
        )
        r = requests.post(
            f"{API}/admin/users/{target['id']}/make-ambassador",
            headers=admin1["headers"],
            json={"ambassador": False}, timeout=20,
        )
        assert r.status_code == 200
        assert r.json()["is_ambassador"] is False

    def test_moderator_cannot_make_ambassador(self, moderator, member):
        r = requests.post(
            f"{API}/admin/users/{member['id']}/make-ambassador",
            headers=moderator["headers"],
            json={"ambassador": True}, timeout=20,
        )
        assert r.status_code == 403


# ====================== 12) AMBASSADOR DASHBOARD ===================
class TestAmbassadorDashboard:
    def test_non_ambassador_denied(self, member):
        r = requests.get(f"{API}/ambassadors/me", headers=member["headers"], timeout=20)
        assert r.status_code == 403

    def test_ambassador_dashboard_shape(self, admin1):
        amb = _new_user("amb_dash")
        requests.post(
            f"{API}/admin/users/{amb['id']}/make-ambassador",
            headers=admin1["headers"],
            json={"ambassador": True}, timeout=20,
        )
        r = requests.get(f"{API}/ambassadors/me", headers=amb["headers"], timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        for k in ("user_id", "username", "rank", "recruit_count",
                  "completed_count", "new_7d", "new_30d",
                  "total_contribution", "targets", "recent_recruits", "performance"):
            assert k in body, f"missing key: {k}"
        assert isinstance(body["targets"], list)
        assert len(body["targets"]) == 6
        for t in body["targets"]:
            for kk in ("key", "label", "target", "current"):
                assert kk in t
        perf = body["performance"]
        for k in ("posts_this_month", "comments_this_month",
                  "stokvel_joins", "activities_hosted"):
            assert k in perf
        # No recruits, so total_contribution must be 0
        assert body["total_contribution"] == 0
        assert body["recruit_count"] == 0


# ====================== 13) AMBASSADOR LEADERBOARD =================
class TestAmbassadorLeaderboard:
    def test_public_leaderboard_no_auth(self):
        r = requests.get(f"{API}/ambassadors/leaderboard", timeout=20)
        assert r.status_code == 200
        body = r.json()
        assert "leaderboard" in body
        assert "generated_at" in body
        assert isinstance(body["leaderboard"], list)

    def test_leaderboard_sorted_by_contribution(self, admin1):
        # Make two ambassadors
        amb_high = _new_user("amb_high")
        amb_low = _new_user("amb_low")

        # Give amb_high 2 referred users (referred_by=amb_high.id)
        # The referral binding is via 'referred_by' on signup; we mutate db via API?
        # Simpler: just mark them as ambassadors and inspect that BOTH appear
        # in leaderboard list, order may be tie-broken by recruit_count.
        for amb in (amb_high, amb_low):
            requests.post(
                f"{API}/admin/users/{amb['id']}/make-ambassador",
                headers=admin1["headers"],
                json={"ambassador": True}, timeout=20,
            )

        r = requests.get(f"{API}/ambassadors/leaderboard", timeout=20)
        assert r.status_code == 200
        rows = r.json()["leaderboard"]
        names = {row["username"] for row in rows}
        assert amb_high["username"] in names
        assert amb_low["username"] in names

        # Verify desc sort: each consecutive row's total_contribution <= prev
        for i in range(len(rows) - 1):
            a, b = rows[i], rows[i + 1]
            if a["total_contribution"] == b["total_contribution"]:
                assert a["recruit_count"] >= b["recruit_count"]
            else:
                assert a["total_contribution"] >= b["total_contribution"]

        # Each row has required fields
        for row in rows:
            for k in ("user_id", "username", "rank",
                      "total_contribution", "recruit_count",
                      "new_30d", "completed_count"):
                assert k in row, f"leaderboard row missing {k}: {row}"
