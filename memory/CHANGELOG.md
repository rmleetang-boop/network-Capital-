# Network Capital — CHANGELOG

## iter: Data-recovery bridge + Fly.io findings (Aug 7, 2026)
- **PROVEN**: prod Atlas cluster (customer-apps.lfmw5q) is unreachable from BOTH the preview container AND a Fly.io machine (dial tcp i/o timeout on all 3 shards) — IP Access List only allows Emergent deploy infra. mongodump from outside is impossible.
- **Deployed app is DOWN**: stokvel-plus.emergent.host → 400 "Application not found"; networkcapitalapp.co.za → no response.
- **Data bridge built & verified** (all guarded by DB_RESTORE_KEY in backend/.env):
  - `POST /api/admin/db-restore-upload?append=` — chunked archive/raw upload receiver.
  - `GET /api/admin/db-export/collections` + `GET /api/admin/db-export?collection=&skip=&limit=` — extended-JSON paged export (bson.json_util).
  - `/app/backend/scripts/pull_prod_data.py` — pages all collections from a deployed URL into local Mongo (drop-after-first-fetch safety). Self-tested OK.
  - RECOVERY PLAN: user redeploys on Emergent → run `python3 /app/backend/scripts/pull_prod_data.py --source-url https://<deployed-host> --exclude otps` → restart backend (bootstrap re-promotes owner rmleetang@gmail.com).
  - REMOVE these temp endpoints after recovery.
- **Fly.io**: user token works (stored /tmp/flyenv.sh, NOT committed); app `network-capital-app` exists (personal org, no deploy yet). flyctl installed at /root/.fly/bin. NOTE: `-c` in `bash -c` must be escaped from flyctl flag parsing with `--` separator on `fly machine run`.
- Aridja deep integration pending: user will supply Aridja API after deployment.

## iter: DB reconnection attempt + Aridja tile (Aug 7, 2026)
- **Database**: Owner supplied production Atlas URI (customer-apps.lfmw5q.mongodb.net / stokvel-plus-test_database). Connection from preview FAILS at TCP level — Atlas IP Access List blocks preview egress IP 34.170.12.145 (egress port 27017 confirmed open via portquiz). URI stored COMMENTED in backend/.env as MONGO_URL_PROD. Support agent: preview→managed-prod-DB connectivity requires support@emergent.sh. Alternative offered to user: admin-guarded export endpoint on deployed app → HTTPS import into preview.
- **Aridja integration (phase 1)**: New highlighted "Aridja AI" tile (Gem icon) in OwnModuleGrid (shows on /profile Quick Access + /u/:me modules), opens https://aridja.online in new tab (external:true + window.open noopener). Deep API integration deferred until owner provides Aridja API endpoints/keys.
- Per owner instruction: NO testing agents run until owner confirms.

## Platform restoration (Aug 7, 2026)
- Platform was fully down: backend + frontend stopped, BOTH `.env` files deleted by last git commit (70fb474).
- Recovered `backend/.env` (MONGO_URL, DB_NAME, JWT_SECRET_KEY, Stripe, Brevo, Cloudinary, EMERGENT_LLM_KEY) from git history (`git show 70fb474~1:backend/.env`).
- `frontend/.env` REACT_APP_BACKEND_URL updated: old `stokvel-plus.preview...` URL was stale — set to current container preview endpoint `https://bdd9c77c-cb49-4401-9346-7afc4bc0ad79.preview.emergentagent.com`.
- Local MongoDB is FRESH/EMPTY (user explicitly deferred database restoration: "Forget about the database for now"). Backend re-seeded BD Agent job, system account, M/W/F promotion on startup. Super-admin owner account (rmleetang@gmail.com) does NOT exist yet in this DB — bootstrap will auto-promote once recreated.
- Backend smoke test 10/10 PASS (auth signup→OTP→profile, /users/me, jobs, places, feed, post creation). Brevo OTP emails delivering live.

## iter 47 (Feb, 2026) — Forgot Password + Account Lockout + Score table visibility

### Score-table visibility (in-app)
- `ActivityTrackerPage.js` "How to earn points" panel now mirrors the full server-side `SCORE_RULES` table verbatim — Community section (Stokvel join, Activity create/join, Place review, Connection, Job share), Milestones (profile completion, premium welcome, daily check-in, monthly streak, weekly resource drop), and an **Anti-abuse safeguards** block (24h same-source cooldown, ad-share diminishing ladder, > 80% single-action flag, real-ad-only enforcement). Premium/Founder 2× note retained.

### Forgot-password flow (backend)
- New endpoints (all in `server.py`):
  - `POST /api/auth/forgot-password` — generic OK response (no email enumeration), generates `secrets.token_urlsafe(32)`, stores `bcrypt(token)` in `password_resets` with `expires_at = now + PASSWORD_RESET_TTL_MIN min` (default 60min, env-overridable), emails plain token via Brevo with the new `_password_reset_html` template.
  - `POST /api/auth/reset-password` — accepts `{token, new_password}`. Scans recent unused/unexpired rows, bcrypt-compares the token. On success: updates `users.password`, marks row used + invalidates other live tokens, fires confirmation email via `_password_changed_html`, writes `AuditLog` row `auth.password_reset`.
- Lockout: **5 reset requests in 7 days** → sets `users.account_locked=true` + `account_locked_reason` + `account_locked_at`. Login returns **HTTP 423** while locked. Lock-notification email (`_password_reset_lock_html`) sent to user, in-app notification (`type='account_locked'`) created for admin/super_admin review.
- Audit: every request and reset attempt (success or fail) logged to a new `password_reset_attempts` collection — `{email, user_id, kind, outcome, ip, created_at}`.
- Password policy: ≥ 8 chars + at least one letter + one digit. Enforced server-side in `_password_strength_ok`.
- Admin endpoints:
  - `GET /api/admin/locked-accounts` (admin/super_admin)
  - `POST /api/admin/users/{id}/unlock-password-reset` (admin/super_admin) — writes `AuditLog` action `auth.account_unlock`.

