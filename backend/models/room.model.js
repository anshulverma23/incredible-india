const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema(
  {
    hotel: { type: mongoose.Schema.Types.ObjectId, ref: "Hotel", required: true, index: true },
    roomType: {
      type: String,
      enum: ["Single", "Double", "Twin", "Deluxe", "Suite", "Family"],
      required: true,
    },
    price: { type: Number, required: true, min: 0 }, // price per night, in INR
    capacity: { type: Number, required: true, default: 2, min: 1 },
    totalRooms: { type: Number, required: true, default: 1, min: 1 },
    amenities: [{ type: String }],
    images: [{ url: String, public_id: String }],
    isAvailable: { type: Boolean, default: true },
  },
  { timestamps: true }
);

roomSchema.index({ hotel: 1, price: 1 });
roomSchema.index({ price: 1 });

module.exports = mongoose.model("Room", roomSchema);
