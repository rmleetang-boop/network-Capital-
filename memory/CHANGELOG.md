# Network Capital — CHANGELOG

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
