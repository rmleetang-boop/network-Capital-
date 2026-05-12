# Network Capital — CHANGELOG

## iter 26 (Feb 11, 2026) — Referral tracking, Admin hardening, Email triggers
### Backend
- **Referral analytics**: `POST /api/referrals/track-click` (public, fired by JoinHandler on `/join/<code>` visits) · `GET /api/referrals/me` returns `{clicks_count, joined_count, joined_7d, completed_count, joined_users[], share_code, share_url}`.
- **Admin dashboard hardening**: `/admin/dashboard/metrics` now accepts `X-Admin-Password` header as a fallback gate AND auto-promotes the JWT-authenticated user to `role: admin` when password matches (no separate bootstrap step needed).
- **User model**: `role` field now exposed via `/users/me` so the frontend can detect admin status.
- **5 transactional email templates** wired (fire-and-forget Resend sends, never 500): Welcome (profile complete), Connection request, Connection accepted, Job application received (employer), Job application status changed (applicant). All use the reusable `_branded_email_html()` template.
- Legacy `/admin` password compare now trims whitespace.
### Frontend
- `/network` → new **"Invites" tab** with share-card (native Web Share + Copy fallback), 3 stat tiles (Clicks/Joined/Completed), and full list of joined members with active/pending badges.
- `App.js` JoinHandler fires `/api/referrals/track-click` on `/join/<code>` visits (fire-and-forget).
### Testing
- iter28: 33/33 tests PASS (10 new iter26 + 23 iter25 regression).

## iter 25 (Feb 10, 2026) — My Places, My Network, Job reactions, Role-based admin
- My Places (Trustpilot-style): CRUD + reviews + Leaflet map + owner claims.
- My Network (3-category): social/professional/financial + request/accept/reject + dashboards.
- Job reactions: like/dislike/share with clean `networkcapitalapp.co.za/jobs/<id>` URLs.
- Role-based admin: `user.role` field, `/admin/dashboard`, `/admin/users`, `/admin/bootstrap`.
- Score: +40 review · +25 connection · +20 share (with daily caps + cooldowns).
- Feed post avatar upgraded to 48×48 with secondary ring (FB/IG style).
- 3 duplicate-handler bugs fixed (legacy /connections/{request,accept,reject} deleted).
- iter27: 23/23 PASS.

## iter 24 (Feb 10, 2026) — Jobs feature retest + 4 frontend bugfixes
- JobRow click navigation (motion.div → plain div role=button).
- ProfilePage `user_kind` toggle (Social ↔ Professional).
- `/jobs/new` inline `$50` Stripe unlock CTA.
- Duplicate apply now 409 (was 400).

## iter 23 (Feb 10, 2026) — Jobs + Resend OTP
- Jobs feature: `user_kind`, `job_post_unlocked`, `/api/jobs` CRUD, `/api/jobs/{id}/apply` (409 dup), `$50` Stripe unlock, seeded BD Agent.
- Real Resend email integration replacing mock OTP. Graceful fallback returns `_mock_code` when Resend test-mode rejects unverified recipients.
- Footer Careers link with sign-in modal for guests.

## iter 22 (Feb 2026) — Score engine refactor + account mgmt
- 10,000 monthly cap, three-tier engine (T1 Ads / T2 Referrals / T3 Standard).
- Badge engine (Bronze Networker → Network Legend).
- AI comment relevance (Claude Haiku via Emergent LLM key).
- Account deactivate / delete with 30-day grace.

## Earlier — see PRD.md history
