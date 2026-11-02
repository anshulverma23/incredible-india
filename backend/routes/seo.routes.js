const express = require("express");
const { getSitemap, getSharePage } = require("../controllers/seo.controller");

const router = express.Router();

router.get("/sitemap.xml", getSitemap);
router.get("/share/:type/:slug", getSharePage);

module.exports = router;
