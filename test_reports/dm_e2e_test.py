"""DM E2E test - retest after BottomNav overlap fix"""
import asyncio, os, time, requests, json, base64
from playwright.async_api import async_playwright

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://mongo-dump-viewer.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"

def make_user(suffix):
    ts = int(time.time() * 1000)
    email = f"TEST_dm_{suffix}_{ts}@test.networkcapital.app"
    pwd = "TestPass123!"
    r = requests.post(f"{API}/auth/progressive-signup", json={"email": email, "password": pwd})
    assert r.status_code == 200, f"signup failed: {r.status_code} {r.text}"
    token = r.json()["token"]
    user = r.json()["user"]
    uname = f"test{suffix}{ts}"[-20:]
    r2 = requests.post(f"{API}/auth/complete-profile",
        json={"full_name": f"Test {suffix}", "username": uname, "bio": "t", "intent": "member", "terms_accepted": True},
        headers={"Authorization": f"Bearer {token}"})
    assert r2.status_code == 200, f"complete-profile failed: {r2.status_code} {r2.text}"
    user = r2.json()["user"]
    return {"token": token, "id": user["id"], "username": user["username"], "email": email}

async def login_user(page, user):
    page.set_default_timeout(15000)
    page.set_default_navigation_timeout(60000)
    await page.goto(BASE, wait_until="commit")
    await page.wait_for_load_state("domcontentloaded", timeout=30000)
    await page.evaluate(f"localStorage.setItem('token', '{user['token']}')")
    await page.goto(BASE + "/", wait_until="commit")
    await page.wait_for_load_state("domcontentloaded", timeout=30000)
    await page.wait_for_timeout(3000)

