// Central place that reads + validates environment variables.
// In production the app refuses to boot if a critical secret is missing or obviously weak.
const dotenv = require("dotenv");
dotenv.config();

const isProd = process.env.NODE_ENV === "production";
const isTest = process.env.NODE_ENV === "test";

const num = (v, d) => (v === undefined || v === "" || Number.isNaN(Number(v)) ? d : Number(v));
const bool = (v, d) => (v === undefined ? d : String(v).toLowerCase() === "true");

const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  isProd,
  isTest,
  PORT: num(process.env.PORT, 8000),
  MONGO_URI: process.env.MONGO_URI,

  // Comma separated list, e.g. "https://app.example.com,https://www.example.com"
  FRONTEND_URL: (process.env.FRONTEND_URL || "http://localhost:5173").split(",")[0].trim(),
  CORS_ORIGINS: (process.env.FRONTEND_URL || "http://localhost:5173")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  TRUST_PROXY: bool(process.env.TRUST_PROXY, isProd),

  JWT_SECRET: process.env.JWT_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
  ACCESS_TOKEN_TTL: process.env.ACCESS_TOKEN_TTL || "15m",
  REFRESH_TOKEN_DAYS: num(process.env.REFRESH_TOKEN_DAYS, 7),

  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET,

  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,

  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: num(process.env.SMTP_PORT, 587),
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  EMAIL_FROM: process.env.EMAIL_FROM,
  ADMIN_NOTIFY_EMAIL: process.env.ADMIN_NOTIFY_EMAIL || process.env.CONTACT_EMAIL || process.env.SMTP_USER,

  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  OPENWEATHER_API_KEY: process.env.OPENWEATHER_API_KEY,

  // Business rules
  TAX_RATE: num(process.env.TAX_RATE, 0.05), // GST-style 5%
  BOOKING_HOLD_MINUTES: num(process.env.BOOKING_HOLD_MINUTES, 30),
  ENABLE_JOBS: bool(process.env.ENABLE_JOBS, !isTest),
  LOG_LEVEL: process.env.LOG_LEVEL || (isProd ? "info" : "debug"),
  LOG_TO_FILES: bool(process.env.LOG_TO_FILES, !isTest),
};

const validateEnv = () => {
  const missing = [];
  if (!env.MONGO_URI) missing.push("MONGO_URI");
  if (!env.JWT_SECRET) missing.push("JWT_SECRET");
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
  if (isProd) {
    if (env.JWT_SECRET.length < 32) throw new Error("JWT_SECRET must be at least 32 characters in production");
    const recommended = ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET", "SMTP_HOST"];
    const absent = recommended.filter((k) => !env[k]);
    if (absent.length) {
      // eslint-disable-next-line no-console
      console.warn(`[env] Warning - not configured (related features disabled): ${absent.join(", ")}`);
    }
  }
};

module.exports = { env, validateEnv };
