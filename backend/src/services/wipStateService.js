/**
 * wipStateService.js
 *
 * MES-style WIP (Work-In-Progress) state management service.
 *
 * BUSINESS LOGIC:
 *   Current WIP = Opening WIP + Input - Output
 *
 *   - Opening WIP : Previous day's closing WIP (carried forward automatically).
 *   - Input       : Cumulative production from Heel Grip Machine (machine_id = '03') today.
 *   - Output      : End-of-line completed production (existing logic, unchanged).
 *
 * PERSISTENCE:
 *   State is stored in the `wip_daily_state` table (one row per work_centre per day).
 *   At end of day, closing_wip = current_wip.
 *   Next morning, opening_wip = previous day's closing_wip.
 *
 * SAFETY:
 *   - WIP is floored at 0 (never negative).
 *   - All arithmetic is done in integer space.
 */

'use strict';

const pool = require('../../config/database');

// ── Constants ────────────────────────────────────────────────────────────────

/** Machine ID for the Heel Grip Machine — the sole Input source for WIP. */
const HEEL_GRIP_MACHINE_ID = '03';

/**
 * Initial opening WIP for Line 3 on the first day this feature is deployed.
 * After the first day, opening WIP is always derived from the previous day's
 * closing WIP automatically.
 */
const INITIAL_OPENING_WIP = 130;

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns today's date string in YYYY-MM-DD format (local time).
 * @returns {string}
 */
function todayString() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Clamps a value to be >= 0 (WIP can never be negative in a real factory).
 * @param {number} value
 * @returns {number}
 */
function clampWip(value) {
    return Math.max(0, Math.round(value));
}

// ── Core Service Functions ────────────────────────────────────────────────────

/**
 * Fetches today's input quantity from the Heel Grip Machine (machine_id = '03')
 * for a given work centre and date.
 *
 * Input = total output_pairs produced by the Heel Grip Machine today.
 * This is the raw material entering the production line.
 *
 * @param {number} workCentreId
 * @param {string} date  YYYY-MM-DD
 * @returns {Promise<number>}
 */
async function getTodayInput(workCentreId, date) {
    const [rows] = await pool.query(
        `SELECT COALESCE(SUM(output_pairs), 0) AS today_input
         FROM machine_centre_production
         WHERE work_centre_id = ?
           AND DATE(prod_date) = ?
           AND machine_id = ?
           AND button_status = 2`,
        [workCentreId, date, HEEL_GRIP_MACHINE_ID]
    );
    return Math.round(Number(rows[0]?.today_input || 0));
}

/**
 * Retrieves (or initialises) the WIP state row for a given work centre and date.
 *
 * Initialisation logic:
 *   1. If a row already exists for today → return it as-is.
 *   2. If a previous day's row exists → opening_wip = that day's closing_wip.
 *   3. Bootstrap (first-ever run): seed current_wip = INITIAL_OPENING_WIP.
 *      opening_wip is back-calculated so the formula resolves correctly even
 *      when today already has production recorded:
 *        opening_wip = INITIAL_OPENING_WIP - todayInput + todayOutput
 *      This ensures: opening_wip + todayInput - todayOutput = INITIAL_OPENING_WIP
 *
 * @param {number} workCentreId
 * @param {string} date  YYYY-MM-DD
 * @returns {Promise<{opening_wip: number, today_input: number, current_wip: number, closing_wip: number, is_closed: number}>}
 */
