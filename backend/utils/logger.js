const path = require("path");
const winston = require("winston");
require("winston-daily-rotate-file");
const { env } = require("../config/env");

const { combine, timestamp, errors, json, colorize, printf } = winston.format;

const devFormat = combine(
  colorize(),
  timestamp({ format: "HH:mm:ss" }),
  errors({ stack: true }),
  printf(({ level, message, timestamp: ts, stack, ...meta }) => {
    const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
    return `${ts} ${level}: ${stack || message}${extra}`;
  })
);

const transports = [
  new winston.transports.Console({
    format: env.isProd ? combine(timestamp(), errors({ stack: true }), json()) : devFormat,
    silent: env.isTest,
  }),
];

if (env.LOG_TO_FILES) {
  const dir = path.join(__dirname, "..", "logs");
  const fileFormat = combine(timestamp(), errors({ stack: true }), json());
  transports.push(
    new winston.transports.DailyRotateFile({
      dirname: dir,
      filename: "app-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      maxFiles: "14d",
      maxSize: "20m",
      format: fileFormat,
    }),
    new winston.transports.DailyRotateFile({
      dirname: dir,
      filename: "error-%DATE%.log",
      level: "error",
      datePattern: "YYYY-MM-DD",
      maxFiles: "30d",
      maxSize: "20m",
      format: fileFormat,
    })
  );
}

const logger = winston.createLogger({ level: env.LOG_LEVEL, transports, exitOnError: false });

// Stream for morgan -> winston
logger.stream = { write: (msg) => logger.http(msg.trim()) };

// Domain-specific helpers so failed payments / auth failures are easy to grep & alert on.
logger.payment = (message, meta = {}) => logger.warn(message, { category: "payment", ...meta });
logger.auth = (message, meta = {}) => logger.warn(message, { category: "auth", ...meta });

module.exports = logger;
