const mongoose = require("mongoose");
const { generateBookingReference } = require("../utils/bookingRef");

// Hotel request flow:  pending_confirmation -> awaiting_approval -> pending (awaiting payment) -> confirmed
//                      (or "declined" when the hotel cannot host the stay)
// Packages skip the first two steps and start at "pending" (awaiting payment).
const BOOKING_STATUSES = ["pending_confirmation", "awaiting_approval", "pending", "confirmed", "cancelled", "failed", "refunded", "completed", "expired", "declined"];
const PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded", "partially_refunded"];

// Statuses that still occupy inventory (rooms / package seats). Everything else frees the slot.
// A "pending" booking only holds inventory until `expiresAt`.
const INVENTORY_STATUSES = ["pending", "confirmed", "completed"];

const statusHistorySchema = new mongoose.Schema(
  {
    status: String,
    at: { type: Date, default: Date.now },
    by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    note: String,
  },
  { _id: false }
);

// Internal notes written by admins (e.g. "Called hotel owner, 2 rooms free"). Never sent to customers.
const adminNoteSchema = new mongoose.Schema(
  {
    note: { type: String, required: true, maxlength: 1000 },
    by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const bookingSchema = new mongoose.Schema(
  {
    bookingReference: { type: String, unique: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    bookingType: { type: String, enum: ["hotel", "package"], required: true },

    // Hotel booking fields
    hotel: { type: mongoose.Schema.Types.ObjectId, ref: "Hotel", index: true },
    room: { type: mongoose.Schema.Types.ObjectId, ref: "Room", index: true },
    numberOfRooms: { type: Number, default: 1, min: 1 },
    checkIn: { type: Date },
    checkOut: { type: Date },

    // Package booking fields
    package: { type: mongoose.Schema.Types.ObjectId, ref: "Package", index: true },
    travelDate: { type: Date },
    endDate: { type: Date }, // computed: checkOut for hotels, travelDate + duration for packages

    guests: {
      adults: { type: Number, default: 1, min: 1 },
      children: { type: Number, default: 0, min: 0 },
    },

    coupon: { type: mongoose.Schema.Types.ObjectId, ref: "Coupon" },
    couponCode: String,

    pricing: {
      basePrice: { type: Number, required: true, min: 0 },
      discount: { type: Number, default: 0, min: 0 },
      tax: { type: Number, default: 0, min: 0 },
      totalAmount: { type: Number, required: true, min: 0 },
    },

    // Hotel request flow: `pricing` holds an ESTIMATE until the admin sends the final price in `quote`.
    estimatedBasePrice: { type: Number, min: 0 },
    quote: {
      amount: { type: Number, min: 0 }, // final price agreed with the hotel (before tax)
      note: { type: String, maxlength: 500 }, // message shown to the customer
      sentAt: Date,
      sentBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      validUntil: Date,
    },
    approvedAt: Date, // customer accepted the final price -> payment window starts here
    declineReason: { type: String, maxlength: 500 },
    adminNotes: { type: [adminNoteSchema], default: [], select: false },

    payment: { type: mongoose.Schema.Types.ObjectId, ref: "Payment" },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: "pending", index: true },
    bookingStatus: { type: String, enum: BOOKING_STATUSES, default: "pending", index: true },
    statusHistory: { type: [statusHistorySchema], default: [] },

    // Unpaid bookings hold inventory only until this time; a cron job flips them to "expired".
    expiresAt: { type: Date },

    // Duplicate-protection: same Idempotency-Key from the same user returns the same booking.
    idempotencyKey: { type: String },

    cancellation: {
      cancelledAt: Date,
      cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      reason: String,
      refundPercent: Number,
      refundAmount: Number,
    },

    invoiceNumber: { type: String, unique: true, sparse: true },
    confirmedAt: Date,
    reminderSent: { type: Boolean, default: false },
    specialRequests: { type: String, maxlength: 500 },
  },
  { timestamps: true }
);

// ---- Indexes (query-driven) ----
bookingSchema.index({ user: 1, createdAt: -1 }); // "my bookings"
bookingSchema.index({ user: 1, idempotencyKey: 1 }, { unique: true, sparse: true });
bookingSchema.index({ bookingStatus: 1, expiresAt: 1 }); // expiry job
bookingSchema.index({ bookingStatus: 1, endDate: 1 }); // completion job
bookingSchema.index({ bookingStatus: 1, travelDate: 1, reminderSent: 1 }); // reminders
bookingSchema.index({ room: 1, checkIn: 1, checkOut: 1 }); // hotel availability
bookingSchema.index({ package: 1, travelDate: 1 }); // package seats
bookingSchema.index({ createdAt: -1 });

bookingSchema.pre("validate", function (next) {
  if (!this.bookingReference) this.bookingReference = generateBookingReference();
  if (!this.invoiceNumber) this.invoiceNumber = `INV-${this.bookingReference.slice(3)}`;
  next();
});

// Convenience: push a status change into the audit trail
bookingSchema.methods.setStatus = function (status, { by, note } = {}) {
  this.bookingStatus = status;
  this.statusHistory.push({ status, by, note, at: new Date() });
};

bookingSchema.statics.INVENTORY_STATUSES = INVENTORY_STATUSES;
bookingSchema.statics.BOOKING_STATUSES = BOOKING_STATUSES;

/**
 * Filter fragment: bookings that currently block inventory.
 * confirmed/completed always; "pending" (awaiting payment) and "awaiting_approval" (price quoted, rooms reserved
 * for the customer) only until their `expiresAt`. A plain request ("pending_confirmation") holds nothing.
 */
bookingSchema.statics.activeHoldFilter = function (now = new Date()) {
  return {
    $or: [
      { bookingStatus: { $in: ["confirmed", "completed"] } },
      { bookingStatus: { $in: ["pending", "awaiting_approval"] }, expiresAt: { $gt: now } },
    ],
  };
};

module.exports = mongoose.model("Booking", bookingSchema);
