require('dotenv').config();
const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST, port: process.env.DB_PORT,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  const today = new Date().toISOString().split('T')[0];

  console.log('\n--- Bottleneck query result for wc 5 ---');
  const [bn] = await conn.execute(`
    SELECT 
      mc.name as machine_centre_name,
      wc.name as work_centre_name,
      ROUND(
        CASE
          WHEN COALESCE(SUM(p.output_pairs), 0) = 0 THEN 0
          WHEN SUM(TIMESTAMPDIFF(MINUTE, p.start_time, p.finish_time)) > 0
            THEN (SUM(p.target_mins) / SUM(TIMESTAMPDIFF(MINUTE, p.start_time, p.finish_time))) * 100
          ELSE 0
        END, 1
      ) as efficiency,
      COALESCE(SUM(p.output_pairs), 0) as output
    FROM machine_centres mc
    JOIN work_centres wc ON mc.work_centre_id = wc.id
    JOIN machine_centre_production p
      ON p.machine_id = mc.machine_id
      AND p.work_centre_id = mc.work_centre_id
      AND DATE(p.prod_date) = DATE(?)
      AND p.button_status = 2
      AND TIMESTAMPDIFF(MINUTE, p.start_time, p.finish_time) <= 510
    LEFT JOIN production_plan pp ON mc.work_centre_id = pp.work_centre_id AND DATE(pp.plan_date) = DATE(?)
    WHERE mc.work_centre_id = ?
      AND mc.deleted_at IS NULL
      AND COALESCE(mc.is_active, 1) = 1
      AND EXISTS (
        SELECT 1 FROM mobile_sessions ms
        WHERE ms.machine_id = mc.machine_id AND ms.status = 'active' AND DATE(ms.activated_at) = DATE(?)
      )
    GROUP BY mc.id, mc.name, wc.name, pp.total_target_per_day
    HAVING SUM(p.output_pairs) = 0
      OR (SUM(TIMESTAMPDIFF(MINUTE, p.start_time, p.finish_time)) > 0
          AND (SUM(p.target_mins) / SUM(TIMESTAMPDIFF(MINUTE, p.start_time, p.finish_time))) * 100 < 70)
    ORDER BY efficiency ASC
    LIMIT 3
  `, [today, today, 5, today]);
  console.table(bn);

  console.log('\n--- All machine_centres in wc 5 ---');
  const [mc] = await conn.execute(
    `SELECT machine_id, name, work_centre_id, is_active, deleted_at FROM machine_centres WHERE work_centre_id = 5`
  );
  console.table(mc);

  await conn.end();
})();
