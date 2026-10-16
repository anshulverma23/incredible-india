const xss = require("xss");

// No tag is allowed; <script>/<style> are removed together with their contents.
const stripper = new xss.FilterXSS({ whiteList: {}, stripIgnoreTag: true, stripIgnoreTagBody: ["script", "style"] });

// Strips ALL html tags/attributes from every string in req.body (stored-XSS protection).
// Rich text isn't used anywhere in this API, so plain text only.
const clean = (value) => {
  if (typeof value === "string") {
    return stripper.process(value).replace(/&amp;/g, "&").trim(); // never turn &lt; back into < (would re-open the door to tags)
  }
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, clean(v)]));
  }
  return value;
};

const xssSanitize = (req, res, next) => {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) req.body = clean(req.body);
  next();
};

module.exports = { xssSanitize, clean };
