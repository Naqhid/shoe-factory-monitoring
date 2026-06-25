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
/** Time loss counts idle from the first second after last FINISH (no start grace). */
const TIME_LOSS_START_GRACE_MINS = 0;

const dateKeyLocal = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/** Shift window on a calendar day (local server time, same as existing cycle logic). */
const shiftBoundsForDateKey = (dateKey) => {
  const anchor = new Date(`${dateKey}T12:00:00`);
  const shiftStart = new Date(anchor);
  shiftStart.setHours(SHIFT_START_HOUR, SHIFT_START_MINUTE, 0, 0);
  const shiftEnd = new Date(anchor);
  shiftEnd.setHours(SHIFT_END_HOUR, SHIFT_END_MINUTE, 0, 0);
  return { shiftStart, shiftEnd };
};

/** As-of timestamp for open-gap loss: now (capped at shift end) on today, else shift end for past days. */
const effectiveAsOfForDateKey = (dateKey, now = new Date()) => {
  const { shiftStart, shiftEnd } = shiftBoundsForDateKey(dateKey);
  const todayKey = dateKeyLocal(now);
  if (dateKey < todayKey) return shiftEnd;
  if (dateKey > todayKey) return shiftStart;
  return new Date(Math.min(now.getTime(), shiftEnd.getTime()));
};

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
      AND EXISTS (
        SELECT 1 FROM machine_centres mc2
        WHERE mc2.machine_id = mcp.machine_id AND mc2.work_centre_id = mcp.work_centre_id
      )
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
    const inactive = computeShiftInactiveMinutes({ baselineTs, startTs, startReminderMins: TIME_LOSS_START_GRACE_MINS });
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
 * Add open idle loss: last finish → as-of (or shift start → as-of if no finished cycles).
 * Skips machines with a cycle in progress (status 1, no finish) to avoid counting active work as idle.
 */
async function applyOpenTailMachineLoss(pool, workCentreId, dateKey, byMachine, now = new Date()) {
  const asOf = effectiveAsOfForDateKey(dateKey, now);
  const { shiftStart } = shiftBoundsForDateKey(dateKey);
  if (asOf.getTime() <= shiftStart.getTime()) return;

  const [wcMachines] = await pool.query(
    `
    SELECT
      mc.machine_id,
      COALESCE(mc.name, mc.machine_name, CONCAT('Machine ', mc.machine_id)) AS machine_name
    FROM machine_centres mc
    WHERE mc.work_centre_id = ?
    `,
    [workCentreId]
  );

  const [lastFinishRows] = await pool.query(
    `
    SELECT machine_id, MAX(finish_time) AS last_finish_time
    FROM machine_centre_production
    WHERE work_centre_id = ?
      AND DATE(prod_date) = DATE(?)
      AND button_status = 2
      AND finish_time IS NOT NULL
    GROUP BY machine_id
    `,
    [workCentreId, dateKey]
  );

  const [inProgressRows] = await pool.query(
    `
    SELECT DISTINCT machine_id
    FROM machine_centre_production
    WHERE work_centre_id = ?
      AND DATE(prod_date) = DATE(?)
      AND button_status = 1
      AND start_time IS NOT NULL
      AND finish_time IS NULL
    `,
    [workCentreId, dateKey]
  );

  const lastFinishByMachine = new Map();
  lastFinishRows.forEach((row) => {
    const id = String(row.machine_id || '');
    if (!id || !row.last_finish_time) return;
    lastFinishByMachine.set(id, new Date(row.last_finish_time));
  });

  const inProgressSet = new Set(inProgressRows.map((row) => String(row.machine_id || '')));

  const ensureMachine = (machineId, machineName) => {
    if (!byMachine.has(machineId)) {
      byMachine.set(machineId, {
        machine_id: machineId,
        machine_name: machineName || `Machine ${machineId}`,
        net_mins: 0,
      });
    }
  };

  wcMachines.forEach((row) => {
    const machineId = String(row.machine_id || '');
    if (!machineId) return;
    ensureMachine(machineId, row.machine_name);
    if (inProgressSet.has(machineId)) return;

    const baselineTs = lastFinishByMachine.get(machineId) || shiftStart;
    if (asOf.getTime() <= baselineTs.getTime()) return;

    const openInactive = computeShiftInactiveMinutes({
      baselineTs,
      startTs: asOf,
      startReminderMins: TIME_LOSS_START_GRACE_MINS,
    });
    if (openInactive <= 0) return;

    const entry = byMachine.get(machineId);
    entry.net_mins -= openInactive;
  });
}

/**
 * Machine-wise net time loss for one work centre/day.
 * Returns sorted rows with machine id/name and rounded minutes.
 */
async function aggregateMachineCycleLosses(pool, workCentreId, date, now = new Date()) {
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
      AND EXISTS (
        SELECT 1 FROM machine_centres mc2
        WHERE mc2.machine_id = mcp.machine_id AND mc2.work_centre_id = mcp.work_centre_id
      )
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
      startReminderMins: TIME_LOSS_START_GRACE_MINS,
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

  await applyOpenTailMachineLoss(pool, workCentreId, date, byMachine, now);

  return Array.from(byMachine.values())
    .map((m) => ({
      ...m,
      net_mins: Number(m.net_mins) || 0,
      abs_net_mins: Math.abs(Number(m.net_mins) || 0),
    }))
    .filter((m) => m.abs_net_mins * 60 >= 1)
    .sort((a, b) => b.abs_net_mins - a.abs_net_mins);
}

