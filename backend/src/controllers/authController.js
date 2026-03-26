const db = require('../../config/database');
const logger = require('../utils/logger');

class AuthController {
    async login(req, res) {
        const startTime = Date.now();
        try {
            const { login, password } = req.body;

            if (!login || !password) {
                return res.status(400).json({ success: false, message: 'Login and password are required' });
            }

            logger.info(`Login attempt for: ${login}`);

            // In production, password should be hashed (e.g., bcrypt).
            const [rows] = await db.execute(
                `SELECT u.id, u.code, u.name, u.role, u.machine_id, u.work_centre_id, wc.code as work_centre_code, wc.name as work_centre_name 
                 FROM users u 
                 LEFT JOIN work_centres wc ON u.work_centre_id = wc.id 
                 WHERE u.code = ? AND u.password = ?`,
                [login, password]
            );

            const queryTime = Date.now() - startTime;
            logger.info(`Login query took ${queryTime}ms`);

            if (rows.length === 0) {
                return res.status(401).json({ success: false, message: 'Invalid credentials' });
            }

            const user = rows[0];

            res.json({
                success: true,
                data: {
                    id: user.id,
                    code: user.code,
                    name: user.name,
                    role: user.role,
                    machine_id: user.machine_id,
                    work_centre_id: user.work_centre_id,
                    work_centre_code: user.work_centre_code,
                    work_centre_name: user.work_centre_name
                }
            });
        } catch (error) {
            const totalTime = Date.now() - startTime;
            logger.error(`Login error after ${totalTime}ms:`, error);
            
            // Specific error messages
            let message = 'Internal server error';
            if (error.code === 'ECONNREFUSED') {
                message = 'Database connection refused. Check if MySQL is running.';
            } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
                message = 'Database access denied. Check credentials in .env file.';
            } else if (error.code === 'ETIMEDOUT') {
                message = 'Database connection timeout. Check DB_HOST in .env file.';
            }
            
            res.status(500).json({ success: false, message });
        }
    }
}

module.exports = new AuthController();
