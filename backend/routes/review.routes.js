const express = require("express");
const c = require("../controllers/review.controller");
const { protect } = require("../middlewares/authMiddleware");
const { admin } = require("../middlewares/adminMiddleware");
const { validate } = require("../middlewares/validate");
const { makeUploader } = require("../config/cloudinary");
const v = require("../validators/review.validator");

const router = express.Router();
const uploadReviewImages = makeUploader("reviews");

router.get("/eligibility", protect, validate(v.eligibility, "query"), c.eligibility);
router.post("/", protect, uploadReviewImages.array("images", 4), validate(v.create), c.createReview);
router.get("/", protect, admin, c.getAllReviews);
router.get("/hotel/:hotelId", c.getHotelReviews);
router.get("/package/:packageId", c.getPackageReviews);
router.put("/:id", protect, uploadReviewImages.array("images", 4), validate(v.update), c.updateReview);
router.delete("/:id", protect, c.deleteReview);

module.exports = router;
