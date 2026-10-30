const mongoose = require("mongoose");
const { generateUniqueSlug } = require("../utils/slugify");

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

// Slug rules (SEO-friendly URL):
//  - create            -> built from the name (or from the slug the admin typed)
//  - rename            -> slug is NOT changed, so Google/old links keep working
//  - admin edits slug  -> cleaned (lowercase, hyphens) and kept unique
//  - old package without a slug -> gets one the next time it is saved
packageSchema.pre("validate", async function () {
  const adminChangedSlug = this.isModified("slug") && Boolean(this.slug);
  if (this.slug && !adminChangedSlug) return;

  const source = adminChangedSlug ? this.slug : this.name;
  if (!source) return;

  this.slug = await generateUniqueSlug(this.constructor, source, {
    excludeId: this._id,
    fallback: `package-${this._id.toString().slice(-6)}`,
  });
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