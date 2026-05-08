# Network Capital — PRD

## Original problem statement
Network Capital is a mobile-first **Community Resource Ecosystem** (formerly known as a reward-based Stokvel). Users build a Network Score representing their community engagement, participate in group savings circles, and access premium tiers. The app must use strict compliance phrasing (no "investing", "returns", or "profit"; instead "shared access", "collective participation"). It features an Instagram-vibe social feed (Stories, Explore, hashtags), Direct Messaging, multi-currency support, African Regional Hubs (Country to City selection), Activities (curated events), and a complex Network Score tracker capped at a lifetime 10,000 points.

## Compliance Rules (DO NOT BREAK)
- Never use: "investing", "returns", "profit"
- Use instead: "support", "backing", "contribution", "shared access", "collective participation"
- ZAR (Stripe $10 Premium) unlocks **features** (Wallet ops, multi-sig)
- Network Score (Merit) unlocks **reputation** (Hub leaderboard, verified badges)

## What's been implemented (cumulative)
- Stokvel groups with banking info collection (independent partner)
- DMs with post-sharing (text/image/voice up to 3MB)
- 13 African Regional Hubs (Country→Province→City picker)
- Activities discovery/creation
- Stripe Premium $10 (via emergentintegrations) + confetti success
- Instagram-vibe Feed/Stories/Explore
- Network Score: 10K lifetime cap, daily check-ins, soft caps, premium 2× multiplier
- Premium splash screen (sessionStorage gated)
- Brand palette (Deep Navy/Brand Gold) applied globally

## NEW in this iteration (Feb 2026)
1. **Logos**: Replaced navy-bg favicon variant in headers with the **transparent Logo Mark**. Browser favicon stays as the navy variant. New brand constants in `/app/frontend/src/constants/brand.js`.
2. **Score parity**: Score Tracker hero now displays `lifetime_score / 10,000` (matches `users.network_score` shown on Profile).
3. **Referral code parity**: Referral page hero shows the canonical `referral_code` (uppercase, same field shown on Profile). Profile page shows a copyable **Referral Code card** linking to the Share page.
4. **Tracker rename**: "Activity Tracker" → **"Score Tracker"**. Route `/activity` → 301 redirect → `/tracker`. Updated nav label, page title, and intro modal copy.
5. **Stokvel+ purpose expansion**: Added `purpose` field — `savings | holiday | event | gift | group_trip | wedding | funeral | other`. Selectable grid on Create page. Intro page rewritten to position Stokvel+ as group-money coordination for any shared goal.
6. **Product / Service**: New `type` toggle (product or service); `currency` auto-defaults to creator's country (ZAR/NGN/KES/GHS/USD); `availability` enum (`available_now | available_in_days | preorder | on_request`) with optional `availability_days` integer.
7. **Hub clarity + filter**: Connection chips now show full label (Social/Financial/Professional) instead of first letter; added a category filter chip-bar above the people list (`all/social/financial/professional`).
8. **Anti-abuse referrals**:
   - `POST /api/referrals/capture` records pending attribution (referrer_id, ref_used, joined, bm).
   - Reward (+200) fires only when invitee has BOTH `email_verified=true` AND `profile_completed=true`.
   - Idempotent via `score_events` lookup (one reward per unique invitee).
   - Self-referral blocked (400). Same-email collusion blocked (400). Unknown referrer 404.
   - Per-day cap on referrer reward count (default 10).
9. **Email OTP (MOCK)**:
   - `POST /api/auth/send-otp` (auth required) — generates 6-digit code, hashes it in `db.otps`, returns `_mock_code` in dev response, logs `[OTP-MOCK]` to backend logs. 30s resend cooldown (429).
   - `POST /api/auth/verify-otp` — 5 wrong attempts → 429, expired (10 min) → 400, success sets `email_verified=true`.
   - `POST /api/auth/complete-profile` returns 403 if `email_verified=false`.
   - **Production action item**: replace `_send_otp_email` with Resend / SendGrid / Gmail SMTP and remove `_mock_code` from response.
10. **Founding-member 2× multiplier**:
    - First **1,000 signups** become founders (`is_founder=true`, `founder_signup_rank=N`, `founder_multiplier_until=signup+30days`).
    - `award_points` applies 2× when premium OR founder window active (max 2×, no stacking).
    - `GET /api/founders/status` returns `{limit, claimed, available, active, multiplier, duration_days}` for landing-page counter.
    - Landing page shows live counter in hero (visible only while founder window has spots).

## Code architecture
```
/app/
├── backend/
│   ├── server.py (~4,800 lines monolith)
│   ├── tests/test_iter19_otp_founder_referral.py
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── constants/brand.js  ← LOGO_MARK transparent, FAVICON_URL navy
│   │   ├── components/
│   │   │   ├── FeatureIntroModal.js  ← 1-time per-feature modal
│   │   │   └── PremiumLoadingScreen.js
│   │   ├── pages/  (~25 pages)
│   │   └── App.js  (routes incl. /tracker, /join, JoinHandler)
└── memory/
    ├── PRD.md, test_credentials.md
```

## Key DB fields added this iteration
- `users`: `email_verified, email_verified_at, is_founder, founder_signup_rank, founder_multiplier_until, birth_month, referred_by, referral_attribution{}, referral_code (UPPERCASE)`
- `otps`: `{user_id, email, code_hash, attempts, verified, created_at, expires_at}`
- `stokvels`: `purpose`
- `products`: `type, currency, availability, availability_days`

## Known issue / next-action items (P-ordered)
- **P0 (production)** Replace mock email send with real provider before launching to non-test users. Remove `_mock_code` from `/auth/send-otp` response when keys arrive.
- **P1** Real Paystack integration (NGN/GHS/KES/ZAR) — pending user test keys.
- **P1** Carousel posts + Reels-style vertical video.
- **P2** Migrate base64 media to S3/R2 (16MB Mongo doc cap).
- **P2** Modularise `server.py` (>4,800 lines now) into routers.
- **P2** Live FX rates + creator-currency pricing.
- **P3** Capacitor wrap (iOS/Android), Driver Pool extension.
- **Hygiene** Add TTL index on `db.otps.expires_at`. Sweep older unverified records.
- **Code review note** Centralise / dict-passthrough `users.me` response so future fields don't get stripped by Pydantic.

## API endpoints (key)
- `POST /api/auth/progressive-signup` — creates user + founder block
- `POST /api/auth/send-otp` (auth) — mock email; returns `_mock_code` in dev
- `POST /api/auth/verify-otp` (auth) — sets `email_verified=true`
- `POST /api/auth/complete-profile` — 403 if not verified; consumes pending referral
- `POST /api/referrals/capture` (auth) — anti-abuse referral attribution
- `GET /api/founders/status` — public counter
- `GET /api/score/summary` — includes `founder_multiplier{...}`
- `POST /api/stokvels` — accepts `purpose`
- `POST /api/products/create` — accepts `type / currency / availability / availability_days`
- `PUT /api/users/me` — accepts `birth_month`
- `POST /api/score/daily-checkin` — idempotent
- `GET /api/score/tiers` — 5 tiers + lanes
- `POST /api/payments/checkout/session` — Stripe
- Admin: `POST /api/admin/products/{id}/moderate?action=approve` (X-Admin-Password header)

## Testing
- `iteration_19.json`: 27 PASS / 2 SKIPPED / 1 FAILED (now fixed — User model missing fields).
- All 10 corrections from this iteration verified end-to-end via pytest sweep.
