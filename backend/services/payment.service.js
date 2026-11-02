const Booking = require("../models/booking.model");
const PackageEnquiry = require("../models/packageEnquiry.model");
const Payment = require("../models/payment.model");
const Coupon = require("../models/coupon.model");
const CouponUsage = require("../models/couponUsage.model");
const WebhookEvent = require("../models/webhookEvent.model");
const User = require("../models/user.model");
const { env } = require("../config/env");
const { PACKAGE_ENQUIRY } = require("../config/policy");
const { httpError } = require("../utils/httpError");
const logger = require("../utils/logger");
const { getRazorpay, isConfigured, verifyPaymentSignature, verifyWebhookSignature } = require("../utils/razorpay");
const { queueEmail, emailTemplates } = require("../utils/sendEmail");
const { invoiceToBuffer } = require("../utils/invoice");
const { notify } = require("./notification.service");
const availability = require("./availability.service");

const populateBooking = (q) =>
  q.populate("user", "name email phone").populate("hotel", "name location").populate("room", "roomType totalRooms").populate("package", "name maxGroupSize");

/** What a payment of this purpose must be (rupees). Always computed from the DB, never from the client. */
const expectedAmount = (booking, purpose = "full") => {
  if (purpose === "advance") return booking.paymentPlan.advanceAmount;
  if (purpose === "balance") return booking.paymentPlan.balanceAmount;
  return booking.pricing.totalAmount;
};

/* ------------------------------------------------------------------ */
/* 1. Create order                                                     */
/* ------------------------------------------------------------------ */
const createOrder = async (bookingId, user) => {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw httpError(404, "Booking not found");
  if (String(booking.user) !== String(user._id)) throw httpError(403, "Not authorized for this booking");
  if (booking.paymentStatus === "paid") throw httpError(400, "Booking is already paid for");

  // Advance plan: 1st payment = advance (booking is "pending"), 2nd payment = balance (booking is already "confirmed").
  const plan = booking.paymentPlan;
  const isAdvancePlan = plan?.mode === "advance";
  const isBalance = isAdvancePlan && booking.paymentStatus === "partially_paid" && booking.bookingStatus === "confirmed";
  const purpose = isBalance ? "balance" : isAdvancePlan ? "advance" : "full";

  if (booking.bookingStatus === "pending_confirmation") throw httpError(409, "This hotel request is still waiting for the hotel's confirmation. You can pay once the final price is sent and you approve it.");
  if (booking.bookingStatus === "awaiting_approval") throw httpError(409, "Please approve the final price on your booking page before paying.");
  if (!isBalance && booking.bookingStatus !== "pending") throw httpError(409, `This booking is ${booking.bookingStatus} and can no longer be paid`);
  if (!isBalance && booking.expiresAt && booking.expiresAt < new Date()) throw httpError(409, "This booking has expired. Please create a new booking.");

  const amountRupees = expectedAmount(booking, purpose);
  if (!(amountRupees > 0)) throw httpError(400, "Nothing to pay for this booking");

  // Idempotent: reuse the open order for the same amount (page refresh / double click / retry after a failed attempt)
  const open = await Payment.findOne({ booking: booking._id, status: { $in: ["created", "failed"] }, amount: amountRupees, ...(purpose === "full" ? {} : { purpose }) }).sort({ createdAt: -1 });
  if (open?.razorpayOrderId) {
    return { orderId: open.razorpayOrderId, amount: Math.round(open.amount * 100), currency: open.currency, keyId: env.RAZORPAY_KEY_ID, payment: open };
  }

  const order = await getRazorpay().orders.create({
    amount: Math.round(amountRupees * 100), // paise - integer, always computed from the DB, never from the client
    currency: "INR",
    receipt: booking.bookingReference,
    notes: { bookingId: String(booking._id), bookingReference: booking.bookingReference, purpose },
  });

  const payment = await Payment.create({
    booking: booking._id,
    user: user._id,
    gateway: "razorpay",
    razorpayOrderId: order.id,
    purpose,
    amount: amountRupees,
    currency: "INR",
    status: "created",
  });

  // Give the customer time to finish paying, but cap the total hold at 2x the normal window.
  const now = Date.now();
  // Hotel requests start the payment window when the customer approves the price (not when they first asked).
  // Custom quotation bookings get the (longer) enquiry payment window instead.
  const holdMs = booking.enquiry ? PACKAGE_ENQUIRY.paymentWindowHours * 3_600_000 : 2 * env.BOOKING_HOLD_MINUTES * 60_000;
  const cap = (booking.approvedAt || booking.createdAt).getTime() + holdMs;
  if (!isBalance) {
    booking.expiresAt = new Date(Math.min(cap, Math.max(booking.expiresAt?.getTime() || 0, now + 15 * 60_000)));
    booking.payment = payment._id;
    booking.paymentStatus = "pending";
    await booking.save();
  }

  return { orderId: order.id, amount: order.amount, currency: order.currency, keyId: env.RAZORPAY_KEY_ID, payment };
};

