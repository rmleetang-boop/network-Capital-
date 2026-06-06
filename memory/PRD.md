# Network Capital — PRD

## Original problem statement
Mobile-first **Community Resource Ecosystem**. Network Score = community engagement signal. Stokvel circles + premium tiers. Compliance: never "investing/returns/profit"; use "support/backing/shared access".

## Compliance Rules
- Forbidden: investing / returns / profit
- Use: support · backing · contribution · shared access · collective participation
- ZAR Premium $10 → features (Wallet, multi-sig); Network Score → reputation (Hub leaderboard, badges).

## Score architecture (iter 25)
- Monthly cap 10,000, resets monthly.
- Premium / Founder window = 2× (max 2×).
- T1 Ads: `ad_watch_engage` 500 (5/d), `ad_watch_share` 300→150→50→50→50.
- T2 Referrals: `referral_qualified` 400, `referral_feature_unlock` 200, `referral_first_post` 150.
- T3 Standard: post 50, share 20, comment 30 (AI≥0.6), like 5, video 10, daily_checkin 10, profile_completed 250.
- **NEW iter 25**: `place_review_create` 40 (10/d), `connection_made` 25 (20/d, both sides), `job_share` 20 (10/d).
- All new actions in COOLDOWN_ACTIONS (24h same source_id).
- Founders: first 1000 signups, 30d, 2×.

## Cumulative implementation
- Stokvel groups + bank, DMs, stories, explore, hashtags, mentions
- 13 African Regional Hubs (Country→Province→City)
- Activities, Stripe Premium $10, Founder counter
- Brand palette + transparent Logo Mark, favicon
- Stokvel+ purpose grid + Product/Service toggle (multi-currency)
- Anti-abuse referrals + share-code `networkcapitalapp.<username>.<MM>.<##>`
- Account deactivate (reversible) / delete (30-day grace)
- Feed post edit/delete with cascading score revoke
- Friendly share URLs on `https://networkcapitalapp.co.za` (no preview/emergent)
- Jobs feature (Social/Professional toggle, $50 Stripe unlock, /api/jobs CRUD, apply, seeded BD Agent)
- Resend transactional emails with graceful fallback to `_mock_code`
- LandingPage Careers footer link with sign-in modal

## NEW iter 25 (Feb 11, 2026) — My Places, My Network, Job reactions, Admin dashboard
### My Places (Trustpilot-style)
- Collections: `places`, `place_reviews`, `place_claims`.
- Endpoints: `GET/POST /api/places`, `GET /api/places/:id`, `POST /api/places/:id/reviews` (+40, one per user), `DELETE /api/places/:id/reviews/:rid` (revokes points), `POST /api/places/:id/claim`, `POST /api/admin/places/claims/:cid/approve`, `POST /api/places/:id/reviews/:rid/reply` (owner only).
- Frontend: `/places` (Leaflet+OSM map + list + category chips + search), `/places/new` (create form with geolocation), `/places/:id` (detail + reviews + review modal + claim modal + owner-reply form).

