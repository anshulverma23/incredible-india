const Booking = require("../models/booking.model");
const Room = require("../models/room.model");
const Hotel = require("../models/hotel.model");
const Package = require("../models/package.model");
const Coupon = require("../models/coupon.model");
const CouponUsage = require("../models/couponUsage.model");
const Payment = require("../models/payment.model");
const User = require("../models/user.model");
const { env } = require("../config/env");
const { LIMITS, CANCELLATION_TIERS, HOTEL_REQUEST } = require("../config/policy");
const { httpError } = require("../utils/httpError");
const logger = require("../utils/logger");
const { calculatePricing, nightsBetween, startOfDay, MS_PER_DAY } = require("../utils/pricing");
const { queueEmail, emailTemplates } = require("../utils/sendEmail");
const availability = require("./availability.service");
const paymentService = require("./payment.service");
const { notify } = require("./notification.service");

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
// "Today" for an Indian customer (a user booking at 1am IST is still on the previous UTC date).
const todayIST = () => startOfDay(new Date(Date.now() + IST_OFFSET_MS));

/* ------------------------------------------------------------------ */
/* Coupons                                                             */
/* ------------------------------------------------------------------ */
const resolveCoupon = async (couponCode, userId, amount, bookingType) => {
  if (!couponCode) return { coupon: null, discount: 0 };
  const coupon = await Coupon.findOne({ code: String(couponCode).trim().toUpperCase() });
  if (!coupon) throw httpError(400, "Invalid coupon code");
  const used = await CouponUsage.countDocuments({ coupon: coupon._id, user: userId });
  const result = coupon.calculateDiscount(amount, bookingType, used);
  if (!result.valid) throw httpError(400, result.message);
  return { coupon, discount: result.discount };
};

/* ------------------------------------------------------------------ */
/* Refund policy                                                       */
/* ------------------------------------------------------------------ */
const daysUntilStart = (booking) => {
  const start = booking.bookingType === "hotel" ? booking.checkIn : booking.travelDate;
  return (startOfDay(start) - todayIST()) / MS_PER_DAY;
};

/** Pure: which cancellation tier applies for a given number of days before the trip. */
const refundPercentFor = (daysBefore) => (CANCELLATION_TIERS.find((t) => daysBefore >= t.minDaysBefore) || { refundPercent: 0 }).refundPercent;

/** What would the customer get back if they cancelled right now? (shown in the UI before confirming) */
const previewRefund = (booking) => {
  if (booking.paymentStatus !== "paid") return { refundPercent: 0, refundAmount: 0, paid: false };
  const days = daysUntilStart(booking);
  const refundPercent = refundPercentFor(days);
  return { refundPercent, refundAmount: Math.round((booking.pricing.totalAmount * refundPercent) / 100), paid: true, daysBeforeStart: Math.floor(days) };
};

/* ------------------------------------------------------------------ */
/* Hotel request flow helpers                                          */
/* ------------------------------------------------------------------ */
// Statuses of a hotel booking that is still "in progress" before it is paid.
const OPEN_REQUEST_STATUSES = ["pending_confirmation", "awaiting_approval", "pending"];
const REQUEST_STAGES = ["pending_confirmation", "awaiting_approval"];

const withHotelInfo = (query) => query.populate("hotel", "name location").populate("room", "roomType");

/** Active admins: who gets the in-app + email alert for new requests. */
const adminRecipients = async () => User.find({ role: "admin", isActive: true }).select("email").lean();

const notifyAdmins = async (payload) => {
  const admins = await adminRecipients();
  await Promise.all(admins.map((a) => notify(a._id, payload)));
};

