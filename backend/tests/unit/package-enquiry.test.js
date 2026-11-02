// Package "Discuss & Customize" flow: enquiry -> negotiation -> quotation -> accept -> booking -> advance/full payment.
// Uses real Mongoose documents (so schema rules/validation run) with the database calls mocked.
const mongoose = require("mongoose");
const request = require("supertest");

const mockGateway = {
  orders: { create: jest.fn(async ({ amount, receipt }) => ({ id: "order_test_1", amount, currency: "INR", receipt })) },
  payments: { fetch: jest.fn(), refund: jest.fn(async () => ({ id: "rfnd_1", status: "processed" })) },
};
jest.mock("../../utils/razorpay", () => ({
  ...jest.requireActual("../../utils/razorpay"),
  getRazorpay: () => mockGateway,
  isConfigured: () => true,
}));
jest.mock("../../utils/invoice", () => ({ ...jest.requireActual("../../utils/invoice"), invoiceToBuffer: jest.fn(async () => Buffer.from("pdf")) }));

const app = require("../../app");
const PackageEnquiry = require("../../models/packageEnquiry.model");
const Package = require("../../models/package.model");
const Booking = require("../../models/booking.model");
const Payment = require("../../models/payment.model");
const User = require("../../models/user.model");
const Notification = require("../../models/notification.model");
const enquiryService = require("../../services/enquiry.service");
const paymentService = require("../../services/payment.service");
const { PACKAGE_ENQUIRY } = require("../../config/policy");
const { mockAuth, auth, chain, ids } = require("../api/helpers");

const oid = () => new mongoose.Types.ObjectId();
const DAY = 864e5;
const inDays = (n) => new Date(Date.now() + n * DAY);
const customer = { _id: ids.user, role: "user", name: "Rahul", email: "rahul@test.dev" };
const admin = { _id: ids.admin, role: "admin", name: "Admin", email: "admin@test.dev" };
const pkgId = oid();

let notifications;
beforeEach(() => {
  notifications = jest.spyOn(Notification, "create").mockImplementation(async (d) => ({ ...d, toObject: () => d }));
  jest.spyOn(User, "find").mockReturnValue(chain([{ _id: oid(), email: "admin@test.dev" }]));
  // saving = schema validation only (no database)
  jest.spyOn(PackageEnquiry.prototype, "save").mockImplementation(async function () {
    await this.validate();
    return this;
  });
  jest.spyOn(Booking.prototype, "save").mockImplementation(async function () {
    await this.validate();
    return this;
  });
});
afterEach(() => jest.restoreAllMocks());

const makeEnquiry = (over = {}) =>
  new PackageEnquiry({
    user: customer._id,
    package: pkgId,
    request: { startDate: inDays(30), adults: 2, children: 0, days: 5, rooms: 1 },
    status: "in_discussion",
    ...over,
  });

const quotationFields = (over = {}) => ({ version: 1, amount: 50000, tax: 2500, totalAmount: 52500, travellers: 2, days: 5, nights: 4, advanceAllowed: true, advancePercent: 30, validUntil: inDays(7), ...over });
const quoted = (over = {}) => makeEnquiry({ status: "quotation_sent", quotation: quotationFields(), ...over });
const serve = (e) => jest.spyOn(PackageEnquiry, "findById").mockReturnValue(chain(e));

/* ------------------------------------------------------------------ */
describe("models", () => {
  test("enquiry gets a readable number and starts as 'new'", async () => {
    const e = new PackageEnquiry({ user: customer._id, package: pkgId, request: { startDate: inDays(10), adults: 1, budget: { amount: 25000 } } });
    await e.validate();
    expect(e.enquiryNumber).toMatch(/^ENQ-[A-Z2-9]{6}$/);
    expect(e.status).toBe("new");
    expect(e.request.budget.basis).toBe("per_person");
  });
  test("bookings support an advance plan", () => {
    expect(Booking.schema.path("paymentStatus").enumValues).toContain("partially_paid");
    expect(Payment.schema.path("purpose").enumValues).toEqual(["full", "advance", "balance"]);
  });
});

