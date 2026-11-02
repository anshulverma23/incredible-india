const express = require("express");
const c = require("../controllers/enquiry.controller");
const { protect } = require("../middlewares/authMiddleware");
const { admin } = require("../middlewares/adminMiddleware");
const { validate } = require("../middlewares/validate");
const { spamLimiter } = require("../middlewares/rateLimiters");
const v = require("../validators/enquiry.validator");

const router = express.Router();
router.use(protect);

// Customer: start an enquiry (rate limited - anti spam)
router.post("/", spamLimiter, validate(v.create), c.create);
router.get("/my", c.listMine);

// Admin (declared BEFORE "/:id" so "admin" is not read as an id)
router.get("/admin", admin, validate(v.listQuery, "query"), c.adminList);
router.get("/admin/stats", admin, c.adminStats);
router.get("/admin/:id", admin, c.adminGet);
router.post("/admin/:id/messages", admin, validate(v.message), c.message);
router.post("/admin/:id/quotation", admin, validate(v.quotation), c.sendQuotation);
router.put("/admin/:id/counter-offer", admin, validate(v.decision), c.decideCounter);
router.put("/admin/:id/status", admin, validate(v.adminStatus), c.adminStatus);
router.post("/admin/:id/notes", admin, validate(v.note), c.addNote);

// Customer: own enquiry
router.get("/:id", c.getMine);
router.post("/:id/messages", validate(v.message), c.message);
router.put("/:id/accept", validate(v.accept), c.accept);
router.put("/:id/request-revision", validate(v.revision), c.requestRevision);
router.put("/:id/counter-offer", validate(v.counter), c.counterOffer);
router.put("/:id/cancel", validate(v.cancel), c.cancel);

module.exports = router;
