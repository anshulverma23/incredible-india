const express = require("express");
const c = require("../controllers/user.controller");
const { protect } = require("../middlewares/authMiddleware");
const { admin } = require("../middlewares/adminMiddleware");
const { validate } = require("../middlewares/validate");
const { makeUploader } = require("../config/cloudinary");
const { adminUserUpdate } = require("../validators/misc.validator");

const router = express.Router();
const uploadAvatar = makeUploader("avatars");

router.get("/profile", protect, c.getProfile);
router.put("/profile", protect, uploadAvatar.single("avatar"), c.updateProfile);

// Admin only
router.get("/", protect, admin, c.getAllUsers);
router.put("/:id", protect, admin, validate(adminUserUpdate), c.updateUser);
router.delete("/:id", protect, admin, c.deleteUser);

module.exports = router;
