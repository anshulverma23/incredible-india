// Express app (no listen / DB connection here, so tests can import it with supertest).
const path = require("path");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const compression = require("compression");
const cookieParser = require("cookie-parser");
const mongoSanitize = require("express-mongo-sanitize");
const hpp = require("hpp");
const mongoose = require("mongoose");

const { env } = require("./config/env");
const logger = require("./utils/logger");
const { notFound, errorHandler } = require("./middlewares/errorMiddleware");
const { apiLimiter } = require("./middlewares/rateLimiters");
const { xssSanitize } = require("./middlewares/security");
const { webhook } = require("./controllers/payment.controller");

const app = express();

if (env.TRUST_PROXY) app.set("trust proxy", 1); // correct client IPs for rate limiting behind Render/Nginx/Cloudflare
app.disable("x-powered-by");

// ---- Security headers (the Swagger UI needs inline scripts, so it gets its own relaxed CSP) ----
const strictHelmet = helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } });
const docsHelmet = helmet({ contentSecurityPolicy: false });
app.use((req, res, next) => (req.path.startsWith("/api/docs") ? docsHelmet(req, res, next) : strictHelmet(req, res, next)));

// ---- CORS: explicit allow-list, credentials for the httpOnly refresh cookie ----
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || env.CORS_ORIGINS.includes(origin)) return cb(null, true); // no Origin = curl/mobile/server-to-server
      return cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key"],
    maxAge: 600,
  })
);

app.use(compression());
if (!env.isTest) app.use(morgan(env.isProd ? "combined" : "dev", { stream: logger.stream }));

// ---- Razorpay webhook: needs the RAW body to verify the HMAC signature, so it is registered BEFORE express.json ----
app.post("/api/payment/webhook", express.raw({ type: "application/json", limit: "1mb" }), webhook);

app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));
app.use(cookieParser());

// ---- Input hardening ----
app.use(mongoSanitize({ replaceWith: "_" })); // strips $ and . operators -> NoSQL injection
app.use(hpp()); // HTTP parameter pollution
app.use(xssSanitize); // strips HTML from every string in req.body

// ---- Health (no rate limit; used by Docker/Render health checks) ----
app.get("/api/health", (req, res) => {
  const dbUp = mongoose.connection.readyState === 1;
  res.status(dbUp || env.isTest ? 200 : 503).json({ status: dbUp ? "ok" : "degraded", db: dbUp ? "up" : "down", uptime: Math.round(process.uptime()) });
});

// ---- API docs (Swagger UI) ----
try {
  const swaggerUi = require("swagger-ui-express");
  const fs = require("fs");
  const yaml = require("js-yaml");
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(yaml.load(fs.readFileSync(path.join(__dirname, "docs", "openapi.yaml"), "utf8")), { customSiteTitle: "India Travel API" }));
} catch (e) {
  logger.warn(`Swagger docs not available: ${e.message}`);
}

app.use("/api", apiLimiter);

app.get("/", (req, res) => res.json({ success: true, message: "India Travel API is running" }));

app.use("/api/auth", require("./routes/auth.routes"));
app.use("/api/users", require("./routes/user.routes"));
app.use("/api/destinations", require("./routes/destination.routes"));
app.use("/api/hotels", require("./routes/hotel.routes"));
app.use("/api/packages", require("./routes/package.routes"));
app.use("/api/bookings", require("./routes/booking.routes"));
app.use("/api/payment", require("./routes/payment.routes"));
app.use("/api/reviews", require("./routes/review.routes"));
app.use("/api/wishlist", require("./routes/wishlist.routes"));
app.use("/api/coupons", require("./routes/coupon.routes"));
app.use("/api/notifications", require("./routes/notification.routes"));
app.use("/api/itinerary", require("./routes/itinerary.routes"));
app.use("/api/admin", require("./routes/admin.routes"));
app.use("/api/blogs", require("./routes/blog.routes"));
app.use("/api/faqs", require("./routes/faq.routes"));
app.use("/api/contact", require("./routes/contact.routes"));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
