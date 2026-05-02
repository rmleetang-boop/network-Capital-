# Network Capital - PRD (Iteration 8)

## Original Problem Statement
Mobile-first social network with Stokvel groups, Network Score, compliance-safe Creator/Product layer, Regional Hubs, multi-sig withdrawals, and now multi-currency support with a premium paywall on financial features + real social-media share intents.

## Compliance Rules (STRICT)
- NO words: invest, investment, returns, profit, profit-sharing, interest (financial), guaranteed
- ALLOWED: support, backing, contribution, participation, rewards, access, allocation, boost
- Smart Access = "early access to your own pooled funds" — NOT a loan, no debt, no interest

## Tech Stack
- Frontend: React, Tailwind, shadcn/ui, Framer Motion, lucide-react
- Backend: FastAPI, Pydantic v2, Motor (async MongoDB)
- Database: MongoDB
- Auth: JWT-based local + progressive 2-step signup

## Implemented Features

### Core (P0)
- Auth (classic + progressive 2-step), Feed (text/image/video posts), Wallet, Stokvel groups
- Network Score with Basic/Boosted/Premium tiers
- Score Dashboard, Rewards Page, Leaderboards
- Onboarding (6 screens), Help Center, Legal docs with consent
- Admin Dashboard `/admin` (client + backend `X-Admin-Password` guard)
- Brand attribution "Powered by Mici Business" on Auth/Onboarding/Legal

### Creator/Product Layer (P0)
- Progressive signup with member/creator intent
- 5-step Product creation, prelaunch product pages with 24-72h moderation
- Public follower registration, wallet support, group-pool support
- Audience Insights tiered paywall (Free / $5 / $15)
- Net Worth dashboard

### Regional Hubs & Connections (P0)
- 11-city SA dropdown (shadcn Select), member discovery
- 3-type Connections (Social / Financial / Professional)
- Profile Media: photos / videos / articles
- 5-item bottom nav + top-right overflow drawer

### P1 Features (Iteration 7)
- Smart Access UI in StokvelDetailPage
- Multi-signature wallet withdrawals (1–3 signatories, 2-of-N rule)
- Admin moderation UI for pending products
- shadcn Select on Hubs page

### Multi-currency + Premium + Social Share (Iteration 8 — NEW)
- **10 currencies**: USD, EUR, GBP, ZAR, NGN, KES, GHS, JPY, AUD, CAD
- **Currency context** (`/app/frontend/src/context/CurrencyContext.js`) provides `format(usdValue)`, persisted via PUT /users/me
- **CurrencySwitcher** shadcn component visible on Wallet + Net Worth headers
- **Premium $10 paywall** (`PremiumPaywall.js`) blocks: wallet deposit, stokvel contribute, smart access, multi-sig withdrawals, product support — backend returns 402 Payment Required when locked
- POST /users/me/premium accepts {currency} → marks user `premium_unlocked=true`, records mock transaction. **MOCKED** payment for prototype.
- Pay-in-any-currency: user picks USD / EUR / ZAR / NGN / etc., amount auto-converts to local
- **Social share menu** (`ShareMenu.js`): Twitter/X · Facebook · WhatsApp · LinkedIn · Telegram + Copy link, opens platform share intents in new window
- Region selector crash fixed (missing shadcn import restored)

## Backend Endpoints (Iteration 8 additions)
- GET `/api/currencies` — 10 currencies with rates + `premium_fee_usd: 10`
- POST `/api/users/me/premium` `{currency}` — mock payment unlock
- 402 gate via `require_premium()` on: `/wallet/deposit`, `/stokvels/{sid}/contribute`, `/stokvels/{sid}/smart-access`, `/stokvels/{sid}/withdrawals`, `/products/{pid}/support`

## File Structure (key)
```
/app/
├── backend/
│   ├── server.py  (~2.7k lines — SUPPORTED_CURRENCIES, require_premium, /currencies, /premium)
│   ├── .env  (MONGO_URL, DB_NAME, CORS_ORIGINS, ADMIN_PASSWORD)
│   └── tests/
│       ├── test_creator_product_api.py  (16) — fixtures unlock premium
│       ├── test_hubs_connections_media.py  (31)
│       ├── test_multisig_withdrawals.py  (15) — _register_user unlocks premium
│       └── test_currency_premium.py  (11, NEW)
├── frontend/src/
│   ├── App.js  (CurrencyProvider wrapping routes)
│   ├── context/CurrencyContext.js  (NEW)
│   ├── components/
│   │   ├── PremiumPaywall.js  (NEW)
│   │   ├── CurrencySwitcher.js  (NEW)
│   │   ├── ShareMenu.js  (NEW — 5 platforms + copy)
│   │   └── BrandAttribution.js
│   └── pages/
│       ├── WalletPage.js  (currency + paywall)
│       ├── NetWorthPage.js  (currency switcher in header)
│       ├── StokvelDetailPage.js  (paywall banner, format())
│       ├── ProductDetailPage.js  (paywall on Support, format())
│       ├── FeedPage.js  (ShareMenu integration)
│       └── RegionalHubsPage.js  (shadcn Select fixed)
└── memory/
    ├── PRD.md, test_credentials.md
```

## Testing Status (Iteration 8)
- Backend: **73 / 73** dedicated tests pass (16+31+15+11)
- Frontend smoke (Playwright): Hubs select dropdown opens 11 cities + persists; Wallet paywall card + currency switcher visible; ShareMenu shows all 5 platforms + copy link
- Compliance: paywall + share modals use only allowed terms

## Known Limitations
- **Real payment is MOCKED** — replace with Stripe / Paystack / Razorpay before production
- Static FX rates in `SUPPORTED_CURRENCIES` — for real-time rates, integrate exchangerate.host or Open Exchange Rates
- Premium is one-time fee (no subscription renewal logic)
- StokvelDetailPage now ~1.1k lines — should split modals into sub-components

## Next Action Items
- **P2**: Real payment integration (Stripe + Paystack for Africa), live FX rate API, Driver Pool extension, Cloud media migration (S3/R2), modularize `server.py`, PWA + Capacitor
- **Polish**: Split StokvelDetailPage modals, add rate limiting on public media endpoints
