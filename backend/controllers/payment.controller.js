const asyncHandler = require("express-async-handler");
const Payment = require("../models/payment.model");
const Booking = require("../models/booking.model");
const paymentService = require("../services/payment.service");
const { parsePagination } = require("../utils/pagination");
const { safeRegex } = require("../utils/escapeRegex");
const logger = require("../utils/logger");

// @route POST /api/payment/create-order
const createOrder = asyncHandler(async (req, res) => {
  const { orderId, amount, currency, keyId } = await paymentService.createOrder(req.body.bookingId, req.user);
  res.status(201).json({ success: true, orderId, amount, currency, keyId });
});

// @route POST /api/payment/verify  - Never trust the browser: signature + Razorpay lookup + our own order record
const verifyPayment = asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  const result = await paymentService.verifyClientPayment({ orderId: razorpay_order_id, paymentId: razorpay_payment_id, signature: razorpay_signature }, req.user);
  if (result.refunded) {
    res.status(409);
    throw new Error(`${result.reason}. Your payment is being refunded.`);
  }
  res.status(200).json({ success: true, message: "Payment verified successfully", booking: result.booking, payment: result.payment, alreadyProcessed: !!result.alreadyProcessed });
});

// @route POST /api/payment/failed  - the browser reports a failed attempt (informational; webhook is authoritative)
const reportFailure = asyncHandler(async (req, res) => {
  const payment = await Payment.findOne({ razorpayOrderId: req.body.razorpay_order_id });
  if (payment && String(payment.user) === String(req.user._id)) {
    await paymentService.markPaymentFailed(payment.razorpayOrderId, req.body.reason || "Payment failed in checkout");
  }
  res.status(200).json({ success: true });
});

// @route POST /api/payment/webhook  (raw body - mounted in app.js before express.json)
const webhook = asyncHandler(async (req, res) => {
  try {
    const result = await paymentService.handleWebhook({
      rawBody: req.body,
      signature: req.get("x-razorpay-signature"),
      eventIdHeader: req.get("x-razorpay-event-id"),
    });
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    if (err.statusCode === 400) throw err; // bad signature -> 400, Razorpay will not keep retrying forever
    logger.error(`Webhook processing error: ${err.message}`, { stack: err.stack });
    res.status(500).json({ success: false }); // 5xx -> Razorpay retries later
  }
});

/* ------------------------- admin ------------------------- */

const adminFilter = (q) => {
  const f = {};
  if (q.status && q.status !== "all") f.status = q.status;
  if (q.gateway && q.gateway !== "all") f.gateway = q.gateway;
  if (q.startDate || q.endDate) {
    f.createdAt = {};
    if (q.startDate) f.createdAt.$gte = new Date(`${q.startDate}T00:00:00.000Z`);
    if (q.endDate) f.createdAt.$lte = new Date(`${q.endDate}T23:59:59.999Z`);
  }
  return f;
};

// @route GET /api/payment/admin
const adminList = asyncHandler(async (req, res) => {
  const p = parsePagination(req.query, { defaultLimit: 10 });
  const filter = adminFilter(req.query);
  if (req.query.search) {
    const rx = safeRegex(req.query.search);
    filter.$or = [{ razorpayOrderId: rx }, { razorpayPaymentId: rx }];
  }
  const sort = req.query.sort === "amount_desc" ? { amount: -1 } : req.query.sort === "amount_asc" ? { amount: 1 } : { createdAt: -1 };

  const [data, total] = await Promise.all([
    Payment.find(filter)
      .populate("user", "name email phone")
      .populate("booking", "bookingReference bookingStatus paymentStatus pricing checkIn checkOut travelDate guests")
      .sort(sort)
      .skip(p.skip)
      .limit(p.limit),
    Payment.countDocuments(filter),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / p.limit));
  res.status(200).json({ success: true, data, pagination: { page: p.page, limit: p.limit, total, totalPages, hasNextPage: p.page < totalPages, hasPreviousPage: p.page > 1 } });
});

