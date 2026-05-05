# Network Capital - PRD (Iteration 10)

## Original Problem Statement
Mobile-first social network ("Network Capital") with:
- Reward-Based Stokvel Engine (community savings groups, compliance-safe)
- Network Score for contribution/influence (10k monthly cap, premium 2× multiplier)
- Business/Creator product layer, Regional Hubs with 3-type connections
- Multi-currency UI, $10 MOCK premium paywall, activity tracker
- **Instagram-vibe social UX**: Stories, Explore page, clickable #hashtags, full-bleed post media, double-tap-to-like, financial event auto-narration into the feed

## Compliance Rules (STRICT)
- BLOCKED: invest, investment, returns, profit, profit-sharing, interest (financial), guaranteed
- ALLOWED: support, backing, contribution, participation, rewards, access, allocation, boost
- Smart Access = "early access to your own pooled funds" — not a loan, no debt, no interest

## Implemented Features (cumulative)

### Iteration 16 — Banking on Stokvel only · Hub Country→City · Solid Dropdown · Photo Propagation

1. **Banking moved to Stokvel feature only** — banking fields removed from AuthPage signup. New `StokvelBankingPrompt` component renders as a banner at the top of `/stokvels` (`StokvelBankingBanner`) when `on_file=false`. Disclosure copy: "Used **only for distribution of pool money** from your group." Stokvel intro section 6 reworded accordingly.
2. **Hub Country→City** — `RegionalHubsPage` now has `country-selector` BEFORE `city-selector`; cities filtered to selected country only; city select disabled until country chosen. `country` derived from `/api/hubs/cities` response.
3. **Solid login dropdown** — `LocationPicker` SelectContent now uses `bg-[#0a1628]` with `border-white/15` on dark theme. Country list (13 African countries + Other) fully readable on the AuthPage.
4. **Profile photo propagation** — `PUT /api/users/me` now `update_many`'s `posts.user_photo`, `stories[*].user_photo`, embedded `comments[*].user_photo`, and `dm_messages.sender_photo` whenever a user changes their profile picture or username. Old content reflects the latest avatar.

### Iteration 15 — Simplified Landing + Stokvel Intro + Africa-wide Hubs + Banking on Signup

**Simplified Landing** (`LandingPage.js` ~95 lines): single hero (headline + subheading + clarity statement + single CTA), 3 short benefit cards, footer. Removed Member Journey, Network Score explainer, Leaderboard, Live Activity Feed, full Transparency section from the public layer (still available for authed users on /dashboard and /activity).

**Stokvel intro** (`StokvelIntroPage.js`):
- Shown the first time a user opens `/stokvels` (gated by `localStorage.nc_stokvel_intro_seen`).
- 7 numbered sections: (1) Fee Structure $20 once + $5 per member, (2) Quarterly Prize Pool, (3) R1M Extra Capital from Network Capital, (4) Control of Funds — held by independent partner, group keeps full control, (5) Group Autonomy — each group writes its own constitution, (6) Banking Details collected on registration, (7) Compliance disclaimer.
- Support emails: support@networkcapitalapp.co.za, info@networkcapitalapp.co.za.
- "How it works" link from `/stokvels` header → `/stokvels/intro` (always reachable).

**Africa-wide regions** (`/api/hubs/regions`): 12 African countries + "Other": South Africa, Nigeria, Kenya, Ghana, Zimbabwe, Tanzania, Uganda, Senegal, Egypt, Morocco, Ethiopia, Rwanda. Each has provinces with curated cities (118 total). Cascading `LocationPicker` (Country → Province → City) reused on signup.

