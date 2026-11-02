const { z } = require("zod");
const { objectId, isoDate } = require("./common");
const { PACKAGE_ENQUIRY } = require("../config/policy");

const text = (max) => z.string().trim().max(max);
const lines = z.array(z.string().trim().min(1).max(300)).max(40).default([]);

const create = z.object({
  packageId: objectId,
  startDate: isoDate,
  adults: z.coerce.number().int().min(1, "At least 1 adult is required").max(30),
  children: z.coerce.number().int().min(0).max(30).default(0),
  days: z.coerce.number().int().min(1).max(60).optional(),
  rooms: z.coerce.number().int().min(1).max(15).default(1),
  budgetAmount: z.coerce.number().min(0).max(100_000_000).optional(),
  budgetBasis: z.enum(["per_person", "total"]).default("per_person"),
  requirements: text(2000).optional(),
  contactMethod: z.enum(["email", "phone", "whatsapp", "chat"]).default("email"),
  phone: text(20).optional().or(z.literal("")),
});

const message = z.object({ text: z.string().trim().min(1, "Message cannot be empty").max(2000) });

// Admin -> customer: the final, customised offer. `amount` is the package price BEFORE GST.
const quotation = z
  .object({
    amount: z.coerce.number({ error: "Price is required" }).int("Enter the price in whole rupees").min(1, "Price must be greater than 0").max(100_000_000),
    validDays: z.coerce.number().int().min(1).max(PACKAGE_ENQUIRY.maxQuoteValidityDays).optional(),
    days: z.coerce.number().int().min(1).max(60).optional(),
    nights: z.coerce.number().int().min(0).max(60).optional(),
    itinerary: z
      .array(z.object({ day: z.coerce.number().int().min(1).max(60), title: z.string().trim().min(1).max(150), description: text(1500).optional() }))
      .max(60)
      .default([]),
    hotels: z
      .array(z.object({ name: z.string().trim().min(1).max(150), location: text(120).optional(), nights: z.coerce.number().int().min(0).max(60).optional(), roomType: text(80).optional(), mealPlan: text(80).optional() }))
      .max(30)
      .default([]),
    activities: lines,
    transport: text(500).optional(),
    inclusions: lines,
    exclusions: lines,
    note: text(2000).optional(),
    advanceAllowed: z.boolean().default(false),
    advancePercent: z.coerce.number().int().min(PACKAGE_ENQUIRY.minAdvancePercent).max(PACKAGE_ENQUIRY.maxAdvancePercent).optional(),
  })
  .refine((v) => !v.advanceAllowed || v.advancePercent, { message: "Choose the advance percentage", path: ["advancePercent"] });

const accept = z.object({ paymentOption: z.enum(["full", "advance"]).default("full") });
const revision = z.object({ note: z.string().trim().min(3, "Please tell us what to change").max(1000) });
const counter = z.object({ amount: z.coerce.number({ error: "Enter your offer" }).int("Enter the amount in whole rupees").min(1).max(100_000_000), note: text(500).optional() });
const cancel = z.object({ reason: text(300).optional() });

const decision = z.object({ decision: z.enum(["accept", "reject"]), note: text(500).optional(), validDays: z.coerce.number().int().min(1).max(PACKAGE_ENQUIRY.maxQuoteValidityDays).optional() });

const adminStatus = z
  .object({ status: z.enum(["in_discussion", "rejected"]), note: text(500).optional() })
  .refine((v) => v.status !== "rejected" || (v.note && v.note.length >= 3), { message: "Please give the customer a reason", path: ["note"] });

const note = z.object({ note: z.string().trim().min(1, "Note cannot be empty").max(1000) });

const listQuery = z.object({
  status: z.enum(["all", "new", "in_discussion", "quotation_sent", "revision_requested", "counter_offered", "accepted", "booked", "rejected", "cancelled"]).optional(),
  search: z.string().trim().max(60).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

module.exports = { create, message, quotation, accept, revision, counter, cancel, decision, adminStatus, note, listQuery };
