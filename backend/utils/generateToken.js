const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { env } = require("../config/env");
const User = require("../models/user.model");

const REFRESH_COOKIE = "refreshToken";
const MAX_SESSIONS = 5; // refresh tokens kept per user (one per device)

// Short-lived access token (default 15m). `tv` lets us invalidate all tokens by bumping user.tokenVersion.
const signAccessToken = (user) =>
  jwt.sign({ id: user._id, role: user.role, tv: user.tokenVersion || 0 }, env.JWT_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL,
  });

const refreshCookieOptions = () => ({
  httpOnly: true,
  secure: env.isProd,
  sameSite: env.isProd ? "none" : "lax",
  path: "/api/auth", // only sent to auth endpoints
  maxAge: env.REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
});

const publicUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  avatar: user.avatar,
  phone: user.phone,
  isEmailVerified: user.isEmailVerified,
});

/**
 * Issues a new access token + rotating refresh token (stored hashed in the DB, sent as an httpOnly cookie).
 * Responds with { success, token, user }.
 */
const sendTokenResponse = async (user, statusCode, res, req) => {
  const accessToken = signAccessToken(user);

  const rawRefresh = crypto.randomBytes(48).toString("hex");
  const doc = await User.findById(user._id).select("+refreshTokens");
  const now = new Date();
  const live = (doc.refreshTokens || []).filter((t) => t.expiresAt > now).slice(-(MAX_SESSIONS - 1));
  live.push({
    tokenHash: User.hashToken(rawRefresh),
    expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000),
    userAgent: req?.headers?.["user-agent"]?.slice(0, 200),
  });
  doc.refreshTokens = live;
  doc.lastLoginAt = now;
  await doc.save({ validateModifiedOnly: true });

  res.cookie(REFRESH_COOKIE, rawRefresh, refreshCookieOptions());
  res.status(statusCode).json({ success: true, token: accessToken, user: publicUser(user) });
};

const clearRefreshCookie = (res) => res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOptions(), maxAge: undefined });

module.exports = { signAccessToken, sendTokenResponse, clearRefreshCookie, publicUser, REFRESH_COOKIE };
