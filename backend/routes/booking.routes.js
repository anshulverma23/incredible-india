const express = require("express");
const c = require("../controllers/booking.controller");
const { protect } = require("../middlewares/authMiddleware");
const { admin } = require("../middlewares/adminMiddleware");
const { validate } = require("../middlewares/validate");
const v = require("../validators/booking.validator");

const router = express.Router();
router.use(protect);

router.post("/", validate(v.createBooking), c.createBooking);
router.get("/my", c.getMyBookings);
// Admin only
router.get("/", admin, validate(v.listQuery, "query"), c.getAllBookings);

router.get("/:id", c.getBookingById);
router.get("/:id/invoice", c.generateInvoice);
router.put("/:id/cancel", validate(v.cancel), c.cancelBooking);
router.put("/:id/apply-coupon", validate(v.applyCoupon), c.applyCoupon);
router.put("/:id/status", admin, validate(v.adminStatus), c.updateBookingStatus);

module.exports = router;
