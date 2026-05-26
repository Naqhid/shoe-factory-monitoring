'use strict';
const pool = require('../config/database');
const d = process.argv[2] || '2026-05-25';

(async () => {
  const [ms] = await pool.query(
    'SELECT COUNT(*) AS c FROM mobile_sessions WHERE DATE(activated_at) = ?',
    [d]
  );
  const [mcp] = await pool.query(
    `SELECT COUNT(*) AS c, COALESCE(SUM(output_pairs),0) AS o
     FROM machine_centre_production WHERE DATE(prod_date) = ? AND button_status = 2`,
    [d]
  );
  const [mcs] = await pool.query(
    'SELECT COUNT(*) AS c FROM machine_centre_summary WHERE DATE(prod_date) = ?',
    [d]
  );
  const [activatedRange] = await pool.query(
    `SELECT MIN(activated_at) AS min_a, MAX(activated_at) AS max_a,
            COUNT(*) AS total
     FROM mobile_sessions`
  );
  const [onDateByProd] = await pool.query(
    `SELECT COUNT(DISTINCT ms.session_id) AS sessions
     FROM mobile_sessions ms
     INNER JOIN machine_centre_production mcp
       ON mcp.machine_id = ms.machine_id
      AND mcp.work_centre_id = ms.work_centre_id
      AND DATE(mcp.prod_date) = ?
     WHERE mcp.button_status = 2`,
    [d]
  );
  const [reportSim] = await pool.query(
    `SELECT COUNT(*) AS c FROM (
      SELECT 1
      FROM machine_centre_production mcp
      JOIN employees e ON e.code = mcp.emp_id
      WHERE DATE(mcp.prod_date) BETWEEN ? AND ? AND mcp.button_status = 2
      GROUP BY DATE(mcp.prod_date), mcp.work_centre_id, mcp.emp_id, mcp.machine_id
    ) t`,
    [d, d]
  );
  const [byProdDate] = await pool.query(
    `SELECT COUNT(*) AS c FROM (
      SELECT 1
      FROM mobile_sessions ms
      JOIN employees e ON ms.emp_id = e.id
      JOIN machine_centre_production mcp ON mcp.machine_id = ms.machine_id
        AND mcp.work_centre_id = ms.work_centre_id
        AND DATE(mcp.prod_date) = ?
      WHERE DATE(mcp.prod_date) = ?
      GROUP BY ms.work_centre_id, ms.emp_id, ms.machine_id
    ) t`,
    [d, d]
  );

  const [empJoin] = await pool.query(
    `SELECT COUNT(DISTINCT mcp.emp_id) AS prod_emps,
            COUNT(DISTINCT e.id) AS matched
     FROM machine_centre_production mcp
     LEFT JOIN employees e ON e.code = mcp.emp_id
     WHERE DATE(mcp.prod_date) = ? AND mcp.button_status = 2`,
    [d]
  );

  console.log(JSON.stringify({
    emp_join: empJoin[0],
    date: d,
    mobile_sessions_on_activated_date: ms[0].c,
    production_rows: mcp[0],
    summary_rows: mcs[0].c,
    sessions_with_prod_on_date: onDateByProd[0].sessions,
    report_query_sim: reportSim[0].c,
    alt_by_prod_date: byProdDate[0].c,
    activated_at_range: activatedRange[0],
  }, null, 2));
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
