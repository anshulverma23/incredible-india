// Hotel "request booking" flow: request -> admin confirms with hotel -> final price -> customer approves -> payment.
const mongoose = require("mongoose");
const request = require("supertest");
const app = require("../../app");
const Booking = require("../../models/booking.model");
const Room = require("../../models/room.model");
const Hotel = require("../../models/hotel.model");
const User = require("../../models/user.model");
const Coupon = require("../../models/coupon.model");
const Payment = require("../../models/payment.model");
const Notification = require("../../models/notification.model");
const availability = require("../../services/availability.service");
const bookingService = require("../../services/booking.service");
const { HOTEL_REQUEST } = require("../../config/policy");
const { mockAuth, auth, chain, ids } = require("../api/helpers");

const oid = () => new mongoose.Types.ObjectId();
const HOUR = 3_600_000;

beforeEach(() => {
  jest.spyOn(Notification, "create").mockImplementation(async (d) => ({ ...d, toObject: () => d }));
  jest.spyOn(User, "find").mockReturnValue(chain([{ _id: oid(), email: "admin@test.dev" }]));
});
afterEach(() => jest.restoreAllMocks());

const day = (n) => new Date(Date.now() + n * 24 * HOUR).toISOString().slice(0, 10);

describe("model", () => {
  test("a plain request holds no rooms, a quoted price holds them until it expires", () => {
    const now = new Date("2026-01-01");
    const f = Booking.activeHoldFilter(now);
    const held = f.$or.flatMap((c) => (c.bookingStatus?.$in ? c.bookingStatus.$in : [c.bookingStatus]));
    expect(held).toEqual(expect.arrayContaining(["awaiting_approval", "pending", "confirmed", "completed"]));
    expect(held).not.toContain("pending_confirmation");
  });
  test("new statuses exist", () => {
    expect(Booking.BOOKING_STATUSES).toEqual(expect.arrayContaining(["pending_confirmation", "awaiting_approval", "declined"]));
  });
  test("adminNotes and hotel ownerContact are hidden by default (select:false)", () => {
    expect(Booking.schema.path("adminNotes").options.select).toBe(false);
    expect(Hotel.schema.path("ownerContact").options.select).toBe(false);
  });
});

