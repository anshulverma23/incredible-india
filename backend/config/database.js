const mongoose = require("mongoose");
const { env } = require("./env");
const logger = require("../utils/logger");

mongoose.set("strictQuery", true);

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(env.MONGO_URI, {
      maxPoolSize: 20,
      serverSelectionTimeoutMS: 10_000,
      // In production indexes are built by `npm run seed` / on first deploy; auto-index keeps dev + small apps simple.
      autoIndex: !env.isProd || process.env.AUTO_INDEX === "true",
    });
    logger.info(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    logger.error(`MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
