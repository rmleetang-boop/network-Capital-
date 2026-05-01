# Test Credentials for Network Capital

## Test Account (Classic Signup)
No pre-seeded accounts. Register via Sign Up:
- Email: test@example.com
- Password: Test123!
- Username: testuser

## Progressive Signup Flow
The /auth page uses a 2-step progressive signup:
1. Step 1: email + password + terms → POST /api/auth/progressive-signup
2. Step 2: intent (member/creator) + full_name + username + bio → POST /api/auth/complete-profile
   - Creator intent → redirects to /products/create after signup

## Regional Hubs / Connections Quick Test
1. Register two users via /api/auth/progressive-signup with random emails
2. PUT /api/users/me {"city":"cape_town", "profession":"Designer"} on each (with their bearer)
3. Login as User A and visit /hubs — User B should appear
4. Click S/F/P badges to send Social/Financial/Professional connection requests
5. Login as User B and visit /connections to accept

## Admin Dashboard
- URL: /admin
- Client password: NetworkCapital2025!
- Backend admin endpoints require header: `X-Admin-Password: NetworkCapital2025!`
  (configured via backend/.env → ADMIN_PASSWORD)

## API Base URL
https://stokvel-plus.preview.emergentagent.com/api

## Useful API Calls
- Register: POST /api/auth/progressive-signup `{email, password}`
- Complete: POST /api/auth/complete-profile `{full_name, username, bio, intent, terms_accepted}` (Bearer)
- Update profile: PUT /api/users/me `{city, country, profession, bio, photo}` (Bearer)
- Hub users: GET /api/hubs/users?city=cape_town (Bearer)
- Send connection: POST /api/connections/request `{to_user_id, type, message, stokvel_id?}` (Bearer)
- Inbox: GET /api/connections/inbox?type=social|financial|professional (Bearer)
- Accept: POST /api/connections/{id}/accept (Bearer)
- Upload photo: POST /api/users/me/photos `{data_url, caption}` (Bearer; max ~3MB)
- Approve product: POST /api/admin/products/{id}/moderate?action=approve (X-Admin-Password header)
