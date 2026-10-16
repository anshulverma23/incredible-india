const mongoose = require("mongoose");

// One wishlist document per user, holding Destinations, Hotels and Packages (polymorphic via refPath).
const wishlistSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    items: [
      {
        // Stores the exact Mongoose model name because refPath resolves the model from this literal value.
        itemType: { type: String, enum: ["Destination", "Hotel", "Package"], required: true },
        item: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: "items.itemType" },
        addedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

wishlistSchema.index({ "items.item": 1 });

module.exports = mongoose.model("Wishlist", wishlistSchema);
