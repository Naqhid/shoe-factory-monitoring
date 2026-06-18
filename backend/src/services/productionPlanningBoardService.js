'use strict';

const db = require('../../config/database');
const { withTransaction } = require('../utils/transaction');
const { activeWorkCentreWhere } = require('../utils/workCentreSql');
const { localDateKey } = require('../utils/dateKey');
const lineStyleAssignmentService = require('./lineStyleAssignmentService');

function getPlanningController() {
  return require('../controllers/productionPlanningController');
}

function parseDateKey(value) {
  if (!value) return null;
  const part = String(value).trim().split('T')[0];
  return /^\d{4}-\d{2}-\d{2}$/.test(part) ? part : null;
}

function addDays(dateKey, days) {
  const d = new Date(`${dateKey}T00:00:00`);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function weekStartMonday(dateKey) {
  const d = new Date(`${dateKey}T00:00:00`);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function enumerateWeek(dateKey) {
  const start = weekStartMonday(dateKey);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

async function findLastPlanDate(beforeDate) {
  const key = parseDateKey(beforeDate);
  if (!key) return null;
  const [rows] = await db.execute(
    `SELECT DATE_FORMAT(MAX(plan_date), '%Y-%m-%d') AS plan_date
     FROM production_plan
     WHERE DATE(plan_date) < DATE(?)
       AND deleted_at IS NULL`,
    [key]
  );
  return rows[0]?.plan_date || null;
}

async function resolveSourceDate(targetDate, sourceDate) {
  const target = parseDateKey(targetDate);
  if (!target) return null;
  const explicit = parseDateKey(sourceDate);
  if (explicit) return explicit;
  const yesterday = addDays(target, -1);
  const [yRows] = await db.execute(
    `SELECT COUNT(*) AS c FROM production_plan
     WHERE DATE(plan_date) = DATE(?) AND deleted_at IS NULL`,
    [yesterday]
  );
  if (Number(yRows[0]?.c || 0) > 0) return yesterday;
  return findLastPlanDate(target);
}

async function fetchPlansByDate(planDate) {
  const dateKey = parseDateKey(planDate);
  if (!dateKey) return new Map();
  const [rows] = await db.execute(
    `SELECT
       pp.id,
       DATE_FORMAT(pp.plan_date, '%Y-%m-%d') AS plan_date,
       pp.style_id,
       pp.customer_id,
       pp.group_id,
       pp.leather_id,
       pp.color_id,
       pp.work_centre_id,
       pp.total_target_per_day,
       pp.target_pairs_per_tray,
       pp.tray_count,
       pp.man_hours_minutes,
       pp.smv_per_pair,
       s.code AS style_code,
       s.name AS style_name,
       c.name AS customer_name,
       wc.code AS work_centre_code,
       wc.name AS work_centre_name
     FROM production_plan pp
     LEFT JOIN styles s ON pp.style_id = s.id
     LEFT JOIN customers c ON pp.customer_id = c.id
     LEFT JOIN work_centres wc ON pp.work_centre_id = wc.id
     WHERE DATE(pp.plan_date) = DATE(?)
       AND pp.deleted_at IS NULL`,
    [dateKey]
  );
  const map = new Map();
  for (const row of rows) {
    map.set(Number(row.work_centre_id), row);
  }
  return map;
}

async function fetchScheduleByDate(planDate) {
  const board = await lineStyleAssignmentService.getBoard(planDate);
  const map = new Map();
  for (const line of board.lines || []) {
    if (!line.assignment_id) continue;
    map.set(Number(line.work_centre_id), {
      style_id: line.style_id,
      style_code: line.style_code,
      style_name: line.style_name,
      effective_from_date: line.effective_from_date,
      customer_name: line.customer_name,
    });
  }
  return map;
}

async function fetchActualsByDate(planDate) {
  const dateKey = parseDateKey(planDate);
  if (!dateKey) return new Map();
  try {
    const [rows] = await db.execute(
      `SELECT
         wc.id AS work_centre_id,
         COALESCE(SUM(mcs.total_output_pairs), 0) AS actual_pairs
       FROM work_centres wc
       LEFT JOIN machine_centre_summary mcs
         ON mcs.work_centre_id = wc.id
        AND DATE(mcs.prod_date) = DATE(?)
       WHERE ${activeWorkCentreWhere('wc')}
       GROUP BY wc.id`,
      [dateKey]
    );
    const map = new Map();
    for (const row of rows) {
      map.set(Number(row.work_centre_id), Number(row.actual_pairs || 0));
    }
    return map;
  } catch {
    return new Map();
  }
}

async function fetchActiveWorkCentres() {
  const [rows] = await db.execute(
    `SELECT id, code, name
     FROM work_centres wc
     WHERE ${activeWorkCentreWhere('wc')}
     ORDER BY wc.code, wc.name`
  );
  return rows;
}

function planToPayload(plan, planDate) {
  return {
    plan_date: planDate,
    style_id: plan.style_id,
    customer_id: plan.customer_id,
    group_id: plan.group_id || null,
    leather_id: plan.leather_id || null,
    color_id: plan.color_id || null,
    work_centre_id: plan.work_centre_id,
    total_target_per_day: plan.total_target_per_day,
    target_pairs_per_tray: plan.target_pairs_per_tray,
    tray_count: plan.tray_count || 0,
    man_hours_minutes: plan.man_hours_minutes,
    smv_per_pair: plan.smv_per_pair,
  };
}

function buildRowFlags(sourcePlan, targetPlan, schedule) {
  const flags = [];
  if (!sourcePlan) flags.push('no_source');
  if (!targetPlan) flags.push('missing_plan');
  else flags.push('has_plan');
  if (sourcePlan && targetPlan) flags.push('conflict');
  if (schedule?.style_id && sourcePlan && Number(schedule.style_id) !== Number(sourcePlan.style_id)) {
    flags.push('schedule_mismatch');
  }
  if (schedule?.style_id && targetPlan && Number(schedule.style_id) !== Number(targetPlan.style_id)) {
    flags.push('schedule_mismatch');
  }
  return flags;
}

async function getTodayBoard(planDate) {
  const dateKey = parseDateKey(planDate) || localDateKey();
  const [workCentres, plans, schedules, actuals] = await Promise.all([
    fetchActiveWorkCentres(),
    fetchPlansByDate(dateKey),
    fetchScheduleByDate(dateKey),
    fetchActualsByDate(dateKey),
  ]);

  const lines = workCentres.map((wc) => {
    const wcId = Number(wc.id);
    const plan = plans.get(wcId) || null;
    const schedule = schedules.get(wcId) || null;
    const actual = actuals.get(wcId) || 0;
    const target = plan ? Number(plan.total_target_per_day || 0) : 0;
    const scheduleMismatch = Boolean(
      plan && schedule?.style_id && Number(plan.style_id) !== Number(schedule.style_id)
    );
    const missingPlan = !plan;
    const pct = target > 0 ? Math.round((actual / target) * 100) : null;

    let status = 'ok';
    if (missingPlan && schedule) status = 'missing_plan';
    else if (missingPlan) status = 'no_plan';
    else if (scheduleMismatch) status = 'schedule_mismatch';

    return {
      work_centre_id: wcId,
      work_centre_code: wc.code,
      work_centre_name: wc.name,
      plan,
      schedule,
      actual_pairs: actual,
      target_pairs: target,
      achievement_pct: pct,
      schedule_mismatch: scheduleMismatch,
      missing_plan: missingPlan,
      status,
    };
  });

  const missingCount = lines.filter((l) => l.missing_plan).length;
  const mismatchCount = lines.filter((l) => l.schedule_mismatch).length;

  return {
    plan_date: dateKey,
    summary: {
      total_lines: lines.length,
      planned_lines: lines.length - missingCount,
      missing_plans: missingCount,
      schedule_mismatches: mismatchCount,
      total_target: lines.reduce((s, l) => s + l.target_pairs, 0),
      total_actual: lines.reduce((s, l) => s + l.actual_pairs, 0),
    },
    lines,
  };
}

async function getWeekGrid(anchorDate) {
  const dateKey = parseDateKey(anchorDate) || localDateKey();
  const days = enumerateWeek(dateKey);
  const workCentres = await fetchActiveWorkCentres();

  const planMaps = await Promise.all(days.map((d) => fetchPlansByDate(d)));
  const scheduleMaps = await Promise.all(days.map((d) => fetchScheduleByDate(d)));

  const rows = workCentres.map((wc) => {
    const wcId = Number(wc.id);
    const cells = days.map((day, idx) => {
      const plan = planMaps[idx].get(wcId) || null;
      const schedule = scheduleMaps[idx].get(wcId) || null;
      const mismatch = Boolean(
        plan && schedule?.style_id && Number(plan.style_id) !== Number(schedule.style_id)
      );
      return {
        date: day,
        plan: plan
          ? {
              id: plan.id,
              style_id: plan.style_id,
              style_code: plan.style_code,
              style_name: plan.style_name,
              total_target_per_day: plan.total_target_per_day,
            }
          : null,
        schedule: schedule
          ? {
              style_id: schedule.style_id,
              style_code: schedule.style_code,
              style_name: schedule.style_name,
            }
          : null,
        schedule_mismatch: mismatch,
        missing_plan: !plan,
      };
    });
    return {
      work_centre_id: wcId,
      work_centre_code: wc.code,
      work_centre_name: wc.name,
      cells,
    };
  });

  return {
    week_start: days[0],
    week_end: days[6],
    days,
    rows,
  };
}

async function getCopyPreview({ targetDate, sourceDate, onlyGaps = false }) {
  const target = parseDateKey(targetDate);
  if (!target) throw Object.assign(new Error('target_date is required'), { status: 400 });

  const resolvedSource = await resolveSourceDate(target, sourceDate);
  if (!resolvedSource) {
    return {
      target_date: target,
      source_date: null,
      rows: [],
      message: 'No previous plans found to copy from.',
    };
  }

  const [workCentres, sourcePlans, targetPlans, targetSchedules, sourceActuals] = await Promise.all([
    fetchActiveWorkCentres(),
    fetchPlansByDate(resolvedSource),
    fetchPlansByDate(target),
    fetchScheduleByDate(target),
    fetchActualsByDate(resolvedSource),
  ]);

  const rows = workCentres.map((wc) => {
    const wcId = Number(wc.id);
    const sourcePlan = sourcePlans.get(wcId) || null;
    const targetPlan = targetPlans.get(wcId) || null;
    const schedule = targetSchedules.get(wcId) || null;
    const sourceActual = sourceActuals.get(wcId) || 0;

    const flags = buildRowFlags(sourcePlan, targetPlan, schedule);
    let include = Boolean(sourcePlan);
    if (onlyGaps) {
      include = Boolean(sourcePlan && !targetPlan);
    } else if (targetPlan) {
      include = false;
    }

    const proposed = sourcePlan ? planToPayload(sourcePlan, target) : null;

    return {
      work_centre_id: wcId,
      work_centre_code: wc.code,
      work_centre_name: wc.name,
      source_plan: sourcePlan,
      source_actual_pairs: sourceActual,
      target_existing_plan: targetPlan,
      schedule,
      proposed,
      flags,
      include,
      schedule_mismatch: flags.includes('schedule_mismatch'),
    };
  });

  return {
    target_date: target,
    source_date: resolvedSource,
    only_gaps: Boolean(onlyGaps),
    rows,
    summary: {
      copyable: rows.filter((r) => r.include).length,
      conflicts: rows.filter((r) => r.target_existing_plan).length,
      missing_sources: rows.filter((r) => !r.source_plan).length,
      schedule_mismatches: rows.filter((r) => r.schedule_mismatch && r.include).length,
    },
  };
}

async function applyCopyLines({ targetDate, lines, replaceConflicts = false }) {
  const target = parseDateKey(targetDate);
  if (!target) throw Object.assign(new Error('target_date is required'), { status: 400 });
  if (!Array.isArray(lines) || lines.length === 0) {
    throw Object.assign(new Error('At least one line is required'), { status: 400 });
  }

  const planningController = getPlanningController();

  return withTransaction(async (conn) => {
    const saved = [];
    const skipped = [];

    for (const line of lines) {
      if (line.include === false) {
        skipped.push({ work_centre_id: line.work_centre_id, reason: 'not_selected' });
        continue;
      }

      const payload = line.proposed || line;
      const wcId = Number(payload.work_centre_id || line.work_centre_id);
      const [existing] = await conn.execute(
        `SELECT id FROM production_plan
         WHERE DATE(plan_date) = DATE(?) AND work_centre_id = ? AND deleted_at IS NULL
         LIMIT 1`,
        [target, wcId]
      );

      if (existing.length > 0 && !replaceConflicts) {
        skipped.push({ work_centre_id: wcId, reason: 'conflict' });
        continue;
      }

      const planPayload = {
        ...payload,
        plan_date: target,
        work_centre_id: wcId,
      };
      const result = await planningController.validateAndUpsertPlan(
        conn,
        planPayload,
        existing.length > 0 ? existing[0].id : null
      );
      saved.push({ work_centre_id: wcId, id: result.id });
    }

    return { saved, skipped, saved_count: saved.length };
  });
}

async function getScheduleSyncPreview(targetDate) {
  const target = parseDateKey(targetDate);
  if (!target) throw Object.assign(new Error('target_date is required'), { status: 400 });

  const [workCentres, targetPlans, schedules] = await Promise.all([
    fetchActiveWorkCentres(),
    fetchPlansByDate(target),
    fetchScheduleByDate(target),
  ]);

  const rows = [];
  for (const wc of workCentres) {
    const wcId = Number(wc.id);
    const schedule = schedules.get(wcId);
    if (!schedule?.style_id) continue;

    const targetPlan = targetPlans.get(wcId) || null;
    const [routingRows] = await db.execute(
      `SELECT prh.*
       FROM production_routing_header prh
       WHERE prh.style_id = ? AND prh.deleted_at IS NULL
       ORDER BY prh.id DESC LIMIT 1`,
      [schedule.style_id]
    );
    if (routingRows.length === 0) {
      rows.push({
        work_centre_id: wcId,
        work_centre_code: wc.code,
        work_centre_name: wc.name,
        schedule,
        target_existing_plan: targetPlan,
        proposed: null,
        flags: ['no_routing'],
        include: false,
        schedule_mismatch: Boolean(targetPlan && Number(targetPlan.style_id) !== Number(schedule.style_id)),
      });
      continue;
    }

    const header = routingRows[0];
    const [routingLines] = await db.execute(
      'SELECT observed_time, rating_factor, manpower FROM production_routing_lines WHERE routing_header_id = ?',
      [header.id]
    );
    const built = lineStyleAssignmentService.buildPlanPayload(
      { header, lines: routingLines },
      wcId,
      target,
      targetPlan,
      {}
    );

    const mismatch = Boolean(targetPlan && Number(targetPlan.style_id) !== Number(schedule.style_id));
    rows.push({
      work_centre_id: wcId,
      work_centre_code: wc.code,
      work_centre_name: wc.name,
      schedule,
      target_existing_plan: targetPlan,
      proposed: built,
      flags: mismatch ? ['schedule_mismatch'] : ['ready'],
      include: mismatch || !targetPlan,
      schedule_mismatch: mismatch,
    });
  }

  return {
    target_date: target,
    rows,
    summary: {
      syncable: rows.filter((r) => r.include && r.proposed).length,
      no_routing: rows.filter((r) => r.flags.includes('no_routing')).length,
      mismatches: rows.filter((r) => r.schedule_mismatch).length,
    },
  };
}

async function applyScheduleSync({ targetDate, workCentreIds, replaceConflicts = true }) {
  const preview = await getScheduleSyncPreview(targetDate);
  const idSet = workCentreIds?.length
    ? new Set(workCentreIds.map(Number))
    : null;

  const lines = preview.rows
    .filter((r) => r.proposed && r.include)
    .filter((r) => !idSet || idSet.has(r.work_centre_id))
    .map((r) => ({
      work_centre_id: r.work_centre_id,
      proposed: r.proposed,
      include: true,
    }));

  return applyCopyLines({
    targetDate,
    lines,
    replaceConflicts,
  });
}

module.exports = {
  parseDateKey,
  addDays,
  findLastPlanDate,
  resolveSourceDate,
  getTodayBoard,
  getWeekGrid,
  getCopyPreview,
  applyCopyLines,
  getScheduleSyncPreview,
  applyScheduleSync,
};
