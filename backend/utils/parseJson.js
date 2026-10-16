const { httpError } = require("./httpError");

// multipart/form-data can only carry text, so the admin forms send nested objects/arrays as JSON strings.
// JSON.parse on bad input would otherwise bubble up as an unhelpful 500.
const parseJsonField = (value, fieldName, fallback) => {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    throw httpError(400, `"${fieldName}" must be valid JSON`);
  }
};

// Whitelist copy - the antidote to `Model.create({ ...req.body })` mass-assignment.
const pick = (obj = {}, keys = []) =>
  keys.reduce((acc, k) => {
    if (obj[k] !== undefined) acc[k] = obj[k];
    return acc;
  }, {});

module.exports = { parseJsonField, pick };
