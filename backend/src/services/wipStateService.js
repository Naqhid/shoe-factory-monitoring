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

/** Line 3 in the UI maps to work_centre_id 5; EOL output is Final Inspection (machine 07). */
const LINE_3_WORK_CENTRE_ID = 5;

/** End-of-line machine for Line 3 WIP output (matches TV dashboard). */
const EOL_MACHINE_ID = '07';

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

/**
 * Normalises a DB DATE value to YYYY-MM-DD.
 * @param {string|Date} value
 * @returns {string}
 */
function toDateKey(value) {
    if (!value) return '';
    if (value instanceof Date) {
        return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
    }
    return String(value).slice(0, 10);
}

/**
 * EOL output from live production entries (same source as heel-grip input).
 *
 * @param {number} workCentreId
 * @param {string} date  YYYY-MM-DD
 * @param {string|null} machineId  When set, only that machine (Line 3 EOL = 07)
 * @returns {Promise<number>}
 */
async function getEolOutputFromProduction(workCentreId, date, machineId = null) {
    const params = [workCentreId, date];
    let machineFilter = '';
    if (machineId) {
        machineFilter = ' AND machine_id = ?';
        params.push(machineId);
    }

    const [rows] = await pool.query(
        `SELECT COALESCE(SUM(output_pairs), 0) AS total_output
         FROM machine_centre_production
         WHERE work_centre_id = ?
           AND DATE(prod_date) = ?
           AND button_status = 2${machineFilter}`,
        params
    );
    return Math.round(Number(rows[0]?.total_output || 0));
}

/**
 * End-of-line output for WIP — must match tvDashboardController / line performance.
 * Line 3 (wc 5): EOL Final Inspection machine 07 only.
 * Uses machine_centre_production first (summary is often empty); falls back to summary.
 *
 * @param {number} workCentreId
 * @param {string} date  YYYY-MM-DD
 * @returns {Promise<number>}
 */
async function getEolOutput(workCentreId, date) {
    if (Number(workCentreId) === LINE_3_WORK_CENTRE_ID) {
        const fromProduction = await getEolOutputFromProduction(workCentreId, date, EOL_MACHINE_ID);
        if (fromProduction > 0) {
            return fromProduction;
        }

        const [rows] = await pool.query(
            `SELECT COALESCE(total_output_pairs, 0) AS total_output
             FROM machine_centre_summary
             WHERE DATE(prod_date) = ? AND work_centre_id = ? AND machine_id = ?`,
            [date, workCentreId, EOL_MACHINE_ID]
        );
        return Math.round(Number(rows[0]?.total_output || 0));
    }

    const fromProduction = await getEolOutputFromProduction(workCentreId, date);
    if (fromProduction > 0) {
        return fromProduction;
    }

    const [rows] = await pool.query(
        `SELECT COALESCE(SUM(total_output_pairs), 0) AS total_output
         FROM machine_centre_summary
         WHERE DATE(prod_date) = ? AND work_centre_id = ?`,
        [date, workCentreId]
    );
    return Math.round(Number(rows[0]?.total_output || 0));
}

/**
 * Opening WIP to carry into `beforeDate` from the most recent prior wip_daily_state row.
 *
 * @param {number} workCentreId
 * @param {string} beforeDate  YYYY-MM-DD
 * @returns {Promise<number|null>}  null when there is no prior row
 */
async function resolveCarryForwardOpening(workCentreId, beforeDate) {
    const [previous] = await pool.query(
        `SELECT state_date, opening_wip, today_input, current_wip, closing_wip, is_closed
         FROM wip_daily_state
         WHERE work_centre_id = ?
           AND state_date < ?
         ORDER BY state_date DESC
         LIMIT 1`,
        [workCentreId, beforeDate]
    );

    if (previous.length === 0) {
        return null;
    }

    const prev = previous[0];

    if (!prev.is_closed) {
        return clampWip(Number(prev.current_wip ?? prev.closing_wip ?? 0));
    }

    const closing = clampWip(Number(prev.closing_wip || 0));
    if (closing > 0) {
        return closing;
    }

    // Day marked closed but closing_wip was never set — recompute from opening + live input/EOL (machine 07)
    const prevDate = toDateKey(prev.state_date);
    const prevOpening = Math.round(Number(prev.opening_wip || 0));
    const prevInput = await getTodayInput(workCentreId, prevDate);
    const prevOutput = await getEolOutput(workCentreId, prevDate);
    return clampWip(prevOpening + prevInput - prevOutput);
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
 *   2. If a previous day's row exists → opening_wip from carry-forward (live current_wip if not closed).
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

    // 2. No row for today — carry forward from previous day or bootstrap
    const carryForward = await resolveCarryForwardOpening(workCentreId, date);

    let openingWip;

    if (carryForward !== null) {
        openingWip = carryForward;
    } else {
        // Bootstrap: first time this feature runs.
        const todayInput = await getTodayInput(workCentreId, date);
        const todayOutput = await getEolOutput(workCentreId, date);
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

    let openingWip = Math.round(Number(state.opening_wip || 0));

    // Repair rows created with opening 0 when yesterday still had live WIP (or a bad close)
    if (!state.is_closed) {
        const carryForward = await resolveCarryForwardOpening(workCentreId, date);
        if (carryForward !== null && carryForward > openingWip) {
            openingWip = carryForward;
            await pool.query(
                `UPDATE wip_daily_state
                 SET opening_wip = ?
                 WHERE work_centre_id = ? AND state_date = ?`,
                [openingWip, workCentreId, date]
            );
        }
    }

    // Fetch live input from Heel Grip Machine
    const todayInput = await getTodayInput(workCentreId, date);

    // MES WIP formula — floor at 0 to prevent negative WIP
    const currentWip = clampWip(openingWip + todayInput - Math.round(todayOutput));

    // Persist the updated live state
    await pool.query(
        `UPDATE wip_daily_state
         SET today_input = ?,
             current_wip = ?
         WHERE work_centre_id = ? AND state_date = ?`,
        [todayInput, currentWip, workCentreId, date]
    );

    return {
        openingWip,
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
    LINE_3_WORK_CENTRE_ID,
    EOL_MACHINE_ID,
    INITIAL_OPENING_WIP,
    getTodayInput,
    getEolOutputFromProduction,
    getEolOutput,
    resolveCarryForwardOpening,
    getOrInitWipState,
    computeAndPersistWip,
    closeDay,
    getWipState,
};
