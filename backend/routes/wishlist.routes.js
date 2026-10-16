const express = require("express");
const c = require("../controllers/wishlist.controller");
const { protect } = require("../middlewares/authMiddleware");
const { validate } = require("../middlewares/validate");
const { wishlistAdd } = require("../validators/misc.validator");

const router = express.Router();
router.use(protect);

router.get("/", c.getWishlist);
router.post("/", validate(wishlistAdd), c.addToWishlist);
router.delete("/:itemId", c.removeFromWishlist);

module.exports = router;
