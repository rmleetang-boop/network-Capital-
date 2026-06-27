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
- iter51 (Feb 28, 2026): 19/19 backend PASS for carousel + reels + announcements. Frontend smoke verified — composer opens, carousels render with dots + counter, reels render with 9:16 player + mute toggle.

## Iter 51 (Feb 28, 2026) — Carousel + Reels for Feed & Admin Announcements
### Backend
- New `POST /api/uploads/media` (multipart) — streams to `/app/backend/uploads/<scope>/<filename>`. Scopes: `posts` (any auth user) / `announcements` (admin/super_admin only). Caps: 11 MB image, 50 MB video. Mime allowlist enforced. Files served via FastAPI `StaticFiles` mount at `/api/uploads/<scope>/<filename>`.
- `Post` Pydantic model extended with `slides: List[Dict] | None`, `media_type: str | None` ("single" / "carousel" / "reel"), `duration_seconds: int | None`. `GET /api/posts` now surfaces these.
- `POST /api/posts` accepts `slides` (2–10) for carousels and `video + media_type='reel' + duration_seconds ≤ 30` for reels.
- `AdminAnnounceRequest` + `POST /api/admin/announce` extended with the same shape — admin announcements now support carousels and reels (max 30s) too.
- Reel duration cap changed from 60s → **30s** (matches user spec).

### Frontend
- New `MediaRenderer` component (carousel with dots/arrows/counter, intersection-observer driven reel player with mute toggle).
- `mediaUpload.js` helper (`uploadMedia`, `validateMediaFile`, `probeVideoDuration`, `resolveMediaUrl`).
- `FeedPage` composer rewritten: "Add Photos" multi-select (1–10) + "Add Reel" (single, ≤30s). Live upload progress bar. Preview grid with per-slide remove and "+" add-more tile.
- `AdminAnnouncePage` composer rewritten with the same Photos/Reel pickers + previews.

### Testids
- Feed composer: `create-post-button`, `create-post-modal`, `post-content-input`, `photos-picker`, `photos-input`, `reel-picker`, `reel-input`, `photo-previews`, `remove-slide-<i>`, `add-more-photos`, `reel-preview`, `remove-reel`, `submit-post-button`.
- Feed render: `post-carousel-<index>`, `carousel-prev`, `carousel-next`, `carousel-dot-<i>`, `post-reel-<index>`, `reel-mute-toggle`.
- Admin announce: `announce-content-input`, `announce-photos-picker`, `announce-photos-input`, `announce-reel-picker`, `announce-reel-input`, `announce-photo-previews`, `announce-remove-slide-<i>`, `announce-add-more-photos`, `announce-reel-preview`, `announce-remove-reel`, `announce-publish-button`, `announce-pin-checkbox`.


## Iter 52 (Feb 28, 2026) — Creator System v2
### Backend
- `User` extended with `creator_type` (`independent`|`growth`) + `creator_classification` (12 options).
- `Product` extended with `slug`, `classification`, `tags`, `website`, `support_needed`, `support_categories[]`, `file_url/access/price`, `view_count`, `download_count`.
- Auto-publish for Independent / `pending_review` for Growth.
- `POST /api/uploads/file` (PDF/PPT/EPUB/DOC/XLS/ZIP ≤100 MB).
- `GET /api/products/by-slug/<u>/<s>` + `POST /file-lead` + `GET /download` + `POST /file-checkout` (Stripe).
- `GET /api/share/p/<u>/<s>` → full Open Graph HTML (works on WhatsApp/Twitter/FB/LinkedIn).
- Boot backfill: 29 existing creators → Independent; all historic products got slugs + `creator_username` (idempotent).

### Frontend
- `CreateProductPage` wizard: Creator-Type chooser, Classification grid, Tags, Hero images, Website (Step 1); File picker + free/email-gated/paid access tiles + Growth-only Support section (Step 4); creator-type-aware review + button copy (Step 5).
- New page `/p/:username/:slug` for shareable products (works for unauth + auth visitors).

### Testing
- Iter 52: 22/22 backend PASS; FE Playwright smoke-tested (KPI + composer + shared page).

## Iter 53 (Feb 28, 2026) — Ambassador Backend Verification (carry-over from iter 50/51)
- 27/27 backend PASS — `_check_ambassador_activity_unlock` uses 10-ref threshold, `/admin/ambassadors/{uid}/bonus` + `/bonus-adjust` work, no wallet fees, June Payout Block honored, all admin tools regressed clean.

