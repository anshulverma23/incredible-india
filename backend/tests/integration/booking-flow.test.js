// End-to-end booking / payment / refund tests against a REAL MongoDB.
// Run with:  MONGO_TEST_URI=mongodb://127.0.0.1:27017/india_travel_test npm test
// (skipped automatically when MONGO_TEST_URI is not set; CI provides a mongo service container.)
const crypto = require("crypto");
const mongoose = require("mongoose");
const request = require("supertest");

const URI = process.env.MONGO_TEST_URI;
const d = URI ? describe : describe.skip;

// Fake Razorpay gateway (network calls only) - signature helpers stay real.
const mockGateway = {
  orders: { create: jest.fn(async ({ amount, receipt }) => ({ id: `order_${crypto.randomBytes(5).toString("hex")}`, amount, currency: "INR", receipt })) },
  payments: { fetch: jest.fn(), refund: jest.fn(async () => ({ id: `rfnd_${crypto.randomBytes(4).toString("hex")}`, status: "processed" })) },
  orders_fetchPayments: jest.fn(),
};
jest.mock("../../utils/razorpay", () => ({
  ...jest.requireActual("../../utils/razorpay"),
  getRazorpay: () => ({ ...mockGateway, orders: { ...mockGateway.orders, fetchPayments: mockGateway.orders_fetchPayments } }),
  isConfigured: () => true,
}));

const app = require("../../app");
const User = require("../../models/user.model");
const Destination = require("../../models/destination.model");
const Package = require("../../models/package.model");
const Hotel = require("../../models/hotel.model");
const Room = require("../../models/room.model");
const Coupon = require("../../models/coupon.model");
const CouponUsage = require("../../models/couponUsage.model");
const Booking = require("../../models/booking.model");
const Payment = require("../../models/payment.model");
const Notification = require("../../models/notification.model");
const Review = require("../../models/review.model");
const Wishlist = require("../../models/wishlist.model");
const paymentService = require("../../services/payment.service");
const bookingService = require("../../services/booking.service");
const { signAccessToken } = require("../../utils/generateToken");

const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const sign = (o, p) => crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET).update(`${o}|${p}`).digest("hex");

