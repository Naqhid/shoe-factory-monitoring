const db = require('../../config/database');
const logger = require('../utils/logger');
const jwt = require('jsonwebtoken');
const { hashPassword, verifyPassword } = require('../utils/password');
const permissionService = require('../services/permissionService');

const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
    throw new Error('JWT_SECRET is required');
}
const ACCESS_EXPIRES = process.env.JWT_EXPIRES_IN || '8h';
const REFRESH_EXPIRES = '7d';

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

            // Fetch user by code only — compare password separately (supports hashed + legacy)
            const [rows] = await db.execute(
                `SELECT u.id, u.code, u.name, u.role, u.password, u.machine_id, u.work_centre_id,
                        wc.code as work_centre_code, wc.name as work_centre_name 
                 FROM users u 
                 LEFT JOIN work_centres wc ON u.work_centre_id = wc.id 
                 WHERE u.code = ?`,
                [login]
            );

            logger.info(`Login query took ${Date.now() - startTime}ms`);

            if (rows.length === 0 || !verifyPassword(password, rows[0].password)) {
                return res.status(401).json({ success: false, message: 'Invalid credentials' });
            }

            const user = rows[0];

            // Auto-upgrade legacy plaintext password to hashed on successful login
            if (!user.password.includes(':')) {
                const hashed = hashPassword(password);
                await db.execute('UPDATE users SET password = ? WHERE id = ?', [hashed, user.id]);
                logger.info(`Auto-upgraded password hash for user ${user.code}`);
            }

            const payload = { id: user.id, code: user.code, name: user.name, role: user.role };
            const permissions = await permissionService.getPermissionsForUser({
                role: user.role,
                code: user.code,
                name: user.name,
            });

            res.json({
                success: true,
                token: signAccess(payload),
                refreshToken: signRefresh(payload),
                data: {
                    id: user.id, code: user.code, name: user.name, role: user.role,
                    machine_id: user.machine_id, work_centre_id: user.work_centre_id,
                    work_centre_code: user.work_centre_code, work_centre_name: user.work_centre_name,
                    effective_role: permissions.effective_role,
                    default_route: permissions.default_route,
                    allowed_menus: permissions.allowed_menus,
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

    async session(req, res) {
        try {
            const [rows] = await db.execute(
                `SELECT u.id, u.code, u.name, u.role, u.machine_id, u.work_centre_id,
                        wc.code as work_centre_code, wc.name as work_centre_name
                 FROM users u
                 LEFT JOIN work_centres wc ON u.work_centre_id = wc.id
                 WHERE u.id = ?`,
                [req.user.id]
            );
            if (!rows.length) {
                return res.status(404).json({ success: false, message: 'User not found' });
            }
            const user = rows[0];
            const permissions = await permissionService.getPermissionsForUser({
                role: user.role,
                code: user.code,
                name: user.name,
            });
            return res.json({
                success: true,
                data: {
                    id: user.id, code: user.code, name: user.name, role: user.role,
                    machine_id: user.machine_id, work_centre_id: user.work_centre_id,
                    work_centre_code: user.work_centre_code, work_centre_name: user.work_centre_name,
                    effective_role: permissions.effective_role,
                    default_route: permissions.default_route,
                    allowed_menus: permissions.allowed_menus,
                },
            });
        } catch (error) {
            logger.error('Session permissions error:', error);
            return res.status(500).json({ success: false, message: 'Internal server error' });
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

    // Change password — requires current password verification
    async changePassword(req, res) {
        try {
            const { current_password, new_password } = req.body;
            const userId = req.user.id;

            if (!current_password || !new_password) {
                return res.status(400).json({ success: false, message: 'current_password and new_password are required' });
            }
            if (new_password.length < 6) {
                return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
            }

            const [rows] = await db.execute('SELECT password FROM users WHERE id = ?', [userId]);
            if (rows.length === 0) return res.status(404).json({ success: false, message: 'User not found' });

            if (!verifyPassword(current_password, rows[0].password)) {
                return res.status(401).json({ success: false, message: 'Current password is incorrect' });
            }

            const hashed = hashPassword(new_password);
            await db.execute('UPDATE users SET password = ? WHERE id = ?', [hashed, userId]);
            logger.info(`Password changed for user id=${userId}`);

            res.json({ success: true, message: 'Password changed successfully' });
        } catch (error) {
            logger.error('Change password error:', error);
            res.status(500).json({ success: false, message: 'Internal server error' });
        }
    }

    // Admin: reset any user's password (role=admin only)
    async resetPassword(req, res) {
        try {
            const role = String(req.user?.role || '').toLowerCase();
            if (role !== 'admin') {
                return res.status(403).json({ success: false, message: 'Admin access required' });
            }
            const { userId } = req.params;
            const { new_password } = req.body;
            if (!new_password || new_password.length < 6) {
                return res.status(400).json({ success: false, message: 'new_password must be at least 6 characters' });
            }
            const hashed = hashPassword(new_password);
            const [r] = await db.execute('UPDATE users SET password = ? WHERE id = ?', [hashed, userId]);
            if (r.affectedRows === 0) return res.status(404).json({ success: false, message: 'User not found' });
            logger.info(`Admin reset password for user id=${userId}`);
            res.json({ success: true, message: 'Password reset successfully' });
        } catch (error) {
            logger.error('Reset password error:', error);
            res.status(500).json({ success: false, message: 'Internal server error' });
        }
    }
}

module.exports = new AuthController();