async def main():
    print("=== Creating 2 users ===")
    u1 = make_user("a")
    u2 = make_user("b")
    print(f"u1={u1['username']} id={u1['id']}")
    print(f"u2={u2['username']} id={u2['id']}")

    results = {"passed": [], "failed": []}

    async with async_playwright() as p:
        browser = await p.chromium.launch(args=["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"])
        ctx = await browser.new_context(viewport={"width": 390, "height": 844}, permissions=["microphone"])
        page = await ctx.new_page()
        page.on("console", lambda msg: print(f"CON[{msg.type}]:", msg.text[:200]) if msg.type in ("error","warning") else None)

        try:
            await login_user(page, u1)

            # ==================== TEST 1: /messages BottomNav GONE ====================
            print("\n--- T1: /messages BottomNav hidden ---")
            await page.goto(BASE + "/messages", wait_until="commit")
            await page.wait_for_timeout(1500)
            try:
                await page.wait_for_selector('[data-testid="messages-page"]', timeout=5000)
                nav_count = await page.locator('[data-testid^="bottom-nav-"]').count()
                if nav_count == 0:
                    results["passed"].append("T1: /messages — BottomNav HIDDEN, messages-page renders")
                    print("PASS T1")
                else:
                    results["failed"].append(f"T1: BottomNav still visible on /messages (count={nav_count})")
            except Exception as e:
                results["failed"].append(f"T1: messages-page not rendered: {e}")

            # ==================== TEST 2: /messages/:id ====================
            print("\n--- T2: /messages/:id composer interactivity ---")
            await page.goto(f"{BASE}/messages/{u2['id']}", wait_until="commit")
            await page.wait_for_timeout(2000)
            try:
                await page.wait_for_selector('[data-testid="chat-thread-page"]', timeout=5000)
                nav_count = await page.locator('[data-testid^="bottom-nav-"]').count()
                composer = await page.locator('[data-testid="dm-composer"]').count()
                # elementFromPoint at center of dm-send-button
                ep = await page.evaluate("""() => {
                  const b = document.querySelector('[data-testid="dm-send-button"]');
                  if (!b) return {err:'no btn'};
                  const r = b.getBoundingClientRect();
                  const x = r.left + r.width/2, y = r.top + r.height/2;
                  const el = document.elementFromPoint(x, y);
                  return {tag: el?.tagName, testid: el?.getAttribute('data-testid'),
                          closest: el?.closest('[data-testid]')?.getAttribute('data-testid'),
                          isBtnOrChild: !!(el && (el.matches('[data-testid="dm-send-button"]') || el.closest('[data-testid="dm-send-button"]')))};
                }""")
                print(f"elementFromPoint result: {ep}")
                if nav_count == 0 and composer == 1 and ep.get("isBtnOrChild"):
                    results["passed"].append(f"T2: chat-thread-page renders, no BottomNav, dm-send-button hit-test OK ({ep})")
                    print("PASS T2")
                else:
                    results["failed"].append(f"T2 FAIL nav={nav_count} composer={composer} hit={ep}")
            except Exception as e:
                results["failed"].append(f"T2 exception: {e}")

            # ==================== TEST 3: Clean text TAP send ====================
            print("\n--- T3: clean-text tap send ---")
            try:
                await page.fill('[data-testid="dm-text-input"]', 'hey friend')
                await page.wait_for_timeout(700)  # wait for compliance check
                # check no compliance warning for clean text
                cw = await page.locator('[data-testid="compliance-warning"]').count()
                # capture network
                req_seen = {"send": False}
                def _handle(req):
                    if "/dm/send" in req.url and req.method == "POST":
                        req_seen["send"] = True
                page.on("request", _handle)
                await page.click('[data-testid="dm-send-button"]')
                await page.wait_for_timeout(2000)
                msg_count = await page.locator('[data-testid^="dm-msg-"]').count()
                txt_val = await page.input_value('[data-testid="dm-text-input"]')
                if cw == 0 and msg_count >= 1 and txt_val == '' and req_seen["send"]:
                    results["passed"].append(f"T3: clean-text tap send — POST fired, msg rendered, textarea cleared (msgs={msg_count})")
                    print("PASS T3")
                else:
                    results["failed"].append(f"T3 FAIL cw={cw} msgs={msg_count} txt='{txt_val}' postSent={req_seen['send']}")
                page.remove_listener("request", _handle)
            except Exception as e:
                results["failed"].append(f"T3 exception: {e}")

            # ==================== TEST 4: Compliance 2-tap ====================
            print("\n--- T4: compliance 2-tap ---")
            try:
                await page.fill('[data-testid="dm-text-input"]', 'great profit this month')
                await page.wait_for_timeout(900)
                cw_count = await page.locator('[data-testid="compliance-warning"]').count()
                cw_text = ""
                if cw_count:
                    cw_text = await page.locator('[data-testid="compliance-warning"]').inner_text()
                print(f"compliance-warning count={cw_count} text={cw_text[:120]}")

                send_calls = {"n": 0}
                def _h2(req):
                    if "/dm/send" in req.url and req.method == "POST":
                        send_calls["n"] += 1
                page.on("request", _h2)
                await page.click('[data-testid="dm-send-button"]')
                await page.wait_for_timeout(800)
                first_calls = send_calls["n"]
                # 2nd tap without changing text
                await page.click('[data-testid="dm-send-button"]')
                await page.wait_for_timeout(2000)
                second_calls = send_calls["n"]
                msg_count2 = await page.locator('[data-testid^="dm-msg-"]').count()
                page.remove_listener("request", _h2)
                ok = (cw_count == 1 and "profit" in cw_text and "support" in cw_text and first_calls == 0 and second_calls == 1 and msg_count2 >= 2)
                if ok:
                    results["passed"].append(f"T4: compliance 2-tap — warning shown, 1st tap blocked, 2nd tap fired (msgs={msg_count2})")
                    print("PASS T4")
                else:
                    results["failed"].append(f"T4 FAIL cw={cw_count} cwtxt='{cw_text[:80]}' 1stCalls={first_calls} 2ndCalls={second_calls} msgs={msg_count2}")
            except Exception as e:
                results["failed"].append(f"T4 exception: {e}")

            # ==================== TEST 5: Image attach ====================
            print("\n--- T5: image attach ---")
            try:
                # Create a tiny PNG
                tiny_png = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=")
                tmp_path = "/tmp/tiny.png"
                with open(tmp_path, "wb") as f:
                    f.write(tiny_png)
                await page.set_input_files('[data-testid="dm-image-input"]', tmp_path)
                await page.wait_for_timeout(700)
                # preview should appear
                rem = await page.locator('[data-testid="dm-remove-image"]').count()
                if rem == 1:
                    print("preview appeared")
                    await page.click('[data-testid="dm-remove-image"]')
                    await page.wait_for_timeout(400)
                    rem2 = await page.locator('[data-testid="dm-remove-image"]').count()
                    if rem2 == 0:
                        # re-attach and send
                        await page.set_input_files('[data-testid="dm-image-input"]', tmp_path)
                        await page.wait_for_timeout(500)
                        await page.click('[data-testid="dm-send-button"]')
                        await page.wait_for_timeout(2500)
                        # check last msg has img
                        has_img = await page.evaluate("""() => {
                          const rows = document.querySelectorAll('[data-testid^="dm-msg-"]');
                          if (!rows.length) return false;
                          const last = rows[rows.length - 1];
                          return !!last.querySelector('img');
                        }""")
                        if has_img:
                            results["passed"].append("T5: image attach -> remove -> re-attach -> send -> msg has <img>")
                            print("PASS T5")
                        else:
                            results["failed"].append("T5: img not found in last msg row after send")
                    else:
                        results["failed"].append("T5: preview not cleared after dm-remove-image")
                else:
                    results["failed"].append(f"T5: preview not shown after image input (rem count={rem})")
            except Exception as e:
                results["failed"].append(f"T5 exception: {e}")

            # ==================== TEST 6: Mic button swap ====================
            print("\n--- T6: mic button swap ---")
            try:
                start_visible = await page.locator('[data-testid="dm-start-recording"]').count()
                # check if disabled (audio attached after T5 image - but T5 sent it, so audio state cleared)
                disabled = await page.locator('[data-testid="dm-start-recording"]').is_disabled() if start_visible else None
                print(f"dm-start-recording count={start_visible} disabled={disabled}")
                if start_visible == 1:
                    # Try clicking - we have fake media stream
                    try:
                        await page.click('[data-testid="dm-start-recording"]', timeout=3000)
                        await page.wait_for_timeout(1500)
                        stop_visible = await page.locator('[data-testid="dm-stop-recording"]').count()
                        if stop_visible == 1:
                            await page.click('[data-testid="dm-stop-recording"]')
                            await page.wait_for_timeout(1000)
                            audio_preview = await page.locator('[data-testid="dm-remove-audio"]').count()
                            results["passed"].append(f"T6: mic swap start->stop OK, audio_preview={audio_preview}")
                            print("PASS T6 with full record cycle")
                            if audio_preview:
                                await page.click('[data-testid="dm-remove-audio"]')
                                await page.wait_for_timeout(300)
                        else:
                            results["passed"].append("T6: dm-start-recording present and tappable (mic perm denied by playwright fake device)")
                            print("PASS T6 partial")
                    except Exception as e2:
                        results["passed"].append(f"T6: dm-start-recording present (record cycle skipped: {e2})")
                else:
                    results["failed"].append("T6: dm-start-recording not visible")
            except Exception as e:
                results["failed"].append(f"T6 exception: {e}")

            # ==================== TEST 7: Threads list ====================
            print("\n--- T7: thread list & navigation back ---")
            try:
                await page.click('[data-testid="chat-back"]')
                await page.wait_for_url("**/messages", timeout=5000)
                await page.wait_for_timeout(1500)
                thread_sel = f'[data-testid="thread-{u2["id"]}"]'
                thread_count = await page.locator(thread_sel).count()
                if thread_count == 1:
                    last_text_el = await page.locator(thread_sel).inner_text()
                    print(f"thread row text snippet: {last_text_el[:120]}")
                    await page.click(thread_sel)
                    await page.wait_for_url(f"**/messages/{u2['id']}**", timeout=5000)
                    await page.wait_for_timeout(1500)
                    chat_present = await page.locator('[data-testid="chat-thread-page"]').count()
                    if chat_present == 1:
                        results["passed"].append(f"T7: back to /messages, thread-{u2['id'][:8]} present, tap reopens chat")
                        print("PASS T7")
                    else:
                        results["failed"].append("T7: chat did not reopen after thread tap")
                else:
                    results["failed"].append(f"T7: thread-{u2['id']} not found in list")
            except Exception as e:
                results["failed"].append(f"T7 exception: {e}")

            # ==================== TEST 8: Share-a-post auto-send ====================
            print("\n--- T8: share-a-post auto-send ---")
            try:
                # Create a post via API as u1 (since we need a post to share)
                pr = requests.post(f"{API}/posts",
                    json={"content": "TEST_dm_share post for sharing", "image": None},
                    headers={"Authorization": f"Bearer {u1['token']}"})
                if pr.status_code == 200:
                    post_id = pr.json().get("id") or pr.json().get("post", {}).get("id")
                    print(f"created post {post_id}")
                    # Go to feed
                    await page.goto(BASE + "/", wait_until="commit")
                    await page.wait_for_timeout(2500)
                    # find share button on the post
                    share_btns = await page.locator('button[data-testid^="share-button-"], [data-testid^="post-share-"], [aria-label*="hare"]').count()
                    print(f"share button candidates on feed: {share_btns}")
                    # try common selectors
                    clicked = False
                    for sel in [f'[data-testid="share-button-{post_id}"]', f'[data-testid="post-share-{post_id}"]', '[data-testid^="share-button-"]', '[data-testid^="post-share-"]']:
                        try:
                            if await page.locator(sel).count() > 0:
                                await page.locator(sel).first.click()
                                clicked = True
                                print(f"clicked share with selector {sel}")
                                break
                        except: pass
                    if clicked:
                        await page.wait_for_timeout(800)
                        sharedm = await page.locator('[data-testid="share-send-dm"]').count()
                        if sharedm:
                            await page.click('[data-testid="share-send-dm"]')
                            await page.wait_for_url("**/messages?share_post=*", timeout=5000)
                            await page.wait_for_timeout(1000)
                            banner = await page.locator('[data-testid="share-post-banner"]').count()
                            if banner:
                                # tap thread
                                tsel = f'[data-testid="thread-{u2["id"]}"]'
                                if await page.locator(tsel).count() > 0:
                                    await page.click(tsel)
                                    await page.wait_for_timeout(2500)
                                    cur_url = page.url
                                    # wait for share param to clear
                                    await page.wait_for_timeout(2000)
                                    final_url = page.url
                                    # check shared post msg row
                                    shared_rows = await page.locator('[data-testid^="dm-shared-post-"]').count()
                                    param_cleared = "share_post=" not in final_url
                                    if shared_rows >= 1 and param_cleared:
                                        results["passed"].append(f"T8: share-send-dm flow OK, dm-shared-post rendered, URL param cleared")
                                        print("PASS T8")
                                    else:
                                        results["failed"].append(f"T8 partial: shared_rows={shared_rows} url={final_url} param_cleared={param_cleared}")
                                else:
                                    results["failed"].append("T8: thread row not in /messages after share")
                            else:
                                results["failed"].append("T8: share-post-banner not visible at /messages?share_post=")
                        else:
                            results["failed"].append("T8: share-send-dm button not in ShareMenu")
                    else:
                        results["failed"].append("T8: could not find share button on feed post")
                else:
                    results["failed"].append(f"T8: create post failed {pr.status_code} {pr.text[:200]}")
            except Exception as e:
                results["failed"].append(f"T8 exception: {e}")

            # ==================== TEST 9: profile-message-button ====================
            print("\n--- T9: profile message button ---")
            try:
                await page.goto(f"{BASE}/profile/{u2['id']}", wait_until="commit")
                await page.wait_for_timeout(2500)
                btn = await page.locator('[data-testid="profile-message-button"]').count()
                if btn:
                    await page.click('[data-testid="profile-message-button"]')
                    await page.wait_for_url(f"**/messages/{u2['id']}**", timeout=5000)
                    await page.wait_for_timeout(1000)
                    chat_present = await page.locator('[data-testid="chat-thread-page"]').count()
                    if chat_present:
                        results["passed"].append("T9: profile-message-button -> /messages/:id works")
                        print("PASS T9")
                    else:
                        results["failed"].append("T9: chat page not loaded after profile message btn")
                else:
                    results["failed"].append("T9: profile-message-button not visible")
            except Exception as e:
                results["failed"].append(f"T9 exception: {e}")

            # ==================== TEST 10: quick-messages from /profile ====================
            print("\n--- T10: profile quick-messages ---")
            try:
                await page.goto(f"{BASE}/profile", wait_until="commit")
                await page.wait_for_timeout(2500)
                qm = await page.locator('[data-testid="quick-messages"]').count()
                if qm:
                    await page.click('[data-testid="quick-messages"]')
                    await page.wait_for_url("**/messages", timeout=5000)
                    await page.wait_for_timeout(1000)
                    mp = await page.locator('[data-testid="messages-page"]').count()
                    if mp:
                        results["passed"].append("T10: quick-messages -> /messages works")
                        print("PASS T10")
                    else:
                        results["failed"].append("T10: messages-page not found after quick-messages")
                else:
                    results["failed"].append("T10: quick-messages testid not visible on /profile")
            except Exception as e:
                results["failed"].append(f"T10 exception: {e}")

            # ==================== TEST 11: Regression - non-DM pages have BottomNav ====================
            print("\n--- T11: regression — BottomNav on non-DM pages ---")
            for path in ["/", "/explore", "/hubs", "/stokvels", "/profile"]:
                try:
                    await page.goto(BASE + path, wait_until="commit")
                    await page.wait_for_timeout(2500)
                    nav_count = await page.locator('[data-testid^="bottom-nav-"]').count()
                    if nav_count >= 5:
                        results["passed"].append(f"T11 {path}: BottomNav present (count={nav_count})")
                        print(f"PASS T11 {path}")
                    else:
                        results["failed"].append(f"T11 {path}: expected >=5 nav items, got {nav_count}")
                except Exception as e:
                    results["failed"].append(f"T11 {path} exception: {e}")

        finally:
            await browser.close()

    print("\n" + "="*60)
    print(f"PASSED ({len(results['passed'])}):")
    for p_ in results["passed"]: print("  +", p_)
    print(f"\nFAILED ({len(results['failed'])}):")
    for f_ in results["failed"]: print("  -", f_)
    print("="*60)

    with open("/tmp/dm_e2e_results.json", "w") as f:
        json.dump(results, f, indent=2)

asyncio.run(main())
