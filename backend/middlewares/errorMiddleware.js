const logger = require("../utils/logger");
const { env } = require("../config/env");

// Catches requests to routes that don't exist
const notFound = (req, res, next) => {
  res.status(404);
  next(new Error(`Route not found - ${req.originalUrl}`));
};

// Centralized error handler - formats Mongoose/JWT/Multer errors into clean JSON and logs server errors.
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || (res.statusCode && res.statusCode !== 200 ? res.statusCode : 500);
  let message = err.message || "Server Error";

  if (err.name === "CastError") {
    statusCode = 404;
    message = "Resource not found";
  }

  if (err.name === "ValidationError" && err.errors) {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((val) => val.message)
      .join(", ");
  }

  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0];
    message = `${field ? field.charAt(0).toUpperCase() + field.slice(1) : "Field"} already exists`;
  }

  if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid token";
  }
  if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Token expired";
  }

  if (err.name === "MulterError") {
    statusCode = 400;
    if (err.code === "LIMIT_FILE_SIZE") message = "File too large (max 5MB per image)";
  }

  if (err.type === "entity.too.large") {
    statusCode = 413;
    message = "Request body too large";
  }
  if (err.type === "entity.parse.failed") {
    statusCode = 400;
    message = "Malformed JSON body";
  }
  if (err.message === "Not allowed by CORS") statusCode = 403;

  if (statusCode >= 500) {
    // Server errors: full detail goes to the logs, never to the client in production
    logger.error(err.message, { stack: err.stack, method: req.method, url: req.originalUrl, user: req.user?._id });
    if (env.isProd) message = "Something went wrong on our side. Please try again.";
  } else if (statusCode >= 400 && statusCode !== 404) {
    logger.debug(`${statusCode} ${req.method} ${req.originalUrl} - ${message}`);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(err.details ? { details: err.details } : {}),
    ...(env.isProd ? {} : { stack: err.stack }),
  });
};

module.exports = { notFound, errorHandler };
