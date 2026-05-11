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
- **P1** Real domain on Resend (replace `onboarding@resend.dev`).
- **P1** Paystack (NGN/GHS/KES/ZAR) — needs user test keys.
- **P1** Carousel + Reels.
- **P2** Modularise `server.py` (>6,500 lines, blocked 5 iters).
- **P2** CI lint to fail builds on duplicate `@api_router.<method>(<path>)` strings (would have caught 3 dup-handler regressions in iter25 alone).
- **P2** Migrate base64 media to S3/R2.
- **P2** Lifespan handler replacing `@app.on_event`.
- **P2** TTL index on `db.otps.expires_at`.
- **P2** Auto-dismiss / click-outside on FeatureIntroModal.
- **P2** Mobile Agent rebuild (Expo + reuse FastAPI backend) — covered separately.
- **P3** Capacitor wrap, Driver Pool.

## Testing
- iter22: 38/40 cumulative regressions.
- iter23: 18/18 Jobs+Resend.
- iter24: 4/4 retest fixes.
- iter25 / iter26 / iter27: 23/23 backend tests (Places + Network + Job-reactions + Admin + regressions) — FRONTEND smoke verified for avatar upgrade, /network 3-card layout, /admin bootstrap CTA. Full Playwright e2e on UI authenticated flows deferred (data-testid coverage now complete).
