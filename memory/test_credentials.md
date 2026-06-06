# Network Capital — Test Credentials

## Existing accounts
Refer to previous iteration logs. The current testing pattern relies on dynamically generated users.

## Standing test users (iter 48 — still valid)
- **Platform Owner (Super Admin):** `rmleetang@gmail.com` / `OwnerTest123!` — auto-bootstrapped as `super_admin` on startup (sole super admin). Use this for all super-admin-only endpoints (`/admin/ambassador/config`, `/admin/users/cleanup-candidates`, `/admin/users/cleanup-delete`, `/admin/owner/overview`).
- **Standing Admin user:** `rmleetang+nctest1780423349@gmail.com` / `Test123!` — role `admin` (bootstrap demotes any non-owner super_admin → admin on every restart). Use for admin-only endpoints. Was granted ambassador role for iter48 testing — has R8,500 ZAR ambassador balance allocated.
- To create a fresh admin: sign up via `/auth/progressive-signup`, set `email_verified=true` via mongosh, then `db.users.updateOne({id:'<uid>'},{$set:{role:'admin'}})`. Bootstrap will keep them as admin (cannot grant additional super_admin).


## Password-reset configuration (iter47)
- Reset link expires in **60 minutes** (`PASSWORD_RESET_TTL_MIN`, env-overridable)
- Account auto-locks after **5 reset requests in 7 days** (`PASSWORD_RESET_LOCK_LIMIT` / `PASSWORD_RESET_LOCK_WINDOW_DAYS`)
- Locked accounts must email `support@networkcapitalapp.co.za` to release. Admin/super_admin can unlock from `/admin/locked-accounts`.
- Frontend reset link URL: `PASSWORD_RESET_FE_URL` env var (defaults to `https://networkcapitalapp.co.za/reset-password`)

## Note (iter 43+)
Brevo is live — `/auth/send-otp` no longer returns `_mock_code` when delivery succeeds. For automated tests that don't need a real inbox, **mint a JWT directly using `JWT_SECRET_KEY` from `/app/backend/.env`** (HS256) — see `/app/backend/tests/test_iter35_platform_enhancements.py` for the helper.


## Generating a test user (recommended for new flows)

The signup flow now requires email-OTP verification. Email is currently MOCKED — the
6-digit OTP is returned in the dev response as `_mock_code` and also logged to backend
logs via `logging.warning("[OTP-MOCK] …")`.

```bash
API=$(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d'=' -f2)
EMAIL="test_$(date +%s)@example.com"

# 1) Create account
TOKEN=$(curl -s -X POST "$API/api/auth/progressive-signup" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"Test123!\",\"step\":1}" \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")

# 2) Send OTP (auth required) — dev response contains _mock_code
OTP=$(curl -s -X POST "$API/api/auth/send-otp" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\"}" \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['_mock_code'])")

# 3) Verify
curl -s -X POST "$API/api/auth/verify-otp" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"code\":\"$OTP\"}"

# 4) Complete profile (now allowed)
curl -s -X POST "$API/api/auth/complete-profile" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"full_name":"Test User","username":"testuser_'"$(date +%s)"'","bio":"qa","intent":"member","terms_accepted":true,"birth_month":6}'
```

## Admin
Admin Dashboard: `/admin`
Admin password: `NetworkCapital2025!`
(sent via `X-Admin-Password` header for moderation endpoints)

## Stripe
- Test key wired: `sk_test_emergent`
- Premium tier: $10
- Stripe Checkout sessions live; integration handled by `emergentintegrations`
