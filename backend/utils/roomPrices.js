const Room = require("../models/room.model");

/** Map<hotelId, cheapest available room price> for a set of hotels (one query, min computed in JS). */
const cheapestRoomPrices = async (hotelIds) => {
  const rooms = await Room.find({ hotel: { $in: hotelIds }, isAvailable: true }).select("hotel price").lean();
  const prices = new Map();
  for (const r of rooms) {
    const key = String(r.hotel);
    if (!prices.has(key) || r.price < prices.get(key)) prices.set(key, r.price);
  }
  return prices;
};

module.exports = { cheapestRoomPrices };
