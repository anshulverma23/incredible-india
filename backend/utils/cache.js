// Tiny in-memory TTL cache for hot, public, read-mostly endpoints (destinations, packages, hotels).
// Single-instance only. To scale horizontally, swap the Map for Redis - the get/set/invalidate API stays the same.
const store = new Map();
const MAX_ENTRIES = 500;

const get = (key) => {
  const hit = store.get(key);
  if (!hit) return undefined;
  if (hit.expires < Date.now()) {
    store.delete(key);
    return undefined;
  }
  return hit.value;
};

const set = (key, value, ttlSeconds = 60) => {
  if (store.size >= MAX_ENTRIES) store.delete(store.keys().next().value); // evict oldest
  store.set(key, { value, expires: Date.now() + ttlSeconds * 1000 });
};

// Drops every key that starts with the prefix, e.g. invalidate("packages:") after an admin edit.
const invalidate = (prefix = "") => {
  for (const key of store.keys()) if (key.startsWith(prefix)) store.delete(key);
};

const clear = () => store.clear();

/** Express middleware: caches successful JSON GET responses for `ttl` seconds, keyed by URL. */
const cacheResponse = (prefix, ttl = 60) => (req, res, next) => {
  if (req.method !== "GET") return next();
  const key = `${prefix}:${req.originalUrl}`;
  const cached = get(key);
  if (cached) {
    res.set("X-Cache", "HIT");
    return res.status(200).json(cached);
  }
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode === 200) set(key, body, ttl);
    res.set("X-Cache", "MISS");
    return originalJson(body);
  };
  next();
};

module.exports = { get, set, invalidate, clear, cacheResponse };
