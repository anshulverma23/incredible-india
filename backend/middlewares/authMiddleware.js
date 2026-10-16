const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");
const User = require("../models/user.model");
const { ALL_ROLES } = require("../models/roles");
const { env } = require("../config/env");
const logger = require("../utils/logger");

const extractToken = (req) => {
  if (req.headers.authorization?.startsWith("Bearer ")) return req.headers.authorization.split(" ")[1];
  return null; // access tokens are header-only (the refresh token lives in an httpOnly cookie scoped to /api/auth)
};

const loadUser = async (token) => {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  const user = await User.findById(decoded.id);
  if (!user) return { error: "Not authorized, user no longer exists" };
  if (!user.isActive) return { error: "This account has been deactivated" };
  if ((decoded.tv || 0) !== (user.tokenVersion || 0)) return { error: "Session expired, please log in again" };
  return { user };
};

// Verifies the JWT and attaches req.user
const protect = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);
  if (!token) {
    res.status(401);
    throw new Error("Not authorized, no token provided");
  }

  let result;
  try {
    result = await loadUser(token);
  } catch (error) {
    logger.auth("Invalid/expired access token", { ip: req.ip, path: req.originalUrl });
    res.status(401);
    throw new Error("Not authorized, invalid or expired token");
  }
  if (result.error) {
    res.status(401);
    throw new Error(result.error);
  }

  req.user = result.user;
  next();
});

// Attaches req.user if a valid token is present, but never blocks the request.
const optionalAuth = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);
  if (token) {
    try {
      const { user } = await loadUser(token);
      if (user) req.user = user;
    } catch {
      // ignore invalid token in optional auth
    }
  }
  next();
});

/**
 * Role-based access control. Must run AFTER `protect`.
 *   router.delete("/:id", protect, authorize("admin"), handler)
 * `admin` always passes. Unknown/legacy roles (hotel_manager, agent, super_admin) are denied.
 */
const authorize =
  (...roles) =>
  (req, res, next) => {
    roles.forEach((r) => {
      if (!ALL_ROLES.includes(r)) throw new Error(`authorize(): unknown role "${r}"`);
    });
    if (req.user && (req.user.role === "admin" || roles.includes(req.user.role))) return next();
    logger.auth("Forbidden - insufficient role", { user: req.user?._id, role: req.user?.role, path: req.originalUrl });
    res.status(403);
    return next(new Error("You do not have permission to perform this action"));
  };

module.exports = { protect, optionalAuth, authorize };
