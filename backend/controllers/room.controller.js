const asyncHandler = require("express-async-handler");
const Room = require("../models/room.model");
const Hotel = require("../models/hotel.model");
const Booking = require("../models/booking.model");
const { deleteImage } = require("../config/cloudinary");
const { parseJsonField, pick } = require("../utils/parseJson");
const { assertCanManageHotel } = require("../utils/ownership");
const cache = require("../utils/cache");

const FIELDS = ["roomType", "price", "capacity", "totalRooms", "isAvailable"];
const parseBody = (body) => {
  const data = pick(body, FIELDS);
  if (body.amenities !== undefined) data.amenities = parseJsonField(body.amenities, "amenities", []);
  return data;
};

// @route GET /api/hotels/:hotelId/rooms
const getRoomsByHotel = asyncHandler(async (req, res) => {
  const rooms = await Room.find({ hotel: req.params.hotelId }).lean();
  res.status(200).json({ success: true, count: rooms.length, rooms });
});

// @route POST /api/hotels/:hotelId/rooms   (admin or the hotel's manager)
const createRoom = asyncHandler(async (req, res) => {
  const hotel = await Hotel.findById(req.params.hotelId);
  if (!hotel) {
    res.status(404);
    throw new Error("Hotel not found");
  }
  await assertCanManageHotel(req.user, hotel);
  const images = (req.files || []).map((f) => ({ url: f.path, public_id: f.filename }));
  const room = await Room.create({ ...parseBody(req.body), hotel: hotel._id, images });
  cache.invalidate("hotels");
  res.status(201).json({ success: true, room });
});

// @route PUT /api/hotels/:hotelId/rooms/:roomId
const updateRoom = asyncHandler(async (req, res) => {
  await assertCanManageHotel(req.user, req.params.hotelId);
  const room = await Room.findOne({ _id: req.params.roomId, hotel: req.params.hotelId });
  if (!room) {
    res.status(404);
    throw new Error("Room not found");
  }
  Object.assign(room, parseBody(req.body));
  if (req.files?.length) room.images = [...room.images, ...req.files.map((f) => ({ url: f.path, public_id: f.filename }))];
  await room.save();
  cache.invalidate("hotels");
  res.status(200).json({ success: true, room });
});

// @route DELETE /api/hotels/:hotelId/rooms/:roomId - rooms with upcoming/active bookings can't be removed
const deleteRoom = asyncHandler(async (req, res) => {
  await assertCanManageHotel(req.user, req.params.hotelId);
  const room = await Room.findOne({ _id: req.params.roomId, hotel: req.params.hotelId });
  if (!room) {
    res.status(404);
    throw new Error("Room not found");
  }
  cache.invalidate("hotels");
  if (await Booking.exists({ room: room._id, checkOut: { $gte: new Date() }, ...Booking.activeHoldFilter() })) {
    room.isAvailable = false;
    await room.save();
    return res.status(200).json({ success: true, message: "Room has upcoming bookings, so it was marked unavailable instead of deleted" });
  }
  await Promise.all(room.images.map((img) => deleteImage(img.public_id)));
  await room.deleteOne();
  res.status(200).json({ success: true, message: "Room deleted successfully" });
});

module.exports = { getRoomsByHotel, createRoom, updateRoom, deleteRoom };
