const { z } = require("zod");
const { objectId, isoDate } = require("./common");
const { HOTEL_REQUEST } = require("../config/policy");

const guests = z
  .object({
    adults: z.coerce.number().int().min(1, "At least 1 adult is required").max(30),
    children: z.coerce.number().int().min(0).max(30).default(0),
  })
  .default({ adults: 1, children: 0 });

const couponCode = z.string().trim().max(20).optional().or(z.literal(""));

const createBooking = z.discriminatedUnion("bookingType", [
  z.object({
    bookingType: z.literal("hotel"),
    hotelId: objectId.optional(),
    roomId: objectId,
    checkIn: isoDate,
    checkOut: isoDate,
    numberOfRooms: z.coerce.number().int().min(1).max(10).default(1),
    guests,
    couponCode,
    specialRequests: z.string().trim().max(500).optional(),
  }),
  z.object({
    bookingType: z.literal("package"),
    packageId: objectId,
    travelDate: isoDate,
    guests,
    couponCode,
    specialRequests: z.string().trim().max(500).optional(),
  }),
]);

const applyCoupon = z.object({ couponCode: z.string().trim().max(20).optional().or(z.literal("")) });

const cancel = z.object({
  reason: z.string().trim().max(300).optional(),
  // admin only: override the policy-based refund percentage
  refundPercent: z.coerce.number().min(0).max(100).optional(),
});

const ALL_STATUSES = ["pending_confirmation", "awaiting_approval", "pending", "confirmed", "cancelled", "failed", "refunded", "completed", "expired", "declined"];

const adminStatus = z.object({ bookingStatus: z.enum(ALL_STATUSES) });

// Admin -> customer: final price (before tax) agreed with the hotel owner
const sendQuote = z.object({
  finalPrice: z.coerce.number({ error: "Final price is required" }).int("Enter the price in whole rupees").min(1, "Price must be greater than 0").max(10_000_000),
  validHours: z.coerce.number().int().min(1).max(HOTEL_REQUEST.maxQuoteValidityHours).optional(),
  note: z.string().trim().max(500).optional(),
});

const declineRequest = z.object({ reason: z.string().trim().min(3, "Please give the customer a reason").max(500) });

const adminNote = z.object({ note: z.string().trim().min(1, "Note cannot be empty").max(1000) });

const listQuery = z.object({
  status: z.enum(ALL_STATUSES).optional(),
  paymentStatus: z.enum(["pending", "paid", "failed", "refunded", "partially_refunded"]).optional(),
  type: z.enum(["hotel", "package"]).optional(),
  search: z.string().trim().max(60).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

module.exports = { createBooking, applyCoupon, cancel, adminStatus, listQuery, sendQuote, declineRequest, adminNote };
