// Package "Discuss & Customize" flow:
//   enquiry -> chat / negotiation -> final quotation -> customer accepts (or asks for changes / counter-offers)
//   -> a normal package Booking is created from the accepted quotation -> existing checkout + payment flow
//   (full payment, or advance now + balance later) -> booking confirmed.
// A separate PackageEnquiry document keeps the negotiation out of the Booking model on purpose.
const mongoose = require("mongoose");
const PackageEnquiry = require("../models/packageEnquiry.model");
const Package = require("../models/package.model");
const Booking = require("../models/booking.model");
const Payment = require("../models/payment.model");
const User = require("../models/user.model");
const { env } = require("../config/env");
const { LIMITS, PACKAGE_ENQUIRY } = require("../config/policy");
const { httpError } = require("../utils/httpError");
const logger = require("../utils/logger");
const { calculatePricing, startOfDay, MS_PER_DAY } = require("../utils/pricing");
const { queueEmail, emailTemplates } = require("../utils/sendEmail");
const { notify } = require("./notification.service");

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const todayIST = () => startOfDay(new Date(Date.now() + IST_OFFSET_MS));
const inr = (n) => `Rs. ${Number(n || 0).toLocaleString("en-IN")}`;
const day = (d) => new Date(d).toISOString().slice(0, 10);

const OPEN = PackageEnquiry.OPEN_STATUSES;
const QUOTABLE = ["new", "in_discussion", "revision_requested", "counter_offered", "quotation_sent"];

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
const populateEnquiry = (q) =>
  q
    .populate({ path: "package", select: "name slug duration price gallery destination maxGroupSize itinerary included excluded", populate: { path: "destination", select: "name city state" } })
    .populate("user", "name email phone")
    .populate("booking", "bookingReference bookingStatus paymentStatus pricing paymentPlan amountPaid expiresAt");

/** The advance option only makes sense when the trip is far enough away for a balance deadline. */
const advanceFeasible = (startDate) => startOfDay(startDate).getTime() - Date.now() > (PACKAGE_ENQUIRY.balanceDueDaysBeforeTrip + 2) * MS_PER_DAY;

/** Plain object for the API: adds the flags the UI needs (no extra queries). */
const present = (e) => {
  const o = typeof e.toObject === "function" ? e.toObject() : { ...e };
  o.quotationExpired = Boolean(o.status === "quotation_sent" && o.quotation?.validUntil && new Date(o.quotation.validUntil) < new Date());
  o.advanceAvailable = Boolean(o.quotation?.advanceAllowed && o.request?.startDate && advanceFeasible(o.request.startDate));
  return o;
};

const idOf = (v) => String(v?._id || v);

const load = async (id, actor, { withNotes = false } = {}) => {
  if (!mongoose.isValidObjectId(id)) throw httpError(404, "Enquiry not found");
  let q = PackageEnquiry.findById(id);
  if (withNotes) q = q.select("+adminNotes");
  const e = await populateEnquiry(q);
  if (!e) throw httpError(404, "Enquiry not found");
  if (actor.role !== "admin" && idOf(e.user) !== idOf(actor._id)) throw httpError(404, "Enquiry not found"); // never reveal other people's enquiries
  return e;
};

const adminRecipients = async () => User.find({ role: "admin", isActive: true }).select("email").lean();

const notifyAdmins = async (payload) => {
  const admins = await adminRecipients();
  await Promise.all(admins.map((a) => notify(a._id, payload)));
};

const emailAdmins = async (subject, html) => {
  const admins = await adminRecipients();
  const to = env.ADMIN_NOTIFY_EMAIL ? [env.ADMIN_NOTIFY_EMAIL] : admins.map((a) => a.email);
  if (to.length) queueEmail({ to: to.join(","), subject, html });
};

const mailView = (e) => (typeof e.toObject === "function" ? e.toObject() : e);
const preview = (text, max = 160) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** Tell the customer (in-app + optional email). Never throws. */
const tellCustomer = async (e, { title, message, heading, intro, email = true, buttonLabel }) => {
  try {
    await notify(idOf(e.user), { type: "enquiry_update", title, message: preview(message, 480), link: `/enquiries/${e._id}` });
    if (email && e.user?.email) queueEmail({ to: e.user.email, subject: `${title} - ${e.enquiryNumber}`, html: emailTemplates.enquiryCustomerUpdate({ name: e.user.name, heading: heading || title, intro: intro || message, e: mailView(e), buttonLabel }) });
  } catch (err) {
    logger.error(`tellCustomer failed: ${err.message}`);
  }
};

