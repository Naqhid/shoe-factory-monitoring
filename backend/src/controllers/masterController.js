const db = require('../../config/database');
const logger = require('../utils/logger');

class MasterController {
  // Whitelist of allowed table names to prevent SQL injection
  static ALLOWED_TABLES = {
    'customers': 'customers',
    'groups_master': 'groups_master', 
    'leather': 'leather',
    'styles': 'styles',
    'colors': 'colors',
    'work_centres': 'work_centres',
    'machine_centres': 'machine_centres',
    'employees': 'employees',
    'users': 'users',
    'forms_master': 'forms_master'
  };

  validateTable(table) {
    if (!MasterController.ALLOWED_TABLES[table]) {
      throw new Error(`Invalid table name: ${table}`);
    }
    return MasterController.ALLOWED_TABLES[table];
  }

  // Generic CRUD operations for all master tables
  async getAll(req, res) {
    try {
      const table = this.validateTable(req.params.table);
      let rows;

      if (table === 'machine_centres') {
        [rows] = await db.execute(
          `SELECT mc.*, wc.name as work_centre_name 
           FROM ${table} mc 
           LEFT JOIN work_centres wc ON mc.work_centre_id = wc.id 
           ORDER BY mc.code`
        );
      } else if (table === 'users') {
        [rows] = await db.execute(
          `SELECT u.*, wc.name as work_centre_name 
           FROM users u 
           LEFT JOIN work_centres wc ON u.work_centre_id = wc.id 
           ORDER BY u.code`
        );
      } else if (table === 'employees') {
        [rows] = await db.execute(
          `SELECT e.*, wc.name as work_centre_name, mc.name as machine_centre_name 
           FROM employees e 
           LEFT JOIN work_centres wc ON e.work_centre_id = wc.id 
           LEFT JOIN machine_centres mc ON e.machine_centre_id = mc.id 
           ORDER BY e.code`
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
      const table = this.validateTable(req.params.table);
      const { id } = req.params;
      let query;

      if (table === 'machine_centres') {
        query = `SELECT mc.*, wc.name as work_centre_name 
                 FROM machine_centres mc 
                 LEFT JOIN work_centres wc ON mc.work_centre_id = wc.id 
                 WHERE mc.id = ?`;
      } else if (table === 'users') {
        query = `SELECT u.*, wc.name as work_centre_name 
                 FROM users u 
                 LEFT JOIN work_centres wc ON u.work_centre_id = wc.id 
                 WHERE u.id = ?`;
      } else if (table === 'employees') {
        query = `SELECT e.*, wc.name as work_centre_name, mc.name as machine_centre_name 
                 FROM employees e 
                 LEFT JOIN work_centres wc ON e.work_centre_id = wc.id 
                 LEFT JOIN machine_centres mc ON e.machine_centre_id = mc.id 
                 WHERE e.id = ?`;
      } else {
        query = `SELECT * FROM ${table} WHERE id = ?`;
      }

      const [rows] = await db.execute(query, [id]);
      if (rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Record not found' });
      }
      res.json({ success: true, data: rows[0] });
    } catch (error) {
      logger.error(`Error getting ${req.params.table} by id:`, error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getByCode(req, res) {
    try {
      const table = this.validateTable(req.params.table);
      const { code } = req.params;
      let query;
      let params = [code];

      if (table === 'machine_centres') {
        query = `SELECT mc.*, wc.name as work_centre_name 
                 FROM machine_centres mc 
                 LEFT JOIN work_centres wc ON mc.work_centre_id = wc.id 
                 WHERE mc.code = ? OR mc.machine_id = ?`;
        params = [code, code];
      } else if (table === 'users') {
        query = `SELECT u.*, wc.name as work_centre_name 
                 FROM users u 
                 LEFT JOIN work_centres wc ON u.work_centre_id = wc.id 
                 WHERE u.code = ?`;
      } else if (table === 'employees') {
        query = `SELECT e.*, wc.name as work_centre_name, mc.name as machine_centre_name 
                 FROM employees e 
                 LEFT JOIN work_centres wc ON e.work_centre_id = wc.id 
                 LEFT JOIN machine_centres mc ON e.machine_centre_id = mc.id 
                 WHERE e.code = ?`;
      } else {
        query = `SELECT * FROM ${table} WHERE code = ?`;
      }

      const [rows] = await db.execute(query, params);
      if (rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Record not found' });
      }
      res.json({ success: true, data: rows[0] });
    } catch (error) {
      logger.error(`Error getting ${req.params.table} by code:`, error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async create(req, res) {
    try {
      const table = this.validateTable(req.params.table);
      const data = req.body;

      if (table === 'users') {
        const { code, name, email, password, role, work_centre_id } = data;
        if (!code || !name || !password) {
          return res.status(400).json({ success: false, error: 'Code, name and password are required' });
        }
        const [result] = await db.execute(
          `INSERT INTO users (code, name, email, password, role, work_centre_id) VALUES (?, ?, ?, ?, ?, ?)`,
          [code, name, email || null, password, role || 'user', work_centre_id || null]
        );
        return res.status(201).json({ success: true, data: { id: result.insertId } });
      }

      if (table === 'employees') {
        const { code, name, work_centre_id, machine_centre_id } = data;
        if (!code || !name) {
          return res.status(400).json({ success: false, error: 'Code and name are required' });
        }
        const [result] = await db.execute(
          `INSERT INTO employees (code, name, work_centre_id, machine_centre_id) VALUES (?, ?, ?, ?)`,
          [code, name, work_centre_id || null, machine_centre_id || null]
        );
        return res.status(201).json({ success: true, data: { id: result.insertId } });
      }

      // Generic create for other tables
      const { code, name, work_centre_id, machine_id } = data;

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
      const table = this.validateTable(req.params.table);
      const { id } = req.params;
      const data = req.body;

      if (table === 'users') {
        const { code, name, email, password, role, work_centre_id } = data;
        if (!code || !name) {
          return res.status(400).json({ success: false, error: 'Code and name are required' });
        }
        let query = `UPDATE users SET code = ?, name = ?, email = ?, role = ?, work_centre_id = ?`;
        let params = [code, name, email || null, role || 'user', work_centre_id || null];
        if (password) {
          query += `, password = ?`;
          params.push(password);
        }
        query += ` WHERE id = ?`;
        params.push(id);
        const [result] = await db.execute(query, params);
        if (result.affectedRows === 0) {
          return res.status(404).json({ success: false, error: 'User not found' });
        }
        return res.json({ success: true, data: { id } });
      }

      if (table === 'employees') {
        const { code, name, work_centre_id, machine_centre_id } = data;
        if (!code || !name) {
          return res.status(400).json({ success: false, error: 'Code and name are required' });
        }
        const [result] = await db.execute(
          `UPDATE employees SET code = ?, name = ?, work_centre_id = ?, machine_centre_id = ? WHERE id = ?`,
          [code, name, work_centre_id || null, machine_centre_id || null, id]
        );
        if (result.affectedRows === 0) {
          return res.status(404).json({ success: false, error: 'Employee not found' });
        }
        return res.json({ success: true, data: { id } });
      }

      // Forms Master - only update name (code is auto-generated and read-only)
      if (table === 'forms_master') {
        const { name } = data;
        if (!name) {
          return res.status(400).json({ success: false, error: 'Name is required' });
        }
        const [result] = await db.execute(
          `UPDATE forms_master SET name = ? WHERE id = ?`,
          [name, id]
        );
        if (result.affectedRows === 0) {
          return res.status(404).json({ success: false, error: 'Form not found' });
        }
        return res.json({ success: true, data: { id } });
      }

      // Generic update for other tables
      const { code, name, work_centre_id, machine_id } = data;

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

  async getByEmpId(req, res) {
    try {
      const { empId } = req.params;
      const query = `SELECT e.*, wc.name as work_centre_name, mc.name as machine_centre_name 
                     FROM employees e 
                     LEFT JOIN work_centres wc ON e.work_centre_id = wc.id 
                     LEFT JOIN machine_centres mc ON e.machine_centre_id = mc.id 
                     WHERE e.code = ?`;
      const [rows] = await db.execute(query, [empId]);
      if (rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Employee not found' });
      }
      res.json({ success: true, data: rows[0] });
    } catch (error) {
      logger.error('Error getting employee by emp_id:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getByMachineId(req, res) {
    try {
      const { machineId } = req.params;
      const query = `SELECT mc.*, wc.name as work_centre_name 
                     FROM machine_centres mc 
                     LEFT JOIN work_centres wc ON mc.work_centre_id = wc.id 
                     WHERE mc.machine_id = ?`;
      const [rows] = await db.execute(query, [machineId]);
      if (rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Machine not found' });
      }
      res.json({ success: true, data: rows[0] });
    } catch (error) {
      logger.error('Error getting machine by machine_id:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async delete(req, res) {
    try {
      const table = this.validateTable(req.params.table);
      const { id } = req.params;
      const [result] = await db.execute(`DELETE FROM ${table} WHERE id = ?`, [id]);

      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, error: 'Record not found' });
      }

      res.json({ success: true, message: 'Record deleted successfully' });
    } catch (error) {
      logger.error(`Error deleting from ${req.params.table}:`, error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = new MasterController();