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
                'SELECT id, code, name, role, email FROM users WHERE (code = ? OR email = ?) AND password = ?',
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
                    name: user.name,
                    role: user.role
                }
            });
        } catch (error) {
            logger.error('Login error:', error);
            res.status(500).json({ success: false, error: 'Internal server error' });
        }
    }
}

module.exports = new AuthController();
