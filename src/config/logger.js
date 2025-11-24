const winston = require("winston");
const DailyRotateFile = require("winston-daily-rotate-file");
const path = require("path");

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  sql: 4,
  debug: 5,
};

// Define colors for each level
const colors = {
  error: "red",
  warn: "yellow",
  info: "green",
  http: "magenta",
  sql: "cyan",
  debug: "white",
};

winston.addColors(colors);

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.printf((info) => {
    const { timestamp, level, message, ...meta } = info;
    let log = `${timestamp} [${level}]: ${message}`;

    if (Object.keys(meta).length > 0) {
      const filteredMeta = Object.fromEntries(
        Object.entries(meta).filter(([_, v]) => {
          if (typeof v === "object" && v !== null) {
            return Object.keys(v).length > 0;
          }
          return true;
        })
      );

      if (Object.keys(filteredMeta).length > 0) {
        log += `\n${JSON.stringify(filteredMeta, null, 2)}`;
      }
    }

    return log;
  })
);

const logsDir = path.join(__dirname, "../../logs");

const transports = [
  new winston.transports.Console({
    format: consoleFormat,
    level: process.env.NODE_ENV === "production" ? "info" : "debug",
  }),
];

// File transports
if (
  process.env.NODE_ENV === "production" ||
  process.env.ENABLE_FILE_LOGGING === "true"
) {
  transports.push(
    new DailyRotateFile({
      filename: path.join(logsDir, "error-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      level: "error",
      format: logFormat,
      maxSize: "20m",
      maxFiles: "14d",
      zippedArchive: true,
    })
  );

  transports.push(
    new DailyRotateFile({
      filename: path.join(logsDir, "combined-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      format: logFormat,
      maxSize: "20m",
      maxFiles: "14d",
      zippedArchive: true,
    })
  );

  transports.push(
    new DailyRotateFile({
      filename: path.join(logsDir, "sql-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      level: "sql",
      format: logFormat,
      maxSize: "20m",
      maxFiles: "14d",
      zippedArchive: true,
    })
  );

  transports.push(
    new DailyRotateFile({
      filename: path.join(logsDir, "http-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      level: "http",
      format: logFormat,
      maxSize: "20m",
      maxFiles: "14d",
      zippedArchive: true,
    })
  );
}

// Create the logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "debug",
  levels,
  format: logFormat,
  transports,
  exitOnError: false,
});

logger.stream = {
  write: (message) => {
    logger.http(message.trim());
  },
};

// Helper functions for common logging patterns
logger.logError = (error, context = {}) => {
  logger.error({
    message: error.message || error,
    stack: error.stack,
    ...context,
  });
};

logger.logSQL = (query, params = [], duration = null) => {
  const logData = {
    query: query.trim(),
    params: params.length > 0 ? params : undefined,
    duration: duration ? `${duration}ms` : undefined,
  };

  logger.log("sql", "SQL Query", logData);
};

logger.logAuth = (event, userId, details = {}) => {
  logger.info("Authentication Event", {
    event,
    userId,
    ...details,
  });
};

logger.logRequest = (req, additionalInfo = {}) => {
  logger.http("HTTP Request", {
    method: req.method,
    url: req.originalUrl || req.url,
    ip: req.ip || req.connection?.remoteAddress,
    userId: req.session?.userId,
    ...additionalInfo,
  });
};

// Log unhandled rejections and exceptions
process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection", {
    reason: reason instanceof Error ? reason.message : reason,
    stack: reason instanceof Error ? reason.stack : undefined,
    promise: promise.toString(),
  });
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception", {
    message: error.message,
    stack: error.stack,
  });

  // Give winston time to write the log before exiting
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

module.exports = logger;
