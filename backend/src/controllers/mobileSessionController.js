const pool = require('../../config/database');
const { randomUUID } = require('crypto');
const logger = require('../utils/logger');
const { getRoutingMinsColumnName, getPairsPerRoutingBin } = require('../utils/routingMinsColumn');
const { buildPaceSnapshot, routingMapKey, toLocalDateStr } = require('../utils/shiftPaceEfficiency');

async function loadRoutingMinsMap(fromDate, toDate, workCentreId) {
    const routingMinsCol = await getRoutingMinsColumnName();
    const routingParams = [fromDate, toDate];
    if (workCentreId) routingParams.push(workCentreId);
    const [routingRows] = await pool.query(`
        SELECT
            pp2.work_centre_id,
            DATE(pp2.plan_date) AS plan_date,
            prl.machine_centre_id AS machine_id,
            ROUND(SUM(prl.${routingMinsCol}), 2) AS routing_mins_per_box
        FROM production_routing_lines prl
        INNER JOIN production_routing_header prh
            ON prl.routing_header_id = prh.id AND prh.deleted_at IS NULL
        INNER JOIN production_plan pp2
            ON prh.style_id = pp2.style_id AND pp2.deleted_at IS NULL
        WHERE DATE(pp2.plan_date) BETWEEN ? AND ?
            ${workCentreId ? 'AND pp2.work_centre_id = ?' : ''}
        GROUP BY pp2.work_centre_id, DATE(pp2.plan_date), prl.machine_centre_id
    `, routingParams);

    const map = new Map();
    for (const row of routingRows) {
        map.set(routingMapKey(row.work_centre_id, row.plan_date, row.machine_id), Number(row.routing_mins_per_box) || 0);
    }
    return map;
}

async function enrichSessionLogsWithPace(rows, { filterDate, workCentreId } = {}) {
    if (!rows.length) return rows;

    const pairsPerBin = await getPairsPerRoutingBin();
    let fromDate = filterDate ? toLocalDateStr(filterDate) : null;
    let toDate = fromDate;

    if (!fromDate) {
        const dateKeys = rows.map((r) => toLocalDateStr(r.activated_at)).filter(Boolean);
        if (!dateKeys.length) {
            return rows.map((row) => ({
                ...row,
                pace_efficiency: 0,
                pace_in_progress_actual: 0,
                pace_in_progress_expected: 0,
                pace_daily_target: 0,
            }));
        }
        fromDate = dateKeys.reduce((a, b) => (a < b ? a : b));
        toDate = dateKeys.reduce((a, b) => (a > b ? a : b));
    }

    const routingMap = await loadRoutingMinsMap(fromDate, toDate, workCentreId);
    const clockNow = new Date();

    return rows.map((row) => {
        const dateStr = filterDate ? toLocalDateStr(filterDate) : toLocalDateStr(row.activated_at);
        const output = Number(row.total_output) || 0;
        const routingMins = routingMap.get(routingMapKey(row.work_centre_id, dateStr, row.machine_id)) || 0;
        const pace = buildPaceSnapshot(output, routingMins, pairsPerBin, dateStr, clockNow);
        return {
            ...row,
            pace_efficiency: pace.pacePct,
            pace_in_progress_actual: pace.actual,
            pace_in_progress_expected: pace.expected,
            pace_daily_target: pace.daily,
        };
    });
}

function localDateKey(d = new Date()) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function yesterdayDateKey() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return localDateKey(d);
}

async function querySessionLogRowsForDate(date, workCentreId = null) {
    const prodStatsSubquery = `
        SELECT
            machine_id,
            emp_id,
            prod_date,
            SUM(output_pairs) AS total_output,
            COUNT(*) AS total_cycles,
            SUM(actual_time) AS total_actual_mins,
            SUM(target_mins) AS total_target_mins,
            CASE
                WHEN SUM(actual_time) > 0 THEN ROUND((SUM(target_mins) / SUM(actual_time)) * 100, 1)
                ELSE 0
            END AS avg_efficiency,
            SUM(idle_mins) AS total_idle_mins,
            MIN(start_time) AS first_start_time,
            MAX(finish_time) AS last_finish_time
        FROM machine_centre_production
        WHERE button_status = 2
        GROUP BY machine_id, emp_id, prod_date
    `;

    const runStatsSubquery = `
        SELECT
            machine_id,
            emp_id,
            prod_date,
            CASE
                WHEN SUM(CASE WHEN button_status = 1 THEN 1 ELSE 0 END) > 0 THEN 1
                ELSE 0
            END AS has_active_cycle
        FROM machine_centre_production
        WHERE button_status != 2
        GROUP BY machine_id, emp_id, prod_date
    `;

    let query = `
        WITH day_keys AS (
            SELECT DISTINCT
                mcp.machine_id,
                mcp.emp_id AS emp_code,
                mcp.work_centre_id,
                mcp.prod_date AS log_date
            FROM machine_centre_production mcp
            WHERE DATE(mcp.prod_date) = DATE(?)

            UNION

            SELECT
                ms.machine_id,
                ms.emp_code,
                COALESCE(ms.work_centre_id, mc.work_centre_id) AS work_centre_id,
                DATE(ms.activated_at) AS log_date
            FROM mobile_sessions ms
            LEFT JOIN machine_centres mc ON mc.machine_id = ms.machine_id
            WHERE ms.activated_at IS NOT NULL
              AND DATE(ms.activated_at) = DATE(?)
        )
        SELECT
            dk.machine_id,
            COALESCE(mc.name, dk.machine_id) AS machine_name,
            dk.work_centre_id,
            wc.name AS work_centre_name,
            dk.emp_code,
            e.name AS emp_name,
            COALESCE(
                CASE
                    WHEN ms.session_id IS NOT NULL AND DATE(ms.activated_at) = DATE(dk.log_date)
                    THEN ms.activated_at
                END,
                prod_stats.first_start_time
            ) AS activated_at,
            prod_stats.last_finish_time AS last_finish_time
        FROM day_keys dk
        LEFT JOIN mobile_sessions ms
            ON ms.machine_id = dk.machine_id
            AND ms.emp_code = dk.emp_code
        LEFT JOIN machine_centres mc ON mc.machine_id = dk.machine_id
        LEFT JOIN work_centres wc ON wc.id = dk.work_centre_id
        LEFT JOIN employees e ON e.code = dk.emp_code
        LEFT JOIN (${prodStatsSubquery}) prod_stats
            ON prod_stats.machine_id = dk.machine_id
            AND prod_stats.emp_id = dk.emp_code
            AND prod_stats.prod_date = dk.log_date
        LEFT JOIN (${runStatsSubquery}) run_stats
            ON run_stats.machine_id = dk.machine_id
            AND run_stats.emp_id = dk.emp_code
            AND run_stats.prod_date = dk.log_date
        WHERE DATE(dk.log_date) = DATE(?)
    `;
    const params = [date, date, date];

    if (workCentreId != null && workCentreId !== '' && !Number.isNaN(Number(workCentreId))) {
        query += ' AND dk.work_centre_id = ?';
        params.push(Number(workCentreId));
    }

    query += ' ORDER BY COALESCE(prod_stats.last_finish_time, activated_at) DESC';

    const [rows] = await pool.execute(query, params);
    return rows;
}

