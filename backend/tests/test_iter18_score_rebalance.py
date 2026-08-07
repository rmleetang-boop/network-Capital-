"""Iter 18 — Network Score rebalance + lifetime cap + soft-cap + premium 2x."""
import os
import time
import uuid
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://system-repair-18.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")
_mongo = MongoClient(MONGO_URL)
_db = _mongo[DB_NAME]


def _rand_email(tag="iter18"):
    return f"TEST_{tag}_{uuid.uuid4().hex[:8]}@example.com"


def _signup(tag="u"):
    email = _rand_email(tag)
    pw = "Test123!"
    r = requests.post(f"{API}/auth/progressive-signup", json={
        "email": email, "password": pw, "terms_accepted": True
    }, timeout=15)
    assert r.status_code == 200, f"progressive-signup {r.status_code} {r.text}"
    token = r.json().get("token") or r.json().get("access_token")
    assert token
    user_id = r.json().get("user", {}).get("id")
    return {"token": token, "email": email, "id": user_id}


def _complete(token, intent="member"):
    headers = {"Authorization": f"Bearer {token}"}
    body = {
        "full_name": f"TEST_iter18 {uuid.uuid4().hex[:5]}",
        "username": f"test_{uuid.uuid4().hex[:8]}",
        "bio": "iter18 score test user",
        "intent": intent,
        "terms_accepted": True,
    }
    r = requests.post(f"{API}/auth/complete-profile", json=body, headers=headers, timeout=15)
    assert r.status_code == 200, f"complete-profile {r.status_code} {r.text}"
    return r.json()


def _me(token):
    r = requests.get(f"{API}/users/me", headers={"Authorization": f"Bearer {token}"}, timeout=10)
    assert r.status_code == 200, r.text
    return r.json()


