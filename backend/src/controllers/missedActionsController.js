const db = require('../../config/database');
const logger = require('../utils/logger');
const idleReminderSettings = require('../services/idleReminderSettingsService');
const { computeCycleNetLostMins } = require('../utils/cycleLossMins');

const getIssueKey = (row, actionType) => `${row.session_id}__${row.machine_id}__${row.emp_code || 'NA'}__${actionType}`;

const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const SHIFT_START_HOUR = parseInt(process.env.SHIFT_START_HOUR || '9', 10);
/** Production starts after morning prayer (default 9:05). */
const SHIFT_START_MINUTE = parseInt(process.env.SHIFT_START_MINUTE || '5', 10);
/** Late-cycle / daily inactive gap allowance — separate from mobile reminder sound (Reminder Settings). */
const LATE_CYCLE_GRACE_SECS = Math.max(1, parseInt(process.env.LATE_CYCLE_GRACE_SECS || '40', 10));
const SHIFT_END_HOUR = parseInt(process.env.SHIFT_END_HOUR || '17', 10);
const SHIFT_END_MINUTE = parseInt(process.env.SHIFT_END_MINUTE || '35', 10);
const LUNCH_START_HOUR = parseInt(process.env.LUNCH_START_HOUR || '13', 10);
const LUNCH_START_MINUTE = parseInt(process.env.LUNCH_START_MINUTE || '30', 10);
const LUNCH_END_HOUR = parseInt(process.env.LUNCH_END_HOUR || '14', 10);
const LUNCH_END_MINUTE = parseInt(process.env.LUNCH_END_MINUTE || '0', 10);

const overlapMinutes = (aStart, aEnd, bStart, bEnd) => {
  const start = Math.max(aStart.getTime(), bStart.getTime());
  const end = Math.min(aEnd.getTime(), bEnd.getTime());
  if (end <= start) return 0;
  return (end - start) / 60000;
};

const computeShiftInactiveMinutes = ({ baselineTs, startTs, startReminderSecs }) => {
  if (!baselineTs || !startTs) return 0;
  if (!Number.isFinite(startTs.getTime()) || !Number.isFinite(baselineTs.getTime())) return 0;

  const shiftStart = new Date(startTs);
  shiftStart.setHours(SHIFT_START_HOUR, SHIFT_START_MINUTE, 0, 0);
  const shiftEnd = new Date(startTs);
  shiftEnd.setHours(SHIFT_END_HOUR, SHIFT_END_MINUTE, 0, 0);

  const lunchStart = new Date(startTs);
  lunchStart.setHours(LUNCH_START_HOUR, LUNCH_START_MINUTE, 0, 0);
  const lunchEnd = new Date(startTs);
  lunchEnd.setHours(LUNCH_END_HOUR, LUNCH_END_MINUTE, 0, 0);

  const effectiveStart = new Date(Math.max(baselineTs.getTime(), shiftStart.getTime()));
  const effectiveEnd = new Date(Math.min(startTs.getTime(), shiftEnd.getTime()));
  if (effectiveEnd <= effectiveStart) return 0;

  const rawGapMins = (effectiveEnd.getTime() - effectiveStart.getTime()) / 60000;
  const lunchOverlapMins = overlapMinutes(effectiveStart, effectiveEnd, lunchStart, lunchEnd);
  const gapExcludingLunch = Math.max(0, rawGapMins - lunchOverlapMins);

  const graceMins = Math.max(0, Number(startReminderSecs) || 0) / 60;
  return Math.max(0, gapExcludingLunch - graceMins);
};

const formatShiftStartLabel = () => `${String(SHIFT_START_HOUR).padStart(2, '0')}:${String(SHIFT_START_MINUTE).padStart(2, '0')}`;

const resolveMachineIdAliases = async (raw) => {
  const key = String(raw || '').trim();
  if (!key) return [];
  const aliases = new Set([key]);
  const [rows] = await db.query(
    `SELECT machine_id, code, name
     FROM machine_centres
     WHERE machine_id = ? OR code = ? OR name = ?`,
    [key, key, key]
  );
  rows.forEach((row) => {
    if (row.machine_id != null) aliases.add(String(row.machine_id));
    if (row.code) aliases.add(String(row.code));
  });
  return [...aliases];
};