d("booking -> payment -> confirmation (real database)", () => {
  let alice, bob, aliceH, bobH, dest, pkg, hotel, room;

  jest.setTimeout(60_000);
  const ALL = [Booking, Payment, Notification, Review, CouponUsage, Coupon, Package, Room, Hotel, Destination, Wishlist, User];

  beforeAll(async () => {
    await mongoose.connect(URI, { autoIndex: false });
    // Build the unique indexes the flow relies on. (TTL indexes on Notification/WebhookEvent are skipped here only because
    // the lightweight Mongo-compatible server used in some sandboxes lacks TTL support; real MongoDB builds them.)
    const NO_TTL = [Booking, Payment, CouponUsage, Coupon, Review, Wishlist, User, Package, Room, Hotel, Destination];
    for (const m of NO_TTL) await m.createIndexes().catch((e) => console.warn(`index warning on ${m.modelName}: ${e.message}`));
    await Promise.all(ALL.map((m) => m.deleteMany({})));
  });
  afterAll(async () => {
    await Promise.all(ALL.map((m) => m.deleteMany({})));
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await Promise.all([Booking, Payment, Notification, Review, CouponUsage, Coupon, Package, Room, Hotel, Destination, Wishlist].map((m) => m.deleteMany({})));
    alice = alice || (await User.create({ name: "Alice", email: "alice@test.dev", password: "Passw0rd1" }));
    bob = bob || (await User.create({ name: "Bob", email: "bob@test.dev", password: "Passw0rd1" }));
    aliceH = { Authorization: `Bearer ${signAccessToken(alice)}` };
    bobH = { Authorization: `Bearer ${signAccessToken(bob)}` };

    dest = await Destination.create({ name: "Kashmir Valley", state: "J&K", city: "Srinagar", description: "x" });
    pkg = await Package.create({ name: "Kashmir Tour", description: "x", destination: dest._id, duration: { days: 5, nights: 4 }, price: 10000, maxGroupSize: 4, startDates: [new Date(day(20))] });
    hotel = await Hotel.create({ name: "Dal View", description: "x", location: { address: "a", city: "Srinagar" }, destination: dest._id });
    room = await Room.create({ hotel: hotel._id, roomType: "Double", price: 4000, capacity: 2, totalRooms: 1 });
    await Coupon.create({ code: "WELCOME10", discountType: "percentage", discountValue: 10, expiryDate: new Date(Date.now() + 864e5 * 30), minPurchaseAmount: 1000, perUserLimit: 1 });
    jest.clearAllMocks();
  });

  const bookPackage = (headers, extra = {}, key) =>
    request(app).post("/api/bookings").set(headers).set(key ? { "Idempotency-Key": key } : {}).send({ bookingType: "package", packageId: String(pkg._id), travelDate: day(20), guests: { adults: 2 }, ...extra });
  const bookRoom = (headers, ci = 10, co = 12) => request(app).post("/api/bookings").set(headers).send({ bookingType: "hotel", roomId: String(room._id), checkIn: day(ci), checkOut: day(co), guests: { adults: 2 } });

  const pay = async (headers, bookingId) => {
    const o = await request(app).post("/api/payment/create-order").set(headers).send({ bookingId });
    expect(o.status).toBe(201);
    const paymentId = `pay_${crypto.randomBytes(5).toString("hex")}`;
    mockGateway.payments.fetch.mockResolvedValue({ id: paymentId, order_id: o.body.orderId, amount: o.body.amount, status: "captured", method: "upi" });
    return { order: o.body, paymentId, verify: () => request(app).post("/api/payment/verify").set(headers).send({ razorpay_order_id: o.body.orderId, razorpay_payment_id: paymentId, razorpay_signature: sign(o.body.orderId, paymentId) }) };
  };

  /* ---------------- creation, pricing, duplicates ---------------- */
  test("creates a pending booking priced on the server (2 adults x 10,000 + 5% tax)", async () => {
    const res = await bookPackage(aliceH);
    expect(res.status).toBe(201);
    const b = res.body.booking;
    expect(b.pricing).toMatchObject({ basePrice: 20000, discount: 0, tax: 1000, totalAmount: 21000 });
    expect(b.bookingStatus).toBe("pending");
    expect(b.paymentStatus).toBe("pending");
    expect(b.bookingReference).toMatch(/^IT-\d{6}-[A-Z2-9]{6}$/);
    expect(new Date(b.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });
  test("a client-supplied price is ignored", async () => {
    const res = await bookPackage(aliceH, { totalAmount: 1, pricing: { totalAmount: 1 } });
    expect(res.body.booking.pricing.totalAmount).toBe(21000);
  });
  test("same Idempotency-Key -> same booking, no duplicate", async () => {
    const a = await bookPackage(aliceH, {}, "key-1");
    const b = await bookPackage(aliceH, {}, "key-1");
    expect(a.status).toBe(201);
    expect(b.status).toBe(200);
    expect(b.body.booking._id).toBe(a.body.booking._id);
    expect(await Booking.countDocuments()).toBe(1);
  });
  test("an identical open booking is returned instead of creating a second one", async () => {
    const a = await bookPackage(aliceH);
    const b = await bookPackage(aliceH);
    expect(b.body.booking._id).toBe(a.body.booking._id);
    expect(await Booking.countDocuments()).toBe(1);
  });
  test("a conflicting open booking for the same dates is refused (409)", async () => {
    await bookPackage(aliceH);
    const res = await bookPackage(aliceH, { guests: { adults: 3 } });
    expect(res.status).toBe(409);
  });
  test("rejects past dates, non-departure dates and absurd guest counts", async () => {
    expect((await bookPackage(aliceH, { travelDate: day(-2) })).status).toBe(400);
    expect((await bookPackage(aliceH, { travelDate: day(21) })).body.message).toMatch(/no departure/);
    expect((await bookPackage(aliceH, { guests: { adults: 9 } })).body.message).toMatch(/group size/i);
  });
  test("hotel: checkout must be after check-in; room capacity is enforced", async () => {
    expect((await bookRoom(aliceH, 10, 10)).status).toBe(400);
    const res = await request(app).post("/api/bookings").set(aliceH).send({ bookingType: "hotel", roomId: String(room._id), checkIn: day(10), checkOut: day(12), guests: { adults: 3 } });
    expect(res.status).toBe(400);
  });

  /* ---------------- availability ---------------- */
  test("package seats: the departure sells out and later bookers get 409", async () => {
    expect((await bookPackage(aliceH, { guests: { adults: 3 } })).status).toBe(201);
    const res = await bookPackage(bobH, { guests: { adults: 2 } });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/1 seat/);
    expect((await bookPackage(bobH, { guests: { adults: 1 } })).status).toBe(201);
  });
  test("hotel: the only room can't be double-booked, but adjacent dates work", async () => {
    expect((await bookRoom(aliceH, 10, 12)).status).toBe(201);
    expect((await bookRoom(bobH, 11, 13)).status).toBe(409);
    expect((await bookRoom(bobH, 12, 14)).status).toBe(201); // alice checks out the morning bob checks in
  });
  test("RACE: two simultaneous requests for the last room -> exactly one wins", async () => {
    const results = await Promise.all([bookRoom(aliceH, 30, 32), bookRoom(bobH, 30, 32)]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await Booking.countDocuments({ bookingStatus: "pending" })).toBe(1);
  });
  test("an expired unpaid hold no longer blocks the room (even before the cron runs)", async () => {
    const a = await bookRoom(aliceH, 10, 12);
    await Booking.updateOne({ _id: a.body.booking._id }, { expiresAt: new Date(Date.now() - 1000) });
    expect((await bookRoom(bobH, 10, 12)).status).toBe(201);
  });

  /* ---------------- coupons ---------------- */
  test("coupon: WELCOME10 takes 10% off before tax (Rs.20,000 -> Rs.2,000 off)", async () => {
    const res = await bookPackage(aliceH, { couponCode: "welcome10" });
    expect(res.body.booking.pricing).toMatchObject({ basePrice: 20000, discount: 2000, tax: 900, totalAmount: 18900 });
  });
  test("coupon is only consumed when payment succeeds, then per-user limit applies", async () => {
    const b = (await bookPackage(aliceH, { couponCode: "WELCOME10", guests: { adults: 1 } })).body.booking;
    expect((await Coupon.findOne({ code: "WELCOME10" })).usedCount).toBe(0); // unpaid -> not consumed
    const p = await pay(aliceH, b._id);
    expect((await p.verify()).status).toBe(200);
    expect((await Coupon.findOne({ code: "WELCOME10" })).usedCount).toBe(1);
    expect(await CouponUsage.countDocuments({ user: alice._id })).toBe(1);
    const again = await bookPackage(aliceH, { couponCode: "WELCOME10", guests: { adults: 1 }, travelDate: day(20) });
    expect(again.status).toBe(409); // already has a confirmed booking for the date
    const hotelTry = await request(app).post("/api/bookings").set(aliceH).send({ bookingType: "hotel", roomId: String(room._id), checkIn: day(40), checkOut: day(42), guests: { adults: 2 }, couponCode: "WELCOME10" });
    expect(hotelTry.status).toBe(400);
    expect(hotelTry.body.message).toMatch(/already used/);
  });

  /* ---------------- payment ---------------- */
  test("create-order is idempotent and amount comes from the DB", async () => {
    const b = (await bookPackage(aliceH)).body.booking;
    const o1 = await request(app).post("/api/payment/create-order").set(aliceH).send({ bookingId: b._id });
    const o2 = await request(app).post("/api/payment/create-order").set(aliceH).send({ bookingId: b._id });
    expect(o1.body.orderId).toBe(o2.body.orderId);
    expect(o1.body.amount).toBe(21000 * 100);
    expect(mockGateway.orders.create).toHaveBeenCalledTimes(1);
  });
  test("you cannot create an order for someone else's booking", async () => {
    const b = (await bookPackage(aliceH)).body.booking;
    expect((await request(app).post("/api/payment/create-order").set(bobH).send({ bookingId: b._id })).status).toBe(403);
  });
  test("successful payment confirms the booking, notifies, and unlocks the invoice PDF", async () => {
    const b = (await bookPackage(aliceH)).body.booking;
    const inv0 = await request(app).get(`/api/bookings/${b._id}/invoice`).set(aliceH);
    expect(inv0.status).toBe(400); // not paid yet

    const p = await pay(aliceH, b._id);
    const res = await p.verify();
    expect(res.status).toBe(200);
    expect(res.body.booking).toMatchObject({ bookingStatus: "confirmed", paymentStatus: "paid" });

    const fresh = await Booking.findById(b._id);
    expect(fresh.expiresAt).toBeUndefined();
    expect(fresh.statusHistory.map((s) => s.status)).toEqual(["pending", "confirmed"]);
    expect((await Payment.findOne({ booking: b._id })).status).toBe("paid");
    expect(await Notification.countDocuments({ user: alice._id })).toBe(2);

    const inv = await request(app).get(`/api/bookings/${b._id}/invoice`).set(aliceH).buffer().parse((r, cb) => { const c = []; r.on("data", (x) => c.push(x)); r.on("end", () => cb(null, Buffer.concat(c))); });
    expect(inv.status).toBe(200);
    expect(inv.headers["content-type"]).toMatch(/pdf/);
    expect(inv.body.slice(0, 4).toString()).toBe("%PDF");
    expect((await request(app).get(`/api/bookings/${b._id}/invoice`).set(bobH)).status).toBe(403);
  });
  test("verify twice (double click / retry) is harmless", async () => {
    const b = (await bookPackage(aliceH)).body.booking;
    const p = await pay(aliceH, b._id);
    await p.verify();
    const second = await p.verify();
    expect(second.status).toBe(200);
    expect(second.body.alreadyProcessed).toBe(true);
    expect(await Notification.countDocuments({ user: alice._id })).toBe(2);
  });
  // Relies on MongoDB's guarantee that a conditional single-document update is atomic. Verified-by-design on real MongoDB (CI service
  // container); lightweight Mongo emulators do not always honour it under heavy concurrency.
  test("RACE: client verify + webhook + reconcile at the same instant -> side effects happen once", async () => {
    const b = (await bookPackage(aliceH, { couponCode: "WELCOME10" })).body.booking;
    const p = await pay(aliceH, b._id);
    const args = { orderId: p.order.orderId, paymentId: p.paymentId, via: "webhook" };
    await Promise.all([paymentService.confirmPayment(args), paymentService.confirmPayment({ ...args, via: "client" }), paymentService.confirmPayment({ ...args, via: "reconcile" })]);
    expect(await Notification.countDocuments({ user: alice._id })).toBe(2);
    expect(await CouponUsage.countDocuments()).toBe(1);
    expect((await Coupon.findOne({ code: "WELCOME10" })).usedCount).toBe(1);
  });
  test("a forged signature never confirms anything", async () => {
    const b = (await bookPackage(aliceH)).body.booking;
    const o = (await request(app).post("/api/payment/create-order").set(aliceH).send({ bookingId: b._id })).body;
    const res = await request(app).post("/api/payment/verify").set(aliceH).send({ razorpay_order_id: o.orderId, razorpay_payment_id: "pay_fake12345", razorpay_signature: "0".repeat(64) });
    expect(res.status).toBe(400);
    expect((await Booking.findById(b._id)).bookingStatus).toBe("pending");
  });
  test("a captured payment whose amount differs from the order is rejected", async () => {
    const b = (await bookPackage(aliceH)).body.booking;
    const p = await pay(aliceH, b._id);
    mockGateway.payments.fetch.mockResolvedValue({ id: p.paymentId, order_id: p.order.orderId, amount: 100, status: "captured" });
    expect((await p.verify()).status).toBe(400);
    expect((await Booking.findById(b._id)).bookingStatus).toBe("pending");
  });
  test("failed payment: booking stays pending (retry allowed), payment marked failed, user notified", async () => {
    const b = (await bookPackage(aliceH)).body.booking;
    const o = (await request(app).post("/api/payment/create-order").set(aliceH).send({ bookingId: b._id })).body;
    await paymentService.markPaymentFailed(o.orderId, "Card declined");
    const pay1 = await Payment.findOne({ razorpayOrderId: o.orderId });
    expect(pay1).toMatchObject({ status: "failed", failureReason: "Card declined", failureCount: 1 });
    const bk = await Booking.findById(b._id);
    expect(bk).toMatchObject({ bookingStatus: "pending", paymentStatus: "failed" });
    expect(await Notification.countDocuments({ type: "payment_failed" })).toBe(1);
    // retry reuses the same order and can still succeed
    const retry = await request(app).post("/api/payment/create-order").set(aliceH).send({ bookingId: b._id });
    expect(retry.body.orderId).toBe(o.orderId);
  });

  /* ---------------- expiry + late payments ---------------- */
  test("expiry job releases unpaid holds and notifies", async () => {
    const b = (await bookPackage(aliceH)).body.booking;
    await Booking.updateOne({ _id: b._id }, { expiresAt: new Date(Date.now() - 1000) });
    mockGateway.orders_fetchPayments.mockResolvedValue({ items: [] });
    expect(await bookingService.expireStaleBookings()).toBe(1);
    expect((await Booking.findById(b._id)).bookingStatus).toBe("expired");
    expect(await Notification.countDocuments({ type: "booking_expired" })).toBe(1);
    expect((await request(app).post("/api/payment/create-order").set(aliceH).send({ bookingId: b._id })).status).toBe(409);
  });
  test("late payment after expiry: honoured if the seats are still free", async () => {
    const b = (await bookPackage(aliceH)).body.booking;
    const p = await pay(aliceH, b._id);
    await Booking.updateOne({ _id: b._id }, { bookingStatus: "expired", expiresAt: new Date(Date.now() - 1000) });
    expect((await p.verify()).body.booking.bookingStatus).toBe("confirmed");
  });
  test("late payment after expiry: auto-refunded if someone else took the seats", async () => {
    const b = (await bookPackage(aliceH, { guests: { adults: 3 } })).body.booking;
    const p = await pay(aliceH, b._id);
    await Booking.updateOne({ _id: b._id }, { bookingStatus: "expired", expiresAt: new Date(Date.now() - 1000) });
    expect((await bookPackage(bobH, { guests: { adults: 3 } })).status).toBe(201);
    const res = await p.verify();
    expect(res.status).toBe(409);
    expect(mockGateway.payments.refund).toHaveBeenCalledTimes(1);
    expect((await Payment.findOne({ booking: b._id })).status).toBe("refunded");
    expect((await Booking.findById(b._id)).bookingStatus).toBe("failed");
  });

  /* ---------------- cancellation + refunds ---------------- */
  test("cancelling a pending booking frees the seats", async () => {
    const b = (await bookPackage(aliceH, { guests: { adults: 4 } })).body.booking;
    expect((await bookPackage(bobH, { guests: { adults: 1 } })).status).toBe(409);
    const res = await request(app).put(`/api/bookings/${b._id}/cancel`).set(aliceH).send({ reason: "changed plans" });
    expect(res.status).toBe(200);
    expect(res.body.booking.bookingStatus).toBe("cancelled");
    expect((await bookPackage(bobH, { guests: { adults: 1 } })).status).toBe(201);
  });
  test("cancelling a paid trip 20 days out refunds 90% through the gateway", async () => {
    const b = (await bookPackage(aliceH)).body.booking; // total 21,000
    const p = await pay(aliceH, b._id);
    await p.verify();
    const detail = await request(app).get(`/api/bookings/${b._id}`).set(aliceH);
    expect(detail.body.refundPreview).toMatchObject({ refundPercent: 90, refundAmount: 18900 });

    const res = await request(app).put(`/api/bookings/${b._id}/cancel`).set(aliceH).send({});
    expect(res.status).toBe(200);
    expect(res.body.refund).toEqual({ amount: 18900, percent: 90 });
    expect(mockGateway.payments.refund).toHaveBeenCalledWith(p.paymentId, expect.objectContaining({ amount: 1890000 }));
    const bk = await Booking.findById(b._id);
    expect(bk).toMatchObject({ bookingStatus: "refunded", paymentStatus: "partially_refunded" });
    expect((await Payment.findOne({ booking: b._id })).refundedAmount).toBe(18900);
    // cannot cancel twice
    expect((await request(app).put(`/api/bookings/${b._id}/cancel`).set(aliceH).send({})).status).toBe(400);
    // seats are free again
    expect((await bookPackage(bobH, { guests: { adults: 4 } })).status).toBe(201);
  });
  test("strangers cannot cancel your booking; admin can (with a full refund override)", async () => {
    const b = (await bookPackage(aliceH)).body.booking;
    const p = await pay(aliceH, b._id);
    await p.verify();
    expect((await request(app).put(`/api/bookings/${b._id}/cancel`).set(bobH).send({})).status).toBe(403);
    const adminUser = await User.create({ name: "Root", email: `root${Date.now()}@test.dev`, password: "Passw0rd1", role: "admin" });
    const res = await request(app).put(`/api/bookings/${b._id}/cancel`).set({ Authorization: `Bearer ${signAccessToken(adminUser)}` }).send({ refundPercent: 100, reason: "Operator cancelled" });
    expect(res.body.refund).toEqual({ amount: 21000, percent: 100 });
    expect((await Booking.findById(b._id)).paymentStatus).toBe("refunded");
  });
  test("refunding more than was paid is impossible", async () => {
    const b = (await bookPackage(aliceH)).body.booking;
    const p = await pay(aliceH, b._id);
    await p.verify();
    const payment = await Payment.findOne({ booking: b._id });
    await expect(paymentService.refundPayment(payment, 99999)).rejects.toThrow(/refundable/);
  });

  /* ---------------- completion, reviews ---------------- */
  test("reviews: only guests with a COMPLETED booking, one review per booking, rating recalculated", async () => {
    const b = (await bookRoom(aliceH, 5, 6)).body.booking;
    const rev = (headers, body) => request(app).post("/api/reviews").set(headers).send(body);

    expect((await request(app).get(`/api/reviews/eligibility?targetType=hotel&targetId=${hotel._id}`).set(aliceH)).body.canReview).toBe(false);
    expect((await rev(aliceH, { bookingId: b._id, rating: 5, comment: "Lovely stay!" })).status).toBe(403); // pending

    const p = await pay(aliceH, b._id);
    await p.verify();
    expect((await rev(aliceH, { bookingId: b._id, rating: 5, comment: "Lovely stay!" })).status).toBe(403); // confirmed, not completed

    await Booking.updateOne({ _id: b._id }, { endDate: new Date(Date.now() - 864e5 * 2) });
    expect(await bookingService.completeFinishedBookings()).toBe(1);
    expect((await Booking.findById(b._id)).bookingStatus).toBe("completed");

    expect((await rev(bobH, { bookingId: b._id, rating: 1, comment: "Never stayed here" })).status).toBe(404); // someone else's booking
    expect((await request(app).get(`/api/reviews/eligibility?targetType=hotel&targetId=${hotel._id}`).set(aliceH)).body.canReview).toBe(true);

    const ok = await rev(aliceH, { bookingId: b._id, rating: 4, comment: "Lovely stay!" });
    expect(ok.status).toBe(201);
    expect(ok.body.review.hotel).toBe(String(hotel._id));
    const h = await Hotel.findById(hotel._id).lean();
    expect(h).toMatchObject({ rating: 4, numReviews: 1 });
    expect((await rev(aliceH, { bookingId: b._id, rating: 5, comment: "Again!!" })).status).toBe(409);
  });

  /* ---------------- wishlist ---------------- */
  test("wishlist stores destinations and never duplicates", async () => {
    const add = () => request(app).post("/api/wishlist").set(aliceH).send({ itemType: "Destination", itemId: String(dest._id) });
    await Promise.all([add(), add(), add()]);
    const list = await request(app).get("/api/wishlist").set(aliceH);
    expect(list.body.wishlist.items).toHaveLength(1);
    expect(list.body.wishlist.items[0]).toMatchObject({ itemType: "Destination" });
    await request(app).delete(`/api/wishlist/${dest._id}`).set(aliceH);
    expect((await request(app).get("/api/wishlist").set(aliceH)).body.wishlist.items).toHaveLength(0);
  });
  test("history + notifications endpoints", async () => {
    await bookPackage(aliceH);
    const my = await request(app).get("/api/bookings/my").set(aliceH);
    expect(my.body.total).toBe(1);
    expect((await request(app).get("/api/bookings/my").set(bobH)).body.total).toBe(0);
    await Notification.create({ user: alice._id, title: "t", message: "m" });
    const n = await request(app).get("/api/notifications").set(aliceH);
    expect(n.body.unreadCount).toBe(1);
    await request(app).put("/api/notifications/read-all").set(aliceH);
    expect((await request(app).get("/api/notifications?unread=true").set(aliceH)).body.notifications).toHaveLength(0);
  });
});
