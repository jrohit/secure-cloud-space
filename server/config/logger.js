const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');

const logDir = path.join(__dirname, '../logs');

// Create the log directory if it does not exist
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

// Define a custom format for log messages
const myFormat = winston.format.printf(({ level, message, timestamp, stack }) => {
  let log = `${timestamp} ${level}: ${message}`;
  if (stack) {
    log = `${log}\nStack: ${stack}`;
  }
  return log;
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info', // Default to 'info', can be configured via .env
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }), // Log the stack trace if an error is passed
    myFormat
  ),
  transports: [
    new DailyRotateFile({
      filename: path.join(logDir, '%DATE%-app.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m', // Max size of each log file
      maxFiles: '14d', // Keep logs for 14 days
      handleExceptions: true, // Handle uncaught exceptions
      handleRejections: true, // Handle unhandled promise rejections
    }),
  ],
  // exitOnError: false, // Do not exit on handled exceptions
});

// If not in production, also log to the console with colors
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      myFormat
    ),
    handleExceptions: true,
    handleRejections: true,
  }));
}

// Stream for Morgan (HTTP request logging)
logger.stream = {
  write: function(message) {
    // Morgan typically adds a newline, remove it if present to avoid double newlines
    logger.info(message.trim());
  },
};

module.exports = logger;
