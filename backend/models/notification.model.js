const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: {
      type: String,
      enum: [
        "booking_confirmed",
        "payment_success",
        "payment_failed",
        "booking_cancelled",
        "refund_processed",
        "trip_reminder",
        "booking_expired",
        "review_prompt",
        "general",
      ],
      default: "general",
    },
    title: { type: String, required: true, maxlength: 120 },
    message: { type: String, required: true, maxlength: 500 },
    link: String, // in-app route, e.g. /bookings/<id>
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });
// Keep the collection small: notifications older than 90 days disappear automatically.
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

module.exports = mongoose.model("Notification", notificationSchema);
