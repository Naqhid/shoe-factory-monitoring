const winston = require('winston');
const path = require('path');
const fs = require('fs');

const transports = [
  new winston.transports.Console({
    format: winston.format.simple()
  })
];

// Add file transports only if LOGS_DIR is defined and valid
if (process.env.LOGS_DIR && typeof process.env.LOGS_DIR === 'string') {
  try {
    // Ensure logs directory exists
    if (!fs.existsSync(process.env.LOGS_DIR)) {
      fs.mkdirSync(process.env.LOGS_DIR, { recursive: true });
    }
    
    transports.push(
      new winston.transports.File({ 
        filename: path.join(process.env.LOGS_DIR, 'error.log'), 
        level: 'error' 
      }),
      new winston.transports.File({ 
        filename: path.join(process.env.LOGS_DIR, 'combined.log') 
      })
    );
  } catch (error) {
    console.warn('Could not create file transports:', error.message);
  }
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