/* ------------------------------------------------------------------ */
/* 2. Confirm payment (shared by client verify, webhook, reconcile)    */
/* ------------------------------------------------------------------ */
const sendConfirmationEmails = async (booking, payment) => {
  try {
    const full = await populateBooking(Booking.findById(booking._id));
    const attachments = [];
    try {
      attachments.push({ filename: `${full.invoiceNumber}.pdf`, content: await invoiceToBuffer(full, payment), contentType: "application/pdf" });
    } catch (e) {
      logger.error(`Invoice generation failed for ${full.bookingReference}: ${e.message}`);
    }
    queueEmail({ to: full.user.email, subject: `Booking Confirmed - ${full.bookingReference}`, html: emailTemplates.bookingConfirmation(full.user.name, full), attachments });
    queueEmail({ to: full.user.email, subject: `Payment Receipt - ${full.bookingReference}`, html: emailTemplates.paymentReceipt(full.user.name, full, payment) });

    // Tell the admin(s): ADMIN_NOTIFY_EMAIL if set, otherwise every active admin.
    let adminEmails = env.ADMIN_NOTIFY_EMAIL ? [env.ADMIN_NOTIFY_EMAIL] : [];
    if (!adminEmails.length) {
      adminEmails = (await User.find({ role: "admin", isActive: true }).select("email").lean()).map((u) => u.email);
    }
    if (adminEmails.length) {
      queueEmail({ to: adminEmails.join(","), subject: `New booking ${full.bookingReference}`, html: emailTemplates.adminNewBooking(full, full.user) });
    }
  } catch (e) {
    logger.error(`sendConfirmationEmails failed: ${e.message}`);
  }
};

const recordCouponUsage = async (booking) => {
  if (!booking.coupon) return;
  try {
    await CouponUsage.create({ coupon: booking.coupon, user: booking.user, booking: booking._id, discount: booking.pricing.discount });
    await Coupon.updateOne({ _id: booking.coupon }, { $inc: { usedCount: 1 } });
  } catch (e) {
    if (e.code !== 11000) logger.error(`recordCouponUsage failed: ${e.message}`); // 11000 = already recorded -> fine
  }
};

/**
 * Marks a payment as paid and confirms its booking. SAFE TO CALL MANY TIMES / CONCURRENTLY:
 * the conditional update below only matches while the payment is not yet "paid", so exactly one caller
 * performs the side effects (emails, coupon redemption, notifications).
 */
