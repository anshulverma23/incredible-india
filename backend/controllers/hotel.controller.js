
const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");

const Hotel = require("../models/hotel.model");
const Room = require("../models/room.model");
const Booking = require("../models/booking.model");

const { deleteImage } = require("../config/cloudinary");
const { parsePagination, paginationMeta } = require("../utils/pagination");
const { safeRegex } = require("../utils/escapeRegex");
const { parseJsonField, pick } = require("../utils/parseJson");
const { assertCanManageHotel } = require("../utils/ownership");
const {
  roomsAvailable,
  availableHotelIds,
} = require("../services/availability.service");
const { startOfDay } = require("../utils/pricing");
const { cheapestRoomPrices } = require("../utils/roomPrices");
const cache = require("../utils/cache");

const FIELDS = [
  "name",
  "description",
  "hotelType",
  "destination",
  "isActive",
];

const list = (v) =>
  v
    ? String(v)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

/* =========================================
   HOTEL SLUG HELPERS
========================================= */

const generateSlug = (name) => {
  return (
    String(name || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "hotel"
  );
};

const makeUniqueHotelSlug = async (name, excludeId = null) => {
  const baseSlug = generateSlug(name);

  let slug = baseSlug;
  let count = 1;

  while (
    await Hotel.exists({
      slug,
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    })
  ) {
    count += 1;
    slug = `${baseSlug}-${count}`;
  }

  return slug;
};

/* =========================================
   GET ALL HOTELS
   GET /api/hotels
========================================= */

const getHotels = asyncHandler(async (req, res) => {
  const q = req.query;
  const p = parsePagination(q, { defaultLimit: 12 });

  const query = { isActive: true };

  if (q.city) query["location.city"] = safeRegex(q.city);
  if (q.country) query["location.country"] = safeRegex(q.country);

  if (q.destination && mongoose.isValidObjectId(q.destination)) {
    query.destination = q.destination;
  }

  if (q.hotelType) {
    query.hotelType = { $in: list(q.hotelType) };
  }

  if (q.rating) {
    query.rating = { $gte: Number(q.rating) };
  }

  if (q.amenities) {
    query.amenities = { $all: list(q.amenities) };
  }

  if (q.search) {
    const rx = safeRegex(q.search);

    query.$or = [
      { name: rx },
      { "location.city": rx },
      { "location.state": rx },
    ];
  }

  // Filter hotels according to room prices and availability.
  let candidateIds = null;

  const narrow = (ids) => {
    const set = new Set(ids.map(String));

    candidateIds = candidateIds
      ? new Set([...candidateIds].filter((id) => set.has(id)))
      : set;
  };

  if (q.minPrice || q.maxPrice) {
    const price = {};

    if (q.minPrice) price.$gte = Number(q.minPrice);
    if (q.maxPrice) price.$lte = Number(q.maxPrice);

    narrow(
      await Room.find({
        price,
        isAvailable: true,
      }).distinct("hotel")
    );
  }

  if (q.checkIn && q.checkOut) {
    const checkIn = startOfDay(q.checkIn);
    const checkOut = startOfDay(q.checkOut);

    if (checkOut > checkIn) {
      const base = (
        await Hotel.find({
          ...query,
          ...(candidateIds
            ? { _id: { $in: [...candidateIds] } }
            : {}),
        })
          .select("_id")
          .limit(500)
          .lean()
      ).map((h) => h._id);

      narrow(
        await availableHotelIds(
          base,
          checkIn,
          checkOut,
          Number(q.rooms) || 1
        )
      );
    }
  }

  if (candidateIds) {
    query._id = {
      $in: [...candidateIds].map(
        (id) => new mongoose.Types.ObjectId(id)
      ),
    };
  }

  const sortByPrice =
    q.sort === "price_asc" || q.sort === "price_desc";

  let hotels;
  let total;

  if (sortByPrice) {
    const ids = (
      await Hotel.find(query)
        .select("_id")
        .limit(1000)
        .lean()
    ).map((h) => h._id);

    total = ids.length;

    const priceMap = await cheapestRoomPrices(ids);

    const direction = q.sort === "price_asc" ? 1 : -1;

    const pageIds = ids
      .sort(
        (a, b) =>
          direction *
          ((priceMap.get(String(a)) ?? Infinity) -
            (priceMap.get(String(b)) ?? Infinity))
      )
      .slice(p.skip, p.skip + p.limit);

    const docs = await Hotel.find({
      _id: { $in: pageIds },
    }).lean();

    hotels = pageIds
      .map((id) =>
        docs.find((doc) => String(doc._id) === String(id))
      )
      .filter(Boolean);
  } else {
    const sort =
      q.sort === "rating_desc"
        ? { rating: -1, numReviews: -1 }
        : { createdAt: -1 };

    [hotels, total] = await Promise.all([
      Hotel.find(query)
        .sort(sort)
        .skip(p.skip)
        .limit(p.limit)
        .lean(),

      Hotel.countDocuments(query),
    ]);
  }

  // Add starting price to every hotel.
  const priceMap = await cheapestRoomPrices(
    hotels.map((hotel) => hotel._id)
  );

  hotels = hotels.map((hotel) => ({
    ...hotel,
    minPrice: priceMap.get(String(hotel._id)) ?? null,
  }));

  res.status(200).json({
    success: true,
    count: hotels.length,
    total,
    page: p.page,
    pages: paginationMeta(p, total).pages,
    hotels,
  });
});

/* =========================================
   GET HOTEL BY ID OR SLUG
   GET /api/hotels/:id
========================================= */

const getHotelById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Old URLs use MongoDB ObjectId.
  // New URLs use hotel slug.
  const filter = mongoose.isValidObjectId(id)
    ? { _id: id }
    : { slug: id };

  const hotel = await Hotel.findOne(filter)
    .populate("destination", "name city state")
    .lean();

  if (!hotel) {
    res.status(404);
    throw new Error("Hotel not found");
  }

  const rooms = await Room.find({
    hotel: hotel._id,
  }).lean();

  res.status(200).json({
    success: true,
    hotel,
    rooms,
  });
});

