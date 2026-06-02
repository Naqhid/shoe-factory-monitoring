'use strict';

const SHIFT_START_HOUR = parseInt(process.env.SHIFT_START_HOUR || '9', 10);
const SHIFT_START_MINUTE = parseInt(process.env.SHIFT_START_MINUTE || '5', 10);
const SHIFT_END_HOUR = parseInt(process.env.SHIFT_END_HOUR || '17', 10);
const SHIFT_END_MINUTE = parseInt(process.env.SHIFT_END_MINUTE || '35', 10);
const LUNCH_START_HOUR = parseInt(process.env.LUNCH_START_HOUR || '13', 10);
const LUNCH_START_MINUTE = parseInt(process.env.LUNCH_START_MINUTE || '30', 10);
const LUNCH_END_HOUR = parseInt(process.env.LUNCH_END_HOUR || '14', 10);
const LUNCH_END_MINUTE = parseInt(process.env.LUNCH_END_MINUTE || '0', 10);
const LATE_CYCLE_GRACE_SECS = Math.max(1, parseInt(process.env.LATE_CYCLE_GRACE_SECS || '40', 10));
const LATE_CYCLE_GRACE_MINS = LATE_CYCLE_GRACE_SECS / 60;

const overlapMinutes = (aStart, aEnd, bStart, bEnd) => {
  const start = Math.max(aStart.getTime(), bStart.getTime());
  const end = Math.min(aEnd.getTime(), bEnd.getTime());
  if (end <= start) return 0;
  return (end - start) / 60000;
};

/** Gap between cycles (or shift start) before START, minus reminder allowance; lunch excluded. */
const computeShiftInactiveMinutes = ({ baselineTs, startTs, startReminderMins }) => {
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

  return Math.max(0, gapExcludingLunch - startReminderMins);
};

/**
 * Net minutes lost on one cycle: late-start gap minus under-target savings, plus over-target time.
 * Example: 2m late + 1m under target => 1m lost; 6m late + 6.5m under target => 0m lost.
 */
const computeCycleNetLostMins = (inactiveMins, targetMins, actualMins) => {
  const late = Math.max(0, Number(inactiveMins) || 0);
  const target = Math.max(0, Number(targetMins) || 0);
  const actual = Math.max(0, Number(actualMins) || 0);
  const earlySave = Math.max(0, target - actual);
  const slowExtra = Math.max(0, actual - target);
  return Math.max(0, late - earlySave) + slowExtra;
};

/**
 * Sum inactive gaps + extra finish time for completed cycles on a work centre for one day.
 * Matches Missed Actions daily report logic.
 */
async function aggregateWorkCentreCycleLoss(pool, workCentreId, date) {
  const [rows] = await pool.query(
    `
    SELECT
      mcp.start_time,
      mcp.finish_time,
      mcp.target_mins,
      LAG(mcp.finish_time) OVER (
        PARTITION BY mcp.machine_id, DATE(mcp.prod_date)
        ORDER BY mcp.start_time
      ) AS prev_finish_time
    FROM machine_centre_production mcp
    WHERE mcp.work_centre_id = ?
      AND DATE(mcp.prod_date) = DATE(?)
      AND mcp.button_status = 2
      AND mcp.start_time IS NOT NULL
      AND mcp.finish_time IS NOT NULL
    ORDER BY mcp.machine_id, mcp.start_time
    `,
    [workCentreId, date]
  );

  let inactiveMins = 0;
  let extraMins = 0;
  let netLostMins = 0;

  rows.forEach((row) => {
    const startMs = row.start_time ? new Date(row.start_time).getTime() : NaN;
    const finishMs = row.finish_time ? new Date(row.finish_time).getTime() : NaN;
    const actualMins =
      Number.isFinite(startMs) && Number.isFinite(finishMs)
        ? Math.max(0, (finishMs - startMs) / 60000)
        : 0;
    const targetMins = Math.max(0, Number(row.target_mins) || 0);
    const slowExtra = Math.max(0, actualMins - targetMins);
    extraMins += slowExtra;

    const startTs = new Date(row.start_time);
    const shiftStart = new Date(startTs);
    shiftStart.setHours(SHIFT_START_HOUR, SHIFT_START_MINUTE, 0, 0);
    const baselineTs = row.prev_finish_time ? new Date(row.prev_finish_time) : shiftStart;
    const inactive = computeShiftInactiveMinutes({ baselineTs, startTs, startReminderMins: LATE_CYCLE_GRACE_MINS });
    inactiveMins += inactive;
    netLostMins += computeCycleNetLostMins(inactive, targetMins, actualMins);
  });

  const lossOfMinutes = Math.round(netLostMins);
  return {
    lossOfMinutes,
    inactiveMins: Math.round(inactiveMins),
    extraMins: Math.round(extraMins),
  };
}

