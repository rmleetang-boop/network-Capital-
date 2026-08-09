"""Quick verify: elementFromPoint at dm-send-button center"""
import asyncio, os, time, requests
from playwright.async_api import async_playwright

BASE = "https://fly-platform.preview.emergentagent.com"
API = f"{BASE}/api"

def make_user(suffix):
    ts = int(time.time() * 1000)
    email = f"TEST_dmq_{suffix}_{ts}@test.networkcapital.app"
    r = requests.post(f"{API}/auth/progressive-signup", json={"email": email, "password": "TestPass123!"})
    token = r.json()["token"]
    uname = f"q{suffix}{ts}"[-20:]
    requests.post(f"{API}/auth/complete-profile",
        json={"full_name": f"Q {suffix}", "username": uname, "bio": "t", "intent": "member", "terms_accepted": True},
        headers={"Authorization": f"Bearer {token}"})
    return {"token": token, "id": r.json()["user"]["id"], "username": uname}

async def main():
    u1 = make_user("a")
    u2 = make_user("b")
    print(f"u1={u1['id'][:8]} u2={u2['id'][:8]}")

    async with async_playwright() as p:
        browser = await p.chromium.launch()
        ctx = await browser.new_context(viewport={"width": 390, "height": 844})
        page = await ctx.new_page()
        page.set_default_navigation_timeout(60000)

        await page.goto(BASE, wait_until="commit")
        await page.wait_for_timeout(4000)
        await page.evaluate(f"localStorage.setItem('token', '{u1['token']}')")
        await page.goto(f"{BASE}/messages/{u2['id']}", wait_until="commit")
        # wait for chat-thread-page or fall back
        try:
            await page.wait_for_selector('[data-testid="chat-thread-page"]', timeout=30000)
            print("chat-thread-page rendered")
        except Exception as e:
            print(f"chat-thread-page wait failed: {e}")
            html = await page.content()
            print("page content (first 1000):", html[:1000])
        await page.wait_for_timeout(2000)

        # Check what's at center of dm-send-button
        info = await page.evaluate("""() => {
          const btn = document.querySelector('[data-testid="dm-send-button"]');
          if (!btn) return {err:'no btn'};
          const r = btn.getBoundingClientRect();
          const cx = r.left + r.width/2, cy = r.top + r.height/2;
          const el = document.elementFromPoint(cx, cy);
          // also check whole composer area
          const composer = document.querySelector('[data-testid="dm-composer"]');
          const cr = composer?.getBoundingClientRect();
          // badge
          const badge = document.getElementById('emergent-badge');
          const br = badge?.getBoundingClientRect();
          // bottom nav
          const navs = document.querySelectorAll('[data-testid^="bottom-nav-"]').length;
          return {
            btn_rect: {x:r.left, y:r.top, w:r.width, h:r.height},
            elementAtBtnCenter: { tag: el?.tagName, id: el?.id, testid: el?.getAttribute('data-testid'),
              closestId: el?.closest('[id]')?.id,
              closestTestid: el?.closest('[data-testid]')?.getAttribute('data-testid')},
            isBtnOrChild: !!(el && (el.matches('[data-testid="dm-send-button"]') || el.closest('[data-testid="dm-send-button"]'))),
            composer_rect: cr ? {x:cr.left, y:cr.top, w:cr.width, h:cr.height} : null,
            badge_rect: br ? {x:br.left, y:br.top, w:br.width, h:br.height} : null,
            bottom_nav_count: navs,
            viewport: {w: window.innerWidth, h: window.innerHeight},
          };
        }""")
        print("RESULT:", info)

        # Also check image button and mic button  
        info2 = await page.evaluate("""() => {
          const out = {};
          for (const tid of ['dm-image-tile','dm-start-recording','dm-text-input']) {
            const el = document.querySelector(`[data-testid="${tid}"]`);
            if (!el) { out[tid] = 'missing'; continue; }
            const r = el.getBoundingClientRect();
            const cx = r.left + r.width/2, cy = r.top + r.height/2;
            const top = document.elementFromPoint(cx, cy);
            out[tid] = {
              rect: {x:r.left, y:r.top, w:r.width, h:r.height},
              hit: { tag: top?.tagName, id: top?.id, testid: top?.getAttribute('data-testid')},
              isSelfOrChild: !!(top && (top===el || el.contains(top)))
            };
          }
          return out;
        }""")
        print("BUTTONS:", info2)

        await browser.close()

asyncio.run(main())
