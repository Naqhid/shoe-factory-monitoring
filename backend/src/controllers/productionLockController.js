const db = require('../../config/database');
const logger = require('../utils/logger');

// Ensures the production_day_locks table exists
const initTable = async () => {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS production_day_locks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      lock_date DATE NOT NULL,
      work_centre_id INT NOT NULL,
      locked_by INT NOT NULL,
      locked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      notes VARCHAR(255),
      UNIQUE KEY unique_lock (lock_date, work_centre_id),
      INDEX idx_lock_date (lock_date)
    )
  `);
};
initTable().catch(e => logger.error('productionLockController initTable:', e.message));

class ProductionLockController {
  // Check if a date+work_centre is locked
  async isLocked(req, res) {
    try {
      const { date, work_centre_id } = req.query;
      if (!date || !work_centre_id) {
        return res.status(400).json({ success: false, error: 'date and work_centre_id are required' });
      }
      const [rows] = await db.execute(
        `SELECT pdl.*, u.name as locked_by_name 
         FROM production_day_locks pdl
         LEFT JOIN users u ON pdl.locked_by = u.id
         WHERE pdl.lock_date = ? AND pdl.work_centre_id = ?`,
        [date, work_centre_id]
      );
      res.json({ success: true, locked: rows.length > 0, data: rows[0] || null });
    } catch (error) {
      logger.error('isLocked error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Lock a production day (supervisor/admin only)
  async lockDay(req, res) {
    try {
      const { date, work_centre_id, notes } = req.body;
      const userId = req.user.id;
      const role = req.user.role;

      if (!['admin', 'supervisor', 'manager'].includes(role)) {
        return res.status(403).json({ success: false, error: 'Only supervisors/admins can lock production days' });
      }
      if (!date || !work_centre_id) {
        return res.status(400).json({ success: false, error: 'date and work_centre_id are required' });
      }

      await db.execute(
        `INSERT INTO production_day_locks (lock_date, work_centre_id, locked_by, notes)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE locked_by = VALUES(locked_by), locked_at = NOW(), notes = VALUES(notes)`,
        [date, work_centre_id, userId, notes || null]
      );

      logger.info(`Production day locked: ${date} wc=${work_centre_id} by user=${userId}`);
      res.json({ success: true, message: `Production for ${date} has been locked` });
    } catch (error) {
      logger.error('lockDay error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Unlock a production day (admin only)
  async unlockDay(req, res) {
    try {
      const { date, work_centre_id } = req.body;
      if (req.user.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Only admins can unlock production days' });
      }
      if (!date || !work_centre_id) {
        return res.status(400).json({ success: false, error: 'date and work_centre_id are required' });
      }
      const [r] = await db.execute(
        'DELETE FROM production_day_locks WHERE lock_date = ? AND work_centre_id = ?',
        [date, work_centre_id]
      );
      if (r.affectedRows === 0) {
        return res.status(404).json({ success: false, error: 'No lock found for this date/work centre' });
      }
      logger.info(`Production day unlocked: ${date} wc=${work_centre_id} by admin=${req.user.id}`);
      res.json({ success: true, message: `Production for ${date} has been unlocked` });
    } catch (error) {
      logger.error('unlockDay error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // List all locks (optionally filtered by date range)
  async getAll(req, res) {
    try {
      const { from, to, work_centre_id } = req.query;
      let query = `SELECT pdl.*, u.name as locked_by_name, wc.name as work_centre_name
                   FROM production_day_locks pdl
                   LEFT JOIN users u ON pdl.locked_by = u.id
                   LEFT JOIN work_centres wc ON pdl.work_centre_id = wc.id
                   WHERE 1=1`;
      const params = [];
      if (from) { query += ' AND pdl.lock_date >= ?'; params.push(from); }
      if (to)   { query += ' AND pdl.lock_date <= ?'; params.push(to); }
      if (work_centre_id) { query += ' AND pdl.work_centre_id = ?'; params.push(work_centre_id); }
      query += ' ORDER BY pdl.lock_date DESC';

      const [rows] = await db.execute(query, params);
      res.json({ success: true, data: rows });
    } catch (error) {
      logger.error('getAll locks error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = new ProductionLockController();
