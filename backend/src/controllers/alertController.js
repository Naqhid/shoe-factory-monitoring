const db = require('../../config/database');
const logger = require('../utils/logger');
const { sendAlertDigest } = require('../services/emailService');

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
  await db.execute(`
    CREATE TABLE IF NOT EXISTS alert_reads (
      id INT AUTO_INCREMENT PRIMARY KEY,
      alert_id INT NOT NULL,
      user_id INT NOT NULL,
      read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_alert_user (alert_id, user_id),
      INDEX idx_user_read (user_id, read_at),
      CONSTRAINT fk_alert_reads_alert FOREIGN KEY (alert_id) REFERENCES production_alerts(id) ON DELETE CASCADE
    )
  `);
};
initTable().catch(e => logger.error('alertController initTable:', e.message));

// Thresholds (can be moved to env/config)
const EFFICIENCY_WARN_THRESHOLD = parseFloat(process.env.ALERT_EFFICIENCY_WARN || 70);
const EFFICIENCY_CRIT_THRESHOLD = parseFloat(process.env.ALERT_EFFICIENCY_CRIT || 50);
const HEADCOUNT_WARN_RATIO      = parseFloat(process.env.ALERT_HEADCOUNT_RATIO || 0.8); // 80% of target
const IDLE_WARN_MINUTES         = parseFloat(process.env.ALERT_IDLE_MINUTES || 30);
const SHIFT_START_HOUR = parseInt(process.env.SHIFT_START_HOUR || '9', 10);
const SHIFT_START_MINUTE = parseInt(process.env.SHIFT_START_MINUTE || '0', 10);
const SHIFT_END_HOUR = parseInt(process.env.SHIFT_END_HOUR || '17', 10);
const SHIFT_END_MINUTE = parseInt(process.env.SHIFT_END_MINUTE || '30', 10);
const ALERT_WINDOW_BEFORE_SHIFT_END_MINUTES = parseInt(
  process.env.ALERT_WINDOW_BEFORE_SHIFT_END_MINUTES || '60',
  10
);

