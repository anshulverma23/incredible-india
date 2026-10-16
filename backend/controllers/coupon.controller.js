const asyncHandler = require("express-async-handler");
const Coupon = require("../models/coupon.model");
const CouponUsage = require("../models/couponUsage.model");
const { parsePagination, paginationMeta } = require("../utils/pagination");

// @route POST /api/coupons/validate   body { code, amount, bookingType }
const validateCoupon = asyncHandler(async (req, res) => {
  const { code, amount, bookingType } = req.body;
  const coupon = await Coupon.findOne({ code: code.toUpperCase() });
  if (!coupon) {
    res.status(404);
    throw new Error("Invalid coupon code");
  }
  const used = await CouponUsage.countDocuments({ coupon: coupon._id, user: req.user._id });
  const result = coupon.calculateDiscount(amount, bookingType, used);
  if (!result.valid) {
    res.status(400);
    throw new Error(result.message);
  }
  res.status(200).json({ success: true, discount: result.discount, coupon: coupon.code, payable: amount - result.discount });
});

// @route GET /api/coupons   (admin)
const getCoupons = asyncHandler(async (req, res) => {
  const p = parsePagination(req.query, { defaultLimit: 50 });
  const [coupons, total] = await Promise.all([Coupon.find().sort({ createdAt: -1 }).skip(p.skip).limit(p.limit).lean(), Coupon.countDocuments()]);
  res.status(200).json({ success: true, count: coupons.length, ...paginationMeta(p, total), coupons });
});

// @route POST /api/coupons   (admin)
const createCoupon = asyncHandler(async (req, res) => {
  const coupon = await Coupon.create({ ...req.body, createdBy: req.user._id });
  res.status(201).json({ success: true, coupon });
});

// @route PUT /api/coupons/:id   (admin)
const updateCoupon = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findById(req.params.id);
  if (!coupon) {
    res.status(404);
    throw new Error("Coupon not found");
  }
  Object.assign(coupon, req.body);
  await coupon.save();
  res.status(200).json({ success: true, coupon });
});

// @route DELETE /api/coupons/:id   (admin) - coupons already redeemed are deactivated instead, to keep booking history intact
const deleteCoupon = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findById(req.params.id);
  if (!coupon) {
    res.status(404);
    throw new Error("Coupon not found");
  }
  if (coupon.usedCount > 0) {
    coupon.isActive = false;
    await coupon.save();
    return res.status(200).json({ success: true, message: "Coupon has been redeemed before, so it was deactivated instead of deleted" });
  }
  await coupon.deleteOne();
  res.status(200).json({ success: true, message: "Coupon deleted successfully" });
});

module.exports = { validateCoupon, getCoupons, createCoupon, updateCoupon, deleteCoupon };
