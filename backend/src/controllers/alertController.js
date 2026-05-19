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
      INDEX idx_wc (work_centre_id),
      UNIQUE KEY uniq_alert (alert_type, work_centre_id, machine_id, alert_date)
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
  // Ensure enum contains newer realtime alert types.
  try {
    await db.execute(`
      ALTER TABLE production_alerts
      MODIFY COLUMN alert_type ENUM(
        'efficiency_low',
        'headcount_low',
        'machine_idle',
        'idle_too_long',
        'over_target',
        'no_scan_heartbeat',
        'machine_offline',
        'target_at_risk',
        'custom'
      ) NOT NULL
    `);
  } catch (e) {
    logger.warn('alertController enum migration skipped:', e.message);
  }
};
initTable().catch(e => logger.error('alertController initTable:', e.message));

// Thresholds (can be moved to env/config)
const EFFICIENCY_WARN_THRESHOLD = parseFloat(process.env.ALERT_EFFICIENCY_WARN || 70);
const EFFICIENCY_CRIT_THRESHOLD = parseFloat(process.env.ALERT_EFFICIENCY_CRIT || 50);
const HEADCOUNT_WARN_RATIO      = parseFloat(process.env.ALERT_HEADCOUNT_RATIO || 0.8); // 80% of target
const IDLE_WARN_MINUTES         = parseFloat(process.env.ALERT_IDLE_MINUTES || 30);
const HEARTBEAT_WARN_MINUTES    = parseFloat(process.env.ALERT_HEARTBEAT_MINUTES || 10);
const OVER_TARGET_GRACE_MINUTES = parseFloat(process.env.ALERT_OVER_TARGET_GRACE_MINUTES || 2);
const SHIFT_START_HOUR = parseInt(process.env.SHIFT_START_HOUR || '9', 10);
const SHIFT_START_MINUTE = parseInt(process.env.SHIFT_START_MINUTE || '0', 10);
const SHIFT_END_HOUR = parseInt(process.env.SHIFT_END_HOUR || '17', 10);
const SHIFT_END_MINUTE = parseInt(process.env.SHIFT_END_MINUTE || '30', 10);
const ALERT_WINDOW_BEFORE_SHIFT_END_MINUTES = parseInt(
  process.env.ALERT_WINDOW_BEFORE_SHIFT_END_MINUTES || '60',
  10
);
const REALTIME_CHECK_COOLDOWN_MS = parseInt(process.env.ALERT_REALTIME_CHECK_COOLDOWN_MS || '60000', 10);

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

