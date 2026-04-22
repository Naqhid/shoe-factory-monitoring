const db = require('../../config/database');
const logger = require('../utils/logger');

exports.getMissedActions = async (req, res, next) => {
  try {
    const startReminderMins = Math.max(1, Number(req.query.startReminderMins) || 10);
    const finishGraceMins = Math.max(0, Number(req.query.finishGraceMins) || 0);

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
      WHERE ms.status = 'active' AND DATE(ms.activated_at) = CURDATE()
      ORDER BY ms.machine_id ASC
      `
    );

    const data = [];

    rows.forEach((row) => {
      const minsSinceActivation = Number(row.mins_since_activation || 0);
      const minsSinceFinish = Number(row.mins_since_finish || 0);
      const minsSinceStart = Number(row.mins_since_start || 0);
      const targetMins = Number(row.target_mins || 0);
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
        data.push({
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

    res.json({
      success: true,
      data,
      summary: {
        total: data.length,
        start_pending: data.filter((i) => i.action_type === 'START_PENDING').length,
        finish_pending: data.filter((i) => i.action_type === 'FINISH_PENDING').length,
      },
      thresholds: {
        startReminderMins,
        finishGraceMins,
      },
    });
  } catch (error) {
    logger.error('Error getting missed actions:', error);
    next(error);
  }
};