/** Tell every admin (in-app + optional email). Never throws. */
const tellAdmins = async (e, { title, message, email = false }) => {
  try {
    await notifyAdmins({ type: "enquiry_update", title, message: preview(`${e.user?.name || "A customer"}: ${message}`, 480), link: `/admin/enquiries/${e._id}` });
    if (email) await emailAdmins(`${title} - ${e.enquiryNumber}`, emailTemplates.enquiryAdminAlert({ heading: title, intro: message, e: mailView(e), customer: e.user }));
  } catch (err) {
    logger.error(`tellAdmins failed: ${err.message}`);
  }
};

/* ------------------------------------------------------------------ */
/* Customer: create + read                                             */
/* ------------------------------------------------------------------ */
const createEnquiry = async (user, input) => {
  const pkg = await Package.findById(input.packageId);
  if (!pkg || !pkg.isActive) throw httpError(404, "Package not found or unavailable");

  const today = todayIST();
  const startDate = startOfDay(input.startDate);
  if (startDate < today) throw httpError(400, "Travel date cannot be in the past");
  if (startDate - today > LIMITS.maxAdvanceBookingDays * MS_PER_DAY) throw httpError(400, "Travel date is too far in the future");

  const adults = Number(input.adults) || 1;
  const children = Number(input.children) || 0;
  if (adults + children > LIMITS.maxGuestsPerBooking) throw httpError(400, `At most ${LIMITS.maxGuestsPerBooking} travellers per enquiry`);

  const open = await PackageEnquiry.findOne({ user: user._id, package: pkg._id, status: { $in: OPEN } }).select("_id enquiryNumber");
  if (open) throw httpError(409, "You already have an open enquiry for this package. Please continue that one.", { enquiryId: open._id });

  const enquiry = await PackageEnquiry.create({
    user: user._id,
    package: pkg._id,
    request: {
      startDate,
      adults,
      children,
      days: input.days || pkg.duration.days,
      rooms: input.rooms || 1,
      budget: input.budgetAmount ? { amount: input.budgetAmount, basis: input.budgetBasis || "per_person" } : undefined,
      requirements: input.requirements,
      contactMethod: input.contactMethod || "email",
      phone: input.phone || user.phone,
    },
    statusHistory: [{ status: "new", by: user._id, note: "Enquiry submitted" }],
    lastMessageBy: "customer",
  });

  try {
    const full = await populateEnquiry(PackageEnquiry.findById(enquiry._id));
    await tellCustomer(full, {
      title: "Enquiry received",
      message: `We received your enquiry for ${pkg.name}. Our team will contact you soon to discuss your requirements. No payment is needed yet.`,
      buttonLabel: "View enquiry",
    });
    await tellAdmins(full, { title: "New package enquiry", message: `wants to discuss "${pkg.name}" (${adults + children} traveller(s), from ${day(startDate)}).`, email: true });
  } catch (err) {
    logger.error(`createEnquiry notifications failed: ${err.message}`);
  }
  return enquiry;
};

const listMine = async (user) => PackageEnquiry.find({ user: user._id }).select("-messages -quotationHistory").populate("package", "name slug duration gallery").sort({ lastActivityAt: -1 }).limit(100).lean();

const getForUser = async (user, id) => present(await load(id, user));

/* ------------------------------------------------------------------ */
/* Conversation                                                        */
/* ------------------------------------------------------------------ */
const addMessage = async (actor, id, text) => {
  const isAdmin = actor.role === "admin";
  const e = await load(id, actor);
  if (["rejected", "cancelled"].includes(e.status)) throw httpError(400, "This enquiry is closed. Please start a new enquiry.");

  e.addMessage({ sender: isAdmin ? "admin" : "customer", user: actor._id, text });
  if (isAdmin && e.status === "new") e.setStatus("in_discussion", { by: actor._id, note: "Admin replied" });
  await e.save();

  if (isAdmin) await tellCustomer(e, { title: "New reply on your enquiry", message: text, intro: text, buttonLabel: "Reply" });
  else await tellAdmins(e, { title: "New customer message", message: text });
  return present(e);
};

