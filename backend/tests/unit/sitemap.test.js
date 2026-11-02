const request = require("supertest");
const app = require("../../app");
const Destination = require("../../models/destination.model");
const Hotel = require("../../models/hotel.model");
const Package = require("../../models/package.model");
const Blog = require("../../models/blog.model");
const cache = require("../../utils/cache");
const { env } = require("../../config/env");
const { escapeXml, resetTemplateCache } = require("../../controllers/seo.controller");
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

describe("GET /api/seo/page (real <head> in the HTML source)", () => {
  const TEMPLATE = `<!doctype html><html><head>
    <meta name="description" content="default" />
    <meta property="og:title" content="Incredible India Travel" />
    <meta property="og:url" content="/" />
    <meta property="og:image" content="/images/og-default.jpg" />
    <meta name="twitter:title" content="Incredible India Travel" />
    <title>Incredible India Travel</title>
    <script type="module" src="/assets/index-abc.js"></script>
  </head><body><div id="root"></div></body></html>`;
  const mockFrontend = (ok = true) =>
    jest.spyOn(global, "fetch").mockResolvedValue({ ok, status: ok ? 200 : 500, text: async () => (ok ? TEMPLATE : "") });

  beforeEach(() => resetTemplateCache());

  test("hotel page gets its own title, description, canonical and photo; the app scripts are untouched", async () => {
    mockFrontend();
    jest.spyOn(Hotel, "findOne").mockReturnValue(
      chain({ name: "Taj Lake Palace", slug: "taj-lake-palace", description: "A floating palace.", images: [{ url: "https://res.cloudinary.com/x/taj.jpg" }], location: { city: "Udaipur" } })
    );
    const res = await request(app).get("/api/seo/page").query({ path: "/hotels/taj-lake-palace" });

    expect(res.status).toBe(200);
    expect(res.text).toContain("<title>Taj Lake Palace, Udaipur | Incredible India Travel</title>");
    expect(res.text).toContain('<meta name="description" content="A floating palace." />');
    expect(res.text).toContain('<meta property="og:image" content="https://res.cloudinary.com/x/taj.jpg" />');
    expect(res.text).toContain('<link rel="canonical" href="' + env.FRONTEND_URL.replace(/\/+$/, "") + '/hotels/taj-lake-palace" />');
    expect(res.text).toContain('<meta property="og:type" content="website" />'); // tag was missing in the template: added
    expect(res.text).toContain('<script type="module" src="/assets/index-abc.js"></script>');
    expect(res.text).toContain('<div id="root"></div>');
    expect(res.text).not.toContain("<title>Incredible India Travel</title>");
  });

  test("static pages (about, hotels list...) get their own title too", async () => {
    mockFrontend();
    const res = await request(app).get("/api/seo/page").query({ path: "/about/" });
    expect(res.text).toContain("<title>About Us | Incredible India Travel</title>");
  });

  test("does not send the API's Content-Security-Policy (it would break the site)", async () => {
    mockFrontend();
    const res = await request(app).get("/api/seo/page").query({ path: "/faq" });
    expect(res.headers["content-security-policy"]).toBeUndefined();
    expect(res.headers["content-type"]).toMatch(/text\/html/);
  });

  test("unknown item or page returns the plain app instead of an error", async () => {
    mockFrontend();
    jest.spyOn(Hotel, "findOne").mockReturnValue(chain(null));
    const res = await request(app).get("/api/seo/page").query({ path: "/hotels/does-not-exist" });
    expect(res.status).toBe(200);
    expect(res.text).toContain("<title>Incredible India Travel</title>");
  });

  test("injected text is HTML-escaped", async () => {
    mockFrontend();
    jest.spyOn(Blog, "findOne").mockReturnValue(chain({ title: 'x"><script>alert(1)</script>', slug: "evil", excerpt: "e", image: "" }));
    const res = await request(app).get("/api/seo/page").query({ path: "/blog/evil" });
    expect(res.text).not.toContain("<script>alert(1)</script>");
  });

  test("502 when the frontend cannot be reached and nothing is cached", async () => {
    jest.spyOn(global, "fetch").mockRejectedValue(new Error("down"));
    const res = await request(app).get("/api/seo/page").query({ path: "/faq" });
    expect(res.status).toBe(502);
  });
});
