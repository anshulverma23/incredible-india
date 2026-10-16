const express = require("express");

const {
  getBlogs,
  getBlogBySlug,
  createBlog,
  updateBlog,
  deleteBlog,
} = require("../controllers/blog.controller.js");

const { protect } = require("../middlewares/authMiddleware");
const { admin } = require("../middlewares/adminMiddleware");
const { makeUploader } = require("../config/cloudinary");

const router = express.Router();

const uploadBlogImages = makeUploader("blogs");

// =========================
// PUBLIC ROUTES
// =========================

// GET all blogs
router.get("/", getBlogs);

// GET single blog by slug
router.get("/:slug", getBlogBySlug);

// =========================
// ADMIN ROUTES
// =========================

// CREATE blog
router.post(
  "/",
  protect,
  admin,
  uploadBlogImages.array("images", 8),
  createBlog
);

// UPDATE blog
router.put(
  "/:id",
  protect,
  admin,
  uploadBlogImages.array("images", 8),
  updateBlog
);

// DELETE blog
router.delete(
  "/:id",
  protect,
  admin,
  deleteBlog
);

module.exports = router;