/* ------------------------------------------------------------------ */
/* Admin: quotation                                                    */
/* ------------------------------------------------------------------ */
/** Builds + stores a new quotation version on the enquiry (does not save). */
const applyQuotation = (e, admin, f) => {
  const travellers = (e.request.adults || 1) + (e.request.children || 0);
  const amount = Math.round(f.amount);
  const pricing = calculatePricing({ basePrice: amount });

  const validDays = Math.min(Number(f.validDays) || PACKAGE_ENQUIRY.defaultQuoteValidityDays, PACKAGE_ENQUIRY.maxQuoteValidityDays);
  const now = new Date();

  let advancePercent;
  if (f.advanceAllowed) {
    if (!advanceFeasible(e.request.startDate)) throw httpError(400, `The trip starts too soon for an advance plan (the balance must be due ${PACKAGE_ENQUIRY.balanceDueDaysBeforeTrip} days before the trip). Ask for full payment instead.`);
    advancePercent = Math.min(Math.max(Math.round(f.advancePercent || 0), PACKAGE_ENQUIRY.minAdvancePercent), PACKAGE_ENQUIRY.maxAdvancePercent);
  }

  if (e.quotation?.amount) e.quotationHistory.push(e.quotation);
  const days = f.days || e.request.days;
  e.quotation = {
    version: (e.quotation?.version || 0) + 1,
    amount,
    tax: pricing.tax,
    totalAmount: pricing.totalAmount,
    perPerson: Math.round(amount / travellers),
    travellers,
    days,
    nights: f.nights ?? Math.max(0, (days || 1) - 1),
    itinerary: f.itinerary || [],
    hotels: f.hotels || [],
    activities: f.activities || [],
    transport: f.transport,
    inclusions: f.inclusions || [],
    exclusions: f.exclusions || [],
    note: f.note,
    advanceAllowed: Boolean(f.advanceAllowed),
    advancePercent,
    validUntil: new Date(now.getTime() + validDays * MS_PER_DAY),
    sentAt: now,
    sentBy: admin._id,
  };

  if (e.counterOffer?.status === "pending") {
    e.counterOffer.status = "superseded";
    e.counterOffer.respondedAt = now;
  }
  e.paymentOption = undefined;
  e.addMessage({
    sender: "admin",
    kind: "quotation",
    user: admin._id,
    text: `Quotation v${e.quotation.version} sent: ${inr(amount)} + GST = ${inr(pricing.totalAmount)} for ${travellers} traveller(s). Valid until ${day(e.quotation.validUntil)}.`,
  });
  e.setStatus("quotation_sent", { by: admin._id, note: `Quotation v${e.quotation.version}: ${inr(pricing.totalAmount)} incl. GST` });
};

const quotationSentNotice = (e) =>
  tellCustomer(e, {
    title: "Your quotation is ready",
    message: `Your personalised quotation is ready: ${inr(e.quotation.totalAmount)} incl. GST. Review it and accept, ask for changes, or make a counter-offer. Valid until ${day(e.quotation.validUntil)}.`,
    heading: "Your personalised quotation is ready",
    buttonLabel: "Review quotation",
  });

const sendQuotation = async (admin, id, input) => {
  const e = await load(id, admin);
  if (!QUOTABLE.includes(e.status)) throw httpError(400, `A quotation cannot be sent while the enquiry is ${e.status.replace("_", " ")}`);
  applyQuotation(e, admin, input);
  await e.save();
  await quotationSentNotice(e);
  return present(e);
};

/** Admin answers the customer's price proposal. accept = new quotation at the proposed price; reject = back to discussion. */
const decideCounterOffer = async (admin, id, { decision, note, validDays }) => {
  const e = await load(id, admin);
  if (e.status !== "counter_offered" || e.counterOffer?.status !== "pending") throw httpError(400, "There is no counter-offer waiting for your answer");
  const proposed = e.counterOffer.amount;
  const now = new Date();

  if (decision === "accept") {
    const q = e.quotation.toObject();
    applyQuotation(e, admin, { ...q, amount: proposed, validDays, note: note || q.note });
    e.counterOffer.status = "accepted"; // (applyQuotation marks it superseded first - the real outcome wins)
    e.counterOffer.respondedAt = now;
    e.addMessage({ sender: "admin", kind: "counter_response", user: admin._id, text: `Your counter-offer of ${inr(proposed)} was accepted.${note ? ` ${note}` : ""}` });
    await e.save();
    await quotationSentNotice(e);
  } else {
    e.counterOffer.status = "rejected";
    e.counterOffer.respondedAt = now;
    e.addMessage({ sender: "admin", kind: "counter_response", user: admin._id, text: `We could not accept the counter-offer of ${inr(proposed)}.${note ? ` ${note}` : ""}${e.quotation.validUntil > now ? " The earlier quotation is still available." : ""}` });
    e.setStatus("quotation_sent", { by: admin._id, note: "Counter-offer declined" });
    await e.save();
    await tellCustomer(e, { title: "Counter-offer update", message: `We could not accept ${inr(proposed)}.${note ? ` ${note}` : ""} Our quotation of ${inr(e.quotation.totalAmount)} (incl. GST) is still open until ${day(e.quotation.validUntil)}.` });
  }
  return present(e);
};