## Iter 54 (Feb 28, 2026) — Ambassador Dashboard 2.0 (Command Center)
### Backend
- `GET /api/ambassador/command-center` returns single payload: 8 KPIs, network nodes (color + size from engagement score), AI insights, 6-stage funnel, 30-day heatmap, hidden-bonus teaser, 6-tier level, autopilot state.
- `POST /api/ambassador/referrals/{uid}/engage` (motivation|reminder|profile|verification|reengagement) — templated personalized email via Brevo, logged to `engagement_emails`.
- `GET /api/ambassador/engagement-log?limit=N`.
- `PUT /api/ambassador/autopilot` (enable/disable).
- Stage classifier: registered → verified → profile_completed → active (score 1-999) → qualified (≥1000).
- Engagement-score formula: 15(verified)+25(profile)+min(30,score/100)+min(30,activity*3) → cap 100. Colors: ≥75 green / ≥50 yellow / ≥25 orange / <25 red.

### Frontend
- New `/ambassadors/command-center` page — futuristic fintech command center with glassmorphism cards, SVG network graph (circular layout, color-coded nodes), AI Insights panel, Conversion Pipeline funnel, 30-day Heatmap, Hidden Bonus card, Level/Gamification card, Auto-Pilot toggle, Email Log slide-in drawer.
- Node-click opens a right-side drawer showing full referral profile + 5 Smart Engagement Action buttons.
- CTA button "Command center" added to `/ambassador-dashboard` header.

### Testing
- Iter 54: 22/22 backend PASS. FE smoke verified — all KPIs, graph, insights, funnel, heatmap, drawer, engage buttons, email log working.

### Bug fixes from iter 54 test report
- Engagement endpoint was importing non-existent `send_email` symbol — fixed to use the actual `send_transactional_email(to_email, subject, html_content, *, text_content)`. Emails now deliver via Brevo.
- Sanitized `last_error` returned to FE — no longer leaks Python ImportError/stack traces. FE toast shows friendly "Email queued · provider unavailable" message instead of raw error.
- Email log button: made testid visible on mobile (icon stays, label hides on small screens).


## Iter 55 (Feb 28, 2026) — Production hot-fix bundle
**Trigger**: live users reported (a) images crashing on feed, (b) shared link previews missing, (c) ambassador welcome email no longer showed wallet balance, (d) owner needed a manual wallet-adjust tool. Four fixes shipped together.

### Backend
- `Post.image_data_url` + `Story.image_data_url` model fields added — base64 fallback survives `/app/backend/uploads/` wipes on prod redeploy until S3/R2 migration lands.
- `POST /api/admin/users/{user_id}/wallet-adjust` (require_super_pin) — credit/debit any wallet, abs(delta) ≤ 1,000,000, debit auto-capped at current balance (no overdraft), writes `wallet_adjustments` doc + `AuditLog` row + in-app notification for target user.
- `_role_change_html(..., wallet_info=)` — ambassador role grant email now surfaces starting_balance_zar + available_zar in a wallet card.
- `_notify_role_change` fetches fresh `_ambassador_state` and threads wallet_info into the email for ambassador promotions.
- New OG endpoints: `GET /api/share/u/{username}`, `/api/share/post/{post_id}`, `/api/share/r/{username}` — full og: + twitter: meta + JS redirect to SPA route.

### Frontend
- New `SafeImage` component — three-state (primary → fallback base64 → "Image unavailable" placeholder w/ ImageOff icon). Wired through `MediaRenderer` so every feed image / story / product card is now crash-proof.
- New `WalletAdjustModal` (Super-Admin only) — credit/debit toggle, amount + reason inputs, before/after preview, confirm-dialog, posts to `/api/admin/users/{id}/wallet-adjust` with `X-Super-PIN-Token` header.
- AdminProfileDetailPage shows "Wallet ± adjust" tile (data-testid=`action-wallet-adjust`) when viewer is super_admin.

### Testing
- Iter 55: 13/13 backend PASS — OG endpoints, wallet-adjust (every guard tested incl. 401/403/400/cap/audit/notification), ambassador grant email confirmed firing via [MAIL-SENT].

## Iter 55b (Feb 28, 2026) — Ambassador welcome email de-dup
**Bug from iter 55 test report**: every new ambassador received TWO welcome emails — the legacy "Welcome to the Network Capital Ambassador Program" (from `_allocate_ambassador_balance`) AND the new iter 55 "Welcome to the Network Capital Ambassador programme" (from `_notify_role_change`). Only the iter 55 one carried the wallet balance.

