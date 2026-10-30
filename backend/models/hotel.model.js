
const mongoose = require("mongoose");
const { generateUniqueSlug } = require("../utils/slugify");

const hotelSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    // SEO-friendly URL slug (e.g. "taj-lake-palace-udaipur")
    slug: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      lowercase: true,
    },

    description: {
      type: String,
      required: true,
    },

    images: [{ url: String, public_id: String }],

    location: {
      address: { type: String, required: true },
      city: { type: String, required: true, index: true },
      state: { type: String },
      country: {
        type: String,
        required: true,
        default: "India",
      },
      coordinates: {
        lat: Number,
        lng: Number,
      },
    },

    amenities: [{ type: String }],

    hotelType: {
      type: String,
      enum: [
        "Budget",
        "Standard",
        "Luxury",
        "Resort",
        "Boutique",
        "Heritage",
      ],
      default: "Standard",
    },

    destination: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Destination",
      index: true,
    },

    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },

    numReviews: {
      type: Number,
      default: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // PRIVATE: Only admin endpoints explicitly select this field.
    ownerContact: {
      type: new mongoose.Schema(
        {
          name: String,
          phone: String,
          email: String,
        },
        { _id: false }
      ),
      select: false,
    },
  },
  { timestamps: true }
);

// Slug rules (same as packages):
//  - create            -> built from the name (or from the slug the admin typed)
//  - rename            -> slug is NOT changed, so Google/old links keep working
//  - admin edits slug  -> cleaned (lowercase, hyphens) and kept unique
//  - old hotel without a slug -> gets one the next time it is saved
hotelSchema.pre("validate", async function () {
  const adminChangedSlug = this.isModified("slug") && Boolean(this.slug);
  if (this.slug && !adminChangedSlug) return;

  const source = adminChangedSlug ? this.slug : this.name;
  if (!source) return;

  this.slug = await generateUniqueSlug(this.constructor, source, {
    excludeId: this._id,
    fallback: `hotel-${this._id.toString().slice(-6)}`,
  });
});

// Existing indexes
hotelSchema.index({
  name: "text",
  "location.city": "text",
  "location.country": "text",
});

hotelSchema.index({ isActive: 1, rating: -1 });
hotelSchema.index({ isActive: 1, hotelType: 1 });
hotelSchema.index({ amenities: 1 });

module.exports = mongoose.model("Hotel", hotelSchema);