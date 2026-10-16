const crypto = require("crypto");
const Razorpay = require("razorpay");
const { env } = require("../config/env");
const { httpError } = require("./httpError");

// Instantiated lazily: the Razorpay constructor throws if keys are missing, which would crash boot before .env is configured.
let instance = null;
const getRazorpay = () => {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw httpError(503, "Payments are not configured on the server");
  }
  if (!instance) instance = new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET });
  return instance;
};

const isConfigured = () => Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);

const safeEqualHex = (a = "", b = "") => {
  const ba = Buffer.from(String(a), "utf8");
  const bb = Buffer.from(String(b), "utf8");
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
};

// Checkout callback signature: HMAC_SHA256(order_id + "|" + payment_id, key_secret)
const verifyPaymentSignature = ({ orderId, paymentId, signature, secret = env.RAZORPAY_KEY_SECRET }) => {
  if (!secret || !orderId || !paymentId || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  return safeEqualHex(expected, signature);
};

// Webhook signature: HMAC_SHA256(raw request body, webhook_secret) - the RAW bytes, not re-serialised JSON.
const verifyWebhookSignature = ({ rawBody, signature, secret = env.RAZORPAY_WEBHOOK_SECRET }) => {
  if (!secret || !rawBody || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqualHex(expected, signature);
};

module.exports = { getRazorpay, isConfigured, verifyPaymentSignature, verifyWebhookSignature };
