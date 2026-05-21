/**
 * One-off: close yesterday's WIP at 142 and carry forward to today.
 * Line 3 = work_centre_id 5
 */
'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const pool = require('../config/database');

const WORK_CENTRE_ID = 5;
const YESTERDAY = '2026-05-20';
const TODAY = '2026-05-21';
const CLOSING_WIP = 142;
const YESTERDAY_INPUT = 162;

async function main() {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [yesterdayRows] = await conn.query(
            `SELECT id, opening_wip, today_input, current_wip, closing_wip, is_closed
             FROM wip_daily_state
             WHERE work_centre_id = ? AND state_date = ?`,
            [WORK_CENTRE_ID, YESTERDAY]
        );

        if (yesterdayRows.length === 0) {
            await conn.query(
                `INSERT INTO wip_daily_state
                 (work_centre_id, state_date, opening_wip, today_input, current_wip, closing_wip, is_closed)
                 VALUES (?, ?, 130, ?, ?, ?, 1)`,
                [WORK_CENTRE_ID, YESTERDAY, YESTERDAY_INPUT, CLOSING_WIP, CLOSING_WIP]
            );
            console.log(`Inserted closed row for ${YESTERDAY}`);
        } else {
            await conn.query(
                `UPDATE wip_daily_state
                 SET today_input = ?,
                     current_wip = ?,
                     closing_wip = ?,
                     is_closed = 1
                 WHERE work_centre_id = ? AND state_date = ?`,
                [YESTERDAY_INPUT, CLOSING_WIP, CLOSING_WIP, WORK_CENTRE_ID, YESTERDAY]
            );
            console.log(`Closed ${YESTERDAY}:`, yesterdayRows[0], '→ closing_wip', CLOSING_WIP);
        }

        const [todayRows] = await conn.query(
            `SELECT id, opening_wip, current_wip FROM wip_daily_state
             WHERE work_centre_id = ? AND state_date = ?`,
            [WORK_CENTRE_ID, TODAY]
        );

        if (todayRows.length === 0) {
            await conn.query(
                `INSERT INTO wip_daily_state
                 (work_centre_id, state_date, opening_wip, today_input, current_wip, closing_wip, is_closed)
                 VALUES (?, ?, ?, 0, ?, 0, 0)`,
                [WORK_CENTRE_ID, TODAY, CLOSING_WIP, CLOSING_WIP]
            );
            console.log(`Created ${TODAY} with opening_wip=${CLOSING_WIP}`);
        } else {
            const [outRows] = await conn.query(
                `SELECT COALESCE(SUM(total_output_pairs), 0) AS total_output
                 FROM machine_centre_summary
                 WHERE work_centre_id = ? AND DATE(prod_date) = ?`,
                [WORK_CENTRE_ID, TODAY]
            );
            const [inRows] = await conn.query(
                `SELECT COALESCE(SUM(output_pairs), 0) AS inp
                 FROM machine_centre_production
                 WHERE work_centre_id = ? AND DATE(prod_date) = ? AND machine_id = '03' AND button_status = 2`,
                [WORK_CENTRE_ID, TODAY]
            );
            const todayOut = Math.round(Number(outRows[0]?.total_output || 0));
            const todayIn = Math.round(Number(inRows[0]?.inp || 0));
            const todayWip = Math.max(0, CLOSING_WIP + todayIn - todayOut);
            await conn.query(
                `UPDATE wip_daily_state
                 SET opening_wip = ?, today_input = ?, current_wip = ?
                 WHERE work_centre_id = ? AND state_date = ?`,
                [CLOSING_WIP, todayIn, todayWip, WORK_CENTRE_ID, TODAY]
            );
            console.log(`Updated ${TODAY}: opening=${CLOSING_WIP}, input=${todayIn}, output=${todayOut}, current_wip=${todayWip}`);
        }

        await conn.commit();

        const [verify] = await pool.query(
            `SELECT state_date, opening_wip, today_input, current_wip, closing_wip, is_closed
             FROM wip_daily_state
             WHERE work_centre_id = ? AND state_date IN (?, ?)
             ORDER BY state_date`,
            [WORK_CENTRE_ID, YESTERDAY, TODAY]
        );
        console.log('\nVerified wip_daily_state:');
        console.table(verify);
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
        await pool.end();
    }
}

main().catch((err) => {
    console.error('Failed:', err.message);
    process.exit(1);
});
