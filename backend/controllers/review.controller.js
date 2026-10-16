const asyncHandler = require("express-async-handler");
const Review = require("../models/review.model");
const Booking = require("../models/booking.model");
const { deleteImage } = require("../config/cloudinary");
const { parsePagination, paginationMeta } = require("../utils/pagination");

const refreshRating = (review) => Review.recalculateRating(review.targetType, review.hotel || review.package);

// @route GET /api/reviews/eligibility?targetType=&targetId=
// Tells the UI whether to show the "Write a review" form: the user needs a COMPLETED booking they haven't reviewed yet.
const eligibility = asyncHandler(async (req, res) => {
  const { targetType, targetId } = req.query;
  const field = targetType === "hotel" ? "hotel" : "package";
  const bookings = await Booking.find({ user: req.user._id, bookingStatus: "completed", [field]: targetId }).select("_id bookingReference endDate").lean();
  const reviewed = await Review.find({ booking: { $in: bookings.map((b) => b._id) } }).distinct("booking");
  const reviewedSet = new Set(reviewed.map(String));
  const open = bookings.filter((b) => !reviewedSet.has(String(b._id)));
  res.status(200).json({
    success: true,
    canReview: open.length > 0,
    bookingId: open[0]?._id,
    reason: open.length ? undefined : bookings.length ? "You have already reviewed your stay" : "Only guests with a completed booking can leave a review",
  });
});

// @route POST /api/reviews   body { bookingId, rating, comment }
// Fake-review protection: the review is tied to YOUR completed booking; the target comes from the booking, not the client.
const createReview = asyncHandler(async (req, res) => {
  const { bookingId, rating, comment } = req.body;
  const booking = await Booking.findOne({ _id: bookingId, user: req.user._id });
  if (!booking) {
    res.status(404);
    throw new Error("Booking not found");
  }
  if (booking.bookingStatus !== "completed") {
    res.status(403);
    throw new Error("You can review a trip only after it is completed");
  }
  if (await Review.exists({ booking: booking._id })) {
    res.status(409);
    throw new Error("You have already reviewed this booking");
  }

  const targetType = booking.bookingType;
  const images = (req.files || []).map((f) => ({ url: f.path, public_id: f.filename }));
  const review = await Review.create({
    user: req.user._id,
    booking: booking._id,
    targetType,
    hotel: targetType === "hotel" ? booking.hotel : undefined,
    package: targetType === "package" ? booking.package : undefined,
    rating,
    comment,
    images,
    isVerifiedBooking: true,
  });
  await refreshRating(review);
  res.status(201).json({ success: true, review });
});

const listFor = (field) =>
  asyncHandler(async (req, res) => {
    const p = parsePagination(req.query, { defaultLimit: 20 });
    const q = { [field]: req.params[`${field}Id`] };
    const [reviews, total] = await Promise.all([
      Review.find(q).populate("user", "name avatar").sort({ createdAt: -1 }).skip(p.skip).limit(p.limit).lean(),
      Review.countDocuments(q),
    ]);
    res.status(200).json({ success: true, count: reviews.length, ...paginationMeta(p, total), reviews });
  });

const getHotelReviews = listFor("hotel");
const getPackageReviews = listFor("package");

// @route PUT /api/reviews/:id   (owner)
const updateReview = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) {
    res.status(404);
    throw new Error("Review not found");
  }
  if (String(review.user) !== String(req.user._id)) {
    res.status(403);
    throw new Error("Not authorized to edit this review");
  }
  if (req.body.rating !== undefined) review.rating = req.body.rating;
  if (req.body.comment !== undefined) review.comment = req.body.comment;
  if (req.files?.length) review.images.push(...req.files.map((f) => ({ url: f.path, public_id: f.filename })));
  await review.save();
  await refreshRating(review);
  res.status(200).json({ success: true, review });
});

// @route DELETE /api/reviews/:id   (owner or admin)
const deleteReview = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) {
    res.status(404);
    throw new Error("Review not found");
  }
  const isAdmin = req.user.role === "admin";
  if (String(review.user) !== String(req.user._id) && !isAdmin) {
    res.status(403);
    throw new Error("Not authorized to delete this review");
  }
  await Promise.all(review.images.map((img) => deleteImage(img.public_id)));
  await review.deleteOne();
  await refreshRating(review);
  res.status(200).json({ success: true, message: "Review deleted successfully" });
});

// @route GET /api/reviews   (admin)
const getAllReviews = asyncHandler(async (req, res) => {
  const p = parsePagination(req.query, { defaultLimit: 50 });
  const [reviews, total] = await Promise.all([
    Review.find().populate("user", "name avatar").populate("hotel", "name").populate("package", "name").sort({ createdAt: -1 }).skip(p.skip).limit(p.limit).lean(),
    Review.countDocuments(),
  ]);
  res.status(200).json({ success: true, count: reviews.length, ...paginationMeta(p, total), reviews });
});

module.exports = { eligibility, createReview, getHotelReviews, getPackageReviews, getAllReviews, updateReview, deleteReview };
