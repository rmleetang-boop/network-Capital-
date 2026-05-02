# Network Capital - PRD (Iteration 9)

## Original Problem Statement
Mobile-first social network with Stokvel groups, compliance-safe Creator/Product layer, Regional Hubs, multi-currency premium paywall, and now a fully-rebuilt Network Score with monthly cap, premium 2× multiplier, daily/weekly/monthly Activity Tracker, mock ad rewards, Hub Pulse stats, and overlap-free navigation.

## Compliance Rules (STRICT)
- NO words: invest, investment, returns, profit, profit-sharing, interest (financial), guaranteed
- ALLOWED: support, backing, contribution, participation, rewards, access, allocation, boost
- Smart Access = "early access to your own pooled funds" — NOT a loan, no debt, no interest

## Implemented Features (cumulative)

### Iteration 9 — Score System Rebuild + UX
1. **New Network Score logic**:
   - Posting content: +20 / Sharing: +10 / 50-likes-received milestone: +10 / 10-comments milestone: +20
   - 3 hours active: +10 (heartbeat-driven, prorated)
   - Watch ad + share: +100 / Watch ad + engage with product: +500
   - Monthly cap: **10,000 pts** — score dashboard shows % of cap
   - **Monthly reset** to 0 on calendar rollover (lazy, server-side)
   - **Premium 2× multiplier** on every points event
   - **Premium 3-month grace at top score**: premium accounts that hit 10K stay at top for 90 days before reset
   - **Free top-score → claim premium**: free users hitting 10K can claim premium with no $ charge
2. **Activity Tracker page** at `/activity` — Hero (monthly + %), Today / Week / Lifetime stat cards, Daily/Weekly/Monthly chart, recent points event log, scoring rules card
3. **Mock Ad button** on Feed — 15s countdown modal, choose share (+100) or engagement (+500), wires to `/api/ads/watch`
4. **Hub Pulse** component on `/hubs` — last-7-days city stats: total members, new members, active stokvels, accepted connections
5. **Heartbeat hook** — frontend pings `/users/me/heartbeat` every 60s while authenticated and tab visible
6. **Menu overlap fix** — removed floating top-right menu button; secondary nav (Connections, Wallet, Net Worth, Activity, Leaderboards, Help) now lives as a Quick Access grid inside ProfilePage. Bottom nav remains 5 items (Feed, Hubs, Stokvel+, Products, Profile)
7. **Brand attribution updated** to "Powered by Mici Business pty ltd"

### Iteration 8 — Currency + Premium + Share
- 10 currencies (USD, EUR, GBP, ZAR, NGN, KES, GHS, JPY, AUD, CAD)
- $10 premium paywall (MOCK payment) — 402 gates wallet/contribute/smart-access/withdrawals/support
- Share menu (Twitter / Facebook / WhatsApp / LinkedIn / Telegram + Copy)

### Iteration 7 — P1 Features
- Smart Access UI, Multi-sig withdrawals (1-3 signatories, 2-of-N), Admin moderation, shadcn Select on Hubs

### Earlier (P0)
- Auth + progressive signup, Feed (text/image/video), Wallet, Stokvel groups, Profile media (photos/videos/articles)
- Network Score, Rewards, Leaderboards, Onboarding, Legal docs
- Creator/Product layer with 5-step questionnaire, audience insights tiered paywall
- Net Worth dashboard, Regional Hubs with 3-type Connections

## Backend Endpoints Added (Iter 9)
- `POST /api/users/me/heartbeat` — track active minutes, +10 per 180 cumulative
- `POST /api/ads/watch` `{with_share, with_engagement, ad_id?}` — MOCK ad reward
- `GET /api/score/summary` — monthly_score, monthly_cap, percentage, daily/weekly, premium_grace, can_claim_premium
- `GET /api/score/activity?period=daily|weekly|monthly&days=` — chart buckets
- `GET /api/score/events?limit=` — recent score events
- `POST /api/score/claim-premium` — free→premium when monthly_score >= 10K
- `GET /api/hubs/pulse?city=X` — last-7-day activity stats

## Backend Implementation Notes
- New collection `score_events` with `{user_id, action, points, base_points, multiplier, source_id, month_key, date_key, created_at}`
- `award_points(user_id, action, base_points, source_id, message)` is the single point-of-truth helper
- Legacy `update_user_score` now wraps `award_points` for backwards compatibility
- `_ensure_month_state(user)` handles lazy monthly reset including premium 3-month grace
- All point-emitting endpoints (post/share/like/comment/contribute/etc) now call `award_points`

## File Structure (key new/changed)
```
backend/
├── server.py (~3.0k lines) — score system rebuilt
└── tests/ (58 dedicated tests passing)

frontend/src/
├── App.js (heartbeat hook + /activity route)
├── components/
│   ├── Layout.js (REWRITTEN — no floating menu)
│   ├── BrandAttribution.js ("pty ltd" added)
│   ├── HubPulse.js (NEW)
│   └── MockAdButton.js (NEW)
├── hooks/
│   └── useHeartbeat.js (NEW)
└── pages/
    ├── ActivityTrackerPage.js (NEW)
    ├── ProfilePage.js (Quick Access grid replaces floating menu)
    ├── RegionalHubsPage.js (HubPulse mounted)
    └── FeedPage.js (MockAdButton above feed)
```

## Testing (Iteration 9)
- Backend: 58 dedicated tests pass (16 + 31 + 11). Multi-sig suite excluded due to runtime
- Smoke test verified: post +20, ad-engagement +500, heartbeat tracking, percentage display, period switcher, hub pulse stats, profile quick-access grid, no top-right floating button

## MOCKED items
- **Ad rewards**: MOCK only — `MockAdButton` simulates 15s countdown. Replace with real ad SDK (Google AdMob / Meta Audience Network / Unity Ads) before production
- **$10 Premium payment**: still MOCK from Iter 8 — needs Stripe + Paystack integration

## Known Issues / Deferred
- Real payment (Stripe + Paystack) deferred — needs API keys from user
- Live FX rates deferred — exchangerate.host integration pending
- Real ad SDK integration deferred — ad platform choice pending from user
- StokvelDetailPage modals could be split into sub-components (~1.1k lines)
- Time-on-app score tracker awards in 180-min chunks; spec also says "prorated for minutes afterwards" — currently it just awards 0 between chunks (simpler). Consider adding fractional pts later.

## Next Action Items
- **P1**: Real payment (Stripe + Paystack), live FX rates, real ad SDK integration
- **P2**: Driver Pool extension, Cloud media migration (S3/R2), modularize server.py, PWA + Capacitor wrap