/* ------------------------------------------------------------------ */
/* Customer: respond to the quotation                                  */
/* ------------------------------------------------------------------ */
const requireStatus = (e, status, what) => {
  if (e.status !== status) throw httpError(409, `You can only ${what} while a quotation is waiting for your answer (this enquiry is ${e.status.replace("_", " ")}).`);
};

const requestRevision = async (user, id, note) => {
  const e = await load(id, user);
  requireStatus(e, "quotation_sent", "ask for changes");
  e.addMessage({ sender: "customer", kind: "revision_request", user: user._id, text: note });
  e.setStatus("revision_requested", { by: user._id, note: "Customer asked for changes" });
  await e.save();
  await tellAdmins(e, { title: "Quotation revision requested", message: note, email: true });
  return present(e);
};

const counterOffer = async (user, id, { amount, note }) => {
  const e = await load(id, user);
  requireStatus(e, "quotation_sent", "make a counter-offer");
  const proposed = Math.round(amount);
  if (!(proposed < e.quotation.amount)) throw httpError(400, `Your offer must be lower than the quoted price of ${inr(e.quotation.amount)}. To pay the quoted price just accept the quotation.`);

  e.counterOffer = { amount: proposed, note, at: new Date(), status: "pending" };
  e.addMessage({ sender: "customer", kind: "counter_offer", user: user._id, text: `Counter-offer: ${inr(proposed)} (before GST) instead of ${inr(e.quotation.amount)}.${note ? ` ${note}` : ""}` });
  e.setStatus("counter_offered", { by: user._id, note: `Counter-offer ${inr(proposed)}` });
  await e.save();
  await tellAdmins(e, { title: "Customer counter-offer", message: `offered ${inr(proposed)} (quoted ${inr(e.quotation.amount)}).${note ? ` "${note}"` : ""}`, email: true });
  return present(e);
};

/** Turns the accepted quotation into a normal package booking that waits for payment. */
const createBookingFromQuotation = async (e, user, option) => {
  const q = e.quotation;
  const start = startOfDay(e.request.startDate);
  if (start < todayIST()) throw httpError(409, "The travel date of this enquiry has passed. Please ask us for a revised quotation.");

  const days = q.days || e.request.days || e.package.duration.days;
  const total = q.totalAmount;
  const plan = { mode: "full" };
  if (option === "advance") {
    if (!q.advanceAllowed || !advanceFeasible(start)) throw httpError(400, "Advance payment is not available for this quotation. Please pay in full.");
    const advanceAmount = Math.round((total * q.advancePercent) / 100);
    Object.assign(plan, { mode: "advance", advancePercent: q.advancePercent, advanceAmount, balanceAmount: total - advanceAmount, balanceDueDate: new Date(start.getTime() - PACKAGE_ENQUIRY.balanceDueDaysBeforeTrip * MS_PER_DAY) });
  }

  const now = new Date();
  return Booking.create({
    user: user._id,
    bookingType: "package",
    package: idOf(e.package),
    travelDate: start,
    endDate: new Date(start.getTime() + (days - 1) * MS_PER_DAY),
    guests: { adults: e.request.adults, children: e.request.children || 0 },
    pricing: { basePrice: q.amount, discount: 0, tax: q.tax, totalAmount: total }, // exactly what was quoted
    enquiry: e._id,
    paymentPlan: plan,
    specialRequests: e.request.requirements?.slice(0, 500),
    approvedAt: now,
    expiresAt: new Date(now.getTime() + PACKAGE_ENQUIRY.paymentWindowHours * 3_600_000),
    bookingStatus: "pending",
    statusHistory: [{ status: "pending", at: now, by: user._id, note: `Customer accepted quotation v${q.version} (${e.enquiryNumber})` }],
  });
};

