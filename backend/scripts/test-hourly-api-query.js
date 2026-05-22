'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const pool = require('../config/database');

const HEEL_GRIP_MACHINE_ID = '03';
const SQL_LINE_INPUT_JOIN = `
  LEFT JOIN (
    SELECT work_centre_id, DATE(prod_date) AS prod_date, SUM(output_pairs) AS total_input
    FROM machine_centre_production
    WHERE machine_id = '${HEEL_GRIP_MACHINE_ID}' AND button_status = 2
    GROUP BY work_centre_id, DATE(prod_date)
  ) line_input ON line_input.work_centre_id = %WC% AND line_input.prod_date = %DATE%`;

async function main() {
    const fromDate = '2026-05-22';
    const toDate = '2026-05-22';
    const resolvedMachineId = '07';
    const params = [fromDate, toDate, resolvedMachineId];

    let where = 'WHERE DATE(mcp.prod_date) BETWEEN ? AND ? AND mcp.button_status = 2';
    where += ' AND mcp.machine_id = ?';

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
        GROUP BY DATE(mcp.prod_date), mcp.work_centre_id, pp.total_target_per_day, line_input.total_input, c.name, s.name, col.name, l.name, g.name`;

    const [[{ total }]] = await pool.query(`SELECT COUNT(*) as total FROM (SELECT 1 ${baseQuery}) t`, params);
    const [data] = await pool.query(
        `SELECT DATE(mcp.prod_date) as date, wc.name as line, SUM(mcp.output_pairs) as total_output,
                pp.total_target_per_day, line_input.total_input
         ${baseQuery} ORDER BY date, wc.name`,
        params
    );

    console.log('total groups:', total);
    console.table(data);

    // Try May 21 filter (where most data lives)
    const params21 = ['2026-05-21', '2026-05-21', '07'];
    const [[t21]] = await pool.query(`SELECT COUNT(*) as total FROM (SELECT 1 ${baseQuery}) t`, params21);
    const [d21] = await pool.query(
        `SELECT DATE(mcp.prod_date) as date, wc.name as line, SUM(mcp.output_pairs) as total_output
         ${baseQuery} ORDER BY date`,
        params21
    );
    console.log('\nMay 21 total groups:', t21.total);
    console.table(d21);

    await pool.end();
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
