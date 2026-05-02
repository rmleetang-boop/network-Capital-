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

### Iteration 10 — Instagram-Vibe Pivot (this session)
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

## Testing (Iteration 10)
- `iteration_9.json`: 100% (11/11 frontend flows + 5/5 backend sanity endpoints). Zero critical/minor bugs. No retest needed.
- Known code-review nits (not blockers): FeedPage is ~485 lines — consider splitting PostCard; ExplorePage/HashtagPage lack loading skeletons.

## MOCKED items
- **$10 Premium payment**: MOCK — needs Stripe + Paystack integration
- **Ad rewards**: MOCK — needs real ad SDK (AdMob / Meta / Unity)

## Next Action Items
- **P1 — Real payments** (Stripe + Paystack) replacing the MOCK $10 premium
- **P1 — Direct Messaging** between connections
- **P1 — Reels-style vertical video feed** + carousel posts
- **P1 — Real ad SDK integration** (AdMob/Meta Audience Network)
- **P2 — Cloud media storage** (S3/R2) — base64 in Mongo will hit 16MB doc cap
- **P2 — Live FX rates** via exchangerate.host; creator-currency pricing
- **P2 — Modularize server.py** (3,300+ lines) into `/app/backend/routes/`
- **P3 — Driver Pool extension**, PWA + Capacitor wrap
- Cleanup: split PostCard out of FeedPage.js; fix `isOwnProfile` useEffect dep warning in ProfilePage.js

## Project Health
- Backend: auto-narration live; `posts` stores hashtags/mentions/is_auto_narrated.
- Frontend: Instagram-vibe pivot complete and wired end-to-end.
- Testing agent (iter 9): PASSED.