const netStatusFromMins = (netMins) => {
  const net = Number(netMins) || 0;
  if (Math.abs(net) * 60 < 1) return 'neutral';
  return net > 0 ? 'gain' : 'loss';
};

/**
 * Machine/day net time loss rows for Reports — same cycle math as TV dashboard machineTimeLosses.
 */
async function buildMachineTimeLossReportRows(pool, { fromDate, toDate, workCentreId = null, search = '' }) {
  let wcClause = '';
  const params = [fromDate, toDate];
  if (workCentreId) {
    wcClause = ' AND mcp.work_centre_id = ?';
    params.push(Number(workCentreId));
  }

  const [rows] = await pool.query(
    `
    SELECT
      DATE(mcp.prod_date) AS date,
      mcp.work_centre_id,
      wc.name AS line,
      mcp.machine_id,
      COALESCE(mc.name, mc.machine_name, CONCAT('Machine ', mcp.machine_id)) AS machine_name,
      mcp.start_time,
      mcp.finish_time,
      mcp.target_mins,
      LAG(mcp.finish_time) OVER (
        PARTITION BY mcp.machine_id, mcp.work_centre_id, DATE(mcp.prod_date)
        ORDER BY mcp.start_time
      ) AS prev_finish_time,
      mtlr.reason AS time_loss_reason
    FROM machine_centre_production mcp
    LEFT JOIN work_centres wc ON wc.id = mcp.work_centre_id
    LEFT JOIN machine_centres mc
      ON mc.machine_id = mcp.machine_id
      AND mc.work_centre_id = mcp.work_centre_id
    LEFT JOIN machine_time_loss_reasons mtlr
      ON mtlr.work_centre_id = mcp.work_centre_id
      AND mtlr.machine_id = mcp.machine_id
      AND mtlr.prod_date = DATE(mcp.prod_date)
    WHERE DATE(mcp.prod_date) BETWEEN ? AND ?
      ${wcClause}
      AND mcp.button_status = 2
      AND mcp.start_time IS NOT NULL
      AND mcp.finish_time IS NOT NULL
    ORDER BY date DESC, line, mcp.machine_id, mcp.start_time
    `,
    params
  );

  const byKey = new Map();
  rows.forEach((row) => {
    const dateKey =
      row.date instanceof Date ? dateKeyLocal(row.date) : row.date ? String(row.date).slice(0, 10) : '';
    const machineId = String(row.machine_id || '');
    const wcId = row.work_centre_id;
    if (!dateKey || !machineId || wcId == null) return;

    const key = `${dateKey}|${wcId}|${machineId}`;
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
      startReminderMins: TIME_LOSS_START_GRACE_MINS,
    });
    const earlySaveMins = Math.max(0, targetMins - actualMins);
    const slowExtraMins = Math.max(0, actualMins - targetMins);
    const netDeltaMins = earlySaveMins - inactiveMins - slowExtraMins;

    if (!byKey.has(key)) {
      byKey.set(key, {
        date: dateKey,
        work_centre_id: wcId,
        line: row.line || 'N/A',
        machine_id: machineId,
        machine_name: row.machine_name || `Machine ${machineId}`,
        net_mins: 0,
        time_loss_reason: row.time_loss_reason || '',
      });
    }
    const agg = byKey.get(key);
    agg.net_mins += netDeltaMins;
    if (row.time_loss_reason && !agg.time_loss_reason) {
      agg.time_loss_reason = row.time_loss_reason;
    }
  });

  const datesInRange = [...new Set(Array.from(byKey.values()).map((row) => row.date))];
  for (const dayKey of datesInRange) {
    const dayMap = new Map();
    byKey.forEach((agg, key) => {
      if (agg.date !== dayKey) return;
      dayMap.set(agg.machine_id, agg);
    });
    const wcIdForDay = workCentreId || Array.from(byKey.values()).find((r) => r.date === dayKey)?.work_centre_id;
    if (wcIdForDay != null) {
      await applyOpenTailMachineLoss(pool, Number(wcIdForDay), dayKey, dayMap);
    }
  }

  let out = Array.from(byKey.values())
    .map((m) => {
      const net_mins = Math.round((Number(m.net_mins) || 0) * 100) / 100;
      const abs_net_mins = Math.abs(net_mins);
      return {
        ...m,
        net_mins,
        abs_net_mins,
        net_status: netStatusFromMins(net_mins),
      };
    })
    .filter((m) => m.abs_net_mins * 60 >= 1);

  const q = String(search || '').trim().toLowerCase();
  if (q) {
    out = out.filter(
      (m) =>
        String(m.line || '').toLowerCase().includes(q) ||
        String(m.machine_id || '').toLowerCase().includes(q) ||
        String(m.machine_name || '').toLowerCase().includes(q) ||
        String(m.time_loss_reason || '').toLowerCase().includes(q)
    );
  }

  out.sort((a, b) => {
    if (b.abs_net_mins !== a.abs_net_mins) return b.abs_net_mins - a.abs_net_mins;
    if (a.date !== b.date) return String(b.date).localeCompare(String(a.date));
    return String(a.line || '').localeCompare(String(b.line || ''));
  });

  return out;
}

module.exports = {
  computeShiftInactiveMinutes,
  computeCycleNetLostMins,
  aggregateWorkCentreCycleLoss,
  aggregateMachineCycleLosses,
  applyOpenTailMachineLoss,
  buildMachineTimeLossReportRows,
  netStatusFromMins,
  effectiveAsOfForDateKey,
  LATE_CYCLE_GRACE_SECS,
  LATE_CYCLE_GRACE_MINS,
  TIME_LOSS_START_GRACE_MINS,
};
