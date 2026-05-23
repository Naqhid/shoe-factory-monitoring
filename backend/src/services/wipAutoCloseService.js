/**
 * Daily WIP auto-close scheduler.
 * At end of shift: recompute live WIP, then set closing_wip = current_wip.
 * Next day's opening_wip is derived from that closing_wip automatically.
 */

'use strict';

const pool = require('../../config/database');
const wipStateService = require('./wipStateService');

const parseCloseTime = (timeValue) => {
    const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec((timeValue || '').trim());
    if (!match) return null;
    return { hour: Number(match[1]), minute: Number(match[2]) };
};

const getLocalDateKey = (date = new Date()) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

async function getTodayOutput(workCentreId, date) {
    const [rows] = await pool.query(
        `SELECT COALESCE(SUM(total_output_pairs), 0) AS total_output
         FROM machine_centre_summary
         WHERE DATE(prod_date) = ? AND work_centre_id = ?`,
        [date, workCentreId]
    );
    return Math.round(Number(rows[0]?.total_output || 0));
}

/**
 * Work centres with WIP activity today that are not yet closed.
 */
async function getWorkCentresToClose(date) {
    const [rows] = await pool.query(
        `SELECT DISTINCT work_centre_id AS id
         FROM (
             SELECT work_centre_id FROM wip_daily_state
             WHERE state_date = ? AND is_closed = 0
             UNION
             SELECT work_centre_id FROM machine_centre_summary
             WHERE DATE(prod_date) = ?
             UNION
             SELECT work_centre_id FROM production_plan
             WHERE plan_date = ?
         ) active_lines
         ORDER BY work_centre_id`,
        [date, date, date]
    );
    return rows.map((r) => Number(r.id));
}

/**
 * Recompute live WIP from production data, then finalize closing_wip.
 */
async function recomputeAndCloseDay(workCentreId, date) {
    const [existing] = await pool.query(
        `SELECT is_closed FROM wip_daily_state
         WHERE work_centre_id = ? AND state_date = ?`,
        [workCentreId, date]
    );

    if (existing.length > 0 && existing[0].is_closed) {
        return { workCentreId, skipped: true, reason: 'already_closed' };
    }

    const todayOutput = await getTodayOutput(workCentreId, date);
    const live = await wipStateService.computeAndPersistWip(workCentreId, date, todayOutput);
    const { closingWip } = await wipStateService.closeDay(workCentreId, date);

    return {
        workCentreId,
        skipped: false,
        openingWip: live.openingWip,
        todayInput: live.todayInput,
        currentWip: live.currentWip,
        closingWip,
    };
}

/**
 * Close all open work centres for a given date (defaults to today).
 */
async function closeAllOpenDaysForDate(date = getLocalDateKey()) {
    const workCentreIds = await getWorkCentresToClose(date);
    const results = [];

    for (const workCentreId of workCentreIds) {
        try {
            results.push(await recomputeAndCloseDay(workCentreId, date));
        } catch (err) {
            results.push({ workCentreId, skipped: true, error: err.message });
        }
    }

    return { date, closed: results.filter((r) => !r.skipped && !r.error), results };
}

/**
 * Start minute-by-minute check; runs once per calendar day at/after configured time.
 */
function startWipAutoCloseScheduler(logger, options = {}) {
    const enabled = (options.enabled ?? process.env.WIP_AUTO_CLOSE_ENABLED ?? 'true').toLowerCase() !== 'false';
    const timeRaw = options.time ?? process.env.WIP_AUTO_CLOSE_TIME ?? '18:45';
    const timeParts = parseCloseTime(timeRaw) || { hour: 18, minute: 45 };

    if (!parseCloseTime(timeRaw)) {
        logger.warn(`Invalid WIP_AUTO_CLOSE_TIME="${timeRaw}". Falling back to 18:45.`);
    }

    if (!enabled) {
        logger.info('WIP daily auto-close is disabled via WIP_AUTO_CLOSE_ENABLED=false.');
        return;
    }

    let lastRunDate = null;

    const runCheck = async () => {
        try {
            const now = new Date();
            const cutoff = new Date(now);
            cutoff.setHours(timeParts.hour, timeParts.minute, 0, 0);

            const todayKey = getLocalDateKey(now);
            if (now < cutoff || lastRunDate === todayKey) return;

            const { date, closed, results } = await closeAllOpenDaysForDate(todayKey);
            lastRunDate = todayKey;

            const summary = closed
                .map((r) => `wc${r.workCentreId}→${r.closingWip}`)
                .join(', ') || 'none';
            logger.info(
                `WIP auto-close completed for ${date} at/after ${String(timeParts.hour).padStart(2, '0')}:${String(timeParts.minute).padStart(2, '0')}. Closed: ${summary}`
            );

            const errors = results.filter((r) => r.error);
            if (errors.length > 0) {
                logger.warn(`WIP auto-close partial errors: ${errors.map((e) => `wc${e.workCentreId}: ${e.error}`).join('; ')}`);
            }
        } catch (err) {
            logger.error(`WIP auto-close scheduler error: ${err.message}`);
        }
    };

    logger.info(
        `WIP daily auto-close is enabled. Daily cutoff: ${String(timeParts.hour).padStart(2, '0')}:${String(timeParts.minute).padStart(2, '0')} (server local time).`
    );
    setInterval(runCheck, 60 * 1000);
    setTimeout(runCheck, 25 * 1000);
}

module.exports = {
    closeAllOpenDaysForDate,
    recomputeAndCloseDay,
    startWipAutoCloseScheduler,
};