const confirmPayment = async ({ orderId, paymentId, signature, method, via }) => {
  // Claim by _id + current status: a single-document conditional update is atomic on MongoDB (and on every Mongo-compatible store).
  const target = await Payment.findOne({ razorpayOrderId: orderId }).select("_id");
  const claimed = !target
    ? null
    : await Payment.findOneAndUpdate(
        { _id: target._id, status: { $in: ["created", "failed"] } },
        { $set: { status: "paid", razorpayPaymentId: paymentId, razorpaySignature: signature, method, confirmedVia: via, paidAt: new Date() }, $unset: { failureReason: "" } },
        { new: true }
      );

  if (!claimed) {
    const existing = await Payment.findOne({ razorpayOrderId: orderId });
    if (!existing) throw httpError(404, "Payment not found");
    const booking = await populateBooking(Booking.findById(existing.booking));
    return { payment: existing, booking, alreadyProcessed: true };
  }

  let booking = await Booking.findById(claimed.booking);
  if (!booking) {
    logger.payment("Payment captured for a booking that no longer exists - refunding", { orderId });
    await refundPayment(claimed, claimed.amount, "Booking not found").catch((e) => logger.error(e.message));
    throw httpError(404, "Booking not found");
  }

  // The money has been captured. Decide whether we can still honour the booking.
  let problem = null;
  const purpose = claimed.purpose || "full";
  if (claimed.amount !== expectedAmount(booking, purpose)) {
    problem = "Amount paid does not match the booking total";
  } else if (purpose === "balance") {
    // The balance only makes sense while an advance is paid and the rest is still open.
    if (booking.paymentStatus !== "partially_paid") problem = "Balance was already paid";
  } else if (booking.bookingStatus === "confirmed" || booking.bookingStatus === "completed") {
    // duplicate payment for an already-confirmed booking
    problem = "Booking was already paid";
  } else if (["cancelled", "expired", "failed", "refunded"].includes(booking.bookingStatus) || (booking.expiresAt && booking.expiresAt < new Date())) {
    // Late payment (the hold lapsed). Re-check inventory; keep the booking only if the slot is still free.
    const ok = await slotStillFree(booking);
    if (!ok) problem = "The booking hold expired and the inventory is no longer available";
  }

  if (problem) {
    logger.payment(`Auto-refunding payment: ${problem}`, { orderId, booking: booking.bookingReference });
    await refundPayment(claimed, claimed.amount, problem).catch((e) => logger.error(`Auto-refund failed: ${e.message}`));
    if (!["confirmed", "completed"].includes(booking.bookingStatus)) {
      booking.paymentStatus = "refunded";
      booking.setStatus("failed", { note: problem });
      await booking.save();
    }
    await notify(booking.user, { type: "payment_failed", title: "Payment refunded", message: `${problem}. Your payment of Rs. ${claimed.amount} is being refunded.`, link: `/bookings/${booking._id}`, booking: booking._id });
    const fresh = await populateBooking(Booking.findById(booking._id));
    return { payment: claimed, booking: fresh, refunded: true, reason: problem };
  }

  // Balance of an advance plan: the booking is already confirmed, it just becomes fully paid.
  if (purpose === "balance") {
    booking.paymentStatus = "paid";
    booking.amountPaid = (booking.amountPaid || 0) + claimed.amount;
    booking.paymentPlan.balancePaidAt = new Date();
    booking.statusHistory.push({ status: booking.bookingStatus, note: `Balance payment received via ${via}` });
    await booking.save();
    await notify(booking.user, { type: "payment_success", title: "Balance payment received", message: `We received the balance of Rs. ${claimed.amount} for booking ${booking.bookingReference}. It is now fully paid.`, link: `/bookings/${booking._id}`, booking: booking._id });
    const customer = await User.findById(booking.user).select("name email").lean();
    if (customer?.email) queueEmail({ to: customer.email, subject: `Payment Receipt - ${booking.bookingReference}`, html: emailTemplates.paymentReceipt(customer.name, booking, claimed) });
    return { payment: claimed, booking: await populateBooking(Booking.findById(booking._id)) };
  }

  booking.payment = claimed._id;
  booking.amountPaid = claimed.amount;
  booking.paymentStatus = purpose === "advance" ? "partially_paid" : "paid";
  booking.confirmedAt = new Date();
  booking.expiresAt = undefined;
  booking.setStatus("confirmed", { note: purpose === "advance" ? `Advance payment confirmed via ${via}` : `Payment confirmed via ${via}` });
  await booking.save();

  await recordCouponUsage(booking);

  // Custom quotation: the enquiry is now a confirmed booking.
  if (booking.enquiry) {
    await PackageEnquiry.updateOne(
      { _id: booking.enquiry, status: "accepted" },
      { $set: { status: "booked", bookedAt: new Date(), lastActivityAt: new Date() }, $push: { statusHistory: { status: "booked", at: new Date(), note: purpose === "advance" ? "Advance payment received" : "Payment received" } } }
    ).catch((e) => logger.error(`enquiry booked sync failed: ${e.message}`));
  }

  await notify(booking.user, {
    type: "payment_success",
    title: purpose === "advance" ? "Advance payment received" : "Payment successful",
    message: purpose === "advance" ? `We received the advance of Rs. ${claimed.amount} for booking ${booking.bookingReference}. Balance Rs. ${booking.paymentPlan.balanceAmount} is due before your trip.` : `We received Rs. ${claimed.amount} for booking ${booking.bookingReference}.`,
    link: `/bookings/${booking._id}`,
    booking: booking._id,
  });
  await notify(booking.user, { type: "booking_confirmed", title: "Booking confirmed", message: `Your booking ${booking.bookingReference} is confirmed. Have a great trip!`, link: `/bookings/${booking._id}`, booking: booking._id });
  sendConfirmationEmails(booking, claimed); // not awaited on purpose

  booking = await populateBooking(Booking.findById(booking._id));
  return { payment: claimed, booking };
};