const formatDateOnly = (d) => {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const formatDateTime = (d) => {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  const hh = `${d.getHours()}`.padStart(2, '0');
  const mm = `${d.getMinutes()}`.padStart(2, '0');
  const ss = `${d.getSeconds()}`.padStart(2, '0');
  return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
};

const getShiftWindow = (baseDate = new Date(), now = new Date()) => {
  const shiftStart = new Date(baseDate);
  shiftStart.setHours(SHIFT_START_HOUR, SHIFT_START_MINUTE, 0, 0);
  const shiftEnd = new Date(baseDate);
  shiftEnd.setHours(SHIFT_END_HOUR, SHIFT_END_MINUTE, 0, 0);
  const sameDay = formatDateOnly(baseDate) === formatDateOnly(now);
  const endAt = sameDay ? (now > shiftEnd ? shiftEnd : now) : shiftEnd;
  return { shiftDate: formatDateOnly(shiftStart), startAt: shiftStart, endAt };
};

const isWithinPreShiftEndWindow = (now = new Date()) => {
  const shiftWindow = getShiftWindow(now, now);
  const windowStart = new Date(shiftWindow.startAt);
  const shiftEnd = new Date(shiftWindow.startAt);
  shiftEnd.setHours(SHIFT_END_HOUR, SHIFT_END_MINUTE, 0, 0);
  windowStart.setHours(SHIFT_END_HOUR, SHIFT_END_MINUTE, 0, 0);
  windowStart.setMinutes(windowStart.getMinutes() - ALERT_WINDOW_BEFORE_SHIFT_END_MINUTES);
  return now >= windowStart && now <= shiftEnd;
};

class AlertController {
  // Get alerts (unread by default)
  async getAlerts(req, res) {
    try {
      const { date, work_centre_id, unread_only = 'true', limit = 50 } = req.query;
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }
      const limitInt = Math.min(Math.max(parseInt(limit) || 50, 1), 200);
      const now = new Date();
      const alertDate = date || formatDateOnly(now);
      const baseDate = new Date(`${alertDate}T00:00:00`);
      const shiftWindow = getShiftWindow(baseDate, now);
      const showEndShiftWarnings = date ? true : isWithinPreShiftEndWindow(now);
      let query = `SELECT pa.*, wc.name as work_centre_name,
                          CASE WHEN ar.alert_id IS NULL THEN 0 ELSE 1 END as is_read
                   FROM production_alerts pa
                   LEFT JOIN work_centres wc ON pa.work_centre_id = wc.id
                    LEFT JOIN alert_reads ar ON ar.alert_id = pa.id AND ar.user_id = ?
                   WHERE 1=1`;
      const params = [userId];
      query += ' AND pa.alert_date = ?';
      params.push(alertDate);
      query += ' AND pa.created_at BETWEEN ? AND ?';
      params.push(formatDateTime(shiftWindow.startAt), formatDateTime(shiftWindow.endAt));
      if (work_centre_id) { query += ' AND pa.work_centre_id = ?'; params.push(work_centre_id); }
      if (unread_only === 'true') { query += ' AND ar.alert_id IS NULL'; }
      if (!showEndShiftWarnings) {
        // End-of-shift risk alerts stay hidden until near shift end
        query += ` AND NOT (
          pa.alert_type = 'target_at_risk'
          OR (pa.alert_type = 'efficiency_low' AND pa.severity = 'warning')
        )`;
      }
      query += ` ORDER BY 
        CASE WHEN ar.alert_id IS NULL THEN 0 ELSE 1 END ASC,
        CASE pa.severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END ASC,
        pa.created_at DESC
        LIMIT ${limitInt}`;

      const [rows] = await db.execute(query, params);
      let unreadCountQuery = `SELECT COUNT(*) as total
                              FROM production_alerts pa
                              LEFT JOIN alert_reads ar ON ar.alert_id = pa.id AND ar.user_id = ?
                              WHERE pa.alert_date = ?
                                AND pa.created_at BETWEEN ? AND ?
                                AND ar.alert_id IS NULL`;
      const unreadParams = [
        userId,
        alertDate,
        formatDateTime(shiftWindow.startAt),
        formatDateTime(shiftWindow.endAt)
      ];
      if (work_centre_id) {
        unreadCountQuery += ' AND pa.work_centre_id = ?';
        unreadParams.push(work_centre_id);
      }
      if (!showEndShiftWarnings) {
        unreadCountQuery += ` AND NOT (
          pa.alert_type = 'target_at_risk'
          OR (pa.alert_type = 'efficiency_low' AND pa.severity = 'warning')
        )`;
      }
      const [countRow] = await db.execute(unreadCountQuery, unreadParams);
      res.json({ success: true, data: rows, unread_count: countRow[0].total });
    } catch (error) {
      logger.error('getAlerts error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Mark alert(s) as read
  async markRead(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }
      const { ids, date, work_centre_id } = req.body; // array of ids, or 'all'
      if (ids === 'all') {
        const markDate = date || formatDateOnly(new Date());
        let q = `INSERT IGNORE INTO alert_reads (alert_id, user_id)
                 SELECT pa.id, ?
                 FROM production_alerts pa
                 WHERE pa.alert_date = ?`;
        const p = [userId, markDate];
        if (work_centre_id) {
          q += ' AND pa.work_centre_id = ?';
          p.push(work_centre_id);
        }
        await db.execute(q, p);
      } else if (Array.isArray(ids) && ids.length > 0) {
        const values = ids.map(() => '(?, ?)').join(',');
        const params = ids.flatMap((id) => [id, userId]);
        await db.execute(`INSERT IGNORE INTO alert_reads (alert_id, user_id) VALUES ${values}`, params);
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
      const now = new Date();
      const allowEndShiftRiskAlerts = isWithinPreShiftEndWindow(now);

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
        } else if (row.avg_efficiency_percent < EFFICIENCY_WARN_THRESHOLD && allowEndShiftRiskAlerts) {
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

      // 1b. Machine idle alerts (stopped >= configured minutes)
      if (date === formatDateOnly(now)) {
        const [idleRows] = await db.execute(`
          SELECT mcp.work_centre_id, mcp.machine_id,
                 TIMESTAMPDIFF(MINUTE, mcp.idle_start_time, NOW()) as idle_minutes
          FROM machine_centre_production mcp
          INNER JOIN (
            SELECT machine_id, MAX(id) as max_id
            FROM machine_centre_production
            WHERE prod_date = ?
            GROUP BY machine_id
          ) latest ON latest.max_id = mcp.id
          WHERE mcp.prod_date = ?
            AND mcp.button_status = 3
            AND mcp.idle_start_time IS NOT NULL
            AND TIMESTAMPDIFF(MINUTE, mcp.idle_start_time, NOW()) >= ?
        `, [date, date, IDLE_WARN_MINUTES]);

        for (const row of idleRows) {
          await AlertController._upsertAlert({
            alert_type: 'machine_idle',
            severity: row.idle_minutes >= (IDLE_WARN_MINUTES * 2) ? 'critical' : 'warning',
            work_centre_id: row.work_centre_id,
            machine_id: row.machine_id,
            alert_date: date,
            message: `Machine ${row.machine_id} idle for ${row.idle_minutes} minutes`,
            threshold_value: IDLE_WARN_MINUTES,
            actual_value: row.idle_minutes
          });
          count++;
        }
      }

      // 2. Headcount alerts per work centre
      const [hcRows] = await db.execute(`
        SELECT 
          wc.id as work_centre_id,
          COALESCE(p.present, 0) as present,
          COALESCE(t.target, 0) as target
        FROM work_centres wc
        LEFT JOIN (
          SELECT ms.work_centre_id, COUNT(DISTINCT ms.emp_id) as present
          FROM mobile_sessions ms
          WHERE DATE(ms.activated_at) = ? AND ms.status = 'active'
          GROUP BY ms.work_centre_id
        ) p ON p.work_centre_id = wc.id
        LEFT JOIN (
          SELECT e.work_centre_id, COUNT(*) as target
          FROM employees e
          GROUP BY e.work_centre_id
        ) t ON t.work_centre_id = wc.id
        HAVING target > 0 AND present < target * ?
      `, [date, HEADCOUNT_WARN_RATIO]);

      for (const row of hcRows) {
        const present = Number(row.present || 0);
        const target = Number(row.target || 0);
        const absent = Math.max(0, target - present);
        let absentText = '';
        if (absent > 0) {
          const [absentRows] = await db.execute(`
            SELECT e.code
            FROM employees e
            LEFT JOIN mobile_sessions ms
              ON ms.emp_id = e.id
              AND ms.work_centre_id = e.work_centre_id
              AND ms.status = 'active'
              AND DATE(ms.activated_at) = ?
            WHERE e.work_centre_id = ?
              AND ms.emp_id IS NULL
            ORDER BY e.code
            LIMIT 5
          `, [date, row.work_centre_id]);
          const absentCodes = absentRows.map(r => r.code).filter(Boolean);
          absentText = absentCodes.length > 0
            ? `, ${absent} absent (${absentCodes.join(', ')}${absent > absentCodes.length ? ', ...' : ''})`
            : `, ${absent} absent`;
        }
        await AlertController._upsertAlert({
          alert_type: 'headcount_low', severity: 'warning',
          work_centre_id: row.work_centre_id, machine_id: null,
          alert_date: date,
          message: `Work centre headcount low: ${present} present vs ${target} target (${Math.round((present/target)*100)}%)${absentText}`,
          threshold_value: target, actual_value: present
        });
        count++;
      }

      // 3. Target at risk — show only near shift end (configurable window)
      if (allowEndShiftRiskAlerts) {
        const [targetRows] = await db.execute(`
          SELECT 
            actuals.work_centre_id,
            actuals.actual,
            plans.target
          FROM (
            SELECT work_centre_id, SUM(total_output_pairs) as actual
            FROM machine_centre_summary
            WHERE prod_date = ?
            GROUP BY work_centre_id
          ) actuals
          LEFT JOIN (
            SELECT work_centre_id, SUM(total_target_per_day) as target
            FROM production_plan
            WHERE DATE(plan_date) = ?
            GROUP BY work_centre_id
          ) plans ON plans.work_centre_id = actuals.work_centre_id
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
      }

      logger.info(`Alert checks for ${date}: ${count} alerts generated`);

      // Send email digest if any alerts were generated
      if (count > 0) {
        const [newAlerts] = await db.execute(`
          SELECT pa.*, wc.name as work_centre_name
          FROM production_alerts pa
          LEFT JOIN work_centres wc ON pa.work_centre_id = wc.id
          WHERE pa.alert_date = ? AND pa.is_read = 0
          ORDER BY pa.severity DESC, pa.created_at DESC
        `, [date]);
        sendAlertDigest(newAlerts, date).catch(e => logger.error('Digest email error:', e.message));
      }
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
