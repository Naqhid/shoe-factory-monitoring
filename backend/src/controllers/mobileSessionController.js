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
                    'SELECT emp_id, name FROM employees WHERE id = ?',
                    [session.emp_id]
                );
                if (empRows.length > 0) {
                    session.emp_id = empRows[0].emp_id;
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

            // 1. Resolve Employee - treat emp_id as employee code
            const [empRows] = await pool.execute(
                'SELECT id FROM employees WHERE emp_id = ?',
                [emp_id]
            );
            
            if (empRows.length === 0) {
                return res.status(400).json({ success: false, message: `Employee ID ${emp_id} not found` });
            }
            
            const finalEmpId = empRows[0].id;

            // 2. Resolve Machine
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

            // 3. Upsert session by machine_id (This is the anchor for sync)
            const [existing] = await pool.execute('SELECT session_id FROM mobile_sessions WHERE machine_id = ?', [machine_id]);
            const finalSessionId = existing.length > 0 ? existing[0].session_id : randomUUID();

            await pool.execute(
                `INSERT INTO mobile_sessions (session_id, machine_id, work_centre_id, emp_id, status, activated_at) 
                 VALUES (?, ?, ?, ?, 'active', NOW())
                 ON DUPLICATE KEY UPDATE 
                 work_centre_id = VALUES(work_centre_id), 
                 emp_id = VALUES(emp_id), 
                 status = 'active', 
                 activated_at = NOW()`,
                [finalSessionId, machine_id, finalWorkCentreId || 1, finalEmpId]
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
                 FROM mobile_sessions ms
                 JOIN employees e ON ms.emp_id = e.id
                 WHERE ms.machine_id = ? AND ms.status = 'active'
                 AND ms.activated_at >= NOW() - INTERVAL 2 HOUR
                 ORDER BY ms.activated_at DESC LIMIT 1,
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
    }
};

module.exports = mobileSessionController;
