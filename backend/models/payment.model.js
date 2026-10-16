const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    gateway: { type: String, enum: ["razorpay"], default: "razorpay", required: true },

    razorpayOrderId: { type: String, unique: true, sparse: true },
    razorpayPaymentId: { type: String, unique: true, sparse: true },
    razorpaySignature: { type: String },
    method: String, // card / upi / netbanking ... (from webhook/fetch)

    amount: { type: Number, required: true, min: 0 }, // INR (rupees)
    currency: { type: String, default: "INR" },
    status: {
      type: String,
      enum: ["created", "paid", "failed", "refunded", "partially_refunded"],
      default: "created",
      index: true,
    },

    // Who/what confirmed the payment: the browser callback, the webhook, or the reconciliation job
    confirmedVia: { type: String, enum: ["client", "webhook", "reconcile"] },
    paidAt: Date,

    failureReason: String,
    failureCount: { type: Number, default: 0 },

    refunds: [
      {
        refundId: String,
        amount: Number,
        reason: String,
        status: { type: String, default: "processed" },
        at: { type: Date, default: Date.now },
        by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      },
    ],
    refundedAmount: { type: Number, default: 0 },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// Convenience fields the admin UI reads (derived from the refunds[] audit trail)
paymentSchema.virtual("refundAmount").get(function () {
  return this.refundedAmount || 0;
});
paymentSchema.virtual("refundId").get(function () {
  return this.refunds?.length ? this.refunds[this.refunds.length - 1].refundId : undefined;
});
paymentSchema.virtual("refundReason").get(function () {
  return this.refunds?.length ? this.refunds[this.refunds.length - 1].reason : undefined;
});
paymentSchema.virtual("refundedAt").get(function () {
  return this.refunds?.length ? this.refunds[this.refunds.length - 1].at : undefined;
});

paymentSchema.index({ createdAt: -1 });
paymentSchema.index({ status: 1, createdAt: -1 });
paymentSchema.index({ status: 1, razorpayOrderId: 1 }); // reconciliation job

module.exports = mongoose.model("Payment", paymentSchema);
