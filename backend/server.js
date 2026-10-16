const http = require("http");
const mongoose = require("mongoose");
const { env, validateEnv } = require("./config/env");
const logger = require("./utils/logger");

validateEnv(); // fail fast on missing secrets

const connectDB = require("./config/database");
const app = require("./app");
const { initSocket, closeSocket } = require("./utils/socket");
const { startJobs } = require("./jobs");

let server;
let stopJobs = () => {};

const start = async () => {
  await connectDB();

  server = http.createServer(app);
  initSocket(server); // real-time notifications
  if (env.ENABLE_JOBS) stopJobs = startJobs();

  server.listen(env.PORT, () => logger.info(`Server running in ${env.NODE_ENV} mode on port ${env.PORT}`));
};

// Graceful shutdown: stop accepting requests, let in-flight ones finish, close the DB.
const shutdown = (signal) => {
  logger.info(`${signal} received, shutting down gracefully`);
  stopJobs();
  closeSocket();
  const force = setTimeout(() => process.exit(1), 10_000);
  force.unref();
  server?.close(async () => {
    await mongoose.connection.close(false);
    process.exit(0);
  });
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => logger.error(`Unhandled rejection: ${reason?.stack || reason}`));
process.on("uncaughtException", (err) => {
  logger.error(`Uncaught exception: ${err.stack}`);
  process.exit(1);
});

start();
