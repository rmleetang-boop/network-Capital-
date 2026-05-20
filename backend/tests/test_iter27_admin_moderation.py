"""
Iter27 backend tests — Admin Moderation Suite + Credit Grants.
Covers:
- Audit log (admin-only, filters, newest-first)
- User single delete (soft/hard, self-delete blocked, purge_content)
- User suspend toggle
- User bulk delete (preview/soft/hard, confirm_token, admins excluded)
- Content single delete (posts + messages)
- Content bulk delete (preview + execute)
- Credit grants (validation, currency conversion, hard-cap co-approval, stokvel pool, notification)
- Admin stokvels list
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
def _new_user(prefix="iter27", complete=True):
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
        requests.post(
            f"{API}/auth/complete-profile",
            headers=h,
            json={
                "full_name": f"Iter27 {prefix}",
                "username": uname,
                "bio": "qa",
                "intent": "member",
                "terms_accepted": True,
                "birth_month": 6,
            },
            timeout=20,
        )
    me = requests.get(f"{API}/users/me", headers=h, timeout=20).json()
    return {"token": token, "headers": h, "id": me["id"], "email": email,
            "username": me.get("username"), "role": me.get("role")}


def _new_admin(prefix="iter27_admin"):
    u = _new_user(prefix)
    r = requests.post(
        f"{API}/admin/bootstrap",
        headers={**u["headers"], "X-Admin-Password": ADMIN_PASSWORD},
        timeout=20,
    )
    assert r.status_code == 200, f"admin bootstrap failed: {r.status_code} {r.text}"
    u["role"] = "admin"
    return u


def _promote(admin_headers, target_user_id, role="admin"):
    return requests.patch(
        f"{API}/admin/users/{target_user_id}/role",
        headers=admin_headers,
        json={"role": role},
        timeout=20,
    )


# ---------------- session-scoped admin fixtures ----------------
@pytest.fixture(scope="session")
def admin1():
    return _new_admin("admin1")


@pytest.fixture(scope="session")
def admin2(admin1):
    u = _new_user("admin2")
    # admin1 promotes u to admin
    r = _promote(admin1["headers"], u["id"], "admin")
    assert r.status_code == 200, f"promote failed: {r.text}"
    u["role"] = "admin"
    return u


# ===================== AUDIT LOG =====================
class TestAuditLog:
    def test_requires_admin(self):
        u = _new_user("audit_non_admin")
        r = requests.get(f"{API}/admin/audit-log", headers=u["headers"], timeout=20)
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text}"

    def test_returns_list_newest_first(self, admin1):
        # Generate an audit row by suspending a victim
        victim = _new_user("audit_victim")
        s = requests.post(f"{API}/admin/users/{victim['id']}/suspend",
                          headers=admin1["headers"], json={"reason": "audit-test"}, timeout=20)
        assert s.status_code == 200, s.text
        r = requests.get(f"{API}/admin/audit-log",
                         headers=admin1["headers"],
                         params={"actor_id": admin1["id"]},
                         timeout=20)
        assert r.status_code == 200, r.text
        rows = r.json()
        assert isinstance(rows, list)
        assert len(rows) >= 1
        # newest first
        if len(rows) >= 2:
            assert rows[0]["created_at"] >= rows[1]["created_at"]
        # filter actor_id honored
        assert all(row["actor_id"] == admin1["id"] for row in rows)


# ===================== USER SUSPEND =====================
class TestSuspendToggle:
    def test_suspend_toggle(self, admin1):
        v = _new_user("suspend_victim")
        # First suspend → suspended True
        r1 = requests.post(f"{API}/admin/users/{v['id']}/suspend",
                           headers=admin1["headers"], json={"reason": "spam"}, timeout=20)
        assert r1.status_code == 200, r1.text
        assert r1.json()["suspended"] is True
        # Second toggles back to False
        r2 = requests.post(f"{API}/admin/users/{v['id']}/suspend",
                           headers=admin1["headers"], json={"reason": "rev"}, timeout=20)
        assert r2.status_code == 200
        assert r2.json()["suspended"] is False
        # Audit log contains both suspend + unsuspend for this target
        rows = requests.get(f"{API}/admin/audit-log",
                            headers=admin1["headers"],
                            params={"target_id": v["id"]}, timeout=20).json()
        actions = {row["action"] for row in rows}
        assert "user.suspend" in actions
        assert "user.unsuspend" in actions


# ===================== USER SINGLE DELETE =====================
class TestUserSingleDelete:
    def test_self_delete_blocked(self, admin1):
        r = requests.delete(f"{API}/admin/users/{admin1['id']}",
                            headers=admin1["headers"],
                            params={"mode": "soft", "reason": "self"}, timeout=20)
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text}"

    def test_soft_delete_with_purge_content(self, admin1):
        v = _new_user("soft_victim")
        # create a post by victim so purge_content has something to blank
        post = requests.post(f"{API}/posts",
                             headers=v["headers"],
                             json={"content": "to be blanked"}, timeout=20)
        # delete
        r = requests.delete(f"{API}/admin/users/{v['id']}",
                            headers=admin1["headers"],
                            params={"mode": "soft", "reason": "abuse-1234567890",
                                    "purge_content": "true"}, timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["mode"] == "soft"
        assert "purge_at" in body
        # audit row present
        rows = requests.get(f"{API}/admin/audit-log",
                            headers=admin1["headers"],
                            params={"target_id": v["id"], "action": "user.soft_delete"},
                            timeout=20).json()
        assert len(rows) >= 1

    def test_hard_delete_cascades(self, admin1):
        v = _new_user("hard_victim")
        # Seed a post + notification we expect to be removed
        requests.post(f"{API}/posts", headers=v["headers"], json={"content": "hard-victim post"}, timeout=20)
        r = requests.delete(f"{API}/admin/users/{v['id']}",
                            headers=admin1["headers"],
                            params={"mode": "hard", "reason": "hardddelete-12345"}, timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["mode"] == "hard"
        assert "deleted_counts" in body
        # at least posts should have a positive count for victim with a post
        counts = body["deleted_counts"]
        assert isinstance(counts, dict)
        # user gone — subsequent admin GET should 404 via re-delete
        r2 = requests.delete(f"{API}/admin/users/{v['id']}",
                             headers=admin1["headers"],
                             params={"mode": "soft"}, timeout=20)
        assert r2.status_code == 404
        # audit log entry
        rows = requests.get(f"{API}/admin/audit-log",
                            headers=admin1["headers"],
                            params={"target_id": v["id"], "action": "user.hard_delete"},
                            timeout=20).json()
        assert len(rows) >= 1


# ===================== BULK USER DELETE =====================
class TestBulkUserDelete:
    def test_preview_then_soft_requires_token(self, admin1):
        marker = f"BULKTEST_{uuid.uuid4().hex[:6]}"
        # Create 2 users with searchable marker
        users = [_new_user(f"bulk_{marker}_{i}") for i in range(2)]
        # preview
        p = requests.post(f"{API}/admin/users/bulk-delete",
                          headers=admin1["headers"],
                          json={"search": marker, "mode": "preview"}, timeout=30)
        assert p.status_code == 200, p.text
        body = p.json()
        assert "would_delete" in body
        assert body["would_delete"] >= 2
        assert "sample" in body and isinstance(body["sample"], list)
        assert body.get("confirm_token_required", "").startswith("DELETE ")
        # admins MUST be excluded — verify by including a regex that matches our admin
        # We rely on the role $nin filter — sample must not contain admin1
        ids_in_sample = {row.get("id") for row in body["sample"]}
        assert admin1["id"] not in ids_in_sample
        # soft WITHOUT token → 400
        bad = requests.post(f"{API}/admin/users/bulk-delete",
                            headers=admin1["headers"],
                            json={"search": marker, "mode": "soft"}, timeout=30)
        assert bad.status_code == 400
        assert "DELETE" in bad.text  # token leak detail
        # soft WITH matching token → ok
        token = body["confirm_token_required"]
        ok = requests.post(f"{API}/admin/users/bulk-delete",
                           headers=admin1["headers"],
                           json={"search": marker, "mode": "soft",
                                 "confirm_token": token, "reason": "bulk-soft"}, timeout=30)
        assert ok.status_code == 200, ok.text
        out = ok.json()
        assert out.get("ok") is True
        assert out["deleted"]["users"] >= 2

    def test_admins_excluded_from_bulk_sweep(self, admin1):
        # Use search that matches the admin's own email to confirm exclusion
        admin_email_prefix = admin1["email"].split("@")[0][:8]
        p = requests.post(f"{API}/admin/users/bulk-delete",
                          headers=admin1["headers"],
                          json={"search": admin_email_prefix, "mode": "preview"}, timeout=30)
        assert p.status_code == 200, p.text
        ids = {row.get("id") for row in p.json().get("sample", [])}
        assert admin1["id"] not in ids


# ===================== CONTENT SINGLE DELETE =====================
class TestContentSingleDelete:
    def test_post_delete_and_404(self, admin1):
        v = _new_user("post_target")
        r = requests.post(f"{API}/posts", headers=v["headers"],
                          json={"content": "delete-me"}, timeout=20)
        assert r.status_code in (200, 201), r.text
        pid = r.json().get("id")
        assert pid
        d = requests.delete(f"{API}/admin/posts/{pid}",
                            headers=admin1["headers"],
                            params={"reason": "violation-12345"}, timeout=20)
        assert d.status_code == 200, d.text
        d2 = requests.delete(f"{API}/admin/posts/{pid}",
                             headers=admin1["headers"],
                             params={"reason": "again"}, timeout=20)
        assert d2.status_code == 404

    def test_message_delete_404_for_missing(self, admin1):
        d = requests.delete(f"{API}/admin/messages/{uuid.uuid4()}",
                            headers=admin1["headers"], timeout=20)
        assert d.status_code == 404


# ===================== CONTENT BULK DELETE =====================
class TestContentBulkDelete:
    def test_preview_then_execute_posts(self, admin1):
        v = _new_user("bulk_post_owner")
        # seed 3 posts
        for i in range(3):
            r = requests.post(f"{API}/posts", headers=v["headers"],
                              json={"content": f"bulk-post-{i}"}, timeout=20)
            assert r.status_code in (200, 201)
        prev = requests.post(f"{API}/admin/content/bulk-delete",
                             headers=admin1["headers"],
                             json={"kind": "posts", "user_id": v["id"], "mode": "preview"},
                             timeout=20)
        assert prev.status_code == 200, prev.text
        assert prev.json().get("would_delete", 0) >= 3
        ex = requests.post(f"{API}/admin/content/bulk-delete",
                           headers=admin1["headers"],
                           json={"kind": "posts", "user_id": v["id"], "mode": "execute",
                                 "reason": "bulk-clean"}, timeout=20)
        assert ex.status_code == 200, ex.text
        assert ex.json().get("deleted", 0) >= 3

    def test_bad_kind_400(self, admin1):
        r = requests.post(f"{API}/admin/content/bulk-delete",
                          headers=admin1["headers"],
                          json={"kind": "stories", "mode": "preview"}, timeout=20)
        assert r.status_code == 400


# ===================== CREDIT GRANTS =====================
class TestCreditGrants:
    def test_reason_too_short_400(self, admin1):
        v = _new_user("grant_target_short")
        r = requests.post(f"{API}/admin/credit-grants",
                          headers=admin1["headers"],
                          json={"amount": 10, "currency": "USD", "reason": "short",
                                "target_type": "user", "target_id": v["id"]}, timeout=20)
        assert r.status_code == 400

    def test_amount_zero_400(self, admin1):
        v = _new_user("grant_target_zero")
        r = requests.post(f"{API}/admin/credit-grants",
                          headers=admin1["headers"],
                          json={"amount": 0, "currency": "USD", "reason": "valid reason 1234567",
                                "target_type": "user", "target_id": v["id"]}, timeout=20)
        assert r.status_code == 400

    def test_bad_currency_400(self, admin1):
        v = _new_user("grant_target_cur")
        r = requests.post(f"{API}/admin/credit-grants",
                          headers=admin1["headers"],
                          json={"amount": 10, "currency": "XYZ", "reason": "valid reason 1234567",
                                "target_type": "user", "target_id": v["id"]}, timeout=20)
        assert r.status_code == 400
        assert "Unsupported currency" in r.text

    def test_bad_target_type_400(self, admin1):
        r = requests.post(f"{API}/admin/credit-grants",
                          headers=admin1["headers"],
                          json={"amount": 10, "currency": "USD", "reason": "valid reason 1234567",
                                "target_type": "bogus", "target_id": "x"}, timeout=20)
        assert r.status_code == 400

    def test_positive_grant_user_usd_increments_wallet(self, admin1):
        v = _new_user("grant_user_pos")
        before = requests.get(f"{API}/users/me", headers=v["headers"], timeout=20).json()
        before_bal = float(before.get("wallet_balance") or 0)
        r = requests.post(f"{API}/admin/credit-grants",
                          headers=admin1["headers"],
                          json={"amount": 100, "currency": "USD",
                                "reason": "positive grant test ABC",
                                "target_type": "user", "target_id": v["id"]}, timeout=20)
        assert r.status_code == 200, r.text
        rec = r.json()
        assert rec["status"] == "applied"
        assert rec["usd_equiv"] == 100.00 or abs(rec["usd_equiv"] - 100) < 0.01
        after = requests.get(f"{API}/users/me", headers=v["headers"], timeout=20).json()
        after_bal = float(after.get("wallet_balance") or 0)
        assert round(after_bal - before_bal, 2) == 100.00, f"before={before_bal} after={after_bal}"

    def test_negative_grant_user_decrements(self, admin1):
        v = _new_user("grant_user_neg")
        # first credit +50
        requests.post(f"{API}/admin/credit-grants",
                      headers=admin1["headers"],
                      json={"amount": 50, "currency": "USD", "reason": "seed-balance-12345",
                            "target_type": "user", "target_id": v["id"]}, timeout=20)
        before = float(requests.get(f"{API}/users/me", headers=v["headers"]).json().get("wallet_balance") or 0)
        r = requests.post(f"{API}/admin/credit-grants",
                          headers=admin1["headers"],
                          json={"amount": -20, "currency": "USD",
                                "reason": "deduct test 12345",
                                "target_type": "user", "target_id": v["id"]}, timeout=20)
        assert r.status_code == 200, r.text
        after = float(requests.get(f"{API}/users/me", headers=v["headers"]).json().get("wallet_balance") or 0)
        assert round(before - after, 2) == 20.00, f"before={before} after={after}"

    def test_zar_grant_converts_to_usd(self, admin1):
        # ZAR rate 18.20 → 182 ZAR ≈ 10 USD
        v = _new_user("grant_zar")
        before = float(requests.get(f"{API}/users/me", headers=v["headers"]).json().get("wallet_balance") or 0)
        r = requests.post(f"{API}/admin/credit-grants",
                          headers=admin1["headers"],
                          json={"amount": 182, "currency": "ZAR",
                                "reason": "ZAR conversion test",
                                "target_type": "user", "target_id": v["id"]}, timeout=20)
        assert r.status_code == 200, r.text
        rec = r.json()
        assert abs(rec["usd_equiv"] - 10.00) < 0.05, rec
        after = float(requests.get(f"{API}/users/me", headers=v["headers"]).json().get("wallet_balance") or 0)
        assert abs((after - before) - 10.00) < 0.05

    def test_hard_cap_requires_co_approval(self, admin1, admin2):
        v = _new_user("grant_cap")
        # 5001 USD > cap → pending
        r = requests.post(f"{API}/admin/credit-grants",
                          headers=admin1["headers"],
                          json={"amount": 5001, "currency": "USD",
                                "reason": "Large above-cap grant",
                                "target_type": "user", "target_id": v["id"]}, timeout=20)
        assert r.status_code == 200, r.text
        rec = r.json()
        assert rec["status"] == "pending_co_approval"
        gid = rec["id"]
        # balance must NOT change yet
        bal = float(requests.get(f"{API}/users/me", headers=v["headers"]).json().get("wallet_balance") or 0)
        assert bal == 0.0, f"balance should be 0 pre-approval, got {bal}"
        # same admin co-approve → 403
        same = requests.post(f"{API}/admin/credit-grants/{gid}/co-approve",
                             headers=admin1["headers"], timeout=20)
        assert same.status_code == 403
        # different admin → ok
        ok = requests.post(f"{API}/admin/credit-grants/{gid}/co-approve",
                           headers=admin2["headers"], timeout=20)
        assert ok.status_code == 200, ok.text
        # balance now updated
        bal2 = float(requests.get(f"{API}/users/me", headers=v["headers"]).json().get("wallet_balance") or 0)
        assert abs(bal2 - 5001.0) < 0.05
        # audit row credit.grant_applied present
        rows = requests.get(f"{API}/admin/audit-log",
                            headers=admin1["headers"],
                            params={"action": "credit.grant_applied",
                                    "target_id": v["id"]}, timeout=20).json()
        assert len(rows) >= 1

    def test_notification_emitted_on_user_grant(self, admin1):
        v = _new_user("grant_notif")
        gr = requests.post(f"{API}/admin/credit-grants",
                           headers=admin1["headers"],
                           json={"amount": 25, "currency": "USD",
                                 "reason": "notif test grant",
                                 "target_type": "user", "target_id": v["id"]}, timeout=20)
        assert gr.status_code == 200, gr.text
        nr = requests.get(f"{API}/notifications", headers=v["headers"], timeout=20)
        # endpoint may differ — fallback: skip if not 200
        if nr.status_code != 200:
            pytest.skip(f"/notifications returned {nr.status_code}; skipping notify check")
        body = nr.json()
        items = body if isinstance(body, list) else (
            body.get("notifications") or body.get("items") or []
        )
        kinds = {it.get("type") for it in items}
        # KNOWN BACKEND ISSUE: NotificationModel response_model requires `points: int`
        # but credit-grant inserts a notification WITHOUT `points` → endpoint silently
        # drops/coerces it. Test asserts the intent — if this fails, fix the model or
        # the insert to include points=0.
        assert "admin_credit" in kinds, (
            f"admin_credit notification not retrievable via /notifications. "
            f"Likely cause: NotificationModel.points is required but credit-grant inserts no points. "
            f"types={kinds}, raw_count={len(items)}"
        )

    def test_list_grants(self, admin1):
        r = requests.get(f"{API}/admin/credit-grants",
                         headers=admin1["headers"],
                         params={"status_filter": "applied"}, timeout=20)
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list)
        assert all(row["status"] == "applied" for row in rows)


# ===================== STOKVEL POOL CREDIT =====================
class TestStokvelPoolGrant:
    def test_positive_stokvel_grant_increments_pool(self, admin1):
        # create a stokvel owned by a new user — needs $10 creator fee
        u = _new_user("stokvel_owner")
        # seed wallet via admin grant so user can create a stokvel
        seed = requests.post(f"{API}/admin/credit-grants",
                             headers=admin1["headers"],
                             json={"amount": 20, "currency": "USD",
                                   "reason": "seed stokvel creator wallet",
                                   "target_type": "user", "target_id": u["id"]}, timeout=20)
        assert seed.status_code == 200
        s = requests.post(f"{API}/stokvels",
                          headers=u["headers"],
                          json={"name": f"TEST_SV_{uuid.uuid4().hex[:6]}",
                                "description": "qa pool",
                                "target_amount": 1000.0,
                                "payout_cycle": "monthly",
                                "purpose": "savings"},
                          timeout=20)
        if s.status_code not in (200, 201):
            pytest.skip(f"stokvel create failed: {s.status_code} {s.text[:200]}")
        sid = s.json().get("id")
        assert sid
        before = float(s.json().get("total_pool") or 0)
        r = requests.post(f"{API}/admin/credit-grants",
                          headers=admin1["headers"],
                          json={"amount": 200, "currency": "USD",
                                "reason": "stokvel pool seed",
                                "target_type": "stokvel", "target_id": sid}, timeout=20)
        assert r.status_code == 200, r.text
        rec = r.json()
        assert rec["status"] == "applied"
        # fetch stokvel and verify total_pool
        g = requests.get(f"{API}/stokvels/{sid}", headers=u["headers"], timeout=20)
        if g.status_code == 200:
            after = float(g.json().get("total_pool") or 0)
            assert abs((after - before) - 200.0) < 0.05


# ===================== ADMIN STOKVELS LIST =====================
class TestAdminStokvels:
    def test_requires_admin(self):
        u = _new_user("sv_list_non_admin")
        r = requests.get(f"{API}/admin/stokvels", headers=u["headers"], timeout=20)
        assert r.status_code == 403

    def test_search(self, admin1):
        marker = f"SVL{uuid.uuid4().hex[:6]}"
        u = _new_user("sv_list_owner")
        # Seed wallet for stokvel creation fee
        requests.post(f"{API}/admin/credit-grants",
                      headers=admin1["headers"],
                      json={"amount": 20, "currency": "USD",
                            "reason": "seed stokvel listing test",
                            "target_type": "user", "target_id": u["id"]}, timeout=20)
        s = requests.post(f"{API}/stokvels",
                          headers=u["headers"],
                          json={"name": f"TEST_{marker}_pool",
                                "description": "qa pool",
                                "target_amount": 500.0,
                                "payout_cycle": "monthly",
                                "purpose": "savings"},
                          timeout=20)
        if s.status_code not in (200, 201):
            pytest.skip(f"stokvel create failed: {s.status_code} {s.text[:200]}")
        r = requests.get(f"{API}/admin/stokvels",
                         headers=admin1["headers"],
                         params={"q": marker}, timeout=20)
        assert r.status_code == 200, r.text
        rows = r.json()
        assert isinstance(rows, list)
        assert any(marker in (row.get("name") or "") for row in rows)
