// zod request validation: validate(schema) or validate(schema, "query" | "params").
// Replaces req[source] with the parsed (trimmed / coerced / defaulted) value.
const validate =
  (schema, source = "body") =>
  (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const issues = result.error.issues.map((i) => `${i.path.join(".") || source}: ${i.message}`);
      res.status(400);
      return next(Object.assign(new Error(issues.join("; ")), { details: issues }));
    }
    // req.query is a getter in newer Express versions, so define instead of assign
    Object.defineProperty(req, source, { value: result.data, writable: true, configurable: true });
    next();
  };

module.exports = { validate };