### Fix
- Removed the entire email-send try/except from `_allocate_ambassador_balance` — function now only persists balance + writes `ambassador_audit` row.
- Enriched `_role_change_html` (when granted+ambassador+wallet_info) with the "How to earn" + "Withdrawal rules" content the legacy email used to carry.
- `_notify_role_change` is now the **sole** ambassador welcome-email path. `admin_make_ambassador` already guards with `prev_was_ambassador != is_amb` so re-toggling doesn't duplicate.

### Testing
- Iter 55b: 18/18 backend PASS (5 new dedupe tests + 13 iter55 regression). Tail of backend.err.log confirms exactly one [MAIL-SENT] event per grant. Idempotency on repeat-grant verified (zero extra MAIL-SENT).

## Pending / next priorities
- **P0** — Migrate Reels/Carousel/Creator-file uploads to **Cloudflare R2 or S3** (Emergent confirmed no persistent disk on any plan; local `/app/backend/uploads/` wipes on every redeploy). Awaiting user keys.
- **P1** — Paystack live integration for NGN/GHS/KES/ZAR (awaiting user test keys).
- **P2** — Super Admin Global Dashboard Control (paused by user — needs scope discussion).
- **P2** — Capacitor wrap for iOS/Android.
- **P3** — Live FX rates via exchangerate.host; Driver Pool extension; modularize 13k-line server.py.


## Iter 56 (Feb 28, 2026) — Product Experience Redesign (Lean Independent Creators)
**Goal**: any Independent creator (no financial-support needed) can list a Product or Service in <2 min with ≤5 actions. Crowdfunding/support/fundraising/donation/sponsorship/AI flows are intentionally OUT — legacy backend endpoints kept alive for existing products.

### Backend
- `CreateProductRequest` relaxed — `estimated_cost`, `timeline`, `interest_level` now Optional with defaults; new `publish` flag (False → `status='draft'`); new More Options fields (`inventory_qty`, `shipping_options`, `refund_policy`, `variants`, `delivery_options`).
- `POST /api/products` returns `message='Saved as draft'` when `publish=False`.
- `GET /api/products/me/dashboard` — wallet, sales, orders, views, followers, store_name (`<first_name>'s Store`), recent products.
- `GET /api/storefront/{username}` — PUBLIC. Returns store meta + only approved products. 404 for unknown user.
- `PUT /api/storefront/me` — customise store_name (2-60), store_bio (≤280), store_cover.

### Frontend
- `CreateProductPage.js` (full rewrite) — 4-step wizard (Kind → Name+Image → Price+Currency → Description+Solution → Publish) + **Quick Sell** single-screen mode. Save Draft + Publish Now buttons. Collapsible **More Options** (inventory, shipping, refund policy, availability, variants, delivery, contact).
- `PublishSuccessModal.js` (NEW) — product preview, shareable link (`networkcapitalapp.co.za/p/<u>/<s>`), QR code SVG (qrcode.react v4), Copy/Share/View store/Sell another CTAs, dismissible Creative Services card (mailto:creative@networkcapitalapp.co.za).
- `MyStorePage.js` (NEW) at `/my-store` — auto-store-name header, 5 stat cards, `+ Sell another product` CTA, All/Live/Drafts tabs, store QR + copy-link.
- `StorefrontPage.js` (NEW) at `/store/:username` — public buyer page. Search + category filter, follow/contact/share/copy CTAs, product grid.

### Routing
- `/store/:username` in BOTH authenticated AND unauthenticated route blocks (public access).
- `PromotionsWelcomeModal` suppressed on `/products/create`, `/my-store`, `/store/*`.
- Layout bottom-nav hidden on `/products/create` (sticky publish footer needs bottom edge).

### Testing
- Iter 56: Backend 12/12. Frontend identified 3 blockers (modal hijack + route block + missing testids).
- Iter 56b: ALL fixes verified. Backend 12/12 regression. Frontend 6/6 spec groups PASS — full E2E publish + Save Draft + Quick Sell + public storefront + my-store dashboard all confirmed.

### Out of scope (next)
- **Phase 3** — Cart drawer + Buyer checkout (Wallet + Stripe). EFT + Mobile Money pending Paystack keys.
- **Phase 4** — Inline `/store/customize` page for store name/bio/cover edits.


