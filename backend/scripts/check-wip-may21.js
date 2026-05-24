'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const pool = require('../config/database');
const wip = require('../src/services/wipStateService');

const WC = 5;

async function main() {
    for (const d of ['2026-05-20', '2026-05-21', '2026-05-22']) {
        const eol = await wip.getEolOutput(WC, d);
        const inp = await wip.getTodayInput(WC, d);
        console.log(d, { heelGripInput: inp, eolOutput: eol, wipIfOpening142: 142 + inp - eol });
    }

    const [rows] = await pool.query(
        `SELECT state_date, opening_wip, today_input, current_wip, closing_wip, is_closed
         FROM wip_daily_state WHERE work_centre_id = ? ORDER BY state_date DESC LIMIT 5`,
        [WC]
    );
    console.log('\nwip_daily_state:');
    console.table(rows);

    const [m07] = await pool.query(
        `SELECT DATE(prod_date) AS d, machine_id, total_output_pairs
         FROM machine_centre_summary
         WHERE work_centre_id = ? AND DATE(prod_date) >= '2026-05-20'
         ORDER BY prod_date, machine_id`,
        [WC]
    );
    console.log('\nmachine_centre_summary (wc5, since May 20):');
    console.table(m07);

    const [allSummary] = await pool.query(
        `SELECT DATE(prod_date) AS d, work_centre_id, machine_id, total_output_pairs
         FROM machine_centre_summary
         ORDER BY prod_date DESC LIMIT 15`
    );
    console.log('\nLatest machine_centre_summary (any line):');
    console.table(allSummary);

    const [prod07] = await pool.query(
        `SELECT DATE(prod_date) AS d, SUM(output_pairs) AS eol_from_production
         FROM machine_centre_production
         WHERE work_centre_id = ? AND machine_id = '07' AND button_status = 2
         GROUP BY DATE(prod_date)
         ORDER BY d DESC LIMIT 10`,
        [WC]
    );
    console.log('\nEOL from machine_centre_production (machine 07):');
    console.table(prod07);

    const [heelBoth] = await pool.query(
        `SELECT DATE(prod_date) AS d, SUM(output_pairs) AS heel_input
         FROM machine_centre_production
         WHERE work_centre_id = ? AND machine_id = '03' AND button_status = 2
           AND DATE(prod_date) IN ('2026-05-19', '2026-05-20', '2026-05-21', '2026-05-22')
         GROUP BY DATE(prod_date)
         ORDER BY d`,
        [WC]
    );
    console.log('\nHeel grip input by calendar date:');
    console.table(heelBoth);

    for (const d of ['2026-05-20', '2026-05-21']) {
        const [eol] = await pool.query(
            `SELECT COALESCE(SUM(output_pairs), 0) AS s
             FROM machine_centre_production
             WHERE work_centre_id = ? AND DATE(prod_date) = ? AND machine_id = '07' AND button_status = 2`,
            [WC, d]
        );
        const [heel] = await pool.query(
            `SELECT COALESCE(SUM(output_pairs), 0) AS s
             FROM machine_centre_production
             WHERE work_centre_id = ? AND DATE(prod_date) = ? AND machine_id = '03' AND button_status = 2`,
            [WC, d]
        );
        console.log(`production ${d}: heel=${heel[0].s}, eol07=${eol[0].s}`);
    }

    const [prodAll] = await pool.query(
        `SELECT DATE(prod_date) AS d, SUM(output_pairs) AS total_output
         FROM machine_centre_production
         WHERE work_centre_id = ? AND button_status = 2
         GROUP BY DATE(prod_date)
         ORDER BY d DESC LIMIT 10`,
        [WC]
    );
    console.log('\nAll machines from machine_centre_production:');
    console.table(prodAll);

    await pool.end();
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
