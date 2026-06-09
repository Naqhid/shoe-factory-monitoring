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
 * MANUAL MORNING SETUP:
 *   Saving opening WIP via Manual Entry sets manual_wip_override (audit flag).
 *   While the day is open, current_wip is always recalculated from live input/output.
 *   Only closed days freeze current/closing WIP snapshots.
 *
 * SAFETY:
 *   - WIP is floored at 0 (never negative).
 *   - All arithmetic is done in integer space.
 */

'use strict';

const pool = require('../../config/database');
const lineMachineResolver = require('./lineMachineResolver');

// ── Constants ────────────────────────────────────────────────────────────────

/** Default WIP input machine when no DB / name match is configured on the line. */
const WIP_INPUT_MACHINE_ID = lineMachineResolver.DEFAULT_INPUT_MACHINE_ID;

/** @deprecated Use resolveWipInputMachineId — kept for callers that imported HEEL_GRIP_MACHINE_ID */
const HEEL_GRIP_MACHINE_ID = WIP_INPUT_MACHINE_ID;

/** Line 3 in the UI maps to work_centre_id 5; EOL output is Final Inspection (machine 07). */
const LINE_3_WORK_CENTRE_ID = 5;

/** Default end-of-line machine when not configured per work centre. */
const EOL_MACHINE_ID = lineMachineResolver.DEFAULT_EOL_MACHINE_ID;

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
 * End-of-line machine for WIP output — work_centres.eol_machine_id, then name/heuristic fallbacks.
 *
 * @param {number} workCentreId
 * @returns {Promise<string>}
 */
async function resolveEolMachineId(workCentreId) {
    return lineMachineResolver.resolveEolMachineId(workCentreId);
}

/**
 * End-of-line output for WIP — single final machine only (matches dashboard Output).
 *
 * @param {number} workCentreId
 * @param {string} date  YYYY-MM-DD
 * @returns {Promise<number>}
 */
async function getEolOutput(workCentreId, date) {
    const eolMachineId = await resolveEolMachineId(workCentreId);

    const fromProduction = await getEolOutputFromProduction(workCentreId, date, eolMachineId);
    if (fromProduction > 0) {
        return fromProduction;
    }

    const [rows] = await pool.query(
        `SELECT COALESCE(total_output_pairs, 0) AS total_output
         FROM machine_centre_summary
         WHERE DATE(prod_date) = ? AND work_centre_id = ? AND machine_id = ?`,
        [date, workCentreId, eolMachineId]
    );
    return Math.round(Number(rows[0]?.total_output || 0));
}

/**
 * EOL output for a line up to a wall-clock moment (finished cycles only).
 * @param {number} workCentreId
 * @param {string} date  YYYY-MM-DD (prod_date)
 * @param {string} asOfLocal  YYYY-MM-DD HH:mm:ss
 */
