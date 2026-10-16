const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    // The completed booking that entitles the user to review. One review per booking => no fake / duplicate reviews.
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true },
    targetType: { type: String, enum: ["hotel", "package"], required: true },
    hotel: { type: mongoose.Schema.Types.ObjectId, ref: "Hotel" },
    package: { type: mongoose.Schema.Types.ObjectId, ref: "Package" },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true, trim: true, minlength: 5, maxlength: 1500 },
    images: [{ url: String, public_id: String }],
    isVerifiedBooking: { type: Boolean, default: true },
  },
  { timestamps: true }
);

reviewSchema.index({ booking: 1 }, { unique: true });
reviewSchema.index({ hotel: 1, createdAt: -1 });
reviewSchema.index({ package: 1, createdAt: -1 });
reviewSchema.index({ user: 1, createdAt: -1 });

// Recalculates the parent Hotel/Package's average rating + review count.
// NOTE: aggregate() does NOT auto-cast strings to ObjectId, so we cast explicitly.
reviewSchema.statics.recalculateRating = async function (targetType, targetId) {
  const Model = targetType === "hotel" ? require("./hotel.model") : require("./package.model");
  const field = targetType === "hotel" ? "hotel" : "package";
  const id = new mongoose.Types.ObjectId(String(targetId));

  const [stats, count] = await Promise.all([
    this.aggregate([{ $match: { [field]: id } }, { $group: { _id: null, total: { $sum: "$rating" } } }]),
    this.countDocuments({ [field]: id }),
  ]);

  await Model.findByIdAndUpdate(id, {
    rating: count ? Math.round(((stats[0]?.total || 0) / count) * 10) / 10 : 0,
    numReviews: count,
  });
};

module.exports = mongoose.model("Review", reviewSchema);
