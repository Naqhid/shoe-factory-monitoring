const db = require('../../config/database');
const logger = require('../utils/logger');
const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'prodpulse_jwt_secret_key_2026';
const ACCESS_EXPIRES = process.env.JWT_EXPIRES_IN || '30m';
const REFRESH_EXPIRES = '1d';

const signAccess = (payload) => jwt.sign(payload, SECRET, { expiresIn: ACCESS_EXPIRES });
const signRefresh = (payload) => jwt.sign(payload, SECRET + '_refresh', { expiresIn: REFRESH_EXPIRES });

class AuthController {
    async login(req, res) {
        const startTime = Date.now();
        try {
            const { login, password } = req.body;
            if (!login || !password) {
                return res.status(400).json({ success: false, message: 'Login and password are required' });
            }

            const [rows] = await db.execute(
                `SELECT u.id, u.code, u.name, u.role, u.machine_id, u.work_centre_id, wc.code as work_centre_code, wc.name as work_centre_name 
                 FROM users u 
                 LEFT JOIN work_centres wc ON u.work_centre_id = wc.id 
                 WHERE u.code = ? AND u.password = ?`,
                [login, password]
            );

            logger.info(`Login query took ${Date.now() - startTime}ms`);

            if (rows.length === 0) {
                return res.status(401).json({ success: false, message: 'Invalid credentials' });
            }

            const user = rows[0];
            const payload = { id: user.id, code: user.code, name: user.name, role: user.role };

            res.json({
                success: true,
                token: signAccess(payload),
                refreshToken: signRefresh(payload),
                data: {
                    id: user.id, code: user.code, name: user.name, role: user.role,
                    machine_id: user.machine_id, work_centre_id: user.work_centre_id,
                    work_centre_code: user.work_centre_code, work_centre_name: user.work_centre_name
                }
            });
        } catch (error) {
            logger.error(`Login error:`, error);
            let message = 'Internal server error';
            if (error.code === 'ECONNREFUSED') message = 'Database connection refused.';
            else if (error.code === 'ETIMEDOUT') message = 'Database connection timeout.';
            res.status(500).json({ success: false, message });
        }
    }

    async refresh(req, res) {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(401).json({ success: false, message: 'Refresh token required' });
        }
        try {
            const payload = jwt.verify(refreshToken, SECRET + '_refresh');
            const newPayload = { id: payload.id, code: payload.code, name: payload.name, role: payload.role };
            res.json({
                success: true,
                token: signAccess(newPayload),
                refreshToken: signRefresh(newPayload),
            });
        } catch (err) {
            return res.status(401).json({ success: false, message: 'Refresh token expired or invalid' });
        }
    }
}

module.exports = new AuthController();
