const crypto = require("crypto");

// Unambiguous alphabet (no 0/O/1/I) so references are easy to read out over the phone.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const randomChars = (len) => {
  const bytes = crypto.randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
};

// e.g. "IT-250607-K7M2QX" (IT-YYMMDD-XXXXXX). Uniqueness is enforced by a unique index; callers retry on collision.
const generateBookingReference = (date = new Date()) => {
  const yy = String(date.getUTCFullYear()).slice(-2);
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `IT-${yy}${mm}${dd}-${randomChars(6)}`;
};

module.exports = { generateBookingReference };
