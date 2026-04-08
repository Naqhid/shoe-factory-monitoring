const logger = require('../utils/logger');

// Classify errors for better logging context
const classifyError = (err) => {
  if (err.code === 'ER_DUP_ENTRY') return { type: 'DB_DUPLICATE', status: 409, message: 'Duplicate entry' };
  if (err.code === 'ER_NO_REFERENCED_ROW_2') return { type: 'DB_FK_VIOLATION', status: 400, message: 'Referenced record not found' };
  if (err.code === 'ER_ROW_IS_REFERENCED_2') return { type: 'DB_FK_CONSTRAINT', status: 400, message: 'Record is referenced by other data' };
  if (err.code === 'ECONNREFUSED') return { type: 'DB_CONNECTION', status: 503, message: 'Database connection refused' };
  if (err.code === 'ETIMEDOUT') return { type: 'DB_TIMEOUT', status: 503, message: 'Database connection timeout' };
  if (err.code === 'ER_ACCESS_DENIED_ERROR') return { type: 'DB_AUTH', status: 503, message: 'Database authentication failed' };
  if (err.name === 'JsonWebTokenError') return { type: 'AUTH_JWT', status: 401, message: 'Invalid token' };
  if (err.name === 'TokenExpiredError') return { type: 'AUTH_EXPIRED', status: 401, message: 'Token expired' };
  if (err.name === 'ValidationError') return { type: 'VALIDATION', status: 400, message: err.message };
  if (err.status || err.statusCode) return { type: 'HTTP', status: err.status || err.statusCode, message: err.message };
  return { type: 'INTERNAL', status: 500, message: 'Internal server error' };
};

const errorHandler = (err, req, res, next) => {
  const { type, status, message } = classifyError(err);

  const logContext = {
    requestId: req.requestId,
    type,
    method: req.method,
    url: req.url,
    ip: req.ip,
    status,
    stack: err.stack,
  };

  if (status >= 500) {
    logger.error(`[${type}] ${err.message || message}`, logContext);
  } else if (status >= 400) {
    logger.warn(`[${type}] ${err.message || message}`, logContext);
  }

  res.status(status).json({
    success: false,
    error: message,
    requestId: req.requestId,
    ...(process.env.NODE_ENV !== 'production' && { detail: err.message }),
  });
};

module.exports = errorHandler;