/**
 * Machine-wise net time loss for one work centre/day.
 * Returns sorted rows with machine id/name and rounded minutes.
 */
async function aggregateMachineCycleLosses(pool, workCentreId, date) {
  const [rows] = await pool.query(
    `
    SELECT
      mcp.machine_id,
      COALESCE(mc.name, mc.machine_name, CONCAT('Machine ', mcp.machine_id)) AS machine_name,
      mcp.start_time,
      mcp.finish_time,
      mcp.target_mins,
      LAG(mcp.finish_time) OVER (
        PARTITION BY mcp.machine_id, DATE(mcp.prod_date)
        ORDER BY mcp.start_time
      ) AS prev_finish_time
    FROM machine_centre_production mcp
    LEFT JOIN machine_centres mc
      ON mc.machine_id = mcp.machine_id
      AND mc.work_centre_id = mcp.work_centre_id
    WHERE mcp.work_centre_id = ?
      AND DATE(mcp.prod_date) = DATE(?)
      AND mcp.button_status = 2
      AND mcp.start_time IS NOT NULL
      AND mcp.finish_time IS NOT NULL
    ORDER BY mcp.machine_id, mcp.start_time
    `,
    [workCentreId, date]
  );

  const byMachine = new Map();
  rows.forEach((row) => {
    const machineId = String(row.machine_id || '');
    if (!machineId) return;

    const startMs = row.start_time ? new Date(row.start_time).getTime() : NaN;
    const finishMs = row.finish_time ? new Date(row.finish_time).getTime() : NaN;
    const actualMins =
      Number.isFinite(startMs) && Number.isFinite(finishMs)
        ? Math.max(0, (finishMs - startMs) / 60000)
        : 0;
    const targetMins = Math.max(0, Number(row.target_mins) || 0);
    const startTs = new Date(row.start_time);
    const shiftStart = new Date(startTs);
    shiftStart.setHours(SHIFT_START_HOUR, SHIFT_START_MINUTE, 0, 0);
    const baselineTs = row.prev_finish_time ? new Date(row.prev_finish_time) : shiftStart;
    const inactiveMins = computeShiftInactiveMinutes({
      baselineTs,
      startTs,
      startReminderMins: LATE_CYCLE_GRACE_MINS,
    });
    const earlySaveMins = Math.max(0, targetMins - actualMins);
    const slowExtraMins = Math.max(0, actualMins - targetMins);
    const netDeltaMins = earlySaveMins - inactiveMins - slowExtraMins;

    if (!byMachine.has(machineId)) {
      byMachine.set(machineId, {
        machine_id: machineId,
        machine_name: row.machine_name || `Machine ${machineId}`,
        net_mins: 0,
      });
    }
    byMachine.get(machineId).net_mins += netDeltaMins;
  });

  return Array.from(byMachine.values())
    .map((m) => ({
      ...m,
      net_mins: Number(m.net_mins) || 0,
      abs_net_mins: Math.abs(Number(m.net_mins) || 0),
    }))
    .filter((m) => m.abs_net_mins * 60 >= 1)
    .sort((a, b) => b.abs_net_mins - a.abs_net_mins);
}

module.exports = {
  computeShiftInactiveMinutes,
  computeCycleNetLostMins,
  aggregateWorkCentreCycleLoss,
  aggregateMachineCycleLosses,
  LATE_CYCLE_GRACE_SECS,
  LATE_CYCLE_GRACE_MINS,
};
