const mongoose = require("mongoose");

// Razorpay retries webhooks, so every event id is recorded once -> handlers are idempotent.
const webhookEventSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, unique: true },
    event: String,
    receivedAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 30 }, // auto-delete after 30 days
  },
  { versionKey: false }
);

module.exports = mongoose.model("WebhookEvent", webhookEventSchema);
