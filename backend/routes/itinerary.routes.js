const express = require("express");
const c = require("../controllers/itinerary.controller");
const { protect } = require("../middlewares/authMiddleware");
const { validate } = require("../middlewares/validate");
const { generatorLimiter } = require("../middlewares/rateLimiters");
const { itinerary, saveItinerary } = require("../validators/misc.validator");

const router = express.Router();

router.get("/destinations", c.plannable);
router.post("/generate", generatorLimiter, validate(itinerary), c.generate);

router.get("/my", protect, c.mine);
router.post("/", protect, validate(saveItinerary), c.save);
router.delete("/:id", protect, c.remove);

module.exports = router;