const machineKeysMatch = (left, right) => {
  const a = String(left ?? '').trim();
  const b = String(right ?? '').trim();
  if (!a || !b) return false;
  if (a === b) return true;
  const na = Number(a);
  const nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb) && na === nb) return true;
  return false;
};

const machineRowMatchesAliases = (rowMachineId, aliases) =>
  aliases.some((alias) => machineKeysMatch(rowMachineId, alias));

const queryDailyCycleEvents = async (dateFrom, dateTo) => {
  const [rows] = await db.query(
    `
    SELECT
      mcp.id,
      mcp.work_centre_id,
      wc.name AS work_centre_name,
      mcp.machine_id,
      mc.machine_name,
      mcp.output_pairs,
      mcp.emp_id,
      e.code AS employee_code,
      e.name AS employee_name,
      mcp.start_time,
      mcp.finish_time,
      mcp.target_mins,
      TIMESTAMPDIFF(MINUTE, mcp.start_time, mcp.finish_time) AS actual_mins,
      LAG(mcp.finish_time) OVER (
        PARTITION BY mcp.machine_id, DATE(mcp.prod_date)
        ORDER BY mcp.start_time
      ) AS prev_finish_time,
      mas.root_cause
    FROM machine_centre_production mcp
    LEFT JOIN work_centres wc ON wc.id = mcp.work_centre_id
    LEFT JOIN machine_centres mc ON mc.machine_id = mcp.machine_id
    LEFT JOIN employees e ON e.code = mcp.emp_id
    LEFT JOIN missed_action_states mas ON mas.issue_key = CONCAT('daily__', mcp.id)
    WHERE DATE(mcp.prod_date) BETWEEN ? AND ?
      AND mcp.button_status = 2
      AND mcp.start_time IS NOT NULL
      AND mcp.finish_time IS NOT NULL
    ORDER BY wc.name, mcp.machine_id, mcp.start_time
    `,
    [dateFrom, dateTo]
  );

  return rows.map((row) => {
    const actualMins = toNumber(row.actual_mins, 0);
    const targetMins = toNumber(row.target_mins, 0);
    const extraMins = Math.max(0, actualMins - targetMins);
    const startTs = new Date(row.start_time);
    const shiftStart = new Date(startTs);
    shiftStart.setHours(SHIFT_START_HOUR, SHIFT_START_MINUTE, 0, 0);
    const baselineTs = row.prev_finish_time ? new Date(row.prev_finish_time) : shiftStart;
    const gapMins = Math.max(0, toNumber((startTs.getTime() - baselineTs.getTime()) / 60000, 0));
    const inactiveMins = computeShiftInactiveMinutes({
      baselineTs,
      startTs,
      startReminderSecs: LATE_CYCLE_GRACE_SECS,
    });
    const lostMins = computeCycleNetLostMins(inactiveMins, targetMins, actualMins);

    return {
      id: row.id,
      work_centre_id: row.work_centre_id,
      work_centre_name: row.work_centre_name || 'N/A',
      machine_id: row.machine_id,
      machine_name: row.machine_name || row.machine_id || 'N/A',
      output_pairs: toNumber(row.output_pairs, 0),
      employee_code: row.employee_code || 'N/A',
      employee_name: row.employee_name || row.employee_code || 'N/A',
      start_time: row.start_time,
      finish_time: row.finish_time,
      target_mins: targetMins,
      actual_mins: actualMins,
      extra_mins: extraMins,
      start_gap_mins: gapMins,
      inactive_mins: inactiveMins,
      lost_mins: lostMins,
      root_cause: row.root_cause || null,
    };
  });
};