/**
 * Customer accepts the quotation. Atomic claim (double click safe), then a booking is created and the customer
 * continues at /checkout/:bookingId - the existing payment flow. If the payment window lapsed they can accept again.
 */
const acceptQuotation = async (user, id, { paymentOption = "full" } = {}) => {
  if (!mongoose.isValidObjectId(id)) throw httpError(404, "Enquiry not found");
  const now = new Date();

  const claimed = await PackageEnquiry.findOneAndUpdate(
    { _id: id, user: user._id, status: "quotation_sent", "quotation.validUntil": { $gt: now } },
    { $set: { status: "accepted", acceptedAt: now, paymentOption, lastActivityAt: now, lastMessageBy: "customer" }, $push: { statusHistory: { status: "accepted", at: now, by: user._id, note: `Customer accepted the quotation (${paymentOption === "advance" ? "advance payment" : "full payment"})` } } },
    { new: true }
  );

  if (!claimed) {
    const existing = await populateEnquiry(PackageEnquiry.findById(id));
    if (!existing || idOf(existing.user) !== idOf(user._id)) throw httpError(404, "Enquiry not found");
    if (existing.status === "accepted") {
      const b = existing.booking;
      // already accepted and still payable (double click, or the customer came back later)
      if (b && b.bookingStatus === "pending" && b.expiresAt > now) return { enquiry: present(existing), booking: b };
      if (!existing.quotation?.validUntil || existing.quotation.validUntil <= now) throw httpError(409, "This quotation has expired. Please ask us to send a new one.");
      // the payment window lapsed (booking expired/cancelled) -> a new booking for the same quotation
      const booking = await createBookingFromQuotation(existing, user, paymentOption);
      existing.booking = booking._id;
      existing.paymentOption = paymentOption;
      existing.lastActivityAt = now;
      await existing.save();
      return { enquiry: present(await populateEnquiry(PackageEnquiry.findById(id))), booking };
    }
    if (existing.status === "quotation_sent") throw httpError(409, "This quotation has expired. Please ask us to send a new one.");
    throw httpError(409, `There is no quotation waiting for your approval (this enquiry is ${existing.status.replace("_", " ")}).`);
  }

  const e = await populateEnquiry(PackageEnquiry.findById(id));
  let booking;
  try {
    booking = await createBookingFromQuotation(e, user, paymentOption);
  } catch (err) {
    // keep the quotation open so the customer can try again (e.g. picked advance by mistake)
    await PackageEnquiry.updateOne({ _id: id, status: "accepted" }, { $set: { status: "quotation_sent" }, $unset: { acceptedAt: "", paymentOption: "" }, $pop: { statusHistory: 1 } });
    throw err;
  }

  e.booking = booking._id;
  e.addMessage({ sender: "system", kind: "status", text: `Quotation v${e.quotation.version} accepted. Booking ${booking.bookingReference} created - waiting for ${paymentOption === "advance" ? "the advance payment" : "payment"}.` });
  await e.save();

  await tellAdmins(e, { title: "Quotation accepted", message: `accepted quotation v${e.quotation.version} (${inr(e.quotation.totalAmount)}). Booking ${booking.bookingReference} is waiting for payment.`, email: true });
  return { enquiry: present(await populateEnquiry(PackageEnquiry.findById(id))), booking };
};

/** Stops an unpaid booking that belongs to an enquiry (customer cancelled / admin closed it). */
const cancelUnpaidBooking = async (e, by, note) => {
  const bookingId = idOf(e.booking);
  if (!e.booking) return;
  const res = await Booking.updateOne(
    { _id: bookingId, bookingStatus: "pending", paymentStatus: { $ne: "paid" } },
    { $set: { bookingStatus: "cancelled" }, $unset: { expiresAt: "" }, $push: { statusHistory: { status: "cancelled", at: new Date(), by, note } } }
  );
  if (res.modifiedCount) await Payment.updateMany({ booking: bookingId, status: { $in: ["created", "failed"] } }, { $set: { status: "failed", failureReason: note } });
};

const cancelEnquiry = async (user, id, reason) => {
  const e = await load(id, user);
  if (e.status === "booked") throw httpError(400, "This enquiry is already booked. Please cancel the booking from your bookings page.");
  if (!OPEN.includes(e.status)) throw httpError(400, `This enquiry is already ${e.status}`);
  await cancelUnpaidBooking(e, user._id, "Customer cancelled the enquiry");
  e.setStatus("cancelled", { by: user._id, note: reason || "Cancelled by customer" });
  e.addMessage({ sender: "system", kind: "status", text: `Enquiry cancelled by the customer${reason ? `: ${reason}` : "."}` });
  await e.save();
  await tellAdmins(e, { title: "Enquiry cancelled", message: `cancelled ${e.enquiryNumber}${reason ? `: ${reason}` : "."}` });
  return present(e);
};

