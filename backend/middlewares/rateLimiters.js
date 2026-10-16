const rateLimit = require("express-rate-limit");
const { env } = require("../config/env");
const logger = require("../utils/logger");

const make = ({ windowMs, max, message }) =>
  rateLimit({
    windowMs,
    max: env.isTest ? 10_000 : max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message },
    handler: (req, res, _next, options) => {
      logger.warn("Rate limit hit", { ip: req.ip, path: req.originalUrl });
      res.status(options.statusCode).json(options.message);
    },
  });

// Whole API
const apiLimiter = make({ windowMs: 15 * 60 * 1000, max: 600, message: "Too many requests, please slow down" });
// Login / forgot-password: slow down brute force
const authLimiter = make({ windowMs: 15 * 60 * 1000, max: 20, message: "Too many attempts, please try again later" });
// Registration + contact form: anti-spam
const spamLimiter = make({ windowMs: 60 * 60 * 1000, max: 10, message: "Too many submissions, please try again later" });
// Payment endpoints
const paymentLimiter = make({ windowMs: 15 * 60 * 1000, max: 60, message: "Too many payment requests, please try again later" });
// Expensive public generators (itinerary engine)
const generatorLimiter = make({ windowMs: 15 * 60 * 1000, max: 40, message: "Too many requests, please try again later" });

module.exports = { apiLimiter, authLimiter, spamLimiter, paymentLimiter, generatorLimiter };
