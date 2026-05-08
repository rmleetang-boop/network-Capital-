# Network Capital — PRD

## Original problem statement
Network Capital is a mobile-first **Community Resource Ecosystem** (formerly known as a reward-based Stokvel). Users build a Network Score representing their community engagement, participate in group savings circles, and access premium tiers. Compliance phrasing: never "investing", "returns", or "profit"; instead "shared access", "collective participation".

## Compliance Rules (DO NOT BREAK)
- Never use: "investing", "returns", "profit"
- Use instead: "support", "backing", "contribution", "shared access", "collective participation"
- ZAR (Stripe $10 Premium) unlocks **features** (Wallet ops, multi-sig)
- Network Score (Merit) unlocks **reputation** (Hub leaderboard, verified badges)

## Score architecture (CURRENT — iteration 20)
- **Monthly cap = 10,000** points. Resets at the start of every calendar month.
- `monthly_score` and `network_score` are **mirrored** (same value). Profile and Score Tracker display this same field.
- Premium OR Founder window = 2× multiplier (max 2×, no stacking).
- Daily soft-cap (60) on engagement actions; weekly_resource_drop = 1/week; daily_checkin = 1/day.
- Founders: first 1,000 signups, 30 days, 2× multiplier.

## What's implemented (cumulative)
- Stokvel groups + banking (independent partner)
- DMs with post-share, stories, explore, hashtags, mentions
- 13 African Regional Hubs with Country→Province→City
- Activities discovery/creation
- Stripe Premium $10 + confetti
- Premium splash (sessionStorage)
- Brand palette + transparent Logo Mark in headers (navy favicon for browser only)
- 5 Network Score tiers + lanes
- Score parity (Profile ↔ Score Tracker)
- Stokvel+ purpose grid (savings/holiday/event/gift/group_trip/wedding/funeral/other)
- Product / Service toggle, currency auto-default per country, availability enum
- Hub clarity + category filter chip-bar
- Anti-abuse referrals (verified email + completed profile required for reward; idempotent; self-referral & same-email blocked; per-day cap 10)
- Email OTP signup (MOCK)
- Founder counter on landing page

## NEW in iter 20 (Feb 2026)
1. Stokvel create page — removed $10 activation fee + $2 membership fee mentions (kept all other pricing including intro page $20/$5/R1M).
2. Referrals page stripped — auto-generated code, no explainer/chips/nudge. Just hero + link + 4 share buttons.
3. **Score logic reverted to MONTHLY 10,000 cap** with monthly reset (was lifetime). `award_points` clamps on monthly cap; `_ensure_month_state` resets BOTH monthly_score AND network_score at month rollover.
4. Help Center FAQ updated to reflect monthly cap.
5. Bug fix (caught by testing agent): leftover `lifetime` / `new_lifetime` variable references in `award_points` causing NameError → 500 on every score-awarding call. Fixed.

## Code architecture
```
/app/
├── backend/server.py (~4,830 lines)
│   ├── MONTHLY_SCORE_CAP = 10000
│   ├── award_points clamps monthly, mirrors network_score = monthly_score
│   ├── _ensure_month_state resets both at month rollover
│   └── /api/score/summary returns monthly_score + monthly_cap (=10000)
├── backend/tests/test_iter20_monthly_cap.py
├── frontend/src/
│   ├── constants/brand.js (LOGO_MARK transparent + FAVICON navy)
│   ├── components/FeatureIntroModal.js
│   └── pages/ (~25 pages, all key flows)
└── memory/PRD.md, test_credentials.md
```

## Backlog (priority-ordered)
- **P0 (production)** Wire real email provider (Resend / SendGrid / Gmail SMTP) and remove `_mock_code` from `/auth/send-otp`.
- **P1** Real Paystack integration (NGN/GHS/KES/ZAR) — pending user test keys.
- **P1** Carousel posts + Reels-style vertical video.
- **P2** Modularise `server.py` into routers.
- **P2** Migrate base64 media to S3/R2 (16MB Mongo cap).
- **P2** Live FX rates + creator-currency pricing.
- **P3** Capacitor wrap (iOS/Android), Driver Pool extension.
- **Hygiene** TTL index on `db.otps.expires_at`. Centralise users.me response so Pydantic doesn't strip new fields.

## Testing
- `iter_20.json`: 10/10 new tests PASS + 28/30 iter_19 regressions hold.
- Critical NameError bug fixed inside this iteration.
