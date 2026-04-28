const db = require('../../config/database');
const logger = require('../utils/logger');

const getIssueKey = (row, actionType) => `${row.session_id}__${row.machine_id}__${row.emp_code || 'NA'}__${actionType}`;

const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const SHIFT_START_HOUR = parseInt(process.env.SHIFT_START_HOUR || '9', 10);
const SHIFT_START_MINUTE = parseInt(process.env.SHIFT_START_MINUTE || '0', 10);

const parseActionRows = (rows, startReminderMins, finishGraceMins) => {
  const data = [];

  rows.forEach((row) => {
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
    } else if (hasFinishedCycleAfterSession && minsSinceFinish >= startReminderMins) {
      actionType = 'START_PENDING';
      overdueMins = minsSinceFinish - startReminderMins;
      message = `Last cycle finished ${minsSinceFinish} mins ago; next cycle not started.`;
    } else if (!hasAnyCycleActivityAfterSession) {
      if (minsSinceActivation < startReminderMins) return;
      actionType = 'START_PENDING';
      overdueMins = minsSinceActivation - startReminderMins;
      message = `Session active for ${minsSinceActivation} mins with no cycle started.`;
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
    const startReminderMins = Math.max(1, Number(req.query.startReminderMins) || 10);
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
      ORDER BY ms.machine_id ASC
      `
      ,
      [sessionLookbackHours]
    );

    const data = parseActionRows(rows, startReminderMins, finishGraceMins);
    const issueKeys = data.map((i) => i.issue_key);
    const stateByKey = {};
    if (issueKeys.length > 0) {
      const placeholders = issueKeys.map(() => '?').join(',');
      const [states] = await db.query(
        `SELECT issue_key, acknowledged_at, snoozed_until FROM missed_action_states WHERE issue_key IN (${placeholders})`,
        issueKeys
      );
      states.forEach((state) => {
        stateByKey[state.issue_key] = {
          acknowledged_at: state.acknowledged_at,
          snoozed_until: state.snoozed_until,
        };
      });
    }

    const now = Date.now();
    const dataWithState = data.map((item) => {
      const state = stateByKey[item.issue_key] || null;
      const snoozedUntilTs = state?.snoozed_until ? new Date(state.snoozed_until).getTime() : null;
      return {
        ...item,
        state: {
          acknowledged: !!state?.acknowledged_at,
          acknowledged_at: state?.acknowledged_at || null,
          snoozed_until: state?.snoozed_until || null,
          is_snoozed: !!(snoozedUntilTs && snoozedUntilTs > now),
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
        startReminderMins,
        finishGraceMins,
        sessionLookbackHours,
      },
    });
  } catch (error) {
    logger.error('Error getting missed actions:', error);
    next(error);
  }
};

exports.acknowledgeMissedAction = async (req, res, next) => {
  try {
    const issueKey = String(req.body?.issue_key || '').trim();
    if (!issueKey) {
      return res.status(400).json({ success: false, error: 'issue_key is required' });
    }
    await db.query(
      `INSERT INTO missed_action_states (issue_key, acknowledged_at, snoozed_until, updated_at)
       VALUES (?, NOW(), NULL, NOW())
       ON DUPLICATE KEY UPDATE acknowledged_at = NOW(), snoozed_until = NULL, updated_at = NOW()`,
      [issueKey]
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
      `INSERT INTO missed_action_states (issue_key, acknowledged_at, snoozed_until, updated_at)
       VALUES (?, NULL, DATE_ADD(NOW(), INTERVAL ? MINUTE), NOW())
       ON DUPLICATE KEY UPDATE acknowledged_at = NULL, snoozed_until = DATE_ADD(NOW(), INTERVAL ? MINUTE), updated_at = NOW()`,
      [issueKey, mins, mins]
    );
    return res.json({ success: true });
  } catch (error) {
    logger.error('Error snoozing missed action:', error);
    return next(error);
  }
};

exports.getMissedActionsDailyReport = async (req, res, next) => {
  try {
    const date = String(req.query?.date || new Date().toISOString().slice(0, 10));
    const startReminderMins = Math.max(1, Number(req.query.startReminderMins) || 10);
    const lineFilter = String(req.query?.line || 'all');

    const [rows] = await db.query(
      `
      SELECT
        mcp.id,
        mcp.work_centre_id,
        wc.name AS work_centre_name,
        mcp.machine_id,
        mc.machine_name,
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
        ) AS prev_finish_time
      FROM machine_centre_production mcp
      LEFT JOIN work_centres wc ON wc.id = mcp.work_centre_id
      LEFT JOIN machine_centres mc ON mc.machine_id = mcp.machine_id
      LEFT JOIN employees e ON e.code = mcp.emp_id
      WHERE DATE(mcp.prod_date) = ?
        AND mcp.button_status = 2
        AND mcp.start_time IS NOT NULL
        AND mcp.finish_time IS NOT NULL
      ORDER BY wc.name, mcp.machine_id, mcp.start_time
      `,
      [date]
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
      const inactiveMins = Math.max(0, gapMins - startReminderMins);

      return {
        id: row.id,
        work_centre_id: row.work_centre_id,
        work_centre_name: row.work_centre_name || 'N/A',
        machine_id: row.machine_id,
        machine_name: row.machine_name || row.machine_id || 'N/A',
        employee_code: row.employee_code || 'N/A',
        employee_name: row.employee_name || row.employee_code || 'N/A',
        start_time: row.start_time,
        finish_time: row.finish_time,
        target_mins: targetMins,
        actual_mins: actualMins,
        extra_mins: extraMins,
        start_gap_mins: gapMins,
        inactive_mins: inactiveMins,
      };
    });

    const filtered = lineFilter === 'all'
      ? mapped
      : mapped.filter((row) => String(row.work_centre_name) === lineFilter);

    const byLineMap = new Map();
    filtered.forEach((row) => {
      const key = row.work_centre_name || 'N/A';
      if (!byLineMap.has(key)) {
        byLineMap.set(key, {
          work_centre_name: key,
          cycles: 0,
          inactive_mins: 0,
          extra_mins: 0,
        });
      }
      const agg = byLineMap.get(key);
      agg.cycles += 1;
      agg.inactive_mins += row.inactive_mins;
      agg.extra_mins += row.extra_mins;
    });

    const byLine = Array.from(byLineMap.values()).sort((a, b) => (b.inactive_mins + b.extra_mins) - (a.inactive_mins + a.extra_mins));
    const totalInactive = filtered.reduce((sum, r) => sum + r.inactive_mins, 0);
    const totalExtra = filtered.reduce((sum, r) => sum + r.extra_mins, 0);

    return res.json({
      success: true,
      date,
      thresholds: { startReminderMins },
      summary: {
        total_cycles: filtered.length,
        total_inactive_mins: totalInactive,
        total_extra_mins: totalExtra,
        total_lost_mins: totalInactive + totalExtra,
      },
      by_line: byLine,
      events: filtered,
    });
  } catch (error) {
    logger.error('Error getting missed actions daily report:', error);
    return next(error);
  }
};

