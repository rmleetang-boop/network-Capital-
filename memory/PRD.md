# Network Capital — PRD

## Original problem statement
Network Capital is a mobile-first **Community Resource Ecosystem** (formerly known as a reward-based Stokvel). Users build a Network Score representing their community engagement, participate in group savings circles, and access premium tiers. Compliance phrasing: never "investing", "returns", or "profit"; instead "shared access", "collective participation".

## Compliance Rules (DO NOT BREAK)
- Never use: "investing", "returns", "profit"
- Use instead: "support", "backing", "contribution", "shared access", "collective participation"
- ZAR (Stripe $10 Premium) unlocks **features** (Wallet ops, multi-sig)
- Network Score (Merit) unlocks **reputation** (Hub leaderboard, verified badges)

## Score architecture
- **Monthly cap = 10,000** points. Resets at the start of every calendar month.
- `monthly_score` and `network_score` mirrored.
- Premium / Founder window = 2× multiplier (max 2×).
- Three-tier engine: T1 Ads (`ad_watch_engage` 500/day cap 5; `ad_watch_share` diminishing 300→50), T2 Referrals (`referral_qualified` 400 once at 1k score), T3 Standard (`post_create` 50, `comment_quality` 30 ≥0.6 AI, `post_like` 5, `post_share` 20, `video_watched` 10).
- Founders: first 1,000 signups, 30 days, 2×.

## Cumulative implementation
- Stokvel groups + banking (independent partner)
- DMs, stories, explore, hashtags, mentions
- 13 African Regional Hubs (Country→Province→City)
- Activities discovery/creation
- Stripe Premium $10 + confetti, premium splash
- Brand palette + transparent Logo Mark (navy favicon)
- Stokvel+ purpose grid, Product/Service toggle, currency auto-default, availability enum
- Hub clarity + category filter chip-bar
- Anti-abuse referrals (verified email + completed profile required, idempotent, day-cap 10)
- Friendly share code: `networkcapitalapp.<username>.<MM>.<##>` + `/join/:slug` route
- Stokvel invite by username/share_code
- Account deactivate (reversible) / delete (30-day grace, auto-cancels Stripe sub)
- Feed post edit/delete with score revocation cascades; un-like also revokes points
- Comment delete (author or post-owner) revokes commenter's points
- Score events: 24h same-source cooldown, daily soft-cap 60, monthly cap 10,000, auto-flag if >80% from one action

## NEW iter 24 (Feb 10, 2026) — Jobs feature + Resend email + Careers footer
### Jobs feature
- New `user_kind` ('social' | 'professional') + `job_post_unlocked` boolean fields on user.
- `GET /api/jobs` (list), `POST /api/jobs` (gated by job_post_unlocked), `GET /api/jobs/{id}`, `POST /api/jobs/{id}/apply` (409 on duplicate), `GET /api/jobs/{id}/applications` (employer only).
- `POST /api/jobs/checkout` — Stripe $50 once-off unlock for posting jobs.
- `PUT /api/users/me` accepts `user_kind` switch (Social ↔ Professional).
- Seeded "Business Developer Agent" job at Network Capital (R8,500 CTC + commission, min_network_score 2000).
- Frontend: `/jobs` list (mine, applications, all), `/jobs/:id` detail with apply, `/jobs/new` create form gated by inline Stripe $50 unlock CTA.
- ProfilePage: always-visible user_kind pill toggle (`data-testid='user-kind-toggle'`).
- AuthPage: Social / Professional choice during signup.
- LandingPage Footer: Careers link → opens sign-in-required modal for guests, routes to `/jobs` for authenticated users.

### Real email integration (Resend)
- Replaced mock OTP with Resend SDK (`resend>=2.0.0`).
- `POST /api/auth/send-otp` returns `{delivered: bool, ttl_minutes, message, _mock_code?}`.
  - `delivered=true` (Resend success) — code never exposed.
  - `delivered=false` (test-mode rejection / SDK error) — graceful fallback exposes `_mock_code` so QA & non-verified domains keep flowing.
- HTML email template (table-based, inline-styled, brand colours).
- Async non-blocking via `asyncio.to_thread(resend.Emails.send, params)`.
- Env: `RESEND_API_KEY`, `SENDER_EMAIL=onboarding@resend.dev` (Resend test mode — only account owner can receive; use a verified domain in production).

## Code architecture
```
/app/
├── backend/
│   ├── server.py (~5,930 lines — splitting overdue)
│   │   ├── EMAIL OTP via Resend (line ~4803): _send_otp_email + _otp_email_html
│   │   ├── Jobs routes & seed (~last 200 lines)
│   │   └── Three @app.on_event('startup') handlers (purge / share-codes / seed-job)
│   └── tests/ (test_iter20…test_iter24_retest.py)
├── frontend/src/
│   ├── pages/ (JobsPage, JobDetailPage, CreateJobPage, AuthPage, ProfilePage, …)
│   ├── components/Footer.js (Careers modal)
│   ├── constants/share.js
│   └── components/FeatureIntroModal.js
└── memory/PRD.md, test_credentials.md
```

## Backlog (priority-ordered)
- **P1** Real Paystack integration (NGN/GHS/KES/ZAR) — pending user test keys.
- **P1** Verify a real domain on Resend (e.g., `mail.networkcapitalapp.co.za`) so production OTP emails reach all users (current `onboarding@resend.dev` is test-only).
- **P1** Carousel posts + Reels-style vertical video feed.
- **P2** Modularise `server.py` into routers (`/app/backend/routes/`) — every iter adds ~600 lines.
- **P2** Migrate base64 media → S3/R2 (16MB Mongo doc cap).
- **P2** Live FX rates + creator-currency pricing.
- **P2** Consolidate `@app.on_event('startup')` into FastAPI lifespan handler (deprecation).
- **P2** TTL index on `db.otps.expires_at`.
- **P2** Add a UX-friendly auto-dismiss / click-outside on `FeatureIntroModal` (currently blocks underlying clicks until "Got it").
- **P3** Capacitor wrap (iOS/Android).
- **P3** Driver Pool extension.

## Testing
- iter_22.json: 38/40 cumulative regressions PASS.
- iter_23.json: 18/18 backend (Jobs + Resend OTP fallback + user_kind PUT) PASS; 5/8 frontend at first sweep.
- iter_24.json: ALL 4 frontend & backend fixes verified — 100% on both.