/* ------------------------------------------------------------------ */
describe("createEnquiry", () => {
  const input = (over = {}) => ({ packageId: String(pkgId), startDate: inDays(20), adults: 2, children: 1, budgetAmount: 25000, budgetBasis: "per_person", requirements: "Hotel with breakfast and private cab", contactMethod: "whatsapp", ...over });
  const mockPackage = (over = {}) => jest.spyOn(Package, "findById").mockResolvedValue({ _id: pkgId, name: "Rajasthan Heritage Tour", isActive: true, duration: { days: 5, nights: 4 }, ...over });

  test("creates a 'new' enquiry, defaults the days from the package and alerts customer + admins", async () => {
    mockPackage();
    jest.spyOn(PackageEnquiry, "findOne").mockReturnValue(chain(null));
    const create = jest.spyOn(PackageEnquiry, "create").mockImplementation(async (d) => {
      const e = new PackageEnquiry(d);
      await e.validate();
      return e;
    });
    jest.spyOn(PackageEnquiry, "findById").mockReturnValue(chain({ _id: oid(), enquiryNumber: "ENQ-TEST22", user: { name: "Rahul", email: "rahul@test.dev" }, package: { name: "Rajasthan Heritage Tour" }, request: { startDate: inDays(20), adults: 2, children: 1 } }));

    const e = await enquiryService.createEnquiry(customer, input());

    const data = create.mock.calls[0][0];
    expect(data.request).toMatchObject({ adults: 2, children: 1, days: 5, rooms: 1, contactMethod: "whatsapp", budget: { amount: 25000, basis: "per_person" } });
    expect(e.status).toBe("new");
    const types = notifications.mock.calls.map(([n]) => n.type);
    expect(types.filter((t) => t === "enquiry_update").length).toBeGreaterThanOrEqual(2); // customer + admin
    expect(notifications.mock.calls.some(([n]) => n.link?.startsWith("/admin/enquiries/"))).toBe(true);
  });

  test("rejects: past date, unknown/inactive package, too many travellers", async () => {
    mockPackage();
    await expect(enquiryService.createEnquiry(customer, input({ startDate: inDays(-2) }))).rejects.toMatchObject({ statusCode: 400 });
    await expect(enquiryService.createEnquiry(customer, input({ adults: 30, children: 5 }))).rejects.toMatchObject({ statusCode: 400 });
    mockPackage({ isActive: false });
    await expect(enquiryService.createEnquiry(customer, input())).rejects.toMatchObject({ statusCode: 404 });
  });

  test("a second open enquiry for the same package returns 409 with the id of the first", async () => {
    mockPackage();
    const existing = { _id: oid(), enquiryNumber: "ENQ-OLD222" };
    jest.spyOn(PackageEnquiry, "findOne").mockReturnValue(chain(existing));
    await expect(enquiryService.createEnquiry(customer, input())).rejects.toMatchObject({ statusCode: 409, details: { enquiryId: existing._id } });
  });
});

/* ------------------------------------------------------------------ */
describe("conversation", () => {
  test("admin reply moves 'new' to 'in_discussion' and tells the customer; customer reply tells the admins", async () => {
    const e = makeEnquiry({ status: "new" });
    serve(e);
    await enquiryService.addMessage(admin, e._id, "Can you share your hotel preference?");
    expect(e.status).toBe("in_discussion");
    expect(e.lastMessageBy).toBe("admin");
    expect(notifications.mock.calls.at(-1)[0]).toMatchObject({ type: "enquiry_update", link: `/enquiries/${e._id}` });

    await enquiryService.addMessage(customer, e._id, "4-star with pool please");
    expect(e.messages.map((m) => m.sender)).toEqual(["admin", "customer"]);
    expect(e.lastMessageBy).toBe("customer");
    expect(notifications.mock.calls.at(-1)[0].link).toBe(`/admin/enquiries/${e._id}`);
  });

  test("closed enquiries cannot be chatted on; other people's enquiries look like they do not exist", async () => {
    const closed = makeEnquiry({ status: "rejected" });
    serve(closed);
    await expect(enquiryService.addMessage(customer, closed._id, "hello?")).rejects.toMatchObject({ statusCode: 400 });
    const open = makeEnquiry();
    serve(open);
    await expect(enquiryService.addMessage({ _id: oid(), role: "user", name: "Other" }, open._id, "hi")).rejects.toMatchObject({ statusCode: 404 });
  });
});

