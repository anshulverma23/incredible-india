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
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    destination: { type: mongoose.Schema.Types.ObjectId, ref: "Destination", required: true },
    duration: {
      days: { type: Number, required: true, min: 1 },
      nights: { type: Number, required: true, min: 0 },
    },
    price: { type: Number, required: true, min: 0 }, // per person, in INR
    itinerary: [itineraryDaySchema],
    included: [{ type: String }],
    excluded: [{ type: String }],
    amenities: [{ type: String }], // e.g. Meals, Airport Transfer, Guide, Wi-Fi
    hotels: [{ type: mongoose.Schema.Types.ObjectId, ref: "Hotel" }], // hotels used on this tour
    gallery: [{ url: String, public_id: String }],
    // "Category" in the UI
    packageType: {
      type: String,
      enum: ["Adventure", "Luxury", "Family", "Honeymoon", "Pilgrimage", "Wildlife", "Cultural"],
      default: "Cultural",
    },
    maxGroupSize: { type: Number, default: 15, min: 1 }, // seats per departure date
    startDates: [{ type: Date }],
    rating: { type: Number, default: 0, min: 0, max: 5 },
    numReviews: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// Text search + indexes for every filter the search page offers
packageSchema.index({ name: "text", description: "text", packageType: "text" });
packageSchema.index({ isActive: 1, destination: 1 });
packageSchema.index({ isActive: 1, price: 1 });
packageSchema.index({ isActive: 1, packageType: 1, rating: -1 });
packageSchema.index({ isActive: 1, "duration.days": 1 });
packageSchema.index({ isActive: 1, rating: -1 });
packageSchema.index({ startDates: 1 });
packageSchema.index({ hotels: 1 });
packageSchema.index({ amenities: 1 });

module.exports = mongoose.model("Package", packageSchema);
