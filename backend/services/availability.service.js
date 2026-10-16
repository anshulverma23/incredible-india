const Booking = require("../models/booking.model");
const { startOfDay, MS_PER_DAY } = require("../utils/pricing");
const { httpError } = require("../utils/httpError");

/**
 * Pure helper: highest number of rooms occupied on any single night within [checkIn, checkOut),
 * given the overlapping bookings. (Summing all overlapping bookings would over-count when
 * two bookings overlap a third one but not each other.)
 */
const peakRoomOccupancy = (bookings, checkIn, checkOut) => {
  const start = startOfDay(checkIn).getTime();
  const end = startOfDay(checkOut).getTime();
  let peak = 0;
  for (let t = start; t < end; t += MS_PER_DAY) {
    let used = 0;
    for (const b of bookings) {
      if (startOfDay(b.checkIn).getTime() <= t && startOfDay(b.checkOut).getTime() > t) used += b.numberOfRooms || 1;
    }
    peak = Math.max(peak, used);
  }
  return peak;
};

const overlappingRoomBookings = (roomId, checkIn, checkOut, { excludeId, beforeId } = {}) => {
  const q = {
    room: roomId,
    checkIn: { $lt: checkOut },
    checkOut: { $gt: checkIn },
    ...Booking.activeHoldFilter(),
  };
  if (excludeId) q._id = { $ne: excludeId };
  if (beforeId) q._id = { ...(q._id || {}), $lt: beforeId }; // only bookings created before this one
  return Booking.find(q).select("checkIn checkOut numberOfRooms").lean();
};

/** How many rooms of this type are still free for the whole stay. */
const roomsAvailable = async (room, checkIn, checkOut, opts = {}) => {
  const existing = await overlappingRoomBookings(room._id, checkIn, checkOut, opts);
  return Math.max(0, room.totalRooms - peakRoomOccupancy(existing, checkIn, checkOut));
};

const sameDayFilter = (date) => {
  const d = startOfDay(date);
  return { $gte: d, $lt: new Date(d.getTime() + MS_PER_DAY) };
};

/** Seats left on a package departure date. */
const packageSeatsLeft = async (pkg, travelDate, { excludeId, beforeId } = {}) => {
  const q = { package: pkg._id, travelDate: sameDayFilter(travelDate), ...Booking.activeHoldFilter() };
  if (excludeId) q._id = { $ne: excludeId };
  if (beforeId) q._id = { ...(q._id || {}), $lt: beforeId };
  const rows = await Booking.aggregate([{ $match: q }, { $group: { _id: null, adults: { $sum: "$guests.adults" }, children: { $sum: "$guests.children" } } }]);
  return Math.max(0, pkg.maxGroupSize - ((rows[0]?.adults || 0) + (rows[0]?.children || 0)));
};

/**
 * Run AFTER a pending booking has been inserted. Two simultaneous requests can both pass the pre-check;
 * this re-counts using only bookings created BEFORE this one (ObjectIds are time-ordered), so exactly
 * one of them wins and the other is rejected. Works on a standalone MongoDB (no transactions needed).
 */
const assertNotOversold = async (booking, { room, pkg }) => {
  if (booking.bookingType === "hotel") {
    const free = await roomsAvailable(room, booking.checkIn, booking.checkOut, { beforeId: booking._id });
    if (free < booking.numberOfRooms) throw httpError(409, "Sorry, those rooms were just booked by someone else. Please pick other dates or a different room.");
  } else {
    const left = await packageSeatsLeft(pkg, booking.travelDate, { beforeId: booking._id });
    const need = (booking.guests.adults || 1) + (booking.guests.children || 0);
    if (left < need) throw httpError(409, "Sorry, those seats were just booked by someone else. Please choose another departure date.");
  }
};

module.exports = { peakRoomOccupancy, roomsAvailable, packageSeatsLeft, assertNotOversold, sameDayFilter };

/**
 * For hotel search by date: which of these hotels have at least one room type with `roomsNeeded` free
 * for the whole stay? Two queries total, regardless of how many hotels are checked.
 */
const availableHotelIds = async (hotelIds, checkIn, checkOut, roomsNeeded = 1) => {
  const Room = require("../models/room.model");
  const rooms = await Room.find({ hotel: { $in: hotelIds }, isAvailable: true }).select("hotel totalRooms").lean();
  if (!rooms.length) return new Set();
  const bookings = await Booking.find({
    room: { $in: rooms.map((r) => r._id) },
    checkIn: { $lt: checkOut },
    checkOut: { $gt: checkIn },
    ...Booking.activeHoldFilter(),
  })
    .select("room checkIn checkOut numberOfRooms")
    .lean();

  const byRoom = new Map();
  bookings.forEach((b) => byRoom.set(String(b.room), [...(byRoom.get(String(b.room)) || []), b]));

  const ok = new Set();
  for (const r of rooms) {
    const free = r.totalRooms - peakRoomOccupancy(byRoom.get(String(r._id)) || [], checkIn, checkOut);
    if (free >= roomsNeeded) ok.add(String(r.hotel));
  }
  return ok;
};

module.exports.availableHotelIds = availableHotelIds;