async function getEolOutputUpTo(workCentreId, date, asOfLocal) {
    const eolMachineId = await resolveEolMachineId(workCentreId);
    const [rows] = await pool.query(
        `SELECT COALESCE(SUM(output_pairs), 0) AS total_output
         FROM machine_centre_production
         WHERE work_centre_id = ?
           AND DATE(prod_date) = DATE(?)
           AND button_status = 2
           AND machine_id = ?
           AND finish_time IS NOT NULL
           AND finish_time <= ?`,
        [workCentreId, date, eolMachineId, asOfLocal]
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
 * Resolves the WIP input machine — work_centres.input_machine_id, then "(Input)" name fallback.
 *
 * @param {number} workCentreId
 * @returns {Promise<string>}
 */
async function resolveWipInputMachineId(workCentreId) {
    return lineMachineResolver.resolveInputMachineId(workCentreId);
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
        `SELECT opening_wip, today_input, current_wip, closing_wip, is_closed,
                COALESCE(manual_wip_override, 0) AS manual_wip_override
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
             (work_centre_id, state_date, opening_wip, today_input, current_wip, closing_wip, is_closed, manual_wip_override)
         VALUES (?, ?, ?, 0, ?, 0, 0, 0)`,
        [workCentreId, nextDate, opening, opening]
    );
}

/**
 * Creates today's row when missing, using the latest prior day's closing WIP (or live current if still open).
 *
 * @param {number} workCentreId
 * @param {string} date  YYYY-MM-DD
 * @returns {Promise<boolean>}  true when a row exists or was created
 */
async function ensureWipRowForDate(workCentreId, date) {
    const existing = await fetchWipStateRow(workCentreId, date);
    if (existing) {
        return true;
    }

    const carryForward = await resolveCarryForwardOpening(workCentreId, date);
    if (carryForward === null) {
        return false;
    }

    const openingWip = clampWip(carryForward);
    await pool.query(
        `INSERT INTO wip_daily_state
             (work_centre_id, state_date, opening_wip, today_input, current_wip, closing_wip, is_closed, manual_wip_override)
         VALUES (?, ?, ?, 0, ?, 0, 0, 0)`,
        [workCentreId, date, openingWip, openingWip]
    );
    return true;
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
function isLiveWipDate(date) {
    const key = String(date || '').slice(0, 10);
    return key.length === 10 && key === todayString();
}

async function computeAndPersistWip(workCentreId, date, _todayOutputIgnored) {
    await ensureWipRowForDate(workCentreId, date);

    const state = await fetchWipStateRow(workCentreId, date);
    const todayInputLive = await getTodayInput(workCentreId, date);
    const roundedOutput = Math.round(await getEolOutput(workCentreId, date));

    if (!state) {
        return {
            openingWip: 0,
            todayInput: todayInputLive,
            currentWip: 0,
            closingWip: 0,
            eolOutput: roundedOutput,
        };
    }

    const openingWip = Math.round(Number(state.opening_wip || 0));
    const isClosed = Boolean(Number(state.is_closed));
    const storedClosing = clampWip(state.closing_wip);
    const liveDate = isLiveWipDate(date);

    // Past closed days with closing snapshot stay frozen. Today always uses live formula.
    if (!liveDate && isClosed && storedClosing > 0) {
        return {
            openingWip,
            todayInput: Math.round(Number(state.today_input || 0)),
            currentWip: storedClosing,
            closingWip: storedClosing,
            eolOutput: roundedOutput,
        };
    }

    const currentWip = clampWip(openingWip + todayInputLive - roundedOutput);

    await pool.query(
        `UPDATE wip_daily_state
         SET today_input = ?,
             current_wip = ?
         WHERE work_centre_id = ? AND state_date = ?`,
        [todayInputLive, currentWip, workCentreId, date]
    );

    return {
        openingWip,
        todayInput: todayInputLive,
        currentWip,
        closingWip: Math.round(state.closing_wip || 0),
        eolOutput: roundedOutput,
    };
}

/**
 * Read-only breakdown for troubleshooting WIP (opening + input − EOL output).
 */
async function getWipBreakdown(workCentreId, date) {
    const state = await fetchWipStateRow(workCentreId, date);
    const inputMachineId = await resolveWipInputMachineId(workCentreId);
    const eolMachineId = await resolveEolMachineId(workCentreId);
    const todayInputLive = await getTodayInput(workCentreId, date);
    const eolOutput = await getEolOutput(workCentreId, date);
    const openingWip = state ? Math.round(Number(state.opening_wip || 0)) : 0;
    const computed = clampWip(openingWip + todayInputLive - eolOutput);

    return {
        workCentreId: Number(workCentreId),
        stateDate: String(date).slice(0, 10),
        openingWip,
        todayInputLive,
        eolOutput,
        computedCurrentWip: computed,
        dbCurrentWip: state ? clampWip(state.current_wip) : null,
        dbClosingWip: state ? clampWip(state.closing_wip) : null,
        isClosed: state ? Boolean(Number(state.is_closed)) : false,
        manualWipOverride: state ? Boolean(Number(state.manual_wip_override)) : false,
        inputMachineId,
        eolMachineId,
        liveDate: isLiveWipDate(date),
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
        `SELECT current_wip, closing_wip, COALESCE(manual_wip_override, 0) AS manual_wip_override
         FROM wip_daily_state
         WHERE work_centre_id = ? AND state_date = ?`,
        [workCentreId, date]
    );

    if (rows.length === 0) {
        throw new Error(`No WIP state found for work_centre_id=${workCentreId} on ${date}`);
    }

    const row = rows[0];
    const storedClosing = clampWip(row.closing_wip);
    const closingWip =
        Number(row.manual_wip_override) && storedClosing > 0
            ? storedClosing
            : clampWip(row.current_wip);

    await pool.query(
        `UPDATE wip_daily_state
         SET closing_wip = ?, current_wip = ?, is_closed = 1
         WHERE work_centre_id = ? AND state_date = ?`,
        [closingWip, closingWip, workCentreId, date]
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

/**
 * Recompute WIP after production changes (manual entry, mobile finish, etc.).
 */
async function refreshWipAfterProductionChange(workCentreId, date) {
    return computeAndPersistWip(workCentreId, date);
}

module.exports = {
    WIP_INPUT_MACHINE_ID,
    HEEL_GRIP_MACHINE_ID,
    LINE_3_WORK_CENTRE_ID,
    EOL_MACHINE_ID,
    clearLineMachineCache: lineMachineResolver.clearLineMachineCache,
    resolveWipInputMachineId,
    resolveEolMachineId,
    getTodayInput,
    getEolOutputFromProduction,
    getEolOutput,
    getEolOutputUpTo,
    refreshWipAfterProductionChange,
    getWipBreakdown,
    isLiveWipDate,
    resolveCarryForwardOpening,
    fetchWipStateRow,
    openNextDayRowFromClose,
    ensureWipRowForDate,
    computeAndPersistWip,
    closeDay,
    getWipState,
};
