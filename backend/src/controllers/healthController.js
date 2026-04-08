const db = require('../../config/database');
const logger = require('../utils/logger');
const requestLogger = require('../middleware/requestLogger');
const os = require('os');

class HealthController {
  // GET /health — simple liveness probe
  async basic(req, res) {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
  }

  // GET /health/detailed — full system health
  async detailed(req, res) {
    const checks = await Promise.allSettled([
      this._checkDatabase(),
      this._checkDiskSpace(),
    ]);

    const [dbCheck, diskCheck] = checks.map(r =>
      r.status === 'fulfilled' ? r.value : { status: 'error', error: r.reason?.message }
    );

    const allHealthy = [dbCheck, diskCheck].every(c => c.status === 'ok');

    const memUsage = process.memoryUsage();
    const logStats = logger.getStats();
    const reqMetrics = requestLogger.getMetrics();

    res.status(allHealthy ? 200 : 503).json({
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: logStats.uptime,
      checks: {
        database: dbCheck,
        disk: diskCheck,
      },
      process: {
        pid: process.pid,
        nodeVersion: process.version,
        memoryMB: {
          rss: (memUsage.rss / 1024 / 1024).toFixed(1),
          heapUsed: (memUsage.heapUsed / 1024 / 1024).toFixed(1),
          heapTotal: (memUsage.heapTotal / 1024 / 1024).toFixed(1),
        },
        cpuLoad: os.loadavg(),
      },
      logging: logStats,
      requests: reqMetrics,
    });
  }

  // GET /health/metrics — for monitoring dashboard polling
  async metrics(req, res) {
    const memUsage = process.memoryUsage();
    const logStats = logger.getStats();
    const reqMetrics = requestLogger.getMetrics();

    res.json({
      timestamp: new Date().toISOString(),
      uptime: logStats.uptime,
      memory: {
        rss: (memUsage.rss / 1024 / 1024).toFixed(1),
        heapUsed: (memUsage.heapUsed / 1024 / 1024).toFixed(1),
        heapTotal: (memUsage.heapTotal / 1024 / 1024).toFixed(1),
      },
      logging: logStats,
      requests: reqMetrics,
    });
  }

  async _checkDatabase() {
    const start = Date.now();
    try {
      await db.execute('SELECT 1');
      return { status: 'ok', responseTime: `${Date.now() - start}ms` };
    } catch (err) {
      return { status: 'error', error: err.message, responseTime: `${Date.now() - start}ms` };
    }
  }

  _checkDiskSpace() {
    return new Promise((resolve) => {
      try {
        const fs = require('fs');
        const stats = fs.statfsSync ? fs.statfsSync('/') : null;
        if (stats) {
          const total = stats.blocks * stats.bsize;
          const free = stats.bfree * stats.bsize;
          const usedPct = (((total - free) / total) * 100).toFixed(1);
          resolve({
            status: parseFloat(usedPct) > 90 ? 'warn' : 'ok',
            usedPercent: `${usedPct}%`,
            freeMB: (free / 1024 / 1024).toFixed(0),
          });
        } else {
          resolve({ status: 'ok', note: 'disk check not supported on this platform' });
        }
      } catch {
        resolve({ status: 'ok', note: 'disk check not available' });
      }
    });
  }
}

module.exports = new HealthController();
