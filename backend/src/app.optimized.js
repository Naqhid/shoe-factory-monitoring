const express = require('express');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const NodeCache = require('node-cache');

const app = express();

// Cache setup - 5 minute TTL
const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Cache middleware
const cacheMiddleware = (duration) => (req, res, next) => {
  if (req.method !== 'GET') return next();
  
  const key = req.originalUrl;
  const cachedResponse = cache.get(key);
  
  if (cachedResponse) {
    return res.json(cachedResponse);
  }
  
  res.originalJson = res.json;
  res.json = (body) => {
    cache.set(key, body, duration);
    res.originalJson(body);
  };
  next();
};

// Apply cache to read-only endpoints
app.get('/api/masters/*', cacheMiddleware(300)); // 5 min
app.get('/api/production-routing', cacheMiddleware(300));
app.get('/api/production-planning', cacheMiddleware(60)); // 1 min
app.get('/api/machines/status', cacheMiddleware(5)); // 5 sec

// Clear cache on data changes
const clearCache = (pattern) => {
  const keys = cache.keys();
  keys.forEach(key => {
    if (key.includes(pattern)) {
      cache.del(key);
    }
  });
};

// Clear cache on POST/PUT/PATCH/DELETE
app.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    res.on('finish', () => {
      if (res.statusCode < 400) {
        clearCache(req.path.split('/')[2]); // Clear related cache
      }
    });
  }
  next();
});

// Database connection pooling
const mysql = require('mysql2/promise');
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

module.exports = { app, pool, cache, clearCache };