// @route GET /api/payment/admin/stats
const adminStats = asyncHandler(async (req, res) => {
  const rows = await Payment.aggregate([
    { $match: adminFilter(req.query) },
    { $group: { _id: "$status", count: { $sum: 1 }, amount: { $sum: "$amount" }, refunded: { $sum: "$refundedAmount" } } },
  ]);
  const by = Object.fromEntries(rows.map((r) => [r._id, r]));
  const sum = (keys, f) => keys.reduce((s, k) => s + (by[k]?.[f] || 0), 0);
  const paidKeys = ["paid", "partially_refunded", "refunded"];
  res.status(200).json({
    success: true,
    data: {
      totalPayments: rows.reduce((s, r) => s + r.count, 0),
      totalAmount: rows.reduce((s, r) => s + r.amount, 0),
      successfulPayments: sum(paidKeys, "count"),
      successfulRevenue: sum(paidKeys, "amount") - rows.reduce((s, r) => s + r.refunded, 0),
      pendingPayments: sum(["created"], "count"),
      pendingAmount: sum(["created"], "amount"),
      failedPayments: sum(["failed"], "count"),
      failedAmount: sum(["failed"], "amount"),
      refundedPayments: sum(["refunded", "partially_refunded"], "count"),
      refundedAmount: rows.reduce((s, r) => s + r.refunded, 0),
    },
  });
});

// @route GET /api/payment/admin/revenue?groupBy=day|month|year
const adminRevenue = asyncHandler(async (req, res) => {
  const len = { day: 10, month: 7, year: 4 }[req.query.groupBy] || 10; // slice length of the ISO date
  const buckets = new Map();
  const cursor = Payment.find({ ...adminFilter(req.query), status: { $in: ["paid", "partially_refunded", "refunded"] } }).select("amount refundedAmount paidAt").lean().cursor();
  for await (const p of cursor) {
    const key = new Date(p.paidAt).toISOString().slice(0, len);
    const b = buckets.get(key) || { date: key, revenue: 0, payments: 0, refunds: 0 };
    b.revenue += p.amount;
    b.refunds += p.refundedAmount || 0;
    b.payments += 1;
    buckets.set(key, b);
  }
  const data = [...buckets.values()].map((b) => ({ ...b, netRevenue: b.revenue - b.refunds })).sort((a, b) => a.date.localeCompare(b.date));
  res.status(200).json({ success: true, data });
});

// @route GET /api/payment/admin/:id
const adminGet = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id)
    .populate("user", "name email phone")
    .populate("booking", "bookingReference bookingStatus paymentStatus pricing checkIn checkOut travelDate guests package hotel");
  if (!payment) {
    res.status(404);
    throw new Error("Payment not found");
  }
  res.status(200).json({ success: true, data: payment });
});

// @route POST /api/payment/admin/:id/refund   body { amount?, reason? }
// A refund from the admin panel also cancels the booking and frees its inventory.
const adminRefund = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id);
  if (!payment) {
    res.status(404);
    throw new Error("Payment not found");
  }
  const amount = req.body.amount || payment.amount - (payment.refundedAmount || 0);
  await paymentService.refundPayment(payment, amount, req.body.reason || "Refunded by admin", req.user._id);

  const booking = await Booking.findById(payment.booking);
  if (booking && ["pending", "confirmed"].includes(booking.bookingStatus)) {
    booking.paymentStatus = payment.status;
    booking.cancellation = { cancelledAt: new Date(), cancelledBy: req.user._id, reason: req.body.reason || "Refunded by admin", refundAmount: amount, refundPercent: Math.round((amount / booking.pricing.totalAmount) * 100) };
    booking.setStatus("refunded", { by: req.user._id, note: "Refunded by admin" });
    await booking.save();
  } else if (booking) {
    booking.paymentStatus = payment.status;
    await booking.save();
  }
  res.status(200).json({ success: true, message: "Refund processed successfully", data: payment });
});

module.exports = { createOrder, verifyPayment, reportFailure, webhook, adminList, adminStats, adminRevenue, adminGet, adminRefund };
