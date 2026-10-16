const express = require("express");
const c = require("../controllers/destination.controller");
const { protect } = require("../middlewares/authMiddleware");
const { admin } = require("../middlewares/adminMiddleware");
const { makeUploader } = require("../config/cloudinary");
const { cacheResponse } = require("../utils/cache");

const router = express.Router();
const uploadGallery = makeUploader("destinations");

router.get("/", cacheResponse("destinations", 120), c.getDestinations);
router.post("/", protect, admin, uploadGallery.array("gallery", 10), c.createDestination);

router.get("/:id", c.getDestinationById);
router.put("/:id", protect, admin, uploadGallery.array("gallery", 10), c.updateDestination);
router.delete("/:id", protect, admin, c.deleteDestination);

router.get("/:id/weather", c.getDestinationWeather);

module.exports = router;
