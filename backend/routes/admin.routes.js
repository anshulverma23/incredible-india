const express = require("express");
const c = require("../controllers/admin.controller");
const { protect } = require("../middlewares/authMiddleware");
const { admin } = require("../middlewares/adminMiddleware");

const router = express.Router();
router.use(protect, admin); // applied once for every admin route

router.get("/dashboard", c.getDashboard);
router.get("/reports/revenue", c.getRevenueReport);
router.get("/reports/bookings", c.getBookingReport);
router.get("/reports/payments", c.getPaymentReport);

module.exports = router;
