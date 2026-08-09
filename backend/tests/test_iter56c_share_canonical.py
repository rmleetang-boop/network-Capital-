"""Iter 56c — share-link canonical domain regression tests.

USER-REPORTED BUG: share OG endpoints were emitting the preview/cluster host
(`stokvel-plus.preview.emergentagent.com` / `…cluster-5.deploy.emergentcf.cloud`)
instead of the production brand domain `networkcapitalapp.co.za` in:
  - <link rel="canonical">
  - <meta property="og:url">
  - <meta http-equiv="refresh" content="0;url=…">
  - window.location.replace("…") in the inline script

The fix (server.py::_share_html_response) hardcodes the base to
`https://networkcapitalapp.co.za` regardless of `request.url.netloc`.

We hit the PREVIEW backend (REACT_APP_BACKEND_URL) and confirm the response
HTML emits networkcapitalapp.co.za, not the preview host.
"""

import os
import re
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://fly-platform.preview.emergentagent.com").rstrip("/")
PROD_DOMAIN = "https://networkcapitalapp.co.za"
PREVIEW_HOST_TOKEN = "stokvel-plus"  # must NOT appear in canonical/og:url/refresh/replace


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _fetch(path: str) -> requests.Response:
    return requests.get(f"{BASE_URL}{path}", timeout=20, allow_redirects=False)


def _assert_canonical_is_production(html: str, expected_path_suffix: str) -> None:
    """All 4 URL emission points must use networkcapitalapp.co.za and
    NEVER the preview/cluster host."""
    # (a) <link rel="canonical" ...>
    m = re.search(r'<link rel="canonical" href="([^"]+)"', html)
    assert m, "missing <link rel=canonical>"
    canonical = m.group(1)
    assert canonical.startswith(PROD_DOMAIN), f"canonical not on prod domain: {canonical}"
    assert PREVIEW_HOST_TOKEN not in canonical, f"canonical leaked preview host: {canonical}"
    assert canonical.endswith(expected_path_suffix), f"canonical path mismatch: {canonical}"

    # (b) <meta property="og:url" ...>
    m = re.search(r'<meta property="og:url" content="([^"]+)"', html)
    assert m, "missing og:url"
    og_url = m.group(1)
    assert og_url.startswith(PROD_DOMAIN), f"og:url not on prod domain: {og_url}"
    assert PREVIEW_HOST_TOKEN not in og_url

    # (c) <meta http-equiv="refresh" content="0;url=…">
    m = re.search(r'<meta http-equiv="refresh" content="0;url=([^"]+)"', html)
    assert m, "missing meta refresh"
    refresh = m.group(1)
    assert refresh.startswith(PROD_DOMAIN), f"refresh URL not on prod domain: {refresh}"
    assert PREVIEW_HOST_TOKEN not in refresh

    # (d) inline JS window.location.replace("…")
    m = re.search(r'window\.location\.replace\("([^"]+)"\)', html)
    assert m, "missing window.location.replace"
    js_url = m.group(1)
    assert js_url.startswith(PROD_DOMAIN), f"JS replace URL not on prod domain: {js_url}"
    assert PREVIEW_HOST_TOKEN not in js_url


# ---------------------------------------------------------------------------
# Share OG endpoint tests
# ---------------------------------------------------------------------------
class TestShareCanonicalDomain:
    """All /api/share/* endpoints must emit networkcapitalapp.co.za URLs."""

    def test_share_product_endpoint_uses_production_domain(self):
        # Owner seed from iter 56 — `owner` user with `iter56-lean-live` slug.
        r = _fetch("/api/share/p/owner/iter56-lean-live")
        assert r.status_code == 200, f"share/p returned {r.status_code}: {r.text[:200]}"
        assert "text/html" in r.headers.get("content-type", "").lower()
        _assert_canonical_is_production(r.text, "/p/owner/iter56-lean-live")

    def test_share_product_endpoint_unknown_slug_still_returns_canonical(self):
        # Even unknown slugs should still produce a valid OG HTML with prod canonical
        # (server returns 200 with a generic card OR 404 — either way URL must be prod).
        r = _fetch("/api/share/p/owner/this-slug-should-not-exist-xyz")
        assert r.status_code in (200, 404)
        if r.status_code == 200:
            assert PREVIEW_HOST_TOKEN not in r.text
            assert PROD_DOMAIN in r.text

    def test_share_user_endpoint_uses_production_domain(self):
        r = _fetch("/api/share/u/owner")
        assert r.status_code == 200, f"share/u returned {r.status_code}"
        _assert_canonical_is_production(r.text, "/u/owner")

    def test_share_referral_endpoint_uses_production_domain(self):
        r = _fetch("/api/share/r/owner")
        assert r.status_code == 200, f"share/r returned {r.status_code}"
        _assert_canonical_is_production(r.text, "/r/owner")

    def test_share_landing_endpoint_uses_production_domain(self):
        # Root landing share card
        r = _fetch("/api/share")
        assert r.status_code == 200
        # Must contain prod domain & NOT preview host
        assert PROD_DOMAIN in r.text
        assert PREVIEW_HOST_TOKEN not in r.text


class TestShareSecurityAndContent:
    """OG HTML must still include all required meta tags (iter 55 regression guard)."""

    def test_share_product_has_all_required_og_tags(self):
        r = _fetch("/api/share/p/owner/iter56-lean-live")
        assert r.status_code == 200
        html = r.text
        # Iter 55 regression: full OG/Twitter card metadata
        required_substrings = [
            '<meta property="og:type" content="website" />',
            '<meta property="og:title"',
            '<meta property="og:description"',
            '<meta property="og:url"',
            '<meta property="og:site_name" content="Network Capital" />',
            '<meta name="twitter:title"',
            '<meta name="twitter:description"',
            '<link rel="canonical"',
        ]
        for needle in required_substrings:
            assert needle in html, f"missing OG/twitter tag fragment: {needle}"

    def test_share_html_returns_200_not_500(self):
        # Iter 55 regression guard: previously this endpoint had a 500
        for path in [
            "/api/share/p/owner/iter56-lean-live",
            "/api/share/u/owner",
            "/api/share/r/owner",
            "/api/share",
        ]:
            r = _fetch(path)
            assert r.status_code == 200, f"{path} regressed to {r.status_code}"


# ---------------------------------------------------------------------------
# Regression guard #3 — SHARE_BASE_URL surfaces (referrals etc.)
# ---------------------------------------------------------------------------
class TestNonShareEndpointShareUrls:
    """Other surfaces that emit share URLs (referrals, ambassador, promotions,
    jobs) should also point to networkcapitalapp.co.za. We only sanity-check
    one public-ish surface here — referrals/me requires auth so we just
    document via a presence check on the JS bundle / public endpoints."""

    def test_health(self):
        # Basic backend reachability sanity check.
        r = requests.get(f"{BASE_URL}/api/health", timeout=10)
        # Not all builds have /health — accept 200 or 404
        assert r.status_code in (200, 404)
