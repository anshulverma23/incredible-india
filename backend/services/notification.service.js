const Notification = require("../models/notification.model");
const { emitToUser } = require("../utils/socket");
const logger = require("../utils/logger");

/**
 * Creates an in-app notification and pushes it over Socket.IO if the user is online.
 * Never throws - a failed notification must not break a payment/booking flow.
 */
const notify = async (userId, { type = "general", title, message, link, booking }) => {
  try {
    const doc = await Notification.create({ user: userId, type, title, message, link, booking });
    emitToUser(userId, "notification", doc.toObject());
    return doc;
  } catch (err) {
    logger.error(`notify failed: ${err.message}`);
    return null;
  }
};

module.exports = { notify };
