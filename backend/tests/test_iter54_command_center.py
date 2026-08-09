"""Iter 54 — Ambassador Dashboard 2.0 (Command Center) backend tests.

Covers the NEW endpoints introduced in iter53/54:
 - GET  /api/ambassador/command-center
 - POST /api/ambassador/referrals/{uid}/engage
 - GET  /api/ambassador/engagement-log
 - PUT  /api/ambassador/autopilot

Standing ambassador credential (per /app/memory/test_credentials.md):
    rmleetang+nctest1780423349@gmail.com / Test123!  (is_ambassador=True)

Owner Super Admin:
    rmleetang@gmail.com / OwnerTest123!  (not an ambassador → 403 expected)
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://fly-platform.preview.emergentagent.com").rstrip("/")
AMBASSADOR_EMAIL = "rmleetang+nctest1780423349@gmail.com"
AMBASSADOR_PASSWORD = "Test123!"
OWNER_EMAIL = "rmleetang@gmail.com"
OWNER_PASSWORD = "OwnerTest123!"


def _login(email: str, password: str):
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    j = r.json()
    return j["token"], j["user"]


@pytest.fixture(scope="module")
def ambassador():
    token, user = _login(AMBASSADOR_EMAIL, AMBASSADOR_PASSWORD)
    return {"token": token, "user": user, "headers": {"Authorization": f"Bearer {token}"}}


@pytest.fixture(scope="module")
def owner_non_ambassador():
    # The "owner" account is super_admin but NOT an ambassador → useful for 403 tests
    token, user = _login(OWNER_EMAIL, OWNER_PASSWORD)
    return {"token": token, "user": user, "headers": {"Authorization": f"Bearer {token}"}}


@pytest.fixture(scope="module")
def command_center_payload(ambassador):
    r = requests.get(f"{BASE_URL}/api/ambassador/command-center",
                     headers=ambassador["headers"], timeout=30)
    assert r.status_code == 200, f"command-center failed: {r.status_code} {r.text[:400]}"
    return r.json()


# ───────────────────────── command-center payload shape ─────────────────────────
class TestCommandCenterPayload:
    def test_top_level_keys(self, command_center_payload):
        keys = set(command_center_payload.keys())
        expected = {"generated_at", "kpis", "network", "insights", "funnel",
                    "heatmap", "hidden_bonus", "level", "autopilot"}
        missing = expected - keys
        assert not missing, f"missing top-level keys: {missing}"

    def test_kpis_shape(self, command_center_payload):
        kpis = command_center_payload["kpis"]
        for k in ["wallet_balance", "available_withdrawal_zar", "qualified_referrals",
                  "pending_referrals", "active_referrals", "inactive_referrals",
                  "hidden_bonus_active", "estimated_next_reward_zar"]:
            assert k in kpis, f"missing kpi: {k}"
        assert isinstance(kpis["qualified_referrals"], int)
        assert isinstance(kpis["pending_referrals"], int)
        assert isinstance(kpis["active_referrals"], int)
        assert isinstance(kpis["inactive_referrals"], int)
        assert isinstance(kpis["hidden_bonus_active"], bool)

    def test_network_has_ambassador_and_nodes(self, command_center_payload):
        net = command_center_payload["network"]
        assert "ambassador" in net and "nodes" in net
        assert net["ambassador"]["id"]
        assert isinstance(net["nodes"], list)
        # 14 seeded referrals expected per problem statement
        assert len(net["nodes"]) >= 14, f"expected >=14 nodes, got {len(net['nodes'])}"

    def test_each_node_has_required_fields(self, command_center_payload):
        required = {"id", "username", "full_name", "photo", "email", "stage",
                    "color", "size", "engagement_score", "activity_30d",
                    "last_activity", "profile_completion_pct", "registration_date",
                    "monthly_score", "is_inactive"}
        for node in command_center_payload["network"]["nodes"]:
            missing = required - set(node.keys())
            assert not missing, f"node {node.get('id')} missing: {missing}"
            # stage classification value
            assert node["stage"] in {"registered", "verified", "profile_completed", "active", "qualified"}
            # color thresholds
            assert node["color"] in {"green", "yellow", "orange", "red"}
            # size in 14..36
            assert 14 <= node["size"] <= 36, f"size out of range: {node['size']}"
            # engagement_score in 0..100
            assert 0 <= node["engagement_score"] <= 100

    def test_engagement_score_and_color_consistency(self, command_center_payload):
        for n in command_center_payload["network"]["nodes"]:
            eng, color = n["engagement_score"], n["color"]
            expected = (
                "green"  if eng >= 75 else
                "yellow" if eng >= 50 else
                "orange" if eng >= 25 else
                "red"
            )
            assert color == expected, f"node {n['id']} eng={eng} color={color} expected={expected}"

    def test_stage_classification_seeded(self, command_center_payload):
        # The 14 seeded users should exercise multiple stages (per problem statement)
        stages_present = {n["stage"] for n in command_center_payload["network"]["nodes"]}
        assert len(stages_present) >= 2, f"expected variety of stages, got {stages_present}"

    def test_funnel_six_stages_with_relative_pct(self, command_center_payload):
        funnel = command_center_payload["funnel"]
        assert len(funnel) == 6, f"expected 6 funnel stages, got {len(funnel)}"
        names = [f["stage"] for f in funnel]
        assert names == ["Invited", "Registered", "Verified",
                         "Profile Completed", "Active", "Qualified"]
        # pct of Verified..Qualified should be relative to Registered
        registered = funnel[1]["count"]
        if registered > 0:
            for step in funnel[2:]:
                expected_pct = round(step["count"] / registered * 100, 1)
                assert step["pct"] == expected_pct, (
                    f"{step['stage']} pct={step['pct']} expected={expected_pct} "
                    f"(count={step['count']}, registered={registered})"
                )
        # Each step has count + pct
        for s in funnel:
            assert "count" in s and "pct" in s

    def test_heatmap_thirty_entries(self, command_center_payload):
        hm = command_center_payload["heatmap"]
        assert len(hm) == 30, f"expected 30 heatmap entries, got {len(hm)}"
        for entry in hm:
            assert "date" in entry and "count" in entry
            assert len(entry["date"]) == 10  # YYYY-MM-DD
            assert isinstance(entry["count"], int)

    def test_level_card(self, command_center_payload):
        level = command_center_payload["level"]
        for k in ["current", "next", "progress_pct", "lifetime_earnings_zar", "lifetime_referrals"]:
            assert k in level
        assert level["current"] in [
            "Starter Ambassador", "Growth Ambassador", "Elite Ambassador",
            "Platinum Ambassador", "Diamond Ambassador", "Legend Ambassador",
        ]
        assert 0 <= level["progress_pct"] <= 100

    def test_hidden_bonus_signal(self, command_center_payload):
        hb = command_center_payload["hidden_bonus"]
        for k in ["active", "streak_active", "unlock_pct", "signal_text"]:
            assert k in hb
        assert isinstance(hb["signal_text"], str) and len(hb["signal_text"]) > 0

    def test_insights_present(self, command_center_payload):
        ins = command_center_payload["insights"]
        assert isinstance(ins, list) and len(ins) >= 1
        for entry in ins:
            assert "text" in entry

    def test_autopilot_shape(self, command_center_payload):
        ap = command_center_payload["autopilot"]
        assert "enabled" in ap

    def test_non_ambassador_403(self, owner_non_ambassador):
        # Owner super admin is NOT an ambassador → 403 expected
        if owner_non_ambassador["user"].get("is_ambassador"):
            pytest.skip("Owner account happens to be an ambassador in this env")
        r = requests.get(f"{BASE_URL}/api/ambassador/command-center",
                         headers=owner_non_ambassador["headers"], timeout=30)
        assert r.status_code == 403, f"expected 403, got {r.status_code} body={r.text[:200]}"


# ───────────────────────── engagement emails ─────────────────────────
class TestEngagementEmails:
    def test_engage_unknown_type_returns_400(self, ambassador, command_center_payload):
        nodes = command_center_payload["network"]["nodes"]
        if not nodes:
            pytest.skip("no referrals to target")
        rid = nodes[0]["id"]
        r = requests.post(f"{BASE_URL}/api/ambassador/referrals/{rid}/engage",
                          headers=ambassador["headers"], json={"type": "bogus_type"}, timeout=30)
        assert r.status_code == 400, f"expected 400 for unknown type, got {r.status_code}"

    def test_engage_referral_not_in_network_returns_404(self, ambassador):
        r = requests.post(
            f"{BASE_URL}/api/ambassador/referrals/non-existent-uid-xyz/engage",
            headers=ambassador["headers"], json={"type": "motivation"}, timeout=30)
        assert r.status_code == 404, f"expected 404, got {r.status_code}"

    def test_engage_each_type_writes_row(self, ambassador, command_center_payload):
        nodes = command_center_payload["network"]["nodes"]
        if not nodes:
            pytest.skip("no referrals to target")
        rid = nodes[0]["id"]
        for et in ("motivation", "reminder", "profile", "verification", "reengagement"):
            r = requests.post(f"{BASE_URL}/api/ambassador/referrals/{rid}/engage",
                              headers=ambassador["headers"], json={"type": et}, timeout=30)
            assert r.status_code == 200, f"engage type={et} failed: {r.status_code} {r.text[:200]}"
            j = r.json()
            assert j.get("ok") is True
            log = j.get("log") or {}
            assert log.get("type") == et
            # Brevo is blocked → expect failed or delivered (failed is the common case)
            assert log.get("status") in {"queued", "delivered", "failed"}
            if log.get("status") == "failed":
                assert log.get("last_error"), "last_error should be populated on failure"

    def test_engagement_log_returns_rows(self, ambassador):
        r = requests.get(f"{BASE_URL}/api/ambassador/engagement-log?limit=50",
                         headers=ambassador["headers"], timeout=30)
        assert r.status_code == 200
        j = r.json()
        items = j.get("items") or []
        assert isinstance(items, list)
        # The previous tests just wrote ≥5 rows → expect at least that many
        assert len(items) >= 5, f"expected >=5 log rows, got {len(items)}"
        # Newest-first
        dates = [row.get("created_at") for row in items if row.get("created_at")]
        assert dates == sorted(dates, reverse=True), "engagement-log should be newest-first"
        # Scoped to ambassador
        for row in items:
            assert row.get("ambassador_id") == ambassador["user"]["id"]

    def test_engagement_log_non_ambassador_403(self, owner_non_ambassador):
        if owner_non_ambassador["user"].get("is_ambassador"):
            pytest.skip("Owner account happens to be ambassador")
        r = requests.get(f"{BASE_URL}/api/ambassador/engagement-log",
                         headers=owner_non_ambassador["headers"], timeout=30)
        assert r.status_code == 403


# ───────────────────────── autopilot toggle ─────────────────────────
class TestAutopilot:
    def test_toggle_on_then_off(self, ambassador):
        r1 = requests.put(f"{BASE_URL}/api/ambassador/autopilot",
                          headers=ambassador["headers"], json={"enabled": True}, timeout=30)
        assert r1.status_code == 200, r1.text
        assert r1.json().get("enabled") is True

        # Confirm via command-center
        cc = requests.get(f"{BASE_URL}/api/ambassador/command-center",
                          headers=ambassador["headers"], timeout=30).json()
        assert cc["autopilot"]["enabled"] is True

        r2 = requests.put(f"{BASE_URL}/api/ambassador/autopilot",
                          headers=ambassador["headers"], json={"enabled": False}, timeout=30)
        assert r2.status_code == 200
        assert r2.json().get("enabled") is False

        cc2 = requests.get(f"{BASE_URL}/api/ambassador/command-center",
                           headers=ambassador["headers"], timeout=30).json()
        assert cc2["autopilot"]["enabled"] is False

    def test_autopilot_non_ambassador_403(self, owner_non_ambassador):
        if owner_non_ambassador["user"].get("is_ambassador"):
            pytest.skip("Owner is ambassador")
        r = requests.put(f"{BASE_URL}/api/ambassador/autopilot",
                         headers=owner_non_ambassador["headers"],
                         json={"enabled": True}, timeout=30)
        assert r.status_code == 403


# ───────────────────────── regression — existing endpoints ─────────────────────────
class TestRegression:
    def test_ambassadors_me_still_works(self, ambassador):
        r = requests.get(f"{BASE_URL}/api/ambassadors/me",
                         headers=ambassador["headers"], timeout=30)
        assert r.status_code == 200
        j = r.json()
        for k in ["rank", "recruit_count", "new_7d", "new_30d", "total_contribution"]:
            assert k in j, f"missing {k} in /ambassadors/me"

    def test_ambassador_incentive_still_works(self, ambassador):
        r = requests.get(f"{BASE_URL}/api/ambassador/incentive",
                         headers=ambassador["headers"], timeout=30)
        assert r.status_code == 200
        j = r.json()
        for k in ["available_zar", "starting_balance_zar", "paid_zar",
                  "tier_referrals_required", "june_payout_locked"]:
            assert k in j
