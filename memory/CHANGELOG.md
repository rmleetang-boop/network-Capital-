# Network Capital — CHANGELOG
## iter 29 (Feb 20, 2026) — Promotions feature complete + Resend DNS still pending
### Backend (`/app/backend/server.py` L7773-8265)
- **Promotions module** (SAST timezone, M/W/F 08-12 seed promo auto-created).
- **Admin CRUD**: `POST/GET/PATCH/DELETE /api/admin/promotions[/{id}]`.
- **Analytics**: `/summary`, `/leaderboard`, `/feed`, `/participants` per promotion + roll-up at `/api/admin/promotions-summary`.
- **Public**: `GET /api/promotions/active` returns active promos with `is_window_active` + `minutes_until_window`.
- **Score-event hook** at `award_points()` (line 908) writes to `promotion_events` when user's action falls inside an active window and matches `eligible_actions` + `min_network_score`.
- **Notifier loop** runs every 60s — opens/about-to-open/about-to-close notifications via `db.notifications`.
- **Bugfix** (testing-agent flagged): `_notify_promo_participants` was using `async for uid in db.promotion_events.distinct(...)` (invalid for Motor); fixed to `for uid in await ...distinct(...)`.

### Frontend
- **PromotionsListPage** (`/admin/promotions`) — summary tiles, list with schedule badge / R/pt pill / live-now indicator / toggle / delete, modal editor for new promotion (days picker, time-range, ZAR rate, eligible actions chips).
- **PromotionDetailPage** (`/admin/promotions/:id`) — hero with live-window status, 3 tabs (Daily trends, Leaderboard, Live feed).
- **Admin nav button** `admin-go-promotions` added to AdminMetricsDashboardPage.
- **Routes** registered in `App.js` for `/admin/promotions` and `/admin/promotions/:promotionId`.

### Testing
- iter32: 19/19 backend pytest pass (`/app/backend/tests/test_iter29_promotions.py`) — admin CRUD, analytics, public endpoint, permission guards, SAST timezone offset, seed promo present, score-event integration, 5-endpoint regression smoke. Frontend source-verified.

### Resend DNS (still pending)
- User reported DNS verified on Domains.co.za, but Resend rejected `mail.networkcapitalapp.co.za` as "not verified" — the domain must be added + verified on resend.com/domains too. Reverted `SENDER_EMAIL` to `onboarding@resend.dev` to keep signups working in fallback mode.



## iter 28 (Feb 12, 2026) — Full Platform Management Suite
### Backend
- **Network Capital system account** — auto-seeded on startup. Username `networkcapital`, role=admin, official=true. All "Post / DM as Network Capital" actions authored by it.
- **Feature flags collection** — `GET /api/feature-flags` (public, gates UI), `PUT /api/admin/feature-flags/<key>` (admin-only). Default flag `stokvel_plus_enabled=false`.
- **Stokvel+ Coming Soon gate** — `_enforce_stokvel_plus_enabled()` wraps `POST /api/stokvels` and `POST /api/stokvels/<id>/invite` returning 503 with "Coming Soon" when flag is off.
- **Admin announce-as-NC** — `POST /api/admin/announce` writes a Post-model-compatible feed post authored by the system account (with `official:true`, `is_announcement:true`, `pinned` metadata for the UI badge).
- **Admin DM-as-NC** — `POST /api/admin/dm` sends a direct message from the system account, fires in-app notification.
- **User moderation** — `POST /api/admin/users/<id>/restrict` (toggle can_post/can_comment/can_dm), `POST /api/admin/users/<id>/flag` (mark flagged_for_review), `GET /api/admin/users/<id>/full-profile` (user + 8 content counters + recent posts). Both 404 on unknown user.
- **Bulk admin deletes** — `DELETE /api/admin/stokvels|jobs|places|activities/<id>` with cascade.
- **Admin listings** — `GET /api/admin/jobs|places|activities|ambassadors` with regex search.
- **Ambassador role** — `POST /api/admin/users/<id>/make-ambassador` (admin only, grants `is_ambassador`+`ambassador_rank`).
- **Ambassador dashboard** — `GET /api/ambassadors/me` returns rank, recruit counts, monthly target progress (6 targets — recruits / completed_profiles / host_activity / quality_posts / comments / stokvel_assist), performance metrics, and recent recruits.
- **Public ambassador leaderboard** — `GET /api/ambassadors/leaderboard` ranks by total_contribution = Σ(monthly_score of referred users), then recruit_count.
- **Rank thresholds**: Rising Star → Ambassador (3k pts or 5 recruits) → Senior (10k/20) → Elite (25k/50) → Network Legend (50k/100).

