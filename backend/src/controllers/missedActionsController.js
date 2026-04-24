const db = require('../../config/database');
const logger = require('../utils/logger');

const getIssueKey = (row, actionType) => `${row.session_id}__${row.machine_id}__${row.emp_code || 'NA'}__${actionType}`;

const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

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