/** Customer + admin alerts for a brand-new hotel request. Never throws. */
const announceHotelRequest = async (bookingId, user) => {
  try {
    const full = await withHotelInfo(Booking.findById(bookingId));
    const hotelName = full.hotel?.name || "the hotel";
    await notify(user._id, {
      type: "booking_request",
      title: "Booking request received",
      message: `Your request ${full.bookingReference} for ${hotelName} is pending confirmation. No payment is needed yet.`,
      link: `/bookings/${full._id}`,
      booking: full._id,
    });
    queueEmail({ to: user.email, subject: `Booking request received - ${full.bookingReference}`, html: emailTemplates.hotelRequestReceived(user.name, full) });

    await notifyAdmins({ type: "booking_request", title: "New hotel request", message: `${user.name} requested ${hotelName} (${full.bookingReference}). Contact the hotel and send the final price.`, link: "/admin/bookings", booking: full._id });
    const admins = await adminRecipients();
    const to = env.ADMIN_NOTIFY_EMAIL ? [env.ADMIN_NOTIFY_EMAIL] : admins.map((a) => a.email);
    if (to.length) queueEmail({ to: to.join(","), subject: `New hotel request ${full.bookingReference}`, html: emailTemplates.adminNewHotelRequest(full, user) });
  } catch (e) {
    logger.error(`announceHotelRequest failed: ${e.message}`);
  }
};

/* ------------------------------------------------------------------ */
/* Create                                                              */
/* ------------------------------------------------------------------ */
const guestsOf = (g = {}) => ({ adults: Number(g.adults) || 1, children: Number(g.children) || 0 });

const sameCoupon = (a, b) => String(a || "") === String(b || "");

/**
 * Creates a PENDING booking after validating everything server-side:
 * item exists + active, dates, capacity/guests, live availability, coupon, price.
 * Duplicate protection: (1) Idempotency-Key header, (2) an identical open booking is returned instead of creating a second one.
 */