/* ------------------------------------------------------------------ */
describe("admin quotation", () => {
  const fields = (over = {}) => ({ amount: 50000, validDays: 7, itinerary: [{ day: 1, title: "Arrive in Jaipur" }], hotels: [{ name: "Rambagh Palace", nights: 2 }], inclusions: ["Breakfast"], advanceAllowed: true, advancePercent: 30, ...over });

  test("adds GST, computes per-person price, sets validity and moves to quotation_sent", async () => {
    const e = makeEnquiry();
    serve(e);
    const out = await enquiryService.sendQuotation(admin, e._id, fields());

    expect(e.status).toBe("quotation_sent");
    expect(e.quotation).toMatchObject({ version: 1, amount: 50000, tax: 2500, totalAmount: 52500, perPerson: 25000, travellers: 2, advanceAllowed: true, advancePercent: 30 });
    expect(e.quotation.validUntil.getTime()).toBeGreaterThan(Date.now() + 6 * DAY);
    expect(e.messages.at(-1).kind).toBe("quotation");
    expect(out.advanceAvailable).toBe(true);
    expect(out.quotationExpired).toBe(false);
    expect(notifications.mock.calls.at(-1)[0].title).toBe("Your quotation is ready");
  });

  test("a revised quotation becomes v2 and the old one is kept in history; validity is capped", async () => {
    const e = quoted();
    serve(e);
    await enquiryService.sendQuotation(admin, e._id, fields({ amount: 45000, validDays: 999 }));
    expect(e.quotation.version).toBe(2);
    expect(e.quotation.amount).toBe(45000);
    expect(e.quotationHistory).toHaveLength(1);
    expect(e.quotationHistory[0].amount).toBe(50000);
    expect(e.quotation.validUntil.getTime()).toBeLessThanOrEqual(Date.now() + PACKAGE_ENQUIRY.maxQuoteValidityDays * DAY + 5000);
  });

  test("not allowed once accepted / booked / closed", async () => {
    for (const status of ["accepted", "booked", "rejected", "cancelled"]) {
      serve(makeEnquiry({ status }));
      await expect(enquiryService.sendQuotation(admin, oid(), fields())).rejects.toMatchObject({ statusCode: 400 });
    }
  });

  test("advance plan is refused when the trip starts too soon for a balance deadline", async () => {
    const e = makeEnquiry({ request: { startDate: inDays(5), adults: 2, children: 0, days: 5 } });
    serve(e);
    await expect(enquiryService.sendQuotation(admin, e._id, fields())).rejects.toMatchObject({ statusCode: 400 });
    await expect(enquiryService.sendQuotation(admin, e._id, fields({ advanceAllowed: false }))).resolves.toBeTruthy();
  });

  test("a new quotation supersedes a pending counter-offer", async () => {
    const e = quoted({ status: "counter_offered", counterOffer: { amount: 40000, at: new Date(), status: "pending" } });
    serve(e);
    await enquiryService.sendQuotation(admin, e._id, fields({ amount: 46000 }));
    expect(e.counterOffer.status).toBe("superseded");
    expect(e.status).toBe("quotation_sent");
  });
});