// For late payments: is there still room for this booking (ignoring itself)?
const slotStillFree = async (booking) => {
  if (booking.bookingType === "hotel") {
    const Room = require("../models/room.model");
    const room = await Room.findById(booking.room);
    if (!room) return false;
    return (await availability.roomsAvailable(room, booking.checkIn, booking.checkOut, { excludeId: booking._id })) >= booking.numberOfRooms;
  }
  const Package = require("../models/package.model");
  const pkg = await Package.findById(booking.package);
  if (!pkg) return false;
  const need = (booking.guests.adults || 1) + (booking.guests.children || 0);
  return (await availability.packageSeatsLeft(pkg, booking.travelDate, { excludeId: booking._id })) >= need;
};

/* ------------------------------------------------------------------ */
/* 3. Client-side verification (after Razorpay Checkout succeeds)      */
/* ------------------------------------------------------------------ */
const verifyClientPayment = async ({ orderId, paymentId, signature }, user) => {
  if (!verifyPaymentSignature({ orderId, paymentId, signature })) {
    logger.payment("Signature verification failed", { orderId, paymentId, user: String(user._id) });
    throw httpError(400, "Payment verification failed - signature mismatch");
  }

  // The booking is derived from OUR payment record, never from client-supplied ids.
  const payment = await Payment.findOne({ razorpayOrderId: orderId });
  if (!payment) throw httpError(404, "Payment order not found");
  const isOwner = String(payment.user) === String(user._id);
  if (!isOwner && user.role !== "admin") throw httpError(403, "Not authorized for this payment");

  // Reconcile with Razorpay itself: the payment must really be captured for the right order + amount.
  let method;
  if (isConfigured()) {
    try {
      const rp = await getRazorpay().payments.fetch(paymentId);
      if (rp.order_id !== orderId) throw httpError(400, "Payment does not belong to this order");
      if (Number(rp.amount) !== Math.round(payment.amount * 100)) throw httpError(400, "Payment amount mismatch");
      if (rp.status !== "captured") {
        throw httpError(409, rp.status === "failed" ? "Payment failed" : "Payment is not captured yet - we'll confirm your booking automatically once it is");
      }
      method = rp.method;
    } catch (e) {
      if (e.statusCode) throw e;
      logger.warn(`Could not fetch payment ${paymentId} from Razorpay (continuing on verified signature): ${e.message}`);
    }
  }

  return confirmPayment({ orderId, paymentId, signature, method, via: "client" });
};