/* =========================================
   PARSE HOTEL REQUEST BODY
========================================= */

const parseBody = (body) => {
  const data = pick(body, FIELDS);

  if (body.amenities !== undefined) {
    data.amenities = parseJsonField(
      body.amenities,
      "amenities",
      []
    );
  }

  if (body.location !== undefined) {
    data.location = parseJsonField(
      body.location,
      "location",
      {}
    );
  }

  if (body.ownerContact !== undefined) {
    const contact =
      parseJsonField(body.ownerContact, "ownerContact", {}) || {};

    data.ownerContact = {
      name: String(contact.name || "").trim(),
      phone: String(contact.phone || "").trim(),
      email: String(contact.email || "").trim(),
    };
  }

  return data;
};

/* =========================================
   CREATE HOTEL
   POST /api/hotels
========================================= */

const createHotel = asyncHandler(async (req, res) => {
  const images = (req.files || []).map((file) => ({
    url: file.path,
    public_id: file.filename,
  }));

  const hotelData = parseBody(req.body);

  if (!hotelData.name || !hotelData.name.trim()) {
    res.status(400);
    throw new Error("Hotel name is required");
  }

  // Automatically generate a unique slug.
  hotelData.slug = await makeUniqueHotelSlug(hotelData.name);

  const hotel = await Hotel.create({
    ...hotelData,
    images,
    createdBy: req.user._id,
  });

  cache.invalidate("hotels");

  res.status(201).json({
    success: true,
    hotel,
  });
});

/* =========================================
   UPDATE HOTEL
   PUT /api/hotels/:id
========================================= */

const updateHotel = asyncHandler(async (req, res) => {
  const hotel = await Hotel.findById(req.params.id);

  if (!hotel) {
    res.status(404);
    throw new Error("Hotel not found");
  }

  await assertCanManageHotel(req.user, hotel);

  const updatedData = parseBody(req.body);

  if (
    updatedData.name &&
    updatedData.name.trim() !== hotel.name
  ) {
    updatedData.slug = await makeUniqueHotelSlug(
      updatedData.name,
      hotel._id
    );
  }

  Object.assign(hotel, updatedData);

  if (req.files?.length) {
    hotel.images = [
      ...hotel.images,
      ...req.files.map((file) => ({
        url: file.path,
        public_id: file.filename,
      })),
    ];
  }

  await hotel.save();

  cache.invalidate("hotels");

  res.status(200).json({
    success: true,
    hotel,
  });
});

/* =========================================
   DELETE HOTEL
   DELETE /api/hotels/:id
========================================= */

const deleteHotel = asyncHandler(async (req, res) => {
  const hotel = await Hotel.findById(req.params.id);

  if (!hotel) {
    res.status(404);
    throw new Error("Hotel not found");
  }

  cache.invalidate("hotels");

  // Keep hotel record if booking history exists.
  if (await Booking.exists({ hotel: hotel._id })) {
    hotel.isActive = false;
    await hotel.save();

    return res.status(200).json({
      success: true,
      message:
        "Hotel has bookings, so it was deactivated instead of deleted",
    });
  }

  await Promise.all(
    hotel.images.map((image) =>
      deleteImage(image.public_id)
    )
  );

  await Room.deleteMany({
    hotel: hotel._id,
  });

  await hotel.deleteOne();

  res.status(200).json({
    success: true,
    message: "Hotel deleted successfully",
  });
});

/* =========================================
   CHECK HOTEL AVAILABILITY
   GET /api/hotels/:id/availability
========================================= */

const checkAvailability = asyncHandler(async (req, res) => {
  const {
    roomId,
    checkIn,
    checkOut,
    rooms = 1,
  } = req.query;

  const room = await Room.findOne({
    _id: roomId,
    hotel: req.params.id,
    isAvailable: true,
  });

  if (!room) {
    res.status(404);
    throw new Error("Room not found for this hotel");
  }

  const free = await roomsAvailable(
    room,
    startOfDay(checkIn),
    startOfDay(checkOut)
  );

  res.status(200).json({
    success: true,
    available: free >= Number(rooms),
    availableRooms: free,
  });
});

/* =========================================
   GET HOTEL OWNER CONTACT
   GET /api/hotels/:id/owner-contact
========================================= */

const getOwnerContact = asyncHandler(async (req, res) => {
  const hotel = await Hotel.findById(req.params.id)
    .select("name +ownerContact")
    .lean();

  if (!hotel) {
    res.status(404);
    throw new Error("Hotel not found");
  }

  res.status(200).json({
    success: true,
    ownerContact: hotel.ownerContact || {
      name: "",
      phone: "",
      email: "",
    },
  });
});

/* =========================================
   EXPORT CONTROLLERS
========================================= */

module.exports = {
  getHotels,
  getHotelById,
  createHotel,
  updateHotel,
  deleteHotel,
  checkAvailability,
  getOwnerContact,
};