/* ------------------------------------------------------------------ */
describe("customer response: changes / counter-offer", () => {
  test("revision request only while a quotation is waiting", async () => {
    const e = quoted();
    serve(e);
    await enquiryService.requestRevision(customer, e._id, "Please add a desert safari");
    expect(e.status).toBe("revision_requested");
    expect(e.messages.at(-1)).toMatchObject({ kind: "revision_request", sender: "customer" });
    await expect(enquiryService.requestRevision(customer, e._id, "again")).rejects.toMatchObject({ statusCode: 409 });
  });

  test("counter-offer must be lower than the quote; it is stored as pending", async () => {
    const e = quoted();
    serve(e);
    await expect(enquiryService.counterOffer(customer, e._id, { amount: 50000 })).rejects.toMatchObject({ statusCode: 400 });
    await expect(enquiryService.counterOffer(customer, e._id, { amount: 60000 })).rejects.toMatchObject({ statusCode: 400 });
    await enquiryService.counterOffer(customer, e._id, { amount: 42000, note: "Group of friends" });
    expect(e.status).toBe("counter_offered");
    expect(e.counterOffer).toMatchObject({ amount: 42000, status: "pending" });
  });

  test("admin accepts the counter-offer -> new quotation at that price (GST recalculated)", async () => {
    const e = quoted({ status: "counter_offered", counterOffer: { amount: 42000, at: new Date(), status: "pending" } });
    serve(e);
    await enquiryService.decideCounterOffer(admin, e._id, { decision: "accept" });
    expect(e.status).toBe("quotation_sent");
    expect(e.quotation).toMatchObject({ version: 2, amount: 42000, tax: 2100, totalAmount: 44100 });
    expect(e.counterOffer.status).toBe("accepted");
    expect(e.quotationHistory).toHaveLength(1);
  });

  test("admin declines the counter-offer -> the earlier quotation stays open", async () => {
    const e = quoted({ status: "counter_offered", counterOffer: { amount: 30000, at: new Date(), status: "pending" } });
    serve(e);
    await enquiryService.decideCounterOffer(admin, e._id, { decision: "reject", note: "Below our cost." });
    expect(e.status).toBe("quotation_sent");
    expect(e.counterOffer.status).toBe("rejected");
    expect(e.quotation.amount).toBe(50000);
    await expect(enquiryService.decideCounterOffer(admin, e._id, { decision: "accept" })).rejects.toMatchObject({ statusCode: 400 });
  });
});