## Iter 56c (Feb 28, 2026) — Share-URL Canonical Domain Hot-fix
**User-reported bug**: Share links rendered as `https://stokvel-plus.cluster-5.deploy.emergentcf.cloud/p/<u>/<s>` instead of the canonical `https://networkcapitalapp.co.za/p/<u>/<s>`.

### Root cause
`_share_html_response` built the OG canonical URL from `request.url.netloc` — so the cluster/preview host leaked into og:url, `<link rel="canonical">`, meta refresh, and the JS `window.location.replace()`. WhatsApp/Twitter cached preview cards with the wrong host.

### Fix
- `server.py::_share_html_response` hardcodes `base = "https://networkcapitalapp.co.za"` — all 4 URL emission points (canonical, og:url, meta refresh, JS redirect) now carry the prod brand domain regardless of which environment a crawler hit.
- `SharedProductPage.js` Share button hardcoded to `https://networkcapitalapp.co.za/api/share/p/<u>/<s>`.
- `ShareMenu.js` (post share) backend constant hardcoded to `https://networkcapitalapp.co.za`.
- `og:image` deliberately still uses request-host (uploaded images live on whichever backend received them).

### Testing
- Iter 56c: 20/20 backend pytest PASS (8 new canonical-domain + 12 iter56 regression).
- Frontend Share button verified live via Playwright clipboard capture.
- Regression guard: `/app/backend/tests/test_iter56c_share_canonical.py`.


## Iter 56d (Feb 28, 2026) — Bundle: Outreach + Digital Files + Growth-Creator Restore + Store Entry Point

### 1) Non-User Outreach Email System (Admin + Super-Admin)
New `/admin/outreach` page. Three professional Brevo-delivered email templates: `future_through_network`, `income_streams`, `join_the_movement`. Sender-defined subject. Optional first-name personalisation. Embedded landing-page screenshot (`/landing-preview.png`). Contact: creative@networkcapitalapp.co.za + WhatsApp +27 74 574 7401. Footer: "You received this from the Network Capital Team because we want you to build a great future with your network."

