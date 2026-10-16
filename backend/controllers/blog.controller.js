const Blog = require("../models/blog.model.js");
const { parseArrayField, PARAGRAPH_SPLIT, COMMA_SPLIT } = require("../utils/parseArrayField");

// =========================
// GET ALL BLOG POSTS
// GET /api/blogs
// =========================
const getBlogs = async (req, res) => {
  try {
    const blogs = await Blog.find().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: blogs.length,
      blogs,
    });
  } catch (error) {
    console.error("Get blogs error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch blogs",
    });
  }
};

// =========================
// GET SINGLE BLOG BY SLUG
// GET /api/blogs/:slug
// =========================
const getBlogBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const blog = await Blog.findOne({ slug });

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog post not found",
      });
    }

    res.status(200).json({
      success: true,
      blog,
    });
  } catch (error) {
    console.error("Get blog error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch blog",
    });
  }
};

// =========================
// CREATE BLOG
// POST /api/blogs
// =========================
const createBlog = async (req, res) => {
  try {
    const { slug, title, excerpt, author, date, image } = req.body;

    // content / tags come from multipart form-data as JSON text - parse them into real arrays
    const content = parseArrayField(req.body.content, PARAGRAPH_SPLIT) || [];
    const tags = parseArrayField(req.body.tags, COMMA_SPLIT) || [];

    if (!slug || !title || !excerpt || !author || !date || !image || content.length === 0) {
      return res.status(400).json({
        success: false,
        message: "slug, title, excerpt, content, author, date and image are required",
      });
    }

    const existingBlog = await Blog.findOne({ slug });

    if (existingBlog) {
      return res.status(409).json({
        success: false,
        message: "Blog with this slug already exists",
      });
    }

    const blog = await Blog.create({
      slug,
      title,
      excerpt,
      content,
      author,
      date,
      image,
      tags,
    });

    res.status(201).json({
      success: true,
      message: "Blog created successfully",
      blog,
    });
  } catch (error) {
    console.error("Create blog error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create blog",
    });
  }
};

// =========================
// UPDATE BLOG
// PUT /api/blogs/:id
// =========================
const updateBlog = async (req, res) => {
  try {
    const { id } = req.params;

    // Only allow known fields, and turn content / tags into real arrays (see parseArrayField)
    const updates = {};
    for (const field of ["slug", "title", "excerpt", "author", "date", "image"]) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }
    const content = parseArrayField(req.body.content, PARAGRAPH_SPLIT);
    const tags = parseArrayField(req.body.tags, COMMA_SPLIT);
    if (content !== undefined) updates.content = content;
    if (tags !== undefined) updates.tags = tags;

    const blog = await Blog.findByIdAndUpdate(
      id,
      updates,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog post not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Blog updated successfully",
      blog,
    });
  } catch (error) {
    console.error("Update blog error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update blog",
    });
  }
};

// =========================
// DELETE BLOG
// DELETE /api/blogs/:id
// =========================
const deleteBlog = async (req, res) => {
  try {
    const { id } = req.params;

    const blog = await Blog.findByIdAndDelete(id);

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog post not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Blog deleted successfully",
    });
  } catch (error) {
    console.error("Delete blog error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to delete blog",
    });
  }
};

// =========================
// EXPORT
// =========================
module.exports = {
  getBlogs,
  getBlogBySlug,
  createBlog,
  updateBlog,
  deleteBlog,
};