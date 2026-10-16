const { authorize } = require("./authMiddleware");
const { ROLES } = require("../models/roles");

// Must run AFTER `protect`. Only two roles exist: "user" and "admin".
// Every management area (catalogue, bookings, coupons, hotels, users, payments) is admin only.
const admin = authorize(ROLES.ADMIN);

// Aliases kept so existing route files keep reading naturally.
const superAdmin = admin;
const staff = admin;
const hotelStaff = admin;

module.exports = { admin, superAdmin, staff, hotelStaff };
