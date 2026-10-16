const express = require("express");
const c = require("../controllers/auth.controller");
const { protect } = require("../middlewares/authMiddleware");
const { validate } = require("../middlewares/validate");
const { authLimiter, spamLimiter } = require("../middlewares/rateLimiters");
const v = require("../validators/auth.validator");

const router = express.Router();

router.post("/register", spamLimiter, validate(v.register), c.registerUser);
router.post("/login", authLimiter, validate(v.login), c.loginUser);
router.post("/google", authLimiter, validate(v.google), c.googleAuth);
router.post("/refresh", authLimiter, c.refreshToken);
router.post("/forgot-password", authLimiter, validate(v.forgotPassword), c.forgotPassword);
router.put("/reset-password/:token", authLimiter, validate(v.resetPassword), c.resetPassword);
router.get("/verify-email/:token", c.verifyEmail);
router.put("/change-password", protect, validate(v.changePassword), c.changePassword);
router.get("/me", protect, c.getMe);
router.post("/logout", protect, c.logoutUser);
router.post("/logout-all", protect, c.logoutAll);

module.exports = router;
