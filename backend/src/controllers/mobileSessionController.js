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

    // 3. Activate session (called by Scanner Device)
    activateSession: async (req, res, next) => {
        try {
            const { session_id, machine_id, work_centre_id, emp_id, emp_code } = req.body;

            if (!session_id || !machine_id || (!emp_id && !emp_code)) {
                return res.status(400).json({ success: false, message: 'Missing required fields' });
            }

            // 1. Resolve Employee
            let finalEmpId = emp_id;
            if (emp_code) {
                const [empRows] = await pool.execute(
                    'SELECT id FROM employees WHERE code = ?',
                    [emp_code]
                );
                if (empRows.length > 0) {
                    finalEmpId = empRows[0].id;
                } else if (!finalEmpId) {
                    return res.status(400).json({ success: false, message: `Employee code ${emp_code} not found` });
                }
            }

            // 2. Resolve Machine (to get work_centre_id if not provided)
            let finalWorkCentreId = work_centre_id;
            const [machineRows] = await pool.execute(
                'SELECT machine_id, work_centre_id FROM machine_centres WHERE machine_id = ? OR code = ?',
                [machine_id, machine_id]
            );

            if (machineRows.length > 0) {
                finalWorkCentreId = machineRows[0].work_centre_id;
            } else if (machine_id !== 'DEMO-MACHINE-01') {
                return res.status(400).json({ success: false, message: `Machine ${machine_id} not found` });
            }

            // 3. Update session
            const [result] = await pool.execute(
                `UPDATE mobile_sessions 
                 SET status = 'active', machine_id = ?, work_centre_id = ?, emp_id = ?, activated_at = NOW() 
                 WHERE session_id = ? AND status = 'waiting'`,
                [machine_id, finalWorkCentreId || 1, finalEmpId || 1, session_id]
            );

            if (result.affectedRows === 0) {
                // Check if it exists but is already active
                const [check] = await pool.execute('SELECT status FROM mobile_sessions WHERE session_id = ?', [session_id]);
                if (check.length === 0) return res.status(404).json({ success: false, message: 'Session ID not found in database' });
                if (check[0].status !== 'waiting') return res.status(400).json({ success: false, message: `Session is already ${check[0].status}` });

                return res.status(400).json({ success: false, message: 'Failed to update session status' });
            }

            res.json({
                success: true,
                message: 'Session activated'
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
                 AND ms.activated_at >= NOW() - INTERVAL 2 HOUR
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

    // 5. Find waiting session for machine (called by Mobile Phone if it scanned a machine but has no session ID)
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
    }
};

module.exports = mobileSessionController;