/* ------------------------------------------------------------------ */
describe("acceptQuotation -> booking", () => {
  const captureBooking = () =>
    jest.spyOn(Booking, "create").mockImplementation(async (d) => {
      const b = new Booking(d);
      await b.validate();
      return b;
    });

  test("full payment: booking has exactly the quoted price, links the enquiry and waits for payment (48h window)", async () => {
    const e = quoted();
    jest.spyOn(PackageEnquiry, "findOneAndUpdate").mockResolvedValue(e);
    serve(e);
    const create = captureBooking();

    const { booking } = await enquiryService.acceptQuotation(customer, e._id, { paymentOption: "full" });

    const data = create.mock.calls[0][0];
    expect(data).toMatchObject({ bookingType: "package", bookingStatus: "pending", enquiry: e._id, guests: { adults: 2, children: 0 }, pricing: { basePrice: 50000, discount: 0, tax: 2500, totalAmount: 52500 }, paymentPlan: { mode: "full" } });
    expect(data.expiresAt.getTime()).toBeGreaterThan(Date.now() + 47 * 3_600_000);
    expect(booking.bookingReference).toMatch(/^IT-/);
    expect(e.booking).toEqual(booking._id);
    expect(e.messages.at(-1).kind).toBe("status");
  });

  test("advance plan: advance + balance add up to the total and the balance is due 7 days before the trip", async () => {
    const e = quoted();
    jest.spyOn(PackageEnquiry, "findOneAndUpdate").mockResolvedValue(e);
    serve(e);
    const create = captureBooking();

    await enquiryService.acceptQuotation(customer, e._id, { paymentOption: "advance" });

    const plan = create.mock.calls[0][0].paymentPlan;
    expect(plan).toMatchObject({ mode: "advance", advancePercent: 30, advanceAmount: 15750, balanceAmount: 36750 });
    expect(plan.advanceAmount + plan.balanceAmount).toBe(52500);
    const start = create.mock.calls[0][0].travelDate.getTime();
    expect(plan.balanceDueDate.getTime()).toBe(start - PACKAGE_ENQUIRY.balanceDueDaysBeforeTrip * DAY);
  });

  test("advance chosen but not offered -> 400 and the quotation is reopened for another try", async () => {
    const e = quoted({ quotation: quotationFields({ advanceAllowed: false, advancePercent: undefined }) });
    jest.spyOn(PackageEnquiry, "findOneAndUpdate").mockResolvedValue(e);
    serve(e);
    captureBooking();
    const revert = jest.spyOn(PackageEnquiry, "updateOne").mockResolvedValue({ modifiedCount: 1 });
    await expect(enquiryService.acceptQuotation(customer, e._id, { paymentOption: "advance" })).rejects.toMatchObject({ statusCode: 400 });
    expect(revert.mock.calls[0][1].$set.status).toBe("quotation_sent");
  });

  test("expired quotation cannot be accepted", async () => {
    const e = quoted({ quotation: quotationFields({ validUntil: inDays(-1) }) });
    jest.spyOn(PackageEnquiry, "findOneAndUpdate").mockResolvedValue(null); // the atomic claim needs validUntil > now
    serve(e);
    await expect(enquiryService.acceptQuotation(customer, e._id, {})).rejects.toMatchObject({ statusCode: 409, message: expect.stringMatching(/expired/i) });
  });

  test("double click: an already accepted enquiry with a payable booking returns that booking (no second booking)", async () => {
    const booking = new Booking({ user: customer._id, bookingType: "package", package: pkgId, travelDate: inDays(30), pricing: { basePrice: 50000, tax: 2500, totalAmount: 52500 }, bookingStatus: "pending", expiresAt: inDays(1) });
    const e = quoted({ status: "accepted", booking });
    jest.spyOn(PackageEnquiry, "findOneAndUpdate").mockResolvedValue(null);
    serve(e);
    const create = captureBooking();
    const out = await enquiryService.acceptQuotation(customer, e._id, {});
    expect(create).not.toHaveBeenCalled();
    expect(out.booking.bookingReference).toBe(booking.bookingReference);
  });

  test("the payment window lapsed -> accepting again creates a fresh booking for the same quotation", async () => {
    const stale = new Booking({ user: customer._id, bookingType: "package", package: pkgId, travelDate: inDays(30), pricing: { basePrice: 50000, tax: 2500, totalAmount: 52500 }, bookingStatus: "expired" });
    const e = quoted({ status: "accepted", booking: stale });
    jest.spyOn(PackageEnquiry, "findOneAndUpdate").mockResolvedValue(null);
    serve(e);
    const create = captureBooking();
    await enquiryService.acceptQuotation(customer, e._id, { paymentOption: "full" });
    expect(create).toHaveBeenCalledTimes(1);
  });

  test("travel date already passed -> 409", async () => {
    const e = quoted({ request: { startDate: inDays(-1), adults: 2, children: 0, days: 5 } });
    jest.spyOn(PackageEnquiry, "findOneAndUpdate").mockResolvedValue(e);
    serve(e);
    captureBooking();
    jest.spyOn(PackageEnquiry, "updateOne").mockResolvedValue({});
    await expect(enquiryService.acceptQuotation(customer, e._id, {})).rejects.toMatchObject({ statusCode: 409 });
  });

  test("coupons cannot be stacked on a negotiated price", async () => {
    const bookingService = require("../../services/booking.service");
    jest.spyOn(Booking, "findById").mockResolvedValue(new Booking({ user: customer._id, bookingType: "package", package: pkgId, enquiry: oid(), pricing: { basePrice: 1, totalAmount: 1 }, bookingStatus: "pending" }));
    await expect(bookingService.applyCouponToBooking(oid(), { _id: customer._id }, "SAVE10")).rejects.toMatchObject({ statusCode: 400 });
  });
});

/* ------------------------------------------------------------------ */
describe("cancel / reject", () => {
  test("customer cancel closes the enquiry and releases an unpaid booking", async () => {
    const booking = new Booking({ user: customer._id, bookingType: "package", package: pkgId, travelDate: inDays(30), pricing: { basePrice: 1, totalAmount: 1 }, bookingStatus: "pending" });
    const e = quoted({ status: "accepted", booking });
    serve(e);
    const bookingUpdate = jest.spyOn(Booking, "updateOne").mockResolvedValue({ modifiedCount: 1 });
    const paymentUpdate = jest.spyOn(Payment, "updateMany").mockResolvedValue({});
    await enquiryService.cancelEnquiry(customer, e._id, "Plans changed");
    expect(e.status).toBe("cancelled");
    expect(bookingUpdate.mock.calls[0][1].$set.bookingStatus).toBe("cancelled");
    expect(paymentUpdate).toHaveBeenCalled();
  });

  test("a booked enquiry must be cancelled through the booking (refund rules)", async () => {
    serve(makeEnquiry({ status: "booked" }));
    await expect(enquiryService.cancelEnquiry(customer, oid(), "x")).rejects.toMatchObject({ statusCode: 400 });
  });

  test("admin rejects with a reason; refuses once money was received", async () => {
    const e = makeEnquiry();
    serve(e);
    await enquiryService.setAdminStatus(admin, e._id, { status: "rejected", note: "Not operating on those dates." });
    expect(e.status).toBe("rejected");
    expect(notifications.mock.calls.at(-1)[0].message).toMatch(/not been charged/i);

    const paidBooking = new Booking({ user: customer._id, bookingType: "package", package: pkgId, travelDate: inDays(30), pricing: { basePrice: 1, totalAmount: 1 }, paymentStatus: "partially_paid", bookingStatus: "pending" });
    serve(makeEnquiry({ status: "accepted", booking: paidBooking }));
    await expect(enquiryService.setAdminStatus(admin, oid(), { status: "rejected", note: "x y z" })).rejects.toMatchObject({ statusCode: 400 });
  });
});

