/**
 * Fix Line 3 WIP: EOL = machine 07 from machine_centre_production.
 * Yesterday (2026-05-21): 142 + 204 - 185 = 161 → carry to today.
 */
'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const pool = require('../config/database');
const wip = require('../src/services/wipStateService');

const WC = 5;
const YESTERDAY = '2026-05-21';
const TODAY = '2026-05-22';

async function main() {
    const yIn = await wip.getTodayInput(WC, YESTERDAY);
    const yOut = await wip.getEolOutput(WC, YESTERDAY);
    const yOpening = 142;
    const yClosing = Math.max(0, yOpening + yIn - yOut);

    console.log(`Yesterday ${YESTERDAY}: ${yOpening} + ${yIn} - ${yOut} = ${yClosing}`);

    await pool.query(
        `UPDATE wip_daily_state
         SET opening_wip = ?, today_input = ?, current_wip = ?, closing_wip = ?, is_closed = 1
         WHERE work_centre_id = ? AND state_date = ?`,
        [yOpening, yIn, yClosing, yClosing, WC, YESTERDAY]
    );

    const [todayRows] = await pool.query(
        `SELECT id FROM wip_daily_state WHERE work_centre_id = ? AND state_date = ?`,
        [WC, TODAY]
    );

    const tIn = await wip.getTodayInput(WC, TODAY);
    const tOut = await wip.getEolOutput(WC, TODAY);
    const tCurrent = Math.max(0, yClosing + tIn - tOut);

    if (todayRows.length === 0) {
        await pool.query(
            `INSERT INTO wip_daily_state
             (work_centre_id, state_date, opening_wip, today_input, current_wip, closing_wip, is_closed)
             VALUES (?, ?, ?, ?, ?, 0, 0)`,
            [WC, TODAY, yClosing, tIn, tCurrent]
        );
    } else {
        await pool.query(
            `UPDATE wip_daily_state
             SET opening_wip = ?, today_input = ?, current_wip = ?
             WHERE work_centre_id = ? AND state_date = ?`,
            [yClosing, tIn, tCurrent, WC, TODAY]
        );
    }

    const live = await wip.computeAndPersistWip(WC, TODAY, tOut);
    console.log('Today live:', live);

    const [verify] = await pool.query(
        `SELECT state_date, opening_wip, today_input, current_wip, closing_wip, is_closed
         FROM wip_daily_state WHERE work_centre_id = ? AND state_date >= ?
         ORDER BY state_date`,
        [WC, '2026-05-19']
    );
    console.table(verify);

    await pool.end();
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