const createBooking = async (user, input, idempotencyKey) => {
  // (1) Idempotency-Key replay
  if (idempotencyKey) {
    const prior = await Booking.findOne({ user: user._id, idempotencyKey });
    if (prior) return { booking: prior, existing: true };
  }

  const { bookingType } = input;
  const guests = guestsOf(input.guests);
  const totalGuests = guests.adults + guests.children;
  if (totalGuests > LIMITS.maxGuestsPerBooking) throw httpError(400, `A booking can have at most ${LIMITS.maxGuestsPerBooking} guests`);

  const today = todayIST();
  // Hotels are a REQUEST: nothing is charged until the admin confirms with the hotel and the customer approves the final price.
  const isRequest = bookingType === "hotel";
  const data = {
    user: user._id,
    bookingType,
    guests,
    specialRequests: input.specialRequests,
    bookingStatus: isRequest ? "pending_confirmation" : "pending",
    statusHistory: [{ status: isRequest ? "pending_confirmation" : "pending", note: isRequest ? "Booking request submitted" : "Booking created", by: user._id }],
  };
  let basePrice;
  let room;
  let pkg;
  let dupFilter;

  if (bookingType === "hotel") {
    room = await Room.findById(input.roomId);
    if (!room || !room.isAvailable) throw httpError(404, "Room not found or unavailable");
    const hotel = await Hotel.findById(room.hotel);
    if (!hotel || !hotel.isActive) throw httpError(404, "Hotel not found or unavailable");
    if (input.hotelId && String(hotel._id) !== String(input.hotelId)) throw httpError(400, "Room does not belong to this hotel");

    const checkIn = startOfDay(input.checkIn);
    const checkOut = startOfDay(input.checkOut);
    if (checkIn < today) throw httpError(400, "Check-in date cannot be in the past");
    if (checkOut <= checkIn) throw httpError(400, "Check-out must be after check-in");
    const nights = nightsBetween(checkIn, checkOut);
    if (nights > LIMITS.maxNights) throw httpError(400, `Maximum stay is ${LIMITS.maxNights} nights`);
    if (checkIn - today > LIMITS.maxAdvanceBookingDays * MS_PER_DAY) throw httpError(400, "Check-in date is too far in the future");

    const numberOfRooms = Number(input.numberOfRooms) || 1;
    if (numberOfRooms > LIMITS.maxRoomsPerBooking) throw httpError(400, `You can book at most ${LIMITS.maxRoomsPerBooking} rooms at once`);
    if (totalGuests > room.capacity * numberOfRooms) throw httpError(400, `This room type sleeps ${room.capacity} guest(s) per room - add more rooms or choose a bigger room`);

    const free = await availability.roomsAvailable(room, checkIn, checkOut);
    if (free < numberOfRooms) throw httpError(409, free === 0 ? "No rooms available for these dates" : `Only ${free} room(s) available for these dates`);

    basePrice = room.price * nights * numberOfRooms;
    Object.assign(data, { hotel: hotel._id, room: room._id, checkIn, checkOut, endDate: checkOut, numberOfRooms });
    dupFilter = { bookingType, room: room._id, checkIn, checkOut };
  } else {
    pkg = await Package.findById(input.packageId);
    if (!pkg || !pkg.isActive) throw httpError(404, "Package not found or unavailable");

    const travelDate = startOfDay(input.travelDate);
    if (travelDate < today) throw httpError(400, "Travel date cannot be in the past");
    if (travelDate - today > LIMITS.maxAdvanceBookingDays * MS_PER_DAY) throw httpError(400, "Travel date is too far in the future");
    if (pkg.startDates?.length) {
      const isDeparture = pkg.startDates.some((d) => startOfDay(d).getTime() === travelDate.getTime());
      if (!isDeparture) throw httpError(400, "This package has no departure on the selected date");
    }
    if (totalGuests > pkg.maxGroupSize) throw httpError(400, `Maximum group size for this package is ${pkg.maxGroupSize}`);

    const left = await availability.packageSeatsLeft(pkg, travelDate);
    if (left < totalGuests) throw httpError(409, left === 0 ? "This departure is sold out" : `Only ${left} seat(s) left on this departure`);

    basePrice = pkg.price * totalGuests;
    Object.assign(data, { package: pkg._id, travelDate, endDate: new Date(travelDate.getTime() + (pkg.duration.days - 1) * MS_PER_DAY) });
    dupFilter = { bookingType, package: pkg._id, travelDate };
  }

  // Already holding a paid booking for this exact item + dates? Say so before anything else (clearer than a coupon error).
  const confirmedDup = await Booking.findOne({ user: user._id, bookingStatus: "confirmed", ...dupFilter }).select("_id");
  if (confirmedDup) throw httpError(409, "You already have a confirmed booking for these dates.", { bookingId: confirmedDup._id });

  // Hotel requests have no coupon yet (the price is not final) - the customer can apply one at checkout after approving.
  const { coupon, discount } = isRequest ? { coupon: null, discount: 0 } : await resolveCoupon(input.couponCode, user._id, basePrice, bookingType);

  // (2) Same user, same item, same dates, still open & unexpired -> don't create a second booking
  const open = await Booking.findOne({ user: user._id, bookingStatus: isRequest ? { $in: OPEN_REQUEST_STATUSES } : "pending", expiresAt: { $gt: new Date() }, ...dupFilter });
  if (open) {
    const identical =
      open.guests.adults === guests.adults &&
      open.guests.children === guests.children &&
      (open.numberOfRooms || 1) === (data.numberOfRooms || 1) &&
      sameCoupon(open.coupon, coupon?._id);
    if (identical) return { booking: open, existing: true };
    throw httpError(409, isRequest ? "You already have an open request for these dates. Open it or cancel it first." : "You already have an unpaid booking for these dates. Complete or cancel it first.", { bookingId: open._id });
  }

  data.coupon = coupon?._id;
  data.couponCode = coupon?.code;
  data.pricing = calculatePricing({ basePrice, discount });
  data.idempotencyKey = idempotencyKey || undefined;

  if (isRequest) {
    // The system price is only an ESTIMATE. The request holds no rooms; the admin answers within requestExpiryHours.
    data.estimatedBasePrice = basePrice;
    data.expiresAt = new Date(Date.now() + HOTEL_REQUEST.requestExpiryHours * 3_600_000);
    const request = await Booking.create(data);
    await announceHotelRequest(request._id, user);
    return { booking: request, existing: false };
  }

  data.expiresAt = new Date(Date.now() + env.BOOKING_HOLD_MINUTES * 60_000);
  const booking = await Booking.create(data);

  // Race-condition guard: two simultaneous requests can both pass the checks above.
  try {
    await availability.assertNotOversold(booking, { room, pkg });
  } catch (err) {
    booking.paymentStatus = "failed";
    booking.setStatus("failed", { note: "Inventory conflict" });
    booking.idempotencyKey = undefined;
    booking.expiresAt = undefined;
    await booking.save();
    throw err;
  }

  return { booking, existing: false };
};

