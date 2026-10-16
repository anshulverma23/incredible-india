const express = require("express");
const c = require("../controllers/coupon.controller");
const { protect } = require("../middlewares/authMiddleware");
const { admin } = require("../middlewares/adminMiddleware");
const { validate } = require("../middlewares/validate");
const v = require("../validators/coupon.validator");

const router = express.Router();

router.post("/validate", protect, validate(v.validate), c.validateCoupon);

router.get("/", protect, admin, c.getCoupons);
router.post("/", protect, admin, validate(v.create), c.createCoupon);
router.put("/:id", protect, admin, validate(v.update), c.updateCoupon);
router.delete("/:id", protect, admin, c.deleteCoupon);

module.exports = router;
