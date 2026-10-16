const { z } = require("zod");
const { objectId } = require("./common");

const create = z.object({
  bookingId: objectId,
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().min(5, "Please write at least a few words").max(1500),
});

const update = z.object({
  rating: z.coerce.number().int().min(1).max(5).optional(),
  comment: z.string().trim().min(5).max(1500).optional(),
});

const eligibility = z.object({ targetType: z.enum(["hotel", "package"]), targetId: objectId });

module.exports = { create, update, eligibility };
