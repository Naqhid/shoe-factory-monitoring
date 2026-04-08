const { v4: uuidv4 } = require('crypto').webcrypto ? 
  { v4: () => require('crypto').randomUUID() } : 
  { v4: () => require('crypto').randomUUID() };
const logger = require('../utils/logger');

// In-memory request metrics (last 1000 requests)
const metrics = {
  requests: [],
  totalRequests: 0,
  totalErrors: 0,
  responseTimes: [],
};

const MAX_SAMPLES = 1000;

const requestLogger = (req, res, next) => {
  const requestId = require('crypto').randomUUID();
  const start = Date.now();

  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  res.on('finish', () => {
    const duration = Date.now() - start;
    const isError = res.statusCode >= 400;

    metrics.totalRequests++;
    if (isError) metrics.totalErrors++;

    metrics.responseTimes.push(duration);
    if (metrics.responseTimes.length > MAX_SAMPLES) metrics.responseTimes.shift();

    const entry = {
      ts: Date.now(),
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration,
      ip: req.ip,
    };
    metrics.requests.push(entry);
    if (metrics.requests.length > MAX_SAMPLES) metrics.requests.shift();

    const logFn = res.statusCode >= 500 ? 'error'
      : res.statusCode >= 400 ? 'warn'
      : 'info';

    logger[logFn](`${req.method} ${req.url} ${res.statusCode} ${duration}ms`, {
      requestId,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
  });

  next();
};

requestLogger.getMetrics = () => {
  const times = metrics.responseTimes;
  const avg = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
  const sorted = [...times].sort((a, b) => a - b);
  const p95 = sorted.length ? sorted[Math.floor(sorted.length * 0.95)] : 0;
  const p99 = sorted.length ? sorted[Math.floor(sorted.length * 0.99)] : 0;

  const recent = metrics.requests.slice(-100);
  const errorRate = metrics.totalRequests > 0
    ? ((metrics.totalErrors / metrics.totalRequests) * 100).toFixed(2)
    : '0.00';

  return {
    totalRequests: metrics.totalRequests,
    totalErrors: metrics.totalErrors,
    errorRate: `${errorRate}%`,
    avgResponseTime: `${avg}ms`,
    p95ResponseTime: `${p95}ms`,
    p99ResponseTime: `${p99}ms`,
    recentRequests: recent.slice(-20).reverse(),
  };
};

module.exports = requestLogger;
