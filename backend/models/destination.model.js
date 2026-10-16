const mongoose = require("mongoose");

// Points of interest used by the Travel Itinerary Engine (services/itinerary.service.js).
const attractionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    area: { type: String, required: true, trim: true }, // must match one of destination.areas (e.g. "Gulmarg")
    categories: [{ type: String, trim: true }], // Adventure, Nature, Culture, Heritage, Spiritual, Food, Relaxation, Wildlife, Shopping
    durationHours: { type: Number, default: 3, min: 0.5, max: 12 },
    estimatedCost: { type: Number, default: 0, min: 0 }, // INR per person (entry/activity fee)
    timeOfDay: { type: String, enum: ["morning", "afternoon", "evening", "any"], default: "any" },
  },
  { _id: false }
);

const destinationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    country: { type: String, required: true, default: "India" },
    state: { type: String, required: true, index: true },
    city: { type: String, required: true },
    description: { type: String, required: true },
    gallery: [{ url: String, public_id: String }],
    coordinates: {
      lat: Number,
      lng: Number,
    },
    bestTimeToVisit: { type: String }, // e.g. "October to March"
    tags: [{ type: String }], // e.g. Heritage, Beach, Hill Station, Wildlife
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    // ---- itinerary engine data ----
    // Ordered circuit of sub-areas; the FIRST one is the arrival/departure hub (e.g. Srinagar, Gulmarg, Pahalgam, Sonamarg).
    areas: [{ type: String, trim: true }],
    attractions: [attractionSchema],
    // Average cost per person per day (stay + food + local transport) by travel style, in INR.
    costPerDay: {
      budget: { type: Number, default: 1800 },
      standard: { type: Number, default: 3500 },
      luxury: { type: Number, default: 7500 },
    },
  },
  { timestamps: true }
);

destinationSchema.index({ name: "text", city: "text", state: "text", country: "text" });
destinationSchema.index({ isActive: 1, createdAt: -1 });
destinationSchema.index({ tags: 1 });

module.exports = mongoose.model("Destination", destinationSchema);
