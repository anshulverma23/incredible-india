const asyncHandler = require("express-async-handler");
const axios = require("axios");
const Destination = require("../models/destination.model");
const Hotel = require("../models/hotel.model");
const Package = require("../models/package.model");
const { deleteImage } = require("../config/cloudinary");
const { parsePagination, paginationMeta } = require("../utils/pagination");
const { safeRegex } = require("../utils/escapeRegex");
const { parseJsonField, pick } = require("../utils/parseJson");
const cache = require("../utils/cache");
const { env } = require("../config/env");
const { idOrSlugFilter } = require("../utils/slugify");

const FIELDS = ["name", "slug", "country", "state", "city", "description", "bestTimeToVisit", "isActive"];
// Resolve either a MongoDB ObjectId (old links) or a destination slug (new SEO links).
const getDestinationFilter = idOrSlugFilter;

const parseBody = (body) => {
  const data = pick(body, FIELDS);
  if (body.tags !== undefined) data.tags = parseJsonField(body.tags, "tags", []);
  if (body.areas !== undefined) data.areas = parseJsonField(body.areas, "areas", []);
  if (body.attractions !== undefined) data.attractions = parseJsonField(body.attractions, "attractions", []);
  if (body.costPerDay !== undefined) data.costPerDay = parseJsonField(body.costPerDay, "costPerDay", {});
  if (body.coordinates !== undefined) data.coordinates = parseJsonField(body.coordinates, "coordinates", {});
  return data;
};

// @desc    Get all destinations (search + pagination)
// @route   GET /api/destinations?search=&state=&tag=&page=&limit=
// @access  Public
const getDestinations = asyncHandler(async (req, res) => {
  const { search, state, tag } = req.query;
  const p = parsePagination(req.query, { defaultLimit: 12 });

  const query = { isActive: true };
  if (state) query.state = safeRegex(state);
  if (tag) query.tags = String(tag);
  if (search) {
    const rx = safeRegex(search);
    query.$or = [{ name: rx }, { city: rx }, { state: rx }];
  }

  const [destinations, total] = await Promise.all([
    Destination.find(query).select("-attractions").sort({ createdAt: -1 }).skip(p.skip).limit(p.limit).lean(),
    Destination.countDocuments(query),
  ]);
  res.status(200).json({ success: true, count: destinations.length, total, page: p.page, pages: paginationMeta(p, total).pages, destinations });
});

// @desc    Get a single destination with nearby hotels + packages + live weather
// @route   GET /api/destinations/:id   (:id = MongoDB id or slug)
// @access  Public
const getDestinationById = asyncHandler(async (req, res) => {
  const destination = await Destination.findOne(getDestinationFilter(req.params.id));
  if (!destination) {
    res.status(404);
    throw new Error("Destination not found");
  }

  const [hotels, packages] = await Promise.all([
    Hotel.find({ destination: destination._id, isActive: true }).limit(6),
    Package.find({ destination: destination._id, isActive: true }).limit(6),
  ]);

  res.status(200).json({ success: true, destination, hotels, packages });
});

// @desc    Get live weather for a destination (OpenWeatherMap)
// @route   GET /api/destinations/:id/weather
// @access  Public
const getDestinationWeather = asyncHandler(async (req, res) => {
  const destination = await Destination.findOne(getDestinationFilter(req.params.id));
  if (!destination) {
    res.status(404);
    throw new Error("Destination not found");
  }

  const cacheKey = `weather:${destination._id}`;
  const cachedWeather = cache.get(cacheKey);
  if (cachedWeather) return res.status(200).json(cachedWeather);

  if (!env.OPENWEATHER_API_KEY) {
    return res.status(200).json({
      success: false,
      message: "Weather API key not configured on the server",
    });
  }

  try {
    const { data } = await axios.get("https://api.openweathermap.org/data/2.5/weather", {
      params: {
        q: `${destination.city},IN`,
        appid: env.OPENWEATHER_API_KEY,
        units: "metric",
      },
    });

    const body = {
      success: true,
      weather: {
        temp: data.main.temp,
        feelsLike: data.main.feels_like,
        condition: data.weather[0]?.description,
        icon: data.weather[0]?.icon,
        humidity: data.main.humidity,
      },
    };
    cache.set(cacheKey, body, 600); // weather barely changes in 10 min - saves API quota
    res.status(200).json(body);
  } catch (error) {
    res.status(200).json({ success: false, message: "Could not fetch live weather right now" });
  }
});

// @desc    Create a destination
// @route   POST /api/destinations
// @access  Private/Admin
const createDestination = asyncHandler(async (req, res) => {
  const gallery = (req.files || []).map((f) => ({ url: f.path, public_id: f.filename }));
  const destination = await Destination.create({ ...parseBody(req.body), gallery, createdBy: req.user._id });
  cache.invalidate("destinations");
  cache.invalidate("itinerary:");
  res.status(201).json({ success: true, destination });
});

// @desc    Update a destination
// @route   PUT /api/destinations/:id
// @access  Private/Admin
const updateDestination = asyncHandler(async (req, res) => {
  const destination = await Destination.findOne(getDestinationFilter(req.params.id));
  if (!destination) {
    res.status(404);
    throw new Error("Destination not found");
  }
  const updates = parseBody(req.body);
  // A blank slug means "keep the current one" (a rename never changes the URL).
  if (!updates.slug) delete updates.slug;
  Object.assign(destination, updates);
  if (req.files?.length) destination.gallery = [...destination.gallery, ...req.files.map((f) => ({ url: f.path, public_id: f.filename }))];
  await destination.save();
  cache.invalidate("destinations");
  cache.invalidate("itinerary:");
  res.status(200).json({ success: true, destination });
});

// @desc    Delete a destination (blocked while hotels/packages still reference it)
// @route   DELETE /api/destinations/:id
// @access  Private/Admin
const deleteDestination = asyncHandler(async (req, res) => {
  const destination = await Destination.findOne(getDestinationFilter(req.params.id));
  if (!destination) {
    res.status(404);
    throw new Error("Destination not found");
  }
  const [pkgs, hotels] = await Promise.all([Package.countDocuments({ destination: destination._id }), Hotel.countDocuments({ destination: destination._id })]);
  if (pkgs || hotels) {
    res.status(409);
    throw new Error(`This destination is used by ${pkgs} package(s) and ${hotels} hotel(s). Remove or reassign them first, or deactivate the destination.`);
  }
  await Promise.all(destination.gallery.map((img) => deleteImage(img.public_id)));
  await destination.deleteOne();
  cache.invalidate("destinations");
  cache.invalidate("itinerary:");
  res.status(200).json({ success: true, message: "Destination deleted successfully" });
});

module.exports = {
  getDestinations,
  getDestinationById,
  getDestinationWeather,
  createDestination,
  updateDestination,
  deleteDestination,
};