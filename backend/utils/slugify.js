// URL-friendly slugs for SEO (e.g. "Kashmir Paradise Tour" -> "kashmir-paradise-tour").
const MAX_SLUG_LENGTH = 80;
const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

/** Text -> lowercase, accent-free, hyphen separated. Returns "" when nothing usable is left. */
const slugify = (value = "") =>
  String(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, "");

/** True only for a real 24-char hex ObjectId (mongoose.isValidObjectId also accepts ANY 12-char string). */
const isObjectIdString = (value) => OBJECT_ID_RE.test(String(value));

/** Filter for routes that accept either a MongoDB id (old links) or a slug (SEO links). */
const idOrSlugFilter = (identifier) => {
  const value = String(identifier);
  return isObjectIdString(value) ? { _id: value } : { slug: value.toLowerCase() };
};

/**
 * Returns a slug that no other document of `Model` uses.
 * "kerala-tour" -> "kerala-tour-2" -> "kerala-tour-3" ...
 * `excludeId` lets a document keep its own slug when it is saved again.
 * `reserved` (optional Set) lets a batch job avoid duplicates before anything is written.
 */
const generateUniqueSlug = async (Model, source, { excludeId, fallback = "item", reserved } = {}) => {
  const base = slugify(source) || slugify(fallback) || "item";
  const taken = async (candidate) => {
    if (reserved && reserved.has(candidate)) return true; // slugs handed out earlier in the same batch
    const filter = { slug: candidate };
    if (excludeId) filter._id = { $ne: excludeId };
    return Boolean(await Model.exists(filter));
  };

  if (!(await taken(base))) return base;
  for (let n = 2; n <= 50; n += 1) {
    const candidate = `${base}-${n}`;
    if (!(await taken(candidate))) return candidate;
  }
  // Extremely unlikely: 50 packages with the same name. A random tail is always unique enough.
  return `${base}-${Date.now().toString(36)}`;
};

module.exports = { slugify, isObjectIdString, idOrSlugFilter, generateUniqueSlug, MAX_SLUG_LENGTH };
