const asyncHandler = require("express-async-handler");
const Wishlist = require("../models/wishlist.model");
const Destination = require("../models/destination.model");
const Hotel = require("../models/hotel.model");
const Package = require("../models/package.model");

const MODELS = { Destination, Hotel, Package };

// @route GET /api/wishlist
const getWishlist = asyncHandler(async (req, res) => {
  const wishlist =
    (await Wishlist.findOne({ user: req.user._id }).populate("items.item")) || (await Wishlist.create({ user: req.user._id, items: [] }));
  // Items whose target was deleted populate to null - hide them
  wishlist.items = wishlist.items.filter((i) => i.item);
  res.status(200).json({ success: true, wishlist });
});

// @route POST /api/wishlist   body { itemType: "Destination" | "Hotel" | "Package", itemId }
const addToWishlist = asyncHandler(async (req, res) => {
  const { itemType, itemId } = req.body;
  if (!(await MODELS[itemType].exists({ _id: itemId, isActive: true }))) {
    res.status(404);
    throw new Error(`${itemType} not found`);
  }

  // Atomic: the filter (`items.item $ne`) only matches if the item is NOT already present, so concurrent clicks can't create duplicates.
  try {
    await Wishlist.updateOne({ user: req.user._id }, { $setOnInsert: { user: req.user._id } }, { upsert: true });
  } catch (e) {
    if (e.code !== 11000) throw e; // another request created it first (unique index on user) - fine
  }
  const result = await Wishlist.updateOne(
    { user: req.user._id, "items.item": { $ne: itemId } },
    { $push: { items: { itemType, item: itemId, addedAt: new Date() } } }
  );
  const wishlist = await Wishlist.findOne({ user: req.user._id }).populate("items.item");
  res.status(result.modifiedCount ? 201 : 200).json({ success: true, added: !!result.modifiedCount, wishlist });
});

// @route DELETE /api/wishlist/:itemId
const removeFromWishlist = asyncHandler(async (req, res) => {
  const wishlist = await Wishlist.findOne({ user: req.user._id });
  if (!wishlist) {
    res.status(404);
    throw new Error("Wishlist not found");
  }
  wishlist.items = wishlist.items.filter((i) => String(i.item) !== String(req.params.itemId));
  await wishlist.save();
  await wishlist.populate("items.item");
  res.status(200).json({ success: true, wishlist });
});

module.exports = { getWishlist, addToWishlist, removeFromWishlist };
