const db = require('../../config/database');
const logger = require('../utils/logger');
const { getRoutingMinsColumnName, getPairsPerRoutingBin } = require('../utils/routingMinsColumn');
const {
  buildPaceSnapshot,
  performanceGradeFromPaceEfficiency,
  routingMapKey,
  toLocalDateStr,
} = require('../utils/shiftPaceEfficiency');
const wipStateService = require('../services/wipStateService');
const { buildMachineTimeLossReportRows } = require('../utils/cycleLossMins');

/** Per-line input from work_centres.input_machine_id (fallback 01). */
const SQL_LINE_INPUT_JOIN = `
  LEFT JOIN (
    SELECT mcp.work_centre_id, DATE(mcp.prod_date) AS prod_date, SUM(mcp.output_pairs) AS total_input
    FROM machine_centre_production mcp
    INNER JOIN work_centres wc_in ON wc_in.id = mcp.work_centre_id
    WHERE mcp.button_status = 2
      AND mcp.machine_id = COALESCE(NULLIF(wc_in.input_machine_id, ''), '01')
    GROUP BY mcp.work_centre_id, DATE(mcp.prod_date)
  ) line_input ON line_input.work_centre_id = %WC% AND line_input.prod_date = %DATE%`;

const SQL_LINE_EOL_JOIN = `
  LEFT JOIN (
    SELECT mcp.work_centre_id, DATE(mcp.prod_date) AS prod_date, SUM(mcp.output_pairs) AS line_eol_output
    FROM machine_centre_production mcp
    INNER JOIN work_centres wc_eol ON wc_eol.id = mcp.work_centre_id
    WHERE mcp.button_status = 2
      AND mcp.machine_id = COALESCE(NULLIF(wc_eol.eol_machine_id, ''), '07')
    GROUP BY mcp.work_centre_id, DATE(mcp.prod_date)
  ) line_eol ON line_eol.work_centre_id = %WC% AND line_eol.prod_date = %DATE%`;

/** Per-machine daily totals from production (summary table is often stale/empty). */
const SQL_MACHINE_EFFICIENCY_FROM = `
  FROM (
    SELECT
      DATE(prod_date) AS prod_date,
      work_centre_id,
      machine_id,
      SUM(output_pairs) AS total_output_pairs,
      SUM(target_mins) AS total_target_mins,
      SUM(COALESCE(TIMESTAMPDIFF(MINUTE, start_time, finish_time), 0)) AS total_actual_mins,
      SUM(COALESCE(idle_mins, 0)) AS total_idle_mins,
      CASE
        WHEN (SUM(COALESCE(TIMESTAMPDIFF(MINUTE, start_time, finish_time), 0)) + SUM(COALESCE(idle_mins, 0))) > 0
        THEN LEAST(
          (SUM(target_mins) / (SUM(COALESCE(TIMESTAMPDIFF(MINUTE, start_time, finish_time), 0)) + SUM(COALESCE(idle_mins, 0)))) * 100,
          9999.99
        )
        ELSE 0
      END AS avg_efficiency_percent
    FROM machine_centre_production
    WHERE button_status = 2 AND DATE(prod_date) BETWEEN ? AND ?
    GROUP BY DATE(prod_date), work_centre_id, machine_id
  ) mcs`;

/** Per employee + machine/day from production (summary table is often empty for past dates). */
const SQL_EMPLOYEE_PERF_FROM = `
  FROM (
    SELECT
      DATE(prod_date) AS prod_date,
      work_centre_id,
      machine_id,
      emp_id,
      SUM(output_pairs) AS total_output_pairs,
      SUM(target_mins) AS total_target_mins,
      SUM(COALESCE(TIMESTAMPDIFF(MINUTE, start_time, finish_time), 0)) AS total_actual_mins,
      SUM(COALESCE(idle_mins, 0)) AS total_idle_mins
    FROM machine_centre_production
    WHERE button_status = 2 AND DATE(prod_date) BETWEEN ? AND ?
    GROUP BY DATE(prod_date), work_centre_id, machine_id, emp_id
  ) mcs`;

// Shared pagination helper — wraps any query with COUNT + LIMIT/OFFSET
const paginate = (page, limit) => {
  const p = Math.max(1, parseInt(page) || 1);
  const l = Math.min(500, Math.max(1, parseInt(limit) || 50));
  return { page: p, limit: l, offset: (p - 1) * l };
};

const stripStoppageDetail = (detail) => {
  if (!detail) return '';
  return String(detail)
    .replace(/^BOTTLENECK:/i, '')
    .replace(/^BREAKDOWN:/i, '')
    .replace(/\s*\[Approved By:[^\]]+\]\s*$/i, '')
    .trim();
};

/**
 * Routing mins per machine/day — SUM all routing lines (same as TV dashboard target_mins_per_box).
 */
async function loadRoutingMinsMap(fromDate, toDate, workCentreId) {
  const routingMinsCol = await getRoutingMinsColumnName();
  const pairsPerBin = await getPairsPerRoutingBin();
  const routingParams = [fromDate, toDate];
  if (workCentreId) routingParams.push(workCentreId);
  const [routingRows] = await db.query(`
    SELECT
      pp2.work_centre_id,
      DATE(pp2.plan_date) AS plan_date,
      prl.machine_centre_id AS machine_id,
      ROUND(SUM(prl.${routingMinsCol}), 2) AS routing_mins_per_box
    FROM production_routing_lines prl
    INNER JOIN production_routing_header prh
      ON prl.routing_header_id = prh.id AND prh.deleted_at IS NULL
    INNER JOIN production_plan pp2
      ON prh.style_id = pp2.style_id AND pp2.deleted_at IS NULL
    WHERE DATE(pp2.plan_date) BETWEEN ? AND ?
      ${workCentreId ? 'AND pp2.work_centre_id = ?' : ''}
    GROUP BY pp2.work_centre_id, DATE(pp2.plan_date), prl.machine_centre_id
  `, routingParams);

  const map = new Map();
  for (const row of routingRows) {
    const key = routingMapKey(row.work_centre_id, row.plan_date, row.machine_id);
    map.set(key, Number(row.routing_mins_per_box) || 0);
  }
  return { map, pairsPerBin };
}