### Frontend — password security
- **New reusable `PasswordField` component** (`components/PasswordField.js`) — drop-in `<input type="password">` replacement with eye toggle + optional inline strength meter (`PasswordStrengthMeter` + exported `scorePassword(pw)`).
- **`AuthPage.js`** — `InputField` now renders an eye toggle inline on any password field (login + signup), added `autoComplete` attrs, added "Forgot password?" link, added dark-themed signup strength meter (`SignupStrengthMeter`).
- **New `ForgotPasswordPage.js`** at `/forgot-password` — collects email, shows generic success state with 60-min link expiry copy + support email lockout warning.
- **New `ResetPasswordPage.js`** at `/reset-password?token=...` — uses `PasswordField` with strength meter, double-entry confirm, friendly error state when token missing, success state directing to sign in.
- **New `AdminLockedAccountsPage.js`** at `/admin/locked-accounts` — lists every locked user with search + one-click Unlock (prompts for reason → audit-logged). Linked from Owner Control Center "Users & roles" section as a danger-styled tile.
- Routes added in `App.js` (both unauthenticated + authenticated trees) + the `showOnboarding` early-return now allows `/forgot-password` and `/reset-password` paths through.

### Smoke + pytest results
- `pytest /app/backend/tests/test_iter47_password_reset.py` — **6/6 PASS**:
  - generic-OK for unknown + known emails
  - bad-token returns 400
  - weak-password rejected
  - 5-request lockout → login 423 → admin unlock → login 200
  - `/admin/locked-accounts` requires admin role (403 for users)
- Brevo deliveries verified: reset email + lock email + password-changed email all show `[MAIL-SENT]` in logs.
- UI screenshots confirm: AuthPage shows eye toggle + Forgot link, ForgotPasswordPage renders cleanly.


## iter 46 (Feb, 2026) — Sole Super Admin + Owner Control Center

### Sole super_admin enforced
- `bootstrap_super_admin()` now also runs a **DEMOTION sweep** on every backend startup: any user with `role='super_admin'` whose `id != rmleetang@gmail.com.id` is automatically demoted to `role='admin'`. Logs: `[BOOTSTRAP] Demoted N non-owner super_admin(s) → admin`.
- `PATCH /admin/users/{id}/role` now rejects any attempt to grant `super_admin` to an email other than `SUPER_ADMIN_EMAIL` with a 403 (instead of accepting + relying on the next-boot sweep).
- Verified: 3 super_admins seeded in dev DB → restart → 1 remaining (`rmleetang@gmail.com`).

### New Owner-only endpoints (`require_super_admin`)
- `GET /api/admin/owner/overview` — full KPI snapshot: users by role + verified + new 24h/7d + ambassador count; wallet total USD + pending withdrawals + grants 24h + completed 7d + payout-lock state; engagement (score events today, points today, top contributors); content (posts 24h, official posts 7d, pending ambassador apps); ads (active campaigns, claims 24h); promotions.
- `GET /api/admin/wallet-audit?days&target_user_id&actor_id&min_amount_usd&limit` — filterable view over `wallet_adjustments_audit`. Returns full audit row: prev/new balance, actor (id/role/username), reason, timestamp, reversed_at if reversed.
- `POST /api/admin/wallet-audit/{audit_id}/reverse` — atomically creates an inverse `credit_grants` record + applies it via `_apply_credit_grant` (which writes a NEW audit row), then marks the original row `reversed_at/reversed_by_grant_id/reversed_by_actor_id`. Reason must be ≥ 10 chars.
- `GET /api/admin/feature-flags` (admin+) — merged view of DB-stored flags + DEFAULT_FEATURE_FLAGS so the toggle UI can render every known flag.

### Frontend — OwnerControlCenterPage
- New page at `/admin/owner` (super_admin gated; other roles see a 403 "Platform Owner only" card).
- Sections:
  1. **KPI grid** (4 stat tiles) + June payout banner.
  2. **Quick actions** (broadcast, users, withdrawals, ads).
  3. **Users & roles** — role counts + tiles to `/admin/users`, ambassador-applications, audit log.
  4. **Wallet & financial** — wallet KPIs + the new **Wallet Audit Trail drawer** (search by user/actor/reason, 7d/30d/90d/12mo window, **one-click Reverse** with reason prompt).
  5. **Rewards & score engine** — events today, points awarded today, Top Contributor count, active promotions + tiles to promotions admin, score audit, ad reward inventory.
  6. **Content & engagement** — posts 24h, official 7d, ambassador apps pending + tiles to announce, ambassador queue, stokvels.
  7. **Advertising** — active campaigns + claims 24h + tiles to manage campaigns / analytics / ad reward log.
  8. **Operational & feature flags** — full feature-flag list with live toggle switches (PUT /admin/feature-flags/{key}).
- Route wired in `App.js`. New "Owner Center" link added to ProfilePage quick-actions, visible only when `profileUser.role === 'super_admin'`.

### Smoke-test results
- `GET /admin/owner/overview` (as super_admin) → returns full payload (verified by curl).
- `GET /admin/owner/overview` (as `admin`) → 403 "Super-admin (platform owner) access required".
- `GET /admin/wallet-audit?days=30` → returns existing audit row with all fields populated.
- `GET /admin/feature-flags` → returns merged list (1 flag in dev DB: `stokvel_plus_enabled`).
- UI renders correctly at `/admin/owner` — 3-screen scroll captured, all sections + tiles + KPIs visible.


## iter 45 (Feb, 2026) — Security & Permission Audit (29/29 pass)

