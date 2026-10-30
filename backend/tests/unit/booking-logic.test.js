const { peakRoomOccupancy } = require("../../services/availability.service");
const { refundPercentFor } = require("../../services/booking.service");
const { generateBookingReference } = require("../../utils/bookingRef");
const Booking = require("../../models/booking.model");

const d = (s) => new Date(s);

describe("availability - peak room occupancy", () => {
  test("non-overlapping neighbours are not double counted", () => {
    const existing = [
      { checkIn: d("2026-01-01"), checkOut: d("2026-01-03"), numberOfRooms: 1 },
      { checkIn: d("2026-01-03"), checkOut: d("2026-01-05"), numberOfRooms: 1 },
    ];
    expect(peakRoomOccupancy(existing, d("2026-01-02"), d("2026-01-04"))).toBe(1);
  });
  test("same-night overlaps are summed", () => {
    const existing = [
      { checkIn: d("2026-01-01"), checkOut: d("2026-01-05"), numberOfRooms: 2 },
      { checkIn: d("2026-01-02"), checkOut: d("2026-01-04"), numberOfRooms: 1 },
    ];
    expect(peakRoomOccupancy(existing, d("2026-01-01"), d("2026-01-05"))).toBe(3);
  });
  test("check-out day is free for the next guest", () => {
    expect(peakRoomOccupancy([{ checkIn: d("2026-01-01"), checkOut: d("2026-01-03"), numberOfRooms: 1 }], d("2026-01-03"), d("2026-01-05"))).toBe(0);
  });
});

describe("cancellation refund policy", () => {
  test.each([
    [30, 90],
    [7, 90],
    [6, 50],
    [3, 50],
    [2, 0],
    [0, 0],
    [-5, 0],
  ])("%s days before start -> %s%% refund", (days, pct) => expect(refundPercentFor(days)).toBe(pct));
});

describe("booking reference + model", () => {
  test("format and uniqueness", () => {
    const refs = new Set(Array.from({ length: 500 }, () => generateBookingReference()));
    expect(refs.size).toBe(500);
    [...refs].forEach((r) => expect(r).toMatch(/^IT-\d{6}-[A-Z2-9]{6}$/));
  });
  test("new bookings get a reference, invoice number and start pending/pending", async () => {
    const b = new Booking({ user: "665f1c2e8f1b2c0012345678", bookingType: "package", pricing: { basePrice: 100, totalAmount: 105 } });
    await b.validate();
    expect(b.bookingReference).toBeTruthy();
    expect(b.invoiceNumber).toBe(`INV-${b.bookingReference.slice(3)}`);
    expect(b.bookingStatus).toBe("pending");
    expect(b.paymentStatus).toBe("pending");
  });
  test("pending bookings only hold inventory until they expire", () => {
    const f = Booking.activeHoldFilter(new Date("2026-01-01"));
    expect(f.$or).toEqual(expect.arrayContaining([{ bookingStatus: { $in: ["pending", "awaiting_approval"] }, expiresAt: { $gt: new Date("2026-01-01") } }]));
  });
});
