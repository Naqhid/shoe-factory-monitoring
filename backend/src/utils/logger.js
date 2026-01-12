const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
if (process.env.LOGS_DIR && !fs.existsSync(process.env.LOGS_DIR)) {
  fs.mkdirSync(process.env.LOGS_DIR, { recursive: true });
}

const transports = [];

// Add file transports only if LOGS_DIR is defined
if (process.env.LOGS_DIR) {
  transports.push(
    new winston.transports.File({ 
      filename: path.join(process.env.LOGS_DIR, 'error.log'), 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: path.join(process.env.LOGS_DIR, 'combined.log') 
    })
  );
}

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'shoe-factory-monitoring' },
  transports
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

module.exports = logger;