async function getOrInitWipState(workCentreId, date) {
    // 1. Try to fetch existing row for today
    const [existing] = await pool.query(
        `SELECT opening_wip, today_input, current_wip, closing_wip, is_closed
         FROM wip_daily_state
         WHERE work_centre_id = ? AND state_date = ?`,
        [workCentreId, date]
    );

    if (existing.length > 0) {
        return existing[0];
    }

    // 2. No row for today — check for a previous day's closing WIP
    const [previous] = await pool.query(
        `SELECT closing_wip, current_wip, is_closed
         FROM wip_daily_state
         WHERE work_centre_id = ?
           AND state_date < ?
         ORDER BY state_date DESC
         LIMIT 1`,
        [workCentreId, date]
    );

    let openingWip;

    if (previous.length > 0) {
        // Carry-forward: prefer formal close; if day was not closed, use live current_wip
        const prev = previous[0];
        openingWip = prev.is_closed
            ? Math.round(Number(prev.closing_wip || 0))
            : Math.round(Number(prev.current_wip ?? prev.closing_wip ?? 0));
    } else {
        // Bootstrap: first time this feature runs.
        // We want current_wip to equal INITIAL_OPENING_WIP regardless of how
        // much production has already been recorded today.
        // Back-calculate opening_wip so the formula holds:
        //   opening_wip + todayInput - todayOutput = INITIAL_OPENING_WIP
        //   opening_wip = INITIAL_OPENING_WIP - todayInput + todayOutput
        const todayInput = await getTodayInput(workCentreId, date);

        // Fetch today's end-of-line output using the same logic as the controller
        const [outputRows] = await pool.query(
            `SELECT COALESCE(SUM(total_output_pairs), 0) AS total_output
             FROM machine_centre_summary
             WHERE DATE(prod_date) = ? AND work_centre_id = ?`,
            [date, workCentreId]
        );
        const todayOutput = Math.round(Number(outputRows[0]?.total_output || 0));

        openingWip = Math.max(0, INITIAL_OPENING_WIP - todayInput + todayOutput);
    }

    // 3. Insert the new day's row
    await pool.query(
        `INSERT INTO wip_daily_state
             (work_centre_id, state_date, opening_wip, today_input, current_wip, closing_wip, is_closed)
         VALUES (?, ?, ?, 0, ?, 0, 0)
         ON DUPLICATE KEY UPDATE
             opening_wip = VALUES(opening_wip),
             current_wip = VALUES(current_wip)`,
        [workCentreId, date, openingWip, openingWip]
    );

    return {
        opening_wip: openingWip,
        today_input: 0,
        current_wip: openingWip,
        closing_wip: 0,
        is_closed: 0,
    };
}

/**
 * Computes and persists the live WIP state for a work centre on a given date.
 *
 * Formula: Current WIP = Opening WIP + Input - Output
 *
 * @param {number} workCentreId
 * @param {string} date         YYYY-MM-DD
 * @param {number} todayOutput  End-of-line output (from existing dashboard logic)
 * @returns {Promise<{openingWip: number, todayInput: number, currentWip: number, closingWip: number}>}
 */
async function computeAndPersistWip(workCentreId, date, todayOutput) {
    // Ensure the state row exists (or is initialised)
    const state = await getOrInitWipState(workCentreId, date);

    // Fetch live input from Heel Grip Machine
    const todayInput = await getTodayInput(workCentreId, date);

    // MES WIP formula — floor at 0 to prevent negative WIP
    const currentWip = clampWip(state.opening_wip + todayInput - Math.round(todayOutput));

    // Persist the updated live state
    await pool.query(
        `UPDATE wip_daily_state
         SET today_input = ?,
             current_wip = ?
         WHERE work_centre_id = ? AND state_date = ?`,
        [todayInput, currentWip, workCentreId, date]
    );

    return {
        openingWip: Math.round(state.opening_wip),
        todayInput,
        currentWip,
        closingWip: Math.round(state.closing_wip),
    };
}

/**
 * Closes the day for a work centre — sets closing_wip = current_wip and marks is_closed = 1.
 * Should be called at end-of-shift (e.g. via a scheduled job or manual trigger).
 *
 * @param {number} workCentreId
 * @param {string} date  YYYY-MM-DD
 * @returns {Promise<{closingWip: number}>}
 */
async function closeDay(workCentreId, date) {
    const [rows] = await pool.query(
        `SELECT current_wip FROM wip_daily_state
         WHERE work_centre_id = ? AND state_date = ?`,
        [workCentreId, date]
    );

    if (rows.length === 0) {
        throw new Error(`No WIP state found for work_centre_id=${workCentreId} on ${date}`);
    }

    const closingWip = clampWip(rows[0].current_wip);

    await pool.query(
        `UPDATE wip_daily_state
         SET closing_wip = ?, is_closed = 1
         WHERE work_centre_id = ? AND state_date = ?`,
        [closingWip, workCentreId, date]
    );

    return { closingWip };
}

/**
 * Returns the WIP state for a work centre on a given date without modifying it.
 * Useful for read-only display.
 *
 * @param {number} workCentreId
 * @param {string} date  YYYY-MM-DD
 * @returns {Promise<{openingWip: number, todayInput: number, currentWip: number, closingWip: number, isClosed: boolean}>}
 */
async function getWipState(workCentreId, date) {
    const state = await getOrInitWipState(workCentreId, date);
    return {
        openingWip: Math.round(state.opening_wip),
        todayInput: Math.round(state.today_input),
        currentWip: Math.round(state.current_wip),
        closingWip: Math.round(state.closing_wip),
        isClosed: Boolean(state.is_closed),
    };
}

module.exports = {
    HEEL_GRIP_MACHINE_ID,
    INITIAL_OPENING_WIP,
    getTodayInput,
    getOrInitWipState,
    computeAndPersistWip,
    closeDay,
    getWipState,
};
