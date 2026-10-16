const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, match: /^[A-Z0-9_-]{3,20}$/ },
    description: { type: String, trim: true, maxlength: 200 },
    // "flat" = fixed rupee discount ("fixed" is accepted as an alias in the validator)
    discountType: { type: String, enum: ["percentage", "flat"], required: true },
    discountValue: { type: Number, required: true, min: 1 },
    minPurchaseAmount: { type: Number, default: 0, min: 0 },
    maxDiscountAmount: { type: Number, min: 0 }, // caps % discounts
    applicableOn: { type: String, enum: ["all", "hotel", "package"], default: "all" },
    startDate: { type: Date, default: Date.now },
    expiryDate: { type: Date, required: true },
    usageLimit: { type: Number, default: 100, min: 1 }, // total redemptions across all users
    perUserLimit: { type: Number, default: 1, min: 1 }, // redemptions per user
    usedCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

couponSchema.index({ isActive: 1, expiryDate: 1 });

couponSchema.pre("validate", function (next) {
  if (this.discountType === "percentage" && this.discountValue > 100) {
    return next(new Error("Percentage discount cannot exceed 100"));
  }
  next();
});

/**
 * Validates a coupon against a purchase amount + booking type.
 * `userUsageCount` = how many times THIS user already redeemed it.
 * Returns { valid, discount, message }.
 */
couponSchema.methods.calculateDiscount = function (amount, bookingType, userUsageCount = 0) {
  const now = new Date();
  if (!this.isActive) return { valid: false, message: "Coupon is not active" };
  if (this.startDate && now < this.startDate) return { valid: false, message: "Coupon is not valid yet" };
  if (now > this.expiryDate) return { valid: false, message: "Coupon has expired" };
  if (this.usedCount >= this.usageLimit) return { valid: false, message: "Coupon usage limit reached" };
  if (userUsageCount >= (this.perUserLimit || 1)) {
    return { valid: false, message: "You have already used this coupon the maximum number of times" };
  }
  if (this.applicableOn !== "all" && this.applicableOn !== bookingType) {
    return { valid: false, message: `Coupon is not applicable on ${bookingType} bookings` };
  }
  if (amount < this.minPurchaseAmount) {
    return { valid: false, message: `Minimum booking amount of Rs.${this.minPurchaseAmount} required` };
  }

  let discount = this.discountType === "percentage" ? (amount * this.discountValue) / 100 : this.discountValue;
  if (this.maxDiscountAmount) discount = Math.min(discount, this.maxDiscountAmount);
  discount = Math.min(discount, amount); // never discount more than the total

  return { valid: true, discount: Math.round(discount) };
};

module.exports = mongoose.model("Coupon", couponSchema);
