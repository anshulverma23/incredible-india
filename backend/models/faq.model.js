const mongoose = require("mongoose");

const faqSchema = new mongoose.Schema(
  {
    question: {
      type: String,
      required: [true, "Question is required"],
      trim: true,
    },

    answer: {
      type: String,
      required: [true, "Answer is required"],
      trim: true,
    },

    category: {
      type: String,
      trim: true,
      default: "General",
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    order: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("FAQ", faqSchema);