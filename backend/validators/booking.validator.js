const { z } = require("zod");
const { objectId, isoDate } = require("./common");

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

const adminStatus = z.object({ bookingStatus: z.enum(["pending", "confirmed", "cancelled", "failed", "refunded", "completed", "expired"]) });

const listQuery = z.object({
  status: z.enum(["pending", "confirmed", "cancelled", "failed", "refunded", "completed", "expired"]).optional(),
  paymentStatus: z.enum(["pending", "paid", "failed", "refunded", "partially_refunded"]).optional(),
  type: z.enum(["hotel", "package"]).optional(),
  search: z.string().trim().max(60).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

module.exports = { createBooking, applyCoupon, cancel, adminStatus, listQuery };
