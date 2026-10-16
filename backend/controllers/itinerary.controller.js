const asyncHandler = require("express-async-handler");
const Itinerary = require("../models/itinerary.model");
const Destination = require("../models/destination.model");
const { generateItinerary } = require("../services/itinerary.service");
const cache = require("../utils/cache");

// @route POST /api/itinerary/generate   (public)
const generate = asyncHandler(async (req, res) => {
  const plan = await generateItinerary(req.body);
  res.status(200).json({ success: true, itinerary: plan });
});

// @route GET /api/itinerary/destinations   (destinations the engine can plan: those with attraction data)
const plannable = asyncHandler(async (req, res) => {
  const key = "itinerary:destinations";
  let list = cache.get(key);
  if (!list) {
    list = await Destination.find({ isActive: true, "attractions.0": { $exists: true } }).select("name city state tags").lean();
    cache.set(key, list, 300);
  }
  res.status(200).json({ success: true, destinations: list });
});

// @route POST /api/itinerary   save a generated plan to the account
const save = asyncHandler(async (req, res) => {
  const { input, plan, title } = req.body;
  const itinerary = await Itinerary.create({
    user: req.user._id,
    destination: plan?.destination?._id,
    title: title || `${input.days}-day ${plan?.destination?.name || input.destination} trip`,
    input,
    plan,
  });
  res.status(201).json({ success: true, itinerary });
});

// @route GET /api/itinerary/my
const mine = asyncHandler(async (req, res) => {
  const itineraries = await Itinerary.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(50).lean();
  res.status(200).json({ success: true, itineraries });
});

// @route DELETE /api/itinerary/:id
const remove = asyncHandler(async (req, res) => {
  const r = await Itinerary.deleteOne({ _id: req.params.id, user: req.user._id });
  if (!r.deletedCount) {
    res.status(404);
    throw new Error("Itinerary not found");
  }
  res.status(200).json({ success: true });
});

module.exports = { generate, plannable, save, mine, remove };