const parseActionRows = (rows, settingsMap, defaultFinishGraceMins, now = new Date()) => {
  const data = [];

  rows.forEach((row) => {
    const machineSettings = idleReminderSettings.resolveForMachine(settingsMap, row.machine_id);
    const startReminderSecs = LATE_CYCLE_GRACE_SECS;
    const finishGraceMins = machineSettings.finish_grace_mins ?? defaultFinishGraceMins;
    const minsSinceActivation = toNumber(row.mins_since_activation, 0);
    const minsSinceFinish = toNumber(row.mins_since_finish, 0);
    const minsSinceStart = toNumber(row.mins_since_start, 0);
    const targetMins = toNumber(row.target_mins, 0);
    const hasProductionRow = !!row.production_id;
    const isRunning = Number(row.button_status) === 1;
    const hasUnfinishedCycle = hasProductionRow && Number(row.button_status) !== 2;
    const hasFinishedCycleAfterSession = hasProductionRow
      && Number(row.button_status) === 2
      && row.last_finish_time
      && row.activated_at
      && new Date(row.last_finish_time).getTime() >= new Date(row.activated_at).getTime();
    const hasAnyCycleActivityAfterSession = hasProductionRow && (
      (row.start_time && row.activated_at && new Date(row.start_time).getTime() >= new Date(row.activated_at).getTime())
      || hasFinishedCycleAfterSession
    );

    let actionType = null;
    let overdueMins = 0;
    let message = '';

    // Forgot START: active session but no current cycle, or last cycle finished long ago.
    if (hasUnfinishedCycle) {
      // Active unfinished cycle exists => definitely not "start not clicked".
      if (isRunning && targetMins > 0 && minsSinceStart > targetMins + finishGraceMins) {
        // Forgot FINISH: running cycle exceeded target (plus grace).
        actionType = 'FINISH_PENDING';
        overdueMins = minsSinceStart - (targetMins + finishGraceMins);
        message = `Cycle running for ${minsSinceStart} mins (target ${targetMins} mins).`;
      }
    } else if (hasFinishedCycleAfterSession) {
      const finishTs = row.last_finish_time ? new Date(row.last_finish_time) : null;
      if (!finishTs || !Number.isFinite(finishTs.getTime())) return;
      const shiftOverdueMins = computeShiftInactiveMinutes({
        baselineTs: finishTs,
        startTs: now,
        startReminderSecs,
      });
      if (shiftOverdueMins <= 0) return;
      actionType = 'START_PENDING';
      overdueMins = shiftOverdueMins;
      message = `Last cycle finished ${minsSinceFinish} mins ago; next cycle not started.`;
    } else if (!hasAnyCycleActivityAfterSession) {
      const activatedAt = row.activated_at ? new Date(row.activated_at) : null;
      if (!activatedAt || !Number.isFinite(activatedAt.getTime())) return;
      const shiftOverdueMins = computeShiftInactiveMinutes({
        baselineTs: activatedAt,
        startTs: now,
        startReminderSecs,
      });
      if (shiftOverdueMins <= 0) return;
      actionType = 'START_PENDING';
      overdueMins = shiftOverdueMins;
      message = `No cycle started since shift ${formatShiftStartLabel()} (logged in ${minsSinceActivation} min ago).`;
    }

    if (actionType) {
      const issueKey = getIssueKey(row, actionType);
      data.push({
        issue_key: issueKey,
        session_id: row.session_id,
        machine_id: row.machine_id,
        machine_name: row.machine_name || row.machine_id,
        employee_code: row.emp_code,
        employee_name: row.employee_name || row.emp_code || 'N/A',
        work_centre_name: row.work_centre_name || 'N/A',
        action_type: actionType,
        action_label: actionType === 'START_PENDING' ? 'Start not clicked' : 'Finish not clicked',
        overdue_mins: Math.max(0, overdueMins),
        details: message,
        mins_since_activation: minsSinceActivation,
        mins_since_start: row.mins_since_start,
        mins_since_finish: row.mins_since_finish,
        target_mins: targetMins,
      });
    }
  });

  return data;
};

