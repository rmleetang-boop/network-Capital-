# Test Credentials for Network Capital

## Test Account (Classic Signup)
No pre-seeded accounts. Register a new user via Sign Up:
- Email: test@example.com
- Password: Test123!
- Username: testuser

## Progressive Signup Flow (NEW)
The /auth page now uses a 2-step progressive signup:
1. Step 1: email + password + terms acceptance → POST /api/auth/progressive-signup
2. Step 2: intent (member/creator) + full_name + username + bio → POST /api/auth/complete-profile
   - Creator intent → redirects to /products/create after signup

## Admin Dashboard
- URL: /admin
- Client password: NetworkCapital2025!
- Backend admin endpoints now require header: `X-Admin-Password: NetworkCapital2025!`
  (configured via backend/.env → ADMIN_PASSWORD)

## API Base URL
https://stokvel-plus.preview.emergentagent.com/api

## Useful API Calls
- Register: POST /api/auth/progressive-signup `{email, password}`
- Complete: POST /api/auth/complete-profile `{full_name, username, bio, intent, terms_accepted}` (Bearer token)
- Login: POST /api/auth/login `{email, password}`
- Approve product: POST /api/admin/products/{id}/moderate?action=approve  (header X-Admin-Password required)
