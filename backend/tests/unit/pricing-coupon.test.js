const { calculatePricing, nightsBetween } = require("../../utils/pricing");
const Coupon = require("../../models/coupon.model");

describe("pricing", () => {
  test("applies discount before tax and rounds to whole rupees", () => {
    expect(calculatePricing({ basePrice: 50000, discount: 5000, taxRate: 0.05 })).toEqual({ basePrice: 50000, discount: 5000, tax: 2250, totalAmount: 47250 });
  });
  test("discount can never exceed the base price", () => {
    expect(calculatePricing({ basePrice: 1000, discount: 5000, taxRate: 0.05 }).totalAmount).toBe(0);
  });
  test("counts nights", () => {
    expect(nightsBetween("2026-12-01", "2026-12-04")).toBe(3);
  });
});

describe("coupon rules", () => {
  const base = { code: "WELCOME10", discountType: "percentage", discountValue: 10, expiryDate: new Date(Date.now() + 864e5), minPurchaseAmount: 5000, usageLimit: 10, perUserLimit: 1 };

  test("Rs.50,000 + WELCOME10 -> Rs.5,000 discount -> Rs.45,000 payable (roadmap example)", () => {
    const r = new Coupon(base).calculateDiscount(50000, "package");
    expect(r).toEqual({ valid: true, discount: 5000 });
    expect(50000 - r.discount).toBe(45000);
  });
  test("flat coupons discount a fixed amount", () => {
    expect(new Coupon({ ...base, code: "TRAVEL500", discountType: "flat", discountValue: 500 }).calculateDiscount(8000, "hotel").discount).toBe(500);
  });
  test("max discount cap", () => {
    expect(new Coupon({ ...base, maxDiscountAmount: 3000 }).calculateDiscount(50000, "package").discount).toBe(3000);
  });
  test("minimum booking amount", () => {
    expect(new Coupon(base).calculateDiscount(1000, "package")).toMatchObject({ valid: false });
  });
  test("expired coupon", () => {
    expect(new Coupon({ ...base, expiryDate: new Date(Date.now() - 1000) }).calculateDiscount(50000, "package")).toMatchObject({ valid: false, message: "Coupon has expired" });
  });
  test("total usage limit", () => {
    expect(new Coupon({ ...base, usedCount: 10 }).calculateDiscount(50000, "package").valid).toBe(false);
  });
  test("per-user limit", () => {
    expect(new Coupon(base).calculateDiscount(50000, "package", 1).valid).toBe(false);
    expect(new Coupon({ ...base, perUserLimit: 2 }).calculateDiscount(50000, "package", 1).valid).toBe(true);
  });
  test("applicableOn restriction", () => {
    expect(new Coupon({ ...base, applicableOn: "hotel" }).calculateDiscount(50000, "package").valid).toBe(false);
  });
  test("inactive coupon", () => {
    expect(new Coupon({ ...base, isActive: false }).calculateDiscount(50000, "package").valid).toBe(false);
  });
});
