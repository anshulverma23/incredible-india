const express = require("express");
const { sendContactMessage } = require("../controllers/contact.controller");
const { validate } = require("../middlewares/validate");
const { spamLimiter } = require("../middlewares/rateLimiters");
const { contact } = require("../validators/misc.validator");

const router = express.Router();
router.post("/", spamLimiter, validate(contact), sendContactMessage);

module.exports = router;
