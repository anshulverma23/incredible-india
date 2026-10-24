
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

const FIELDS = [
  "name",
  "description",
  "destination",
  "price",
  "packageType",
  "maxGroupSize",
  "isActive",
];

const JSON_FIELDS = {
  duration: {},
  itinerary: [],
  included: [],
  excluded: [],
  amenities: [],
  hotels: [],
  startDates: [],
};

const SORTS = {
  price_asc: { price: 1 },
  price_desc: { price: -1 },
  rating_desc: { rating: -1, numReviews: -1 },
  duration_asc: { "duration.days": 1 },
  duration_desc: { "duration.days": -1 },
  popular: { numReviews: -1, rating: -1 },
  newest: { createdAt: -1 },
};

const list = (value) =>
  value
    ? String(value)
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

// Resolve either a MongoDB ObjectId or a package slug.
const getPackageFilter = (identifier) => {
  if (mongoose.isValidObjectId(identifier)) {
    return { _id: identifier };
  }

  return { slug: String(identifier).toLowerCase() };
};

// Build search filters from query parameters.
const buildPackageQuery = async (queryParams) => {
  const query = { isActive: true };

  const category = queryParams.category || queryParams.packageType;

  if (category) {
    query.packageType = { $in: list(category) };
  }

  if (queryParams.destination) {
    if (mongoose.isValidObjectId(queryParams.destination)) {
      query.destination = queryParams.destination;
    } else {
      const regex = safeRegex(queryParams.destination);

      query.destination = {
        $in: await Destination.find({
          $or: [
            { name: regex },
            { city: regex },
            { state: regex },
          ],
        }).distinct("_id"),
      };
    }
  }

  if (queryParams.minPrice || queryParams.maxPrice) {
    query.price = {};

    if (queryParams.minPrice) {
      query.price.$gte = Number(queryParams.minPrice);
    }

    if (queryParams.maxPrice) {
      query.price.$lte = Number(queryParams.maxPrice);
    }
  }

  const duration = {};

  if (queryParams.duration) {
    duration.$gte = Number(queryParams.duration);
    duration.$lte = Number(queryParams.duration);
  }

  if (queryParams.minDuration) {
    duration.$gte = Number(queryParams.minDuration);
  }

  if (queryParams.maxDuration) {
    duration.$lte = Number(queryParams.maxDuration);
  }

  if (Object.keys(duration).length) {
    query["duration.days"] = duration;
  }

  const minRating = queryParams.minRating || queryParams.rating;

  if (minRating) {
    query.rating = { $gte: Number(minRating) };
  }

  if (queryParams.startDate || queryParams.endDate) {
    query.startDates = {
      $elemMatch: {
        ...(queryParams.startDate && {
          $gte: startOfDay(queryParams.startDate),
        }),
        ...(queryParams.endDate && {
          $lte: new Date(
            startOfDay(queryParams.endDate).getTime() +
              MS_PER_DAY -
              1
          ),
        }),
      },
    };
  }

  if (
    queryParams.hotel &&
    mongoose.isValidObjectId(queryParams.hotel)
  ) {
    query.hotels = queryParams.hotel;
  }

  if (queryParams.amenities) {
    query.amenities = {
      $all: list(queryParams.amenities).map(
        (amenity) =>
          new RegExp(`^${escapeRegex(amenity)}$`, "i")
      ),
    };
  }

  if (queryParams.search) {
    const regex = safeRegex(queryParams.search);

    const destinationIds = await Destination.find({
      $or: [
        { name: regex },
        { city: regex },
        { state: regex },
      ],
    }).distinct("_id");

    query.$or = [
      { name: regex },
      { packageType: regex },
      { destination: { $in: destinationIds } },
    ];
  }

  return query;
};

// GET /api/packages
const getPackages = asyncHandler(async (req, res) => {
  const pagination = parsePagination(req.query, {
    defaultLimit: 12,
  });

  const query = await buildPackageQuery(req.query);
  const sort = SORTS[req.query.sort] || SORTS.newest;

  const [packages, total] = await Promise.all([
    Package.find(query)
      .populate("destination", "name city state")
      .sort(sort)
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean(),

    Package.countDocuments(query),
  ]);

  res.status(200).json({
    success: true,
    count: packages.length,
    total,
    page: pagination.page,
    pages: paginationMeta(pagination, total).pages,
    packages,
  });
});

