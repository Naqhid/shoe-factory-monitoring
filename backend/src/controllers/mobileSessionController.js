const pool = require('../../config/database');
const { randomUUID } = require('crypto');
const logger = require('../utils/logger');

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

            if (!machine_id || !emp_id) {
                return res.status(400).json({ success: false, message: 'Missing machine or employee info' });
            }

            // Parse QR format: "work_centre_code|machine_id" e.g. "Stitching-line|01"
            let parsedMachineId = machine_id;
            let parsedWorkCentreId = work_centre_id;

            if (machine_id.includes('|')) {
                const [wcCode, mcId] = machine_id.split('|');
                parsedMachineId = mcId.trim();

                // Resolve work centre by code
                const [wcRows] = await pool.execute(
                    'SELECT id FROM work_centres WHERE code = ? OR name = ?',
                    [wcCode.trim(), wcCode.trim()]
                );
                if (wcRows.length === 0) {
                    return res.status(400).json({ success: false, message: `Work centre "${wcCode}" not found` });
                }
                parsedWorkCentreId = wcRows[0].id;
            }

            // 1. Resolve Employee
            const [empRows] = await pool.execute(
                'SELECT id, code FROM employees WHERE code = ?',
                [emp_id]
            );
            if (empRows.length === 0) {
                return res.status(400).json({ success: false, message: `Employee Code ${emp_id} not found` });
            }
            const finalEmpId = empRows[0].code;

            // 2. Resolve Machine — if not parsed from QR, fall back to machine_centres lookup
            let finalWorkCentreId = parsedWorkCentreId;
            if (!finalWorkCentreId) {
                const [machineRows] = await pool.execute(
                    'SELECT machine_id, work_centre_id FROM machine_centres WHERE machine_id = ? OR code = ?',
                    [parsedMachineId, parsedMachineId]
                );
                if (machineRows.length > 0) {
                    finalWorkCentreId = machineRows[0].work_centre_id;
                } else if (parsedMachineId !== 'DEMO-MACHINE-01') {
                    return res.status(400).json({ success: false, message: `Machine ${parsedMachineId} not found` });
                }
            }

            // 2.5 Enforce one active machine per operator (same day).
            // Prevents same operator being active on multiple machines simultaneously.
            const [employeeActiveRows] = await pool.execute(
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
                return res.status(409).json({
                    success: false,
                    message: `Operator ${emp_id} is already active on machine ${employeeActiveRows[0].machine_id}. Please finish/logout there first.`
                });
            }

            // 2.6 Hygiene: expire older active sessions for this operator from previous days.
            // Keeps session table clean and avoids stale "active" rows accumulating.
            await pool.execute(
                `UPDATE mobile_sessions
                 SET status = 'expired'
                 WHERE emp_code = ?
                   AND status = 'active'
                   AND DATE(activated_at) < CURDATE()`,
                [emp_id]
            );

            // Also expire older active rows for this machine from previous days.
            await pool.execute(
                `UPDATE mobile_sessions
                 SET status = 'expired'
                 WHERE machine_id = ?
                   AND status = 'active'
                   AND DATE(activated_at) < CURDATE()`,
                [parsedMachineId]
            );

            // 3. Upsert session by machine_id
            const [existing] = await pool.execute('SELECT session_id FROM mobile_sessions WHERE machine_id = ?', [parsedMachineId]);
            const finalSessionId = existing.length > 0 ? existing[0].session_id : randomUUID();

            await pool.execute(
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

            res.json({
                success: true,
                message: 'Machine session activated',
                session_id: finalSessionId
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

            let query = `
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
                    -- Production metrics from finished cycles during this session
                    COALESCE(prod_stats.total_output, 0) AS total_output,
                    COALESCE(prod_stats.total_cycles, 0) AS total_cycles,
                    COALESCE(prod_stats.total_actual_mins, 0) AS total_actual_mins,
                    COALESCE(prod_stats.total_target_mins, 0) AS total_target_mins,
                    COALESCE(prod_stats.avg_efficiency, 0) AS avg_efficiency,
                    COALESCE(prod_stats.total_idle_mins, 0) AS total_idle_mins,
                    COALESCE(run_stats.has_active_cycle, 0) AS has_active_cycle,
                    -- Last logout/completed time
                    prod_stats.last_finish_time AS last_finish_time
                FROM mobile_sessions ms
                LEFT JOIN machine_centres mc ON mc.machine_id = ms.machine_id
                LEFT JOIN work_centres wc ON wc.id = COALESCE(ms.work_centre_id, mc.work_centre_id)
                LEFT JOIN employees e ON e.id = ms.emp_id
                LEFT JOIN (
                    -- Aggregate production stats per machine/employee/date for finished cycles
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
                        MAX(finish_time) AS last_finish_time
                    FROM machine_centre_production
                    WHERE button_status = 2
                    GROUP BY machine_id, emp_id, prod_date
                ) prod_stats 
                    ON prod_stats.machine_id = ms.machine_id 
                    AND prod_stats.emp_id = ms.emp_code
                    AND prod_stats.prod_date = DATE(ms.activated_at)
                LEFT JOIN (
                    -- Running cycle signal for this session day
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
                ) run_stats
                    ON run_stats.machine_id = ms.machine_id
                    AND run_stats.emp_id = ms.emp_code
                    AND run_stats.prod_date = DATE(ms.activated_at)
                WHERE ms.activated_at IS NOT NULL
            `;

            const params = [];

            if (work_centre_id) {
                query += ' AND COALESCE(ms.work_centre_id, mc.work_centre_id) = ?';
                params.push(work_centre_id);
            }

            if (date) {
                query += ' AND DATE(ms.activated_at) = DATE(?)';
                params.push(date);
            }

            if (status) {
                query += ' AND ms.status = ?';
                params.push(status);
            }

            query += ' ORDER BY ms.activated_at DESC';

            const [rows] = await pool.execute(query, params);

            res.json({
                success: true,
                data: rows
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
        const [result] = await pool.execute(
            `UPDATE machine_centre_production
             SET
               finish_time = NOW(),
               idle_stop_time = CASE
                 WHEN button_status = 3 AND idle_start_time IS NOT NULL AND idle_stop_time IS NULL THEN NOW()
                 ELSE idle_stop_time
               END,
               idle_mins = CASE
                 WHEN button_status = 3 AND idle_start_time IS NOT NULL AND idle_stop_time IS NULL
                 THEN COALESCE(idle_mins, 0) + GREATEST(TIMESTAMPDIFF(MINUTE, idle_start_time, NOW()), 0)
                 ELSE COALESCE(idle_mins, 0)
               END,
               actual_time = GREATEST(
                 0,
                 TIMESTAMPDIFF(MINUTE, start_time, NOW()) - (
                   CASE
                     WHEN button_status = 3 AND idle_start_time IS NOT NULL AND idle_stop_time IS NULL
                     THEN COALESCE(idle_mins, 0) + GREATEST(TIMESTAMPDIFF(MINUTE, idle_start_time, NOW()), 0)
                     ELSE COALESCE(idle_mins, 0)
                   END
                 )
               ),
               output_pairs = CASE
                 WHEN COALESCE(output_pairs, 0) <= 0 THEN 12
                 ELSE output_pairs
               END,
               button_status = 2
             WHERE button_status IN (1, 3)`
        );

        if (result.affectedRows > 0) {
            logger.warn(`Auto-finish: closed ${result.affectedRows} unfinished production cycle(s).`);
        } else {
            logger.info('Auto-finish: no unfinished production cycles found.');
        }

        return result.affectedRows || 0;
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
