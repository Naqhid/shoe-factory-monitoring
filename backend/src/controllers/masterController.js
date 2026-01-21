const db = require('../../config/database');
const logger = require('../utils/logger');

class MasterController {
  // Generic CRUD operations for all master tables
  async getAll(req, res) {
    try {
      const { table } = req.params;
      let rows;
      
      if (table === 'machine_centres') {
        [rows] = await db.execute(
          `SELECT mc.*, wc.name as work_centre_name 
           FROM ${table} mc 
           LEFT JOIN work_centres wc ON mc.work_centre_id = wc.id 
           ORDER BY mc.code`
        );
      } else {
        [rows] = await db.execute(`SELECT * FROM ${table} ORDER BY code`);
      }
      
      res.json({ success: true, data: rows });
    } catch (error) {
      logger.error(`Error getting ${req.params.table}:`, error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getById(req, res) {
    try {
      const { table, id } = req.params;
      const [rows] = await db.execute(`SELECT * FROM ${table} WHERE id = ?`, [id]);
      if (rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Record not found' });
      }
      res.json({ success: true, data: rows[0] });
    } catch (error) {
      logger.error(`Error getting ${req.params.table} by id:`, error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async create(req, res) {
    try {
      const { table } = req.params;
      const { code, name, work_centre_id, machine_id } = req.body;

      if (!code || !name) {
        return res.status(400).json({ success: false, error: 'Code and name are required' });
      }

      let result;
      if (table === 'machine_centres' && work_centre_id) {
        [result] = await db.execute(
          `INSERT INTO ${table} (code, name, work_centre_id, machine_id) VALUES (?, ?, ?, ?)`,
          [code, name, work_centre_id, machine_id]
        );
      } else {
        [result] = await db.execute(
          `INSERT INTO ${table} (code, name) VALUES (?, ?)`,
          [code, name]
        );
      }

      res.status(201).json({ 
        success: true, 
        data: { id: result.insertId, code, name, work_centre_id, machine_id } 
      });
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ success: false, error: 'Code already exists' });
      }
      logger.error(`Error creating ${req.params.table}:`, error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async update(req, res) {
    try {
      const { table, id } = req.params;
      const { code, name, work_centre_id, machine_id } = req.body;

      if (!code || !name) {
        return res.status(400).json({ success: false, error: 'Code and name are required' });
      }

      let result;
      if (table === 'machine_centres' && work_centre_id) {
        [result] = await db.execute(
          `UPDATE ${table} SET code = ?, name = ?, work_centre_id = ?, machine_id = ? WHERE id = ?`,
          [code, name, work_centre_id, machine_id, id]
        );
      } else {
        [result] = await db.execute(
          `UPDATE ${table} SET code = ?, name = ? WHERE id = ?`,
          [code, name, id]
        );
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, error: 'Record not found' });
      }

      res.json({ success: true, data: { id, code, name, work_centre_id, machine_id } });
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ success: false, error: 'Code already exists' });
      }
      logger.error(`Error updating ${req.params.table}:`, error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async delete(req, res) {
    try {
      const { table, id } = req.params;
      const [result] = await db.execute(`DELETE FROM ${table} WHERE id = ?`, [id]);

      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, error: 'Record not found' });
      }

      res.json({ success: true, message: 'Record deleted successfully' });
    } catch (error) {
      logger.error(`Error deleting ${req.params.table}:`, error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = new MasterController();