**Compliance (per user spec):**
- "Never contact me again" opt-out (NOT "Unsubscribe") via signed JWT token. Records into `outreach_suppressions` collection; future sends auto-skip.
- No tracking pixels.
- Existing registered users auto-suppressed (don't re-invite).
- Per-admin rate limit: 500/day.
- Bulk cap: 100 recipients per call.

**Endpoints** (all admin-gated, super_admin sees all history):
- `GET /api/admin/outreach/templates` · `POST /api/admin/outreach/preview`
- `POST /api/admin/outreach/send` (single) · `POST /api/admin/outreach/bulk` · `POST /api/admin/outreach/upload-csv`
- `GET /api/admin/outreach/list` (history + stats_30d) · `POST /api/admin/outreach/{id}/resend`
- `GET /api/admin/outreach/suppressions` · `GET /api/outreach/never-contact?token=<jwt>` (public opt-out)

### 2) Digital file upload in lean wizard (Gumroad-style)
On Step 4 → More Options, a new "Digital download" section. Sellers attach PDF/EPUB/DOC/PPT/ZIP/XLS/CSV/TXT/MD up to 100 MB via existing `/api/uploads/file` endpoint. **Seller defines access mode themselves**: Free / Email-gated / Paid (price-per-download). Backend persists `file_url`, `file_name`, `file_size_bytes`, `file_mime`, `file_access`, `file_price` on the product. Buyer-side download flow already wired from iter 52.

### 3) Growth-creator support flow restored
Third tile on the kind-chooser screen: **"Need support to build this →"** (Growth-creator pill). Opens the standard wizard with `with_support=true`; Step 4 reveals a `SupportRequestPanel` requiring at-least-one category (Funding/Partnerships/Mentorship/Customers/Marketing/Team/Technical/Distribution) + optional message + T&C acknowledgement. New backend flag `apply_for_growth: bool` on `CreateProductRequest` — when true with `support_needed=true`, server promotes the user's `creator_type` from `independent`→`growth` and the product is created with `status='pending_review'` for admin moderation (existing iter 52 logic).

### 4) Store entry points added
- `/profile` → quick-access grid now has a **"My Store"** tile (Package icon, highlighted).
- `/admin/owner/pin` (super_admin) → Owner Control Center QuickActionGrid now has **"Invite non-users"** tile linking to `/admin/outreach`.

### Routing / UX guards
- `PromotionsWelcomeModal` suppression extended to ALL `/admin/*` routes (was already on commerce routes). PIN page no longer blocked.

### Testing
- Iter 56d: Backend 19/19 PASS (templates + admin-gate + preview HTML compliance + send single guards + bulk 100-cap + CSV parse + history stats + resend counter + JWT opt-out + apply_for_growth promotion). Tests live at `/app/backend/tests/test_iter56d_outreach.py`.
- Frontend: My Store tile + 3rd kind tile + full Outreach page (4 tabs, all selectors) + qa-outreach Owner Center tile all verified live.


## Iter 56e (Feb 28, 2026) — Influencer Outreach + Feed Moderation + Profile Store Pill

### 1) Influencer-targeted outreach template
Replaced `join_the_movement` with new **`influencer_collab`** template (Aspirational · founding-creator angle for creators we contacted off-platform). Headline: "We've been watching your work — let's collaborate." Body emphasises Network Score as a transparent activity-tracking reputation system, opportunities/partnerships/rewards reserved only for high-score members, founding-creator status, and first-wave web-based membership. Per-template CTA labels added (`cta_label`). Influencer CTA: "Claim your founding-creator spot →".

### 2) Profile header "My Store" pill
Prominent yellow `[profile-my-store-button]` added next to the Edit Profile icon (visible above-the-fold on first profile load — not hidden by the welcome modal). Still available via the existing iter-56d Quick-Access grid tile.

### 3) Admin/Super-Admin feed moderation
- New `POST /api/admin/posts/{id}/hide` — soft-hide (reversible). Records `hidden_at`, `hidden_by`, `hidden_reason`. AuditLog `post.hide`.
- New `POST /api/admin/posts/{id}/unhide` — restore. AuditLog `post.unhide`.
- Existing `DELETE /api/admin/posts/{id}` already wired (audit `post.delete`).
- **Global suppression**: `{hidden:{$ne:true}}` filter applied to **every public post-read surface**: `/api/posts` (main feed), `/api/hashtags/{tag}`, trending ranker (`/api/posts/trending`), and `/api/users/{id}/posts` (profile feed). Hidden posts disappear everywhere.
- 403 to non-admins; 404 on unknown post id.
- Frontend: `PostCard` on Feed now shows an "Admin actions" section in the 3-dot menu when viewer role ∈ {admin, super_admin, moderator}: **Hide from feed / Restore post** + **Delete (admin)**. Hidden posts show `[post-hidden-badge-<idx>]` with the reason & moderator.

### Testing
- Iter 56e: Backend **11/11** (regression: `/app/backend/tests/test_iter56e_moderation_outreach.py`). Frontend: all 4 selectors verified end-to-end (profile-my-store-button, influencer template card + iframe, admin post menu hide/delete, post-hidden-badge toggle).
- Global-suppression verified live via curl: hide a post → public feed, profile feed, hashtag feed, trending ranker ALL exclude it; unhide → all surfaces restore.


## Iter 56f (Feb 28, 2026) — Cloudinary Migration ✅

**Root problem solved**: Kubernetes pods wipe `/app/backend/uploads/` on every redeploy. All user-uploaded media (post images, reels, carousel images, product images, profile photos, story media, creator product files) was at risk of disappearing on every production deploy.

### What changed
- **NEW**: `/app/backend/services/cloudinary_service.py` — async-aware Cloudinary client (lazy-configured from env vars; gracefully no-ops if creds missing).
- **`POST /api/uploads/media`** (images + videos) rewritten: Cloudinary first (folders: `posts/`, `products/`, `announcements/`, `stories/`); disk fallback retained for resilience.
- **`POST /api/uploads/file`** (PDF/EPUB/DOC/PPT/ZIP/XLS/CSV/TXT/MD) rewritten: Cloudinary `resource_type='raw'` (folder: `files/`); disk fallback retained.
- **Auto-optimization**: all image + video delivery URLs include `f_auto,q_auto` for automatic WebP/AVIF format + perceptual quality (30-60% smaller files, faster loads).
- **Response shape unchanged** — adds new fields (`public_id`, `storage`, `duration` for videos) but preserves every prior field (`url`, `size_bytes`, `filename`, `mime`, `data_url`). Frontend untouched.
- **Env**: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` added to `/app/backend/.env` (never in code, never committed).
- **Dependency**: `cloudinary==1.44.2` added to `requirements.txt`.

### URL pattern examples
- Image: `https://res.cloudinary.com/dwocjyvys/image/upload/f_auto,q_auto/v.../posts/<pubid>.png`
- Video: `https://res.cloudinary.com/dwocjyvys/video/upload/f_auto,q_auto/v.../posts/<pubid>.mp4`
- PDF/raw: `https://res.cloudinary.com/dwocjyvys/raw/upload/v.../files/<pubid>.pdf`

### Testing
- Iter 56f: **13/13** backend pytest PASS (`/app/backend/tests/test_iter56f_cloudinary.py`) covering image/video/raw uploads, scope guards, size limits, CDN GET retrieval, disk-fallback code path, end-to-end product flow with Cloudinary asset URLs.
- Regression: **All prior iter 56*-suite tests pass (after fixing iter56d's stale `join_the_movement` template-id assertion to `influencer_collab`).** 19/19 outreach + 11/11 moderation/influencer + 12/12 lean-creator + 20/20 share-canonical + 18/18 ambassador-email-dedupe.
- Manual smoke: PNG upload → Cloudinary URL with `f_auto,q_auto` → publicly fetchable; PDF upload → raw resource URL → publicly fetchable.

### Production impact (zero-downtime migration)
- **Existing uploaded files**: keep working — their `/api/uploads/*` URLs still resolve from disk until the next pod redeploy.
- **New uploads (post-deploy)**: go straight to Cloudinary; survive every future redeploy.
- **No data migration script** required — existing prod URLs continue to work; the disk-wipe-on-redeploy problem stops occurring for any NEW uploads.


## Iter 56g (Feb 28, 2026) — My Store tile in Profile-tab module grid
Added `{ icon: Package, label: 'My Store', path: '/my-store', highlight: true }` to **`OwnModuleGrid`** in `/app/frontend/src/pages/UserPublicProfilePage.js` (line 388). This is the grid the user sees when tapping the bottom-nav **Profile** tab (which routes to `/u/<username>` when a username is set — see `Layout.js:15`). Now 18 tools, gold-highlighted, visible above-the-fold. Verified live via Playwright screenshot.

### Duplicate-component audit
- `pages/ProfilePage.js` line 707 — `quick-access-grid` — used when user has **no username** → `/profile`.
- `pages/UserPublicProfilePage.js` line 405 — `own-module-grid` — used when user **has a username** → `/u/<username>` (current Profile-tab default).
- `pages/AdminProfileDetailPage.js` — admin viewing OTHER users (wallet-adjust etc.) · NOT a duplicate.

Both grids now carry the "My Store" tile (iter 56d added it to `ProfilePage`; iter 56g adds it to `UserPublicProfilePage`).


## Iter 57 (Feb 28, 2026) — Profile pages DRY refactor

**Goal**: Single source of truth for the own-profile module tile grid, eliminating the duplicate-update bug (e.g. iter 56d → iter 56g had to add "My Store" tile in two places).

### What changed
- **NEW**: `/app/frontend/src/components/profile/OwnModuleGrid.jsx` (126 lines) — shared component owning the canonical 16-tile base list + conditional Ambassador / Admin / Owner Center tiles. Takes `profile`, `onNavigate`, `variant` props.
- **Variants** preserve all existing data-testids:
  - `variant="own-module"` (used on `/u/:me` via `UserPublicProfilePage`) — wrapper `own-module-grid`, per-tile `module-<slug>`, header right `"<N> tools"`, single gold halo.
  - `variant="quick-access"` (used on `/profile` via `ProfilePage`) — wrapper `quick-access-grid-wrap`, inner `quick-access-grid`, per-tile `quick-<slug>`, header right `"Tap to open"`, gold + blue halos.
- `ProfilePage.js`: removed inline 60-line grid markup + 10 unused icon imports; now `<OwnModuleGrid profile={profileUser} variant="quick-access" />`.
- `UserPublicProfilePage.js`: removed inline `OwnModuleGrid` definition + 10 unused icon imports; now `<OwnModuleGrid profile={profile} onNavigate={navigate} variant="own-module" />`.
- File-size delta: ProfilePage.js 842→783 (−59), UserPublicProfilePage.js 438→379 (−59). Net duplication eliminated.

### Testing
- Iter 57: Backend **100%**, Frontend **95%** (`/app/test_reports/iteration_57.json`).


## Iter 58 (Feb 28, 2026) — Perf, MongoDB indexes, image opt, Site Map, Store/Jobs CRUD

### Group C — Performance (FE)
- `App.js` rewritten: every feature route now imported via `React.lazy` + `Suspense` (Layout / Auth / Onboarding / Landing / PremiumLoadingScreen / PromotionsWelcomeModal stay eager). Single `<RouteFallback>` (`data-testid='route-loading'`) shows during chunk load.
- `PremiumLoadingScreen` no longer enforces a `minDuration` timer; parent controls visibility via `visible` prop. Boot loader disappears the moment `/users/me` resolves (no artificial wait).
- New `lib/stokvelIntro.js` — extracted helpers so `App.js` can statically import `hasSeenStokvelIntro` without forcing the whole `StokvelIntroPage` into the initial bundle.
- `lucide-react`: audited — already all named imports (no barrel `import *`); no change needed.
- `recharts`: confirmed unused in src/.
- `leaflet`, `react-leaflet`: only `PlacesPage.js` imports them — already isolated to that lazy chunk.
- `framer-motion`: legitimately required by `LandingPage`, `AuthPage`, `OnboardingPage`, `PremiumLoadingScreen` (all part of the eager boot bundle); other usages are inside lazy chunks.

### Group D — MongoDB indexes (BE)
- Extended `ensure_indexes` startup hook (server.py ~7328) with hot-path indexes:
  - `posts`: `created_at desc`, `(author_id, created_at desc)`, `hidden sparse`.
  - `users`: `id unique`, `username unique sparse`, `email unique sparse`.
  - `notifications`: `(user_id, read, created_at desc)`, `(user_id, created_at desc)`.
- Each spec is wrapped in its own try/except so one failure doesn't block the rest.
- One-off cleanup: deduplicated a stale `rmleetang@gmail.com` user record to allow `users_email_unique` to build cleanly.

### Group E — Image assets
- Resized in-place: `logo-mark.png` 2000×2000 → 256×256 (1.5MB → 43KB), `logo-main.png` 2000×2000 → 1200×1200 (962KB → 354KB), `logo-secondary.png` 2000×500 → 1024×256 (232KB → 104KB), `favicon.png` 2000×2000 → 32×32 (772KB → 1KB).
- WebP siblings generated (`.webp` for each logo) at q=82.
- New favicon set: `favicon-32.png`, `favicon-192.png`, `apple-touch-icon.png` (180×180), `logo192.png`, `logo512.png` for PWA manifest.
- New `public/manifest.json` (PWA shell) — `index.html` `<link rel="manifest">` added; favicon links updated to proper sized set.
- New reusable `components/BrandImg.jsx` — `<picture>` wrapper that emits a WebP `<source>` + PNG `<img>` fallback. Wired into `PremiumLoadingScreen` and `LandingPage` header (highest-traffic surfaces).

### Group B — Site Map + Landing
- New `pages/AdminSitemapPage.js` at `/admin/sitemap` — 7 sections (Core / Score / Commerce / Community / Ambassador / Admin / Owner), 42 tiles total, each with icon + one-line description + route. Search input filters live. Premium dark-navy + gradient halos, click any icon to open. Admin/super_admin/moderator only.
- Sitemap entry points: gold "★ Site Map" button on `AdminMetricsDashboardPage` (`admin-go-sitemap`); "Site map" tile in `OwnerControlCenterPage` QuickActionGrid (`qa-sitemap`).
- `LandingPage` FEATURES grid extended from 9 → 13 user-facing tiles (added My Store, Creator System, Stokvels, My Places) — admin-only features intentionally NOT advertised on the public landing.

### Group A — Store + Jobs CRUD
- **Storefront follow** — new `POST /api/storefront/{username}/follow` (toggle, idempotent via `$addToSet`/`$pull` on `user.store_followers`) + `GET /api/storefront/{username}/follow-status`. `get_public_storefront` now returns `follower_count` from this list. 400 if user tries to follow own store.
- **Product soft-delete** — new `DELETE /api/products/{id}` sets `status='deleted'` (preserved for audit). Owner or admin/super_admin/moderator. Public storefront filter `status: approved` already excludes deleted rows. Writes `audit_log` row.
- **Storefront UI** — `StorefrontPage.js` follow button wired to new endpoint, busy spinner, live `follower_count` (`data-testid='storefront-follower-count'`).
- **My Store UI** — `MyStorePage.js` per-product Trash icon (`mystore-product-delete-<id>`) → confirm prompt → DELETE → optimistic list update.
- **Admin Jobs CRUD** — new dedicated `pages/AdminJobsPage.js` (replaces generic re-export from `AdminListPages`) with: Post (+ /jobs/new), per-row inline Edit modal (`admin-job-edit-modal`), per-row Delete with reason prompt, per-row View, and global "Applications" link to `/admin/job-applications` (where iter48 approve/reject already lives).
- **Backend jobs gate fix** — `PATCH /api/jobs/{id}` and `DELETE /api/jobs/{id}` used `current_user.get("is_admin")` (field doesn't exist, so admins could never edit other people's jobs). Replaced with `role in ('admin','super_admin','moderator')`.

### Testing
- Iter 58: Backend **100%**, Frontend **100%** (`/app/test_reports/iteration_58.json`). Pytest regression suite at `/app/backend/tests/test_iter58_perf_follow_sitemap.py`. No defects found. `retest_needed: false`.


## Iter 58b (Feb 28, 2026) — Payload hygiene, pagination, Cloudinary migration, sitemap PDF, nginx gzip

### Backend
- `GET /api/posts` — pagination via `skip` + `limit` (default 10, hard cap 50). Projection explicitly excludes `image_data_url`.
- `_enrich_posts_with_live_score` — only propagates `user_photo` when the author's stored photo is a URL. Base64 data URLs no longer leak onto post rows.
- `POST /api/posts` + `PUT /api/users/me` — when client sends `data:image/...;base64,…` it's uploaded to Cloudinary on the request thread and the field is rewritten to the secure URL BEFORE persistence.
- Removed `image_data_url` from the Pydantic models `Post`, `CreatePostRequest`, and `CarouselSlide` (wire payload audit confirms zero leaks).
- One-off migration `/app/backend/scripts/migrate_images_to_cloudinary.py` — uploaded 7 users + 3 posts to Cloudinary in this session. Now idempotent: corrupt-padding photos auto-clear so future re-runs report 0.

### Frontend
- `FeedPage` — paginated infinite scroll (page size 10) via `IntersectionObserver` on `data-testid='feed-sentinel'`. Explicit `feed-load-more` and `feed-end` markers. StrictMode double-fetch guard via `firstLoadRef`.
- `lib/motionLazy.js` (NEW) — dynamic-import shim exposing `MotionDiv` / `MotionSpan` / `AnimatePresenceLazy`. framer-motion now downloads after first paint instead of blocking the FeedPage bundle.

### Ops
- `/etc/nginx/nginx.conf` — gzip block uncommented (vary, comp_level 6, full type list incl. JSON/JS/CSS/SVG). `nginx -t` clean, reloaded.
- `/app/deploy/nginx-gzip.conf` (NEW) — reference snippet for production deployment.

### Site map PDF
- `/app/frontend/public/Network-Capital-Sitemap.pdf` (7 KB, A3 landscape, brand-styled) downloadable at `/Network-Capital-Sitemap.pdf`. Generated by `/app/backend/scripts/generate_sitemap_pdf.py`. 7 colour-coded categories × 4-6 features each, every feature paired with its user-facing benefit.

### Testing
- Iter 58b: Backend **100% (10/10 pytest)**, Frontend **100%** (`/app/test_reports/iteration_58b.json`). Two minor observations from the test agent (StrictMode duplicate fetch + corrupt-padding migration loop) **both fixed in this same iteration**.


## Iter 58c (Feb 28, 2026) — Admin job-post bypass + user chronological sort

- **Free job posting for admins** — `POST /api/jobs` 402 paywall now exempts `role in ('admin', 'super_admin', 'moderator')`. UI: `CreateJobPage` and `JobsPage` both honour `isAdminRole`, so the "Unlock $50" gate is hidden and the **Post** button goes straight to `/jobs/new`. Replaces the old `is_admin` field check (which never existed on the user document).
- **User chronological sort** — `GET /api/admin/users-list` now accepts `sort=newest|oldest|name|score`. Default is `newest`. New indexes `users.created_at desc` + `users.network_score desc` added to the startup ensure-indexes hook.
- **AdminUsersPage UI** — new "Sort" select (`data-testid='admin-users-sort'`) with 4 options; each user row now shows a "Joined …" date (`data-testid='admin-user-joined-<id>'`) in localized short format.
- Verified live: super-admin POSTed a job with zero payment (200 OK); `?sort=newest` & `?sort=oldest` returned correct chronological pages.

