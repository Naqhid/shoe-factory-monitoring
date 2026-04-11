const db = require('../../config/database');
const logger = require('../utils/logger');

// Create alerts table on startup
const initTable = async () => {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS production_alerts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      alert_type ENUM('efficiency_low','headcount_low','machine_idle','target_at_risk','custom') NOT NULL,
      severity ENUM('info','warning','critical') NOT NULL DEFAULT 'warning',
      work_centre_id INT,
      machine_id VARCHAR(100),
      alert_date DATE NOT NULL,
      message TEXT NOT NULL,
      threshold_value DECIMAL(10,2),
      actual_value DECIMAL(10,2),
      is_read TINYINT(1) DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_alert_date (alert_date),
      INDEX idx_unread (is_read, alert_date),
      INDEX idx_wc (work_centre_id)
    )
  `);
};
initTable().catch(e => logger.error('alertController initTable:', e.message));

// Thresholds (can be moved to env/config)
const EFFICIENCY_WARN_THRESHOLD = parseFloat(process.env.ALERT_EFFICIENCY_WARN || 70);
const EFFICIENCY_CRIT_THRESHOLD = parseFloat(process.env.ALERT_EFFICIENCY_CRIT || 50);
const HEADCOUNT_WARN_RATIO      = parseFloat(process.env.ALERT_HEADCOUNT_RATIO || 0.8); // 80% of target
const IDLE_WARN_MINUTES         = parseFloat(process.env.ALERT_IDLE_MINUTES || 30);

class AlertController {
  // Get alerts (unread by default)
  async getAlerts(req, res) {
    try {
      const { date, work_centre_id, unread_only = 'true', limit = 50 } = req.query;
      const limitInt = Math.min(Math.max(parseInt(limit) || 50, 1), 200);
      let query = `SELECT pa.*, wc.name as work_centre_name
                   FROM production_alerts pa
                   LEFT JOIN work_centres wc ON pa.work_centre_id = wc.id
                   WHERE 1=1`;
      const params = [];
      if (date) { query += ' AND pa.alert_date = ?'; params.push(date); }
      if (work_centre_id) { query += ' AND pa.work_centre_id = ?'; params.push(work_centre_id); }
      if (unread_only === 'true') { query += ' AND pa.is_read = 0'; }
      query += ` ORDER BY pa.created_at DESC LIMIT ${limitInt}`;

      const [rows] = await db.execute(query, params);
      const [countRow] = await db.execute('SELECT COUNT(*) as total FROM production_alerts WHERE is_read = 0');
      res.json({ success: true, data: rows, unread_count: countRow[0].total });
    } catch (error) {
      logger.error('getAlerts error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Mark alert(s) as read
  async markRead(req, res) {
    try {
      const { ids } = req.body; // array of ids, or 'all'
      if (ids === 'all') {
        await db.execute('UPDATE production_alerts SET is_read = 1');
      } else if (Array.isArray(ids) && ids.length > 0) {
        const placeholders = ids.map(() => '?').join(',');
        await db.execute(`UPDATE production_alerts SET is_read = 1 WHERE id IN (${placeholders})`, ids);
      } else {
        return res.status(400).json({ success: false, error: 'ids must be an array or "all"' });
      }
      res.json({ success: true });
    } catch (error) {
      logger.error('markRead error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Run alert checks for a given date (called manually or by scheduler)
  async runChecks(req, res) {
    try {
      const date = req.query.date || new Date().toISOString().split('T')[0];
      const generated = await AlertController._runChecks(date);
      res.json({ success: true, alerts_generated: generated });
    } catch (error) {
      logger.error('runChecks error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Internal: run all checks and insert alerts
  static async _runChecks(date) {
    let count = 0;
    try {
      // 1. Efficiency alerts per machine
      const [effRows] = await db.execute(`
        SELECT mcs.work_centre_id, mcs.machine_id, mcs.avg_efficiency_percent
        FROM machine_centre_summary mcs
        WHERE mcs.prod_date = ?
      `, [date]);

      for (const row of effRows) {
        if (row.avg_efficiency_percent < EFFICIENCY_CRIT_THRESHOLD) {
          await AlertController._upsertAlert({
            alert_type: 'efficiency_low', severity: 'critical',
            work_centre_id: row.work_centre_id, machine_id: row.machine_id,
            alert_date: date,
            message: `Machine ${row.machine_id} efficiency critically low at ${row.avg_efficiency_percent}% (threshold: ${EFFICIENCY_CRIT_THRESHOLD}%)`,
            threshold_value: EFFICIENCY_CRIT_THRESHOLD, actual_value: row.avg_efficiency_percent
          });
          count++;
        } else if (row.avg_efficiency_percent < EFFICIENCY_WARN_THRESHOLD) {
          await AlertController._upsertAlert({
            alert_type: 'efficiency_low', severity: 'warning',
            work_centre_id: row.work_centre_id, machine_id: row.machine_id,
            alert_date: date,
            message: `Machine ${row.machine_id} efficiency below target at ${row.avg_efficiency_percent}% (threshold: ${EFFICIENCY_WARN_THRESHOLD}%)`,
            threshold_value: EFFICIENCY_WARN_THRESHOLD, actual_value: row.avg_efficiency_percent
          });
          count++;
        }
      }

      // 2. Headcount alerts per work centre
      const [hcRows] = await db.execute(`
        SELECT 
          wc.id as work_centre_id,
          COUNT(DISTINCT ms.emp_id) as present,
          COALESCE(SUM(prl.manpower), 0) as target
        FROM work_centres wc
        LEFT JOIN mobile_sessions ms ON ms.work_centre_id = wc.id 
          AND DATE(ms.activated_at) = ? AND ms.status = 'active'
        LEFT JOIN production_plan pp ON pp.work_centre_id = wc.id AND DATE(pp.plan_date) = ?
        LEFT JOIN production_routing_header prh ON prh.style_id = pp.style_id
        LEFT JOIN production_routing_lines prl ON prl.routing_header_id = prh.id
        GROUP BY wc.id
        HAVING target > 0 AND present < target * ?
      `, [date, date, HEADCOUNT_WARN_RATIO]);

      for (const row of hcRows) {
        await AlertController._upsertAlert({
          alert_type: 'headcount_low', severity: 'warning',
          work_centre_id: row.work_centre_id, machine_id: null,
          alert_date: date,
          message: `Work centre headcount low: ${row.present} present vs ${row.target} target (${Math.round((row.present/row.target)*100)}%)`,
          threshold_value: row.target, actual_value: row.present
        });
        count++;
      }

      // 3. Target at risk — work centres where output < 70% of target by end of day
      const [targetRows] = await db.execute(`
        SELECT 
          mcs.work_centre_id,
          SUM(mcs.total_output_pairs) as actual,
          SUM(pp.total_target_per_day) as target
        FROM machine_centre_summary mcs
        LEFT JOIN production_plan pp ON pp.work_centre_id = mcs.work_centre_id AND DATE(pp.plan_date) = ?
        WHERE mcs.prod_date = ?
        GROUP BY mcs.work_centre_id
        HAVING target > 0 AND actual < target * 0.7
      `, [date, date]);

      for (const row of targetRows) {
        const pct = Math.round((row.actual / row.target) * 100);
        await AlertController._upsertAlert({
          alert_type: 'target_at_risk', severity: pct < 50 ? 'critical' : 'warning',
          work_centre_id: row.work_centre_id, machine_id: null,
          alert_date: date,
          message: `Daily target at risk: ${row.actual} / ${row.target} pairs produced (${pct}%)`,
          threshold_value: row.target, actual_value: row.actual
        });
        count++;
      }

      logger.info(`Alert checks for ${date}: ${count} alerts generated`);
    } catch (err) {
      logger.error('Alert _runChecks error:', err.message);
    }
    return count;
  }

  // Upsert alert — avoid duplicate alerts for same type/machine/date
  static async _upsertAlert({ alert_type, severity, work_centre_id, machine_id, alert_date, message, threshold_value, actual_value }) {
    await db.execute(`
      INSERT INTO production_alerts 
        (alert_type, severity, work_centre_id, machine_id, alert_date, message, threshold_value, actual_value, is_read)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
      ON DUPLICATE KEY UPDATE
        severity = VALUES(severity), message = VALUES(message),
        actual_value = VALUES(actual_value), is_read = 0, created_at = NOW()
    `, [alert_type, severity, work_centre_id || null, machine_id || null,
        alert_date, message, threshold_value || null, actual_value || null])
      .catch(() => {
        // If no unique key, just insert
        return db.execute(`
          INSERT INTO production_alerts 
            (alert_type, severity, work_centre_id, machine_id, alert_date, message, threshold_value, actual_value)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [alert_type, severity, work_centre_id || null, machine_id || null,
           alert_date, message, threshold_value || null, actual_value || null]);
      });
  }
}

module.exports = new AlertController();
module.exports.runChecks = AlertController._runChecks;