/* ------------------------------------------------------------------ */
/* Admin: status, notes, lists                                         */
/* ------------------------------------------------------------------ */
const setAdminStatus = async (admin, id, { status, note }) => {
  const e = await load(id, admin);
  if (e.status === "booked") throw httpError(400, "This enquiry is already booked");
  if (["rejected", "cancelled"].includes(e.status) && status === "rejected") throw httpError(400, `This enquiry is already ${e.status}`);

  if (status === "rejected") {
    if (e.status === "accepted") {
      const paid = e.booking && ["paid", "partially_paid"].includes(e.booking.paymentStatus);
      if (paid) throw httpError(400, "A payment was already received - cancel the booking instead");
      await cancelUnpaidBooking(e, admin._id, note || "Enquiry closed by admin");
    }
    e.setStatus("rejected", { by: admin._id, note });
    e.addMessage({ sender: "admin", kind: "status", user: admin._id, text: `We are unable to proceed with this enquiry.${note ? ` ${note}` : ""}` });
    await e.save();
    await tellCustomer(e, { title: "Enquiry update", message: `We are unable to proceed with your enquiry ${e.enquiryNumber}.${note ? ` ${note}` : ""} You have not been charged.`, buttonLabel: "View enquiry" });
  } else {
    // reopen / move back to "in discussion"
    if (!["rejected", "cancelled", "new", "revision_requested", "quotation_sent", "counter_offered"].includes(e.status)) throw httpError(400, `An enquiry that is ${e.status.replace("_", " ")} cannot be moved to discussion`);
    e.setStatus("in_discussion", { by: admin._id, note });
    await e.save();
  }
  return present(e);
};

const addNote = async (admin, id, note) => {
  const res = await PackageEnquiry.updateOne({ _id: id }, { $push: { adminNotes: { note, by: admin._id, at: new Date() } } });
  if (!res.matchedCount) throw httpError(404, "Enquiry not found");
  const fresh = await PackageEnquiry.findById(id).select("+adminNotes").populate("adminNotes.by", "name").lean();
  return fresh.adminNotes;
};

const getForAdmin = async (admin, id) => present(await load(id, admin, { withNotes: true }));

const adminList = async ({ status, search, page = 1, limit = 20 } = {}) => {
  const q = {};
  if (status && status !== "all") q.status = status;
  if (search) {
    const { safeRegex } = require("../utils/escapeRegex");
    const rx = safeRegex(search);
    const users = await User.find({ $or: [{ name: rx }, { email: rx }] }).select("_id").limit(50).lean();
    q.$or = [{ enquiryNumber: rx }, { user: { $in: users.map((u) => u._id) } }];
  }
  const skip = (Math.max(1, page) - 1) * limit;
  const [rows, total] = await Promise.all([
    PackageEnquiry.find(q).select("-messages -quotationHistory").populate("package", "name slug duration").populate("user", "name email phone").sort({ lastActivityAt: -1 }).skip(skip).limit(limit).lean(),
    PackageEnquiry.countDocuments(q),
  ]);
  return { enquiries: rows, total, page, pages: Math.max(1, Math.ceil(total / limit)) };
};

const adminStats = async () => {
  const rows = await PackageEnquiry.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]);
  const byStatus = Object.fromEntries(PackageEnquiry.STATUSES.map((s) => [s, 0]));
  rows.forEach((r) => (byStatus[r._id] = r.count));
  // "needs attention": new enquiries, customer replies, revision requests, counter-offers
  const awaitingAdmin = await PackageEnquiry.countDocuments({ $or: [{ status: { $in: ["new", "revision_requested", "counter_offered"] } }, { status: "in_discussion", lastMessageBy: "customer" }] });
  return { byStatus, awaitingAdmin };
};

module.exports = {
  createEnquiry,
  listMine,
  getForUser,
  addMessage,
  sendQuotation,
  decideCounterOffer,
  requestRevision,
  counterOffer,
  acceptQuotation,
  cancelEnquiry,
  setAdminStatus,
  addNote,
  getForAdmin,
  adminList,
  adminStats,
  advanceFeasible,
  present,
};
