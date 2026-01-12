const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  logger.error('Unhandled error:', err);
  
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
};

module.exports = errorHandler;