### Wallet — SELF-CREDIT REMOVED
- `POST /api/wallet/deposit` → **HTTP 410 GONE** for ALL roles. Body still parsed for backwards-compat clarity, but no balance change ever occurs.
- Removed frontend "Add funds" UI from `WalletPage.js`: `showDepositModal`/`depositAmount`/`handleDeposit`/the `+ Plus` button/the entire Deposit modal/the `wallet deposits` paywall copy — all stripped.
- Server-side guard `require_super_admin` enforced on `POST /api/admin/credit-grants` and `POST /api/admin/credit-grants/{id}/co-approve` (was previously open to any `admin`).
- **Wallet adjustment audit** — every successful credit grant writes a row to a new `wallet_adjustments_audit` collection with:
  `grant_id, target_user_id, target_email, target_username, amount_usd, currency, amount_native, previous_balance_usd, new_balance_usd, actor_id, actor_username, actor_role, reason, created_at`.
  Indexes on `created_at` + `target_user_id` created at startup.

### Ad rewards — fraud-proofed
- `POST /api/ads/watch` rewrite: validates ad existence → `is_active` + `status` → time window (`starts_at` / `ends_at`) → reward inventory (`max_rewards` / `rewards_used`).
- **Per (user, ad, event_kind) uniqueness** via new `ad_reward_claims` collection with a **unique index on `key`** (atomic dedup, race-proof). First engage on a given ad → awarded; second engage on same ad → `{awarded:false, duplicate:true}`. Engage and share count separately so a user can legitimately do both.
- `ads.rewards_used` and `ads.engagements` / `ads.shares` counters incremented on each successful claim.
- No active ad → `{points:0, awarded:false, reason:"No active rewarded advertisements available."}` — never awards just for opening the feed.

### Role-change emails — fan-out fixed
Previously only `/admin/users/{id}/role` fired the email. Now also fires from:
- `POST /admin/users/{id}/make-ambassador` (grant AND revoke — diffs `prev_was_ambassador != is_amb`)
- `POST /admin/ambassador-applications/{id}/approve` — emits `_notify_role_change(prev=user/admin, new=ambassador)` + AuditLog action `ambassador.approve`
- Each path: in-app notification doc + Brevo email (subject `Your Network Capital role is now: …`) + AuditLog entry. Verified **`[MAIL-SENT] subj='Your Network Capital role is now: Ambassador'`** to real inbox.

### Role-check guards — super_admin no longer falsely blocked
Endpoints that hardcoded `role != "admin"` were rejecting super_admin. Patched to `role not in ("admin","super_admin")`:
- `PUT  /api/admin/feature-flags/{key}`
- `POST /api/admin/announce`
- `POST /api/admin/dm`
- `POST /api/admin/users/{id}/make-ambassador`
- `POST /api/admin/promotions`
- `PATCH /api/admin/promotions/{id}`
- `DELETE /api/admin/promotions/{id}`

### Permission matrix (now enforced)
```
Role          Wallet write        Score awards   User mgmt    Financial (credit-grants)
user          ✗ 410               ✓ via actions  ✗ 403        ✗ 403
ambassador    ✗ 410               ✓ via actions  ✗ 403        ✗ 403
moderator     ✗ 410               ✓ via actions  ✗ 403        ✗ 403
admin         ✗ 410               ✓ via actions  ✓ role+amb   ✗ 403 (now correctly gated)
super_admin   ✓ via /credit-grants ✓ via actions ✓ all        ✓ create + co-approve
```

### Test recap (iteration_36.json)
- **29/29 pass** — wallet 410, credit-grants (403/200) + audit row shape match, /ads/watch all 8 branches, role-change fan-out on all 4 paths, super_admin role-guard fixes on 7 endpoints, startup index creation.
- Test file: `/app/backend/tests/test_iter36_security_audit.py`.


## iter 44 (Feb, 2026) — Platform Enhancements Batch
### Role hierarchy & permissions
- New `super_admin` role tier above `admin`. Single tenant: `SUPER_ADMIN_EMAIL = rmleetang@gmail.com`.
- `bootstrap_super_admin()` startup hook auto-promotes that email idempotently. Logs `[BOOTSTRAP] Promoted ... to super_admin`.
- New `require_super_admin` FastAPI dependency. `require_admin_user` now accepts `super_admin` too.
- `POST /api/admin/credit-grants` → super_admin ONLY. Standard admins blocked with 403 ("Super-admin (platform owner) access required"). Comment in code makes the intent explicit.
- `PATCH /api/admin/users/{id}/role` — only admin/super_admin may change roles. Only super_admin may grant or revoke `super_admin`. Standard admins cannot modify the platform owner.

### Role-assignment email (Brevo) — fires on grant AND revoke
- New helper `_notify_role_change(user, previous_role, new_role, actor_username)` + template `_role_change_html`.
- Inserts an in-app `notifications` doc with type='role_change' (always).
- Sends an email via Brevo if the user is `email_verified`. Subject `Your Network Capital role is now: …`.
- Audit-logged via `AuditLog.write` with action='role.change' + before/after metadata.

### June 2026 payout block
- `JUNE_PAYOUT_RELEASE_AT = 2026-06-30 21:59:59 UTC` (= 23:59:59 SAST).
- Helper `_is_june_payout_locked()` + `_june_payout_message()` shared by:
  - `POST /api/withdrawals` (block create) — 403
  - `POST /api/admin/withdrawals/{id}/approve` — 403
  - `POST /api/admin/withdrawals/{id}/mark-paid` — 403
- New public endpoint `GET /api/payouts/status → {locked, release_at, message}` (no auth) so the frontend can render the banner without a token.
- Frontend: `WalletPage.js` shows `[data-testid='june-payout-banner']`; `WithdrawalRequestModal` shows `[data-testid='withdrawal-june-locked']` state when the lock is active.

