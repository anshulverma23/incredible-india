const crypto = require("crypto");
const asyncHandler = require("express-async-handler");
const { OAuth2Client } = require("google-auth-library");
const User = require("../models/user.model");
const { env } = require("../config/env");
const { sendTokenResponse, clearRefreshCookie, REFRESH_COOKIE } = require("../utils/generateToken");
const { queueEmail, emailTemplates } = require("../utils/sendEmail");
const logger = require("../utils/logger");

const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

// @route POST /api/auth/register
const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password, phone } = req.body;

  if (await User.exists({ email })) {
    res.status(409);
    throw new Error("An account with this email already exists");
  }

  // role is NEVER taken from the request body - everyone registers as a normal user
  const user = await User.create({ name, email, password, phone: phone || undefined });

  const rawToken = user.createVerificationToken();
  await user.save();
  queueEmail({
    to: user.email,
    subject: "Verify your India Travel account",
    html: emailTemplates.verifyEmail(user.name, `${env.FRONTEND_URL}/verify-email/${rawToken}`),
  });

  await sendTokenResponse(user, 201, res, req);
});

// @route POST /api/auth/login
const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select("+password");
  if (!user || !(await user.matchPassword(password))) {
    logger.auth("Failed login", { email, ip: req.ip });
    res.status(401);
    throw new Error("Invalid email or password");
  }
  if (!user.isActive) {
    res.status(403);
    throw new Error("This account has been deactivated");
  }

  await sendTokenResponse(user, 200, res, req);
});

// @route POST /api/auth/google
const googleAuth = asyncHandler(async (req, res) => {
  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: req.body.idToken, audience: env.GOOGLE_CLIENT_ID });
    payload = ticket.getPayload();
  } catch (e) {
    logger.auth("Google token verification failed", { ip: req.ip });
    res.status(401);
    throw new Error("Google sign-in failed");
  }
  if (!payload?.email_verified) {
    res.status(401);
    throw new Error("Your Google email address is not verified");
  }

  let user = await User.findOne({ $or: [{ googleId: payload.sub }, { email: payload.email.toLowerCase() }] });
  if (!user) {
    user = await User.create({
      name: payload.name,
      email: payload.email,
      googleId: payload.sub,
      isEmailVerified: true,
      avatar: { url: payload.picture || "", public_id: "" },
    });
  } else if (!user.googleId) {
    user.googleId = payload.sub;
    user.isEmailVerified = true;
    await user.save();
  }
  if (!user.isActive) {
    res.status(403);
    throw new Error("This account has been deactivated");
  }

  await sendTokenResponse(user, 200, res, req);
});

// @route POST /api/auth/refresh  - rotates the refresh token (httpOnly cookie) and returns a new access token
const refreshToken = asyncHandler(async (req, res) => {
  const raw = req.cookies?.[REFRESH_COOKIE];
  if (!raw) {
    res.status(401);
    throw new Error("No refresh token");
  }
  const hash = User.hashToken(raw);
  const user = await User.findOne({ "refreshTokens.tokenHash": hash }).select("+refreshTokens");
  const entry = user?.refreshTokens.find((t) => t.tokenHash === hash);

  if (!user || !entry || entry.expiresAt < new Date() || !user.isActive) {
    clearRefreshCookie(res);
    res.status(401);
    throw new Error("Session expired, please log in again");
  }

  // Rotation: the used token is removed, sendTokenResponse stores a fresh one.
  user.refreshTokens = user.refreshTokens.filter((t) => t.tokenHash !== hash);
  await user.save({ validateModifiedOnly: true });
  await sendTokenResponse(user, 200, res, req);
});

// @route POST /api/auth/forgot-password
const forgotPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  const message = "If that email is registered, a reset link has been sent";

  if (user && user.isActive) {
    const rawToken = user.createResetPasswordToken();
    await user.save();
    queueEmail({
      to: user.email,
      subject: "Reset your India Travel password",
      html: emailTemplates.resetPassword(user.name, `${env.FRONTEND_URL}/reset-password/${rawToken}`),
    });
  }
  res.status(200).json({ success: true, message }); // identical response either way -> no account enumeration
});

// @route PUT /api/auth/reset-password/:token
const resetPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({
    resetPasswordToken: User.hashToken(req.params.token),
    resetPasswordExpire: { $gt: Date.now() },
  }).select("+refreshTokens");

  if (!user) {
    res.status(400);
    throw new Error("Reset link is invalid or has expired");
  }

  user.password = req.body.password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  user.tokenVersion += 1; // kills every existing access token
  user.refreshTokens = []; // ...and every refresh token
  await user.save();

  queueEmail({ to: user.email, subject: "Your password was changed", html: emailTemplates.passwordChanged(user.name) });
  await sendTokenResponse(user, 200, res, req);
});

// @route GET /api/auth/verify-email/:token
const verifyEmail = asyncHandler(async (req, res) => {
  const user = await User.findOne({
    emailVerificationToken: User.hashToken(req.params.token),
    emailVerificationExpire: { $gt: Date.now() },
  });
  if (!user) {
    res.status(400);
    throw new Error("Verification link is invalid or has expired");
  }
  user.isEmailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpire = undefined;
  await user.save();
  res.status(200).json({ success: true, message: "Email verified successfully" });
});

// @route PUT /api/auth/change-password
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select("+password +refreshTokens");

  if (!user.password || !(await user.matchPassword(currentPassword))) {
    res.status(401);
    throw new Error("Current password is incorrect");
  }
  user.password = newPassword;
  user.tokenVersion += 1;
  user.refreshTokens = [];
  await user.save();

  queueEmail({ to: user.email, subject: "Your password was changed", html: emailTemplates.passwordChanged(user.name) });
  await sendTokenResponse(user, 200, res, req); // this device stays signed in with a fresh token
});

// @route GET /api/auth/me
const getMe = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, user: req.user });
});

// @route POST /api/auth/logout  - revokes this device's refresh token
const logoutUser = asyncHandler(async (req, res) => {
  const raw = req.cookies?.[REFRESH_COOKIE];
  if (raw) {
    await User.updateOne({ _id: req.user._id }, { $pull: { refreshTokens: { tokenHash: User.hashToken(raw) } } });
  }
  clearRefreshCookie(res);
  res.status(200).json({ success: true, message: "Logged out successfully" });
});

// @route POST /api/auth/logout-all  - sign out of every device
const logoutAll = asyncHandler(async (req, res) => {
  await User.updateOne({ _id: req.user._id }, { $inc: { tokenVersion: 1 }, $set: { refreshTokens: [] } });
  clearRefreshCookie(res);
  res.status(200).json({ success: true, message: "Signed out of all devices" });
});

module.exports = { registerUser, loginUser, googleAuth, refreshToken, forgotPassword, resetPassword, verifyEmail, changePassword, getMe, logoutUser, logoutAll };
