
const mongoose = require("mongoose");

const itineraryDaySchema = new mongoose.Schema(
  {
    day: { type: Number, required: true },
    title: { type: String, required: true },
    description: { type: String },
  },
  { _id: false }
);

const packageSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    // SEO-friendly URL slug
    slug: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      lowercase: true,
    },

    description: { type: String, required: true },

    destination: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Destination",
      required: true,
    },

    duration: {
      days: { type: Number, required: true, min: 1 },
      nights: { type: Number, required: true, min: 0 },
    },

    price: { type: Number, required: true, min: 0 },

    itinerary: [itineraryDaySchema],
    included: [{ type: String }],
    excluded: [{ type: String }],
    amenities: [{ type: String }],

    hotels: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Hotel",
      },
    ],

    gallery: [{ url: String, public_id: String }],

    packageType: {
      type: String,
      enum: [
        "Adventure",
        "Luxury",
        "Family",
        "Honeymoon",
        "Pilgrimage",
        "Wildlife",
        "Cultural",
      ],
      default: "Cultural",
    },

    maxGroupSize: {
      type: Number,
      default: 15,
      min: 1,
    },

    startDates: [{ type: Date }],

    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },

    numReviews: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

// Generate a unique, URL-friendly slug from package name.
packageSchema.pre("validate", async function () {
  if (!this.name) return;

  // Generate only when creating, changing the name,
  // or repairing an older document without a slug.
  if (
    !this.isNew &&
    !this.isModified("name") &&
    this.slug
  ) {
    return;
  }

  const baseSlug = this.name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!baseSlug) {
    throw new Error("Package name cannot generate a valid slug");
  }

  const existing = await this.constructor
    .findOne({
      slug: baseSlug,
      _id: { $ne: this._id },
    })
    .select("_id")
    .lean();

  this.slug = existing
    ? `${baseSlug}-${this._id.toString().slice(-6)}`
    : baseSlug;
});

// Existing indexes
packageSchema.index({
  name: "text",
  description: "text",
  packageType: "text",
});

packageSchema.index({ isActive: 1, destination: 1 });
packageSchema.index({ isActive: 1, price: 1 });
packageSchema.index({ isActive: 1, packageType: 1, rating: -1 });
packageSchema.index({ isActive: 1, "duration.days": 1 });
packageSchema.index({ isActive: 1, rating: -1 });
packageSchema.index({ startDates: 1 });
packageSchema.index({ hotels: 1 });
packageSchema.index({ amenities: 1 });

module.exports = mongoose.model("Package", packageSchema);