const toFixedSafe = (value, digits = 1) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  return n.toFixed(digits);
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
  static _lastRealtimeCheckAt = 0;

  static async _runChecksThrottled(date) {
    const now = Date.now();
    if (now - AlertController._lastRealtimeCheckAt < REALTIME_CHECK_COOLDOWN_MS) return;
    AlertController._lastRealtimeCheckAt = now;
    await AlertController._runChecks(date);
  }

  // Get alerts (unread by default) - supports public access (no auth required)
  async getAlerts(req, res) {
    try {
      const { date, work_centre_id, unread_only = 'true', limit = 50 } = req.query;
      const userId = req.user?.id || null; // null for public/factory floor access
      const limitInt = Math.min(Math.max(parseInt(limit) || 50, 1), 200);
      const now = new Date();
      const alertDate = date || formatDateOnly(now);
      const baseDate = new Date(`${alertDate}T00:00:00`);
      const shiftWindow = getShiftWindow(baseDate, now);
      const showEndShiftWarnings = date ? true : isWithinPreShiftEndWindow(now);
      // Build query based on whether user is authenticated or public access
      let query;
      let params;
      
      if (userId) {
        // Authenticated user - join with alert_reads to get read status
        query = `SELECT pa.*, wc.name as work_centre_name,
                          CASE WHEN ar.alert_id IS NULL THEN 0 ELSE 1 END as is_read
                   FROM production_alerts pa
                   LEFT JOIN work_centres wc ON pa.work_centre_id = wc.id
                   LEFT JOIN alert_reads ar ON ar.alert_id = pa.id AND ar.user_id = ?
                   WHERE 1=1`;
        params = [userId];
      } else {
        // Public access - no read tracking, show all as unread
        query = `SELECT pa.*, wc.name as work_centre_name,
                          0 as is_read
                   FROM production_alerts pa
                   LEFT JOIN work_centres wc ON pa.work_centre_id = wc.id
                   WHERE 1=1`;
        params = [];
      }
      
      query += ' AND pa.alert_date = ?';
      params.push(alertDate);
      query += ' AND pa.created_at BETWEEN ? AND ?';
      params.push(formatDateTime(shiftWindow.startAt), formatDateTime(shiftWindow.endAt));
      if (work_centre_id) { query += ' AND pa.work_centre_id = ?'; params.push(work_centre_id); }
      // For authenticated users, filter by unread; for public, show all (already filtered as unread=0)
      if (unread_only === 'true' && userId) { query += ' AND ar.alert_id IS NULL'; }
      if (!showEndShiftWarnings) {
        // End-of-shift risk alerts stay hidden until near shift end
        query += ` AND NOT (
          pa.alert_type = 'target_at_risk'
          OR (pa.alert_type = 'efficiency_low' AND pa.severity = 'warning')
        )`;
      }
      query += ` ORDER BY 
        ${userId ? 'CASE WHEN ar.alert_id IS NULL THEN 0 ELSE 1 END ASC,' : ''}
        CASE pa.severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END ASC,
        pa.created_at DESC
        LIMIT ${limitInt}`;

      const [rows] = await db.execute(query, params);
      
      // For public access, all visible alerts are considered "unread"
      let unreadCount;
      if (userId) {
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
        unreadCount = countRow[0].total;
      } else {
        // Public access: count of visible rows is the unread count
        unreadCount = rows.length;
      }
      
      res.json({ success: true, data: rows, unread_count: unreadCount });
    } catch (error) {
      logger.error('getAlerts error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Realtime alert center API (authenticated): supports filters + acknowledge state.
  async getRealtimeCenterAlerts(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }
      const {
        date,
        severity,
        alert_type,
        work_centre_id,
        include_acknowledged = 'false',
        limit = 25,
        page = 1,
      } = req.query;

      const now = new Date();
      const alertDate = date || formatDateOnly(now);
      if (!date || alertDate === formatDateOnly(now)) {
        await AlertController._runChecksThrottled(formatDateOnly(now));
      }

      const limitInt = Math.min(Math.max(parseInt(limit, 10) || 25, 1), 200);
      const pageInt = Math.max(parseInt(page, 10) || 1, 1);
      let query = `
        SELECT
          pa.*,
          wc.name AS work_centre_name,
          COALESCE(mc.machine_name, mc.name) AS machine_name,
          CASE WHEN ar.alert_id IS NULL THEN 0 ELSE 1 END AS is_acknowledged,
          ar.read_at AS acknowledged_at,
          u.name AS acknowledged_by
        FROM production_alerts pa
        LEFT JOIN work_centres wc ON wc.id = pa.work_centre_id
        LEFT JOIN machine_centres mc ON mc.machine_id = pa.machine_id
        LEFT JOIN alert_reads ar ON ar.alert_id = pa.id AND ar.user_id = ?
        LEFT JOIN users u ON u.id = ar.user_id
        WHERE pa.alert_date = ?
      `;
      const params = [userId, alertDate];

      if (severity) {
        query += ' AND pa.severity = ?';
        params.push(String(severity));
      }
      if (alert_type) {
        query += ' AND pa.alert_type = ?';
        params.push(String(alert_type));
      }
      if (work_centre_id) {
        query += ' AND pa.work_centre_id = ?';
        params.push(Number(work_centre_id));
      }
      if (String(include_acknowledged).toLowerCase() !== 'true') {
        query += ' AND ar.alert_id IS NULL';
      }

      query += ` ORDER BY
        CASE pa.severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END ASC,
        pa.created_at DESC`;

      const [rows] = await db.execute(query, params);

      let filteredRows = rows;
      // Avoid stale false positives: hide heartbeat alerts once machine activity is healthy again.
      if (alertDate === formatDateOnly(now)) {
        const heartbeatRows = rows.filter((r) => r.alert_type === 'no_scan_heartbeat' && r.machine_id);
        if (heartbeatRows.length > 0) {
          const uniqueMachines = Array.from(new Set(heartbeatRows.map((r) => String(r.machine_id))));
          const placeholders = uniqueMachines.map(() => '?').join(',');
          const [freshHeartbeat] = await db.execute(
            `SELECT
               ms.machine_id,
               latest.target_mins,
               latest.start_time,
               TIMESTAMPDIFF(
                 MINUTE,
                 COALESCE(latest.updated_at, latest.start_time, ms.activated_at),
                 NOW()
               ) AS heartbeat_gap_mins
             FROM mobile_sessions ms
             LEFT JOIN (
               SELECT machine_id, emp_id, MAX(id) AS max_id
               FROM machine_centre_production
               WHERE DATE(prod_date) = ?
               GROUP BY machine_id, emp_id
             ) latest_idx
               ON latest_idx.machine_id = ms.machine_id
               AND latest_idx.emp_id = ms.emp_code
             LEFT JOIN machine_centre_production latest ON latest.id = latest_idx.max_id
             WHERE ms.status = 'active'
               AND DATE(ms.activated_at) = ?
               AND ms.machine_id IN (${placeholders})`,
            [alertDate, alertDate, ...uniqueMachines]
          );
          const gapByMachine = new Map(
            freshHeartbeat.map((r) => [
              String(r.machine_id),
              {
                gap: Number(r.heartbeat_gap_mins || 0),
                targetMins: Number(r.target_mins || 0),
                elapsedFromStart:
                  r.start_time
                    ? Math.max(
                        0,
                        Math.floor(
                          (Date.now() - new Date(r.start_time).getTime()) / 60000
                        )
                      )
                    : null,
              },
            ])
          );
          filteredRows = rows.filter((row) => {
            if (row.alert_type !== 'no_scan_heartbeat' || !row.machine_id) return true;
            const state = gapByMachine.get(String(row.machine_id));
            if (!state) return true;
            // Hide when heartbeat is healthy again.
            if (state.gap < HEARTBEAT_WARN_MINUTES) return false;
            // Hide while cycle is still within expected target window (+ grace),
            // even if there has been no DB write yet.
            if (
              typeof state.elapsedFromStart === 'number' &&
              state.elapsedFromStart < (state.targetMins + OVER_TARGET_GRACE_MINUTES)
            ) {
              return false;
            }
            return true;
          });
        }

        // Hide stale over-target alerts when current running cycle is no longer above target.
        const overTargetRows = filteredRows.filter((r) => r.alert_type === 'over_target' && r.machine_id);
        if (overTargetRows.length > 0) {
          const uniqueMachines = Array.from(new Set(overTargetRows.map((r) => String(r.machine_id))));
          const placeholders = uniqueMachines.map(() => '?').join(',');
          const [currentOverTarget] = await db.execute(
            `SELECT
               mcp.machine_id,
               TIMESTAMPDIFF(MINUTE, mcp.start_time, NOW()) AS actual_mins,
               COALESCE(mcp.target_mins, 0) AS target_mins
             FROM machine_centre_production mcp
             INNER JOIN (
               SELECT machine_id, MAX(id) AS max_id
               FROM machine_centre_production
               WHERE DATE(prod_date) = ?
                 AND button_status IN (1, 3)
                 AND machine_id IN (${placeholders})
               GROUP BY machine_id
             ) latest ON latest.max_id = mcp.id`,
            [alertDate, ...uniqueMachines]
          );
          const stateByMachine = new Map(
            currentOverTarget.map((r) => [
              String(r.machine_id),
              {
                actual: Number(r.actual_mins || 0),
                target: Number(r.target_mins || 0),
              },
            ])
          );
          filteredRows = filteredRows.filter((row) => {
            if (row.alert_type !== 'over_target' || !row.machine_id) return true;
            const state = stateByMachine.get(String(row.machine_id));
            if (!state) return false; // no active cycle now => over-target alert is stale
            return state.target > 0 && state.actual >= (state.target + OVER_TARGET_GRACE_MINUTES);
          });
        }

        // Hide stale machine-offline alerts when machine has an active session now.
        const offlineRows = filteredRows.filter((r) => r.alert_type === 'machine_offline' && r.machine_id);
        if (offlineRows.length > 0) {
          const uniqueMachines = Array.from(new Set(offlineRows.map((r) => String(r.machine_id))));
          const placeholders = uniqueMachines.map(() => '?').join(',');
          const [activeSessions] = await db.execute(
            `SELECT DISTINCT ms.machine_id
             FROM mobile_sessions ms
             WHERE ms.status = 'active'
               AND DATE(ms.activated_at) = ?
               AND ms.machine_id IN (${placeholders})`,
            [alertDate, ...uniqueMachines]
          );
          const activeSet = new Set(activeSessions.map((r) => String(r.machine_id)));
          filteredRows = filteredRows.filter((row) => {
            if (row.alert_type !== 'machine_offline' || !row.machine_id) return true;
            return !activeSet.has(String(row.machine_id));
          });
        }

        // Hide session-specific alerts (over_target, no_scan_heartbeat, idle_too_long, machine_idle)
        // for machines that have no active session today — the session has ended so the alert is stale.
        const sessionAlertTypes = new Set(['over_target', 'no_scan_heartbeat', 'idle_too_long', 'machine_idle']);
        const sessionAlertMachines = Array.from(
          new Set(
            filteredRows
              .filter((r) => sessionAlertTypes.has(r.alert_type) && r.machine_id)
              .map((r) => String(r.machine_id))
          )
        );
        if (sessionAlertMachines.length > 0) {
          const placeholders = sessionAlertMachines.map(() => '?').join(',');
          const [activeSessions] = await db.execute(
            `SELECT DISTINCT ms.machine_id
             FROM mobile_sessions ms
             WHERE ms.status = 'active'
               AND DATE(ms.activated_at) = ?
               AND ms.machine_id IN (${placeholders})`,
            [alertDate, ...sessionAlertMachines]
          );
          const activeSessionMachines = new Set(activeSessions.map((r) => String(r.machine_id)));
          filteredRows = filteredRows.filter((row) => {
            if (!sessionAlertTypes.has(row.alert_type) || !row.machine_id) return true;
            // Only show if the machine currently has an active session.
            return activeSessionMachines.has(String(row.machine_id));
          });
        }
      }

      const totalCount = filteredRows.length;
      const start = (pageInt - 1) * limitInt;
      const end = start + limitInt;
      const pagedRows = filteredRows.slice(start, end);
      const unacked = filteredRows.filter((r) => Number(r.is_acknowledged || 0) === 0).length;
      const totalPages = Math.max(1, Math.ceil(totalCount / limitInt));

      return res.json({
        success: true,
        data: pagedRows,
        unacknowledged_count: unacked,
        pagination: {
          page: pageInt,
          limit: limitInt,
          total: totalCount,
          totalPages,
          hasNextPage: pageInt < totalPages,
          hasPrevPage: pageInt > 1,
        },
      });
    } catch (error) {
      logger.error('getRealtimeCenterAlerts error:', error);
      return res.status(500).json({ success: false, message: error.message });
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

  async acknowledge(req, res) {
    return this.markRead(req, res);
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
        const efficiency = Number(row.avg_efficiency_percent || 0);
        if (row.avg_efficiency_percent < EFFICIENCY_CRIT_THRESHOLD) {
          await AlertController._upsertAlert({
            alert_type: 'efficiency_low', severity: 'critical',
            work_centre_id: row.work_centre_id, machine_id: row.machine_id,
            alert_date: date,
            message: `Machine ${row.machine_id} efficiency critically low at ${toFixedSafe(efficiency, 1)}% (threshold: ${toFixedSafe(EFFICIENCY_CRIT_THRESHOLD, 1)}%)`,
            threshold_value: EFFICIENCY_CRIT_THRESHOLD, actual_value: efficiency
          });
          count++;
        } else if (row.avg_efficiency_percent < EFFICIENCY_WARN_THRESHOLD && allowEndShiftRiskAlerts) {
          await AlertController._upsertAlert({
            alert_type: 'efficiency_low', severity: 'warning',
            work_centre_id: row.work_centre_id, machine_id: row.machine_id,
            alert_date: date,
            message: `Machine ${row.machine_id} efficiency below target at ${toFixedSafe(efficiency, 1)}% (threshold: ${toFixedSafe(EFFICIENCY_WARN_THRESHOLD, 1)}%)`,
            threshold_value: EFFICIENCY_WARN_THRESHOLD, actual_value: efficiency
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
            alert_type: 'idle_too_long',
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

        // 1c. Over-target alerts for running/idle cycles.
        const [overTargetRows] = await db.execute(`
          SELECT
            mcp.work_centre_id,
            mcp.machine_id,
            mcp.emp_id,
            mcp.target_mins,
            TIMESTAMPDIFF(MINUTE, mcp.start_time, NOW()) AS actual_mins
          FROM machine_centre_production mcp
          INNER JOIN (
            SELECT machine_id, MAX(id) AS max_id
            FROM machine_centre_production
            WHERE DATE(prod_date) = ? AND button_status IN (1, 3)
            GROUP BY machine_id
          ) latest ON latest.max_id = mcp.id
          WHERE DATE(mcp.prod_date) = ?
            AND mcp.start_time IS NOT NULL
            AND COALESCE(mcp.target_mins, 0) > 0
            AND TIMESTAMPDIFF(MINUTE, mcp.start_time, NOW()) >= (mcp.target_mins + ?)
        `, [date, date, OVER_TARGET_GRACE_MINUTES]);

        for (const row of overTargetRows) {
          const actualMins = Number(row.actual_mins || 0);
          const targetMins = Number(row.target_mins || 0);
          const delta = Math.max(0, actualMins - targetMins);
          await AlertController._upsertAlert({
            alert_type: 'over_target',
            severity: delta >= 10 ? 'critical' : 'warning',
            work_centre_id: row.work_centre_id,
            machine_id: row.machine_id,
            alert_date: date,
            message: `Machine ${row.machine_id} cycle exceeded target by ${toFixedSafe(delta, 1)} min (actual ${toFixedSafe(actualMins, 1)} vs target ${toFixedSafe(targetMins, 1)})`,
            threshold_value: targetMins,
            actual_value: actualMins,
          });
          count++;
        }

        // 1d. No-scan heartbeat alerts: active session but no recent production updates.
        const [heartbeatRows] = await db.execute(`
          SELECT
            ms.work_centre_id,
            ms.machine_id,
            ms.emp_code,
            latest.target_mins,
            latest.start_time,
            TIMESTAMPDIFF(
              MINUTE,
              COALESCE(latest.updated_at, latest.start_time, ms.activated_at),
              NOW()
            ) AS heartbeat_gap_mins
          FROM mobile_sessions ms
          LEFT JOIN (
            SELECT machine_id, emp_id, MAX(id) AS max_id
            FROM machine_centre_production
            WHERE DATE(prod_date) = ?
            GROUP BY machine_id, emp_id
          ) latest_idx
            ON latest_idx.machine_id = ms.machine_id
            AND latest_idx.emp_id = ms.emp_code
          LEFT JOIN machine_centre_production latest ON latest.id = latest_idx.max_id
          WHERE ms.status = 'active'
            AND DATE(ms.activated_at) = ?
            -- Avoid false positives while an active cycle is still within target time.
            -- "Finish pending" should alert only when cycle is expected to be done.
            AND (
              latest.id IS NULL
              OR latest.start_time IS NULL
              OR TIMESTAMPDIFF(
                MINUTE,
                latest.start_time,
                NOW()
              ) >= (COALESCE(latest.target_mins, 0) + ?)
            )
            AND TIMESTAMPDIFF(
              MINUTE,
              COALESCE(latest.updated_at, latest.start_time, ms.activated_at),
              NOW()
            ) >= ?
        `, [date, date, OVER_TARGET_GRACE_MINUTES, HEARTBEAT_WARN_MINUTES]);

        for (const row of heartbeatRows) {
          await AlertController._upsertAlert({
            alert_type: 'no_scan_heartbeat',
            severity: Number(row.heartbeat_gap_mins || 0) >= (HEARTBEAT_WARN_MINUTES * 2) ? 'critical' : 'warning',
            work_centre_id: row.work_centre_id,
            machine_id: row.machine_id,
            alert_date: date,
            message: `Machine ${row.machine_id} has no cycle update for ${row.heartbeat_gap_mins} minutes (Finish/next action may be pending)`,
            threshold_value: HEARTBEAT_WARN_MINUTES,
            actual_value: row.heartbeat_gap_mins,
          });
          count++;
        }

        // 1e. Machine offline alerts: planned work-centre machine has no active session.
        const [offlineRows] = await db.execute(`
          SELECT mc.work_centre_id, mc.machine_id, COALESCE(mc.machine_name, mc.name) AS machine_name
          FROM machine_centres mc
          INNER JOIN production_plan pp
            ON pp.work_centre_id = mc.work_centre_id
           AND DATE(pp.plan_date) = ?
           AND pp.deleted_at IS NULL
          LEFT JOIN mobile_sessions ms
            ON ms.machine_id = mc.machine_id
           AND ms.status = 'active'
           AND DATE(ms.activated_at) = ?
          WHERE ms.session_id IS NULL
          GROUP BY mc.work_centre_id, mc.machine_id, COALESCE(mc.machine_name, mc.name)
        `, [date, date]);

        for (const row of offlineRows) {
          await AlertController._upsertAlert({
            alert_type: 'machine_offline',
            severity: 'critical',
            work_centre_id: row.work_centre_id,
            machine_id: row.machine_id,
            alert_date: date,
            message: `Machine ${row.machine_id}${row.machine_name ? ` - ${row.machine_name}` : ''} appears offline (no active session for planned line)`,
            threshold_value: 1,
            actual_value: 0,
          });
          count++;
        }

        // Resolve previously raised offline alerts as soon as an active session exists.
        await db.execute(
          `DELETE pa
           FROM production_alerts pa
           INNER JOIN mobile_sessions ms
             ON ms.machine_id = pa.machine_id
            AND ms.status = 'active'
            AND DATE(ms.activated_at) = ?
           WHERE pa.alert_type = 'machine_offline'
             AND pa.alert_date = ?`,
          [date, date]
        );
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

      // Email digest intentionally disabled.
    } catch (err) {
      // Log full details to diagnose silent failures (some errors have empty message).
      const e = err || {};
      logger.error('Alert _runChecks error', {
        date,
        message: e.message || String(e),
        name: e.name,
        code: e.code,
        errno: e.errno,
        sqlState: e.sqlState,
        sqlMessage: e.sqlMessage,
        stack: e.stack,
      });
    }
    return count;
  }

  // Upsert alert — avoid duplicate alerts for same type/machine/date
  static async _upsertAlert({ alert_type, severity, work_centre_id, machine_id, alert_date, message, threshold_value, actual_value }) {
    const wcId = work_centre_id || null;
    const machineId = machine_id || null;
    const threshold = threshold_value || null;
    const actual = actual_value || null;

    // Null-safe dedupe first. This handles machine_id = NULL alerts (e.g., headcount/target-at-risk)
    // where MySQL UNIQUE constraints allow multiple NULL rows.
    const [updateResult] = await db.execute(`
      UPDATE production_alerts
      SET severity = ?,
          message = ?,
          threshold_value = ?,
          actual_value = ?,
          is_read = 0,
          created_at = NOW()
      WHERE alert_type = ?
        AND work_centre_id <=> ?
        AND machine_id <=> ?
        AND alert_date = ?
      LIMIT 1
    `, [
      severity,
      message,
      threshold,
      actual,
      alert_type,
      wcId,
      machineId,
      alert_date,
    ]);

    if (updateResult.affectedRows > 0) {
      return;
    }

    await db.execute(`
      INSERT INTO production_alerts 
        (alert_type, severity, work_centre_id, machine_id, alert_date, message, threshold_value, actual_value, is_read)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
    `, [
      alert_type,
      severity,
      wcId,
      machineId,
      alert_date,
      message,
      threshold,
      actual,
    ]);
  }
}

module.exports = new AlertController();
module.exports.runChecks = AlertController._runChecks;
