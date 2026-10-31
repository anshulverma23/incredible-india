const express = require("express");
const { getSitemap } = require("../controllers/seo.controller");

const router = express.Router();

router.get("/sitemap.xml", getSitemap);

module.exports = router;
