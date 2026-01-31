const mysql = require('mysql2/promise');
const { randomUUID } = require('crypto');
const logger = require('../utils/logger');

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'shoe_factory'
};

const mobileSessionController = {
    // 1. Create a new session (called by Display Device)
    createSession: async (req, res, next) => {
        let connection;
        try {
            connection = await mysql.createConnection(dbConfig);
            const { machine_id } = req.body; // Optional: if machine is already known
            const sessionId = randomUUID();

            await connection.execute(
                'INSERT INTO mobile_sessions (session_id, machine_id, status) VALUES (?, ?, ?)',
                [sessionId, machine_id || null, 'waiting']
            );

            res.json({
                success: true,
                data: { session_id: sessionId }
            });
        } catch (error) {
            next(error);
        } finally {
            if (connection) await connection.end();
        }
    },

    // 2. Poll session status (called by Display Device)
    checkSessionStatus: async (req, res, next) => {
        let connection;
        try {
            connection = await mysql.createConnection(dbConfig);
            const { sessionId } = req.params;

            const [rows] = await connection.execute(
                'SELECT * FROM mobile_sessions WHERE session_id = ?',
                [sessionId]
            );

            if (rows.length === 0) {
                return res.status(404).json({ success: false, message: 'Session not found' });
            }

            const session = rows[0];

            // If active, resolve names for the mobile app
            if (session.status === 'active') {
                const [empRows] = await connection.execute(
                    'SELECT code, name FROM employees WHERE id = ?',
                    [session.emp_id]
                );
                if (empRows.length > 0) {
                    session.emp_code = empRows[0].code;
                    session.emp_name = empRows[0].name;
                }
                const [macRows] = await connection.execute(
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
        } finally {
            if (connection) await connection.end();
        }
    },

    // 3. Activate session (called by Scanner Device)
    activateSession: async (req, res, next) => {
        let connection;
        try {
            connection = await mysql.createConnection(dbConfig);
            const { session_id, machine_id, work_centre_id, emp_id, emp_code } = req.body;

            // Validate inputs
            if (!session_id || !machine_id || (!emp_id && !emp_code)) {
                return res.status(400).json({ success: false, message: 'Missing required fields' });
            }

            // 1. Resolve Employee
            let finalEmpId = emp_id;
            if (emp_code) {
                const [empRows] = await connection.execute(
                    'SELECT id FROM employees WHERE code = ?',
                    [emp_code]
                );
                if (empRows.length > 0) {
                    finalEmpId = empRows[0].id;
                } else {
                    return res.status(400).json({ success: false, message: 'Invalid Employee Code' });
                }
            }

            // 2. Validate/Resolve Machine
            const [machineRows] = await connection.execute(
                'SELECT machine_id FROM machine_centres WHERE machine_id = ? OR code = ?',
                [machine_id, machine_id]
            );

            if (machineRows.length === 0 && machine_id !== 'DEMO-MACHINE-01') {
                return res.status(400).json({ success: false, message: 'Invalid Machine ID' });
            }

            // check if session is waiting
            const [rows] = await connection.execute(
                'SELECT * FROM mobile_sessions WHERE session_id = ? AND status = "waiting"',
                [session_id]
            );

            if (rows.length === 0) {
                return res.status(400).json({ success: false, message: 'Session invalid or not waiting' });
            }

            // Update session
            await connection.execute(
                `UPDATE mobile_sessions 
                 SET status = 'active', machine_id = ?, work_centre_id = ?, emp_id = ?, activated_at = NOW() 
                 WHERE session_id = ?`,
                [machine_id, work_centre_id || 1, finalEmpId || 1, session_id]
            );

            res.json({
                success: true,
                message: 'Session activated successfully'
            });
        } catch (error) {
            next(error);
        } finally {
            if (connection) await connection.end();
        }
    },

    // 4. Find active session for machine (called by Mobile Display to autodetect its own URL)
    findActiveSession: async (req, res, next) => {
        let connection;
        try {
            connection = await mysql.createConnection(dbConfig);
            const { machine_id } = req.params;

            // Only find sessions activated in the last 2 hours for security/relevance
            const [rows] = await connection.execute(
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
        } finally {
            if (connection) await connection.end();
        }
    }
};

module.exports = mobileSessionController;
