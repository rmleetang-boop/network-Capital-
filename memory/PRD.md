# Network Capital - Product Requirements Document

## Original Problem Statement
Build a mobile-first prototype for a social network called Network Capital where users build a Network Score representing their contribution and influence. The app includes a "Reward-Based Stokvel Engine" (community savings groups) with strict compliance rules (no credit provider, no guaranteed returns language). Additionally, a "Business/Creator" layer introduces creator products, prelaunch moderation, follower/audience tracking, and Net Worth / Network Value aggregation — all using compliance-safe terminology.

## Compliance Rules (STRICT)
- NO words: invest, investment, returns, profit, profit-sharing, interest (as financial interest), guaranteed
- ALLOWED: support, backing, contribution, participation, rewards, access, allocation, boost
- Smart Access = "early access to pooled funds"
- Rewards are activity-based incentives, NOT guaranteed income

## Tech Stack
- **Frontend**: React, Tailwind CSS, shadcn/ui, Framer Motion, lucide-react
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **Auth**: JWT-based local + progressive signup with intent selection

## Core Features

### Implemented ✅
#### Stokvel / Social / Rewards (P0)
1. User Authentication (classic + progressive 2-step)
2. Social Feed (posts, likes, comments)
3. Wallet (deposit, balance, transactions)
4. Stokvel+ Groups (create, join, invite, member management)
5. Contribution System
6. Network Score (0-100) with 5-component algorithm
7. Reward Tiers (Basic/Boosted/Premium)
8. Score Dashboard, Rewards Page, Leaderboards
9. Smart Access API
10. 6-screen Onboarding, 9-category Help Center
11. Legal Documents + Consent tracking
12. Admin Dashboard (password protected) — now with **server-side `X-Admin-Password` header guard**

#### Business/Creator Layer (P0 — new in this iteration)
13. **Progressive Signup** – 2-step flow: (a) email+password+terms → (b) intent (member/creator) + full_name/username/bio. Creator intent auto-redirects to /products/create.
14. **Product Creation** – 5-step questionnaire (Info, Problem & Solution, Costs & Timeline, Support Settings, Review). Status=`pending_review`; user becomes creator.
15. **Prelaunch Product Pages** – `/products/:id` with pending banner, stats, problem, follow + wallet-support modals.
16. **Follower Tracking** – public follow with name/email/phone stored on product.
17. **Product Discovery** – `/products` list with search + category filter + card view.
18. **Audience Insights (Tiered Paywall)** – `/products/:id/insights` (creator-only):
    - Free: total counts + total support
    - Basic ($5): 25% of supporters (name + email)
    - Pro ($15): full list with phone + email
    - Tier unlock deducts wallet, records transaction
19. **Stokvel "Opportunities to Support"** – StokvelDetailPage shows approved products with Back-from-Pool modal (deducts from group pool, respects product min/max).
20. **Net Worth Dashboard** – `/net-worth` aggregates wallet + stokvel participation + products supported + Network Value score with breakdown (posts×5, stokvels×20, products×10, referrals×50, network_score×2).

### Upcoming Tasks (P1)
1. Smart Access UI – frontend for users to request early fund access
2. Multi-signature Wallet Approval – 2-3 signatories for Stokvel withdrawals
3. Admin moderation UI inside /admin (currently endpoints exist but no front-end surface for approving pending products)

### Future/Backlog (P2)
1. Driver Pool Extension – daily micro-contributions for ride-hailing drivers
2. Creator earnings/payouts panel
3. Product images upload (currently field exists, UI does not upload yet)
4. Refactor `server.py` into routers (~2,200 lines)

## API Endpoints
### Auth
- `POST /api/auth/login`, `POST /api/auth/signup` (classic)
- `POST /api/auth/progressive-signup` (step 1)
- `POST /api/auth/complete-profile` (step 2, requires bearer)

### Products / Creator
- `GET/POST /api/products`
- `GET /api/products/my`, `GET /api/products/:id`
- `POST /api/products/:id/follow` (public)
- `POST /api/products/:id/support` (auth)
- `GET /api/products/:id/insights?tier=free|basic|pro` (creator)
- `POST /api/products/:id/unlock-insights?tier=basic|pro` (creator, wallet)
- `POST /api/stokvels/:sid/support-product/:pid` (group backing)

### Dashboard
- `GET /api/dashboard/net-worth`

### Admin (require header `X-Admin-Password`)
- `GET /api/admin/users`, `GET /api/admin/stats`
- `GET /api/admin/users/:id/details`
- `POST /api/admin/products/:id/moderate?action=approve|reject`
- `GET /api/admin/products/pending`

## File Structure (key additions)
```
/app/
├── backend/
│   ├── server.py  (verify_admin dependency + X-Admin-Password guard)
│   ├── .env  (ADMIN_PASSWORD added)
│   └── tests/
│       └── test_creator_product_api.py  (16 tests, 100% pass)
├── frontend/src/pages/
│   ├── AuthPage.js  (refactored — progressive 2-step signup)
│   ├── ProductListPage.js
│   ├── CreateProductPage.js  (5-step questionnaire)
│   ├── ProductDetailPage.js  (follow/support modals)
│   ├── AudienceInsightsPage.js  (NEW — tiered paywall)
│   ├── NetWorthPage.js  (aggregator)
│   ├── StokvelDetailPage.js  (added Opportunities to Support)
│   └── AdminDashboardPage.js  (sends X-Admin-Password header)
└── memory/
    ├── PRD.md
    └── test_credentials.md
```

## Testing Status
- Backend: iteration_5 → 16/16 tests passing (admin auth test added)
- Compliance: Scan confirms no forbidden financial terms in new pages (only in negated disclaimer contexts)
- Frontend: Progressive signup 2-step flow verified via Playwright

## Known Issues / Deferred
- `complete-profile` returns 422 (Pydantic) instead of 400 when required fields missing – FastAPI default; low priority
- Product image upload UI not implemented (field accepts URLs only)
- Admin moderation dashboard UI not built (must call endpoint manually to approve pending products)
