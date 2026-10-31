const request = require("supertest");
const app = require("../../app");
const Destination = require("../../models/destination.model");
const Hotel = require("../../models/hotel.model");
const Package = require("../../models/package.model");
const Blog = require("../../models/blog.model");
const cache = require("../../utils/cache");
const { env } = require("../../config/env");
const { escapeXml } = require("../../controllers/seo.controller");
const { chain } = require("../api/helpers");

beforeEach(() => cache.clear());
afterEach(() => jest.restoreAllMocks());

const mockAll = ({ destinations = [], hotels = [], packages = [], blogs = [] } = {}) => {
  jest.spyOn(Destination, "find").mockReturnValue(chain(destinations));
  jest.spyOn(Hotel, "find").mockReturnValue(chain(hotels));
  jest.spyOn(Package, "find").mockReturnValue(chain(packages));
  jest.spyOn(Blog, "find").mockReturnValue(chain(blogs));
};

describe("GET /api/seo/sitemap.xml", () => {
  test("returns XML with static pages and slug URLs on the frontend domain", async () => {
    mockAll({
      destinations: [{ slug: "kashmir", updatedAt: new Date("2026-01-02") }],
      hotels: [{ slug: "taj-lake-palace", updatedAt: new Date("2026-02-03") }],
      packages: [{ slug: "kashmir-5d-4n", updatedAt: new Date("2026-03-04") }],
      blogs: [{ slug: "best-time-to-visit", createdAt: new Date("2026-04-05") }],
    });

    const res = await request(app).get("/api/seo/sitemap.xml");
    const base = env.FRONTEND_URL.replace(/\/+$/, "");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/application\/xml/);
    expect(res.text).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(res.text).toContain(`<loc>${base}/</loc>`);
    expect(res.text).toContain(`<loc>${base}/hotels</loc>`);
    expect(res.text).toContain(`<loc>${base}/destinations/kashmir</loc>`);
    expect(res.text).toContain(`<loc>${base}/hotels/taj-lake-palace</loc>`);
    expect(res.text).toContain(`<loc>${base}/packages/kashmir-5d-4n</loc>`);
    expect(res.text).toContain(`<loc>${base}/blog/best-time-to-visit</loc>`);
    expect(res.text).toContain("<lastmod>2026-03-04</lastmod>");
    // private pages must never be listed
    expect(res.text).not.toMatch(/\/admin|\/login|\/checkout|\/bookings/);
  });

  test("only active items with a slug are queried", async () => {
    mockAll();
    await request(app).get("/api/seo/sitemap.xml");
    const filter = Hotel.find.mock.calls[0][0];
    expect(filter.isActive).toBe(true);
    expect(filter.slug).toEqual({ $exists: true, $nin: [null, ""] });
  });

  test("second request is served from cache (no extra DB queries)", async () => {
    mockAll();
    await request(app).get("/api/seo/sitemap.xml");
    await request(app).get("/api/seo/sitemap.xml");
    expect(Hotel.find).toHaveBeenCalledTimes(1);
  });
});

describe("escapeXml", () => {
  test("escapes characters that would break the XML", () => {
    expect(escapeXml(`a&b<c>"d"'e'`)).toBe("a&amp;b&lt;c&gt;&quot;d&quot;&apos;e&apos;");
  });
});
