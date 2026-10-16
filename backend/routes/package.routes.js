const express = require("express");
const c = require("../controllers/package.controller");
const { protect } = require("../middlewares/authMiddleware");
const { admin } = require("../middlewares/adminMiddleware");
const { makeUploader } = require("../config/cloudinary");
const { cacheResponse } = require("../utils/cache");

const router = express.Router();
const uploadGallery = makeUploader("packages");

router.get("/", cacheResponse("packages", 60), c.getPackages); // public
router.post("/", protect, admin, uploadGallery.array("gallery", 10), c.createPackage);

router.get("/:id/availability", c.checkAvailability);
router.get("/:id", c.getPackageById); // public (live seat counts -> not cached)
router.put("/:id", protect, admin, uploadGallery.array("gallery", 10), c.updatePackage);
router.delete("/:id", protect, admin, c.deletePackage);

module.exports = router;
