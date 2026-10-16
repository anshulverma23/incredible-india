const { z } = require("zod");

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, "Invalid id");
const isoDate = z.coerce.date({ error: "Invalid or missing date" });

// Password policy: 8+ chars with at least one letter and one number
const password = z
  .string({ error: "Password is required" })
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password is too long")
  .regex(/[A-Za-z]/, "Password must contain a letter")
  .regex(/\d/, "Password must contain a number");

const email = z.string({ error: "Email is required" }).trim().toLowerCase().email("Invalid email address").max(120);

module.exports = { objectId, isoDate, password, email };

// z.coerce.boolean() treats the string "false" as true - this one doesn't.
const boolish = z.union([z.boolean(), z.enum(["true", "false"]).transform((v) => v === "true")]);
module.exports.boolish = boolish;
