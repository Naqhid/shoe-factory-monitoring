const winston = require('winston');
const path = require('path');
const fs = require('fs');

const LOGS_DIR = process.env.LOGS_DIR || './logs';

try {
  if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });
} catch (e) {
  console.warn('Could not create logs directory:', e.message);
}

const { combine, timestamp, errors, json, colorize, printf } = winston.format;

const consoleFormat = printf(({ level, message, timestamp, requestId, ...meta }) => {
  const rid = requestId ? ` [${requestId}]` : '';
  const extra = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
  return `${timestamp} ${level}${rid}: ${message}${extra}`;
});

const fileFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json()
);

const transports = [
  new winston.transports.Console({
    format: combine(
      colorize(),
      timestamp({ format: 'HH:mm:ss' }),
      errors({ stack: true }),
      consoleFormat
    )
  })
];

try {
  // Daily rotate — use basic File transport with date suffix via filename function
  transports.push(
    new winston.transports.File({
      filename: path.join(LOGS_DIR, 'error.log'),
      level: 'error',
      format: fileFormat,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 7,
      tailable: true
    }),
    new winston.transports.File({
      filename: path.join(LOGS_DIR, 'combined.log'),
      format: fileFormat,
      maxsize: 20 * 1024 * 1024, // 20MB
      maxFiles: 7,
      tailable: true
    })
  );
} catch (e) {
  console.warn('Could not create file transports:', e.message);
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: { service: 'prodpulse' },
  transports
});

// Track error counts for health monitoring
logger.errorCount = 0;
logger.warnCount = 0;
logger.startTime = Date.now();

const originalError = logger.error.bind(logger);
const originalWarn = logger.warn.bind(logger);

logger.error = (...args) => {
  logger.errorCount++;
  return originalError(...args);
};
logger.warn = (...args) => {
  logger.warnCount++;
  return originalWarn(...args);
};

logger.getStats = () => ({
  uptime: Math.floor((Date.now() - logger.startTime) / 1000),
  errorCount: logger.errorCount,
  warnCount: logger.warnCount,
  logLevel: logger.level
});

module.exports = logger;
