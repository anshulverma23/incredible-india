const express = require("express");
const { getFAQs, getFAQById, createFAQ, updateFAQ, deleteFAQ } = require("../controllers/faq.controller");
const { protect } = require("../middlewares/authMiddleware");
const { admin } = require("../middlewares/adminMiddleware");

const router = express.Router();

// Public
router.get("/", getFAQs);
router.get("/:id", getFAQById);

// Admin only (previously any logged-in user could create/edit/delete FAQs)
router.post("/", protect, admin, createFAQ);
router.put("/:id", protect, admin, updateFAQ);
router.delete("/:id", protect, admin, deleteFAQ);

module.exports = router;
