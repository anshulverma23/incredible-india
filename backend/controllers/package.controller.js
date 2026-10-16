const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const Package = require("../models/package.model");
const Destination = require("../models/destination.model");
const Booking = require("../models/booking.model");
const { deleteImage } = require("../config/cloudinary");
const { parsePagination, paginationMeta } = require("../utils/pagination");
const { safeRegex, escapeRegex } = require("../utils/escapeRegex");
const { parseJsonField, pick } = require("../utils/parseJson");
const { startOfDay, MS_PER_DAY } = require("../utils/pricing");
const { sameDayFilter } = require("../services/availability.service");
const cache = require("../utils/cache");

const FIELDS = ["name", "description", "destination", "price", "packageType", "maxGroupSize", "isActive"];
const JSON_FIELDS = { duration: {}, itinerary: [], included: [], excluded: [], amenities: [], hotels: [], startDates: [] };

const SORTS = {
  price_asc: { price: 1 },
  price_desc: { price: -1 },
  rating_desc: { rating: -1, numReviews: -1 },
  duration_asc: { "duration.days": 1 },
  duration_desc: { "duration.days": -1 },
  popular: { numReviews: -1, rating: -1 },
  newest: { createdAt: -1 },
};

const list = (v) => (v ? String(v).split(",").map((s) => s.trim()).filter(Boolean) : []);

// Builds the Mongo filter from the search page's query-string.
const buildPackageQuery = async (q) => {
  const query = { isActive: true };

  const category = q.category || q.packageType;
  if (category) query.packageType = { $in: list(category) };

  if (q.destination) {
    if (mongoose.isValidObjectId(q.destination)) query.destination = q.destination;
    else {
      const rx = safeRegex(q.destination);
      query.destination = { $in: await Destination.find({ $or: [{ name: rx }, { city: rx }, { state: rx }] }).distinct("_id") };
    }
  }

  if (q.minPrice || q.maxPrice) {
    query.price = {};
    if (q.minPrice) query.price.$gte = Number(q.minPrice);
    if (q.maxPrice) query.price.$lte = Number(q.maxPrice);
  }

  const dur = {};
  if (q.duration) {
    dur.$gte = Number(q.duration);
    dur.$lte = Number(q.duration);
  }
  if (q.minDuration) dur.$gte = Number(q.minDuration);
  if (q.maxDuration) dur.$lte = Number(q.maxDuration);
  if (Object.keys(dur).length) query["duration.days"] = dur;

  const minRating = q.minRating || q.rating;
  if (minRating) query.rating = { $gte: Number(minRating) };

  if (q.startDate || q.endDate) {
    query.startDates = { $elemMatch: { ...(q.startDate && { $gte: startOfDay(q.startDate) }), ...(q.endDate && { $lte: new Date(startOfDay(q.endDate).getTime() + MS_PER_DAY - 1) }) } };
  }
  if (q.hotel && mongoose.isValidObjectId(q.hotel)) query.hotels = q.hotel;
  if (q.amenities) query.amenities = { $all: list(q.amenities).map((a) => new RegExp(`^${escapeRegex(a)}$`, "i")) };

  if (q.search) {
    const rx = safeRegex(q.search);
    const destIds = await Destination.find({ $or: [{ name: rx }, { city: rx }, { state: rx }] }).distinct("_id");
    query.$or = [{ name: rx }, { packageType: rx }, { destination: { $in: destIds } }];
  }
  return query;
};

// @route GET /api/packages
const getPackages = asyncHandler(async (req, res) => {
  const p = parsePagination(req.query, { defaultLimit: 12 });
  const query = await buildPackageQuery(req.query);
  const sort = SORTS[req.query.sort] || SORTS.newest;

  const [packages, total] = await Promise.all([
    Package.find(query).populate("destination", "name city state").select("-itinerary").sort(sort).skip(p.skip).limit(p.limit).lean(),
    Package.countDocuments(query),
  ]);
  res.status(200).json({ success: true, count: packages.length, total, page: p.page, pages: paginationMeta(p, total).pages, packages });
});