/* ------------------------------------------------------------------ */
describe("payments: full, advance and balance", () => {
  const planBooking = (over = {}) =>
    new Booking({
      user: customer._id,
      bookingType: "package",
      package: pkgId,
      travelDate: inDays(30),
      guests: { adults: 2 },
      pricing: { basePrice: 50000, discount: 0, tax: 2500, totalAmount: 52500 },
      enquiry: oid(),
      approvedAt: new Date(),
      expiresAt: inDays(1),
      bookingStatus: "pending",
      paymentStatus: "pending",
      paymentPlan: { mode: "advance", advancePercent: 30, advanceAmount: 15750, balanceAmount: 36750, balanceDueDate: inDays(23) },
      ...over,
    });
  const serveBooking = (b) => jest.spyOn(Booking, "findById").mockReturnValue(chain(b));
  const mockPaymentCreate = () => jest.spyOn(Payment, "create").mockImplementation(async (d) => ({ _id: oid(), ...d }));

  beforeEach(() => {
    mockGateway.orders.create.mockClear();
    mockGateway.payments.refund.mockClear();
    jest.spyOn(Payment, "findOne").mockReturnValue(chain(null));
  });

  test("first payment of an advance plan = the advance only", async () => {
    const b = planBooking();
    serveBooking(b);
    const create = mockPaymentCreate();
    const out = await paymentService.createOrder(b._id, customer);
    expect(out.amount).toBe(15750 * 100);
    expect(create.mock.calls[0][0]).toMatchObject({ purpose: "advance", amount: 15750 });
    expect(b.paymentStatus).toBe("pending");
  });

  test("after the advance, the next payment = the balance (booking stays untouched until it is paid)", async () => {
    const b = planBooking({ bookingStatus: "confirmed", paymentStatus: "partially_paid", amountPaid: 15750, expiresAt: undefined });
    serveBooking(b);
    const create = mockPaymentCreate();
    const out = await paymentService.createOrder(b._id, customer);
    expect(out.amount).toBe(36750 * 100);
    expect(create.mock.calls[0][0]).toMatchObject({ purpose: "balance", amount: 36750 });
    expect(b.paymentStatus).toBe("partially_paid");
    expect(b.expiresAt).toBeUndefined();
  });

  test("a normal (full) booking is unchanged: one payment of the total", async () => {
    const b = planBooking({ paymentPlan: { mode: "full" }, enquiry: undefined });
    serveBooking(b);
    const create = mockPaymentCreate();
    const out = await paymentService.createOrder(b._id, customer);
    expect(out.amount).toBe(52500 * 100);
    expect(create.mock.calls[0][0]).toMatchObject({ purpose: "full", amount: 52500 });
  });

  test("nothing more to pay once fully paid; someone else's booking is refused", async () => {
    serveBooking(planBooking({ paymentStatus: "paid", bookingStatus: "confirmed" }));
    await expect(paymentService.createOrder(oid(), customer)).rejects.toMatchObject({ statusCode: 400 });
    serveBooking(planBooking());
    await expect(paymentService.createOrder(oid(), { _id: oid() })).rejects.toMatchObject({ statusCode: 403 });
  });

  const claim = (b, over) => {
    const claimed = { _id: oid(), booking: b._id, razorpayOrderId: "order_x", amount: 15750, purpose: "advance", status: "paid", ...over };
    jest.spyOn(Payment, "findOne").mockReturnValue(chain({ _id: claimed._id }));
    jest.spyOn(Payment, "findOneAndUpdate").mockResolvedValue(claimed);
    return claimed;
  };

  test("advance paid -> booking confirmed + partially_paid, enquiry marked booked", async () => {
    const b = planBooking();
    serveBooking(b);
    claim(b, {});
    const enquiryUpdate = jest.spyOn(PackageEnquiry, "updateOne").mockResolvedValue({});

    await paymentService.confirmPayment({ orderId: "order_x", paymentId: "pay_1", via: "client" });

    expect(b.bookingStatus).toBe("confirmed");
    expect(b.paymentStatus).toBe("partially_paid");
    expect(b.amountPaid).toBe(15750);
    expect(b.expiresAt).toBeUndefined();
    expect(enquiryUpdate.mock.calls[0][0]).toMatchObject({ _id: b.enquiry, status: "accepted" });
    expect(enquiryUpdate.mock.calls[0][1].$set.status).toBe("booked");
    expect(notifications.mock.calls.some(([n]) => n.title === "Advance payment received")).toBe(true);
  });

  test("balance paid -> fully paid, total received = the quoted total", async () => {
    const b = planBooking({ bookingStatus: "confirmed", paymentStatus: "partially_paid", amountPaid: 15750, expiresAt: undefined });
    serveBooking(b);
    claim(b, { amount: 36750, purpose: "balance" });
    jest.spyOn(User, "findById").mockReturnValue(chain({ name: "Rahul", email: "rahul@test.dev" }));

    await paymentService.confirmPayment({ orderId: "order_x", paymentId: "pay_2", via: "webhook" });

    expect(b.paymentStatus).toBe("paid");
    expect(b.amountPaid).toBe(52500);
    expect(b.paymentPlan.balancePaidAt).toBeInstanceOf(Date);
    expect(b.bookingStatus).toBe("confirmed");
  });

  test("a payment with the wrong amount is auto-refunded and never confirms the booking", async () => {
    const b = planBooking();
    serveBooking(b);
    const claimed = claim(b, { amount: 100 });
    claimed.refunds = [];
    claimed.save = jest.fn();
    claimed.razorpayPaymentId = "pay_bad";
    const out = await paymentService.confirmPayment({ orderId: "order_x", paymentId: "pay_bad", via: "client" });
    expect(out.refunded).toBe(true);
    expect(b.bookingStatus).not.toBe("confirmed");
  });

  test("refundBookingAmount refunds the newest payment first, then the older one", async () => {
    const mk = (amount, paidAt, id) => {
      const p = new Payment({ booking: oid(), user: customer._id, amount, status: "paid", razorpayPaymentId: id, paidAt });
      jest.spyOn(p, "save").mockResolvedValue(p);
      return p;
    };
    const advance = mk(15750, inDays(-10), "pay_adv");
    const balance = mk(36750, inDays(-1), "pay_bal");
    jest.spyOn(Payment, "find").mockReturnValue(chain([balance, advance])); // already sorted newest first

    const refunded = await paymentService.refundBookingAmount({ _id: oid() }, 40000, "Cancelled", customer._id);

    expect(refunded).toBe(40000);
    expect(mockGateway.payments.refund.mock.calls.map(([id, body]) => [id, body.amount])).toEqual([
      ["pay_bal", 36750 * 100],
      ["pay_adv", 3250 * 100],
    ]);
  });

  test("cancelling an advance-plan booking refunds a policy percentage of what was actually paid", async () => {
    const bookingService = require("../../services/booking.service");
    const b = planBooking({ bookingStatus: "confirmed", paymentStatus: "partially_paid", amountPaid: 15750, travelDate: inDays(30), expiresAt: undefined });
    expect(bookingService.previewRefund(b)).toMatchObject({ paid: true, refundPercent: 90, refundAmount: Math.round(15750 * 0.9) });
  });
});