function dedupeLatestPerMachine(rows) {
    const byMachine = new Map();
    for (const row of rows) {
        if (!row.machine_id || !row.emp_code) continue;
        const ts = new Date(row.last_finish_time || row.activated_at || 0).getTime();
        const key = String(row.machine_id);
        const cur = byMachine.get(key);
        if (!cur || ts >= cur._ts) {
            byMachine.set(key, { ...row, _ts: ts });
        }
    }
    return [...byMachine.values()]
        .map(({ _ts, ...row }) => row)
        .sort((a, b) => String(a.machine_id).localeCompare(String(b.machine_id), undefined, { numeric: true }));
}

async function queryTodayActiveByMachine(workCentreId = null) {
    let sql = `
        SELECT
            ms.machine_id,
            COALESCE(mc.name, ms.machine_id) AS machine_name,
            ms.emp_code,
            e.name AS emp_name,
            COALESCE(ms.work_centre_id, mc.work_centre_id) AS work_centre_id,
            wc.name AS work_centre_name
        FROM mobile_sessions ms
        LEFT JOIN machine_centres mc ON mc.machine_id = ms.machine_id
        LEFT JOIN work_centres wc ON wc.id = COALESCE(ms.work_centre_id, mc.work_centre_id)
        LEFT JOIN employees e ON e.code = ms.emp_code
        WHERE ms.status IN ('active', 'waiting')
          AND DATE(ms.activated_at) = CURDATE()
    `;
    const params = [];
    if (workCentreId != null && workCentreId !== '' && !Number.isNaN(Number(workCentreId))) {
        sql += ' AND COALESCE(ms.work_centre_id, mc.work_centre_id) = ?';
        params.push(Number(workCentreId));
    }
    const [rows] = await pool.execute(sql, params);
    const map = new Map();
    for (const row of rows) {
        map.set(String(row.machine_id), row);
    }
    return map;
}

async function bulkActivateAssignments(assignments, { clearActiveSessions = false, workCentreId = null } = {}) {
    let clearedSessionsCount = 0;
    if (clearActiveSessions) {
        let sql = `UPDATE mobile_sessions SET status = 'expired'
                   WHERE status IN ('active', 'waiting') AND DATE(activated_at) = CURDATE()`;
        const params = [];
        if (workCentreId != null && !Number.isNaN(Number(workCentreId))) {
            sql += ' AND work_centre_id = ?';
            params.push(Number(workCentreId));
        }
        const [clearResult] = await pool.execute(sql, params);
        clearedSessionsCount = clearResult?.affectedRows || 0;
    }

    const results = [];
    for (const row of assignments) {
        const r = await activateMachineSessionCore(pool, {
            machine_id: row.machine_id,
            work_centre_id: row.work_centre_id,
            emp_id: String(row.emp_code),
        });
        results.push({
            machine_id: row.machine_id,
            machine_name: row.machine_name,
            emp_code: String(row.emp_code),
            emp_name: row.emp_name,
            success: r.ok,
            session_id: r.ok ? r.session_id : undefined,
            error: r.ok ? undefined : r.message,
        });
    }

    return { results, clearedSessionsCount };
}

/**
 * Core activation used by POST /activate and bulk assign-from-employees.
 * @param {*} dbPool mysql pool
 * @param {{ machine_id: string, work_centre_id?: number|null, emp_id: string }} params — `emp_id` is employees.code (same as single activate API).
 * @returns {Promise<{ ok: true, session_id: string } | { ok: false, status: number, message: string }>}
 */