describe("createBooking (hotel) = request, not an instant booking", () => {
  const user = { _id: oid(), name: "Asha", email: "asha@test.dev" };
  const room = { _id: oid(), hotel: oid(), price: 4000, capacity: 2, totalRooms: 3, isAvailable: true };
  let created;

  beforeEach(() => {
    created = null;
    jest.spyOn(Room, "findById").mockResolvedValue(room);
    jest.spyOn(Hotel, "findById").mockImplementation(() => chain({ _id: room.hotel, isActive: true, name: "Dal View", location: { city: "Srinagar" } }));
    jest.spyOn(availability, "roomsAvailable").mockResolvedValue(3);
    jest.spyOn(Booking, "findOne").mockImplementation(() => chain(null));
    jest.spyOn(Booking, "create").mockImplementation(async (d) => (created = { _id: oid(), ...d }));
    jest.spyOn(Booking, "findById").mockImplementation(() => chain({ _id: created._id, bookingReference: "IT-1", bookingType: "hotel", hotel: { name: "Dal View" }, guests: { adults: 2 }, pricing: created.pricing }));
  });

  const input = { bookingType: "hotel", roomId: String(room._id), checkIn: day(10), checkOut: day(12), numberOfRooms: 1, guests: { adults: 2 } };

  test("creates a pending_confirmation request with an ESTIMATED price and a 72h answer window", async () => {
    const { booking, existing } = await bookingService.createBooking(user, input);
    expect(existing).toBe(false);
    expect(booking.bookingStatus).toBe("pending_confirmation");
    expect(booking.statusHistory[0]).toMatchObject({ status: "pending_confirmation", note: "Booking request submitted" });
    expect(booking.estimatedBasePrice).toBe(8000); // 4000 x 2 nights x 1 room
    expect(booking.pricing.basePrice).toBe(8000);
    const hours = (booking.expiresAt - Date.now()) / HOUR;
    expect(hours).toBeGreaterThan(HOTEL_REQUEST.requestExpiryHours - 0.1);
    expect(hours).toBeLessThan(HOTEL_REQUEST.requestExpiryHours + 0.1);
  });

  test("ignores coupons at request time and sends the customer + admin alerts", async () => {
    const couponSpy = jest.spyOn(Coupon, "findOne");
    const { booking } = await bookingService.createBooking(user, { ...input, couponCode: "WELCOME10" });
    expect(couponSpy).not.toHaveBeenCalled();
    expect(booking.coupon).toBeUndefined();
    expect(booking.pricing.discount).toBe(0);
    const types = Notification.create.mock.calls.map((c) => c[0].type);
    expect(types.filter((t) => t === "booking_request").length).toBe(2); // customer + one admin
  });

  test("still rejects impossible requests (no free rooms / too many guests)", async () => {
    availability.roomsAvailable.mockResolvedValue(0);
    await expect(bookingService.createBooking(user, input)).rejects.toMatchObject({ statusCode: 409 });
    availability.roomsAvailable.mockResolvedValue(3);
    await expect(bookingService.createBooking(user, { ...input, guests: { adults: 3 } })).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("admin steps", () => {
  const admin = { _id: oid() };
  const makeBooking = (over = {}) => ({
    _id: oid(),
    bookingReference: "IT-9",
    bookingType: "hotel",
    bookingStatus: "pending_confirmation",
    user: { _id: oid(), name: "Asha", email: "asha@test.dev" },
    hotel: { name: "Dal View" },
    room: { _id: oid() },
    checkIn: new Date(), checkOut: new Date(), numberOfRooms: 1,
    guests: { adults: 2, children: 0 },
    pricing: { basePrice: 8000, discount: 0, tax: 400, totalAmount: 8400 },
    setStatus(status) { this.bookingStatus = status; },
    save: jest.fn(async function () { return this; }),
    ...over,
  });
  const load = (b) => jest.spyOn(Booking, "findById").mockImplementation(() => chain(b));

  test("sendQuote: final price + tax, rooms held for the validity window, customer asked to approve", async () => {
    const b = makeBooking();
    load(b);
    jest.spyOn(availability, "roomsAvailable").mockResolvedValue(1);
    const out = await bookingService.sendQuote(b._id, admin, { finalPrice: 10000, validHours: 12, note: "Breakfast included" });
    expect(out.bookingStatus).toBe("awaiting_approval");
    expect(out.pricing).toMatchObject({ basePrice: 10000, discount: 0, tax: 500, totalAmount: 10500 });
    expect(out.quote).toMatchObject({ amount: 10000, note: "Breakfast included" });
    expect((out.expiresAt - Date.now()) / HOUR).toBeGreaterThan(11.9);
    expect(String(out.expiresAt)).toBe(String(out.quote.validUntil));
    expect(Notification.create.mock.calls.some((c) => c[0].type === "booking_quote")).toBe(true);
  });

  test("sendQuote: validity is capped; the price can be revised while still awaiting approval", async () => {
    const b = makeBooking({ bookingStatus: "awaiting_approval" });
    load(b);
    jest.spyOn(availability, "roomsAvailable").mockResolvedValue(1);
    const out = await bookingService.sendQuote(b._id, admin, { finalPrice: 9000, validHours: 500 });
    expect((out.quote.validUntil - Date.now()) / HOUR).toBeLessThan(HOTEL_REQUEST.maxQuoteValidityHours + 0.1);
    expect(out.pricing.basePrice).toBe(9000);
  });

  test("sendQuote: refuses when the platform shows the rooms are taken, or the booking is not a request", async () => {
    const b = makeBooking();
    load(b);
    jest.spyOn(availability, "roomsAvailable").mockResolvedValue(0);
    await expect(bookingService.sendQuote(b._id, admin, { finalPrice: 9000 })).rejects.toMatchObject({ statusCode: 409 });
    load(makeBooking({ bookingStatus: "confirmed" }));
    await expect(bookingService.sendQuote(b._id, admin, { finalPrice: 9000 })).rejects.toMatchObject({ statusCode: 400 });
    load(makeBooking({ bookingType: "package" }));
    await expect(bookingService.sendQuote(b._id, admin, { finalPrice: 9000 })).rejects.toMatchObject({ statusCode: 400 });
  });

  test("declineRequest: marks declined with the reason and informs the customer", async () => {
    const b = makeBooking();
    load(b);
    const out = await bookingService.declineRequest(b._id, admin, { reason: "Hotel is fully booked" });
    expect(out.bookingStatus).toBe("declined");
    expect(out.declineReason).toBe("Hotel is fully booked");
    expect(out.expiresAt).toBeUndefined();
    expect(Notification.create.mock.calls.some((c) => c[0].type === "booking_declined")).toBe(true);
  });
});

describe("customer approval", () => {
  const user = { _id: oid(), name: "Asha" };

  test("approve moves the booking to pending (awaiting payment) with a fresh payment hold", async () => {
    const spy = jest.spyOn(Booking, "findOneAndUpdate").mockResolvedValue({ _id: oid(), bookingReference: "IT-9", bookingStatus: "pending" });
    await bookingService.approveQuote(oid(), user);
    const [filter, update] = spy.mock.calls[0];
    expect(filter).toMatchObject({ user: user._id, bookingType: "hotel", bookingStatus: "awaiting_approval" });
    expect(filter.expiresAt.$gt).toBeInstanceOf(Date); // an expired offer cannot be approved
    expect(update.$set.bookingStatus).toBe("pending");
    expect(update.$set.approvedAt).toBeInstanceOf(Date);
    expect(update.$set.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  test("approve after the offer expired -> 409; double click -> returns the booking; someone else's -> 404", async () => {
    jest.spyOn(Booking, "findOneAndUpdate").mockResolvedValue(null);
    const find = jest.spyOn(Booking, "findById");
    find.mockResolvedValue({ user: user._id, bookingStatus: "awaiting_approval" });
    await expect(bookingService.approveQuote(oid(), user)).rejects.toMatchObject({ statusCode: 409 });
    find.mockResolvedValue({ user: user._id, bookingStatus: "pending", approvedAt: new Date() });
    await expect(bookingService.approveQuote(oid(), user)).resolves.toMatchObject({ bookingStatus: "pending" });
    find.mockResolvedValue({ user: oid(), bookingStatus: "awaiting_approval" });
    await expect(bookingService.approveQuote(oid(), user)).rejects.toMatchObject({ statusCode: 404 });
    find.mockResolvedValue({ user: user._id, bookingStatus: "pending_confirmation" });
    await expect(bookingService.approveQuote(oid(), user)).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("expiry job", () => {
  test("closes unanswered requests and un-approved offers with the right message", async () => {
    const mk = (status) => ({ _id: oid(), bookingReference: `IT-${status}`, bookingStatus: status, user: { _id: oid(), name: "A", email: "a@test.dev" }, hotel: { name: "H" } });
    const rows = [mk("pending_confirmation"), mk("awaiting_approval")];
    jest.spyOn(Booking, "find").mockReturnValue(chain(rows));
    const upd = jest.spyOn(Booking, "updateOne").mockResolvedValue({ modifiedCount: 1 });
    jest.spyOn(Payment, "updateMany").mockResolvedValue({});
    const n = await bookingService.expireStaleBookings();
    expect(n).toBe(2);
    expect(upd.mock.calls.map((c) => c[0].bookingStatus).sort()).toEqual(["awaiting_approval", "pending_confirmation"]);
    const titles = Notification.create.mock.calls.map((c) => c[0].title);
    expect(titles).toEqual(expect.arrayContaining(["Booking request closed", "Price offer expired"]));
  });
});

describe("HTTP permissions + validation", () => {
  beforeEach(() => mockAuth());
  const id = "665f1c2e8f1b2c0012345999";

  test("only admins can quote / decline / add notes", async () => {
    expect((await request(app).put(`/api/bookings/${id}/quote`).set(auth.user()).send({ finalPrice: 5000 })).status).toBe(403);
    expect((await request(app).put(`/api/bookings/${id}/decline`).set(auth.user()).send({ reason: "no" })).status).toBe(403);
    expect((await request(app).post(`/api/bookings/${id}/notes`).set(auth.user()).send({ note: "x" })).status).toBe(403);
  });
  test("approve needs a logged-in user", async () => {
    expect((await request(app).put(`/api/bookings/${id}/approve`)).status).toBe(401);
  });
  test("quote validates the price; decline needs a reason", async () => {
    expect((await request(app).put(`/api/bookings/${id}/quote`).set(auth.admin()).send({ finalPrice: 0 })).status).toBe(400);
    expect((await request(app).put(`/api/bookings/${id}/quote`).set(auth.admin()).send({ finalPrice: "abc" })).status).toBe(400);
    expect((await request(app).put(`/api/bookings/${id}/decline`).set(auth.admin()).send({})).status).toBe(400);
  });
  test("a valid quote reaches the service", async () => {
    const spy = jest.spyOn(bookingService, "sendQuote").mockResolvedValue({ _id: id, bookingStatus: "awaiting_approval" });
    const res = await request(app).put(`/api/bookings/${id}/quote`).set(auth.admin()).send({ finalPrice: "12000", validHours: 6, note: "ok" });
    expect(res.status).toBe(200);
    expect(spy).toHaveBeenCalledWith(id, expect.objectContaining({ _id: ids.admin }), { finalPrice: 12000, validHours: 6, note: "ok" });
  });
});
