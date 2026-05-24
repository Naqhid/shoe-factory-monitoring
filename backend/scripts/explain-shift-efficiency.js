const db = require('../config/database');

const SHIFT_WORKING_MINS = 480;
const from = process.argv[2] || '2026-05-21';
const to = process.argv[3] || from;

(async () => {
  const [rows] = await db.query(
    `SELECT
      DATE(mcp.prod_date) AS date,
      mcp.work_centre_id, wc.name AS work_centre_name,
      mcp.machine_id, mc.machine_name,
      mcp.emp_id, e.name AS employee_name,
      COALESCE(SUM(CASE WHEN mcp.button_status = 2 THEN mcp.output_pairs END), 0) AS total_output
    FROM machine_centre_production mcp
    LEFT JOIN work_centres wc ON wc.id = mcp.work_centre_id
    LEFT JOIN machine_centres mc ON mc.machine_id = mcp.machine_id
    LEFT JOIN employees e ON e.code = mcp.emp_id
    WHERE DATE(mcp.prod_date) BETWEEN ? AND ?
    GROUP BY DATE(mcp.prod_date), mcp.work_centre_id, wc.name, mcp.machine_id, mc.machine_name, mcp.emp_id, e.name
    ORDER BY wc.name, mcp.machine_id, mcp.emp_id`,
    [from, to]
  );

  const [routingRows] = await db.query(
    `SELECT
      pp_r.work_centre_id, pp_r.plan_date, prl.machine_centre_id AS machine_id, prl.mins_6_prs_box
    FROM production_plan pp_r
    JOIN production_routing_header prh ON prh.style_id = pp_r.style_id AND prh.deleted_at IS NULL
    JOIN production_routing_lines prl ON prl.routing_header_id = prh.id
    WHERE pp_r.deleted_at IS NULL AND pp_r.plan_date BETWEEN ? AND ?
    ORDER BY
      pp_r.work_centre_id, pp_r.plan_date, prl.machine_centre_id,
      CASE WHEN prh.created_on <= pp_r.plan_date THEN 0 ELSE 1 END,
      ABS(DATEDIFF(prh.created_on, pp_r.plan_date)), prh.id DESC`,
    [from, to]
  );

  const routingMap = new Map();
  for (const r of routingRows) {
    const d = r.plan_date instanceof Date ? r.plan_date.toISOString().slice(0, 10) : String(r.plan_date).slice(0, 10);
    const key = `${r.work_centre_id}|${d}|${r.machine_id}`;
    if (!routingMap.has(key)) routingMap.set(key, Number(r.mins_6_prs_box) || 0);
  }

  const fmtDate = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));

  console.log(`Shift efficiency for ${from} (working mins = ${SHIFT_WORKING_MINS})\n`);
  for (const r of rows) {
    const d = fmtDate(r.date);
    const mins = routingMap.get(`${r.work_centre_id}|${d}|${r.machine_id}`) || 0;
    const output = Number(r.total_output);
    const shiftTarget = mins > 0 ? Math.round((SHIFT_WORKING_MINS / mins) * 6) : 0;
    const eff = shiftTarget > 0 ? Math.round((output / shiftTarget) * 100) : 0;
    if (!String(r.work_centre_name || '').includes('Line 1 A') && !String(r.work_centre_name || '').includes('Azhar')) continue;
    console.log(
      `${r.machine_id} | ${r.emp_id} | out=${output} | routing_mins/6prs=${mins} | shift_target=${shiftTarget} | eff=${eff}%`
    );
  }

  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
