# Network Capital - PRD (Iteration 7)

## Original Problem Statement
Mobile-first social network with Stokvel groups, Network Score, compliance-safe Creator/Product layer, Regional Hubs with 3-type connections, profile media (photos/videos/articles), and now: P1 features for Smart Access UI, Multi-signature withdrawals, Admin moderation UI, and shadcn Select on Hubs.

## Compliance Rules (STRICT)
- NO words: invest, investment, returns, profit, profit-sharing, interest (financial), guaranteed
- ALLOWED: support, backing, contribution, participation, rewards, access, allocation, boost
- Smart Access = "early access to your own pooled funds" — explicitly NOT a loan, no debt, no interest

## Tech Stack
- Frontend: React, Tailwind, shadcn/ui (now using Select on Hubs), Framer Motion, lucide-react
- Backend: FastAPI, Pydantic v2, Motor (async MongoDB)
- Database: MongoDB
- Auth: JWT-based local + progressive 2-step signup

## Implemented Features

### Core (P0)
- Auth (classic + progressive 2-step), Feed (text/image/video posts), Wallet, Stokvel groups
- Network Score with Basic/Boosted/Premium tiers
- Score Dashboard, Rewards Page, Leaderboards
- Onboarding (6 screens), Help Center (9 categories), Legal docs with consent
- Admin Dashboard `/admin` (client password + backend `X-Admin-Password` guard)
- Brand attribution "Powered by Mici Business" on Auth/Onboarding/Legal screens

### Creator/Product Layer (P0)
- Progressive signup with member/creator intent
- 5-step Product creation, prelaunch product pages with 24-72h moderation
- Public follower registration, wallet support, group-pool support from stokvel
- Audience Insights tiered paywall (Free / $5 Basic / $15 Pro)
- Net Worth dashboard

### Regional Hubs & Connections (P0)
- 11-city SA dropdown (now shadcn Select), member discovery, connection_status
- 3-type Connections (Social / Financial / Professional) with inbox + accepted + sent views
- Profile Media: photos grid, videos list, articles
- Profile fields: city, profession persisted

### P1 Features (NEW iteration 7)
- **Smart Access UI** — StokvelDetailPage card showing eligibility (score, tier, max access). Modal allows requesting amount, calls POST /api/stokvels/{sid}/smart-access. Compliance copy: "Not a loan — no interest, no debt"
- **Multi-signature Wallet Approvals** — Stokvel creator can pick 1–3 signatories. Members propose withdrawals via POST /withdrawals. 2-of-N approval rule. Once threshold met, pool decreases & recipient wallet credited. Status flows: pending → executed | rejected. Vote idempotency enforced.
- **Admin Moderation UI** — `/admin` now has tabs (Users / Pending Products with red count badge). Pending Products lists submissions with Approve/Reject actions (calls /admin/products/{id}/moderate with X-Admin-Password header).
- **shadcn Select on Hubs** — replaced native `<select>` with proper Select / SelectTrigger / SelectContent components.

## Backend Endpoints (Iteration 7 additions)
- PUT `/api/stokvels/{sid}/signatories` — creator-only, 1–3 member ids
- POST `/api/stokvels/{sid}/withdrawals` — propose
- GET `/api/stokvels/{sid}/withdrawals` — list (members only)
- POST `/api/stokvels/{sid}/withdrawals/{wid}/approve|reject` — signatory vote

## Multi-sig Approval Rule
- 1 signatory → 1 approval executes
- 2 signatories → 2 approvals (unanimous)
- 3+ signatories → 2 approvals (2-of-N)
- Rejection: when remaining-yes-votes can no longer reach threshold, status flips to rejected

## File Structure (key)
```
/app/
├── backend/
│   ├── server.py  (~2.6k lines)
│   ├── .env  (MONGO_URL, DB_NAME, CORS_ORIGINS, ADMIN_PASSWORD)
│   └── tests/
│       ├── test_creator_product_api.py  (16 tests)
│       ├── test_hubs_connections_media.py  (31 tests)
│       └── test_multisig_withdrawals.py  (15 tests, NEW)
├── frontend/src/
│   ├── App.js, components/Layout.js, components/BrandAttribution.js
│   └── pages/
│       ├── AuthPage, FeedPage (with video), ProfilePage (city + media tabs)
│       ├── StokvelDetailPage  (Smart Access + Withdrawals + Signatories modals)
│       ├── RegionalHubsPage  (shadcn Select)
│       ├── ConnectionsPage, ProductListPage, CreateProductPage, ProductDetailPage
│       ├── AudienceInsightsPage, NetWorthPage
│       └── AdminDashboardPage  (Users/Pending-Products tabs + moderation actions)
└── memory/
    ├── PRD.md, test_credentials.md
```

## Testing Status (Iteration 7)
- Backend: **62 / 62** dedicated tests pass (creator 16/16 + hubs 31/31 + multisig 15/15)
- Frontend smoke: Admin "Pending Products" tab shows red count badge, lists product cards, Approve removes from list end-to-end
- Compliance: Smart Access + Withdrawal modals use no forbidden financial terms

## Known Issues / Deferred
- StokvelDetailPage now ~1000 lines with 3 modals — should split into sub-components (P2)
- Public media list endpoints have no auth/rate limiting (P2)
- Media stored base64 in user docs — will hit 16MB limit; needs cloud storage migration (P2)
- 4 pre-existing backend lint warnings (unused locals, f-strings)

## Next Action Items
- **P2**: Driver Pool extension, Cloud media storage (S3/R2), modularize server.py, PWA + Capacitor
- **Polish**: Split StokvelDetailPage modals into separate components, add rate limiting on public media endpoints