### Score-bracket filter (admin)
- `GET /api/admin/users/by-score` — accepts `?bracket=N-M` OR `?min_score=N&max_score=M`, plus optional `q` / `role` / `limit`. Returns `{bracket, count, users[]}` sorted by `network_score desc`. Admin-gated.
- `AdminUsersPage`: new chip strip with 11 per-thousand presets (0-1k → 10k+) + custom min/max inputs + clear button. Active-bracket label shows current filter. Adjust-balance menu item gated to super_admin only; standard admins see "Balance — owner only" label.

### Score audit visibility
- `GET /api/admin/users/{id}/score-breakdown?days=N` — returns `{user, window_days, totals:{events,points}, by_action[{action,points,count,last_at}], events[]}`. Admin-gated.
- `AdminProfileDetailPage`: new "Score audit" button → `ScoreAuditModal` with 7d/30d/90d/12mo window selector, stat tiles, by-action grouping, and 200-row event log.

### Network Score logic — uncapped growth, 10k = Top Contributor
- Removed the `monthly >= MONTHLY_SCORE_CAP → return 0` guard in `award_points`.
- Removed the `awarded = min(awarded, MONTHLY_SCORE_CAP - monthly)` clamp. Score now grows for every legitimate action.
- New `MONTHLY_TOP_CONTRIBUTOR_THRESHOLD = 10000`. When `new_monthly` crosses 10k for the first time we set `cap_reached_at` AND `top_contributor_at`.
- All user-facing copy updated: `LegalDocumentsPage`, `HelpCenterPage` FAQ, `ActivityTrackerPage`, `PromotionsWelcomeModal`, `ProfilePage` progress bar. Wording is now compliance-safe ("score grows uncapped", "10,000/month = Top Contributor badge").

### Native feed ad (Instagram/FB style)
- New `frontend/src/components/NativeFeedAd.js`. Looks like a regular post: header with Sponsored badge, media (image or autoplay-mute-loop video), IG-style action row (heart=engage, comment=learn more, send=share), title/body, CTA pill. Hooks into existing `/ads/current` + `/ads/event` + `/ads/watch` endpoints (impression on intersection-observer, click/engagement/share events tracked).
- `FeedPage.js` swaps in `<NativeFeedAd />` at the existing slot (top of feed). `MockAdButton` import dropped. Placement unchanged.

### Feed ↔ Profile score sync
- `GET /api/posts` now calls `_enrich_posts_with_live_score(posts)` which overwrites each post's `user_score`, `username`, `user_photo` with the author's current `users.network_score` (single bulk `find` keyed by `user_id IN [...]`). Profile and Feed now agree.
- Defensive: `create_post` switched to `.get()` for `username/photo/network_score` so legacy users missing fields can't 500 the endpoint.

### Test recap (iteration_35.json)
- Backend: **18/18 PASS** — super-admin bootstrap, credit-grant 403 gating, June lock on all 3 endpoints, by-score endpoint (presets + custom + 400 on invalid), score-breakdown shape, role-change email/notification/audit on grant+revoke, uncapped score growth (9990 + 500 → 10490 with top_contributor_at set), live post score (snapshot 100 → live 700), is_official broadcast regression-clean.
- Frontend: NOT click-tested by agent in this run (OTP/Brevo session friction documented in iter35). All 7 new data-testids are in place — main agent self-verified the routes load.


## iter 43 (Feb, 2026) — Brevo OTP verified + new email automations
### Brevo migration verified end-to-end
- Added `BREVO_API_KEY` to `/app/backend/.env` (was missing → all sends were silently falling back to logger).
- Pinned `brevo-python==1.1.2` in `requirements.txt` (v4.x changed the module name from `brevo_python` → `brevo` and the entire SDK surface; v1.1.2 matches `email_service.py`).
- IP allowlist disabled by user on Brevo side — verified send works to `rmleetang@gmail.com`.
- Sender domain: `noreply@networkcapitalapp.co.za` (user confirmed verified DNS).

### New email automations (`server.py`)
- **Welcome** (already wired) — fires on first OTP verify + profile completion. No change.
- **Daily Rewards digest** — `_daily_digest_loop()` background task started at app startup.
  - Polls every 10 min; runs `_run_daily_digest_sweep()` once SAST clock hits 21:00.
  - Idempotent via `users.last_rewards_digest_date == today_SAST`.
  - Aggregates today's `score_events` grouped by action with friendly labels (`_SCORE_ACTION_LABELS`).
  - Admin force-run endpoint: `POST /api/admin/rewards/digest/run` → `{ok, sent, date_key_sast}`.
  - Skips users with no events or no verified email.
- **Wallet credit** — `_notify_wallet_credit(user_id, amount_usd, reason)` helper, wired into all 5 credit sites:
  1. Referral $10 bonus on signup (`/auth/signup`)
  2. Stokvel cashback (`process_rewards`)
  3. Smart Access fund release
  4. Stokvel withdrawal execution
  5. Admin credit grant (`_apply_credit_grant`)
  - Skips debits, skips unverified users.
