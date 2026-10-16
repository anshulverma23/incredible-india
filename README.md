# India Travel - Booking Platform

Full-stack travel booking platform (packages + hotels) with a production-grade booking and payment flow,
role-based admin panel, itinerary planner, real-time notifications and a CI/CD + Docker setup.

## Project overview

India Travel lets customers discover destinations, search tour packages and hotels, plan a budget-based itinerary,
pay securely through Razorpay and manage bookings, invoices, reviews and wishlists from one dashboard.
Admins get an analytics dashboard, coupon / content management and refund controls.

**Who uses it**

| Role | Can do |
|---|---|
| Visitor | Browse destinations, packages, hotels, blog, FAQ; use the itinerary planner |
| User | Book + pay, download invoice, cancel / get refund, review completed trips, wishlist, notifications |
| Admin | Everything: dashboard, users + roles, bookings, payments/refunds, coupons, reviews, hotels, packages, content |

## Screenshots

Add your screenshots to `docs/screenshots/` and they will render here:

| Home | Package search | Checkout |
|---|---|---|
| ![Home](docs/screenshots/home.png) | ![Search](docs/screenshots/search.png) | ![Checkout](docs/screenshots/checkout.png) |

| Booking + invoice | Itinerary planner | Admin dashboard |
|---|---|---|
| ![Booking](docs/screenshots/booking.png) | ![Planner](docs/screenshots/planner.png) | ![Admin](docs/screenshots/admin.png) |

## Demo

