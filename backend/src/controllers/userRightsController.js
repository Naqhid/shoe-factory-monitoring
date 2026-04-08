const db = require('../../config/database');
const logger = require('../utils/logger');
const { withTransaction, assertExists } = require('../utils/transaction');

class UserRightsController {
  // Get all user rights with user and form details
  async getAll(req, res) {
    try {
      const [rows] = await db.execute(`
        SELECT 
          ur.*,
          u.name as user_name,
          u.code as user_code,
          f.name as form_name,
          f.code as form_code
        FROM user_rights ur
        LEFT JOIN users u ON ur.user_id = u.id
        LEFT JOIN forms_master f ON ur.form_id = f.id
        ORDER BY u.name, f.name
      `);
      
      res.json({ success: true, data: rows });
    } catch (error) {
      logger.error('Error getting user rights:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Get user rights by user ID
  async getByUserId(req, res) {
    try {
      const { userId } = req.params;
      
      const [rows] = await db.execute(`
        SELECT 
          ur.*,
          u.name as user_name,
          u.code as user_code,
          f.name as form_name,
          f.code as form_code
        FROM user_rights ur
        LEFT JOIN users u ON ur.user_id = u.id
        LEFT JOIN forms_master f ON ur.form_id = f.id
        WHERE ur.user_id = ?
        ORDER BY f.name
      `, [userId]);
      
      res.json({ success: true, data: rows });
    } catch (error) {
      logger.error('Error getting user rights by user id:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Create user right
  async create(req, res) {
    try {
      const { user_id, form_id, read_permission, write_permission } = req.body;
      if (!user_id || !form_id) {
        return res.status(400).json({ success: false, error: 'User ID and Form ID are required' });
      }

      const result = await withTransaction(async (conn) => {
        await assertExists(conn, 'users', user_id, 'User');
        await assertExists(conn, 'forms_master', form_id, 'Form');
        const [r] = await conn.execute(
          `INSERT INTO user_rights (user_id, form_id, read_permission, write_permission) 
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE read_permission = ?, write_permission = ?`,
          [user_id, form_id, read_permission || false, write_permission || false,
           read_permission || false, write_permission || false]
        );
        return { id: r.insertId };
      });

      res.status(201).json({ success: true, data: result });
    } catch (error) {
      logger.error('Error creating user right:', error);
      res.status(error.status || 500).json({ success: false, error: error.message });
    }
  }

  // Update user right
  async update(req, res) {
    try {
      const { id } = req.params;
      const { read_permission, write_permission } = req.body;

      await withTransaction(async (conn) => {
        await assertExists(conn, 'user_rights', id, 'User right');
        await conn.execute(
          `UPDATE user_rights SET read_permission = ?, write_permission = ? WHERE id = ?`,
          [read_permission || false, write_permission || false, id]
        );
      });

      res.json({ success: true, data: { id } });
    } catch (error) {
      logger.error('Error updating user right:', error);
      res.status(error.status || 500).json({ success: false, error: error.message });
    }
  }

  // Delete user right by ID
  async delete(req, res) {
    try {
      const { id } = req.params;
      await withTransaction(async (conn) => {
        const [r] = await conn.execute('DELETE FROM user_rights WHERE id = ?', [id]);
        if (r.affectedRows === 0) throw Object.assign(new Error('User right not found'), { status: 404 });
      });
      res.json({ success: true, message: 'User right deleted successfully' });
    } catch (error) {
      logger.error('Error deleting user right:', error);
      res.status(error.status || 500).json({ success: false, error: error.message });
    }
  }

  // Delete all user rights for a specific user — atomic bulk delete
  async deleteByUserId(req, res) {
    try {
      const { userId } = req.params;
      const result = await withTransaction(async (conn) => {
        await assertExists(conn, 'users', userId, 'User');
        const [r] = await conn.execute('DELETE FROM user_rights WHERE user_id = ?', [userId]);
        return r.affectedRows;
      });
      res.json({ success: true, message: `Deleted ${result} user right(s)` });
    } catch (error) {
      logger.error('Error deleting user rights by user id:', error);
      res.status(error.status || 500).json({ success: false, error: error.message });
    }
  }
}

module.exports = new UserRightsController();
