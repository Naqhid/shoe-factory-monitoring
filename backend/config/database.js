const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 30,        // Increased from 10 to handle more concurrent users
  queueLimit: 50,             // Allow queueing when pool exhausted
  connectTimeout: 10000,
  acquireTimeout: 60000,      // Wait up to 60s for connection from pool
  timeout: 60000,             // Query timeout
  enableKeepAlive: true,      // Keep connections alive
  keepAliveInitialDelay: 10000
});

// Test connection on startup
pool.getConnection()
  .then(connection => {
    console.log('✅ Database connected successfully');
    connection.release();
  })
  .catch(err => {
    console.error('❌ Database connection failed:', err.message);
  });

module.exports = pool;