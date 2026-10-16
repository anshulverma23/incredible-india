const asyncHandler = require("express-async-handler");
const FAQ = require("../models/faq.model");

// @desc    Get all active FAQs
// @route   GET /api/faqs
// @access  Public
const getFAQs = asyncHandler(async (req, res) => {
  const { category } = req.query;

  const filter = {
    isActive: true,
  };

  if (category) {
    filter.category = category;
  }

  const faqs = await FAQ.find(filter)
    .sort({ order: 1, createdAt: 1 })
    .lean();

  res.status(200).json({
    success: true,
    count: faqs.length,
    faqs,
  });
});

// @desc    Get single FAQ
// @route   GET /api/faqs/:id
// @access  Public
const getFAQById = asyncHandler(async (req, res) => {
  const faq = await FAQ.findById(req.params.id);

  if (!faq) {
    res.status(404);
    throw new Error("FAQ not found");
  }

  res.status(200).json({
    success: true,
    faq,
  });
});

// @desc    Create FAQ
// @route   POST /api/faqs
// @access  Private/Admin
const createFAQ = asyncHandler(async (req, res) => {
  const {
    question,
    answer,
    category,
    isActive,
    order,
  } = req.body;

  if (!question || !answer) {
    res.status(400);
    throw new Error("Question and answer are required");
  }

  const faq = await FAQ.create({
    question,
    answer,
    category,
    isActive,
    order,
  });

  res.status(201).json({
    success: true,
    message: "FAQ created successfully",
    faq,
  });
});

// @desc    Update FAQ
// @route   PUT /api/faqs/:id
// @access  Private/Admin
const updateFAQ = asyncHandler(async (req, res) => {
  const faq = await FAQ.findById(req.params.id);

  if (!faq) {
    res.status(404);
    throw new Error("FAQ not found");
  }

  const {
    question,
    answer,
    category,
    isActive,
    order,
  } = req.body;

  if (question !== undefined) {
    faq.question = question;
  }

  if (answer !== undefined) {
    faq.answer = answer;
  }

  if (category !== undefined) {
    faq.category = category;
  }

  if (isActive !== undefined) {
    faq.isActive = isActive;
  }

  if (order !== undefined) {
    faq.order = order;
  }

  const updatedFAQ = await faq.save();

  res.status(200).json({
    success: true,
    message: "FAQ updated successfully",
    faq: updatedFAQ,
  });
});

// @desc    Delete FAQ
// @route   DELETE /api/faqs/:id
// @access  Private/Admin
const deleteFAQ = asyncHandler(async (req, res) => {
  const faq = await FAQ.findById(req.params.id);

  if (!faq) {
    res.status(404);
    throw new Error("FAQ not found");
  }

  await faq.deleteOne();

  res.status(200).json({
    success: true,
    message: "FAQ deleted successfully",
  });
});

module.exports = {
  getFAQs,
  getFAQById,
  createFAQ,
  updateFAQ,
  deleteFAQ,
};