const asyncHandler = require("express-async-handler");
const Booking = require("../models/booking.model");
const Payment = require("../models/payment.model");
const bookingService = require("../services/booking.service");
const { buildInvoice } = require("../utils/invoice");
const { parsePagination, paginationMeta } = require("../utils/pagination");
const { safeRegex } = require("../utils/escapeRegex");

// @route POST /api/bookings   (header: Idempotency-Key optional)
const createBooking = asyncHandler(async (req, res) => {
  const key = req.get("Idempotency-Key")?.slice(0, 100);
  const { booking, existing } = await bookingService.createBooking(req.user, req.body, key);
  res.status(existing ? 200 : 201).json({ success: true, existing, booking });
});

// @route GET /api/bookings/my?status=&page=&limit=   (booking history)
const getMyBookings = asyncHandler(async (req, res) => {
  const p = parsePagination(req.query, { defaultLimit: 20 });
  const query = { user: req.user._id };
  if (req.query.status) query.bookingStatus = req.query.status;

  const [bookings, total] = await Promise.all([
    Booking.find(query)
      .populate("hotel", "name images location")
      .populate("room", "roomType price")
      .populate("package", "name gallery duration")
      .sort({ createdAt: -1 })
      .skip(p.skip)
      .limit(p.limit)
      .lean(),
    Booking.countDocuments(query),
  ]);
  res.status(200).json({ success: true, count: bookings.length, ...paginationMeta(p, total), bookings });
});

const canSee = async (user, booking) => {
  if (String(booking.user._id || booking.user) === String(user._id)) return true;
  return user.role === "admin";
};

// @route GET /api/bookings/:id
const getBookingById = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id)
    .populate("hotel")
    .populate("room")
    .populate("package")
    .populate("user", "name email phone")
    .populate("coupon", "code discountType discountValue");
  if (!booking) {
    res.status(404);
    throw new Error("Booking not found");
  }
  if (!(await canSee(req.user, booking))) {
    res.status(403);
    throw new Error("Not authorized to view this booking");
  }
  const refundPreview = booking.bookingStatus === "confirmed" ? bookingService.previewRefund(booking) : undefined;
  res.status(200).json({ success: true, booking, refundPreview });
});

// @route PUT /api/bookings/:id/cancel
const cancelBooking = asyncHandler(async (req, res) => {
  const { booking, refund } = await bookingService.cancelBooking(req.params.id, req.user, req.body);
  res.status(200).json({ success: true, message: "Booking cancelled", booking, refund });
});

// @route GET /api/bookings   (admin)
const getAllBookings = asyncHandler(async (req, res) => {
  const { status, paymentStatus, type, search, from, to } = req.query;
  const p = parsePagination(req.query, { defaultLimit: 20 });
  const query = {};
  if (status) query.bookingStatus = status;
  if (paymentStatus) query.paymentStatus = paymentStatus;
  if (type) query.bookingType = type;
  if (search) query.bookingReference = safeRegex(search);
  if (from || to) query.createdAt = { ...(from && { $gte: from }), ...(to && { $lte: to }) };

  const [bookings, total] = await Promise.all([
    Booking.find(query).populate("user", "name email").populate("hotel", "name").populate("package", "name").sort({ createdAt: -1 }).skip(p.skip).limit(p.limit).lean(),
    Booking.countDocuments(query),
  ]);
  res.status(200).json({ success: true, count: bookings.length, ...paginationMeta(p, total), bookings });
});

// Allowed manual transitions for admins (money-moving transitions go through cancel/refund instead)
const MANUAL = { pending: ["failed"], confirmed: ["completed"], completed: [] };

// @route PUT /api/bookings/:id/status   (admin)
const updateBookingStatus = asyncHandler(async (req, res) => {
  const { bookingStatus } = req.body;
  const booking = await Booking.findById(req.params.id);
  if (!booking) {
    res.status(404);
    throw new Error("Booking not found");
  }
  if (bookingStatus === "cancelled" || bookingStatus === "refunded") {
    res.status(400);
    throw new Error("Use the cancel endpoint so refunds and notifications are handled correctly");
  }
  if (bookingStatus === "confirmed" && booking.paymentStatus !== "paid") {
    res.status(400);
    throw new Error("A booking can only be confirmed after payment is received");
  }
  if (!(MANUAL[booking.bookingStatus] || []).includes(bookingStatus) && bookingStatus !== booking.bookingStatus) {
    res.status(400);
    throw new Error(`Cannot change a ${booking.bookingStatus} booking to ${bookingStatus}`);
  }
  booking.setStatus(bookingStatus, { by: req.user._id, note: "Changed by admin" });
  await booking.save();
  res.status(200).json({ success: true, booking });
});

// @route GET /api/bookings/:id/invoice   (only once the booking has been paid)
const generateInvoice = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id).populate("user", "name email phone").populate("hotel", "name location").populate("package", "name");
  if (!booking) {
    res.status(404);
    throw new Error("Booking not found");
  }
  if (!(await canSee(req.user, booking))) {
    res.status(403);
    throw new Error("Not authorized to view this invoice");
  }
  if (!["paid", "partially_refunded", "refunded"].includes(booking.paymentStatus)) {
    res.status(400);
    throw new Error("Invoice is available once the booking is paid");
  }
  const payment = booking.payment ? await Payment.findById(booking.payment) : null;

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${booking.invoiceNumber}.pdf"`);
  buildInvoice(booking, payment, res);
});

// @route PUT /api/bookings/:id/apply-coupon
const applyCoupon = asyncHandler(async (req, res) => {
  const booking = await bookingService.applyCouponToBooking(req.params.id, req.user, req.body.couponCode);
  res.status(200).json({ success: true, booking });
});

module.exports = { createBooking, getMyBookings, getBookingById, cancelBooking, getAllBookings, updateBookingStatus, generateInvoice, applyCoupon };
