const { z } = require("zod");
const { isoDate, boolish } = require("./common");

const base = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,20}$/, "Code must be 3-20 letters/numbers"),
  description: z.string().trim().max(200).optional(),
  // Defaults live in the Mongoose schema (so partial updates never overwrite untouched fields).
  // "fixed" accepted as an alias for "flat"
  discountType: z.enum(["percentage", "flat", "fixed"]).transform((v) => (v === "fixed" ? "flat" : v)),
  discountValue: z.coerce.number().positive(),
  minPurchaseAmount: z.coerce.number().min(0).optional(),
  maxDiscountAmount: z.coerce.number().min(0).optional(),
  applicableOn: z.enum(["all", "hotel", "package"]).optional(),
  startDate: isoDate.optional(),
  expiryDate: isoDate,
  usageLimit: z.coerce.number().int().min(1).optional(),
  perUserLimit: z.coerce.number().int().min(1).optional(),
  isActive: boolish.optional(),
});

const refineDiscount = (d, ctx) => {
  if (d.discountType === "percentage" && d.discountValue > 100) {
    ctx.addIssue({ code: "custom", path: ["discountValue"], message: "Percentage cannot exceed 100" });
  }
};

const create = base.superRefine(refineDiscount);
const update = base.partial().superRefine((d, ctx) => d.discountValue !== undefined && d.discountType !== undefined && refineDiscount(d, ctx));

const validate = z.object({
  code: z.string().trim().min(1).max(20),
  amount: z.coerce.number().positive(),
  bookingType: z.enum(["hotel", "package"]),
});

module.exports = { create, update, validate };