/* ------------------------------------------------------------------ */
/* 4. Failure handling                                                 */
/* ------------------------------------------------------------------ */
const markPaymentFailed = async (orderId, reason = "Payment failed") => {
  const target = await Payment.findOne({ razorpayOrderId: orderId }).select("_id");
  if (!target) return null;
  const payment = await Payment.findOneAndUpdate(
    { _id: target._id, status: "created" },
    { $set: { status: "failed", failureReason: reason }, $inc: { failureCount: 1 } },
    { new: true }
  );
  if (!payment) return null; // already paid / unknown -> ignore (never downgrade a paid payment)

  logger.payment("Payment failed", { orderId, reason, booking: String(payment.booking) });
  const booking = await Booking.findOneAndUpdate({ _id: payment.booking, bookingStatus: "pending" }, { $set: { paymentStatus: "failed" } }, { new: true });
  if (booking) {
    await notify(booking.user, { type: "payment_failed", title: "Payment failed", message: `Your payment for booking ${booking.bookingReference} didn't go through. You can retry before the hold expires.`, link: `/checkout/${booking._id}`, booking: booking._id });
  }
  return payment;
};

/* ------------------------------------------------------------------ */
/* 5. Refunds                                                          */
/* ------------------------------------------------------------------ */
/** Refunds `amount` rupees of a paid payment through Razorpay and records it. */
const refundPayment = async (payment, amount, reason = "Refund", by) => {
  const refundable = payment.amount - (payment.refundedAmount || 0);
  amount = Math.round(amount);
  if (!(amount > 0)) throw httpError(400, "Refund amount must be greater than zero");
  if (amount > refundable) throw httpError(400, `Only Rs. ${refundable} is refundable on this payment`);
  if (!["paid", "partially_refunded"].includes(payment.status)) throw httpError(400, "Only paid payments can be refunded");
  if (!payment.razorpayPaymentId) throw httpError(400, "Payment has no gateway reference");

  const refund = await getRazorpay().payments.refund(payment.razorpayPaymentId, {
    amount: amount * 100,
    notes: { reason: String(reason).slice(0, 200), bookingId: String(payment.booking) },
  });

  payment.refunds.push({ refundId: refund.id, amount, reason, status: refund.status || "processed", by });
  payment.refundedAmount = (payment.refundedAmount || 0) + amount;
  payment.status = payment.refundedAmount >= payment.amount ? "refunded" : "partially_refunded";
  await payment.save();
  return payment;
};

/**
 * Refunds `amount` rupees of a booking that was paid in more than one payment (advance + balance).
 * The newest payment is refunded first. Returns the amount actually refunded.
 */
const refundBookingAmount = async (booking, amount, reason, by) => {
  const payments = await Payment.find({ booking: booking._id, status: { $in: ["paid", "partially_refunded"] } }).sort({ paidAt: -1 });
  let left = Math.round(amount);
  let refunded = 0;
  for (const p of payments) {
    const take = Math.min(left, p.amount - (p.refundedAmount || 0));
    if (take > 0) {
      await refundPayment(p, take, reason, by);
      left -= take;
      refunded += take;
    }
    if (left <= 0) break;
  }
  return refunded;
};

/* ------------------------------------------------------------------ */
/* 6. Webhooks                                                         */
/* ------------------------------------------------------------------ */
const handleWebhook = async ({ rawBody, signature, eventIdHeader }) => {
  if (!verifyWebhookSignature({ rawBody, signature })) {
    logger.payment("Webhook signature verification failed");
    throw httpError(400, "Invalid webhook signature");
  }

  const event = JSON.parse(rawBody.toString("utf8"));
  const eventId = eventIdHeader || `${event.event}:${event.payload?.payment?.entity?.id || event.payload?.refund?.entity?.id || event.created_at}`;

  if (await WebhookEvent.exists({ eventId })) return { duplicate: true };

  const paymentEntity = event.payload?.payment?.entity;
  switch (event.event) {
    case "payment.captured":
    case "order.paid": {
      const orderId = paymentEntity?.order_id || event.payload?.order?.entity?.id;
      if (orderId && paymentEntity?.id) {
        await confirmPayment({ orderId, paymentId: paymentEntity.id, method: paymentEntity.method, via: "webhook" });
      }
      break;
    }
    case "payment.failed":
      if (paymentEntity?.order_id) {
        await markPaymentFailed(paymentEntity.order_id, paymentEntity.error_description || paymentEntity.error_reason || "Payment failed");
      }
      break;
    case "refund.processed": {
      await syncRefundFromWebhook(event.payload?.refund?.entity);
      break;
    }
    default:
      logger.debug(`Ignoring webhook event ${event.event}`);
  }

  // Recorded AFTER successful processing so a crash mid-way lets Razorpay's retry run again.
  await WebhookEvent.create({ eventId, event: event.event }).catch((e) => {
    if (e.code !== 11000) throw e;
  });
  return { processed: true };
};

