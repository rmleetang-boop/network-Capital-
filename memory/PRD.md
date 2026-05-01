# Network Capital - Product Requirements Document

## Original Problem Statement
Build a mobile-first prototype for a social network called Network Capital where users build a Network Score representing their contribution and influence. The app includes a "Reward-Based Stokvel Engine" (community savings groups) with strict compliance rules. Subsequent iterations introduced a Business/Creator layer (products, audience insights, net worth) and Regional Hubs with 3-type Connections + rich profile media.

## Compliance Rules (STRICT)
- NO words: invest, investment, returns, profit, profit-sharing, interest (financial), guaranteed
- ALLOWED: support, backing, contribution, participation, rewards, access, allocation, boost
- Smart Access = "early access to pooled funds"
- Rewards are activity-based incentives, not guaranteed income

## Tech Stack
- **Frontend**: React, Tailwind, shadcn/ui, Framer Motion, lucide-react
- **Backend**: FastAPI (Python), Pydantic v2
- **Database**: MongoDB
- **Auth**: JWT-based local + progressive signup with intent

## Core Features

### Implemented ✅
#### Stokvel / Social / Rewards (P0)
- User Auth (classic + progressive 2-step), Feed, Wallet, Stokvel groups, Contributions
- Network Score (5-component algorithm) with Basic/Boosted/Premium tiers
- Score Dashboard, Rewards Page, Leaderboards, Smart Access API
- Onboarding (6 screens), Help Center (9 categories), Legal (T&C + Privacy + consent)
- Admin Dashboard at `/admin` (client password + backend `X-Admin-Password` header guard)

#### Business/Creator Layer (P0)
- Progressive 2-step signup with member/creator intent
- 5-step Product creation questionnaire, prelaunch product pages with 24-72h moderation
- Product Discovery list with search + category filter
- Public follower registration, wallet-based product support, group support from stokvel pool
- Audience Insights tiered paywall (Free / Basic $5 / Pro $15)
- Net Worth dashboard (wallet + stokvel + products + Network Value breakdown)

#### Regional Hubs & Connections (P0 — new in iteration 6)
- **Regional Hubs** at `/hubs` — city dropdown with 11 SA cities, member discovery, search by name/profession
- **3-type Connection requests** — Social / Financial (with Stokvel invite) / Professional, one-tap from hub user cards with live status indicators
- **Connections inbox** at `/connections` — 3 tabs × 3 sub-views (Inbox / Connections / Sent), accept/reject, status badges
- **Profile Media** — photos grid, videos list, articles (notes/short articles) with create/delete; max 3MB per asset, base64 storage in user document, capped at 50/20/100 entries respectively
- **Feed video posts** — Add Video tile in CreatePost modal, PostCard renders `<video controls>`
- **Profile fields** — city dropdown, profession, persisted via PUT /api/users/me
- **5-item bottom nav** (Feed, Hubs, Stokvel+, Products, Profile) + top-right overflow drawer (Connections, Wallet, Net Worth, Leaderboards, Help)

### Upcoming (P1)
- Smart Access UI (backend exists)
- Multi-signature wallet approval for Stokvel withdrawals
- Admin moderation UI inside `/admin` to approve pending products without curl
- Validate stokvel_id existence on financial connection requests
- shadcn `Select` for city picker (currently native `<select>`)
- Defensive `GET /users/me` reload after city PUT in RegionalHubsPage

### Future / Backlog (P2)
- Driver Pool extension (daily micro-contributions for ride-hailing drivers)
- Creator earnings/payouts panel
- Cloud media storage (S3/R2) — current base64-in-doc model will hit 16MB doc limit at scale
- Auth + rate limiting for public media GET endpoints (`/users/{id}/photos`, `/videos`, `/articles`)
- Modularize `server.py` (now ~2,400 lines) into `/app/backend/routes/{auth,users,hubs,connections,media,posts,stokvels,products,admin}`
- PWA manifest + Capacitor wrap for App Store / Play Store distribution

