const express = require("express");
const c = require("../controllers/payment.controller");
const { protect } = require("../middlewares/authMiddleware");
const { admin } = require("../middlewares/adminMiddleware");
const { validate } = require("../middlewares/validate");
const { paymentLimiter } = require("../middlewares/rateLimiters");
const v = require("../validators/payment.validator");

const router = express.Router();

// NOTE: POST /webhook is mounted in app.js (it needs the RAW body and no auth / no CSRF-style middleware).

router.post("/create-order", protect, paymentLimiter, validate(v.createOrder), c.createOrder);
router.post("/verify", protect, paymentLimiter, validate(v.verify), c.verifyPayment);
router.post("/failed", protect, paymentLimiter, validate(v.reportFailure), c.reportFailure);

// Admin (order matters: /admin/stats and /admin/revenue before /admin/:id)
router.get("/admin", protect, admin, c.adminList);
router.get("/admin/stats", protect, admin, c.adminStats);
router.get("/admin/revenue", protect, admin, c.adminRevenue);
router.get("/admin/:id", protect, admin, c.adminGet);
router.post("/admin/:id/refund", protect, admin, validate(v.refund), c.adminRefund);

module.exports = router;
