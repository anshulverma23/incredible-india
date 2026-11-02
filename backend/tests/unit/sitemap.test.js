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

describe("GET /api/seo/share/:type/:slug (social crawlers)", () => {
  const base = () => env.FRONTEND_URL.replace(/\/+$/, "");

  test("hotel share page carries the hotel's own title, description and photo", async () => {
    jest.spyOn(Hotel, "findOne").mockReturnValue(
      chain({ name: "Taj Lake Palace", slug: "taj-lake-palace", description: "A floating palace on Lake Pichola.", images: [{ url: "https://res.cloudinary.com/x/taj.jpg" }], location: { city: "Udaipur" } })
    );
    const res = await request(app).get("/api/seo/share/hotels/taj-lake-palace");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/html/);
    expect(res.text).toContain('<meta property="og:title" content="Taj Lake Palace, Udaipur | Incredible India Travel">');
    expect(res.text).toContain('<meta property="og:image" content="https://res.cloudinary.com/x/taj.jpg">');
    expect(res.text).toContain(`<meta property="og:url" content="${base()}/hotels/taj-lake-palace">`);
    expect(res.text).toContain('name="twitter:card" content="summary_large_image"');
  });

  test("falls back to the default share image when the item has no photo", async () => {
    jest.spyOn(Destination, "findOne").mockReturnValue(chain({ name: "Kashmir", slug: "kashmir", description: "Valley of saffron.", gallery: [] }));
    const res = await request(app).get("/api/seo/share/destinations/kashmir");
    expect(res.text).toContain(`content="${base()}/images/og-default.jpg"`);
  });

  test("unknown item or bad input redirects to the site instead of erroring", async () => {
    jest.spyOn(Package, "findOne").mockReturnValue(chain(null));
    const missing = await request(app).get("/api/seo/share/packages/nope");
    expect(missing.status).toBe(302);

    const badType = await request(app).get("/api/seo/share/admin/x");
    expect(badType.status).toBe(302);
  });

  test("html in titles is escaped", async () => {
    jest.spyOn(Blog, "findOne").mockReturnValue(chain({ title: 'A "<b>bold</b>" trip', slug: "a-trip", excerpt: "x", image: "" }));
    const res = await request(app).get("/api/seo/share/blog/a-trip");
    expect(res.text).not.toContain("<b>bold</b>");
    expect(res.text).toContain("&lt;b&gt;bold&lt;/b&gt;");
  });
});