- Live site: _add your Vercel / custom-domain URL after deploying_
- API docs (Swagger): `https://<api-domain>/api/docs`
- Test Razorpay payments with the [Razorpay test cards](https://razorpay.com/docs/payments/payments/test-card-details/) while `RAZORPAY_KEY_ID` starts with `rzp_test_`.

## Features

| Area | What's included |
|---|---|
| **Booking flow** | Search -> select -> live availability check -> **pending booking (inventory held 30 min)** -> Razorpay -> server-side verification + webhook -> **confirmed** -> email + PDF invoice + in-app notification |
| **Booking safety** | Unique booking reference (`IT-YYMMDD-XXXXXX`), `Idempotency-Key` + duplicate-booking protection, race-safe inventory (two people can't take the last room/seat), booking expiry job, cancellation with policy-based refunds, booking history/audit trail, status `pending / confirmed / cancelled / failed / refunded` (+ `completed`, `expired`) |
| **Payments** | Server-computed amounts, HMAC signature verification, re-check with Razorpay, signed + idempotent webhooks (`payment.captured`, `order.paid`, `payment.failed`, `refund.processed`), reconciliation cron for missed callbacks, failed-payment retry, late-payment auto-refund, partial/full refunds |
| **Authorization** | Exactly two roles - `user` and `admin` - enforced in the backend (`authorize(...)` middleware). Every management endpoint is admin-only; an admin can promote a user to admin but can't change their own role |
| **Security** | Helmet, CORS allow-list, rate limiting (global + auth + payments + forms), request validation (zod), NoSQL-injection + XSS + HPP protection, bcrypt (12 rounds), 15-min access token + rotating httpOnly refresh cookie, token revocation on password change, upload validation (mime + magic bytes + size limits), no secrets in git |
| **Search** | Destination, price range, duration range, category, rating, departure-date range, hotel, amenities, sorting + pagination (packages). Hotels: city, price, rating, type, amenities, **date availability** |
| **Admin dashboard** | Users, bookings, net revenue, pending/cancelled, popular destinations/packages, monthly revenue + status charts, payments & refunds, reports |
| **Emails** | Responsive HTML templates: booking confirmed (+ invoice PDF), payment receipt, new-booking admin alert, cancellation/refund, trip reminder, booking expired, verify email, reset/changed password |
| **Invoice** | PDF with booking ID, customer, item, dates, guests, subtotal, discount, tax, total, **PAID** stamp - also attached to the confirmation email |
| **Reviews** | Only a user with a **completed** booking can review, one review per booking (fake-review protection) |
| **Wishlist** | Destinations, hotels and packages (atomic, no duplicates) |
| **Coupons** | Percentage/flat, minimum amount, max discount, expiry, total + per-user limits, redeemed only after successful payment (`WELCOME10`, `TRAVEL500`, `DIWALI20` seeded) |
| **Notifications** | Stored per user + pushed live over Socket.IO; bell + page in the UI |
| **Itinerary engine** | "5 days Kashmir, Rs.40,000, Adventure + Nature" -> Srinagar > Gulmarg > Pahalgam > Sonamarg > Srinagar with a per-day cost breakdown, honest over-budget reporting, plus real packages/hotels to book |
| **Observability** | Winston (console + daily-rotated files), morgan HTTP logs, dedicated payment/auth failure log categories, `/api/health` |
| **Performance** | Query-driven indexes, pagination caps, response caching for public lists, compression, lean queries |
| **DevOps** | Dockerfiles + `docker-compose.yml`, GitHub Actions CI (tests, lint, build, docker) + deploy workflow, Render blueprint, Vercel config, Swagger docs at `/api/docs` |

## Architecture

```
React (Vite, TS) ──REST/JSON──▶ Express API ──▶ MongoDB
   │   ▲  Socket.IO (notifications)   │   ├──▶ Razorpay (orders, refunds)  ◀── webhooks
   │   └──────────────────────────────┤   ├──▶ Cloudinary (images)
   └─ Razorpay Checkout (popup)       │   └──▶ SMTP (email)
                                      └── node-cron jobs: reconcile payments · expire holds · complete trips · reminders
```

Backend layout: `routes/ -> validators/ (zod) -> controllers/ -> services/ (booking, payment, availability, itinerary, notification) -> models/`.

## Payment flow

```
1  POST /bookings                 server validates dates/guests/availability, prices it, holds inventory (status: pending, expires in 30 min)
2  POST /payment/create-order     amount read from DB (never from the client); same order reused on retry
3  Razorpay Checkout (browser)
4  POST /payment/verify           HMAC signature check -> fetch payment from Razorpay (captured? same order? same amount?) -> confirm
5  POST /payment/webhook          independent confirmation path (signed, idempotent by event id) - works even if the user closes the tab
6  cron (every 5 min)             asks Razorpay about unpaid orders -> catches anything steps 4 and 5 both missed
```
`confirmPayment()` is idempotent: whichever of 4/5/6 arrives first confirms the booking, the rest are no-ops
(one coupon redemption, one set of emails, one set of notifications). If a payment arrives after the hold expired and
the seats are gone, it is **refunded automatically**.

Cancellation refunds (`backend/config/policy.js`): 7+ days before the trip 90%, 3-6 days 50%, under 3 days 0%.
Admins can override the percentage per cancellation.

## Tech stack
React 19, TypeScript, Vite, Tailwind, shadcn/base-ui, Recharts, socket.io-client · Node 22, Express 4, MongoDB/Mongoose, Zod,
Winston, Jest + Supertest, Vitest + Testing Library · Razorpay, Cloudinary, Nodemailer, PDFKit · Docker, GitHub Actions.

## Quick start

### With Docker (recommended)
```bash
cp backend/.env.example backend/.env      # fill in JWT_SECRET (and Razorpay/Cloudinary/SMTP as available)
docker compose up --build
docker compose exec backend node utils/seedData.js   # demo data + admin user (password printed once)
```
Frontend http://localhost:5173 · API http://localhost:8000/api · Swagger http://localhost:8000/api/docs

### Existing database with old roles?

Older versions had `super_admin`, `hotel_manager` and `agent` roles. Convert them once:

```bash
cd backend
npm run migrate:roles            # dry run
npm run migrate:roles -- --apply # super_admin -> admin, hotel_manager/agent -> user
```

### Without Docker
```bash
# backend (needs a MongoDB)
cd backend && cp .env.example .env && npm install && npm run seed && npm run dev
# frontend
cd frontend && cp .env.example .env && npm install && npm run dev
```

## Environment variables
Backend (`backend/.env.example` documents all of them):

| Variable | Required | Purpose |
|---|---|---|
| `MONGO_URI` | yes | MongoDB connection string |
| `JWT_SECRET` | yes (>= 32 chars in production) | signs access tokens |
| `FRONTEND_URL` | yes | allowed CORS origin(s), comma separated; used in email links |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | for payments | Razorpay API keys |
| `RAZORPAY_WEBHOOK_SECRET` | for webhooks | secret set on the Razorpay webhook |
| `CLOUDINARY_*` | for image upload | Cloudinary credentials |
| `SMTP_HOST/PORT/USER/PASS`, `EMAIL_FROM`, `ADMIN_NOTIFY_EMAIL` | for email | outgoing mail + admin alerts |
| `TAX_RATE`, `BOOKING_HOLD_MINUTES`, `ENABLE_JOBS`, `TRUST_PROXY` | optional | business rules / runtime |

Frontend: `VITE_API_URL` (**includes `/api`**), `VITE_GOOGLE_CLIENT_ID`, `VITE_GOOGLE_MAPS_API_KEY`.
**Never commit `.env` files** - `.gitignore` already excludes them; commit only `.env.example`.

### Razorpay setup
1. Dashboard -> Settings -> API keys -> put key id/secret in `.env`.
2. Settings -> Webhooks -> URL `https://<api-domain>/api/payment/webhook`, secret = `RAZORPAY_WEBHOOK_SECRET`,
   events `payment.captured`, `order.paid`, `payment.failed`, `refund.processed`.
3. Keep **auto-capture** enabled (Settings -> Payment capture).

## Database design (Mongoose)
`User` (roles, tokenVersion, hashed refresh tokens) · `Destination` (+ areas/attractions for the planner) · `Hotel` -> `Room` ·
`Package` · `Booking` (reference, pricing, status history, expiry, idempotency key, cancellation) · `Payment` (order/payment ids,
refunds[]) · `Coupon` + `CouponUsage` · `Review` (unique per booking) · `Wishlist` · `Notification` (TTL 90d) ·
`Itinerary` · `WebhookEvent` (TTL 30d). Every list/filter endpoint is backed by an index (see `models/*.js`).

## API
Interactive docs: `/api/docs` (OpenAPI in `backend/docs/openapi.yaml`). Example search:
`GET /api/packages?destination=Kashmir&minPrice=20000&maxPrice=50000&minDuration=5&maxDuration=7&category=Adventure&minRating=4`

## Testing
```bash
cd backend  && npm test                      # 84 unit + API tests (no DB needed)
MONGO_TEST_URI=mongodb://127.0.0.1:27017/india_travel_test npm test   # + 31 real-database booking/payment/refund tests
cd frontend && npm test                      # 16 tests: token-refresh client, checkout/payment flow, helpers
```

## Deployment
- **Database:** MongoDB Atlas (set `MONGO_URI`, allow the API's IP).
- **API:** Render (`render.yaml`) / Railway / any Docker host. Set `NODE_ENV=production`, `TRUST_PROXY=true`, all secrets.
- **Frontend:** Vercel (`frontend/vercel.json`) or the nginx image. Build with `VITE_API_URL=https://api.your-domain.com/api`.
- **HTTPS + domain:** terminate TLS at the platform (Render/Vercel do this); point `app.your-domain.com` -> Vercel and
  `api.your-domain.com` -> Render, then set `FRONTEND_URL=https://app.your-domain.com`. Cross-site cookies need HTTPS
  (the refresh cookie is `Secure; SameSite=None` in production).
- **CI/CD:** `.github/workflows/ci.yml` runs on every push/PR; `deploy.yml` deploys `main` after CI passes
  (secrets: `RENDER_DEPLOY_HOOK_URL`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`).

## Scaling notes
Caching and rate limiting use in-process memory - fine for one instance; for several instances swap `utils/cache.js`
for Redis and use a Redis store for `express-rate-limit`. Cron jobs are idempotent, so multiple instances are safe (just redundant).
