const { z } = require("zod");
const { objectId } = require("./common");

const createOrder = z.object({ bookingId: objectId });

const verify = z.object({
  razorpay_order_id: z.string().min(5).max(64),
  razorpay_payment_id: z.string().min(5).max(64),
  razorpay_signature: z.string().min(10).max(256),
});

const reportFailure = z.object({
  razorpay_order_id: z.string().min(5).max(64),
  reason: z.string().max(300).optional(),
});

const refund = z.object({
  amount: z.coerce.number().int().positive().optional(),
  reason: z.string().trim().max(300).optional(),
});

module.exports = { createOrder, verify, reportFailure, refund };