exports.getMissedActions = async (req, res, next) => {
  try {
    const finishGraceMins = Math.max(0, Number(req.query.finishGraceMins) || 0);
    // Prevent stale "active" sessions from previous shifts/days from polluting today's dashboard.
    // Default keeps current-day sessions and a small lookback window for midnight edge cases.
    const sessionLookbackHours = Math.max(1, Number(req.query.sessionLookbackHours) || 8);

    const [rows] = await db.query(
      `
      SELECT
        ms.session_id,
        ms.machine_id,
        ms.emp_code,
        ms.activated_at,
        wc.name AS work_centre_name,
        mc.machine_name,
        e.name AS employee_name,
        lr.id AS production_id,
        lr.button_status,
        lr.target_mins,
        lr.start_time,
        lr.finish_time AS last_finish_time,
        TIMESTAMPDIFF(MINUTE, ms.activated_at, NOW()) AS mins_since_activation,
        CASE WHEN lr.start_time IS NOT NULL THEN TIMESTAMPDIFF(MINUTE, lr.start_time, NOW()) ELSE NULL END AS mins_since_start,
        CASE
          WHEN lr.finish_time IS NOT NULL AND lr.finish_time >= ms.activated_at
          THEN TIMESTAMPDIFF(MINUTE, lr.finish_time, NOW())
          ELSE NULL
        END AS mins_since_finish
      FROM mobile_sessions ms
      LEFT JOIN (
        SELECT p1.*
        FROM machine_centre_production p1
        INNER JOIN (
          SELECT machine_id, MAX(created_at) AS max_created
          FROM machine_centre_production
          GROUP BY machine_id
        ) p2 ON p1.machine_id = p2.machine_id AND p1.created_at = p2.max_created
      ) lr ON lr.machine_id = ms.machine_id
      LEFT JOIN machine_centres mc ON mc.machine_id = ms.machine_id
      LEFT JOIN work_centres wc ON wc.id = COALESCE(ms.work_centre_id, lr.work_centre_id)
      LEFT JOIN employees e ON e.code = ms.emp_code
      WHERE ms.status = 'active'
        AND ms.activated_at >= DATE_SUB(CURDATE(), INTERVAL ? HOUR)
        AND NOT EXISTS (
          SELECT 1 FROM machine_centre_production m
          WHERE m.machine_id = ms.machine_id
            AND m.emp_id = ms.emp_code
            AND m.button_status = 2
            AND m.stoppage_reason LIKE 'MANUAL:%'
            AND m.start_time <= NOW()
            AND m.finish_time >= NOW()
        )
      ORDER BY ms.machine_id ASC
      `
      ,
      [sessionLookbackHours]
    );

    const settingsMap = await idleReminderSettings.getMapByMachineId();
    const now = new Date();
    const data = parseActionRows(rows, settingsMap, finishGraceMins, now);
    const issueKeys = data.map((i) => i.issue_key);
    const stateByKey = {};
    if (issueKeys.length > 0) {
      const placeholders = issueKeys.map(() => '?').join(',');
      const [states] = await db.query(
        `SELECT issue_key, acknowledged_at, acknowledged_by, snoozed_until, snooze_duration_mins, root_cause FROM missed_action_states WHERE issue_key IN (${placeholders})`,
        issueKeys
      );
      states.forEach((state) => {
        stateByKey[state.issue_key] = {
          acknowledged_at: state.acknowledged_at,
          acknowledged_by: state.acknowledged_by,
          snoozed_until: state.snoozed_until,
          snooze_duration_mins: state.snooze_duration_mins,
          root_cause: state.root_cause,
        };
      });
    }

    const nowMs = now.getTime();
    const dataWithState = data.map((item) => {
      const state = stateByKey[item.issue_key] || null;
      const snoozedUntilTs = state?.snoozed_until ? new Date(state.snoozed_until).getTime() : null;
      return {
        ...item,
        state: {
          acknowledged: !!state?.acknowledged_at,
          acknowledged_at: state?.acknowledged_at || null,
          acknowledged_by: state?.acknowledged_by || null,
          snoozed_until: state?.snoozed_until || null,
          snooze_duration_mins: state?.snooze_duration_mins || null,
          is_snoozed: !!(snoozedUntilTs && snoozedUntilTs > nowMs),
          root_cause: state?.root_cause || null,
        },
      };
    });

    res.json({
      success: true,
      data: dataWithState,
      summary: {
        total: dataWithState.length,
        start_pending: dataWithState.filter((i) => i.action_type === 'START_PENDING').length,
        finish_pending: dataWithState.filter((i) => i.action_type === 'FINISH_PENDING').length,
      },
      thresholds: {
        lateCycleGraceSecs: LATE_CYCLE_GRACE_SECS,
        shiftStart: formatShiftStartLabel(),
        finishGraceMins,
        sessionLookbackHours,
      },
    });
  } catch (error) {
    logger.error('Error getting missed actions:', error);
    next(error);
  }
};