## API Endpoints
### Auth
- POST `/api/auth/login`, `/api/auth/signup` (classic)
- POST `/api/auth/progressive-signup`, `/api/auth/complete-profile`

### Users / Profile / Media
- GET `/api/users/me`, GET `/api/users/{id}` (returns extended fields: city, country, profession, photos, videos, articles)
- PUT `/api/users/me` (accepts username, bio, photo, city, country, profession, interests)
- POST/DELETE `/api/users/me/photos`, `/videos`, `/articles`
- GET `/api/users/{id}/photos|videos|articles` (public)

### Regional Hubs / Connections
- GET `/api/hubs/cities`, GET `/api/hubs/users?city=X` (auth)
- POST `/api/connections/request` `{to_user_id, type, message, stokvel_id?}`
- GET `/api/connections/inbox?type=…`, `/outbox?type=…`, `/connections?type=…`
- POST `/api/connections/{id}/accept`, `/reject`

### Posts / Feed
- POST `/api/posts` `{content, image?, video?}`
- GET `/api/posts`, like / comment / share endpoints

### Products / Creator
- GET/POST `/api/products`, GET `/products/my`, GET `/products/{id}`
- POST `/products/{id}/follow`, `/support`, `/unlock-insights`
- GET `/products/{id}/insights?tier=free|basic|pro`
- POST `/stokvels/{sid}/support-product/{pid}`

### Dashboard
- GET `/api/dashboard/net-worth`

### Admin (header `X-Admin-Password` required)
- GET `/api/admin/users`, `/admin/stats`, `/admin/users/{id}/details`
- POST `/api/admin/products/{id}/moderate?action=approve|reject`
- GET `/api/admin/products/pending`

## File Structure (key)
```
/app/
├── backend/
│   ├── server.py  (~2.4k lines — extended User model, hubs/connections/media endpoints)
│   ├── .env  (MONGO_URL, DB_NAME, CORS_ORIGINS, ADMIN_PASSWORD)
│   └── tests/
│       ├── test_creator_product_api.py  (16 tests — 100% pass)
│       └── test_hubs_connections_media.py  (31 tests — 100% pass)
├── frontend/src/
│   ├── App.js  (routes /hubs, /connections added)
│   ├── components/Layout.js  (5-item bottom nav + top overflow drawer)
│   └── pages/
│       ├── AuthPage.js  (progressive 2-step)
│       ├── FeedPage.js  (video posts)
│       ├── ProfilePage.js  (city/profession + media tabs + article modal)
│       ├── RegionalHubsPage.js  (NEW — city discovery + 3-type connect)
│       ├── ConnectionsPage.js  (NEW — 3 tabs × 3 sub-views)
│       ├── ProductListPage.js, CreateProductPage.js, ProductDetailPage.js
│       ├── AudienceInsightsPage.js  (creator tier paywall)
│       ├── NetWorthPage.js, AdminDashboardPage.js
│       └── … (Onboarding, Help, Legal, etc.)
└── memory/
    ├── PRD.md, test_credentials.md
```

## Testing Status
- Backend: 47 / 47 dedicated tests pass (creator: 16/16, hubs+connections+media: 31/31)
- Compliance scan: no forbidden financial terms in new pages
- Frontend smoke test: city auto-loads, 10+ users visible, connect badges render with status
- Pre-existing `tests/test_stokvel_api.py` unaffected by these changes (unrelated env-var test infrastructure issue)

## Known Issues / Deferred
- Public media list endpoints have no auth/rate limiting — fine for prototype, not production
- Media stored base64 inside user document — will hit 16MB MongoDB doc limit for power users
- `complete-profile` returns 422 instead of 400 for missing fields (FastAPI default)
- Native `<select>` in RegionalHubsPage causes a benign hydration warning (replace with shadcn Select)
- Backend file `server.py` has 4 pre-existing lint warnings (unused locals, f-string-without-placeholders) — not regressions from this iteration
