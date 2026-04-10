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
    }
};

module.exports = mobileSessionController;