exports.unmuteAction = async (req, res, next) => {
  try {
    const issueKey = String(req.body?.issue_key || '').trim();
    if (!issueKey) return res.status(400).json({ success: false, error: 'issue_key is required' });
    await db.query(
      `INSERT INTO missed_action_states (issue_key, acknowledged_at, snoozed_until, updated_at)
       VALUES (?, NULL, NULL, NOW())
       ON DUPLICATE KEY UPDATE acknowledged_at = NULL, snoozed_until = NULL, updated_at = NOW()`,
      [issueKey]
    );
    return res.json({ success: true });
  } catch (error) {
    logger.error('Error unmuting missed action:', error);
    return next(error);
  }
};

exports.acknowledgeMissedAction = async (req, res, next) => {
  try {
    const issueKey = String(req.body?.issue_key || '').trim();
    if (!issueKey) {
      return res.status(400).json({ success: false, error: 'issue_key is required' });
    }
    const acknowledgedBy = req.user?.username || req.user?.name || req.user?.id || null;
    await db.query(
      `INSERT INTO missed_action_states (issue_key, acknowledged_at, acknowledged_by, snoozed_until, updated_at)
       VALUES (?, NOW(), ?, NULL, NOW())
       ON DUPLICATE KEY UPDATE acknowledged_at = NOW(), acknowledged_by = ?, snoozed_until = NULL, updated_at = NOW()`,
      [issueKey, acknowledgedBy, acknowledgedBy]
    );
    return res.json({ success: true });
  } catch (error) {
    logger.error('Error acknowledging missed action:', error);
    return next(error);
  }
};

exports.snoozeMissedAction = async (req, res, next) => {
  try {
    const issueKey = String(req.body?.issue_key || '').trim();
    const mins = Math.max(1, Number(req.body?.minutes) || 30);
    if (!issueKey) {
      return res.status(400).json({ success: false, error: 'issue_key is required' });
    }
    await db.query(
      `INSERT INTO missed_action_states (issue_key, acknowledged_at, snoozed_until, snooze_duration_mins, updated_at)
       VALUES (?, NULL, DATE_ADD(NOW(), INTERVAL ? MINUTE), ?, NOW())
       ON DUPLICATE KEY UPDATE acknowledged_at = NULL, snoozed_until = DATE_ADD(NOW(), INTERVAL ? MINUTE), snooze_duration_mins = ?, updated_at = NOW()`,
      [issueKey, mins, mins, mins, mins]
    );
    return res.json({ success: true });
  } catch (error) {
    logger.error('Error snoozing missed action:', error);
    return next(error);
  }
};

exports.saveRootCause = async (req, res, next) => {
  try {
    const issueKey = String(req.body?.issue_key || '').trim();
    const rootCause = String(req.body?.root_cause || '').trim();
    if (!issueKey) {
      return res.status(400).json({ success: false, error: 'issue_key is required' });
    }
    await db.query(
      `INSERT INTO missed_action_states (issue_key, root_cause, updated_at)
       VALUES (?, ?, NOW())
       ON DUPLICATE KEY UPDATE root_cause = ?, updated_at = NOW()`,
      [issueKey, rootCause || null, rootCause || null]
    );
    return res.json({ success: true });
  } catch (error) {
    logger.error('Error saving root cause:', error);
    return next(error);
  }
};

