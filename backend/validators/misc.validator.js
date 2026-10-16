const { z } = require("zod");
const { objectId, email } = require("./common");

const contact = z.object({
  name: z.string().trim().min(2).max(80),
  email,
  subject: z.string().trim().max(120).optional(),
  message: z.string().trim().min(10, "Message must be at least 10 characters").max(3000),
});

const itinerary = z.object({
  destination: z.string().trim().min(2, "Tell us where you want to go").max(80),
  days: z.coerce.number().int().min(1).max(15),
  budget: z.coerce.number().int().min(1000, "Budget must be at least Rs. 1,000").max(10_000_000),
  travellers: z.coerce.number().int().min(1).max(20).default(1),
  interests: z
    .union([z.array(z.string().trim().max(30)), z.string().transform((s) => s.split(",").map((x) => x.trim()))])
    .transform((a) => a.filter(Boolean).slice(0, 8))
    .default([]),
  pace: z.enum(["relaxed", "balanced", "packed"]).default("balanced"),
});

const saveItinerary = z.object({ title: z.string().trim().min(2).max(100).optional(), input: itinerary, plan: z.any() });

const wishlistAdd = z.object({ itemType: z.enum(["Destination", "Hotel", "Package"]), itemId: objectId });

const adminUserUpdate = z.object({
  role: z.enum(["user", "admin"]).optional(),
  isActive: z.boolean().optional(),
});

module.exports = { contact, itinerary, saveItinerary, wishlistAdd, adminUserUpdate };
