// Background jobs (node-cron). Each job is wrapped so one failure never crashes the process.
// Multi-instance note: every job is idempotent (guarded by atomic updates), so running on 2+ instances is safe,
// just redundant. For heavier scale move these to a dedicated worker or a queue.
const cron = require("node-cron");
const logger = require("../utils/logger");
const bookingService = require("../services/booking.service");
const paymentService = require("../services/payment.service");

const safe = (name, fn) => async () => {
  try {
    await fn();
  } catch (e) {
    logger.error(`[job:${name}] ${e.message}`, { stack: e.stack });
  }
};

const startJobs = () => {
  const tasks = [
    cron.schedule("*/5 * * * *", safe("reconcile-payments", () => paymentService.reconcileOpenPayments())), // catch missed callbacks/webhooks
    cron.schedule("*/5 * * * *", safe("expire-bookings", () => bookingService.expireStaleBookings())), // release unpaid holds
    cron.schedule("15 * * * *", safe("complete-bookings", () => bookingService.completeFinishedBookings())), // unlock reviews
    cron.schedule("0 9 * * *", safe("trip-reminders", () => bookingService.sendTripReminders()), { timezone: "Asia/Kolkata" }),
  ];
  logger.info(`Background jobs started (${tasks.length})`);
  return () => tasks.forEach((t) => t.stop());
};

module.exports = { startJobs };