exports.cleanupStaleStates = async (req, res, next) => {
  try {
    const retentionDays = Math.max(1, Number(req.query?.days) || 7);
    const [result] = await db.query(
      `DELETE FROM missed_action_states
       WHERE updated_at < DATE_SUB(NOW(), INTERVAL ? DAY)
         AND (acknowledged_at IS NOT NULL OR (snoozed_until IS NOT NULL AND snoozed_until < NOW()))`,
      [retentionDays]
    );
    return res.json({ success: true, deleted: result.affectedRows });
  } catch (error) {
    logger.error('Error cleaning up stale missed action states:', error);
    return next(error);
  }
};

exports.getWeeklyTrend = async (req, res, next) => {
  try {
    const rawDate = String(req.query?.date || '');
    const endDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : new Date().toISOString().slice(0, 10);
    const [rows] = await db.query(
      `
      SELECT
        DATE(mcp.prod_date) AS day,
        COUNT(*) AS cycles,
        SUM(GREATEST(0, TIMESTAMPDIFF(MINUTE, mcp.start_time, mcp.finish_time) - mcp.target_mins)) AS extra_mins
      FROM machine_centre_production mcp
      WHERE DATE(mcp.prod_date) BETWEEN DATE_SUB(?, INTERVAL 6 DAY) AND ?
        AND mcp.button_status = 2
        AND mcp.start_time IS NOT NULL
        AND mcp.finish_time IS NOT NULL
      GROUP BY DATE(mcp.prod_date)
      ORDER BY day ASC
      `,
      [endDate, endDate]
    );

    // Compute inactive per day safely in JS using the same logic as getMissedActionsDailyReport
    const [cycleRows] = await db.query(
      `SELECT machine_id, prod_date, start_time, finish_time, target_mins,
        LAG(finish_time) OVER (PARTITION BY machine_id, DATE(prod_date) ORDER BY start_time) AS prev_finish
       FROM machine_centre_production
       WHERE DATE(prod_date) BETWEEN DATE_SUB(?, INTERVAL 6 DAY) AND ?
         AND button_status = 2 AND start_time IS NOT NULL AND finish_time IS NOT NULL`,
      [endDate, endDate]
    );
    const inactiveByDay = {};
    const lostByDay = {};
    cycleRows.forEach((r) => {
      const day = r.prod_date instanceof Date ? r.prod_date.toISOString().slice(0, 10) : String(r.prod_date).slice(0, 10);
      const startTs = new Date(r.start_time);
      const finishTs = new Date(r.finish_time);
      const actualMins = Math.max(0, (finishTs.getTime() - startTs.getTime()) / 60000);
      const targetMins = Math.max(0, toNumber(r.target_mins, 0));
      const shiftStart = new Date(startTs); shiftStart.setHours(SHIFT_START_HOUR, SHIFT_START_MINUTE, 0, 0);
      const baseline = r.prev_finish ? new Date(r.prev_finish) : shiftStart;
      const inactive = computeShiftInactiveMinutes({
        baselineTs: baseline,
        startTs,
        startReminderSecs: LATE_CYCLE_GRACE_SECS,
      });
      inactiveByDay[day] = (inactiveByDay[day] || 0) + inactive;
      const netLost = computeCycleNetLostMins(inactive, targetMins, actualMins);
      lostByDay[day] = (lostByDay[day] || 0) + netLost;
    });

    const trend = rows.map((r) => {
      const day = r.day instanceof Date ? r.day.toISOString().slice(0, 10) : String(r.day);
      const inactive = Math.max(0, inactiveByDay[day] || 0);
      const extra = Math.max(0, Number(r.extra_mins || 0));
      const lost = Math.round(lostByDay[day] || 0);
      return { day, cycles: Number(r.cycles || 0), inactive_mins: inactive, extra_mins: extra, lost_mins: lost };
    });

    return res.json({ success: true, trend });
  } catch (error) {
    logger.error('Error getting weekly trend:', error);
    return next(error);
  }
};

