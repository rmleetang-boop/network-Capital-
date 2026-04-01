# Network Capital - Product Requirements Document

## Original Problem Statement
Build a mobile-first prototype for a social network called Network Capital where users build a Network Score representing their contribution and influence. The app evolved into a fintech application featuring a "Reward-Based Stokvel Engine", where users form savings groups (Stokvels) and earn performance-based rewards driven by behavior and network strength.

## Compliance Rules (STRICT)
- The Stokvel+ Engine MUST NOT function as a credit provider
- No loans, no interest
- Allowed terminology: Rewards, Access, Allocation, Boosts
- Smart Access is "early access to pooled funds"
- No language suggesting guaranteed income, investment returns, or profit
- Rewards positioned as activity-based incentives

## Platform Fees
- $10 to create a Stokvel (deducted from wallet)
- $2 to join a Stokvel (deducted from wallet)

## Design Theme
- Dark navy blue (#0a1628) primary
- Orange/yellow (#f5a623) accents
- Professional fintech aesthetic
- Custom Network Capital logo integrated

## Tech Stack
- **Frontend**: React, Tailwind CSS, shadcn/ui, Framer Motion
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **Auth**: JWT-based local authentication

## Core Features

### Implemented (P0) ✅
1. **User Authentication** - Register, Login, Profile management
2. **Social Feed** - Posts, likes, comments
3. **Wallet System** - Deposit, balance tracking, transaction history
4. **Stokvel+ Groups** - Create, join, view details, member management
5. **Contribution System** - Make contributions, view contribution history
6. **Network Score (0-100)** - Complex scoring algorithm based on:
   - Contribution Consistency (30 pts max)
   - Contribution Amount (20 pts max)
   - Platform Engagement (15 pts max)
   - Referrals (15 pts max)
   - Group Health (20 pts max)
7. **Reward Tiers**:
   - Basic (41-70): 3% bonus, 1% cashback
   - Boosted (71-85): 7% bonus, 3% cashback
   - Premium (86-100): 10% bonus, 5% cashback
8. **Score Dashboard** - Visual breakdown of all score components
9. **Rewards Page** - Rewards history and summary
10. **Leaderboards** - Global user and group rankings
11. **Smart Access API** - Early access to pooled funds eligibility
12. **Onboarding Flow (6 slides)** - First-time visitor experience:
    - Welcome: "Your Network Has Value"
    - The Shift: "Make Your Time Count"
    - How It Works: Connect → Engage → Build → Unlock
    - Network Score & Stokvel+
    - Rewards & Smart Access (with disclaimers)
    - Trust & Safety: Community-driven, no guaranteed returns
13. **Help Center (9 FAQ categories)**:
    - Getting Started, Network Score, Stokvel+, Rewards
    - Smart Access, Safety & Trust, Wallet, Account, Troubleshooting
    - Compliance-focused answers (not a bank, activity-based incentives)

### Upcoming Tasks (P1)
1. **Smart Access UI** - Frontend for users to request early fund access (backend exists)
2. **Multi-signature Wallet Approval** - 2-3 signatories for Stokvel withdrawals

### Future/Backlog (P2)
1. **Driver Pool Extension** - Daily micro-contributions for ride-hailing drivers with fuel wallet
2. **Admin Dashboard** - Track total platform revenue from Stokvel+ fees

## API Endpoints
- `POST /api/auth/register`, `POST /api/auth/login`
- `GET /api/stokvels`, `POST /api/stokvels`, `POST /api/stokvels/{id}/join`
- `POST /api/stokvels/{id}/contribute`
- `GET /api/stokvels/{id}/my-score`, `GET /api/stokvels/{id}/group-score`
- `GET /api/stokvels/{id}/my-rewards`
- `GET /api/wallet/balance`, `POST /api/wallet/deposit`
- `GET /api/leaderboard/users`, `GET /api/leaderboard/groups`
- `POST /api/rewards/smart-access`

## File Structure
```
/app/
├── backend/
│   ├── server.py (All endpoints and business logic)
│   ├── tests/test_stokvel_api.py (30 test cases)
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.js (Routing with onboarding state)
│   │   ├── components/Layout.js (Navigation)
│   │   └── pages/ (AuthPage, OnboardingPage, HelpCenterPage, FeedPage, 
│   │               ProfilePage, WalletPage, StokvelListPage, CreateStokvelPage, 
│   │               StokvelDetailPage, ScoreDashboardPage, RewardsPage, LeaderboardsPage)
│   └── tailwind.config.js
└── memory/
    ├── PRD.md
    └── test_credentials.md
```

## Testing Status
- Backend: 30/30 tests passing (100%)
- Frontend: All features verified (100%)
- Last test runs: iteration_1.json (backend+frontend), iteration_2.json (new features)

## Known Issues
- Minor: "Made with Emergent" badge at bottom may overlap with buttons on some screens (requires force click in tests)