/** Re-price a pending booking with a different coupon (or none). Invalidates any open gateway order. */
const applyCouponToBooking = async (bookingId, user, couponCode) => {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw httpError(404, "Booking not found");
  if (String(booking.user) !== String(user._id)) throw httpError(403, "Not authorized for this booking");
  if (booking.bookingStatus !== "pending" || booking.paymentStatus === "paid") throw httpError(400, "Coupon can only be changed on an unpaid, pending booking");
  if (booking.expiresAt && booking.expiresAt < new Date()) throw httpError(409, "This booking has expired");

  const { coupon, discount } = await resolveCoupon(couponCode, user._id, booking.pricing.basePrice, booking.bookingType);
  booking.coupon = coupon?._id;
  booking.couponCode = coupon?.code;
  booking.pricing = calculatePricing({ basePrice: booking.pricing.basePrice, discount });

  // Any previously created gateway order has the old amount -> retire it so a fresh one is created at payment time.
  await Payment.updateMany({ booking: booking._id, status: "created", amount: { $ne: booking.pricing.totalAmount } }, { $set: { status: "failed", failureReason: "Superseded by price change" } });
  booking.payment = undefined;
  booking.paymentStatus = "pending";
  await booking.save();
  return booking;
};

/* ------------------------------------------------------------------ */
/* Cancel                                                              */
/* ------------------------------------------------------------------ */
/**
 * Cancels a booking. Owner or admin. Confirmed+paid bookings are refunded according to the policy tiers
 * (admins may override with refundPercent). Returns { booking, refund }.
 */
const cancelBooking = async (bookingId, actor, { reason, refundPercent: override } = {}) => {
  const booking = await Booking.findById(bookingId).populate("user", "name email");
  if (!booking) throw httpError(404, "Booking not found");

  const isAdmin = actor.role === "admin";
  if (String(booking.user._id) !== String(actor._id) && !isAdmin) throw httpError(403, "Not authorized to cancel this booking");
  if (![...OPEN_REQUEST_STATUSES, "confirmed"].includes(booking.bookingStatus)) throw httpError(400, `A ${booking.bookingStatus} booking cannot be cancelled`);
  const wasRequestStage = booking.bookingType === "hotel" && REQUEST_STAGES.includes(booking.bookingStatus);

  let refund = { amount: 0, percent: 0 };
  const wasPaid = booking.paymentStatus === "paid";

  if (wasPaid) {
    const preview = previewRefund(booking);
    const percent = isAdmin && override !== undefined ? Math.min(100, Math.max(0, Number(override))) : preview.refundPercent;
    const amount = Math.round((booking.pricing.totalAmount * percent) / 100);
    refund = { amount, percent };

    if (amount > 0) {
      const payment = await Payment.findById(booking.payment);
      if (!payment) throw httpError(500, "Payment record missing - contact support");
      await paymentService.refundPayment(payment, amount, reason || "Booking cancelled", actor._id);
      booking.paymentStatus = amount >= booking.pricing.totalAmount ? "refunded" : "partially_refunded";
    }
  }

  booking.cancellation = { cancelledAt: new Date(), cancelledBy: actor._id, reason, refundPercent: refund.percent, refundAmount: refund.amount };
  booking.expiresAt = undefined;
  booking.setStatus(refund.amount > 0 ? "refunded" : "cancelled", { by: actor._id, note: reason || "Cancelled" });
  await booking.save();

  // A fully refunded booking releases its coupon redemption so the customer can use it again.
  if (booking.coupon && refund.percent === 100) {
    const removed = await CouponUsage.findOneAndDelete({ booking: booking._id });
    if (removed) await Coupon.updateOne({ _id: booking.coupon }, { $inc: { usedCount: -1 } });
  }

  // Any unpaid gateway order is dead now.
  await Payment.updateMany({ booking: booking._id, status: { $in: ["created", "failed"] } }, { $set: { status: "failed", failureReason: "Booking cancelled" } });

  await notify(booking.user._id, {
    type: refund.amount > 0 ? "refund_processed" : "booking_cancelled",
    title: "Booking cancelled",
    message: refund.amount > 0 ? `Booking ${booking.bookingReference} cancelled. Rs. ${refund.amount} will be refunded in 5-7 business days.` : `Booking ${booking.bookingReference} was cancelled.`,
    link: `/bookings/${booking._id}`,
    booking: booking._id,
  });
  // Customer withdrew a request / turned down the price -> tell the admin so they can inform the hotel.
  if (wasRequestStage && !isAdmin) {
    await notifyAdmins({ type: "booking_cancelled", title: "Hotel request withdrawn", message: `${booking.user.name} cancelled ${booking.bookingReference}${reason ? `: ${reason}` : "."}`, link: "/admin/bookings", booking: booking._id });
  }
  if (wasPaid) {
    const full = await Booking.findById(booking._id).populate("hotel", "name").populate("package", "name");
    queueEmail({ to: booking.user.email, subject: `Booking Cancelled - ${booking.bookingReference}`, html: emailTemplates.bookingCancelled(booking.user.name, full, refund) });
  }

  return { booking, refund };
};