async function activateMachineSessionCore(dbPool, { machine_id, work_centre_id, emp_id }) {
    try {
        if (!machine_id || !emp_id) {
            return { ok: false, status: 400, message: 'Missing machine or employee info' };
        }

        let parsedMachineId = machine_id;
        let parsedWorkCentreId = work_centre_id;

        if (typeof machine_id === 'string' && machine_id.includes('|')) {
            const [wcCode, mcId] = machine_id.split('|');
            parsedMachineId = mcId.trim();

            const [wcRows] = await dbPool.execute(
                'SELECT id FROM work_centres WHERE code = ? OR name = ?',
                [wcCode.trim(), wcCode.trim()]
            );
            if (wcRows.length === 0) {
                return { ok: false, status: 400, message: `Work centre "${wcCode}" not found` };
            }
            parsedWorkCentreId = wcRows[0].id;
        }

        const [empRows] = await dbPool.execute('SELECT id, code FROM employees WHERE code = ?', [emp_id]);
        if (empRows.length === 0) {
            return { ok: false, status: 400, message: `Employee Code ${emp_id} not found` };
        }

        let finalWorkCentreId = parsedWorkCentreId;
        if (!finalWorkCentreId) {
            const [machineRows] = await dbPool.execute(
                'SELECT machine_id, work_centre_id FROM machine_centres WHERE machine_id = ? OR code = ?',
                [parsedMachineId, parsedMachineId]
            );
            if (machineRows.length > 0) {
                finalWorkCentreId = machineRows[0].work_centre_id;
            } else if (parsedMachineId !== 'DEMO-MACHINE-01') {
                return { ok: false, status: 400, message: `Machine ${parsedMachineId} not found` };
            }
        }

        const [employeeActiveRows] = await dbPool.execute(
            `SELECT machine_id
             FROM mobile_sessions
             WHERE emp_code = ?
               AND status = 'active'
               AND DATE(activated_at) = CURDATE()
             ORDER BY activated_at DESC
             LIMIT 1`,
            [emp_id]
        );
        if (employeeActiveRows.length > 0 && String(employeeActiveRows[0].machine_id) !== String(parsedMachineId)) {
            return {
                ok: false,
                status: 409,
                message: `Operator ${emp_id} is already active on machine ${employeeActiveRows[0].machine_id}. Please finish/logout there first.`,
            };
        }

        await dbPool.execute(
            `UPDATE mobile_sessions
             SET status = 'expired'
             WHERE emp_code = ?
               AND status = 'active'
               AND DATE(activated_at) < CURDATE()`,
            [emp_id]
        );

        await dbPool.execute(
            `UPDATE mobile_sessions
             SET status = 'expired'
             WHERE machine_id = ?
               AND status = 'active'
               AND DATE(activated_at) < CURDATE()`,
            [parsedMachineId]
        );

        const [existing] = await dbPool.execute('SELECT session_id FROM mobile_sessions WHERE machine_id = ?', [parsedMachineId]);
        const finalSessionId = existing.length > 0 ? existing[0].session_id : randomUUID();

        await dbPool.execute(
            `INSERT INTO mobile_sessions (session_id, machine_id, work_centre_id, emp_id, emp_code, status, activated_at) 
             VALUES (?, ?, ?, ?, ?, 'active', NOW())
             ON DUPLICATE KEY UPDATE 
             work_centre_id = VALUES(work_centre_id), 
             emp_id = VALUES(emp_id), 
             emp_code = VALUES(emp_code),
             status = 'active', 
             activated_at = NOW()`,
            [finalSessionId, parsedMachineId, finalWorkCentreId || 1, empRows[0].id, emp_id]
        );

        return { ok: true, session_id: finalSessionId };
    } catch (error) {
        logger.error('activateMachineSessionCore', error);
        return { ok: false, status: 500, message: error.message || 'Activation failed' };
    }
}

