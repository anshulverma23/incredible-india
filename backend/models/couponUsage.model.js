const mongoose = require("mongoose");

// One row per redemption. Written when a payment succeeds (NOT when a booking is merely created),
// so abandoned/expired bookings never "burn" a user's coupon.
const couponUsageSchema = new mongoose.Schema(
  {
    coupon: { type: mongoose.Schema.Types.ObjectId, ref: "Coupon", required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true },
    discount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

couponUsageSchema.index({ coupon: 1, user: 1 });
couponUsageSchema.index({ booking: 1 }, { unique: true }); // a booking can redeem at most one coupon, once

module.exports = mongoose.model("CouponUsage", couponUsageSchema);