# ---------- /api/score/tiers (public) ----------
class TestScoreTiers:
    def test_tiers_endpoint_public_no_auth(self):
        r = requests.get(f"{API}/score/tiers", timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["lifetime_cap"] == 10000
        assert d["daily_soft_cap"] == 60
        tiers = d["tiers"]
        assert len(tiers) == 5
        names = [t["name"] for t in tiers]
        assert names == ["Member", "Contributor", "Connector", "Builder", "Steward"]

    def test_tiers_actions_table(self):
        d = requests.get(f"{API}/score/tiers", timeout=10).json()
        a = d["actions"]
        expect = {
            "daily_checkin": 10, "post_create": 15, "post_share": 8, "post_comment": 5,
            "story_create": 5, "weekly_resource_drop": 30, "referral_joined": 200,
            "referral_quality_bonus": 500, "monthly_streak": 100,
            "stokvel_first_join": 250, "activity_created": 150, "activity_joined": 25,
            "profile_completed": 250,
        }
        for k, v in expect.items():
            assert a.get(k) == v, f"actions[{k}] expected {v}, got {a.get(k)}"

    def test_tiers_membership_lanes(self):
        d = requests.get(f"{API}/score/tiers", timeout=10).json()
        lanes = d["membership_lanes"]
        for f in ["wallet_ops", "multi_sig_withdrawals", "creator_product_backing",
                  "currency_switcher", "score_2x_multiplier"]:
            assert f in lanes["premium_only"], f"premium_only missing {f}"
        score_only = lanes["score_only"]
        assert len(score_only) == 5
        thresholds = sorted(s["min_score"] for s in score_only)
        assert thresholds == [500, 2000, 3000, 4000, 5000]


# ---------- profile_completed +250 idempotent ----------
class TestProfileCompletedBonus:
    def test_profile_completed_awards_250_once(self):
        u = _signup("profile")
        before = _me(u["token"])
        assert before.get("network_score", 0) == 0
        _complete(u["token"])
        after = _me(u["token"])
        assert after["network_score"] == 250, f"expected 250, got {after['network_score']}"
        # Re-call should NOT award again
        _complete(u["token"])
        again = _me(u["token"])
        assert again["network_score"] == 250, f"profile_completed should not re-award, got {again['network_score']}"


# ---------- Daily check-in idempotent ----------
class TestDailyCheckin:
    def test_daily_checkin_idempotent(self):
        u = _signup("dc")
        _complete(u["token"])
        h = {"Authorization": f"Bearer {u['token']}"}
        r1 = requests.post(f"{API}/score/daily-checkin", headers=h, timeout=10)
        assert r1.status_code == 200, r1.text
        assert r1.json().get("awarded") == 10
        score_after_1 = _me(u["token"])["network_score"]
        assert score_after_1 == 250 + 10
        r2 = requests.post(f"{API}/score/daily-checkin", headers=h, timeout=10)
        assert r2.status_code == 200, r2.text
        assert r2.json().get("awarded") == 0
        assert r2.json().get("already_today") is True
        score_after_2 = _me(u["token"])["network_score"]
        assert score_after_2 == score_after_1, "daily-checkin awarded again same day"


# ---------- Weekly resource drop idempotent ----------
class TestWeeklyResource:
    def test_weekly_resource_idempotent(self):
        u = _signup("wr")
        _complete(u["token"])
        h = {"Authorization": f"Bearer {u['token']}"}
        r1 = requests.post(f"{API}/score/weekly-resource", headers=h, timeout=10)
        assert r1.status_code == 200, r1.text
        assert r1.json().get("awarded") == 30
        r2 = requests.post(f"{API}/score/weekly-resource", headers=h, timeout=10)
        assert r2.status_code == 200, r2.text
        assert r2.json().get("awarded") == 0
        assert r2.json().get("already_this_week") is True


# ---------- Posts + share + soft-cap + premium 2x + lifetime cap ----------
class TestPostsAndCaps:
    def test_post_create_awards_15(self):
        u = _signup("post")
        _complete(u["token"])
        h = {"Authorization": f"Bearer {u['token']}"}
        before = _me(u["token"])["network_score"]  # 250
        r = requests.post(f"{API}/posts", json={"content": "TEST_iter18 hello"}, headers=h, timeout=10)
        assert r.status_code == 200, r.text
        after = _me(u["token"])["network_score"]
        assert after == before + 15, f"expected +15, got delta={after - before}"

    def test_post_share_awards_8(self):
        # Two users; user A shares user B's post
        a = _signup("sa")
        b = _signup("sb")
        _complete(a["token"]); _complete(b["token"])
        # B creates a post
        rb = requests.post(f"{API}/posts", json={"content": "TEST_iter18 share-target"},
                           headers={"Authorization": f"Bearer {b['token']}"}, timeout=10)
        assert rb.status_code == 200
        post_id = rb.json()["id"]
        before = _me(a["token"])["network_score"]
        rs = requests.post(f"{API}/posts/{post_id}/share", headers={"Authorization": f"Bearer {a['token']}"}, timeout=10)
        assert rs.status_code == 200, rs.text
        after = _me(a["token"])["network_score"]
        assert after == before + 8, f"share expected +8, delta={after - before}"

    def test_daily_soft_cap_60_blocks_5th_post(self):
        u = _signup("cap")
        _complete(u["token"])
        h = {"Authorization": f"Bearer {u['token']}"}
        before = _me(u["token"])["network_score"]
        # 4 posts → 60 awarded, 5th capped at 0
        for i in range(5):
            r = requests.post(f"{API}/posts", json={"content": f"TEST_softcap_{i}"}, headers=h, timeout=10)
            assert r.status_code == 200, r.text
        after = _me(u["token"])["network_score"]
        assert after - before == 60, f"daily soft-cap broken: delta={after - before} (expected 60)"

    def test_premium_2x_multiplier(self):
        u = _signup("prem")
        _complete(u["token"])
        h = {"Authorization": f"Bearer {u['token']}"}
        # Unlock premium via NGN (Paystack mock)
        rp = requests.post(f"{API}/users/me/premium", json={"currency": "NGN"}, headers=h, timeout=15)
        assert rp.status_code == 200, rp.text
        assert rp.json().get("premium_unlocked") is True
        before = _me(u["token"])["network_score"]
        rpost = requests.post(f"{API}/posts", json={"content": "TEST_iter18 premium-post"}, headers=h, timeout=10)
        assert rpost.status_code == 200, rpost.text
        after = _me(u["token"])["network_score"]
        delta = after - before
        # Premium welcome bonus may have been awarded too. We focus on the post effect — should be 30
        # But premium may have already added points. Take score directly before posting (which we did).
        assert delta == 30, f"premium 2x post expected +30, delta={delta}"

    def test_lifetime_cap_clamp_at_10000(self):
        u = _signup("clamp")
        _complete(u["token"])
        # Manually set network_score=9990 in DB
        upd = _db.users.update_one({"id": u["id"]}, {"$set": {"network_score": 9990, "monthly_score": 9990}})
        assert upd.matched_count == 1
        h = {"Authorization": f"Bearer {u['token']}"}
        r = requests.post(f"{API}/posts", json={"content": "TEST_iter18 clamp"}, headers=h, timeout=10)
        assert r.status_code == 200, r.text
        after = _me(u["token"])["network_score"]
        assert after == 10000, f"expected clamp to 10000, got {after}"


# ---------- calculate_rank tier mapping (read after award) ----------
class TestTierMapping:
    @pytest.mark.parametrize("score,tier", [
        (0, "Member"),
        (1500, "Contributor"),
        (4000, "Connector"),
        (7000, "Builder"),
        (9500, "Steward"),
    ])
    def test_rank_for_score(self, score, tier):
        u = _signup(f"tier{score}")
        _complete(u["token"])
        _db.users.update_one({"id": u["id"]}, {"$set": {"network_score": score, "monthly_score": score}})
        # Trigger a rank refresh: award 0-effect action by calling score/tiers (no), need to write.
        # Simplest: call PUT /users/me with a no-op or trigger a post that falls within cap; here we
        # just read user after manual update — rank field may be stale. So we directly compute via
        # a manual rank update mirroring server logic by hitting an endpoint that triggers award_points.
        h = {"Authorization": f"Bearer {u['token']}"}
        # If at cap, post awards 0 but rank is recomputed only on award. Use a tiny weekly drop.
        if score < 10000:
            requests.post(f"{API}/posts", json={"content": f"TEST_iter18 rank{score}"}, headers=h, timeout=10)
        me = _me(u["token"])
        assert me["rank"] == tier, f"score={score} expected rank={tier}, got {me['rank']} (score now {me['network_score']})"


# ---------- Activities awarding ----------
class TestActivities:
    def test_activity_created_awards_150(self):
        u = _signup("act")
        _complete(u["token"])
        h = {"Authorization": f"Bearer {u['token']}"}
        before = _me(u["token"])["network_score"]
        body = {
            "title": "TEST_iter18 activity",
            "description": "score test",
            "category": "dinner",
            "country": "south_africa",
            "city": "cape_town",
            "date": "2026-12-15",
            "time": "19:00",
            "cost": 0,
            "currency": "ZAR",
            "max_participants": 10,
        }
        r = requests.post(f"{API}/activities", json=body, headers=h, timeout=15)
        assert r.status_code in (200, 201), r.text
        after = _me(u["token"])["network_score"]
        assert after - before == 150, f"activity_created expected +150, delta={after - before}"


# ---------- Regression on prior endpoints ----------
class TestRegression:
    def test_currencies_200(self):
        assert requests.get(f"{API}/currencies", timeout=10).status_code == 200

    def test_public_live_activity_200(self):
        assert requests.get(f"{API}/activity/live", timeout=10).status_code == 200

    def test_public_leaderboard_200(self):
        assert requests.get(f"{API}/leaderboard/public", timeout=10).status_code == 200

    def test_hub_regions_200(self):
        u = _signup("reg")
        _complete(u["token"])
        h = {"Authorization": f"Bearer {u['token']}"}
        # Hubs require auth typically
        r = requests.get(f"{API}/hubs/regions", headers=h, timeout=10)
        assert r.status_code == 200, r.text

    def test_stripe_checkout_session_200(self):
        u = _signup("stripe")
        _complete(u["token"])
        h = {"Authorization": f"Bearer {u['token']}"}
        body = {"currency": "USD", "origin_url": BASE_URL}
        r = requests.post(f"{API}/payments/checkout/session", json=body, headers=h, timeout=20)
        assert r.status_code == 200, r.text

    def test_dm_send_200(self):
        a = _signup("dma"); b = _signup("dmb")
        _complete(a["token"]); _complete(b["token"])
        body = {"recipient_id": b["id"], "text": "TEST_iter18 dm"}
        r = requests.post(f"{API}/dm/send", json=body, headers={"Authorization": f"Bearer {a['token']}"}, timeout=10)
        assert r.status_code == 200, r.text
