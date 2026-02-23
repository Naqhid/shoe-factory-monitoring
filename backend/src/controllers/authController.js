const db = require('../../config/database');
const logger = require('../utils/logger');

class AuthController {
    async login(req, res) {
        try {
            const { login, password } = req.body;

            if (!login || !password) {
                return res.status(400).json({ success: false, message: 'Login and password are required' });
            }

            // In production, password should be hashed (e.g., bcrypt).
            // For this demo, we check plain text as seeded.
            const [rows] = await db.execute(
                `SELECT u.id, u.code, u.name, u.role, u.email, u.machine_id, wc.code as work_centre_code 
                 FROM users u 
                 LEFT JOIN work_centres wc ON u.work_centre_id = wc.id 
                 WHERE (u.code = ? OR u.email = ?) AND u.password = ?`,
                [login, login, password]
            );

            if (rows.length === 0) {
                return res.status(401).json({ success: false, message: 'Invalid credentials' });
            }

            const user = rows[0];

            // Return user info (token generation skipped for simple demo)
            res.json({
                success: true,
                data: {
                    id: user.id,
                    code: user.code,
                    name: user.name,
                    role: user.role,
                    machine_id: user.machine_id,
                    work_centre_code: user.work_centre_code
                }
            });
        } catch (error) {
            logger.error('Login error:', error);
            res.status(500).json({ success: false, error: 'Internal server error' });
        }
    }
}

module.exports = new AuthController();
