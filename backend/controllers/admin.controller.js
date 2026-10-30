const asyncHandler = require("express-async-handler");
const User = require("../models/user.model");
const Hotel = require("../models/hotel.model");
const Destination = require("../models/destination.model");
const Package = require("../models/package.model");
const Booking = require("../models/booking.model");
const Payment = require("../models/payment.model");
const Review = require("../models/review.model");
const cache = require("../utils/cache");

const PAID = ["paid", "partially_refunded", "refunded"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Revenue per calendar month, zero-filled so charts have no gaps. Net = collected - refunded.
// Bucketed in JS from a lean, streamed projection (only 3 fields per payment) - portable across Mongo-compatible servers.
const monthlyRevenue = async (months = 12) => {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));
  const buckets = new Map();
  const cursor = Payment.find({ status: { $in: PAID }, paidAt: { $gte: from } }).select("amount refundedAmount paidAt").lean().cursor();
  for await (const p of cursor) {
    const d = new Date(p.paidAt);
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`;
    const b = buckets.get(key) || { revenue: 0, refunds: 0, payments: 0 };
    b.revenue += p.amount;
    b.refunds += p.refundedAmount || 0;
    b.payments += 1;
    buckets.set(key, b);
  }
  return Array.from({ length: months }, (_, i) => {
    const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + i, 1));
    const r = buckets.get(`${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`);
    return {
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      label: `${MONTHS[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(-2)}`,
      revenue: r?.revenue || 0,
      refunds: r?.refunds || 0,
      net: (r?.revenue || 0) - (r?.refunds || 0),
      payments: r?.payments || 0,
    };
  });
};

// Most-booked destinations. A booking points at a package OR a hotel; both belong to a destination.
// (Grouped in the DB, then resolved to destinations in JS - avoids $lookup so it also runs on Mongo-compatible servers.)
const popularDestinations = async (limit = 5) => {
  const rows = await Booking.aggregate([
    { $match: { bookingStatus: { $in: ["confirmed", "completed"] } } },
    { $group: { _id: { package: "$package", hotel: "$hotel" }, bookings: { $sum: 1 }, revenue: { $sum: "$pricing.totalAmount" } } },
  ]);
  const pkgIds = rows.map((r) => r._id.package).filter(Boolean);
  const hotelIds = rows.map((r) => r._id.hotel).filter(Boolean);
  const [pkgs, hotels] = await Promise.all([Package.find({ _id: { $in: pkgIds } }).select("destination").lean(), Hotel.find({ _id: { $in: hotelIds } }).select("destination").lean()]);
  const destOf = new Map([...pkgs, ...hotels].map((x) => [String(x._id), x.destination && String(x.destination)]));

  const totals = new Map();
  rows.forEach((r) => {
    const dest = destOf.get(String(r._id.package || r._id.hotel));
    if (!dest) return;
    const t = totals.get(dest) || { bookings: 0, revenue: 0 };
    totals.set(dest, { bookings: t.bookings + r.bookings, revenue: t.revenue + r.revenue });
  });
  const top = [...totals.entries()].sort((a, b) => b[1].bookings - a[1].bookings || b[1].revenue - a[1].revenue).slice(0, limit);
  const dests = await Destination.find({ _id: { $in: top.map(([id]) => id) } }).select("name state").lean();
  const byId = new Map(dests.map((d) => [String(d._id), d]));
  return top.map(([id, t]) => ({ _id: id, ...t, name: byId.get(id)?.name, state: byId.get(id)?.state }));
};

const popularPackages = async (limit = 5) => {
  const rows = await Booking.aggregate([
    { $match: { bookingType: "package", bookingStatus: { $in: ["confirmed", "completed"] } } },
    { $group: { _id: "$package", bookings: { $sum: 1 }, adults: { $sum: "$guests.adults" }, children: { $sum: "$guests.children" }, revenue: { $sum: "$pricing.totalAmount" } } },
    { $sort: { bookings: -1, revenue: -1 } },
    { $limit: limit },
  ]);
  const pkgs = await Package.find({ _id: { $in: rows.map((r) => r._id) } }).select("name").lean();
  const names = new Map(pkgs.map((p) => [String(p._id), p.name]));
  return rows.map((r) => ({ _id: r._id, bookings: r.bookings, travellers: r.adults + r.children, revenue: r.revenue, name: names.get(String(r._id)) }));
};

// @route GET /api/admin/dashboard   - one call powers the whole dashboard (stats + charts)
const getDashboard = asyncHandler(async (req, res) => {
  const cached = cache.get("admin:dashboard");
  if (cached) return res.status(200).json(cached);

  const [users, hotels, destinations, packages, bookings, reviews, byStatus, byType, revenueAgg, monthly, topDest, topPkg, recentBookings] = await Promise.all([
    User.countDocuments(),
    Hotel.countDocuments(),
    Destination.countDocuments(),
    Package.countDocuments(),
    Booking.countDocuments(),
    Review.countDocuments(),
    Booking.aggregate([{ $group: { _id: "$bookingStatus", count: { $sum: 1 } } }]),
    Booking.aggregate([{ $group: { _id: "$bookingType", count: { $sum: 1 } } }]),
    Payment.aggregate([{ $match: { status: { $in: PAID } } }, { $group: { _id: null, gross: { $sum: "$amount" }, refunds: { $sum: "$refundedAmount" } } }]),
    monthlyRevenue(12),
    popularDestinations(5),
    popularPackages(5),
    Booking.find().populate("user", "name email").populate("package", "name").populate("hotel", "name").sort({ createdAt: -1 }).limit(6).lean(),
  ]);

  const n = (s) => byStatus.find((x) => x._id === s)?.count || 0;
  const gross = revenueAgg[0]?.gross || 0;
  const refunds = revenueAgg[0]?.refunds || 0;

  const body = {
    success: true,
    stats: {
      totalUsers: users,
      totalHotels: hotels,
      totalDestinations: destinations,
      totalPackages: packages,
      totalBookings: bookings,
      totalReviews: reviews,
      totalRevenue: gross - refunds, // net revenue
      grossRevenue: gross,
      refundedAmount: refunds,
      pendingBookings: n("pending"),
      pendingRequests: n("pending_confirmation"), // hotel requests waiting for the admin to contact the hotel
      awaitingApproval: n("awaiting_approval"), // final price sent, waiting for the customer
      confirmedBookings: n("confirmed"),
      completedBookings: n("completed"),
      cancelledBookings: n("cancelled") + n("refunded"),
      failedBookings: n("failed") + n("expired"),
    },
    bookingsByStatus: byStatus,
    bookingsByType: byType,
    monthlyRevenue: monthly,
    popularDestinations: topDest,
    popularPackages: topPkg,
    recentBookings,
  };
  cache.set("admin:dashboard", body, 30);
  res.status(200).json(body);
});

// @route GET /api/admin/reports/revenue?months=12
const getRevenueReport = asyncHandler(async (req, res) => {
  const months = Math.min(36, Math.max(1, Number(req.query.months) || 12));
  const data = await monthlyRevenue(months);
  // shape kept compatible with the Reports page: [{ _id:{year,month}, total, count }]
  res.status(200).json({ success: true, months: data, revenue: data.map((m) => ({ _id: { year: m.year, month: m.month }, total: m.net, count: m.payments })) });
});

// @route GET /api/admin/reports/bookings
const getBookingReport = asyncHandler(async (req, res) => {
  const [byStatus, byType] = await Promise.all([
    Booking.aggregate([{ $group: { _id: "$bookingStatus", count: { $sum: 1 } } }]),
    Booking.aggregate([{ $group: { _id: "$bookingType", count: { $sum: 1 } } }]),
  ]);
  res.status(200).json({ success: true, byStatus, byType });
});

// @route GET /api/admin/reports/payments
const getPaymentReport = asyncHandler(async (req, res) => {
  const [byStatus, byGateway] = await Promise.all([
    Payment.aggregate([{ $group: { _id: "$status", count: { $sum: 1 }, amount: { $sum: "$amount" } } }, { $sort: { count: -1 } }]),
    Payment.aggregate([{ $group: { _id: "$gateway", count: { $sum: 1 }, amount: { $sum: "$amount" } } }, { $sort: { amount: -1 } }]),
  ]);
  res.status(200).json({ success: true, byStatus, byGateway });
});

module.exports = { getDashboard, getRevenueReport, getBookingReport, getPaymentReport, monthlyRevenue };
