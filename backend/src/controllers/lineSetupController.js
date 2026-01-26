const db = require('../../config/database');
const logger = require('../utils/logger');

class LineSetupController {
  // Get all line setups
  async getAll(req, res) {
    try {
      const [rows] = await db.execute(`
        SELECT
          ls.*,
          e.name as employee_name,
          wc.name as work_centre_name,
          mc.name as machine_centre_name
        FROM line_setup ls
        LEFT JOIN employees e ON ls.employee_id = e.id
        LEFT JOIN work_centres wc ON ls.work_centre_id = wc.id
        LEFT JOIN machine_centres mc ON ls.machine_centre_id = mc.id
        ORDER BY ls.login_date_time DESC
      `);

      res.json({ success: true, data: rows });
    } catch (error) {
      logger.error('Error getting line setups:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Get single line setup
  async getById(req, res) {
    try {
      const { id } = req.params;

      const [rows] = await db.execute(`
        SELECT
          ls.*,
          e.name as employee_name,
          wc.name as work_centre_name,
          mc.name as machine_centre_name
        FROM line_setup ls
        LEFT JOIN employees e ON ls.employee_id = e.id
        LEFT JOIN work_centres wc ON ls.work_centre_id = wc.id
        LEFT JOIN machine_centres mc ON ls.machine_centre_id = mc.id
        WHERE ls.id = ?
      `, [id]);

      if (rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Line setup not found' });
      }

      res.json({ success: true, data: rows[0] });
    } catch (error) {
      logger.error('Error getting line setup by id:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Create line setup
  async create(req, res) {
    try {
      const {
        employee_id,
        machine_id,
        login_date_time,
        work_centre_id,
        machine_centre_id,
        smv_per_pair
      } = req.body;

      if (!employee_id || !machine_id || !login_date_time || !work_centre_id || !machine_centre_id || !smv_per_pair) {
        return res.status(400).json({
          success: false,
          error: 'Required fields are missing'
        });
      }

      const [result] = await db.execute(
        `INSERT INTO line_setup
        (employee_id, machine_id, login_date_time, work_centre_id, machine_centre_id, smv_per_pair)
        VALUES (?, ?, ?, ?, ?, ?)`,
        [employee_id, machine_id, login_date_time, work_centre_id, machine_centre_id, smv_per_pair]
      );

      res.status(201).json({
        success: true,
        data: { id: result.insertId }
      });
    } catch (error) {
      logger.error('Error creating line setup:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Create shift start (mobile)
  async createShift(req, res) {
    try {
      const {
        login,
        employee_id,
        machine_id,
        login_date_time,
        work_centre
      } = req.body;

      if (!login || !employee_id || !machine_id || !login_date_time || !work_centre) {
        return res.status(400).json({
          success: false,
          error: 'Required fields are missing'
        });
      }

      // Lookup employee by code (assuming employee_id is code)
      const [employeeRows] = await db.execute(
        'SELECT id FROM employees WHERE code = ?',
        [employee_id]
      );

      if (employeeRows.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Employee not found'
        });
      }

      const employeeId = employeeRows[0].id;

      // Lookup work centre by name
      const [workCentreRows] = await db.execute(
        'SELECT id FROM work_centres WHERE name = ?',
        [work_centre]
      );

      if (workCentreRows.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Work centre not found'
        });
      }

      const workCentreId = workCentreRows[0].id;

      // For simplicity, assume machine_centre_id = work_centre_id, smv_per_pair = 1.0
      const [result] = await db.execute(
        `INSERT INTO line_setup
        (employee_id, machine_id, login_date_time, work_centre_id, machine_centre_id, smv_per_pair)
        VALUES (?, ?, ?, ?, ?, ?)`,
        [employeeId, machine_id, login_date_time, workCentreId, workCentreId, 1.0]
      );

      res.status(201).json({
        success: true,
        data: { id: result.insertId }
      });
    } catch (error) {
      logger.error('Error creating shift start:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Update line setup
  async update(req, res) {
    try {
      const { id } = req.params;
      const {
        employee_id,
        machine_id,
        login_date_time,
        work_centre_id,
        machine_centre_id,
        smv_per_pair,
        logout_date_time
      } = req.body;

      if (!employee_id || !machine_id || !login_date_time || !work_centre_id || !machine_centre_id || !smv_per_pair) {
        return res.status(400).json({
          success: false,
          error: 'Required fields are missing'
        });
      }

      const [result] = await db.execute(
        `UPDATE line_setup
        SET employee_id = ?, machine_id = ?, login_date_time = ?, work_centre_id = ?,
            machine_centre_id = ?, smv_per_pair = ?, logout_date_time = ?
        WHERE id = ?`,
        [employee_id, machine_id, login_date_time, work_centre_id, machine_centre_id, smv_per_pair, logout_date_time || null, id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, error: 'Line setup not found' });
      }

      res.json({ success: true, data: { id } });
    } catch (error) {
      logger.error('Error updating line setup:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Delete line setup
  async delete(req, res) {
    try {
      const { id } = req.params;
      const [result] = await db.execute(
        'DELETE FROM line_setup WHERE id = ?',
        [id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, error: 'Line setup not found' });
      }

      res.json({ success: true, message: 'Line setup deleted successfully' });
    } catch (error) {
      logger.error('Error deleting line setup:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = new LineSetupController();