/* ------------------------------------------------------------------ */
describe("balance reminders job", () => {
  test("claims each booking once, then notifies the customer", async () => {
    const bookingService = require("../../services/booking.service");
    const b = { _id: oid(), bookingReference: "IT-260101-ABC234", user: { _id: customer._id, name: "Rahul", email: "rahul@test.dev" }, package: { name: "Tour" }, paymentPlan: { balanceAmount: 36750, balanceDueDate: inDays(2) }, bookingType: "package", guests: {} };
    jest.spyOn(Booking, "find").mockReturnValue(chain([b]));
    const claim = jest.spyOn(Booking, "updateOne").mockResolvedValueOnce({ modifiedCount: 1 }).mockResolvedValueOnce({ modifiedCount: 0 });
    expect(await bookingService.sendBalanceReminders()).toBe(1);
    expect(notifications.mock.calls.at(-1)[0]).toMatchObject({ type: "payment_due", link: `/checkout/${b._id}` });
    expect(await bookingService.sendBalanceReminders()).toBe(0); // second instance lost the claim
    expect(claim).toHaveBeenCalledTimes(2);
  });
});

/* ------------------------------------------------------------------ */
describe("HTTP: permissions + validation", () => {
  beforeEach(() => mockAuth());
  const body = (over = {}) => ({ packageId: String(pkgId), startDate: inDays(20).toISOString().slice(0, 10), adults: 2, ...over });

  test("must be logged in", async () => {
    expect((await request(app).post("/api/enquiries").send(body())).status).toBe(401);
    expect((await request(app).get("/api/enquiries/my")).status).toBe(401);
  });

  test("customers cannot use admin routes", async () => {
    for (const [method, url] of [["get", "/api/enquiries/admin"], ["get", "/api/enquiries/admin/stats"], ["post", `/api/enquiries/admin/${oid()}/quotation`], ["put", `/api/enquiries/admin/${oid()}/status`], ["post", `/api/enquiries/admin/${oid()}/notes`]]) {
      const res = await request(app)[method](url).set(auth.user()).send({});
      expect(res.status).toBe(403);
    }
  });

  test("create validates input", async () => {
    expect((await request(app).post("/api/enquiries").set(auth.user()).send(body({ adults: 0 }))).status).toBe(400);
    expect((await request(app).post("/api/enquiries").set(auth.user()).send(body({ packageId: "nope" }))).status).toBe(400);
    expect((await request(app).post("/api/enquiries").set(auth.user()).send(body({ startDate: undefined }))).status).toBe(400);
  });

  test("quotation validation: price required, advance needs a percentage, reject needs a reason", async () => {
    const id = oid();
    expect((await request(app).post(`/api/enquiries/admin/${id}/quotation`).set(auth.admin()).send({ amount: 0 })).status).toBe(400);
    expect((await request(app).post(`/api/enquiries/admin/${id}/quotation`).set(auth.admin()).send({ amount: 50000, advanceAllowed: true })).status).toBe(400);
    expect((await request(app).put(`/api/enquiries/admin/${id}/status`).set(auth.admin()).send({ status: "rejected" })).status).toBe(400);
    expect((await request(app).put(`/api/enquiries/${id}/counter-offer`).set(auth.user()).send({ amount: -5 })).status).toBe(400);
    expect((await request(app).put(`/api/enquiries/${id}/request-revision`).set(auth.user()).send({ note: "" })).status).toBe(400);
  });

  test("my enquiries + an unknown id", async () => {
    jest.spyOn(PackageEnquiry, "find").mockReturnValue(chain([]));
    const mine = await request(app).get("/api/enquiries/my").set(auth.user());
    expect(mine.status).toBe(200);
    expect(mine.body.enquiries).toEqual([]);
    expect((await request(app).get("/api/enquiries/not-an-id").set(auth.user())).status).toBe(404);
  });

  test("admin can open the list and the stats", async () => {
    jest.spyOn(PackageEnquiry, "find").mockReturnValue(chain([]));
    jest.spyOn(PackageEnquiry, "countDocuments").mockResolvedValue(0);
    jest.spyOn(PackageEnquiry, "aggregate").mockResolvedValue([{ _id: "new", count: 4 }]);
    const list = await request(app).get("/api/enquiries/admin?status=new").set(auth.admin());
    expect(list.status).toBe(200);
    const stats = await request(app).get("/api/enquiries/admin/stats").set(auth.admin());
    expect(stats.body.byStatus.new).toBe(4);
  });
});
