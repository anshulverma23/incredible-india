const { clean } = require("../../middlewares/security");
const { escapeRegex, safeRegex } = require("../../utils/escapeRegex");
const { parsePagination } = require("../../utils/pagination");
const { parseJsonField, pick } = require("../../utils/parseJson");
const { emailTemplates } = require("../../utils/emailTemplates");
const { detectImageType } = require("../../config/cloudinary");
const cache = require("../../utils/cache");

describe("input hardening", () => {
  test("strips html/script from nested strings", () => {
    const out = clean({ name: "<script>alert(1)</script>Asha", nested: { bio: '<img src=x onerror="hack()">hi' }, list: ["<b>x</b>"] });
    expect(JSON.stringify(out)).not.toMatch(/<[a-z]|onerror/i);
    expect(out.name).toBe("Asha");
  });
  test("regex special chars are escaped (no ReDoS / injection)", () => {
    expect(escapeRegex("(a+)+$")).toBe("\\(a\\+\\)\\+\\$");
    expect(safeRegex(".*").test("hello")).toBe(false);
  });
  test("pagination is capped", () => {
    expect(parsePagination({ page: "-3", limit: "100000" }, { maxLimit: 100 })).toEqual({ page: 1, limit: 100, skip: 0 });
    expect(parsePagination({ page: "3", limit: "10" })).toEqual({ page: 3, limit: 10, skip: 20 });
  });
  test("bad JSON in a multipart field is a 400, not a crash", () => {
    expect(() => parseJsonField("{oops", "tags", [])).toThrow(/valid JSON/);
    expect(parseJsonField('["a"]', "tags", [])).toEqual(["a"]);
  });
  test("pick() whitelists fields (mass-assignment guard)", () => {
    expect(pick({ name: "x", role: "admin", rating: 5 }, ["name"])).toEqual({ name: "x" });
  });
  test("emails escape user supplied values", () => {
    const html = emailTemplates.verifyEmail('<img src=x onerror=alert(1)>', "https://x.test/v/1");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });
  test("image magic-byte detection", () => {
    const jpg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(20)]);
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(20)]);
    const exe = Buffer.concat([Buffer.from("MZ"), Buffer.alloc(30)]);
    expect(detectImageType(jpg)).toBe("image/jpeg");
    expect(detectImageType(png)).toBe("image/png");
    expect(detectImageType(exe)).toBeNull();
  });
  test("cache set/get/invalidate", () => {
    cache.set("packages:/x", { a: 1 }, 60);
    expect(cache.get("packages:/x")).toEqual({ a: 1 });
    cache.invalidate("packages");
    expect(cache.get("packages:/x")).toBeUndefined();
  });
});
