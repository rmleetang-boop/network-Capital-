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

## NEW in iter 23 (Feb 2026) — Post & comment delete/edit
- **Edit post**: `PATCH /api/posts/{id}` (author only). Re-extracts hashtags. Sets `edited_at`. Score is NOT changed on edit (zero cost to fix typos).
- **Delete post**: `DELETE /api/posts/{id}` (author only). Cascades:
  - Revokes the author's `post_create` points.
  - Revokes every commenter's `comment_quality` points.
  - Revokes every liker's `post_like` points.
- **Delete comment**: `DELETE /api/posts/{id}/comments/{cid}`. Allowed by comment author OR post owner. Revokes the commenter's `comment_quality` points.
- **Un-like**: now revokes the liker's `post_like` points (was a known abuse path: like → unlike → relike to game points).
- **`revoke_score_event(user_id, action, source_id)`** helper — clamped at 0, removes score_event row so daily-cap counts re-open.
- **Frontend**: "..." menu on each post card (owner only) → Edit (inline) / Delete (with confirmation explaining points reversal). Hover Trash icon next to each comment for owner / post-author moderators.

## NEW in iter 22 (Feb 2026) — major refactor

### Three-tier score engine
- **T1 Ads** — `ad_watch_engage` 500 (cap 5/day, 24h cooldown same ad) · `ad_watch_share` diminishing 300/150/50/50/50 per unique ad (max 5 shares).
- **T2 Referrals** — `referral_qualified` 400 (fires once when invitee crosses monthly_score 1,000) · `referral_feature_unlock` 200/feature/friend · `referral_first_post` 150 (referee posts within first 7 days).
- **T3 Standard** — `post_create` 50 (cap 5/d) · `post_share` 20 (cap 10/d) · `comment_quality` 30 (cap 10/d, AI ≥0.6) · `post_like` 5 (cap 20/d) · `video_watched` 10 (cap 10/d).
- Global: monthly cap 10,000 (resets every calendar month) · 24h cooldown on same source_id (except ad_watch_share, ladder is its own anti-abuse) · Premium/Founder 2× multiplier (max 2×) · auto review-flag if >80% of monthly score from one action type.

### Badge engine
At month rollover, the highest badge earned is saved into `user.badge_history`:
- 1,000–2,999 → Bronze Networker
- 3,000–5,999 → Silver Connector
- 6,000–8,999 → Gold Influencer
- 9,000–9,999 → Diamond Achiever
- 10,000 → Network Legend

### AI comment relevance
- Heuristic-first (gates: empty / gibberish / <5 words / duplicate)
- LLM (claude-haiku-4-5) via Emergent LLM key
- ≥0.6 → quality comment earns 30 pts; <0.6 earns 0

### Account management
- `POST /api/account/deactivate` (reversible — login auto-reactivates)
- `POST /api/account/delete` — 30-day grace, requires username confirm; auto-cancels Stripe sub
- `POST /api/account/cancel-deletion` (or just login during grace)
- Hard-delete on startup for docs whose `deletion_purge_at` has elapsed

### New endpoints
- `POST /api/score/ad-event {ad_id, action: 'engage'|'share'}`
- `POST /api/score/video-watched {video_id}`
- `POST /api/account/{deactivate,reactivate,delete,cancel-deletion}`

## NEW in iter 21 (Feb 2026)
1. **Friendly share code**: new `share_code` field on user, format `networkcapitalapp.<username>.<MM>.<##>` (e.g., `networkcapitalapp.maria.06.42`). MM is birth month (`00` if unset), `##` is a stable 2-digit checksum derived from user.id. Auto-regenerated when username/birth_month changes (`_refresh_share_code`). Backfilled at startup.
2. **Production domain in share URLs**: link is `https://networkcapitalapp.co.za/join/<share_code>` — no preview/emergent host in any user-facing share content. New `/app/frontend/src/constants/share.js`.
3. **Stokvel invite by username/share_code**: `POST /api/stokvels/{id}/invite` now resolves `user_id` field as UUID OR username OR share_code. Profile no longer shows raw UUID — single "Your code" card serves both referrals AND Stokvel invites.
4. **`/join/:slug` route** added (path-style invite links). Legacy `/join?ref=…` remains supported.

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
