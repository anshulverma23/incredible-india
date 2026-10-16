# What changed in this release

## Duplicate / dead code removed
| Removed | Why |
|---|---|
| `backend` revenue module (`revenue.controller/routes/modal`) | never mounted, imported a file that didn't exist (`revenue.model`), never wrote any data - duplicated the admin reports |
| Stripe (SDK, controller functions, payment fields, UI) | second gateway nobody wired up; Razorpay is the one gateway |
| `admin/reports/overview` endpoint | duplicate of the dashboard stats - dashboard + reports now share one source |
| `backend/utils/FixBlogArray.js` | one-off data-repair script living in the runtime code |
| `frontend/features/site/pages/Blog.tsx`, `BlogDetail.tsx`, `constants/blog-data.ts` | unused copies of `features/blog/*` |
| `frontend/features/faq/pages/*` | unused copies of `features/site/components/faq.tsx` (and the cause of the only TypeScript error) |
| `AdminRevenue` page + its api/hook/3 components/types | overlapped Reports, Dashboard and Payments; it also called a different base URL (`/api/api/...`) |
| 2 extra axios instances (`revenue.api`, `payments.api`) | everything now uses the shared client (auth header, refresh, error handling) |

## Bugs fixed on the way
- **FAQ create/update/delete was open to any logged-in user** -> admin only.
- Payment verify trusted a `bookingId` from the browser (could confirm someone else's booking) -> booking derived from our own payment record + signature + Razorpay lookup.
- Review rating was never recalculated (aggregate compared string vs ObjectId) -> fixed.
- Hotel price filter ran *after* pagination (wrong totals) -> filters first.
- Frontend default API URL missed `/api`; admin payments page called endpoints that didn't exist -> implemented.
- `seedData.js` required `../models/User` (wrong case = crash on Linux) and hard-coded the admin password.
- Invoice used the rupee glyph, which the PDF font can't render -> `Rs.`.
- Mass-assignment (`...req.body`) in package/hotel/room/destination create+update -> field whitelists.
- Unescaped user input in `new RegExp(...)` (ReDoS) -> escaped.
- Logout cleared the token before telling the server -> refresh token is now revoked.

## New (from the roadmap)
Booking lifecycle & safety · payment security · RBAC · security hardening · indexes · search · admin analytics · HTML emails ·
invoice · verified reviews · wishlist (destinations) · coupons (per-user limits) · notifications (Socket.IO) · logging ·
tests · Docker · CI/CD · docs (README + Swagger) · performance (pagination/caching/compression) · deployment config · itinerary engine.

## Behaviour changes to be aware of
- API: `POST /reviews` now takes `{ bookingId, rating, comment }` (target comes from the booking).
- API: `PUT /bookings/:id/status` can no longer set `cancelled/refunded` (use `/cancel` so refunds + inventory are handled).
- Passwords: minimum 8 chars with a letter and a number (existing accounts keep working).
- Access tokens last 15 min; the client refreshes silently via the httpOnly cookie.
- Set `VITE_API_URL` to include `/api`.

## Roadmap completion pass (latest)
- Frontend: fixed the only lint error (`AdminReports` called setState synchronously inside an effect) - lint, `tsc` and 16 tests now pass.
- Performance: Vite vendor chunk splitting (charts / realtime / router / react) - main bundle 555 kB -> 123 kB, no more >500 kB warning.
- Docs: README now has Project overview, role table, Screenshots and Demo sections (add images to `docs/screenshots/`).
- Release hygiene: the delivered zip no longer contains `backend/.env`, logs, `node_modules` or `dist`.

## Two roles only (user + admin)
- Removed `super_admin`, `hotel_manager`, `agent`. Every management endpoint (catalogue, bookings, payments, coupons, hotels, users) is `admin` only.
- Removed hotel-manager features: `PUT /hotels/:id/managers`, `Hotel.managers`, scoped booking lists.
- `adminUserUpdate` accepts only `user` / `admin`; the Users page role dropdown shows only those two.
- Old accounts: run `npm run migrate:roles -- --apply` (super_admin -> admin, hotel_manager/agent -> user). Until then, accounts with a removed role are denied admin access (they are not auto-promoted).
- Tests updated (+3): removed roles are denied, invalid roles rejected, admin can promote a user.
