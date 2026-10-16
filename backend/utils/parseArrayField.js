// Normalises a "list of strings" field that may arrive in several shapes.
//
// Why this exists: the admin form posts multipart/form-data, and multipart can only carry text.
// The frontend sends arrays as JSON text (e.g. '["India","Travel"]'). If that string is stored as-is,
// Mongoose wraps it into a one-element array and the page shows stray [ ] " \ characters.
//
// Handles: real arrays, JSON strings, double-encoded JSON, a one-element array that holds JSON
// (data already corrupted in the DB), repeated form fields, and plain text.
//
//   parseArrayField('["a","b"]')            -> ["a","b"]
//   parseArrayField(['["a","b"]'])          -> ["a","b"]
//   parseArrayField("a, b", /,/)            -> ["a","b"]
//   parseArrayField("p1\n\np2", /\n\s*\n/)  -> ["p1","p2"]
//   parseArrayField(undefined)              -> undefined   (field not sent - caller keeps old value)
const looksLikeJson = (s) => {
  const t = s.trim();
  return (t.startsWith("[") && t.endsWith("]")) || (t.startsWith('"') && t.endsWith('"'));
};

const parseArrayField = (value, plainTextSplitter = null) => {
  if (value === undefined || value === null) return undefined;

  let result = value;

  // Peel off up to 3 layers of JSON encoding.
  for (let i = 0; i < 3; i++) {
    if (Array.isArray(result) && result.length === 1 && typeof result[0] === "string" && looksLikeJson(result[0])) {
      result = result[0];
    }
    if (typeof result === "string" && looksLikeJson(result)) {
      try {
        result = JSON.parse(result.trim());
        continue;
      } catch {
        /* not valid JSON - treat it as plain text below */
      }
    }
    break;
  }

  let items;
  if (Array.isArray(result)) {
    items = result;
  } else if (typeof result === "string" && plainTextSplitter) {
    items = result.split(plainTextSplitter);
  } else {
    items = [result];
  }

  return items
    .map((item) => (typeof item === "string" ? item : String(item ?? "")).trim())
    .filter(Boolean);
};

const PARAGRAPH_SPLIT = /\r?\n\s*\r?\n/;
const COMMA_SPLIT = /,/;

module.exports = { parseArrayField, PARAGRAPH_SPLIT, COMMA_SPLIT };