/** MES WIP per line/day — same as TV dashboard (Opening + Input − EOL output). */
async function enrichRowsWithMesWip(rows) {
  const cache = new Map();
  const out = [];
  for (const row of rows) {
    const wcId = Number(row.work_centre_id);
    const dateStr = toLocalDateStr(row.date);
    const key = `${wcId}|${dateStr}`;
    if (!cache.has(key)) {
      let wip = 0;
      if (Number.isFinite(wcId) && wcId > 0 && dateStr) {
        const snap = await wipStateService.computeAndPersistWip(wcId, dateStr);
        wip = Math.round(Number(snap.currentWip) || 0);
      }
      cache.set(key, wip);
    }
    out.push({ ...row, wip: cache.get(key) });
  }
  return out;
}

function enrichRowsWithPaceEfficiency(rows, routingCtx, { withGrade = false, machinePaceTargets = false, usePaceDailyForPlannedQty = false } = {}) {
  const { map, pairsPerBin } = routingCtx;
  const now = new Date();
  return rows.map((row) => {
    const dateStr = toLocalDateStr(row.date);
    const wcId = row.work_centre_id;
    const machineId = row.machine_id;
    const output = Number(row.output ?? row.total_output ?? 0);
    const routingMins = map.get(routingMapKey(wcId, dateStr, machineId)) || 0;
    const pace = buildPaceSnapshot(output, routingMins, pairsPerBin, dateStr, now);
    const enriched = {
      ...row,
      efficiency_percent: pace.pacePct,
      pace_in_progress_actual: pace.actual,
      pace_in_progress_expected: pace.expected,
      pace_daily_target: pace.daily,
    };
    if (machinePaceTargets) {
      if (pace.daily > 0) {
        enriched.line_plan_target = Number(row.target) || 0;
        enriched.target = pace.daily;
        enriched.output_percent = Math.round((output / pace.daily) * 100);
      }
    }
    if (usePaceDailyForPlannedQty && pace.daily > 0) {
      enriched.line_plan_planned_qty = Number(row.total_planned_qty) || 0;
      enriched.total_planned_qty = pace.daily;
      enriched.output_percent = Math.round((output / pace.daily) * 100);
    }
    if (withGrade) {
      enriched.performance_grade = performanceGradeFromPaceEfficiency(pace.pacePct);
    }
    return enriched;
  });
}

const STOPPAGE_REPORT_WHERE = {
  bottleneck: `AND (
    (mcp.button_status = 1
     AND mcp.idle_start_time IS NOT NULL
     AND mcp.idle_stop_time IS NULL
     AND mcp.stoppage_reason LIKE 'BOTTLENECK:%')
    OR (mcp.button_status = 2
        AND mcp.stoppage_reason LIKE 'BOTTLENECK:%'
        AND LOWER(mcp.stoppage_reason) NOT LIKE '%breakdown%')
  )`,
  breakdown: `AND (
    (mcp.button_status = 1
     AND mcp.idle_start_time IS NOT NULL
     AND mcp.idle_stop_time IS NULL
     AND (
       LOWER(mcp.stoppage_reason) LIKE '%breakdown%'
       OR mcp.stoppage_reason LIKE 'BREAKDOWN:%'
     ))
    OR (mcp.button_status = 2
        AND (
          mcp.stoppage_reason LIKE 'BREAKDOWN:%'
          OR LOWER(mcp.stoppage_reason) LIKE '%machine breakdown%'
          OR (mcp.stoppage_reason LIKE 'BOTTLENECK:%'
              AND LOWER(mcp.stoppage_reason) LIKE '%breakdown%')
        ))
  )`,
};

class ApiController {