// @route GET /api/packages/:id   (includes live seats-left per upcoming departure)
const getPackageById = asyncHandler(async (req, res) => {
  const pkg = await Package.findById(req.params.id).populate("destination", "name city state country").populate("hotels", "name images rating location hotelType").lean();
  if (!pkg) {
    res.status(404);
    throw new Error("Package not found");
  }

  const upcoming = (pkg.startDates || []).map((d) => startOfDay(d)).filter((d) => d >= startOfDay(new Date())).sort((a, b) => a - b).slice(0, 12);
  let departures = [];
  if (upcoming.length) {
    const taken = new Map(); // yyyy-mm-dd -> seats already held
    const held = await Booking.find({ package: pkg._id, travelDate: { $gte: upcoming[0], $lte: new Date(upcoming[upcoming.length - 1].getTime() + MS_PER_DAY) }, ...Booking.activeHoldFilter() })
      .select("travelDate guests")
      .lean();
    held.forEach((b) => {
      const k = startOfDay(b.travelDate).toISOString().slice(0, 10);
      taken.set(k, (taken.get(k) || 0) + b.guests.adults + b.guests.children);
    });
    departures = upcoming.map((d) => ({ date: d, seatsLeft: Math.max(0, pkg.maxGroupSize - (taken.get(d.toISOString().slice(0, 10)) || 0)) }));
  }
  res.status(200).json({ success: true, package: { ...pkg, departures } });
});

// @route GET /api/packages/:id/availability?date=&guests=
const checkAvailability = asyncHandler(async (req, res) => {
  const pkg = await Package.findById(req.params.id).select("maxGroupSize isActive startDates");
  if (!pkg || !pkg.isActive) {
    res.status(404);
    throw new Error("Package not found");
  }
  const date = startOfDay(req.query.date);
  const rows = await Booking.aggregate([
    { $match: { package: pkg._id, travelDate: sameDayFilter(date), ...Booking.activeHoldFilter() } },
    { $group: { _id: null, adults: { $sum: "$guests.adults" }, children: { $sum: "$guests.children" } } },
  ]);
  const seatsLeft = Math.max(0, pkg.maxGroupSize - ((rows[0]?.adults || 0) + (rows[0]?.children || 0)));
  const isDeparture = !pkg.startDates?.length || pkg.startDates.some((d) => startOfDay(d).getTime() === date.getTime());
  res.status(200).json({ success: true, available: isDeparture && seatsLeft >= (Number(req.query.guests) || 1), seatsLeft, isDeparture });
});

const parseBody = (body) => {
  const data = pick(body, FIELDS);
  for (const [field, fallback] of Object.entries(JSON_FIELDS)) {
    if (body[field] !== undefined) data[field] = parseJsonField(body[field], field, fallback);
  }
  return data;
};

// @route POST /api/packages   (admin)
const createPackage = asyncHandler(async (req, res) => {
  const gallery = (req.files || []).map((f) => ({ url: f.path, public_id: f.filename }));
  const pkg = await Package.create({ ...parseBody(req.body), gallery, createdBy: req.user._id });
  cache.invalidate("packages");
  res.status(201).json({ success: true, package: pkg });
});

// @route PUT /api/packages/:id   (admin)
const updatePackage = asyncHandler(async (req, res) => {
  const pkg = await Package.findById(req.params.id);
  if (!pkg) {
    res.status(404);
    throw new Error("Package not found");
  }
  Object.assign(pkg, parseBody(req.body));
  if (req.files?.length) pkg.gallery = [...pkg.gallery, ...req.files.map((f) => ({ url: f.path, public_id: f.filename }))];
  await pkg.save();
  cache.invalidate("packages");
  res.status(200).json({ success: true, package: pkg });
});

// @route DELETE /api/packages/:id   (admin) - packages with booking history are deactivated, not deleted
const deletePackage = asyncHandler(async (req, res) => {
  const pkg = await Package.findById(req.params.id);
  if (!pkg) {
    res.status(404);
    throw new Error("Package not found");
  }
  cache.invalidate("packages");
  if (await Booking.exists({ package: pkg._id })) {
    pkg.isActive = false;
    await pkg.save();
    return res.status(200).json({ success: true, message: "Package has bookings, so it was deactivated instead of deleted" });
  }
  await Promise.all(pkg.gallery.map((img) => deleteImage(img.public_id)));
  await pkg.deleteOne();
  res.status(200).json({ success: true, message: "Package deleted successfully" });
});

module.exports = { getPackages, getPackageById, checkAvailability, createPackage, updatePackage, deletePackage, buildPackageQuery };
