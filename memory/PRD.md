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
12. **Onboarding Flow (6 screens - Premium Fintech Experience)**:
    - **Screen 1 (Auth)**: Dark theme, phone-first signup with +27 country code, email alternative, referral code field (gold border), terms checkbox, gold CTA, Google/Apple placeholders
    - **Screen 2 (Welcome)**: "Your Network Has Value" + app preview (Social Feed, Community, Earnings)
    - **Screen 3 (The Shift)**: "Make Your Time Count" + mini feed previews with mock earnings
    - **Screen 4 (How It Works)**: 4 steps (Connect, Engage, Build, Unlock) with descriptions + feature cards
    - **Screen 5 (Score+Rewards)**: Merged Network Score display + tier breakdown (3%/7%/10% rewards on contributions)
    - **Screen 6 (Trust+Referral)**: Trust badges + referral code display + WhatsApp share button + Enter App
    - Referral system: $10 bonus to referrer on successful signup
13. **Help Center (9 FAQ categories)**:
    - Getting Started, Network Score, Stokvel+, Rewards
    - Smart Access, Safety & Trust, Wallet, Account, Troubleshooting
    - Compliance-focused answers (not a bank, activity-based incentives)
14. **Legal Documents & Consent**:
    - Full Terms & Conditions (14 sections) by Mici (Pty) Ltd, South Africa
    - Full Privacy Policy (11 sections) - GDPR, POPIA compliant
    - Consent checkbox required before registration
    - Clickable links to view full documents in-app
    - System records: terms_accepted, terms_accepted_at (timestamp), terms_version
    - Legal page accessible at /legal with tabs for T&C and Privacy

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
│   ├── tests/
│   │   ├── test_stokvel_api.py (30 test cases)
│   │   └── test_terms_compliance.py (9 test cases)
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.js (Routing with onboarding state)
│   │   ├── components/Layout.js (Navigation)
│   │   └── pages/ (AuthPage, OnboardingPage, HelpCenterPage, LegalDocumentsPage,
│   │               FeedPage, ProfilePage, WalletPage, StokvelListPage, 
│   │               CreateStokvelPage, StokvelDetailPage, ScoreDashboardPage, 
│   │               RewardsPage, LeaderboardsPage)
│   └── tailwind.config.js
└── memory/
    ├── PRD.md
    └── test_credentials.md
```

## Testing Status
- Backend: 47/47 tests passing (100%)
- Frontend: All features verified (100%)
- Test iterations: 
  - iteration_1 (core), 
  - iteration_2 (onboarding/help), 
  - iteration_3 (legal/consent),
  - iteration_4 (premium onboarding refactor)

## Known Issues
- Minor: "Made with Emergent" badge at bottom may overlap with buttons on some screens (requires force click in tests)