const mobileSessionController = {
    // 1. Create a new session (called by Display Device)
    createSession: async (req, res, next) => {
        try {
            const { machine_id } = req.body;
            const sessionId = randomUUID();

            await pool.execute(
                'INSERT INTO mobile_sessions (session_id, machine_id, status) VALUES (?, ?, ?)',
                [sessionId, machine_id || null, 'waiting']
            );

            res.json({
                success: true,
                data: { session_id: sessionId }
            });
        } catch (error) {
            if (error?.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({
                    success: false,
                    message: 'Active setup conflict: machine or operator is already active. Please complete the previous setup first.'
                });
            }
            next(error);
        }
    },

    // 2. Poll session status (called by Display Device)
    checkSessionStatus: async (req, res, next) => {
        try {
            const { sessionId } = req.params;

            const [rows] = await pool.execute(
                'SELECT * FROM mobile_sessions WHERE session_id = ?',
                [sessionId]
            );

            if (rows.length === 0) {
                return res.status(404).json({ success: false, message: 'Session not found' });
            }

            const session = rows[0];

            if (session.status === 'active') {
                const [empRows] = await pool.execute(
                    'SELECT code, name FROM employees WHERE id = ?',
                    [session.emp_id]
                );
                if (empRows.length > 0) {
                    session.emp_code = empRows[0].code;
                    session.emp_name = empRows[0].name;
                }
                const [macRows] = await pool.execute(
                    'SELECT name FROM machine_centres WHERE machine_id = ? OR code = ?',
                    [session.machine_id, session.machine_id]
                );
                if (macRows.length > 0) {
                    session.machine_name = macRows[0].name;
                }
            }

            res.json({
                success: true,
                data: session
            });
        } catch (error) {
            next(error);
        }
    },

    // 3. Activate session (Now machine-focused, session_id is secondary)
    activateSession: async (req, res, next) => {
        try {
            const { machine_id, work_centre_id, emp_id } = req.body;
            const result = await activateMachineSessionCore(pool, { machine_id, work_centre_id, emp_id });
            if (!result.ok) {
                return res.status(result.status).json({ success: false, message: result.message });
            }
            res.json({
                success: true,
                message: 'Machine session activated',
                session_id: result.session_id,
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Activate mobile_sessions for every employee that has machine_centre_id set (employee ↔ machine),
     * using the same rules as POST /activate. Skips Toe Stitching and Folding by machine name
     * (these machines use a different workflow and should not be auto-activated).
     * Optional: ?work_centre_id=5 to limit to one line.
     */
    activateFromEmployeeMachineAssignments: async (req, res, next) => {
        try {
            const clearActiveSessionsParam = String(req.query.clear_active_sessions || req.query.clear_sessions || '').trim().toLowerCase();
            const shouldClearActiveSessions = ['1', 'true', 'yes', 'y', 'on'].includes(clearActiveSessionsParam);
            let clearedSessionsCount = 0;

            if (shouldClearActiveSessions) {
                const [clearResult] = await pool.execute(
                    `UPDATE mobile_sessions
                     SET status = 'expired'
                     WHERE status = 'active'
                       AND DATE(activated_at) = CURDATE()`
                );
                clearedSessionsCount = clearResult?.affectedRows || 0;
            }

            const wcFilter = req.query.work_centre_id != null && req.query.work_centre_id !== ''
                ? Number(req.query.work_centre_id)
                : null;

            let sql = `
                SELECT e.code AS emp_code,
                       mc.machine_id AS machine_id,
                       mc.work_centre_id AS work_centre_id,
                       mc.name AS machine_name
                FROM employees e
                INNER JOIN machine_centres mc ON mc.id = e.machine_centre_id
                WHERE e.machine_centre_id IS NOT NULL
                  AND COALESCE(e.is_active, 1) = 1
                  AND LOWER(CONCAT(COALESCE(mc.name, ''), ' ', COALESCE(mc.machine_name, ''))) NOT LIKE '%toe%stitch%'
                  AND LOWER(CONCAT(COALESCE(mc.name, ''), ' ', COALESCE(mc.machine_name, ''))) NOT LIKE '%fold%'
            `;
            const params = [];
            if (wcFilter != null && !Number.isNaN(wcFilter)) {
                sql += ' AND e.work_centre_id = ?';
                params.push(wcFilter);
            }
            sql += ' ORDER BY mc.machine_id, e.code';

            const [rows] = await pool.execute(sql, params);

            const results = [];
            for (const row of rows) {
                const r = await activateMachineSessionCore(pool, {
                    machine_id: row.machine_id,
                    work_centre_id: row.work_centre_id,
                    emp_id: String(row.emp_code),
                });
                results.push({
                    machine_id: row.machine_id,
                    machine_name: row.machine_name,
                    emp_code: String(row.emp_code),
                    success: r.ok,
                    session_id: r.ok ? r.session_id : undefined,
                    error: r.ok ? undefined : r.message,
                    httpStatus: r.ok ? 200 : r.status,
                });
            }

            const succeeded = results.filter((x) => x.success).length;
            const failed = results.length - succeeded;

            res.json({
                success: true,
                message: `Processed ${results.length} assignment(s): ${succeeded} activated, ${failed} failed or skipped.${shouldClearActiveSessions ? ` Cleared ${clearedSessionsCount} active session(s) before re-activation.` : ''}`,
                summary: {
                    total: results.length,
                    succeeded,
                    failed,
                    clearedActiveSessions: shouldClearActiveSessions ? clearedSessionsCount : undefined,
                },
                results,
            });
        } catch (error) {
            next(error);
        }
    },

    // 4. Find active session for machine (called by Mobile Display to autodetect its own URL)
    findActiveSession: async (req, res, next) => {
        try {
            const { machine_id } = req.params;

            // Only find sessions activated in the last 2 hours for security/relevance
            const [rows] = await pool.execute(
                `SELECT ms.*, e.code as emp_code, e.name as emp_name 
                 FROM mobile_sessions ms
                 JOIN employees e ON ms.emp_id = e.id
                 WHERE ms.machine_id = ? AND ms.status = 'active'
                 AND DATE(ms.activated_at) = CURDATE()
                 ORDER BY ms.activated_at DESC LIMIT 1`,
                [machine_id]
            );

            if (rows.length === 0) {
                return res.status(404).json({ success: false, message: 'No active session for this machine' });
            }

            res.json({
                success: true,
                data: rows[0]
            });
        } catch (error) {
            next(error);
        }
    },

    // 5. Find waiting session for machine
    findWaitingSession: async (req, res, next) => {
        try {
            const { machine_id } = req.params;

            const [rows] = await pool.execute(
                `SELECT * FROM mobile_sessions 
                 WHERE machine_id = ? AND status = 'waiting'
                 ORDER BY created_at DESC LIMIT 1`,
                [machine_id]
            );

            if (rows.length === 0) {
                return res.status(404).json({ success: false, message: 'No waiting session for this machine' });
            }

            res.json({
                success: true,
                data: rows[0]
            });
        } catch (error) {
            next(error);
        }
    },

    // 6. Get latest active session for polling (WhatsApp Web style)
    getLatestActiveSession: async (req, res, next) => {
        try {
            const { machineId } = req.params;
            
            let query = `SELECT ms.machine_id, ms.emp_code, ms.activated_at
                         FROM mobile_sessions ms
                         WHERE ms.status = 'active'
                         AND DATE(ms.activated_at) = CURDATE()`;
            let params = [];

            // Filter by machine ID if provided
            if (machineId) {
                query += ` AND ms.machine_id = ?`;
                params.push(machineId);
            }

            query += ` ORDER BY ms.activated_at DESC LIMIT 1`;

            const [rows] = await pool.execute(query, params);

            if (rows.length === 0) {
                return res.json({ success: true, data: null });
            }

            const session = rows[0];
            res.json({
                success: true,
                data: {
                    redirect_url: `/mobile/${session.machine_id}/${session.emp_code}`,
                    machine_id: session.machine_id,
                    emp_code: session.emp_code,
                    activated_at: session.activated_at
                }
            });
        } catch (error) {
            next(error);
        }
    },

    // 7. Get attendance for work centre
    getAttendance: async (req, res, next) => {
        try {
            const { workCentreId } = req.params;
            const { date } = req.query;
            const targetDate = date || new Date().toISOString().split('T')[0];

            const [[presentRow], [targetRow]] = await Promise.all([
                pool.execute(
                    `SELECT COUNT(DISTINCT emp_id) as present
                     FROM mobile_sessions
                     WHERE work_centre_id = ? AND status = 'active'
                     AND DATE(activated_at) = DATE(?)`,
                    [workCentreId, targetDate]
                ),
                pool.execute(
                    `SELECT COUNT(*) as total FROM employees WHERE work_centre_id = ?`,
                    [workCentreId]
                )
            ]);

            res.json({
                success: true,
                data: {
                    present: presentRow[0]?.present || 0,
                    target: targetRow[0]?.total || 0
                }
            });
        } catch (error) {
            next(error);
        }
    },

    // 8. Get machine login/session logs with optional line/date filters and production metrics
    getSessionLogs: async (req, res, next) => {
        try {
            const { work_centre_id, date, status } = req.query;

            const prodStatsSubquery = `
                SELECT
                    machine_id,
                    emp_id,
                    prod_date,
                    SUM(output_pairs) AS total_output,
                    COUNT(*) AS total_cycles,
                    SUM(actual_time) AS total_actual_mins,
                    SUM(target_mins) AS total_target_mins,
                    CASE
                        WHEN SUM(actual_time) > 0 THEN ROUND((SUM(target_mins) / SUM(actual_time)) * 100, 1)
                        ELSE 0
                    END AS avg_efficiency,
                    SUM(idle_mins) AS total_idle_mins,
                    MIN(start_time) AS first_start_time,
                    MAX(finish_time) AS last_finish_time
                FROM machine_centre_production
                WHERE button_status = 2
                GROUP BY machine_id, emp_id, prod_date
            `;

            const runStatsSubquery = `
                SELECT
                    machine_id,
                    emp_id,
                    prod_date,
                    CASE
                        WHEN SUM(CASE WHEN button_status = 1 THEN 1 ELSE 0 END) > 0 THEN 1
                        ELSE 0
                    END AS has_active_cycle
                FROM machine_centre_production
                WHERE button_status != 2
                GROUP BY machine_id, emp_id, prod_date
            `;

            let query;
            const params = [];

            if (date) {
                // mobile_sessions.activated_at is overwritten on each login, so historical dates
                // must include production activity (prod_date) as well as same-day sessions.
                query = `
                    WITH day_keys AS (
                        SELECT DISTINCT
                            mcp.machine_id,
                            mcp.emp_id AS emp_code,
                            mcp.work_centre_id,
                            mcp.prod_date AS log_date
                        FROM machine_centre_production mcp
                        WHERE DATE(mcp.prod_date) = DATE(?)

                        UNION

                        SELECT
                            ms.machine_id,
                            ms.emp_code,
                            COALESCE(ms.work_centre_id, mc.work_centre_id) AS work_centre_id,
                            DATE(ms.activated_at) AS log_date
                        FROM mobile_sessions ms
                        LEFT JOIN machine_centres mc ON mc.machine_id = ms.machine_id
                        WHERE ms.activated_at IS NOT NULL
                          AND DATE(ms.activated_at) = DATE(?)
                    )
                    SELECT
                        COALESCE(
                            ms.session_id,
                            CONCAT(dk.machine_id, ':', dk.emp_code, ':', DATE_FORMAT(dk.log_date, '%Y-%m-%d'))
                        ) AS session_id,
                        dk.machine_id,
                        COALESCE(mc.name, dk.machine_id) AS machine_name,
                        dk.work_centre_id,
                        wc.name AS work_centre_name,
                        dk.emp_code,
                        e.name AS emp_name,
                        CASE
                            WHEN ms.session_id IS NOT NULL AND DATE(ms.activated_at) = DATE(dk.log_date) THEN ms.status
                            ELSE 'expired'
                        END AS status,
                        COALESCE(
                            CASE
                                WHEN ms.session_id IS NOT NULL AND DATE(ms.activated_at) = DATE(dk.log_date)
                                THEN ms.activated_at
                            END,
                            prod_stats.first_start_time
                        ) AS activated_at,
                        ms.created_at,
                        COALESCE(prod_stats.total_output, 0) AS total_output,
                        COALESCE(prod_stats.total_cycles, 0) AS total_cycles,
                        COALESCE(prod_stats.total_actual_mins, 0) AS total_actual_mins,
                        COALESCE(prod_stats.total_target_mins, 0) AS total_target_mins,
                        COALESCE(prod_stats.avg_efficiency, 0) AS avg_efficiency,
                        COALESCE(prod_stats.total_idle_mins, 0) AS total_idle_mins,
                        COALESCE(run_stats.has_active_cycle, 0) AS has_active_cycle,
                        prod_stats.last_finish_time AS last_finish_time
                    FROM day_keys dk
                    LEFT JOIN mobile_sessions ms
                        ON ms.machine_id = dk.machine_id
                        AND ms.emp_code = dk.emp_code
                    LEFT JOIN machine_centres mc ON mc.machine_id = dk.machine_id
                    LEFT JOIN work_centres wc ON wc.id = dk.work_centre_id
                    LEFT JOIN employees e ON e.code = dk.emp_code
                    LEFT JOIN (${prodStatsSubquery}) prod_stats
                        ON prod_stats.machine_id = dk.machine_id
                        AND prod_stats.emp_id = dk.emp_code
                        AND prod_stats.prod_date = dk.log_date
                    LEFT JOIN (${runStatsSubquery}) run_stats
                        ON run_stats.machine_id = dk.machine_id
                        AND run_stats.emp_id = dk.emp_code
                        AND run_stats.prod_date = dk.log_date
                    WHERE DATE(dk.log_date) = DATE(?)
                `;
                params.push(date, date, date);
            } else {
                query = `
                    SELECT
                        ms.session_id,
                        ms.machine_id,
                        COALESCE(mc.name, ms.machine_id) AS machine_name,
                        COALESCE(ms.work_centre_id, mc.work_centre_id) AS work_centre_id,
                        wc.name AS work_centre_name,
                        ms.emp_code,
                        e.name AS emp_name,
                        ms.status,
                        ms.activated_at,
                        ms.created_at,
                        COALESCE(prod_stats.total_output, 0) AS total_output,
                        COALESCE(prod_stats.total_cycles, 0) AS total_cycles,
                        COALESCE(prod_stats.total_actual_mins, 0) AS total_actual_mins,
                        COALESCE(prod_stats.total_target_mins, 0) AS total_target_mins,
                        COALESCE(prod_stats.avg_efficiency, 0) AS avg_efficiency,
                        COALESCE(prod_stats.total_idle_mins, 0) AS total_idle_mins,
                        COALESCE(run_stats.has_active_cycle, 0) AS has_active_cycle,
                        prod_stats.last_finish_time AS last_finish_time
                    FROM mobile_sessions ms
                    LEFT JOIN machine_centres mc ON mc.machine_id = ms.machine_id
                    LEFT JOIN work_centres wc ON wc.id = COALESCE(ms.work_centre_id, mc.work_centre_id)
                    LEFT JOIN employees e ON e.id = ms.emp_id
                    LEFT JOIN (${prodStatsSubquery}) prod_stats
                        ON prod_stats.machine_id = ms.machine_id
                        AND prod_stats.emp_id = ms.emp_code
                        AND prod_stats.prod_date = DATE(ms.activated_at)
                    LEFT JOIN (${runStatsSubquery}) run_stats
                        ON run_stats.machine_id = ms.machine_id
                        AND run_stats.emp_id = ms.emp_code
                        AND run_stats.prod_date = DATE(ms.activated_at)
                    WHERE ms.activated_at IS NOT NULL
                `;
            }

            if (work_centre_id) {
                if (date) {
                    query += ' AND dk.work_centre_id = ?';
                } else {
                    query += ' AND COALESCE(ms.work_centre_id, mc.work_centre_id) = ?';
                }
                params.push(work_centre_id);
            }

            if (status) {
                if (date) {
                    query += ` AND (
                        (ms.session_id IS NOT NULL AND DATE(ms.activated_at) = DATE(?) AND ms.status = ?)
                        OR (ms.session_id IS NULL AND ? = 'expired')
                    )`;
                    params.push(date, status, status);
                } else {
                    query += ' AND ms.status = ?';
                    params.push(status);
                }
            }

            query += date
                ? ' ORDER BY activated_at DESC'
                : ' ORDER BY ms.activated_at DESC';

            const [rows] = await pool.execute(query, params);
            const data = await enrichSessionLogsWithPace(rows, {
                filterDate: date || null,
                workCentreId: work_centre_id || null,
            });

            res.json({
                success: true,
                data,
            });
        } catch (error) {
            next(error);
        }
    },

    // Get individual cycle details for a machine/employee/date
    getCycleDetails: async (req, res, next) => {
        try {
            const { machine_id, emp_code, date } = req.query;
            
            if (!machine_id || !emp_code || !date) {
                return res.status(400).json({
                    success: false,
                    message: 'machine_id, emp_code, and date are required'
                });
            }

            const [cycles] = await pool.execute(
                `SELECT
                    id,
                    output_pairs,
                    target_mins,
                    actual_time,
                    TIMESTAMPDIFF(MINUTE, start_time, finish_time) as actual_mins,
                    COALESCE(idle_mins, 0) as idle_mins,
                    start_time,
                    finish_time,
                    CASE
                        WHEN TIMESTAMPDIFF(MINUTE, start_time, finish_time) > 0
                        THEN ROUND((target_mins / TIMESTAMPDIFF(MINUTE, start_time, finish_time)) * 100, 1)
                        ELSE 0
                    END as efficiency
                FROM machine_centre_production
                WHERE machine_id = ?
                    AND emp_id = ?
                    AND DATE(prod_date) = DATE(?)
                    AND button_status = 2
                ORDER BY start_time ASC`,
                [machine_id, emp_code, date]
            );

            // Add cycle numbers
            const cyclesWithNumbers = cycles.map((cycle, index) => ({
                ...cycle,
                cycle_number: index + 1
            }));

            res.json({
                success: true,
                data: cyclesWithNumbers
            });
        } catch (error) {
            next(error);
        }
    },

    // Deactivate an active session from logs
    deactivateSession: async (req, res, next) => {
        try {
            const { session_id } = req.body || {};
            if (!session_id) {
                return res.status(400).json({
                    success: false,
                    message: 'session_id is required'
                });
            }

            const [rows] = await pool.execute(
                `SELECT session_id, machine_id, emp_code, status
                 FROM mobile_sessions
                 WHERE session_id = ?
                 LIMIT 1`,
                [session_id]
            );

            if (rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Session not found'
                });
            }

            const session = rows[0];
            if (session.status !== 'active' && session.status !== 'waiting') {
                return res.status(400).json({
                    success: false,
                    message: 'Only active or waiting sessions can be deactivated'
                });
            }

            // Update session status to expired
            await pool.execute(
                `UPDATE mobile_sessions
                 SET status = 'expired'
                 WHERE session_id = ?`,
                [session_id]
            );

            logger.info(`Session ${session_id} for machine ${session.machine_id} deactivated by user`);

            res.json({
                success: true,
                message: 'Session deactivated successfully'
            });
        } catch (error) {
            next(error);
        }
    },

    // Reactivate a previously expired session from logs
    reactivateSessionFromLogs: async (req, res, next) => {
        try {
            const { session_id } = req.body || {};
            if (!session_id) {
                return res.status(400).json({
                    success: false,
                    message: 'session_id is required'
                });
            }

            const [rows] = await pool.execute(
                `SELECT session_id, machine_id, work_centre_id, emp_code, status
                 FROM mobile_sessions
                 WHERE session_id = ?
                 LIMIT 1`,
                [session_id]
            );

            if (rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Session not found'
                });
            }

            const session = rows[0];
            if (!session.machine_id || !session.emp_code) {
                return res.status(400).json({
                    success: false,
                    message: 'Session is missing machine or employee data and cannot be reactivated'
                });
            }

            if (session.status === 'active') {
                return res.json({
                    success: true,
                    message: 'Session is already active',
                    session_id: session.session_id
                });
            }

            const result = await activateMachineSessionCore(pool, {
                machine_id: String(session.machine_id),
                work_centre_id: session.work_centre_id || null,
                emp_id: String(session.emp_code)
            });

            if (!result.ok) {
                return res.status(result.status).json({
                    success: false,
                    message: result.message
                });
            }

            res.json({
                success: true,
                message: 'Session reactivated successfully',
                session_id: result.session_id
            });
        } catch (error) {
            next(error);
        }
    },

    /** Preview yesterday's last operator per machine for bulk re-login today. */
    getYesterdayLoginPreview: async (req, res, next) => {
        try {
            const workCentreId = req.query.work_centre_id != null && req.query.work_centre_id !== ''
                ? Number(req.query.work_centre_id)
                : null;
            const sourceDate = req.query.date || yesterdayDateKey();
            const rows = await querySessionLogRowsForDate(sourceDate, workCentreId);
            const assignments = dedupeLatestPerMachine(rows);
            const activeTodayMap = await queryTodayActiveByMachine(workCentreId);

            const preview = assignments.map((row) => {
                const active = activeTodayMap.get(String(row.machine_id));
                let today_status = 'not_logged';
                if (active) {
                    today_status = String(active.emp_code) === String(row.emp_code) ? 'same' : 'different';
                }
                return {
                    machine_id: row.machine_id,
                    machine_name: row.machine_name,
                    work_centre_id: row.work_centre_id,
                    work_centre_name: row.work_centre_name,
                    emp_code: row.emp_code,
                    emp_name: row.emp_name,
                    last_activity_at: row.last_finish_time || row.activated_at,
                    today_status,
                    today_emp_code: active?.emp_code || null,
                    today_emp_name: active?.emp_name || null,
                };
            });

            res.json({
                success: true,
                data: {
                    source_date: sourceDate,
                    today_date: localDateKey(),
                    total: preview.length,
                    assignments: preview,
                },
            });
        } catch (error) {
            next(error);
        }
    },

    /** Activate today using yesterday's last operator per machine. */
    activateYesterdayLogins: async (req, res, next) => {
        try {
            const workCentreId = req.query.work_centre_id != null && req.query.work_centre_id !== ''
                ? Number(req.query.work_centre_id)
                : null;
            const sourceDate = req.body?.source_date || req.query.date || yesterdayDateKey();
            const clearActiveSessions = ['1', 'true', 'yes', 'y', 'on'].includes(
                String(req.body?.clear_active_sessions ?? req.query.clear_active_sessions ?? '').trim().toLowerCase()
            );

            let assignments;
            if (Array.isArray(req.body?.assignments) && req.body.assignments.length > 0) {
                assignments = req.body.assignments
                    .filter((row) => row?.machine_id && row?.emp_code)
                    .map((row) => ({
                        machine_id: String(row.machine_id),
                        machine_name: row.machine_name || String(row.machine_id),
                        work_centre_id: row.work_centre_id ?? null,
                        work_centre_name: row.work_centre_name || null,
                        emp_code: String(row.emp_code),
                        emp_name: row.emp_name || String(row.emp_code),
                    }));
            } else {
                const rows = await querySessionLogRowsForDate(sourceDate, workCentreId);
                assignments = dedupeLatestPerMachine(rows);
            }

            if (!assignments.length) {
                return res.status(400).json({
                    success: false,
                    message: `No machine logins found for ${sourceDate}.`,
                });
            }

            const { results, clearedSessionsCount } = await bulkActivateAssignments(assignments, {
                clearActiveSessions,
                workCentreId,
            });

            const succeeded = results.filter((x) => x.success).length;
            const failed = results.length - succeeded;

            res.json({
                success: true,
                message: `Logged in ${succeeded} of ${results.length} machine(s) from ${sourceDate}.${clearActiveSessions ? ` Cleared ${clearedSessionsCount} active session(s) first.` : ''}${failed ? ` ${failed} failed — see details.` : ''}`,
                data: {
                    source_date: sourceDate,
                    summary: {
                        total: results.length,
                        succeeded,
                        failed,
                        clearedActiveSessions: clearActiveSessions ? clearedSessionsCount : undefined,
                    },
                    results,
                },
            });
        } catch (error) {
            next(error);
        }
    },

    // 9. Active sessions snapshot for manual entry filtering (protected route)
    getActiveSessionsSnapshot: async (req, res, next) => {
        try {
            const [rows] = await pool.execute(
                `SELECT machine_id, emp_code, activated_at
                 FROM mobile_sessions
                 WHERE status = 'active'
                   AND DATE(activated_at) = CURDATE()
                 ORDER BY activated_at DESC`
            );

            res.json({
                success: true,
                data: rows
            });
        } catch (error) {
            next(error);
        }
    },

    // Internal utility: expire all active sessions (used by scheduler)
    expireAllActiveSessions: async () => {
        const [result] = await pool.execute(
            `UPDATE mobile_sessions
             SET status = 'expired'
             WHERE status = 'active'`
        );

        if (result.affectedRows > 0) {
            logger.warn(`Auto-close: expired ${result.affectedRows} active mobile session(s).`);
        } else {
            logger.info('Auto-close: no active mobile sessions to expire.');
        }

        return result.affectedRows || 0;
    },

    // Internal utility: auto-finish any unfinished production cycles (used by scheduler)
    autoFinishUnfinishedProductions: async () => {
        const shiftEndHour = parseInt(process.env.SHIFT_END_HOUR || '17', 10);
        const shiftEndMinute = parseInt(process.env.SHIFT_END_MINUTE || '35', 10);

        // For cycles started on previous days, set finish_time to their day's shift-end
        // so they don't accumulate absurd actual_time values across days.
        const [staleResult] = await pool.execute(
            `UPDATE machine_centre_production
             SET
               finish_time = CONCAT(DATE(start_time), ' ', LPAD(?, 2, '0'), ':', LPAD(?, 2, '0'), ':00'),
               idle_stop_time = CASE
                 WHEN button_status = 3 AND idle_start_time IS NOT NULL AND idle_stop_time IS NULL
                   THEN CONCAT(DATE(start_time), ' ', LPAD(?, 2, '0'), ':', LPAD(?, 2, '0'), ':00')
                 ELSE idle_stop_time
               END,
               output_pairs = CASE
                 WHEN COALESCE(output_pairs, 0) <= 0 THEN 0
                 ELSE output_pairs
               END,
               button_status = 2
             WHERE button_status IN (1, 3)
               AND DATE(start_time) < CURDATE()`,
            [shiftEndHour, shiftEndMinute, shiftEndHour, shiftEndMinute]
        );

        if (staleResult.affectedRows > 0) {
            logger.warn(`Auto-finish: closed ${staleResult.affectedRows} STALE production cycle(s) from previous days (finish set to shift-end of their start date).`);
        }

        // For today's open cycles, set finish_time to NOW()
        const [todayResult] = await pool.execute(
            `UPDATE machine_centre_production
             SET
               finish_time = NOW(),
               idle_stop_time = CASE
                 WHEN button_status = 3 AND idle_start_time IS NOT NULL AND idle_stop_time IS NULL THEN NOW()
                 ELSE idle_stop_time
               END,
               output_pairs = CASE
                 WHEN COALESCE(output_pairs, 0) <= 0 THEN 6
                 ELSE output_pairs
               END,
               button_status = 2
             WHERE button_status IN (1, 3)
               AND DATE(start_time) = CURDATE()`
        );

        if (todayResult.affectedRows > 0) {
            logger.warn(`Auto-finish: closed ${todayResult.affectedRows} unfinished production cycle(s) from today.`);
        }

        const total = (staleResult.affectedRows || 0) + (todayResult.affectedRows || 0);
        if (total === 0) {
            logger.info('Auto-finish: no unfinished production cycles found.');
        }

        return total;
    },

    // Internal utility: purge old expired sessions to keep table size manageable
    cleanupExpiredSessionsHistory: async (retentionDays = 60) => {
        const safeRetentionDays = Number.isFinite(Number(retentionDays))
            ? Math.max(1, Math.floor(Number(retentionDays)))
            : 60;

        const [result] = await pool.execute(
            `DELETE FROM mobile_sessions
             WHERE status = 'expired'
               AND COALESCE(activated_at, created_at) < (NOW() - INTERVAL ? DAY)`,
            [safeRetentionDays]
        );

        if (result.affectedRows > 0) {
            logger.info(`Session cleanup: removed ${result.affectedRows} expired mobile session(s) older than ${safeRetentionDays} day(s).`);
        } else {
            logger.info(`Session cleanup: no expired sessions older than ${safeRetentionDays} day(s) found.`);
        }

        return result.affectedRows || 0;
    }
};

module.exports = mobileSessionController;