exports.getMissedActionsDailyReport = async (req, res, next) => {
  try {
    const rawFrom = String(req.query?.date_from || req.query?.date || '');
    const rawTo   = String(req.query?.date_to   || req.query?.date || '');
    const dateFrom = /^\d{4}-\d{2}-\d{2}$/.test(rawFrom) ? rawFrom : new Date().toISOString().slice(0, 10);
    const dateTo   = /^\d{4}-\d{2}-\d{2}$/.test(rawTo)   ? rawTo   : dateFrom;
    const lineFilter = String(req.query?.line || 'all');
    const requestedMachineId = String(req.query?.machine_id || '').trim();
    const userRole = String(req.user?.role || '');

    const [rows] = await db.query(
      `
      SELECT
        mcp.id,
        mcp.work_centre_id,
        wc.name AS work_centre_name,
        mcp.machine_id,
        mc.machine_name,
        mcp.output_pairs,
        mcp.emp_id,
        e.code AS employee_code,
        e.name AS employee_name,
        mcp.start_time,
        mcp.finish_time,
        mcp.target_mins,
        TIMESTAMPDIFF(MINUTE, mcp.start_time, mcp.finish_time) AS actual_mins,
        LAG(mcp.finish_time) OVER (
          PARTITION BY mcp.machine_id, DATE(mcp.prod_date)
          ORDER BY mcp.start_time
        ) AS prev_finish_time,
        mas.root_cause
      FROM machine_centre_production mcp
      LEFT JOIN work_centres wc ON wc.id = mcp.work_centre_id
      LEFT JOIN machine_centres mc ON mc.machine_id = mcp.machine_id
      LEFT JOIN employees e ON e.code = mcp.emp_id
      LEFT JOIN missed_action_states mas ON mas.issue_key = CONCAT('daily__', mcp.id)
      WHERE DATE(mcp.prod_date) BETWEEN ? AND ?
        AND mcp.button_status = 2
        AND mcp.start_time IS NOT NULL
        AND mcp.finish_time IS NOT NULL
      ORDER BY wc.name, mcp.machine_id, mcp.start_time
      `,
      [dateFrom, dateTo]
    );

    const mapped = rows.map((row) => {
      const actualMins = toNumber(row.actual_mins, 0);
      const targetMins = toNumber(row.target_mins, 0);
      const extraMins = Math.max(0, actualMins - targetMins);
      const startTs = new Date(row.start_time);
      const shiftStart = new Date(startTs);
      shiftStart.setHours(SHIFT_START_HOUR, SHIFT_START_MINUTE, 0, 0);
      const baselineTs = row.prev_finish_time ? new Date(row.prev_finish_time) : shiftStart;
      const gapMins = Math.max(0, toNumber((startTs.getTime() - baselineTs.getTime()) / 60000, 0));
      const inactiveMins = computeShiftInactiveMinutes({
        baselineTs,
        startTs,
        startReminderSecs: LATE_CYCLE_GRACE_SECS,
      });
      const lostMins = computeCycleNetLostMins(inactiveMins, targetMins, actualMins);

      return {
        id: row.id,
        work_centre_id: row.work_centre_id,
        work_centre_name: row.work_centre_name || 'N/A',
        machine_id: row.machine_id,
        machine_name: row.machine_name || row.machine_id || 'N/A',
        output_pairs: toNumber(row.output_pairs, 0),
        employee_code: row.employee_code || 'N/A',
        employee_name: row.employee_name || row.employee_code || 'N/A',
        start_time: row.start_time,
        finish_time: row.finish_time,
        target_mins: targetMins,
        actual_mins: actualMins,
        extra_mins: extraMins,
        start_gap_mins: gapMins,
        inactive_mins: inactiveMins,
        lost_mins: lostMins,
        root_cause: row.root_cause || null,
      };
    });

    let scoped = mapped;

    if (userRole === 'Machine Centre User') {
      const userAliases = await resolveMachineIdAliases(req.user?.machine_id);
      if (userAliases.length === 0) {
        return res.status(403).json({ success: false, message: 'No machine assigned to this user' });
      }
      if (requestedMachineId) {
        const requestAliases = await resolveMachineIdAliases(requestedMachineId);
        const allowed = requestAliases.some((alias) => userAliases.includes(alias));
        if (!allowed) {
          return res.status(403).json({ success: false, message: 'Access denied for this machine' });
        }
        scoped = mapped.filter((row) => machineRowMatchesAliases(row.machine_id, requestAliases));
      } else {
        scoped = mapped.filter((row) => machineRowMatchesAliases(row.machine_id, userAliases));
      }
    } else if (requestedMachineId) {
      const requestAliases = await resolveMachineIdAliases(requestedMachineId);
      scoped = mapped.filter((row) => machineRowMatchesAliases(row.machine_id, requestAliases));
    }

    const filtered = lineFilter === 'all'
      ? scoped
      : scoped.filter((row) => String(row.work_centre_name) === lineFilter);

    const byLineMap = new Map();
    filtered.forEach((row) => {
      const key = row.work_centre_name || 'N/A';
      if (!byLineMap.has(key)) {
        byLineMap.set(key, {
          work_centre_name: key,
          cycles: 0,
          inactive_mins: 0,
          extra_mins: 0,
          lost_mins: 0,
        });
      }
      const agg = byLineMap.get(key);
      agg.cycles += 1;
      agg.inactive_mins += row.inactive_mins;
      agg.extra_mins += row.extra_mins;
      agg.lost_mins += row.lost_mins;
    });

    const byLine = Array.from(byLineMap.values()).sort((a, b) => b.lost_mins - a.lost_mins);
    const totalInactive = filtered.reduce((sum, r) => sum + r.inactive_mins, 0);
    const totalExtra = filtered.reduce((sum, r) => sum + r.extra_mins, 0);
    const totalLost = filtered.reduce((sum, r) => sum + r.lost_mins, 0);

    return res.json({
      success: true,
      date: dateFrom,
      date_from: dateFrom,
      date_to: dateTo,
      thresholds: {
        late_cycle_grace_secs: LATE_CYCLE_GRACE_SECS,
        shift_start: formatShiftStartLabel(),
      },
      summary: {
        total_cycles: filtered.length,
        total_inactive_mins: totalInactive,
        total_extra_mins: totalExtra,
        total_lost_mins: totalLost,
      },
      by_line: byLine,
      events: filtered,
    });
  } catch (error) {
    logger.error('Error getting missed actions daily report:', error);
    return next(error);
  }
};