// GET /api/packages/:id
// Supports both /packages/:mongoId and /packages/:slug
const getPackageById = asyncHandler(async (req, res) => {
  const pkg = await Package.findOne(
    getPackageFilter(req.params.id)
  )
    .populate("destination", "name city state country")
    .populate("hotels", "name images rating location hotelType")
    .populate("blog", "title slug")
    .lean();

  if (!pkg) {
    res.status(404);
    throw new Error("Package not found");
  }

  const upcoming = (pkg.startDates || [])
    .map((date) => startOfDay(date))
    .filter((date) => date >= startOfDay(new Date()))
    .sort((a, b) => a - b)
    .slice(0, 12);

  let departures = [];

  if (upcoming.length) {
    const taken = new Map();

    const held = await Booking.find({
      package: pkg._id,
      travelDate: {
        $gte: upcoming[0],
        $lte: new Date(
          upcoming[upcoming.length - 1].getTime() +
            MS_PER_DAY
        ),
      },
      ...Booking.activeHoldFilter(),
    })
      .select("travelDate guests")
      .lean();

    held.forEach((booking) => {
      const key = startOfDay(booking.travelDate)
        .toISOString()
        .slice(0, 10);

      const seats =
        (booking.guests?.adults || 0) +
        (booking.guests?.children || 0);

      taken.set(key, (taken.get(key) || 0) + seats);
    });

    departures = upcoming.map((date) => ({
      date,
      seatsLeft: Math.max(
        0,
        pkg.maxGroupSize -
          (taken.get(date.toISOString().slice(0, 10)) || 0)
      ),
    }));
  }

  res.status(200).json({
    success: true,
    package: {
      ...pkg,
      departures,
    },
  });
});

// GET /api/packages/:id/availability?date=&guests=
const checkAvailability = asyncHandler(async (req, res) => {
  const pkg = await Package.findOne(
    getPackageFilter(req.params.id)
  ).select("maxGroupSize isActive startDates");

  if (!pkg || !pkg.isActive) {
    res.status(404);
    throw new Error("Package not found");
  }

  const date = startOfDay(req.query.date);

  const rows = await Booking.aggregate([
    {
      $match: {
        package: pkg._id,
        travelDate: sameDayFilter(date),
        ...Booking.activeHoldFilter(),
      },
    },
    {
      $group: {
        _id: null,
        adults: { $sum: "$guests.adults" },
        children: { $sum: "$guests.children" },
      },
    },
  ]);

  const seatsLeft = Math.max(
    0,
    pkg.maxGroupSize -
      ((rows[0]?.adults || 0) + (rows[0]?.children || 0))
  );

  const isDeparture =
    !pkg.startDates?.length ||
    pkg.startDates.some(
      (departureDate) =>
        startOfDay(departureDate).getTime() === date.getTime()
    );

  res.status(200).json({
    success: true,
    available:
      isDeparture &&
      seatsLeft >= (Number(req.query.guests) || 1),
    seatsLeft,
    isDeparture,
  });
});

// Parse regular fields and JSON fields from request body.
const parseBody = (body) => {
  const data = pick(body, FIELDS);

  for (const [field, fallback] of Object.entries(JSON_FIELDS)) {
    if (body[field] !== undefined) {
      data[field] = parseJsonField(
        body[field],
        field,
        fallback
      );
    }
  }

  return data;
};

// POST /api/packages
const createPackage = asyncHandler(async (req, res) => {
  const gallery = (req.files || []).map((file) => ({
    url: file.path,
    public_id: file.filename,
  }));

  const pkg = await Package.create({
    ...parseBody(req.body),
    gallery,
    createdBy: req.user._id,
  });

  cache.invalidate("packages");

  res.status(201).json({
    success: true,
    package: pkg,
  });
});

// PUT /api/packages/:id
const updatePackage = asyncHandler(async (req, res) => {
  // Keep admin update endpoint compatible with MongoDB IDs.
  const pkg = await Package.findById(req.params.id);

  if (!pkg) {
    res.status(404);
    throw new Error("Package not found");
  }

  const updates = parseBody(req.body);

  // Preserve fields that were not submitted.
  Object.assign(pkg, updates);

  if (req.files?.length) {
    pkg.gallery = [
      ...(pkg.gallery || []),
      ...req.files.map((file) => ({
        url: file.path,
        public_id: file.filename,
      })),
    ];
  }

  await pkg.save();

  cache.invalidate("packages");

  res.status(200).json({
    success: true,
    package: pkg,
  });
});

// DELETE /api/packages/:id
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

    return res.status(200).json({
      success: true,
      message:
        "Package has bookings, so it was deactivated instead of deleted",
    });
  }

  await Promise.all(
    (pkg.gallery || []).map((image) =>
      deleteImage(image.public_id)
    )
  );

  await pkg.deleteOne();

  res.status(200).json({
    success: true,
    message: "Package deleted successfully",
  });
});

module.exports = {
  getPackages,
  getPackageById,
  checkAvailability,
  createPackage,
  updatePackage,
  deletePackage,
  buildPackageQuery,
};