// Refunds initiated from the Razorpay dashboard won't be in our DB yet - record them so reports stay correct.
const syncRefundFromWebhook = async (refund) => {
  if (!refund?.payment_id) return;
  const payment = await Payment.findOne({ razorpayPaymentId: refund.payment_id });
  if (!payment || payment.refunds.some((r) => r.refundId === refund.id)) return;

  const amount = Math.round(refund.amount / 100);
  payment.refunds.push({ refundId: refund.id, amount, reason: "Refund processed via gateway", status: "processed" });
  payment.refundedAmount = (payment.refundedAmount || 0) + amount;
  payment.status = payment.refundedAmount >= payment.amount ? "refunded" : "partially_refunded";
  await payment.save();

  const booking = await Booking.findById(payment.booking);
  if (booking && booking.bookingStatus !== "refunded") {
    if (booking.paymentPlan?.mode === "advance") {
      // Two payments belong to this booking: judge by everything refunded so far, not by this one payment.
      const all = await Payment.find({ booking: booking._id, status: { $in: ["paid", "partially_refunded", "refunded"] } }).select("refundedAmount");
      const refunded = all.reduce((s, p) => s + (p.refundedAmount || 0), 0);
      booking.paymentStatus = refunded >= (booking.amountPaid || 0) ? "refunded" : "partially_refunded";
    } else {
      booking.paymentStatus = payment.status;
    }
    booking.setStatus(payment.status === "refunded" ? "refunded" : booking.bookingStatus, { note: "Refund processed via gateway" });
    await booking.save();
    await notify(booking.user, { type: "refund_processed", title: "Refund processed", message: `Rs. ${amount} has been refunded for booking ${booking.bookingReference}.`, link: `/bookings/${booking._id}`, booking: booking._id });
  }
};

/* ------------------------------------------------------------------ */
/* 7. Reconciliation (cron): catch payments whose callback/webhook never arrived */
/* ------------------------------------------------------------------ */
const reconcileOpenPayments = async () => {
  if (!isConfigured()) return { checked: 0, confirmed: 0 };
  const olderThan = new Date(Date.now() - 5 * 60_000);
  const newerThan = new Date(Date.now() - 2 * 24 * 60 * 60_000);
  const open = await Payment.find({ status: { $in: ["created", "failed"] }, createdAt: { $lt: olderThan, $gt: newerThan }, razorpayOrderId: { $exists: true } }).limit(50);

  let confirmed = 0;
  for (const p of open) {
    try {
      const res = await getRazorpay().orders.fetchPayments(p.razorpayOrderId);
      const captured = (res.items || []).find((i) => i.status === "captured");
      if (captured) {
        await confirmPayment({ orderId: p.razorpayOrderId, paymentId: captured.id, method: captured.method, via: "reconcile" });
        confirmed++;
        logger.info(`Reconciled payment for order ${p.razorpayOrderId}`);
      }
    } catch (e) {
      logger.error(`reconcile ${p.razorpayOrderId} failed: ${e.message}`);
    }
  }
  return { checked: open.length, confirmed };
};

module.exports = {
  createOrder,
  confirmPayment,
  verifyClientPayment,
  markPaymentFailed,
  refundPayment,
  handleWebhook,
  reconcileOpenPayments,
  populateBooking,
  expectedAmount,
  refundBookingAmount,
};
