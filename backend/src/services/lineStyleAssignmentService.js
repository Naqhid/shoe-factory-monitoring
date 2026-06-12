'use strict';

const db = require('../../config/database');
const { withTransaction, assertExists } = require('../utils/transaction');
const { activeWorkCentreWhere } = require('../utils/workCentreSql');

function getPlanningController() {
  return require('../controllers/productionPlanningController');
}

const ASSIGNMENT_SELECT = `
  lsa.id,
  DATE_FORMAT(lsa.assignment_date, '%Y-%m-%d') AS assignment_date,
  lsa.work_centre_id,
  lsa.style_id,
  lsa.customer_id,
  lsa.group_id,
  lsa.leather_id,
  lsa.color_id,
  lsa.routing_header_id,
  lsa.notes,
  lsa.created_at,
  lsa.updated_at,
  wc.code AS work_centre_code,
  wc.name AS work_centre_name,
  s.code AS style_code,
  s.name AS style_name,
  c.name AS customer_name,
  g.name AS group_name,
  l.name AS leather_name,
  col.name AS color_name
`;

function parseDateKey(value) {
  if (!value) return null;
  const part = String(value).trim().split('T')[0];
  return /^\d{4}-\d{2}-\d{2}$/.test(part) ? part : null;
}

function enumerateDates(fromDate, toDate) {
  const from = parseDateKey(fromDate);
  const to = parseDateKey(toDate || fromDate);
  if (!from || !to) return [];
  const dates = [];
  const cursor = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  if (cursor > end) return [];
  while (cursor <= end) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, '0');
    const d = String(cursor.getDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function computeManHoursMinutes(lines = []) {
  const totalSecs = lines.reduce((sum, line) => {
    const obs = parseFloat(line.observed_time) || 0;
    const rf = parseFloat(line.rating_factor) || 0;
    const mp = parseFloat(line.manpower) || 0;
    const stdTime = (obs * rf / 100) * 1.15;
    return sum + stdTime * mp;
  }, 0);
  return Math.round(totalSecs / 60);
}

async function fetchRoutingForStyle(conn, styleId) {
  const [rows] = await conn.execute(
    `SELECT prh.*
     FROM production_routing_header prh
     WHERE prh.style_id = ? AND prh.deleted_at IS NULL
     ORDER BY prh.id DESC
     LIMIT 1`,
    [styleId]
  );
  if (rows.length === 0) return null;
  const [lines] = await conn.execute(
    'SELECT observed_time, rating_factor, manpower FROM production_routing_lines WHERE routing_header_id = ?',
    [rows[0].id]
  );
  return { header: rows[0], lines };
}

function buildPlanPayload(routing, workCentreId, planDate, existingPlan = null, overrides = {}) {
  const header = routing.header;
  const totalTarget = overrides.total_target_per_day != null
    ? Number(overrides.total_target_per_day)
    : Number(header.target_per_day);
  const targetPairsPerTray = existingPlan?.target_pairs_per_tray != null
    ? Number(existingPlan.target_pairs_per_tray)
    : 24;
  const trayCount = totalTarget && targetPairsPerTray
    ? Math.ceil(totalTarget / targetPairsPerTray)
    : (existingPlan?.tray_count != null ? Number(existingPlan.tray_count) : 0);

  return {
    plan_date: planDate,
    style_id: header.style_id,
    customer_id: header.customer_id,
    group_id: header.group_id || null,
    leather_id: header.leather_id || null,
    color_id: header.color_id || null,
    work_centre_id: workCentreId,
    total_target_per_day: totalTarget,
    target_pairs_per_tray: targetPairsPerTray,
    tray_count: trayCount,
    man_hours_minutes: computeManHoursMinutes(routing.lines),
    smv_per_pair: Number(header.tot_smv),
  };
}

async function upsertAssignment(conn, payload) {
  const {
    assignment_date,
    work_centre_id,
    style_id,
    customer_id,
    group_id,
    leather_id,
    color_id,
    routing_header_id,
    notes,
  } = payload;

  const [existing] = await conn.execute(
    `SELECT id FROM line_style_assignments
     WHERE assignment_date = ? AND work_centre_id = ? AND deleted_at IS NULL
     LIMIT 1`,
    [assignment_date, work_centre_id]
  );

  if (existing.length > 0) {
    await conn.execute(
      `UPDATE line_style_assignments
       SET style_id = ?, customer_id = ?, group_id = ?, leather_id = ?, color_id = ?,
           routing_header_id = ?, notes = ?, updated_at = NOW()
       WHERE id = ? AND deleted_at IS NULL`,
      [
        style_id, customer_id, group_id, leather_id, color_id,
        routing_header_id, notes || null, existing[0].id,
      ]
    );
    return { id: existing[0].id, replaced: true };
  }

  const [result] = await conn.execute(
    `INSERT INTO line_style_assignments
       (assignment_date, work_centre_id, style_id, customer_id, group_id, leather_id, color_id, routing_header_id, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      assignment_date, work_centre_id, style_id, customer_id,
      group_id, leather_id, color_id, routing_header_id, notes || null,
    ]
  );
  return { id: result.insertId, replaced: false };
}

async function getExistingPlan(conn, planDate, workCentreId) {
  const [rows] = await conn.execute(
    `SELECT id, target_pairs_per_tray, tray_count
     FROM production_plan
     WHERE DATE(plan_date) = DATE(?) AND work_centre_id = ? AND deleted_at IS NULL
     LIMIT 1`,
    [planDate, workCentreId]
  );
  return rows[0] || null;
}

async function applyChangeover(payload = {}) {
  const workCentreId = Number(payload.work_centre_id);
  const styleId = Number(payload.style_id);
  const fromDate = parseDateKey(payload.from_date || payload.assignment_date);
  const explicitTo = parseDateKey(payload.to_date);
  const openEnded = payload.open_ended === true
    || !explicitTo
    || explicitTo === fromDate;
  const toDate = openEnded ? fromDate : explicitTo;
  const updatePlan = payload.update_plan !== false;
  const notes = payload.notes || null;
  const totalTargetOverride = payload.total_target_per_day;

  if (!workCentreId || !styleId || !fromDate) {
    throw Object.assign(new Error('work_centre_id, style_id, and from_date are required'), { status: 400 });
  }
  if (!toDate) {
    throw Object.assign(new Error('Invalid start date'), { status: 400 });
  }
  if (!openEnded && toDate < fromDate) {
    throw Object.assign(new Error('End date cannot be before start date'), { status: 400 });
  }

  const dates = enumerateDates(fromDate, toDate);
  if (dates.length === 0) {
    throw Object.assign(new Error('Invalid date range'), { status: 400 });
  }
  if (!openEnded && dates.length > 31) {
    throw Object.assign(new Error('Date range cannot exceed 31 days'), { status: 400 });
  }

  return withTransaction(async (conn) => {
    await assertExists(conn, 'work_centres', workCentreId, 'Work centre');
    await assertExists(conn, 'styles', styleId, 'Style');

    const routing = await fetchRoutingForStyle(conn, styleId);
    if (!routing) {
      throw Object.assign(
        new Error('No production routing found for the selected style. Create routing first.'),
        { status: 422 }
      );
    }

    const header = routing.header;
    const assignmentBase = {
      work_centre_id: workCentreId,
      style_id: styleId,
      customer_id: header.customer_id,
      group_id: header.group_id || null,
      leather_id: header.leather_id || null,
      color_id: header.color_id || null,
      routing_header_id: header.id,
      notes,
    };

    const results = [];
    for (const assignmentDate of dates) {
      const assignmentResult = await upsertAssignment(conn, {
        ...assignmentBase,
        assignment_date: assignmentDate,
      });

      let planResult = null;
      if (updatePlan) {
        const existingPlan = await getExistingPlan(conn, assignmentDate, workCentreId);
        const planPayload = buildPlanPayload(
          routing,
          workCentreId,
          assignmentDate,
          existingPlan,
          { total_target_per_day: totalTargetOverride }
        );
        planResult = await getPlanningController().validateAndUpsertPlan(conn, planPayload);
      }

      results.push({
        assignment_date: assignmentDate,
        assignment: assignmentResult,
        plan: planResult,
      });
    }

    return {
      work_centre_id: workCentreId,
      style_id: styleId,
      from_date: fromDate,
      to_date: toDate,
      days_updated: results.length,
      results,
    };
  });
}

async function getBoard(assignmentDate) {
  const dateKey = parseDateKey(assignmentDate) || parseDateKey(new Date().toISOString());
  const [rows] = await db.execute(
    `SELECT
       wc.id AS work_centre_id,
       wc.code AS work_centre_code,
       wc.name AS work_centre_name,
       lsa.id AS assignment_id,
       DATE_FORMAT(lsa.assignment_date, '%Y-%m-%d') AS effective_from_date,
       lsa.style_id,
       lsa.notes,
       s.code AS style_code,
       s.name AS style_name,
       c.name AS customer_name,
       g.name AS group_name,
       l.name AS leather_name,
       col.name AS color_name,
       pp.id AS plan_id,
       pp.style_id AS plan_style_id,
       ps.code AS plan_style_code,
       ps.name AS plan_style_name
     FROM work_centres wc
     LEFT JOIN line_style_assignments lsa
       ON lsa.id = (
         SELECT lsa2.id
         FROM line_style_assignments lsa2
         WHERE lsa2.work_centre_id = wc.id
           AND lsa2.assignment_date <= ?
           AND lsa2.deleted_at IS NULL
         ORDER BY lsa2.assignment_date DESC, lsa2.id DESC
         LIMIT 1
       )
     LEFT JOIN styles s ON lsa.style_id = s.id
     LEFT JOIN customers c ON lsa.customer_id = c.id
     LEFT JOIN groups_master g ON lsa.group_id = g.id
     LEFT JOIN leather l ON lsa.leather_id = l.id
     LEFT JOIN colors col ON lsa.color_id = col.id
     LEFT JOIN production_plan pp
       ON pp.work_centre_id = wc.id
      AND DATE(pp.plan_date) = DATE(?)
      AND pp.deleted_at IS NULL
     LEFT JOIN styles ps ON pp.style_id = ps.id
     WHERE ${activeWorkCentreWhere('wc')}
     ORDER BY wc.code, wc.name`,
    [dateKey, dateKey]
  );
  return { assignment_date: dateKey, lines: rows };
}

async function listAssignments(filters = {}) {
  const conditions = ['lsa.deleted_at IS NULL'];
  const params = [];

  const dateKey = parseDateKey(filters.assignment_date);
  if (dateKey) {
    conditions.push('lsa.assignment_date = ?');
    params.push(dateKey);
  }
  if (filters.work_centre_id) {
    conditions.push('lsa.work_centre_id = ?');
    params.push(Number(filters.work_centre_id));
  }
  const fromDate = parseDateKey(filters.from_date);
  const toDate = parseDateKey(filters.to_date);
  if (fromDate) {
    conditions.push('lsa.assignment_date >= ?');
    params.push(fromDate);
  }
  if (toDate) {
    conditions.push('lsa.assignment_date <= ?');
    params.push(toDate);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [rows] = await db.execute(
    `SELECT ${ASSIGNMENT_SELECT}
     FROM line_style_assignments lsa
     JOIN work_centres wc ON lsa.work_centre_id = wc.id
     JOIN styles s ON lsa.style_id = s.id
     LEFT JOIN customers c ON lsa.customer_id = c.id
     LEFT JOIN groups_master g ON lsa.group_id = g.id
     LEFT JOIN leather l ON lsa.leather_id = l.id
     LEFT JOIN colors col ON lsa.color_id = col.id
     ${where}
     ORDER BY lsa.assignment_date DESC, wc.code ASC
     LIMIT 500`,
    params
  );
  return rows;
}

async function softDeleteAssignment(id) {
  const [result] = await db.execute(
    'UPDATE line_style_assignments SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL',
    [id]
  );
  if (result.affectedRows === 0) {
    throw Object.assign(new Error('Assignment not found'), { status: 404 });
  }
  return { id: Number(id) };
}

module.exports = {
  parseDateKey,
  enumerateDates,
  applyChangeover,
  getBoard,
  listAssignments,
  softDeleteAssignment,
  fetchRoutingForStyle,
  buildPlanPayload,
};