/* ------------------------------------------------------------------ */
/* Hotel request flow (admin + customer steps)                         */
/* ------------------------------------------------------------------ */
const loadOpenRequest = async (bookingId) => {
  const booking = await withHotelInfo(Booking.findById(bookingId).populate("user", "name email"));
  if (!booking) throw httpError(404, "Booking not found");
  if (booking.bookingType !== "hotel") throw httpError(400, "Only hotel bookings use the request flow");
  if (!REQUEST_STAGES.includes(booking.bookingStatus)) throw httpError(400, `This booking is ${booking.bookingStatus}; it is no longer waiting for hotel confirmation`);
  return booking;
};

/**
 * ADMIN: the hotel owner confirmed availability + price. Saves the final price, reserves the rooms for the
 * customer until `validUntil`, and asks the customer to approve it. Can be called again to change the price
 * while the customer has not approved yet.
 */
const sendQuote = async (bookingId, admin, { finalPrice, validHours, note } = {}) => {
  const booking = await loadOpenRequest(bookingId);

  // The platform's own bookings are still authoritative: don't promise rooms someone else already holds.
  const free = await availability.roomsAvailable(booking.room, booking.checkIn, booking.checkOut, { excludeId: booking._id });
  if (free < booking.numberOfRooms) throw httpError(409, "These rooms are already held by another booking on this platform. Decline the request or free those rooms first.");

  const hours = Math.min(Number(validHours) || HOTEL_REQUEST.defaultQuoteValidityHours, HOTEL_REQUEST.maxQuoteValidityHours);
  const validUntil = new Date(Date.now() + hours * 3_600_000);

  booking.pricing = calculatePricing({ basePrice: finalPrice, discount: 0 });
  booking.coupon = undefined;
  booking.couponCode = undefined;
  booking.quote = { amount: Math.round(finalPrice), note, sentAt: new Date(), sentBy: admin._id, validUntil };
  booking.expiresAt = validUntil;
  booking.setStatus("awaiting_approval", { by: admin._id, note: `Final price sent: Rs. ${booking.pricing.totalAmount} (incl. tax)` });
  await booking.save();

  await notify(booking.user._id, {
    type: "booking_quote",
    title: "Your final price is ready",
    message: `${booking.hotel?.name || "Your hotel"}: Rs. ${booking.pricing.totalAmount}. Review and approve it to continue to payment.`,
    link: `/bookings/${booking._id}`,
    booking: booking._id,
  });
  queueEmail({ to: booking.user.email, subject: `Final price for your booking - ${booking.bookingReference}`, html: emailTemplates.hotelQuoteSent(booking.user.name, booking) });
  return booking;
};

