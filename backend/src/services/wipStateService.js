/**
 * wipStateService.js
 *
 * MES-style WIP (Work-In-Progress) state management service.
 *
 * BUSINESS LOGIC:
 *   Current WIP = Opening WIP + Input - Output
 *
 *   - Opening WIP : Previous day's closing WIP (carried forward automatically).
 *   - Input       : Cumulative production from the line's input machine (machine_centres name contains "(Input)", e.g. 01).
 *   - Output      : End-of-line completed production (existing logic, unchanged).
 *
 * PERSISTENCE (DB only — no code fallbacks or hardcoded opening WIP):
 *   All values live in `wip_daily_state` (one row per work_centre per day).
 *   Dashboard reads/updates an existing row only.
 *   At end of day, closeDay sets closing_wip and inserts the next day's row
 *   (opening_wip = closing_wip). Seed the first row via SQL if needed.
 *
 * SAFETY:
 *   - WIP is floored at 0 (never negative).
 *   - All arithmetic is done in integer space.
 */

'use strict';

const pool = require('../../config/database');

// ── Constants ────────────────────────────────────────────────────────────────

/** Default WIP input machine when no "(Input)" machine is configured on the line. */
const WIP_INPUT_MACHINE_ID = '01';

/** @deprecated Use resolveWipInputMachineId — kept for callers that imported HEEL_GRIP_MACHINE_ID */
const HEEL_GRIP_MACHINE_ID = WIP_INPUT_MACHINE_ID;

/** Line 3 in the UI maps to work_centre_id 5; EOL output is Final Inspection (machine 07). */
const LINE_3_WORK_CENTRE_ID = 5;

/** End-of-line machine for Line 3 WIP output (matches TV dashboard). */
const EOL_MACHINE_ID = '07';

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
 * @param {string} dateKey  YYYY-MM-DD
 * @param {number} days
 * @returns {string}
 */
function addDaysToDateKey(dateKey, days) {
    const d = new Date(`${dateKey}T12:00:00`);
    d.setDate(d.getDate() + days);
    return toDateKey(d);
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

const wipInputMachineCache = new Map();

/**
 * Resolves the WIP input machine for a work centre.
 * Prefers machine_centres marked "(Input)" in name (e.g. 01 Quarter Zig Zag Stitching).
 *
 * @param {number} workCentreId
 * @returns {Promise<string>}
 */
async function resolveWipInputMachineId(workCentreId) {
    const wc = Number(workCentreId);
    if (wipInputMachineCache.has(wc)) {
        return wipInputMachineCache.get(wc);
    }

    const [rows] = await pool.query(
        `SELECT machine_id
         FROM machine_centres
         WHERE work_centre_id = ?
           AND deleted_at IS NULL
           AND COALESCE(is_active, 1) = 1
           AND (machine_name LIKE '%(Input)%' OR name LIKE '%(Input)%')
         ORDER BY machine_id
         LIMIT 1`,
        [wc]
    );

    const machineId = rows.length ? String(rows[0].machine_id) : WIP_INPUT_MACHINE_ID;
    wipInputMachineCache.set(wc, machineId);
    return machineId;
}

/**
 * Fetches today's input quantity from the line input machine for a work centre and date.
 *
 * Input = total output_pairs produced by the input machine today (feeds WIP / TV dashboard).
 *
 * @param {number} workCentreId
 * @param {string} date  YYYY-MM-DD
 * @returns {Promise<number>}
 */
async function getTodayInput(workCentreId, date) {
    const inputMachineId = await resolveWipInputMachineId(workCentreId);
    const [rows] = await pool.query(
        `SELECT COALESCE(SUM(output_pairs), 0) AS today_input
         FROM machine_centre_production
         WHERE work_centre_id = ?
           AND DATE(prod_date) = ?
           AND machine_id = ?
           AND button_status = 2`,
        [workCentreId, date, inputMachineId]
    );
    return Math.round(Number(rows[0]?.today_input || 0));
}

/**
 * Reads the WIP state row for a work centre and date. Does not insert or guess values.
 *
 * @param {number} workCentreId
 * @param {string} date  YYYY-MM-DD
 * @returns {Promise<{opening_wip: number, today_input: number, current_wip: number, closing_wip: number, is_closed: number}|null>}
 */
async function fetchWipStateRow(workCentreId, date) {
    const [rows] = await pool.query(
        `SELECT opening_wip, today_input, current_wip, closing_wip, is_closed
         FROM wip_daily_state
         WHERE work_centre_id = ? AND state_date = ?`,
        [workCentreId, date]
    );

    return rows.length > 0 ? rows[0] : null;
}

/**
 * After closeDay, inserts the next calendar day's row when missing.
 * opening_wip / current_wip come from today's closing_wip only.
 *
 * @param {number} workCentreId
 * @param {string} closedDateKey  YYYY-MM-DD
 * @param {number} closingWip
 */
async function openNextDayRowFromClose(workCentreId, closedDateKey, closingWip) {
    const nextDate = addDaysToDateKey(closedDateKey, 1);
    const [existing] = await pool.query(
        `SELECT id FROM wip_daily_state
         WHERE work_centre_id = ? AND state_date = ?`,
        [workCentreId, nextDate]
    );

    if (existing.length > 0) {
        return;
    }

    const opening = clampWip(closingWip);
    await pool.query(
        `INSERT INTO wip_daily_state
             (work_centre_id, state_date, opening_wip, today_input, current_wip, closing_wip, is_closed)
         VALUES (?, ?, ?, 0, ?, 0, 0)`,
        [workCentreId, nextDate, opening, opening]
    );
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
    const state = await fetchWipStateRow(workCentreId, date);
    const todayInput = await getTodayInput(workCentreId, date);
    const roundedOutput = Math.round(todayOutput);

    if (!state) {
        return {
            openingWip: 0,
            todayInput,
            currentWip: 0,
            closingWip: 0,
        };
    }

    const openingWip = Math.round(Number(state.opening_wip || 0));
    const currentWip = clampWip(openingWip + todayInput - roundedOutput);

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

    await openNextDayRowFromClose(workCentreId, date, closingWip);

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
    const state = await fetchWipStateRow(workCentreId, date);
    if (!state) {
        return {
            openingWip: 0,
            todayInput: 0,
            currentWip: 0,
            closingWip: 0,
            isClosed: false,
        };
    }

    return {
        openingWip: Math.round(state.opening_wip),
        todayInput: Math.round(state.today_input),
        currentWip: Math.round(state.current_wip),
        closingWip: Math.round(state.closing_wip),
        isClosed: Boolean(state.is_closed),
    };
}

module.exports = {
    WIP_INPUT_MACHINE_ID,
    HEEL_GRIP_MACHINE_ID,
    LINE_3_WORK_CENTRE_ID,
    EOL_MACHINE_ID,
    resolveWipInputMachineId,
    getTodayInput,
    getEolOutputFromProduction,
    getEolOutput,
    resolveCarryForwardOpening,
    fetchWipStateRow,
    openNextDayRowFromClose,
    computeAndPersistWip,
    closeDay,
    getWipState,
};
