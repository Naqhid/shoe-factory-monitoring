'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const pool = require('../config/database');

async function main() {
    const d = '2026-05-22';
    for (const mid of ['03', '07']) {
        const [r] = await pool.query(
            `SELECT COUNT(*) AS c, COALESCE(SUM(output_pairs), 0) AS s
             FROM machine_centre_production
             WHERE DATE(prod_date) = ? AND machine_id = ? AND button_status = 2`,
            [d, mid]
        );
        console.log(`${d} machine ${mid}: rows=${r[0].c} pairs=${r[0].s}`);
    }

    const [recent] = await pool.query(
        `SELECT DATE(prod_date) AS d, machine_id, COUNT(*) AS c, SUM(output_pairs) AS s
         FROM machine_centre_production
         WHERE machine_id IN ('03', '07') AND button_status = 2
         GROUP BY DATE(prod_date), machine_id
         ORDER BY d DESC
         LIMIT 12`
    );
    console.log('\nRecent production by date/machine:');
    console.table(recent);

    const [plan] = await pool.query(
        `SELECT plan_date, work_centre_id, total_target_per_day
         FROM production_plan
         WHERE plan_date >= '2026-05-20'
         ORDER BY plan_date DESC
         LIMIT 8`
    );
    console.log('\nProduction plans:');
    console.table(plan);

    // Simulate hourly report query for machine 07
    const [hourly07] = await pool.query(
        `SELECT DATE(mcp.prod_date) AS date, wc.name AS line, SUM(mcp.output_pairs) AS total_output
         FROM machine_centre_production mcp
         LEFT JOIN work_centres wc ON mcp.work_centre_id = wc.id
         WHERE DATE(mcp.prod_date) BETWEEN ? AND ? AND mcp.button_status = 2 AND mcp.machine_id = ?
         GROUP BY DATE(mcp.prod_date), mcp.work_centre_id, wc.name`,
        [d, d, '07']
    );
    console.log('\nHourly report query (machine 07):', hourly07.length, 'rows');
    console.table(hourly07);

    const [hourly03] = await pool.query(
        `SELECT DATE(mcp.prod_date) AS date, wc.name AS line, SUM(mcp.output_pairs) AS total_output
         FROM machine_centre_production mcp
         LEFT JOIN work_centres wc ON mcp.work_centre_id = wc.id
         WHERE DATE(mcp.prod_date) BETWEEN ? AND ? AND mcp.button_status = 2 AND mcp.machine_id = ?
         GROUP BY DATE(mcp.prod_date), mcp.work_centre_id, wc.name`,
        [d, d, '03']
    );
    console.log('\nHourly report query (machine 03):', hourly03.length, 'rows');
    console.table(hourly03);

    const [raw] = await pool.query(
        `SELECT prod_date, DATE(prod_date) AS d, machine_id, output_pairs
         FROM machine_centre_production
         WHERE button_status = 2
         ORDER BY id DESC LIMIT 6`
    );
    console.log('\nLatest raw prod_date values:');
    console.table(raw);

    for (const testDate of ['2026-05-21', '2026-05-22']) {
        const [c] = await pool.query(
            `SELECT COUNT(*) AS n FROM machine_centre_production
             WHERE DATE(prod_date) BETWEEN ? AND ? AND machine_id = '07' AND button_status = 2`,
            [testDate, testDate]
        );
        console.log(`filter DATE=${testDate}:`, c[0].n);
    }

    const [plan22] = await pool.query(
        `SELECT * FROM production_plan WHERE plan_date = '2026-05-22' OR plan_date = '2026-05-21'`
    );
    console.log('\nPlans for 21/22:', plan22);

    await pool.end();
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