/** ADMIN: the hotel cannot host this stay. */
const declineRequest = async (bookingId, admin, { reason } = {}) => {
  const booking = await loadOpenRequest(bookingId);
  booking.declineReason = reason;
  booking.expiresAt = undefined;
  booking.setStatus("declined", { by: admin._id, note: reason });
  await booking.save();

  await notify(booking.user._id, {
    type: "booking_declined",
    title: "Booking request not confirmed",
    message: `Sorry, ${booking.hotel?.name || "the hotel"} could not confirm request ${booking.bookingReference}. You have not been charged.`,
    link: `/bookings/${booking._id}`,
    booking: booking._id,
  });
  queueEmail({ to: booking.user.email, subject: `Booking request update - ${booking.bookingReference}`, html: emailTemplates.hotelRequestDeclined(booking.user.name, booking, reason) });
  return booking;
};

/** ADMIN: private log of calls with the hotel owner. Returns the full list. */
const addAdminNote = async (bookingId, admin, note) => {
  const res = await Booking.updateOne({ _id: bookingId, bookingType: "hotel" }, { $push: { adminNotes: { note, by: admin._id, at: new Date() } } });
  if (!res.matchedCount) throw httpError(404, "Hotel booking not found");
  const fresh = await Booking.findById(bookingId).select("+adminNotes").populate("adminNotes.by", "name").lean();
  return fresh.adminNotes;
};

/**
 * CUSTOMER: accepts the final price. The booking becomes a normal "pending" (awaiting payment) booking with the usual
 * payment hold, so checkout/payment/webhooks work exactly as before. Atomic, so a double click can't approve twice.
 */
const approveQuote = async (bookingId, user) => {
  const now = new Date();
  const booking = await Booking.findOneAndUpdate(
    { _id: bookingId, user: user._id, bookingType: "hotel", bookingStatus: "awaiting_approval", expiresAt: { $gt: now } },
    {
      $set: { bookingStatus: "pending", paymentStatus: "pending", approvedAt: now, expiresAt: new Date(now.getTime() + env.BOOKING_HOLD_MINUTES * 60_000) },
      $push: { statusHistory: { status: "pending", at: now, by: user._id, note: "Customer approved the final price" } },
    },
    { new: true }
  );

  if (booking) {
    await notifyAdmins({ type: "general", title: "Price approved", message: `${user.name} approved the price for ${booking.bookingReference}. Waiting for payment.`, link: "/admin/bookings", booking: booking._id });
    return booking;
  }

  const existing = await Booking.findById(bookingId);
  if (!existing || String(existing.user) !== String(user._id)) throw httpError(404, "Booking not found");
  if (existing.bookingStatus === "pending" && existing.approvedAt) return existing; // double click
  if (existing.bookingStatus === "awaiting_approval") throw httpError(409, "This price offer has expired. Please contact support or send a new request.");
  throw httpError(400, `This booking is ${existing.bookingStatus.replace("_", " ")} - there is no price waiting for your approval`);
};

/* ------------------------------------------------------------------ */
/* Scheduled maintenance                                               */
/* ------------------------------------------------------------------ */
const EXPIRY_NOTES = {
  pending: "Payment window elapsed",
  pending_confirmation: "No confirmation from the hotel in time - request closed",
  awaiting_approval: "Customer did not approve the final price in time",
};

