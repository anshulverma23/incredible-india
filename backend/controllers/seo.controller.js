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

// ---------------------------------------------------------------------------
// Share pages: the frontend is a single-page app, so WhatsApp / Facebook / X / LinkedIn
// crawlers (which do not run JavaScript) would only ever see the default tags. The host
// (Vercel rewrite / nginx) sends those crawlers here and we answer with a tiny HTML page
// that carries the page's own title, description and photo. Real visitors never see it.
// ---------------------------------------------------------------------------
const SITE_NAME = "Incredible India Travel";
const DEFAULT_DESCRIPTION = "Plan your India trip: hand-picked destinations, hotels and travel packages, with online booking.";
const DEFAULT_IMAGE = "/images/og-default.jpg";
const SLUG_OR_ID = /^[a-z0-9][a-z0-9-]{0,200}$/i;

const escapeHtml = (value) => escapeXml(value);

const truncate = (text, max = 155) => {
  const clean = String(text || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const at = cut.lastIndexOf(" ");
  return `${cut.slice(0, at > 60 ? at : cut.length).replace(/[,.;:\s-]+$/, "")}…`;
};

const isObjectId = (v) => /^[a-f\d]{24}$/i.test(v);

// type in the URL -> how to find the document and which fields hold its title / text / photo
const SHARE_TYPES = {
  hotels: {
    model: Hotel,
    active: true,
    fields: "name slug description images location.city",
    title: (d) => `${d.name}${d.location?.city ? `, ${d.location.city}` : ""} | ${SITE_NAME}`,
    text: (d) => d.description,
    image: (d) => d.images?.[0]?.url,
  },
  packages: {
    model: Package,
    active: true,
    fields: "name slug description gallery duration",
    title: (d) => `${d.name}${d.duration ? ` - ${d.duration.days}D/${d.duration.nights}N Tour Package` : ""} | ${SITE_NAME}`,
    text: (d) => d.description,
    image: (d) => d.gallery?.[0]?.url,
  },
  destinations: {
    model: Destination,
    active: true,
    fields: "name slug description gallery",
    title: (d) => `${d.name} Travel Guide - Hotels & Packages | ${SITE_NAME}`,
    text: (d) => d.description,
    image: (d) => d.gallery?.[0]?.url,
  },
  blog: {
    model: Blog,
    active: false,
    fields: "title slug excerpt image",
    title: (d) => `${d.title} | ${SITE_NAME}`,
    text: (d) => d.excerpt,
    image: (d) => d.image,
    ogType: "article",
  },
};

const renderSharePage = ({ title, description, url, image, ogType = "website" }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${escapeHtml(url)}">
<meta property="og:site_name" content="${escapeHtml(SITE_NAME)}">
<meta property="og:type" content="${ogType}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${escapeHtml(url)}">
<meta property="og:image" content="${escapeHtml(image)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${escapeHtml(image)}">
<script>location.replace(${JSON.stringify(url).replace(/</g, "\\u003c")});</script>
</head>
<body><a href="${escapeHtml(url)}">${escapeHtml(title)}</a></body>
</html>
`;

// @desc    Social-share HTML (title / description / photo) for one public page, for crawlers that do not run JavaScript
// @route   GET /api/seo/share/:type/:slug      (type = hotels | packages | destinations | blog)
// @access  Public
const getSharePage = asyncHandler(async (req, res) => {
  const base = env.FRONTEND_URL.replace(/\/+$/, "");
  const { type, slug } = req.params;
  const config = SHARE_TYPES[type];
  const fallback = () => res.redirect(302, `${base}${config ? `/${type}` : "/"}`);

  if (!config || !SLUG_OR_ID.test(slug)) return fallback();

  const cacheKey = `seo:share:${type}:${slug}`;
  let html = cache.get(cacheKey);
  if (!html) {
    const filter = { ...(config.active && { isActive: true }), ...(isObjectId(slug) ? { _id: slug } : { slug: slug.toLowerCase() }) };
    const doc = await config.model.findOne(filter).select(config.fields).lean();
    if (!doc) return fallback();

    const image = config.image(doc);
    html = renderSharePage({
      title: config.title(doc),
      description: truncate(config.text(doc)) || DEFAULT_DESCRIPTION,
      url: `${base}/${type}/${encodeURIComponent(doc.slug || slug)}`,
      image: image ? (/^https?:\/\//i.test(image) ? image : `${base}${image}`) : `${base}${DEFAULT_IMAGE}`,
      ogType: config.ogType,
    });
    cache.set(cacheKey, html, CACHE_SECONDS);
  }

  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", `public, max-age=${CACHE_SECONDS}`);
  res.status(200).send(html);
});

module.exports = { getSitemap, getSharePage, buildSitemap, escapeXml };