**Banking on signup**:
- Required at the UI layer; optional server-side (so existing users aren't broken).
- Fields: bank_name, account_number, swift_code (auto-uppercased), branch_number.
- `POST /api/users/me/banking` to save/update; `GET /api/users/me/banking` returns masked summary only (never full account_number).
- POPIA + Encrypted nudge directly above the fields.

### Iteration 14 — Community Resource Ecosystem Refactor

**New Public Layer (LandingPage)** at `/` for un-authenticated visitors:
- Hero: "Build Value Through Community Participation" + clarity statement (no financial services / no promised returns) + POPIA/Transparent/Community-first trust pill + 3 trust badges (POPIA Aligned, Open by Design, Your Data Yours)
- "What You Get" section (3 cards tagged "Collective Participation", "Shared Value", "Product Access")
- 3-step Member Journey (Join the Circle → Build Your Network Score → Unlock Group Benefits)
- Network Score explainer (10,000 cap, "what earns" + "what unlocks")
- Community Leaderboard (top 10) + Live Activity Feed (10s polling)
- Transparency Section (NOT a financial product / NO promised returns / a coordination layer)
- Footer with POPIA & Data Protection commitment

**New public backend endpoints (no auth)**:
- `GET /api/activity/live?limit=N` — recent score events + new members + premium unlocks; seeded fallback so the feed never reads empty
- `GET /api/leaderboard/public?limit=N` — top members; pads with seeded leaders (≤5) so the board feels populated; respects `limit` strictly

**Dashboard refactor** — Daily Activity Tracker is the focal hero:
- Big monthly Network Score card (pts / 10,000), today/7-day/streak chips, gradient progress bar
- Quick action grid (post / share / refer / watch & engage / message / like-comment)
- Right-rail: LiveActivityFeed + mini leaderboard (`leader-<rank>` rows) + POPIA/transparency trust nudge

**AuthPage**: added `auth-popia-nudge` POPIA + data-protection trust pill on the signup tab.

**OnboardingPage**: still reachable at `/onboarding` but no longer the default for first-time visitors.

### Iteration 13 — DM Composer Final Fixes
### Iteration 11 — Direct Messaging (DMs) v1

- **Endpoints**: `POST /api/dm/compliance-check`, `POST /api/dm/send`, `GET /api/dm/threads`, `GET /api/dm/threads/:other_user_id`. Collections: `dm_messages`, `dm_threads`.
- **Open DM model** — any user can DM any other user (no connection gating, per user choice).
- **Multimedia**: text + base64 image (3MB) + voice notes via MediaRecorder (3MB) + share-a-post with denormalized snapshot (`username`, `content`, `image`, `is_auto_narrated`).
- **Compliance**: word-boundary regex over `BLOCKED_COMPLIANCE_WORDS` (invest/profit/returns/guaranteed/interest…). Both `/dm/compliance-check` (live debounced sender preview) and `/dm/send` (server hard-check) return per-message `compliance_warnings`. Composer requires **two-tap send** for flagged text — first tap arms the warning, second tap actually sends.
- **Polling**: 5s interval on `/messages` and `/messages/:id`.
- **Entry points**: Profile → Quick Access "Messages" item, "Message" button on other users' profile headers, "Send in a DM" inside ShareMenu (auto-sends the shared post on thread tap).
- **Layout fixes**:
  - `Layout.js` hides BottomNav on `/messages*` (Instagram-style full-screen chat).
  - `ChatThreadPage` composer at `fixed bottom-16` so it sits above the 40px Emergent platform badge.
  - Scroll container `pb-44` so the latest message is never obscured.
- **Idempotency**: `useRef` sentinel keyed `${userId}:${sharePostId}` prevents StrictMode double-fire on share-post auto-send.

### Iteration 10 — Stripe Real Payments + Instagram-Vibe Pivot

**Stripe (real test checkout) for USD/EUR/GBP/CAD/AUD/JPY:**
- `POST /api/payments/checkout/session` — server-fixed $10, creates Stripe Checkout session, writes pending row to `payment_transactions`
- `GET  /api/payments/checkout/status/:sid` — polled by frontend, idempotent unlock on `payment_status='paid'`
- `POST /api/webhook/stripe` — second idempotent unlock path via Stripe webhook
- `_unlock_premium_for_user(user_id, currency, amount, session_id, provider)` — single idempotent helper: flips `premium_unlocked`, awards **one-time +500 welcome bonus**, records transaction, auto-narrates to feed
- `/premium/success?session_id=...` page — polls status, fires `canvas-confetti` on paid, shows +500 bonus + perk list + "Explore Premium" CTA

**Paystack (MOCK until keys added) for NGN/GHS/KES/ZAR:**
- Legacy `/api/users/me/premium` now rejects Stripe currencies with 400 and pushes users to Stripe checkout
- NGN/GHS/KES/ZAR continue using the legacy endpoint (now reuses `_unlock_premium_for_user` so idempotent + welcome bonus applies equally)

**Instagram-vibe pivot (this session earlier):**
(unchanged — Stories at top, Explore page, /hashtag/:tag, HashtagText clickable inline tags, double-tap-to-like, full-bleed media, gold Auto badge on `is_auto_narrated` posts)

## Iteration 10 — Instagram-Vibe Details (reference)
1. **Stories at top of Feed** — 24h ephemeral media, tap to view with progress bars, double-tap zones, auto-advance. Data-testid coverage for `stories-ribbon`, `create-story-button`, `create-story-modal`, `story-viewer`, `story-<user_id>`, `story-close`.
2. **Explore page** at `/explore` — trending hashtag chips (last 7 days) + 3-column full-bleed media grid. Testids: `explore-page`, `explore-grid`, `explore-post-*`, `trending-*`.
3. **Hashtag page** at `/hashtag/:tag` — grid of posts for a tag. Testid: `hashtag-page`, `hashtag-grid`, `hashtag-post-*`.
4. **Bottom nav swap** — Products replaced by Explore. Products moved to Profile Quick Access (along with a new Notifications shortcut).
5. **FeedPage rewrite** — dark-gradient sticky header with score + Explore shortcut (`feed-explore-shortcut`), Stories ribbon mounted inside it, full-bleed media, `HashtagText` component for inline clickable `#tags` + `@mentions`, double-tap-to-like with big heart animation, gold-gradient "Auto" badge (`auto-badge-*`) on auto-narrated financial posts.
6. **Backend auto-narration** — financial events (Stokvel goals, premium upgrades) auto-post to the feed with `is_auto_narrated=true`, hashtags auto-extracted.

### Iteration 9 — Score System Rebuild + UX
- New Network Score logic: post +20, share +10, 50-likes milestone +10, 10-comments +20, 3h active +10, ad+share +100, ad+engage +500; 10,000 pts monthly cap; monthly reset; premium 2× multiplier; premium 3-month grace; free top-score → claim premium.
- Activity Tracker page at `/activity` — hero + stat cards + daily/weekly/monthly chart + events log.
- Mock Ad button, Hub Pulse, Heartbeat hook (60s), menu overlap fix, brand attribution "Powered by Mici Business pty ltd".

### Iteration 8 — Currency + Premium + Share
- 10 currencies, $10 MOCK premium paywall, social share menu.

### Iteration 7 — P1 Features
- Smart Access UI, multi-sig withdrawals, admin moderation, shadcn Select on Hubs.

### Earlier (P0)
- Auth + progressive signup, Feed, Wallet, Stokvel groups, Profile media, Rewards, Leaderboards, Onboarding, Legal docs, Creator/Product layer + audience insights, Net Worth dashboard, Regional Hubs with 3-type connections.

## Backend Endpoints (key Instagram-vibe)
- `POST /api/stories` — create story (image|video, 3MB cap, 24h TTL)
- `GET  /api/stories/feed` — non-expired stories grouped by user with `all_viewed` flag
- `POST /api/stories/:id/view` — mark viewed
- `DELETE /api/stories/:id` — own story
- `GET  /api/explore` — ranked posts (last 7d) by engagement
- `GET  /api/hashtags/trending` — top tags last 7d
- `GET  /api/hashtags/:tag/posts` — posts for a tag
- `posts` now stores `hashtags[]`, `mentions[]`, `is_auto_narrated`

## File Structure (new/changed this iter)
```
frontend/src/
├── App.js                         (+ /explore, /hashtag/:tag routes)
├── components/
│   ├── Layout.js                  (Explore replaces Products in bottom nav)
│   ├── StoriesRibbon.js           (ribbon + create modal)
│   ├── StoryViewer.js             (full-screen viewer)
│   └── HashtagText.js             (clickable #tag / @mention parser)
└── pages/
    ├── FeedPage.js                (REWRITTEN: stories + full-bleed + dbl-tap + auto badge)
    ├── ExplorePage.js             (trending + 3-col grid)
    ├── HashtagPage.js             (3-col grid for a tag)
    └── ProfilePage.js             (Products + Notifications added to Quick Access)
```

## Testing (Iteration 11 — DMs)
- `iteration_11.json`: 19/19 backend pytest (compliance-check, send happy/edge, threads, both-participants, auth-gating).
- `iteration_12.json`: BottomNav fix verified; surfaced Emergent-badge overlap on composer.
- `iteration_13.json`: 8/8 TAP flows green after composer bumped to `bottom-16` + `pb-44`. One minor StrictMode double-fire on share-post auto-send → fixed in this commit with `useRef` sentinel.

## Testing (Iteration 10)
- `iteration_10.json`: **100% (14/14 backend pytest + 5/5 frontend Playwright)** — Stripe end-to-end (session creation, status polling, redirect verification), price-tampering rejected, idempotent unlock, cross-user 403, webhook doesn't 500.
- `iteration_9.json`: 100% (11/11 frontend flows + 5/5 backend sanity endpoints) — Instagram-vibe pivot green.
- Regression suite: `/app/backend/tests/test_stripe_premium.py` (14 tests, ~19s).

## MOCKED items
- **$10 Premium via Paystack** (NGN/GHS/KES/ZAR): still MOCK — waiting on user's Paystack test keys.
- **Ad rewards**: MOCK — needs real ad SDK (AdMob / Meta / Unity).

## Next Action Items
- **P1 — Paystack integration** (waiting on user's test keys → flips NGN/GHS/KES/ZAR from MOCK to real)
- **P1 — Reels-style vertical video feed** + carousel posts
- **P1 — Real ad SDK integration** (AdMob / Meta Audience Network)
- **P2 — Cloud media storage** (S3/R2) — base64 in Mongo will hit 16MB doc cap (now also stores audio+images in DMs)
- **P2 — Live FX rates** via exchangerate.host; creator-currency pricing
- **P2 — Modularize server.py** (~3,800 lines now) — split `/app/backend/routers/payments.py`, `/app/backend/routers/dm.py`
- **P3 — Driver Pool extension**, PWA + Capacitor wrap
- **DM v2 candidates**: WebSockets (replace 5s polling), unread badges, group/Stokvel chats, message reactions, typing indicators
- Cleanup: split PostCard out of FeedPage.js; visibility-aware DM polling pause; move compliance word list to DB config

## Project Health
- Backend: Stripe real-payment live; Paystack fallback on legacy path; auto-narration + welcome bonus idempotent.
- Frontend: Instagram-vibe pivot + Stripe checkout redirect + `/premium/success` confetti page, all wired.
- Testing agent (iter 10): **19/19 PASSED**.
