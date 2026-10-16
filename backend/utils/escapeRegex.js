// Escapes user input before it goes into new RegExp(...) - prevents regex injection / ReDoS.
const escapeRegex = (str = "") => String(str).slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const safeRegex = (str, flags = "i") => new RegExp(escapeRegex(str), flags);
module.exports = { escapeRegex, safeRegex };