### Frontend
- **Clickable dashboard tiles** — every StatCard on `/admin/dashboard` opens its detail page (Users/Stokvels/Jobs/Places/Posts/Connections).
- **AdminProfileDetailPage `/admin/profiles/:userId`** — full drilldown with 11 stat tiles + 8 action buttons (Message · Adjust balance · Restrict · Suspend · Flag · Make ambassador · Soft-delete · Hard-delete) + recent posts + active restrictions panel.
- **AdminListPages** — Jobs/Places/Activities lists with search + per-row delete (with reason prompt).
- **AdminAnnouncePage `/admin/announce`** — feature-flag toggle UI + compose-as-NC editor with image + pin-to-top option.
- **AmbassadorDashboardPage `/ambassadors/me`** — gradient rank hero + 6-target progress bars + monthly performance breakdown + recent recruits.
- **AmbassadorLeaderboardPage `/ambassadors/leaderboard`** — top-3 podium + full ranking.
- **CreateStokvelPage** gated by `/api/feature-flags` — shows branded "Coming Soon" screen when flag is off.
- **Profile Quick Access** — adds Ambassador tile (when user.is_ambassador) and Admin tile (when admin/moderator).
- **AdminUsersPage rows** clickable → opens profile detail.

### Testing
- iter30: 35/36 PASS — 1 critical bug found (announce post breaking feed).
- iter31: 12/12 retest PASS + 15/15 regression PASS. All iter28 surface verified.

## iter 27 (Feb 11, 2026) — Admin Moderation + Credit Grants + Audit Log
- See previous changelog entry.

## iter 26 (Feb 11, 2026) — Referral tracking + Admin hardening + Email templates
- See previous changelog entry.

## iter 25 (Feb 10, 2026) — My Places, My Network, Job reactions, Role-based admin
- See previous changelog entry.

## Earlier — see /app/memory/PRD.md for full history.

### Backend
- **Referral analytics**: `POST /api/referrals/track-click` (public, fired by JoinHandler on `/join/<code>` visits) · `GET /api/referrals/me` returns `{clicks_count, joined_count, joined_7d, completed_count, joined_users[], share_code, share_url}`.
- **Admin dashboard hardening**: `/admin/dashboard/metrics` now accepts `X-Admin-Password` header as a fallback gate AND auto-promotes the JWT-authenticated user to `role: admin` when password matches (no separate bootstrap step needed).
- **User model**: `role` field now exposed via `/users/me` so the frontend can detect admin status.
- **5 transactional email templates** wired (fire-and-forget Resend sends, never 500): Welcome (profile complete), Connection request, Connection accepted, Job application received (employer), Job application status changed (applicant). All use the reusable `_branded_email_html()` template.
- Legacy `/admin` password compare now trims whitespace.
### Frontend
- `/network` → new **"Invites" tab** with share-card (native Web Share + Copy fallback), 3 stat tiles (Clicks/Joined/Completed), and full list of joined members with active/pending badges.
- `App.js` JoinHandler fires `/api/referrals/track-click` on `/join/<code>` visits (fire-and-forget).
### Testing
- iter28: 33/33 tests PASS (10 new iter26 + 23 iter25 regression).

## iter 25 (Feb 10, 2026) — My Places, My Network, Job reactions, Role-based admin
- My Places (Trustpilot-style): CRUD + reviews + Leaflet map + owner claims.
- My Network (3-category): social/professional/financial + request/accept/reject + dashboards.
- Job reactions: like/dislike/share with clean `networkcapitalapp.co.za/jobs/<id>` URLs.
- Role-based admin: `user.role` field, `/admin/dashboard`, `/admin/users`, `/admin/bootstrap`.
- Score: +40 review · +25 connection · +20 share (with daily caps + cooldowns).
- Feed post avatar upgraded to 48×48 with secondary ring (FB/IG style).
- 3 duplicate-handler bugs fixed (legacy /connections/{request,accept,reject} deleted).
- iter27: 23/23 PASS.

## iter 24 (Feb 10, 2026) — Jobs feature retest + 4 frontend bugfixes
- JobRow click navigation (motion.div → plain div role=button).
- ProfilePage `user_kind` toggle (Social ↔ Professional).
- `/jobs/new` inline `$50` Stripe unlock CTA.
- Duplicate apply now 409 (was 400).

## iter 23 (Feb 10, 2026) — Jobs + Resend OTP
- Jobs feature: `user_kind`, `job_post_unlocked`, `/api/jobs` CRUD, `/api/jobs/{id}/apply` (409 dup), `$50` Stripe unlock, seeded BD Agent.
- Real Resend email integration replacing mock OTP. Graceful fallback returns `_mock_code` when Resend test-mode rejects unverified recipients.
- Footer Careers link with sign-in modal for guests.

## iter 22 (Feb 2026) — Score engine refactor + account mgmt
- 10,000 monthly cap, three-tier engine (T1 Ads / T2 Referrals / T3 Standard).
- Badge engine (Bronze Networker → Network Legend).
- AI comment relevance (Claude Haiku via Emergent LLM key).
- Account deactivate / delete with 30-day grace.

## Earlier — see PRD.md history