  async getHourlyProductionStatus(req, res) {
    try {
      const { fromDate, toDate, workCentreId, machineId, search, page, limit } = req.query;
      if (!fromDate || !toDate) return res.status(400).json({ success: false, error: 'fromDate and toDate are required' });

      const { page: p, limit: l, offset } = paginate(page, limit);
      let resolvedMachineId = machineId ? String(machineId) : null;
      if (!resolvedMachineId && workCentreId) {
        resolvedMachineId = await wipStateService.resolveEolMachineId(Number(workCentreId));
      }
      if (!resolvedMachineId) {
        resolvedMachineId = '07';
      }
      let where = 'WHERE DATE(mcp.prod_date) BETWEEN ? AND ? AND mcp.button_status = 2';
      const params = [fromDate, toDate];
      if (workCentreId) { where += ' AND mcp.work_centre_id = ?'; params.push(workCentreId); }
      where += ' AND mcp.machine_id = ?';
      params.push(resolvedMachineId);
      if (search) { where += ' AND (wc.name LIKE ? OR c.name LIKE ? OR s.name LIKE ? OR col.name LIKE ?)'; const s = `%${search}%`; params.push(s,s,s,s); }

      const baseQuery = `
        FROM machine_centre_production mcp
        LEFT JOIN work_centres wc ON mcp.work_centre_id = wc.id
        LEFT JOIN production_plan pp ON mcp.work_centre_id = pp.work_centre_id AND DATE(mcp.prod_date) = pp.plan_date
        LEFT JOIN customers c ON pp.customer_id = c.id
        LEFT JOIN styles s ON pp.style_id = s.id
        LEFT JOIN colors col ON pp.color_id = col.id
        LEFT JOIN leather l ON pp.leather_id = l.id
        LEFT JOIN groups_master g ON pp.group_id = g.id
        ${SQL_LINE_INPUT_JOIN.replace(/%WC%/g, 'mcp.work_centre_id').replace(/%DATE%/g, 'DATE(mcp.prod_date)')}
        ${where}
        GROUP BY DATE(mcp.prod_date), mcp.work_centre_id, wc.name, pp.total_target_per_day, line_input.total_input, c.name, s.name, col.name, l.name, g.name`;

      const [[{ total }]] = await db.query(`SELECT COUNT(*) as total FROM (SELECT 1 ${baseQuery}) t`, params);
      const [rawRows] = await db.query(`
        SELECT DATE(mcp.prod_date) as date, mcp.work_centre_id, wc.name as line, c.name as customer, s.name as article_no,
          col.name as color, l.name as leather, g.name as \`group\`,
          pp.total_target_per_day as total_planned_qty,
          COALESCE(line_input.total_input, 0) as total_input,
          ROUND((COALESCE(line_input.total_input, 0) / NULLIF(pp.total_target_per_day, 0)) * 100, 1) as input_percent,
          SUM(mcp.output_pairs) as total_output,
          ROUND((SUM(mcp.output_pairs) / NULLIF(pp.total_target_per_day, 0)) * 100, 1) as output_percent,
          ROUND(
            SUM(mcp.output_pairs) / NULLIF(COUNT(DISTINCT HOUR(mcp.start_time)), 0),
            1
          ) as avg_hourly_output,
          SUM(CASE WHEN HOUR(mcp.start_time)=9 THEN mcp.output_pairs ELSE 0 END) as \`9_10\`,
          SUM(CASE WHEN HOUR(mcp.start_time)=10 THEN mcp.output_pairs ELSE 0 END) as \`10_11\`,
          SUM(CASE WHEN HOUR(mcp.start_time)=11 THEN mcp.output_pairs ELSE 0 END) as \`11_12\`,
          SUM(CASE WHEN HOUR(mcp.start_time)=12 THEN mcp.output_pairs ELSE 0 END) as \`12_1\`,
          SUM(CASE WHEN HOUR(mcp.start_time)=14 THEN mcp.output_pairs ELSE 0 END) as \`2_3\`,
          SUM(CASE WHEN HOUR(mcp.start_time)=15 THEN mcp.output_pairs ELSE 0 END) as \`3_4\`,
          SUM(CASE WHEN HOUR(mcp.start_time)=16 THEN mcp.output_pairs ELSE 0 END) as \`4_5\`,
          SUM(CASE WHEN HOUR(mcp.start_time)=17 THEN mcp.output_pairs ELSE 0 END) as \`5_6\`,
          SUM(CASE WHEN HOUR(mcp.start_time)=18 THEN mcp.output_pairs ELSE 0 END) as \`6_7\`
        ${baseQuery} ORDER BY date, wc.name LIMIT ? OFFSET ?`, [...params, l, offset]);

      const data = await enrichRowsWithMesWip(rawRows);

      res.json({ success: true, data, pagination: { total, page: p, limit: l, totalPages: Math.ceil(total / l) } });
    } catch (error) {
      logger.error('Error getting hourly production status:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  async getLineProcessEfficiency(req, res) {
    try {
      const { fromDate, toDate, workCentreId, search, page, limit } = req.query;
      if (!fromDate || !toDate) return res.status(400).json({ success: false, error: 'fromDate and toDate are required' });

      const { page: p, limit: l, offset } = paginate(page, limit);
      logger.info(`Line efficiency search: "${search}", workCentreId: ${workCentreId}, params: ${JSON.stringify(req.query)}`);
      let where = 'WHERE 1=1';
      const params = [fromDate, toDate];
      if (workCentreId) { where += ' AND mcs.work_centre_id = ?'; params.push(workCentreId); }
      if (search) { where += ' AND (wc.name LIKE ? OR mc.name LIKE ? OR mc.machine_name LIKE ? OR c.name LIKE ?)'; const s = `%${search}%`; params.push(s,s,s,s); }

      const baseQuery = `
        ${SQL_MACHINE_EFFICIENCY_FROM}
        LEFT JOIN work_centres wc ON mcs.work_centre_id = wc.id
        LEFT JOIN machine_centres mc ON mcs.machine_id = mc.machine_id
        LEFT JOIN production_plan pp ON mcs.work_centre_id = pp.work_centre_id AND mcs.prod_date = pp.plan_date AND pp.deleted_at IS NULL
        LEFT JOIN customers c ON pp.customer_id = c.id
        LEFT JOIN styles s ON pp.style_id = s.id
        LEFT JOIN colors col ON pp.color_id = col.id
        LEFT JOIN leather l ON pp.leather_id = l.id
        LEFT JOIN groups_master g ON pp.group_id = g.id
        ${SQL_LINE_INPUT_JOIN.replace(/%WC%/g, 'mcs.work_centre_id').replace(/%DATE%/g, 'mcs.prod_date')}
        ${where}`;

      const [[{ total }]] = await db.query(`SELECT COUNT(*) as total ${baseQuery}`, params);
      const [rawRows] = await db.query(`
        SELECT mcs.prod_date as date, mcs.work_centre_id, mcs.machine_id,
          wc.name as line, COALESCE(mc.machine_name, mc.name) as process,
          c.name as customer, s.name as article_no, col.name as color, l.name as leather, g.name as \`group\`,
          pp.total_target_per_day as total_planned_qty,
          COALESCE(line_input.total_input, 0) as total_input,
          ROUND((COALESCE(line_input.total_input, 0) / NULLIF(pp.total_target_per_day, 0)) * 100, 1) as input_percent,
          mcs.total_output_pairs as total_output,
          ROUND((mcs.total_output_pairs/NULLIF(pp.total_target_per_day,0))*100,1) as output_percent,
          mcs.total_target_mins as total_standard_mins_value, mcs.total_actual_mins as total_produced_mins_value,
          ROUND(pp.total_target_per_day*(mcs.total_target_mins/(8*60)),0) as targeted_output_smv
        ${baseQuery} ORDER BY date, wc.name, process LIMIT ? OFFSET ?`, [...params, l, offset]);

      const routingCtx = await loadRoutingMinsMap(fromDate, toDate, workCentreId);
      const data = enrichRowsWithPaceEfficiency(rawRows, routingCtx, { usePaceDailyForPlannedQty: true });

      res.json({ success: true, data, pagination: { total, page: p, limit: l, totalPages: Math.ceil(total / l) } });
    } catch (error) {
      logger.error('Error getting line process efficiency:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  async getAttendanceReport(req, res) {
    try {
      const { fromDate, toDate, workCentreId, search, page, limit } = req.query;
      if (!fromDate || !toDate) return res.status(400).json({ success: false, error: 'fromDate and toDate are required' });

      const { page: p, limit: l, offset } = paginate(page, limit);
      let wcFilter = '';
      const params = [fromDate, fromDate, toDate];
      if (workCentreId) { wcFilter = 'AND e.work_centre_id = ?'; params.push(workCentreId); }
      if (search) { wcFilter += ' AND (e.name LIKE ? OR e.code LIKE ? OR wc.name LIKE ?)'; const s = `%${search}%`; params.push(s,s,s); }

      const baseQuery = `
        FROM employees e
        JOIN work_centres wc ON e.work_centre_id = wc.id
        CROSS JOIN (
          SELECT DATE_ADD(?, INTERVAL seq DAY) as d
          FROM (SELECT 0 seq UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4
                UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9
                UNION SELECT 10 UNION SELECT 11 UNION SELECT 12 UNION SELECT 13 UNION SELECT 14
                UNION SELECT 15 UNION SELECT 16 UNION SELECT 17 UNION SELECT 18 UNION SELECT 19
                UNION SELECT 20 UNION SELECT 21 UNION SELECT 22 UNION SELECT 23 UNION SELECT 24
                UNION SELECT 25 UNION SELECT 26 UNION SELECT 27 UNION SELECT 28 UNION SELECT 29
                UNION SELECT 30) nums
          WHERE DATE_ADD(?, INTERVAL seq DAY) <= ?
        ) dates
        LEFT JOIN mobile_sessions ms ON ms.emp_id = e.id AND DATE(ms.activated_at) = dates.d AND ms.status = 'active'
        LEFT JOIN production_plan pp ON pp.work_centre_id = e.work_centre_id AND pp.plan_date = dates.d
        ${SQL_LINE_INPUT_JOIN.replace(/%WC%/g, 'e.work_centre_id').replace(/%DATE%/g, 'dates.d')}
        ${SQL_LINE_EOL_JOIN.replace(/%WC%/g, 'e.work_centre_id').replace(/%DATE%/g, 'dates.d')}
        WHERE e.work_centre_id IS NOT NULL ${wcFilter}`;

      const [[{ total }]] = await db.query(`SELECT COUNT(*) as total FROM (SELECT 1 ${baseQuery}) t`, params);
      const [data] = await db.query(`
        SELECT wc.name as line, e.name as emp_name, e.code as emp_code, dates.d as date,
          CASE WHEN ms.emp_id IS NOT NULL THEN 'Present' ELSE 'Absent' END as status,
          ms.activated_at as login_time,
          COALESCE(pp.total_target_per_day, 0) as target,
          COALESCE(line_input.total_input, 0) as total_input,
          ROUND((COALESCE(line_input.total_input, 0) / NULLIF(pp.total_target_per_day, 0)) * 100, 1) as input_percent,
          COALESCE(line_eol.line_eol_output, 0) as line_eol_output,
          ROUND((COALESCE(line_eol.line_eol_output, 0) / NULLIF(pp.total_target_per_day, 0)) * 100, 1) as output_percent
        ${baseQuery} ORDER BY dates.d, wc.name, e.name LIMIT ? OFFSET ?`, [...params, l, offset]);

      res.json({ success: true, data, pagination: { total, page: p, limit: l, totalPages: Math.ceil(total / l) } });
    } catch (error) {
      logger.error('Error getting attendance report:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  async getReworkRejectionReport(req, res) {
    try {
      const { fromDate, toDate, workCentreId, search, page, limit } = req.query;
      if (!fromDate || !toDate) return res.status(400).json({ success: false, error: 'fromDate and toDate are required' });

      const { page: p, limit: l, offset } = paginate(page, limit);
      let where = 'WHERE DATE(rr.production_date) BETWEEN ? AND ?';
      const params = [fromDate, toDate];
      if (workCentreId) { where += ' AND rr.work_centre_id = ?'; params.push(workCentreId); }
      if (search) { where += ' AND (wc.name LIKE ? OR rr.machine_centre_name LIKE ? OR rr.reason LIKE ?)'; const s = `%${search}%`; params.push(s,s,s); }

      const baseQuery = `
        FROM rework_rejection rr
        LEFT JOIN work_centres wc ON rr.work_centre_id = wc.id
        LEFT JOIN production_plan pp ON pp.work_centre_id = rr.work_centre_id AND pp.plan_date = DATE(rr.production_date)
        ${SQL_LINE_INPUT_JOIN.replace(/%WC%/g, 'rr.work_centre_id').replace(/%DATE%/g, 'DATE(rr.production_date)')}
        ${SQL_LINE_EOL_JOIN.replace(/%WC%/g, 'rr.work_centre_id').replace(/%DATE%/g, 'DATE(rr.production_date)')}
        ${where}`;
      const [[{ total }]] = await db.query(`SELECT COUNT(*) as total ${baseQuery}`, params);
      const [data] = await db.query(`
        SELECT DATE(rr.production_date) as date, wc.name as line, rr.machine_centre_name as machine,
          COALESCE(pp.total_target_per_day, 0) as target,
          COALESCE(line_input.total_input, 0) as total_input,
          ROUND((COALESCE(line_input.total_input, 0) / NULLIF(pp.total_target_per_day, 0)) * 100, 1) as input_percent,
          rr.total_output_pairs as output,
          COALESCE(line_eol.line_eol_output, 0) as line_eol_output,
          ROUND((COALESCE(line_eol.line_eol_output, 0) / NULLIF(pp.total_target_per_day, 0)) * 100, 1) as output_percent,
          rr.bins_completed, rr.rework_qty, rr.rejection_qty,
          ROUND((rr.rework_qty/NULLIF(rr.total_output_pairs,0))*100,2) as rework_percent,
          ROUND((rr.rejection_qty/NULLIF(rr.total_output_pairs,0))*100,2) as rejection_percent,
          rr.reason_category, rr.reason
        ${baseQuery} ORDER BY date, wc.name, rr.machine_centre_name LIMIT ? OFFSET ?`, [...params, l, offset]);

      res.json({ success: true, data, pagination: { total, page: p, limit: l, totalPages: Math.ceil(total / l) } });
    } catch (error) {
      logger.error('Error getting rework rejection report:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  async getEmployeeOutputReport(req, res) {
    try {
      const { fromDate, toDate, workCentreId, search, page, limit } = req.query;
      if (!fromDate || !toDate) return res.status(400).json({ success: false, error: 'fromDate and toDate are required' });

      const { page: p, limit: l, offset } = paginate(page, limit);
      // Use production prod_date (not mobile_sessions.activated_at — that updates on each login).
      let where = 'WHERE DATE(mcp.prod_date) BETWEEN ? AND ? AND mcp.button_status = 2';
      const params = [fromDate, toDate];
      if (workCentreId) { where += ' AND mcp.work_centre_id = ?'; params.push(workCentreId); }
      if (search) {
        where += ' AND (e.name LIKE ? OR e.code LIKE ? OR wc.name LIKE ? OR mc.machine_name LIKE ? OR mc.name LIKE ?)';
        const s = `%${search}%`;
        params.push(s, s, s, s, s);
      }

      const baseQuery = `
        FROM machine_centre_production mcp
        JOIN employees e ON e.code = mcp.emp_id
        JOIN work_centres wc ON mcp.work_centre_id = wc.id
        LEFT JOIN machine_centres mc ON mcp.machine_id = mc.machine_id AND mc.work_centre_id = mcp.work_centre_id
        LEFT JOIN production_plan pp ON pp.work_centre_id = mcp.work_centre_id AND pp.plan_date = DATE(mcp.prod_date)
        ${SQL_LINE_INPUT_JOIN.replace(/%WC%/g, 'mcp.work_centre_id').replace(/%DATE%/g, 'DATE(mcp.prod_date)')}
        ${SQL_LINE_EOL_JOIN.replace(/%WC%/g, 'mcp.work_centre_id').replace(/%DATE%/g, 'DATE(mcp.prod_date)')}
        ${where}
        GROUP BY DATE(mcp.prod_date), mcp.work_centre_id, mcp.emp_id, mcp.machine_id,
          e.code, e.name, wc.name, mc.machine_id, mc.machine_name, mc.name,
          pp.total_target_per_day, line_input.total_input, line_eol.line_eol_output`;

      const [[{ total }]] = await db.query(`SELECT COUNT(*) as total FROM (SELECT 1 ${baseQuery}) t`, params);
      const [data] = await db.query(`
        SELECT DATE(mcp.prod_date) as date, wc.name as line, e.code as emp_code, e.name as emp_name,
          mcp.machine_id, COALESCE(mc.machine_name, mc.name) as machine_name,
          COALESCE(pp.total_target_per_day, 0) as target,
          COALESCE(line_input.total_input, 0) as total_input,
          ROUND((COALESCE(line_input.total_input, 0) / NULLIF(pp.total_target_per_day, 0)) * 100, 1) as input_percent,
          SUM(mcp.output_pairs) as total_output,
          COALESCE(line_eol.line_eol_output, 0) as line_eol_output,
          ROUND((COALESCE(line_eol.line_eol_output, 0) / NULLIF(pp.total_target_per_day, 0)) * 100, 1) as output_percent
        ${baseQuery} ORDER BY date, wc.name, e.name LIMIT ? OFFSET ?`, [...params, l, offset]);

      res.json({ success: true, data, pagination: { total, page: p, limit: l, totalPages: Math.ceil(total / l) } });
    } catch (error) {
      logger.error('Error getting employee output report:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  async getEmployeePerformanceReport(req, res) {
    try {
      const { fromDate, toDate, workCentreId, search, page, limit } = req.query;
      if (!fromDate || !toDate) return res.status(400).json({ success: false, error: 'fromDate and toDate are required' });

      const { page: p, limit: l, offset } = paginate(page, limit);
      let where = 'WHERE 1=1';
      const params = [fromDate, toDate];
      if (workCentreId) { where += ' AND mcs.work_centre_id = ?'; params.push(workCentreId); }
      if (search) { where += ' AND (e.name LIKE ? OR e.code LIKE ? OR wc.name LIKE ? OR mc.machine_name LIKE ? OR mc.name LIKE ?)'; const s = `%${search}%`; params.push(s,s,s,s,s); }

      const baseQuery = `
        ${SQL_EMPLOYEE_PERF_FROM}
        JOIN employees e ON mcs.emp_id = e.code
        JOIN work_centres wc ON mcs.work_centre_id = wc.id
        LEFT JOIN machine_centres mc ON mcs.machine_id = mc.machine_id AND mc.work_centre_id = mcs.work_centre_id
        LEFT JOIN production_plan pp ON mcs.work_centre_id = pp.work_centre_id AND mcs.prod_date = pp.plan_date AND pp.deleted_at IS NULL
        ${SQL_LINE_INPUT_JOIN.replace(/%WC%/g, 'mcs.work_centre_id').replace(/%DATE%/g, 'mcs.prod_date')}
        ${SQL_LINE_EOL_JOIN.replace(/%WC%/g, 'mcs.work_centre_id').replace(/%DATE%/g, 'mcs.prod_date')}
        ${where}`;

      const [[{ total }]] = await db.query(`SELECT COUNT(*) as total ${baseQuery}`, params);
      const [rawRows] = await db.query(`
        SELECT mcs.prod_date as date, mcs.work_centre_id, mcs.machine_id,
          wc.name as line, e.code as emp_code, e.name as emp_name,
          COALESCE(mc.machine_name, mc.name) as machine_name,
          COALESCE(pp.total_target_per_day, 0) as target,
          COALESCE(line_input.total_input, 0) as total_input,
          ROUND((COALESCE(line_input.total_input, 0) / NULLIF(pp.total_target_per_day, 0)) * 100, 1) as input_percent,
          mcs.total_output_pairs as output,
          COALESCE(line_eol.line_eol_output, 0) as line_eol_output,
          ROUND((COALESCE(line_eol.line_eol_output, 0) / NULLIF(pp.total_target_per_day, 0)) * 100, 1) as output_percent,
          mcs.total_target_mins as target_mins, mcs.total_actual_mins as actual_mins,
          mcs.total_idle_mins as idle_mins
        ${baseQuery} ORDER BY date, wc.name, e.name LIMIT ? OFFSET ?`, [...params, l, offset]);

      const routingCtx = await loadRoutingMinsMap(fromDate, toDate, workCentreId);
      const data = enrichRowsWithPaceEfficiency(rawRows, routingCtx, {
        withGrade: true,
        machinePaceTargets: true,
      });

      res.json({ success: true, data, pagination: { total, page: p, limit: l, totalPages: Math.ceil(total / l) } });
    } catch (error) {
      logger.error('Error getting employee performance report:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  // Shift constants: 09:05 - 17:35
  static get SHIFT_START_H() { return 9; }
  static get SHIFT_START_M() { return 5; }
  static get SHIFT_END_H() { return 17; }
  static get SHIFT_END_M() { return 35; }
  static get SHIFT_MINS() { return (17 * 60 + 35) - (9 * 60 + 5); } // 510 mins

  /** Time loss by machine/day — same cycle net balance as TV dashboard machineTimeLosses. */
  async getTimeLossReport(req, res, next) {
    try {
      const { fromDate, toDate, workCentreId, search, page, limit } = req.query;
      if (!fromDate || !toDate) {
        return res.status(400).json({ success: false, error: 'fromDate and toDate are required' });
      }
      const { page: p, limit: l, offset } = paginate(page, limit);
      const allRows = await buildMachineTimeLossReportRows(db, {
        fromDate,
        toDate,
        workCentreId: workCentreId || null,
        search: search || '',
      });
      const total = allRows.length;
      const data = allRows.slice(offset, offset + l);
      res.json({
        success: true,
        data,
        pagination: { total, page: p, limit: l, totalPages: Math.max(1, Math.ceil(total / l)) },
      });
    } catch (error) {
      logger.error('Error getting time loss report:', error);
      return next(error);
    }
  }

  // Legacy: idle events with reasons (replaced in UI by time-loss report)
  async getDowntimeReport(req, res, next) {
    try {
      const { fromDate, toDate, date, work_centre_id = null, workCentreId, page, limit } = req.query;
      const { page: p, limit: l, offset } = paginate(page, limit);
      const from = fromDate || date || new Date().toISOString().slice(0, 10);
      const to = toDate || from;
      let where = 'WHERE DATE(mcp.prod_date) BETWEEN ? AND ? AND mcp.idle_start_time IS NOT NULL';
      const params = [from, to];
      const wcId = work_centre_id || workCentreId || null;
      if (wcId) { where += ' AND mcp.work_centre_id = ?'; params.push(wcId); }
      const [rows] = await db.query(`
        SELECT
          DATE(mcp.prod_date) AS date,
          mcp.id, mcp.machine_id, mc.machine_name, mcp.emp_id, e.name AS employee_name,
          wc.name AS work_centre_name,
          mcp.idle_start_time, mcp.idle_stop_time,
          TIMESTAMPDIFF(MINUTE, mcp.idle_start_time, COALESCE(mcp.idle_stop_time, NOW())) AS idle_mins,
          COALESCE(mcp.stoppage_reason, 'Not specified') AS reason,
          mcp.button_status,
          COALESCE(pp.total_target_per_day, 0) AS target,
          COALESCE(line_input.total_input, 0) AS total_input,
          ROUND((COALESCE(line_input.total_input, 0) / NULLIF(pp.total_target_per_day, 0)) * 100, 1) AS input_percent,
          COALESCE(line_eol.line_eol_output, 0) AS line_eol_output,
          ROUND((COALESCE(line_eol.line_eol_output, 0) / NULLIF(pp.total_target_per_day, 0)) * 100, 1) AS output_percent
        FROM machine_centre_production mcp
        LEFT JOIN machine_centres mc ON mc.machine_id = mcp.machine_id
        LEFT JOIN employees e ON e.code = mcp.emp_id
        LEFT JOIN work_centres wc ON wc.id = mcp.work_centre_id
        LEFT JOIN production_plan pp ON pp.work_centre_id = mcp.work_centre_id AND pp.plan_date = DATE(mcp.prod_date)
        ${SQL_LINE_INPUT_JOIN.replace(/%WC%/g, 'mcp.work_centre_id').replace(/%DATE%/g, 'DATE(mcp.prod_date)')}
        ${SQL_LINE_EOL_JOIN.replace(/%WC%/g, 'mcp.work_centre_id').replace(/%DATE%/g, 'DATE(mcp.prod_date)')}
        ${where}
        ORDER BY mcp.idle_start_time DESC
      `, params);
      // Aggregate by reason
      const byReason = {};
      rows.forEach(r => {
        const key = r.reason || 'Not specified';
        if (!byReason[key]) byReason[key] = { reason: key, count: 0, total_mins: 0 };
        byReason[key].count++;
        byReason[key].total_mins += Number(r.idle_mins || 0);
      });
      res.json({ success: true, fromDate: from, toDate: to, data: rows, by_reason: Object.values(byReason).sort((a, b) => b.total_mins - a.total_mins) });
    } catch (e) { next(e); }
  }

  // #4 Attendance vs production correlation
  async getAttendanceProductionReport(req, res, next) {
    try {
      const { fromDate, toDate, date, work_centre_id = null, workCentreId, page, limit } = req.query;
      const from = fromDate || date || new Date().toISOString().slice(0, 10);
      const to = toDate || from;
      const wcId = work_centre_id || workCentreId || null;
      let wcWhere = wcId ? 'AND ms.work_centre_id = ?' : '';
      const params = [from, to, from, to];
      if (wcId) params.push(wcId);
      const [rows] = await db.query(`
        SELECT
          DATE(ms.activated_at) AS date,
          ms.emp_code, e.name AS employee_name,
          wc.name AS work_centre_name, ms.work_centre_id,
          ms.activated_at AS session_start,
          COALESCE(SUM(mcp.output_pairs), 0) AS total_output,
          COUNT(CASE WHEN mcp.button_status = 2 THEN 1 END) AS cycles_completed,
          COALESCE(SUM(mcp.actual_time), 0) AS active_mins,
          COALESCE(pp.total_target_per_day, 0) AS target,
          COALESCE(line_input.total_input, 0) AS total_input,
          ROUND((COALESCE(line_input.total_input, 0) / NULLIF(pp.total_target_per_day, 0)) * 100, 1) AS input_percent,
          COALESCE(line_eol.line_eol_output, 0) AS line_eol_output,
          ROUND((COALESCE(line_eol.line_eol_output, 0) / NULLIF(pp.total_target_per_day, 0)) * 100, 1) AS output_percent
        FROM mobile_sessions ms
        LEFT JOIN employees e ON e.code = ms.emp_code
        LEFT JOIN work_centres wc ON wc.id = ms.work_centre_id
        LEFT JOIN production_plan pp ON pp.work_centre_id = ms.work_centre_id AND pp.plan_date = DATE(ms.activated_at)
        ${SQL_LINE_INPUT_JOIN.replace(/%WC%/g, 'ms.work_centre_id').replace(/%DATE%/g, 'DATE(ms.activated_at)')}
        ${SQL_LINE_EOL_JOIN.replace(/%WC%/g, 'ms.work_centre_id').replace(/%DATE%/g, 'DATE(ms.activated_at)')}
        LEFT JOIN machine_centre_production mcp
          ON mcp.emp_id = ms.emp_code
          AND DATE(mcp.prod_date) BETWEEN ? AND ?
        WHERE DATE(ms.activated_at) BETWEEN ? AND ? ${wcWhere}
        GROUP BY ms.session_id, ms.emp_code, e.name, wc.name, ms.work_centre_id, ms.activated_at,
          pp.total_target_per_day, line_input.total_input, line_eol.line_eol_output
        ORDER BY total_output ASC
      `, params);
      const zeroOutput = rows.filter(r => Number(r.total_output) === 0);
      res.json({ success: true, fromDate: from, toDate: to, data: rows, zero_output_operators: zeroOutput });
    } catch (e) { next(e); }
  }

  // #2 Shift summary — shift-aware efficiency (09:05-17:35 = 510 mins, 30 min lunch excluded)
  async getShiftSummaryReport(req, res, next) {
    try {
      const { fromDate, toDate, date, work_centre_id, workCentreId } = req.query;
      const from = fromDate || date || new Date().toISOString().slice(0, 10);
      const to = toDate || from;
      const SHIFT_MINS = 510;
      const LUNCH_MINS = 30;
      const SHIFT_WORKING_MINS = SHIFT_MINS - LUNCH_MINS;
      const wcId = work_centre_id || workCentreId || null;
      let wcWhere = wcId ? 'AND mcp.work_centre_id = ?' : '';

      // Build per-date shift boundaries inline so multi-day ranges work correctly
      const params = [from, to];
      if (wcId) params.push(wcId);

      const [rows] = await db.query(`
        SELECT
          DATE(mcp.prod_date) AS date,
          mcp.work_centre_id, wc.name AS work_centre_name,
          mcp.machine_id, mc.machine_name,
          mcp.emp_id, e.name AS employee_name,
          COUNT(CASE WHEN mcp.button_status = 2 THEN 1 END) AS cycles,
          COALESCE(SUM(CASE WHEN mcp.button_status = 2 THEN mcp.output_pairs END), 0) AS total_output,
          COALESCE(SUM(CASE WHEN mcp.button_status = 2 THEN mcp.target_mins END), 0) AS total_target_mins,
          COALESCE(MAX(pp.total_target_per_day), 0) AS target,
          COALESCE(MAX(line_input.total_input), 0) AS total_input,
          ROUND((COALESCE(MAX(line_input.total_input), 0) / NULLIF(MAX(pp.total_target_per_day), 0)) * 100, 1) AS input_percent,
          COALESCE(MAX(line_eol.line_eol_output), 0) AS line_eol_output,
          ROUND((COALESCE(MAX(line_eol.line_eol_output), 0) / NULLIF(MAX(pp.total_target_per_day), 0)) * 100, 1) AS output_percent,
          COALESCE(SUM(
            CASE WHEN mcp.button_status = 2 THEN
              GREATEST(0, TIMESTAMPDIFF(MINUTE,
                GREATEST(mcp.start_time, CONCAT(DATE(mcp.prod_date), ' 09:05:00')),
                LEAST(mcp.finish_time, CONCAT(DATE(mcp.prod_date), ' 17:35:00'))))
            END
          ), 0) AS shift_actual_mins
        FROM machine_centre_production mcp
        LEFT JOIN work_centres wc ON wc.id = mcp.work_centre_id
        LEFT JOIN machine_centres mc ON mc.machine_id = mcp.machine_id
        LEFT JOIN employees e ON e.code = mcp.emp_id
        LEFT JOIN production_plan pp ON pp.work_centre_id = mcp.work_centre_id AND pp.plan_date = DATE(mcp.prod_date) AND pp.deleted_at IS NULL
        ${SQL_LINE_INPUT_JOIN.replace(/%WC%/g, 'mcp.work_centre_id').replace(/%DATE%/g, 'DATE(mcp.prod_date)')}
        ${SQL_LINE_EOL_JOIN.replace(/%WC%/g, 'mcp.work_centre_id').replace(/%DATE%/g, 'DATE(mcp.prod_date)')}
        WHERE DATE(mcp.prod_date) BETWEEN ? AND ? ${wcWhere}
        GROUP BY DATE(mcp.prod_date), mcp.work_centre_id, wc.name, mcp.machine_id, mc.machine_name, mcp.emp_id, e.name
        ORDER BY date, wc.name, mcp.machine_id
      `, params);

      const routingMinsCol = await getRoutingMinsColumnName();
      const pairsPerBin = await getPairsPerRoutingBin();

      const routingParams = [from, to];
      if (wcId) routingParams.push(wcId);
      const [routingRows] = await db.query(`
        SELECT
          pp_r.work_centre_id,
          pp_r.plan_date,
          prl.machine_centre_id AS machine_id,
          prl.${routingMinsCol} AS routing_mins_per_bin
        FROM production_plan pp_r
        JOIN production_routing_header prh
          ON prh.style_id = pp_r.style_id AND prh.deleted_at IS NULL
        JOIN production_routing_lines prl
          ON prl.routing_header_id = prh.id
        WHERE pp_r.deleted_at IS NULL
          AND pp_r.plan_date BETWEEN ? AND ?
          ${wcId ? 'AND pp_r.work_centre_id = ?' : ''}
        ORDER BY
          pp_r.work_centre_id,
          pp_r.plan_date,
          prl.machine_centre_id,
          CASE WHEN prh.created_on <= pp_r.plan_date THEN 0 ELSE 1 END ASC,
          ABS(DATEDIFF(prh.created_on, pp_r.plan_date)) ASC,
          prh.id DESC
      `, routingParams);

      const routingKey = (workCentreId, planDate, machineId) => {
        const d = planDate instanceof Date
          ? planDate.toISOString().slice(0, 10)
          : String(planDate).slice(0, 10);
        return `${workCentreId}|${d}|${machineId}`;
      };
      const routingMap = new Map();
      for (const row of routingRows) {
        const key = routingKey(row.work_centre_id, row.plan_date, row.machine_id);
        if (!routingMap.has(key)) {
          routingMap.set(key, Number(row.routing_mins_per_bin) || 0);
        }
      }

      const result = rows.map(r => {
        const actualMins = Math.max(0, Number(r.shift_actual_mins));
        const utilisation = Math.round((actualMins / SHIFT_WORKING_MINS) * 100);
        const output = Number(r.total_output) || 0;
        const boxes = output > 0 ? Math.round(output / 6) : 0;
        const routingMinsPerBox = routingMap.get(routingKey(r.work_centre_id, r.date, r.machine_id)) || 0;
        const shiftTargetOutput = routingMinsPerBox > 0
          ? Math.round((SHIFT_WORKING_MINS / routingMinsPerBox) * pairsPerBin)
          : 0;
        const shiftEff = shiftTargetOutput > 0
          ? Math.round((output / shiftTargetOutput) * 100)
          : 0;
        return {
          ...r,
          boxes,
          routing_mins_per_box: routingMinsPerBox,
          shift_target_output: shiftTargetOutput,
          shift_working_mins: SHIFT_WORKING_MINS,
          shift_efficiency_pct: shiftEff,
          shift_utilisation_pct: utilisation,
          shift_mins: SHIFT_MINS,
        };
      });
      res.json({
        success: true,
        fromDate: from,
        toDate: to,
        shift_start: '09:05',
        shift_end: '17:35',
        shift_mins: SHIFT_MINS,
        lunch_mins: LUNCH_MINS,
        shift_working_mins: SHIFT_WORKING_MINS,
        data: result,
      });
    } catch (e) { next(e); }
  }

  async getStoppageEventReport(req, res, next, kind) {
    try {
      const { fromDate, toDate, workCentreId, search, page, limit } = req.query;
      if (!fromDate || !toDate) {
        return res.status(400).json({ success: false, error: 'fromDate and toDate are required' });
      }
      const kindWhere = STOPPAGE_REPORT_WHERE[kind];
      if (!kindWhere) {
        return res.status(400).json({ success: false, error: 'Invalid stoppage report type' });
      }

      const { page: p, limit: l, offset } = paginate(page, limit);
      let where = `WHERE DATE(mcp.prod_date) BETWEEN ? AND ? ${kindWhere}`;
      const params = [fromDate, toDate];
      if (workCentreId) {
        where += ' AND mcp.work_centre_id = ?';
        params.push(workCentreId);
      }
      if (search && String(search).trim()) {
        const q = `%${String(search).trim()}%`;
        where += ` AND (
          mcp.machine_id LIKE ?
          OR COALESCE(mc.machine_name, mc.name, '') LIKE ?
          OR mcp.emp_id LIKE ?
          OR COALESCE(e.name, '') LIKE ?
          OR COALESCE(wc.name, '') LIKE ?
          OR COALESCE(mcp.stoppage_reason, '') LIKE ?
        )`;
        params.push(q, q, q, q, q, q);
      }

      const fromClause = `
        FROM machine_centre_production mcp
        LEFT JOIN work_centres wc ON wc.id = mcp.work_centre_id
        LEFT JOIN machine_centres mc ON mc.machine_id = mcp.machine_id
        LEFT JOIN employees e ON e.code = mcp.emp_id
        ${where}`;

      const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total ${fromClause}`, params);
      const [rows] = await db.query(`
        SELECT
          mcp.id,
          DATE(mcp.prod_date) AS date,
          wc.name AS line,
          mcp.machine_id,
          COALESCE(mc.machine_name, mc.name) AS machine_name,
          mcp.emp_id,
          e.name AS emp_name,
          mcp.start_time,
          mcp.finish_time,
          mcp.idle_start_time,
          mcp.idle_stop_time,
          mcp.button_status,
          mcp.stoppage_reason AS raw_detail,
          TIMESTAMPDIFF(
            MINUTE,
            COALESCE(mcp.start_time, mcp.idle_start_time),
            COALESCE(mcp.finish_time, NOW())
          ) AS duration_mins
        ${fromClause}
        ORDER BY COALESCE(mcp.idle_start_time, mcp.start_time) DESC, mcp.id DESC
        LIMIT ? OFFSET ?`, [...params, l, offset]);

      const data = rows.map((row) => {
        const inProgress = Number(row.button_status) === 1 || !row.finish_time;
        return {
          ...row,
          status: inProgress ? 'In progress' : 'Resolved',
          detail: stripStoppageDetail(row.raw_detail),
        };
      });

      res.json({
        success: true,
        data,
        pagination: { total, page: p, limit: l, totalPages: Math.max(1, Math.ceil(total / l)) },
      });
    } catch (e) {
      next(e);
    }
  }

  async getBottleneckReport(req, res, next) {
    return this.getStoppageEventReport(req, res, next, 'bottleneck');
  }

  async getBreakdownReport(req, res, next) {
    return this.getStoppageEventReport(req, res, next, 'breakdown');
  }
}

module.exports = new ApiController();