/** Releases unpaid holds and closes hotel requests / price offers nobody answered in time. */
const expireStaleBookings = async () => {
  const stale = await Booking.find({ bookingStatus: { $in: OPEN_REQUEST_STATUSES }, expiresAt: { $lt: new Date() } })
    .limit(200)
    .populate("user", "name email")
    .populate("hotel", "name location");
  let expired = 0;
  // Before giving up on an unpaid booking, make sure the customer didn't pay and we just missed the callback/webhook.
  if (stale.some((b) => b.bookingStatus === "pending")) await paymentService.reconcileOpenPayments().catch((e) => logger.error(`reconcile before expiry failed: ${e.message}`));
  for (const b of stale) {
    const stage = b.bookingStatus;
    const res = await Booking.updateOne(
      { _id: b._id, bookingStatus: stage, expiresAt: { $lt: new Date() } },
      { $set: { bookingStatus: "expired" }, $unset: { expiresAt: "" }, $push: { statusHistory: { status: "expired", at: new Date(), note: EXPIRY_NOTES[stage] } } }
    );
    if (!res.modifiedCount) continue;
    expired++;
    await Payment.updateMany({ booking: b._id, status: { $in: ["created", "failed"] } }, { $set: { status: "failed", failureReason: "Booking expired" } });

    if (stage === "pending") {
      await notify(b.user._id, { type: "booking_expired", title: "Booking expired", message: `Booking ${b.bookingReference} wasn't paid in time and was released.`, link: "/bookings", booking: b._id });
      queueEmail({ to: b.user.email, subject: `Booking expired - ${b.bookingReference}`, html: emailTemplates.bookingExpired(b.user.name, b) });
    } else {
      await notify(b.user._id, {
        type: "booking_expired",
        title: stage === "awaiting_approval" ? "Price offer expired" : "Booking request closed",
        message: stage === "awaiting_approval" ? `The final price for ${b.bookingReference} was not approved in time.` : `We could not confirm ${b.bookingReference} in time, so it was closed. You were not charged.`,
        link: `/bookings/${b._id}`,
        booking: b._id,
      });
      queueEmail({ to: b.user.email, subject: `Booking request closed - ${b.bookingReference}`, html: emailTemplates.hotelRequestExpired(b.user.name, b, stage) });
    }
  }
  if (expired) logger.info(`Expired ${expired} unpaid booking(s)`);
  return expired;
};

/** Confirmed bookings whose trip has ended become "completed" (this is what unlocks reviews). */
const completeFinishedBookings = async () => {
  const due = await Booking.find({ bookingStatus: "confirmed", endDate: { $lt: todayIST() } }).limit(500);
  for (const b of due) {
    b.setStatus("completed", { note: "Trip finished" });
    await b.save();
    await notify(b.user, { type: "review_prompt", title: "How was your trip?", message: `Share your experience for booking ${b.bookingReference}.`, link: `/bookings/${b._id}`, booking: b._id });
  }
  if (due.length) logger.info(`Completed ${due.length} booking(s)`);
  return due.length;
};

/** Reminder for trips starting within the next 48h (sent once per booking). */
const sendTripReminders = async () => {
  const from = todayIST();
  const to = new Date(from.getTime() + 2 * MS_PER_DAY);
  const due = await Booking.find({
    bookingStatus: "confirmed",
    reminderSent: false,
    $or: [{ travelDate: { $gte: from, $lte: to } }, { checkIn: { $gte: from, $lte: to } }],
  })
    .limit(500)
    .populate("user", "name email")
    .populate("hotel", "name")
    .populate("package", "name");

  for (const b of due) {
    const claimed = await Booking.updateOne({ _id: b._id, reminderSent: false }, { $set: { reminderSent: true } });
    if (!claimed.modifiedCount) continue;
    await notify(b.user._id, { type: "trip_reminder", title: "Your trip is coming up", message: `Booking ${b.bookingReference} starts soon. Pack your bags!`, link: `/bookings/${b._id}`, booking: b._id });
    queueEmail({ to: b.user.email, subject: `Trip reminder - ${b.bookingReference}`, html: emailTemplates.tripReminder(b.user.name, b) });
  }
  return due.length;
};

module.exports = {
  createBooking,
  applyCouponToBooking,
  sendQuote,
  declineRequest,
  addAdminNote,
  approveQuote,
  cancelBooking,
  previewRefund,
  refundPercentFor,
  expireStaleBookings,
  completeFinishedBookings,
  sendTripReminders,
  todayIST,
};
