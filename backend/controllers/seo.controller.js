const asyncHandler = require("express-async-handler");
const Destination = require("../models/destination.model");
const Hotel = require("../models/hotel.model");
const Package = require("../models/package.model");
const Blog = require("../models/blog.model");
const cache = require("../utils/cache");
const { env } = require("../config/env");

const CACHE_KEY = "seo:sitemap";
const CACHE_SECONDS = 600; // new hotels / packages show up in the sitemap within 10 minutes
const MAX_URLS_PER_TYPE = 10000; // sitemap limit is 50,000 urls per file

// [path, changefreq, priority] for pages that are not stored in the database.
const STATIC_PAGES = [
  ["/", "weekly", "1.0"],
  ["/destinations", "weekly", "0.8"],
  ["/hotels", "weekly", "0.8"],
  ["/packages", "weekly", "0.8"],
  ["/blog", "weekly", "0.6"],
  ["/plan-trip", "monthly", "0.6"],
  ["/about", "monthly", "0.4"],
  ["/faq", "monthly", "0.4"],
  ["/contact", "yearly", "0.4"],
];

const escapeXml = (value) =>
  String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

const dateOnly = (date) => (date ? new Date(date).toISOString().slice(0, 10) : null);

const entry = (base, path, { lastmod, changefreq, priority }) =>
  [
    "  <url>",
    `    <loc>${escapeXml(base + path)}</loc>`,
    lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    "  </url>",
  ]
    .filter(Boolean)
    .join("\n");

const hasSlug = { slug: { $exists: true, $nin: [null, ""] } };

const buildSitemap = async (base) => {
  const [destinations, hotels, packages, blogs] = await Promise.all([
    Destination.find({ isActive: true, ...hasSlug }).select("slug updatedAt").limit(MAX_URLS_PER_TYPE).lean(),
    Hotel.find({ isActive: true, ...hasSlug }).select("slug updatedAt").limit(MAX_URLS_PER_TYPE).lean(),
    Package.find({ isActive: true, ...hasSlug }).select("slug updatedAt").limit(MAX_URLS_PER_TYPE).lean(),
    Blog.find(hasSlug).select("slug updatedAt createdAt").limit(MAX_URLS_PER_TYPE).lean(),
  ]);

  const dynamic = (prefix, docs, changefreq, priority) =>
    docs.map((d) => entry(base, `${prefix}/${encodeURIComponent(d.slug)}`, { lastmod: dateOnly(d.updatedAt || d.createdAt), changefreq, priority }));

  const urls = [
    ...STATIC_PAGES.map(([path, changefreq, priority]) => entry(base, path === "/" ? "/" : path, { changefreq, priority })),
    ...dynamic("/destinations", destinations, "weekly", "0.7"),
    ...dynamic("/hotels", hotels, "weekly", "0.7"),
    ...dynamic("/packages", packages, "weekly", "0.9"),
    ...dynamic("/blog", blogs, "monthly", "0.5"),
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
};

// @desc    XML sitemap of every public page (static pages + destinations, hotels, packages, blog posts)
// @route   GET /api/seo/sitemap.xml
// @access  Public
const getSitemap = asyncHandler(async (req, res) => {
  let xml = cache.get(CACHE_KEY);
  if (!xml) {
    xml = await buildSitemap(env.FRONTEND_URL.replace(/\/+$/, ""));
    cache.set(CACHE_KEY, xml, CACHE_SECONDS);
  }
  res.set("Content-Type", "application/xml; charset=utf-8");
  res.set("Cache-Control", `public, max-age=${CACHE_SECONDS}`);
  res.status(200).send(xml);
});

module.exports = { getSitemap, buildSitemap, escapeXml };
