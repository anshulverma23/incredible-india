const Hotel = require("../models/hotel.model");
const { httpError } = require("./httpError");
const { ROLES } = require("../models/roles");

// Only an admin manages hotels.
const canManageHotel = (user) => user?.role === ROLES.ADMIN;

const assertCanManageHotel = async (user, hotelOrId) => {
  const hotel = hotelOrId?._id ? hotelOrId : await Hotel.findById(hotelOrId).select("_id");
  if (!hotel) throw httpError(404, "Hotel not found");
  if (!canManageHotel(user)) throw httpError(403, "You do not manage this hotel");
  return hotel;
};

module.exports = { canManageHotel, assertCanManageHotel };
