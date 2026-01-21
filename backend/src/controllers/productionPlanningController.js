const db = require('../../config/database');
const logger = require('../utils/logger');

class ProductionPlanningController {
  // Get all production plans
  async getAll(req, res) {
    try {
      const [rows] = await db.execute(`
        SELECT 
          pp.*,
          s.name as style_name,
          c.name as customer_name,
          g.name as group_name,
          l.name as leather_name,
          col.name as color_name
        FROM production_plan pp
        LEFT JOIN styles s ON pp.style_id = s.id
        LEFT JOIN customers c ON pp.customer_id = c.id
        LEFT JOIN groups_master g ON pp.group_id = g.id
        LEFT JOIN leather l ON pp.leather_id = l.id
        LEFT JOIN colors col ON pp.color_id = col.id
        ORDER BY pp.plan_date DESC
      `);
      
      res.json({ success: true, data: rows });
    } catch (error) {
      logger.error('Error getting production plans:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Get single production plan
  async getById(req, res) {
    try {
      const { id } = req.params;
      
      const [rows] = await db.execute(`
        SELECT 
          pp.*,
          s.name as style_name,
          c.name as customer_name,
          g.name as group_name,
          l.name as leather_name,
          col.name as color_name
        FROM production_plan pp
        LEFT JOIN styles s ON pp.style_id = s.id
        LEFT JOIN customers c ON pp.customer_id = c.id
        LEFT JOIN groups_master g ON pp.group_id = g.id
        LEFT JOIN leather l ON pp.leather_id = l.id
        LEFT JOIN colors col ON pp.color_id = col.id
        WHERE pp.id = ?
      `, [id]);
      
      if (rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Plan not found' });
      }
      
      res.json({ success: true, data: rows[0] });
    } catch (error) {
      logger.error('Error getting production plan by id:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Create production plan
  async create(req, res) {
    try {
      const {
        plan_date,
        style_id,
        customer_id,
        group_id,
        leather_id,
        color_id,
        work_centre,
        target_per_day
      } = req.body;

      if (!plan_date || !style_id || !customer_id || !work_centre || !target_per_day) {
        return res.status(400).json({ 
          success: false, 
          error: 'Required fields are missing' 
        });
      }

      const [result] = await db.execute(
        `INSERT INTO production_plan 
        (plan_date, style_id, customer_id, group_id, leather_id, color_id, production_line, target_per_day) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [plan_date, style_id, customer_id, group_id, leather_id, color_id, work_centre, target_per_day]
      );

      res.status(201).json({ 
        success: true, 
        data: { id: result.insertId } 
      });
    } catch (error) {
      logger.error('Error creating production plan:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Update production plan
  async update(req, res) {
    try {
      const { id } = req.params;
      const {
        plan_date,
        style_id,
        customer_id,
        group_id,
        leather_id,
        color_id,
        work_centre,
        target_per_day
      } = req.body;

      if (!plan_date || !style_id || !customer_id || !work_centre || !target_per_day) {
        return res.status(400).json({ 
          success: false, 
          error: 'Required fields are missing' 
        });
      }

      const [result] = await db.execute(
        `UPDATE production_plan 
        SET plan_date = ?, style_id = ?, customer_id = ?, group_id = ?, 
            leather_id = ?, color_id = ?, production_line = ?, target_per_day = ?
        WHERE id = ?`,
        [plan_date, style_id, customer_id, group_id, leather_id, color_id, work_centre, target_per_day, id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, error: 'Plan not found' });
      }

      res.json({ success: true, data: { id } });
    } catch (error) {
      logger.error('Error updating production plan:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Delete production plan
  async delete(req, res) {
    try {
      const { id } = req.params;
      const [result] = await db.execute(
        'DELETE FROM production_plan WHERE id = ?',
        [id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, error: 'Plan not found' });
      }

      res.json({ success: true, message: 'Plan deleted successfully' });
    } catch (error) {
      logger.error('Error deleting production plan:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = new ProductionPlanningController();