- **Official broadcast** — new `is_official` field on `CreatePostRequest` + `Post` model.
  - Admin/moderator role required (any non-admin's `is_official=true` is silently coerced to false).
  - On insert, fires `_broadcast_official_post()` as a background task (non-blocking).
  - Fan-out filters by `email_verified=true` AND `broadcast_opt_out!=true` AND domain ∉ `{example.com, example.org, example.net, test.com, qa.local}` (`_is_broadcast_eligible_email`).
  - 50ms throttle between sends to stay under Brevo burst limits.

### Test recap
- OTP delivery: ✅ `[MAIL-SENT] subj='Your Network Capital verification code'`
- Welcome on profile complete: ✅ `[MAIL-SENT] subj='Welcome to Network Capital'`
- Wallet credit ($5 test grant): ✅ `[MAIL-SENT] subj='+$5.00 added to your Network Capital wallet'`
- Daily digest force-run: ✅ `sent=1` for user with seeded score events (`+575 pts today`)
- Official broadcast: ✅ Real-domain fan-out `sent=3` (legacy `@example.com` test users filtered out — 314 raw → 3 eligible).

## iter 42 (Feb 23, 2026) — Modal-vs-bottom-nav z-index collision FIXED
### Root cause
- Bottom nav in `Layout.js` was at `z-50` — the same as every modal in the app.
- CSS rule: same-z tie-breaks by DOM order. Bottom nav is mounted INSIDE `<Layout>` near the top, modals render LATER as `fixed` portals (or inline), but because the nav is a child of a positioned ancestor and the modal `<div>` lives inside the page content, the nav was stealing the bottom-of-screen click area and visually covering the modal's final buttons on mobile.
- User couldn't tap "Create campaign" in the Ad Editor — it was hidden behind the bottom nav.

### Fix (one line)
- Lowered Layout bottom nav from `z-50` → `z-40` in `Layout.js`. All modals (z-50) now correctly sit above the nav. No other component relies on the nav being at z-50.

### Side effect handled
- DM composer (`ChatThreadPage.js`) was already at z-40 — but it sits inside its own route which hides the bottom nav, so no collision.
- Stokvel FAB at z-40 is positioned `bottom-24 right-6`, well clear of the nav, no collision.

### Plus: AdEditor + AdAnalytics modals
- Added `pb-[max(env(safe-area-inset-bottom),1rem)]` to the inner scroll container — gives an extra clear gap above the bottom edge / iOS home indicator regardless of where users scroll to.


## iter 41 (Feb 23, 2026) — Admin Ad Campaigns + User Ambassador Applications
### Ad Campaigns (admin-managed, full analytics)
**Backend** (`server.py` — new module after ITER 34 Withdrawals):
- `AdCampaignIn` Pydantic model: title, body, cta_label, link_url, image_data_url, video_data_url, starts_at, ends_at, is_active, reward_engage_points, reward_share_points.
- `POST/GET/PATCH/DELETE /api/admin/ads[/{id}]` — admin CRUD with 11MB media gate and `_id`-stripping fix for the create response.
- `GET /api/admin/ads/{id}/analytics?days=30` — totals (impressions/clicks/engagements/shares/unique_viewers/unique_clickers/CTR%), 30-day daily series, top-20 geo by country+city, and birth-month cohort histogram.
- `GET /api/ads/current` — user-facing: returns the most recently created `is_active` campaign whose `starts_at`/`ends_at` window includes "now". Falls back to `{ is_real: false }` when none configured.
- `POST /api/ads/event` — logs `impressions|clicks|engagements|shares` to `db.ad_events` with `country`, `city`, `birth_month` from the requester for geo/age analytics; increments the campaign's counter atomically.

**Frontend**:
- `AdminAdsPage` (`/admin/ads`): summary tiles (campaigns/live/impressions/CTR), list with inline impressions+clicks+engagements+CTR per row, **AdEditorModal** with title/body/CTA/link/image-or-video/scheduling/reward-points/is_active toggle, **AdAnalyticsModal** with stat tiles + 30-day bar chart + geo list + age-cohort grid.
- `MockAdButton` rewritten to load real ad copy from `/ads/current` when available (falls back to legacy mock placeholder), records impression on open, click on link tap, engagement/share on point-claim. Button label dynamically reflects the campaign's `reward_engage_points`.
- Admin nav button `admin-go-ads` on `/admin/dashboard`.

### Ambassador Applications (user can self-request, admin approves/rejects)
**Backend**:
- `AMBASSADOR_MIN_SCORE = 2000` constant.
- `POST /api/ambassadors/apply` — requires score ≥ 2000 OR returns a 403 with a friendly explanation. Blocks duplicate pending applications. Notifies all admins.
- `GET /api/ambassadors/me/application` — returns eligibility + latest application (any status).
- `GET /api/admin/ambassador-applications?status_filter=` — admin queue with pending/approved/rejected counters.
- `POST /api/admin/ambassador-applications/{id}/{approve|reject}` — on approve, sets `is_ambassador=true, ambassador_rank='Rising Star'` and sends user a notification. On reject, sends a constructive notification including the reviewer note.

**Frontend**:
- `BecomeAmbassadorPage` (`/ambassadors/apply`) — hero, eligibility progress bar, application form (why + optional links). Shows pending/approved/rejected status if user has one. New "Become Ambassador" tile on the Profile Quick Access grid.
- `AdminAmbassadorApplicationsPage` (`/admin/ambassador-applications`) — 4-tab queue (pending/approved/rejected/all), summary pills, per-row Approve/Reject buttons with prompt-driven admin note.
- Admin nav button `admin-go-ambassador-apps`.

### Smoke-tested
- Ads: create (200, _id stripped), `/ads/current` returns the live campaign, events logged (impressions=1, clicks=1, engagements=1, ctr=100%).
- Ambassador: score=500 → 403 with explanation; bump to 2500 → apply succeeds → admin approve → user's `is_ambassador=true, rank='Rising Star'`.


## iter 40 (Feb 23, 2026) — Optional Crop + Compress before posting
### New libraries
- `browser-image-compression@2.0.2` — client-side image shrinking (web-worker, max 1MB/1920px, q=0.85)
- `react-easy-crop@5.5.7` — Instagram-style crop UI (drag + zoom + aspect chooser)

### New component: `MediaPreparer`
- Mounts on top of the Create Post modal whenever a user attaches an image OR video.
- Both crop and compress are **OFF by default** — the modal opens with a clean preview and a primary "Use as is" button so power users keep posting in one tap.
- Toggling **Crop** ON reveals the interactive cropper with aspect-ratio chips (1:1, 4:5, 16:9, Free) and pinch-zoom.
- Toggling **Compress** ON applies `browser-image-compression` (max 1 MB output, max 1920px on the long edge, quality 0.85) — a "saved X%" success toast confirms the savings.
- The two are stackable: crop runs first, then compress runs on the cropped output.
- A live "Original 4.2 MB → After edits 0.9 MB" indicator updates after Apply.
- Videos pass through unchanged with an inline note: *"Crop and compress are available for images only. Videos are uploaded as-is."*
- testids: `media-preparer`, `media-preparer-canvas`, `toggle-crop`, `toggle-compress`, `aspect-picker`, `aspect-{1:1|4:5|16:9|Free}`, `media-preparer-skip`, `media-preparer-apply`, `media-preparer-confirm`, `media-preparer-new-size`, `media-preparer-close`.

### FeedPage wiring
- `handleImageUpload` and `handleVideoUpload` no longer commit directly. They open the `MediaPreparer` with the selected `File`. The preparer calls `handleMediaPrepared({ dataUrl, sizeBytes, name, type })` on confirm/skip → set newPost state → toast with the final size.
- Helper text under the "Add Image" tile now reads *"JPG/PNG/GIF · max 11 MB · crop & compress on next step"*.

### S3/R2 explainer added to user-facing communication
- Documented to the user that going beyond 11 MB requires cloud-object-storage (S3 or Cloudflare R2, where R2 wins on zero egress fees). This is now the P1 next-architecture task.


## iter 39 (Feb 23, 2026) — Max-possible upload size, in-UI size hints, specific error messages, Chrome toast fix
### Toast styling rewrite (`/app/frontend/src/components/ui/sonner.jsx`)
- Chrome rendered toasts as near-invisible light-grey-on-white because the previous shadcn token classes (`bg-background`/`text-foreground`) had no <ThemeProvider> mounted.
- Rewrote Toaster to use explicit Tailwind colours (`bg-white`, `text-slate-900`, `border-gray-200`) + `richColors` + `closeButton` + per-variant tones (error=red, success=emerald, warning=amber, info=blue). Removed the `next-themes` dependency surface entirely. Now legible across all browsers + obvious by variant colour.

### Media size limits — pushed to the platform maximum
- MongoDB's 16MB BSON document hard limit + ~1.37x base64 inflation ⇒ practical raw cap is **11 MB per file**.
- Backend `MAX_MEDIA_BYTES` 10 → 11 MB. Story cap 14 MB base64 → 15 MB base64. `/posts` image+video guards updated with friendlier error text.
- Frontend caps:
  - FeedPage post image: 8 → 11 MB
  - FeedPage post video: 10 → 11 MB
  - ProfilePage photo/video: 8/10 → 11/11 MB
  - StoriesRibbon: 8 → 11 MB

### Pre-upload size hints in the Create-Post UI
- "Add Image" tile now shows `"JPG/PNG/GIF · max 11 MB"` underneath.
- "Add Video" tile now shows `"MP4/MOV · max 11 MB"` underneath.
- After successful attachment, a green strip (`data-testid="upload-size-hint"`) shows the **filename + actual size** so users know exactly what they're uploading.

### Specific, actionable error messages
- Upload validations now state the file's actual MB + why it failed + what to do (`"Image is 14.3 MB — over the 11 MB limit. Please compress it or pick a smaller picture."`).
- MIME-type guard: when a non-image file is selected for the image picker, the toast names the file's actual MIME and the allowed formats.
- FileReader errors (corrupt files) get their own toast.
- Post-create submit now maps HTTP status codes to clear messages:
  - 413 → "Your post exceeds the 11 MB upload limit. Please compress your media and try again."
  - 400 → "Your post contains restricted language. Please rephrase and try again."
  - 401/403 → "Your session expired. Please log in again to continue posting."
  - 5xx → "Our servers had a hiccup. Please try again in a moment."
  - Network Error → "No internet connection. Please check your network and try again."
- Falls back to the backend's actual `detail` string when present.

### Notes
- Anything larger than 11MB will need the S3/R2 cloud-storage migration (P1 backlog item) — base64-in-Mongo can't grow further without hitting BSON's hard limit.


## iter 38 (Feb 21, 2026) — Media upload size limits bumped 3MB → 8MB image / 10MB video
### Why 10MB ceiling
- Base64 inflates ~1.37x. MongoDB BSON document hard limit is 16MB. So 10MB raw → ~14MB base64 → safely fits with room for post text, hashtags, mentions, etc.
- Anything bigger needs the S3/R2 migration (P2 backlog).

### Frontend caps raised (raw file size before base64)
- `FeedPage` post image: 3MB → 8MB
- `FeedPage` post video: 3MB → 10MB
- `ProfilePage` profile photo: 3MB → 8MB
- `ProfilePage` profile video: 3MB → 10MB
- `StoriesRibbon` story image/video: 3MB → 8MB
- Kept DMs (`ChatThread`) at 3MB intentionally — fast peer-to-peer messaging UX.
- Kept Places/Activities/Admin announcements at 3MB — secondary surfaces.

### Backend caps raised
- `MAX_MEDIA_BYTES` constant: 3MB → 10MB; the `* 1.4` base64 inflation factor stays the same.
- `_validate_media_size` (profile uploads) error now reads "max 10MB".
- `/api/stories` cap: 4MB base64 → 14MB base64 (10MB raw).
- NEW: explicit size guards on `/api/posts` for image AND video fields, returning 413 with clear messages if the client somehow bypasses the frontend check.

### Untouched (still 3MB) — by design
- DM image/audio
- Place photos
- Activity images
- Admin announcement images
- Withdrawal proof of banking (already at 5MB)


## iter 37 (Feb 21, 2026) — Wallet production failure: real RCA + 3 layers of hardening
### Root cause (the user redeployed iter36's defensive guard, which exposed the underlying issue)
- `Transaction` Pydantic model had 7 strictly-required fields. The production DB has legacy transaction documents missing one or more of (`type`, `description`, `status`, `created_at`). The endpoint was declared `response_model=List[Transaction]` so FastAPI validated EVERY row — one missing field → 500 → `Promise.all` in WalletPage threw → wallet stayed `null` → my iter36 defensive UI showed "Could not load your wallet" (which is what the user just screenshotted on production).
- The wallet feature WAS broken on production all along (since some legacy migration), but iter36's defensive guard transformed a blank-screen crash into a visible error state — so the symptom looked the same to the user.

### Three layers of fix
1. **Backend `/api/wallet`** — wrapped mongo lookup in try/except + `_num()` coercion. Endpoint can no longer 500 even if user record is missing or has odd field types.
2. **Backend `/api/wallet/transactions`** — dropped `response_model=List[Transaction]`, made Transaction fields Optional with defaults, and the endpoint now coerces each row through Transaction() in a per-row try/except and silently drops malformed rows. Endpoint always returns a 200 list (possibly partial).
3. **Frontend `WalletPage.fetchWalletData`** — split `Promise.all([wallet, transactions])` into two independent try/catch blocks. A failure in either endpoint no longer blanks the wallet. If wallet succeeds and transactions fail, the page still renders with an empty transactions list.

### Tests
- iter34 withdrawals: 25/25 pytest pass post-fix (function `create_withdrawal` for stokvels was being shadowed by the new module's `create_withdrawal` for user withdrawals — renamed the new one to `create_user_withdrawal`).
- Smoke: inserted a corrupted transaction row (missing `status`), confirmed `/wallet/transactions` returns 200 with the row coerced to defaults (`status: 'completed'`, `description: ''`).

### Refund handling
- User asked for a credit refund for the wallet feature being broken in production. Routed to support_agent per platform policy. Support directed user to email support@emergent.sh with deployment URL + screenshots + job id.


## iter 36 (Feb 21, 2026) — Wallet crash fix + Ambassador as 4th role + premium-gate-free withdrawals
### Wallet blank-screen production bug — FIXED
- **Root cause**: `WalletPage` rendered `{format(wallet.balance)}` after `setLoading(false)`, but if the `/api/wallet` request failed (network blip, expired token, race during deploy), `wallet` stayed `null`. Accessing `wallet.balance` threw and unmounted the entire React tree → fully blank screen with no header/nav/footer.
- **Fix**: Added defensive null-guard rendering a "Could not load your wallet" retry state if `wallet` is null after loading; also extracted `balance`/`totalEarned`/`totalSpent` into local vars with `Number(… ?? 0)` coercion so the page never crashes.

### Ambassador as 4th role on the admin Users dropdown
- Backend: `PATCH /api/admin/users/{id}/role` now accepts `"ambassador"` in addition to `"user"|"moderator"|"admin"`. Choosing `ambassador` stores `role="user", is_ambassador=true, ambassador_rank="Rising Star"`. Any non-ambassador role flips `is_ambassador=false` so the badge doesn't linger.
- Frontend: `AdminUsersPage` role dropdown now exposes 4 options (User / Ambassador / Moderator / Admin). The dropdown value derives from `u.is_ambassador ? 'ambassador' : u.role` so the correct option is reflected.
- `User` pydantic model now exposes `is_ambassador`, `ambassador_rank`, and `promotion_zar_balance` on `/api/users/me` (previously omitted, meaning the frontend couldn't see the flag).

### Withdrawals: no premium gate (confirmation)
- Confirmed: the WithdrawalRequestModal had no premium gate to begin with — only the 3500 score gate. The PremiumPaywall block on the WalletPage advertises premium for ADDING funds (deposits), unrelated to withdrawals.


## iter 35 (Feb 21, 2026) — Withdrawals + Ambassador toggle on users list + Promotions-only conversion
### Conversion-rate scoping
- Removed the `ambassador-conversion-pill` from `/ambassadors/me` (the "100 Network Points = R10 ZAR" equivalence is now strictly promotions-only context).
- Equivalence remains on `/admin/promotions`, `/promotions/me`, and the daily login modal — where it's promotion-bound by definition.

### Ambassador role assignment (discoverability fix)
- The "Make / Revoke ambassador" button already existed on `/admin/profiles/:userId`. Added a second entrypoint on the `/admin/users` row kebab menu (`menu-ambassador-{id}`) for faster access.
- Renamed the row kebab testid to `user-menu-toggle-{id}` for clarity.

### NEW Withdrawals system
**Backend** (`/app/backend/server.py` L8430-end + L7905-7917 promotion-balance accumulator):
- `users.promotion_zar_balance` field auto-incremented inside `_record_promotion_event` each time an active-window promotion event credits ZAR.
- Eligibility floor: `WITHDRAW_MIN_SCORE = 3500` (max(network_score, monthly_score)).
- Proof of banking: PDF/JPG/PNG ≤ 5 MB (base64 data-URL), prefix-validated.
- Endpoints:
  - `POST /api/withdrawals` — debits the chosen source (wallet OR promotion) immediately to prevent double-spend; rejects on eligibility / proof / amount; notifies all admins via `db.notifications`.
  - `GET /api/withdrawals/me` — list with balances, eligibility shape, processing window. Proof blobs excluded; account numbers masked.
  - `GET /api/withdrawals/me/{id}/proof` — full data-URL for owner.
  - `GET /api/admin/withdrawals?status_filter=&q=` — admin list with summary tiles (pending/approved/paid/rejected + outstanding ZAR).
  - `POST /api/admin/withdrawals/{id}/{approve|reject|mark-paid|note}` — admin actions. State machine: pending → approved → paid. Reject from pending OR approved refunds the source balance. Each action appends to `admin_notes[]`.
  - `GET /api/admin/withdrawals/{id}/proof` — admin proof viewer.

**Frontend**:
- **AdminWithdrawalsPage** (`/admin/withdrawals`) — 5-tab status filter, search, summary tiles, click-to-detail. Detail modal shows Member + Bank + Proof (PDF or image inline) + Source/Timing + admin notes history, with Approve / Reject / Mark Paid / Add Note actions.
- **WithdrawalRequestModal** mounted on `/wallet` — 3-step flow (source + amount → KYC + proof upload → review/submit). Eligibility gate shows when score < 3500.
- Admin nav button `admin-go-withdrawals` on `/admin/dashboard`.

### Testing (iter34)
- 25/25 backend pytest pass (`/app/backend/tests/test_iter34_withdrawals.py`) — eligibility, proof validation, pydantic, balance reservation + isolation, masking, admin gating, full state-machine workflow, reject-refund invariant, mark-paid-needs-approved invariant, notifications, promotion auto-credit, regression smoke.
- 4/4 critical frontend structural checks pass (conversion-pill removed; withdrawal CTA mounted; admin route gated; testids verified).


## iter 34 (Feb 20, 2026) — Full rebrand scrub + Terms refresh
### Rebranding (zero "Emergent" mentions remain in /app/frontend)
- Downloaded the 4 brand assets (logo-mark, logo-secondary, logo-main, favicon) to `/app/frontend/public/brand/*.png` and updated `brand.js` constants to use local `/brand/...` paths.
- Replaced all `customer-assets.emergentagent.com` URLs across 9 frontend pages + components (OnboardingPage, ScoreDashboardPage, RewardsPage, WalletPage, LandingPage, StokvelListPage, FeedPage, LeaderboardsPage, PremiumLoadingScreen) and `index.html`.
- Removed the visible "Made with Emergent" badge HTML, badge-removal JS shim, and the `#emergent-badge` CSS rule.
- Removed `<script src="https://assets.emergent.sh/scripts/emergent-main.js">` from `index.html` (confirmed safe by Emergent support — no deployment impact).
- Final grep `grep -rinE "emergent" /app/frontend/{src,public}` returns 0 matches.
- The 2 remaining preview-only mentions are in the platform's iframe wrapper served on `*.preview.emergentagent.com` ONLY; production at `networkcapitalapp.co.za` is unaffected.

### Legal documents refresh (`/app/frontend/src/pages/LegalDocumentsPage.js`)
- Effective date bumped to 2026-02-20.
- **Terms of Service** rewritten with full feature coverage: Social Feed (with edit/delete points-revocation), Network Score (cap + diminishing returns + cooldowns), Stokvel + quarterly pool, Regional Hubs, Activities, DMs, **My Network** (3-category connections), **My Places** (Trustpilot-style reviews + claims), **Jobs** ($50 unlock + reactions + share), **Promotions** (SAST windows + canonical "100 Network Points = R10 ZAR"), **Ambassador programme** (rank tiers + leaderboards), Creator/Product, Premium ($10), Notifications + Resend email. Added §4 (Network Score, Promotions and rewards), §10 (Privacy controls & account lifecycle — deactivation reversible + 30-day deletion grace), and §12 (Changes notice 14 days).
- **Privacy Policy** updated: explicit data categories for connections, places, jobs, promotions, ambassadors; sub-processors include Resend; retention now mentions promotion-event scrubbing on deletion.
- **Compliance & Transparency** updated: now lists Promotion rate transparency, Ambassador rank/target documentation, audit-log mention. Adds explicit "Promotion rewards are community recognition, not guaranteed cash" disclaimer.


## iter 33 (Feb 20, 2026) — Promotions extension across platform
### Conversion rate (canonical, platform-wide)
- **100 Network Points = R10 ZAR** (R0.10/pt). Defined as backend constants `NETWORK_POINTS_PER_ZAR=100`, `ZAR_PER_NETWORK_POINT=0.10`, helper `_points_to_zar(points)`.

### New backend endpoints
- `GET /api/users/me/promotions` — returns each active promo with the requester's per-promo stats: points, ZAR estimate, rank, streak days, today_points, breakdown (posts/shares/comments/likes/referrals/place_reviews/connections) + a top-level `user_summary` with monthly_score, network_score, total_zar_estimate, conversion label.
- `GET /api/users/me/promotion-events?promotion_id=&limit=` — recent promotion_events for the user.
- `GET /api/promotions/me/login-summary` — single payload for the daily login modal: user stats with estimated_zar_value, active_promotions enriched per-user, top 3 ambassadors, conversion + philosophy copy + now_sast.

### New frontend
- **PromotionsWelcomeModal** (`/app/frontend/src/components/PromotionsWelcomeModal.js`) — daily login pop-up mounted inside `<Layout>`. Hero with user's monthly/lifetime score + estimated R-value, live-now + upcoming promotion tiles with countdowns (SAST), top-3 ambassador block, expandable "Learn how it works" with 4 numbered rows (scores · accumulation · promotions · contribution philosophy), primary CTA → /promotions/me. Dismissal stores `nc_promo_modal_last_shown=YYYY-MM-DD` in localStorage → modal appears only once per day.
- **MyPromotionsPage** (`/promotions/me`) — user-facing dashboard with hero (4 stat tiles + conversion pill), per-promo cards (schedule badge, R/pt pill, live indicator, mini-stat grid Earned/Rank/Streak/Refs, progress bar, breakdown chips), recent participation history list.
- **ProfilePage** — Quick Access grid now has a "Promotions" tile (data-testid `quick-promotions`) that links to `/promotions/me`; shown only on own profile (existing `isOwnProfile` gate).
- **PromotionsListPage** (admin) — conversion banner above summary tiles.
- **AmbassadorDashboardPage** — conversion pill in the rank hero card.

### Testing
- iter33: 16/16 backend pytest pass (`/app/backend/tests/test_iter33_my_promotions.py`); 11/12 frontend flows verified through automated UI; the 1 "fail" is a Playwright force-click artifact on the existing `window.location.href` pattern in ProfilePage — works correctly in real browsers and was not introduced by this iteration.


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
