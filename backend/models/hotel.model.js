
const mongoose = require("mongoose");

const hotelSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    // SEO-friendly hotel URL
    slug: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
      sparse: true,
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

// Existing indexes
hotelSchema.index({
  name: "text",
  "location.city": "text",
  "location.country": "text",
});

hotelSchema.index({ isActive: 1, rating: -1 });
hotelSchema.index({ isActive: 1, hotelType: 1 });
hotelSchema.index({ amenities: 1 });

// Slug lookup
hotelSchema.index(
  { slug: 1 },
  { unique: true, sparse: true }
);

module.exports = mongoose.model("Hotel", hotelSchema);