# Network Capital — Test Credentials

## Existing accounts
Refer to previous iteration logs. The current testing pattern relies on dynamically generated users.

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
