'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const pool = require('../config/database');

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

async function main() {
    const fromDate = '2026-05-21';
    const toDate = '2026-05-21';
    const params = [fromDate, toDate];

    const [summaryCount] = await pool.query(
        `SELECT COUNT(*) AS n FROM machine_centre_summary WHERE DATE(prod_date) BETWEEN ? AND ?`,
        params
    );
    const [prodCount] = await pool.query(
        `SELECT COUNT(DISTINCT machine_id) AS n FROM machine_centre_production
         WHERE button_status = 2 AND DATE(prod_date) BETWEEN ? AND ?`,
        params
    );
    console.log('summary rows:', summaryCount[0].n, '| production machines:', prodCount[0].n);

    const [data] = await pool.query(
        `SELECT mcs.prod_date AS date, wc.name AS line, mcs.machine_id, mcs.total_output_pairs, ROUND(mcs.avg_efficiency_percent, 1) AS eff
         ${SQL_MACHINE_EFFICIENCY_FROM}
         LEFT JOIN work_centres wc ON mcs.work_centre_id = wc.id
         ORDER BY line, mcs.machine_id`,
        params
    );
    console.log('line-efficiency rows:', data.length);
    console.table(data);

    await pool.end();
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