### My Network (3-category connection graph)
- Collection: `connections` with deterministic `id = sorted(a,b) + "__" + kind` so duplicate requests are idempotent.
- Endpoints: `POST /api/connections/request {target_user_id, kind}` (kind ∈ social|professional|financial), `POST /api/connections/:id/accept` (awards +25 to BOTH parties, idempotent via source_id), `POST /api/connections/:id/reject`, `DELETE /api/connections/:id`, `GET /api/connections/me/summary`, `GET /api/users/:id/network-summary`, `GET /api/connections/me?kind=&status_filter=`.
- Legacy `/connections/request|accept|reject` handlers DELETED (were shadowing the iter25 versions).
- Frontend: `/network` (3 gradient cards + tabs Social/Professional/Financial/Requests), `/network/:userId` (other user's network + request-connection buttons).

### Job reactions + share
- Collections: `job_reactions` (one row per user×job, toggle), `job_shares`.
- Endpoints: `POST /api/jobs/:id/react {reaction: like|dislike}` (toggles), `GET /api/jobs/:id/reactions`, `POST /api/jobs/:id/share` (awards +20, returns clean URL).
- `SHARE_BASE_URL = 'https://networkcapitalapp.co.za'` constant — share URLs NEVER contain `emergent` or `preview`.
- Frontend: like/dislike/share bar on JobDetailPage with Web-Share API + clipboard fallback.

### Role-based admin
- New `user.role` field: `user` | `moderator` | `admin`.
- `POST /api/admin/bootstrap` (header `X-Admin-Password`) — one-time owner promotion.
- `GET /api/admin/dashboard/metrics` — single-payload metrics (users 7d/30d, stokvels, posts, jobs, places, reviews, connections, top contributors).
- `GET /api/admin/users-list?q=&role=` — searchable user list.
- `PATCH /api/admin/users/:id/role` — admin-only (NOT moderator).
- Frontend: `/admin/dashboard` (metrics + bootstrap CTA for non-admin), `/admin/users` (role-mgmt with dropdown per row).

### Feed polish
- Post-author avatar upgraded to 48×48 with secondary-ring border, hover scale, gradient fallback (data-testid `post-author-avatar-<idx>`).

## Code architecture
```
/app/backend/server.py (~6,496 lines — split overdue, flagged 5+ iters)
  ├── SCORE_TABLE: +place_review_create/connection_made/job_share (lines 558-562)
  ├── revoke_score_event helper (used by post and review deletes)
  ├── iter25 module appended after line 5934 (admin role, places, network, job reactions)
  └── 2× app.include_router(api_router) [iter25 routes register via 2nd call]

/app/frontend/src/pages/
  ├── PlacesPage, PlaceDetailPage, CreatePlacePage (NEW)
  ├── NetworkPage, NetworkUserPage (NEW)
  ├── AdminMetricsDashboardPage, AdminUsersPage (NEW)
  ├── JobDetailPage (+react/share bar)
  └── FeedPage (avatar upgrade)
```

## Backlog
- **P1** Resend domain verification — add `mail.networkcapitalapp.co.za` on resend.com/domains (NOT just Domains.co.za) and verify all 4 records there before flipping `SENDER_EMAIL` back.
- **P1** Paystack (NGN/GHS/KES/ZAR) — needs user test keys.
- **P1** Carousel + Reels.
- **P2** Modularise `server.py` (>11,300 lines, blocked 7+ iters).
- **P2** CI lint to fail builds on duplicate `@api_router.<method>(<path>)` strings.
- **P2** Migrate base64 media to S3/R2.
- **P2** Lifespan handler replacing `@app.on_event` (2 startup hooks added in iter29).
- **P2** TTL index on `db.otps.expires_at`.
- **P2** Compound mongo indexes on `promotion_events` (`promotion_id+created_at`, `promotion_id+user_id`).
- **P2** Auto-dismiss / click-outside on FeatureIntroModal.
- **P2** Mobile Agent rebuild (Expo + reuse FastAPI backend).
- **P3** Capacitor wrap, Driver Pool.

## iter 50.1 (Feb 2026) — Instagram-feel profile rollout + bug fixes

### Bug fixes (P0)
- **`/u/:username` was failing with "User not found"** — the `/users/{user_id}/photos` endpoint returned 404 for any user without a `photos` field due to a falsy `if not user` check after projection. Replaced with explicit `is None`. Added new dedicated `/api/users/{user_id}/posts` endpoint so the public profile loads real feed posts (not the profile-photo album).
- **Profile bottom-nav now routes to `/u/<my-username>`** (Instagram-style) instead of the old `/profile` editable view. Old view still accessible via "Edit profile" CTA on the new page.
- **Own-profile `/u/:me` adds** the full dark-navy module grid (17 tiles: My Network, Wallet, Net Worth, Score Tracker, Jobs, Leaderboards, Notifications, Settings, …, with Ambassador/Admin/Owner Center highlighted in gold). All previous functionality preserved — no need to ever leave the Instagram view.
- Added "Edit profile" + "Share my profile" buttons on own-profile action row.

### Live-verified (preview)
- /u/owner renders: dark navy bg · gradient ring avatar · 3-stat triplet · "Platform Owner" name + OWNER pill · 17-tile module grid · GRID/TAGGED tabs · "Create my first post (+50 pts)" empty-state CTA.
- Profile bottom-nav highlights when on `/u/:username`.

## iter 50 (Feb 2026) — Super-admin password gate · Premium dark grid · Instagram-feel profile · Clickable everywhere

### Super-admin password gate (P0)
- **One-time-set PIN** stored as bcrypt hash on the platform-owner user row (`super_admin_pin_hash`). Can NEVER be reset via the app — only via direct mongosh write.
- Endpoints: `GET /api/admin/super-pin/status`, `POST /api/admin/super-pin/set` (returns 409 once set), `POST /api/admin/super-pin/verify` (returns a 15-min HS256 JWT).
- `/admin/users/cleanup-delete` now requires the `X-Super-Pin-Token` header in addition to super_admin role — destructive ops cannot be performed by a hijacked super-admin session.
- Frontend `SuperPinPage` at `/admin/owner/pin` handles both first-time set and subsequent verify flows. Token + expiry stored in `sessionStorage` and auto-attached to every axios request via the interceptor.
- Owner Center tile in profile grid now routes to `/admin/owner/pin` first (must verify PIN to proceed).

### Super admin inherits all admin functionality
- Fixed 7 admin pages whose `isAdmin` check excluded `super_admin`: AdminWithdrawalsPage, AdminAdsPage, AdminAnnouncePage, AdminAmbassadorApplicationsPage, PromotionsListPage, PromotionDetailPage, AdminListPages, AdminStokvelsPage, AdminMetricsDashboardPage, AdminAuditLogPage.
- Backend already had super_admin in `require_admin_user` — no backend changes needed.

### Premium dark-navy profile feature grid
- Replaced the flat light-gray 3-col grid with a wrapped dark-navy gradient card. Halo accents, gold-on-dark icon containers, gold "highlight" treatment for Ambassador/Admin/Owner-Center tiles. Hover lifts icon to gold + scales border.
- Header pill: "YOUR MODULES" in gold ALL-CAPS · "Tap to open" sub-label.

### Instagram-feel public profile (`/u/:username`)
- New `UserPublicProfilePage` — gradient ring avatar (gold when user has posts), 3-stat triplet (posts · connections · score), identity block with role/ambassador/founder pills, Connect/Message/Share action row, **Highlights row** (last 4 posts as ringed circles — original twist), GRID/TAGGED tabs, square 3-col posts grid with Official badges.
- Encourage-to-post empty state when user has zero posts. CTA "Create my first post (+50 pts)" on own profile.
- Backend support: `GET /api/users/by-username/{username}` returns hydrated payload with `posts_count` + `connections_count` and strips sensitive fields (password, banking, super_admin_pin_hash, email, phone, id_number).
- Legacy `/profile/:userId` auto-redirects to `/u/:username` when viewing another user with a non-empty username.

### Clickable profile everywhere
- LeaderboardsPage + LeaderboardPage entries → `/u/:username` (fallback to `/profile/:userId` when username missing).
- FeedPage avatar + username clicks navigate to `/u/:username` (with `/users/:userId` lookup fallback when username missing from payload).
- RegionalHubsPage member rows → `/u/:username` (fallback to `/profile/:userId`).
- ProfilePage own-profile preserved (full editable view); other-user view auto-redirects to `/u/:username`.

### Iter 50 testing
- 15/15 backend tests PASS (`/app/test_reports/iteration_50.json`).
- 4 frontend bugs found by testing agent: (1) missing `data-testid='avatar'` on hero ring — fixed. (2) leaderboard click — added username fallback to userId. (3) feed avatar click landed on home — added async `/users/:userId` lookup fallback. (4) `/profile/:userId` self-view doesn't redirect — confirmed as intended (own profile keeps editable view).

## iter 49 (Feb 2026) — Share growth · Pan-African expansion · Premium Features · Role-mgmt hardening

### Role management bug fixes (P0 — user-blocker)
- `bootstrap_super_admin()` now performs an **unconditional** `update_one({id}, {$set: role:'super_admin'})` and logs `matched_count`, `modified_count`, `prev_role` so production operators can verify the write.
- `POST /api/admin/bootstrap` reworked: legacy ADMIN_PASSWORD header now **explicitly promotes the configured `SUPER_ADMIN_EMAIL` user (rmleetang@gmail.com)** to super_admin — not the caller. Returns the raw `update_one` result + `other_super_admins_demoted` count. 404 if the platform-owner account doesn't exist yet.
- `GET /api/admin/dashboard/metrics`: removed silent auto-promotion-to-admin when caller hits the route with a valid X-Admin-Password but no admin role. Role escalation must now go through the explicit bootstrap or PATCH role endpoints.
- `POST /api/users/me/heartbeat` and `PUT /api/users/me` confirmed to NEVER touch `user.role`. `UpdateProfileRequest` Pydantic model is a strict allowlist with no `role` field — role smuggling impossible.

### Share growth
- Ambassador referral link: `GET /api/ambassador/share-link` → `https://networkcapitalapp.co.za/r/<username>` with ready-to-post share text.
- Public referral landing page: `/r/:username` (frontend route in BOTH unauth and auth route trees) + `GET /api/referral/{username}` backend resolver.
- Promotion sharing: `GET /api/promotions/{id}/share-payload` returns auto-generated blurb (title + reward + ends + min-score). `POST /api/promotions/{id}/share` awards +20 pts (24h cooldown).
- Frontend: `ShareLinkCard` mounted atop Ambassador IncentivePanel. `PromotionShareButton` on every promo card.

### Pan-African expansion
- AFRICAN_REGIONS expanded from 13 → **55 entries** (54 AU members + 'other'). New: Algeria, Angola, Benin, Botswana, Burkina Faso, Burundi, Cameroon, Cape Verde, CAR, Chad, Comoros, Congo-Republic, DRC, Côte d'Ivoire, Djibouti, Equatorial Guinea, Eritrea, Eswatini, Gabon, Gambia, Guinea, Guinea-Bissau, Lesotho, Liberia, Libya, Madagascar, Malawi, Mali, Mauritania, Mauritius, Mozambique, Namibia, Niger, São Tomé, Seychelles, Sierra Leone, Somalia, South Sudan, Sudan, Togo, Tunisia, Zambia.
- Free-text city input — `CustomCityInput` at `/hubs` ("My city is not listed" button) so users can self-declare any city not in the seeded list.

### Premium "Features" landing section
- New `<section id="features">` on landing page with 9 premium feature tiles (My Network, Activities, Stokvel+ Wallet, Net Worth, Score Tracker, Jobs, Direct Messages, Ambassador, Promotions).
- Dark navy + gold (#E8A817) aesthetic: gradient halos, subtle grid texture, gold-bordered icon containers, motion-staggered reveals, hover-lift + gold halo, ALL-CAPS tag pills (CORE/COMMUNITY/PREMIUM/TOP TIER/REWARDS etc.).
- Trust-signal row beneath grid (POPIA-aligned · Pan-African 54 countries · Premium for $10).
- Nav "Features" anchor now points to `#features` instead of `#how`.

### Hardening
- All `current_user["photo"]` / `current_user["username"]` keyed accesses in posts/comments/stokvel join/contribute switched to `.get(...) or ""` (KeyError-proof for legacy users).
- Duplicate `require_admin_user` / `require_super_admin` definitions consolidated to one declaration each (near June payout block).

### Iter 49 testing
- 17/17 backend tests PASS (`/app/test_reports/iteration_49.json`). 95%+ frontend source-verified.
- 1 routing bug found + fixed: `/r/:username` now registered in the first-time-visitor route tree as well as the authed/onboarded trees.

## iter 48 (Feb 2026) — Ambassador Incentive Programme · Global Job Apps · User Cleanup
### Ambassador Incentive (R8,500 ZAR)
- `_allocate_ambassador_balance()` fires on every ambassador role grant (set-role, make-ambassador, application approve) — idempotent.
- R5,000 referral pot immediately available; R3,500 activity pot unlocks at 20 posts + 100 likes + 5 ad shares (`_check_ambassador_activity_unlock` wired into create_post / like_post / claim_ad_reward + GET /ambassador/incentive).
- Tiered withdrawals: 20→R500 / 40,60,80→20% of remaining / 100→full remaining.
- June 30 2026 payout block respected.
- Display block converts ZAR → user's preferred currency via SUPPORTED_CURRENCIES rates table (no conversion if pref=ZAR).
- Endpoints: `GET /api/ambassador/incentive`, `POST /api/ambassador/incentive/withdraw`, super-admin `GET/PATCH /api/admin/ambassador/config`, `GET /api/admin/ambassador/audit`.
- Frontend: `IncentivePanel` mounted inside `/ambassadors/me` (testids: incentive-available, incentive-activity-targets, incentive-tiers, incentive-withdraw-section).

### Global Job Applications (admin)
- `GET /api/admin/job-applications` (admin/super_admin) — global view with counts breakdown.
- `POST /api/admin/job-applications/{id}/view` — marks viewed, fires "your application is under review" Brevo email (once).
- `PATCH /api/admin/job-applications/{id}` — admin status change with applicant-facing email + audit log.
- Frontend: `/admin/job-applications` page (testids: admin-job-applications-page, status-pill-{s}, app-row-{id}, btn-view-{id}, btn-hired-{id}, btn-reject-{id}).

### Super Admin User Cleanup (hard delete)
- `GET /api/admin/users/cleanup-candidates` — super-admin only, returns posts/jobs/stokvels counts + is_stale flag.
- `POST /api/admin/users/cleanup-delete` — irreversible delete with 21-collection sweep. Requires reason ≥10 chars + email confirmation + zero wallet balance. Refuses admin/super_admin/platform-owner targets.
- Frontend: `/admin/owner/cleanup` page with confirm modal (testids: owner-user-cleanup-page, cleanup-row-{id}, cleanup-delete-{id}, cleanup-confirm-modal, cleanup-reason, cleanup-confirm-email, cleanup-confirm).
- Two new Owner Control Center tiles (testids: users-cleanup, users-job-apps).

### Iter 48 testing
- 27/27 backend tests PASS (`/app/backend/tests/test_iter48_ambassador_jobs_cleanup.py`).
- Frontend testids source-verified. Live click-test deferred (auth bootstrap blocker carried over from iter35).

## Testing
- iter22: 38/40 cumulative regressions.
- iter23: 18/18 Jobs+Resend.
- iter24: 4/4 retest fixes.
- iter25 / iter26 / iter27: 23/23 backend tests (Places + Network + Job-reactions + Admin + regressions) — FRONTEND smoke verified for avatar upgrade, /network 3-card layout, /admin bootstrap CTA. Full Playwright e2e on UI authenticated flows deferred (data-testid coverage now complete).