/** Public mobile floor endpoint — no JWT; scoped by machine (+ optional session). */
exports.getMachineDailyCycles = async (req, res, next) => {
  try {
    const machineParam = String(req.params.machineId || '').trim();
    if (!machineParam) {
      return res.status(400).json({ success: false, message: 'machineId is required' });
    }

    const rawDate = String(req.query?.date || req.query?.date_from || '');
    const dateKey = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : new Date().toISOString().slice(0, 10);
    const sessionId = String(req.query?.session || '').trim();

    const requestAliases = await resolveMachineIdAliases(machineParam);
    if (requestAliases.length === 0) {
      return res.status(404).json({ success: false, message: 'Machine not found' });
    }

    if (sessionId) {
      const [sessionRows] = await db.query(
        `SELECT machine_id FROM mobile_sessions WHERE session_id = ? AND status = 'active' LIMIT 1`,
        [sessionId]
      );
      if (sessionRows.length) {
        const sessionAliases = await resolveMachineIdAliases(sessionRows[0].machine_id);
        const sessionMatches = sessionAliases.some((alias) => requestAliases.includes(alias));
        if (!sessionMatches) {
          return res.status(403).json({ success: false, message: 'Session does not match this machine' });
        }
      }
    }

    const allEvents = await queryDailyCycleEvents(dateKey, dateKey);
    const events = allEvents.filter((row) => machineRowMatchesAliases(row.machine_id, requestAliases));

    return res.json({
      success: true,
      date: dateKey,
      machine_id: machineParam,
      events,
    });
  } catch (error) {
    logger.error('Error getting machine daily cycles:', error);
    return next(error);
  }
};

