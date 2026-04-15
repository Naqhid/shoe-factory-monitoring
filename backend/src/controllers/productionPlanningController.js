const db = require('../../config/database');
const logger = require('../utils/logger');
const { withTransaction, assertExists } = require('../utils/transaction');

class ProductionPlanningController {
  // Get all production plans
  async getAll(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;

      const [rows] = await db.query(`
        SELECT 
          pp.*,
          s.name as style_name,
          c.name as customer_name,
          g.name as group_name,
          l.name as leather_name,
          col.name as color_name,
          wc.name as work_centre_name
        FROM production_plan pp
        LEFT JOIN styles s ON pp.style_id = s.id
        LEFT JOIN customers c ON pp.customer_id = c.id
        LEFT JOIN groups_master g ON pp.group_id = g.id
        LEFT JOIN leather l ON pp.leather_id = l.id
        LEFT JOIN colors col ON pp.color_id = col.id
        LEFT JOIN work_centres wc ON pp.work_centre_id = wc.id
        ORDER BY pp.plan_date DESC
        LIMIT ? OFFSET ?
      `, [limit, offset]);

      const [countResult] = await db.query('SELECT COUNT(*) as total FROM production_plan');
      const total = countResult[0].total;

      res.json({ 
        success: true, 
        data: rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      });
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
          col.name as color_name,
          wc.name as work_centre_name
        FROM production_plan pp
        LEFT JOIN styles s ON pp.style_id = s.id
        LEFT JOIN customers c ON pp.customer_id = c.id
        LEFT JOIN groups_master g ON pp.group_id = g.id
        LEFT JOIN leather l ON pp.leather_id = l.id
        LEFT JOIN colors col ON pp.color_id = col.id
        LEFT JOIN work_centres wc ON pp.work_centre_id = wc.id
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
      const { plan_date, style_id, customer_id, group_id, leather_id, color_id,
              work_centre_id, total_target_per_day, target_pairs_per_tray,
              tray_count, man_hours_minutes, smv_per_pair } = req.body;

      if (!plan_date || !style_id || !customer_id || !work_centre_id ||
          !total_target_per_day || !target_pairs_per_tray || !man_hours_minutes || !smv_per_pair) {
        return res.status(400).json({ success: false, error: 'Required fields are missing' });
      }

      const result = await withTransaction(async (conn) => {
        // Integrity checks
        await assertExists(conn, 'styles', style_id, 'Style');
        await assertExists(conn, 'customers', customer_id, 'Customer');
        await assertExists(conn, 'work_centres', work_centre_id, 'Work centre');

        const [routingRows] = await conn.execute(
          'SELECT id FROM production_routing_header WHERE style_id = ? LIMIT 1',
          [style_id]
        );
        if (routingRows.length === 0) {
          throw Object.assign(
            new Error('No production routing found for the selected style. Please create a routing first.'),
            { status: 422 }
          );
        }

        // Prevent duplicate plan for same date + work centre
        const [dupCheck] = await conn.execute(
          'SELECT id FROM production_plan WHERE plan_date = ? AND work_centre_id = ? LIMIT 1',
          [plan_date, work_centre_id]
        );
        if (dupCheck.length > 0) {
          throw Object.assign(
            new Error('A production plan already exists for this date and work centre. Please edit the existing plan.'),
            { status: 409 }
          );
        }

        const [r] = await conn.execute(
          `INSERT INTO production_plan 
          (plan_date, style_id, customer_id, group_id, leather_id, color_id, work_centre_id,
           total_target_per_day, target_pairs_per_tray, tray_count, man_hours_minutes, smv_per_pair) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [plan_date, style_id, customer_id, group_id || null, leather_id || null, color_id || null,
           work_centre_id, total_target_per_day, target_pairs_per_tray, tray_count || 0, man_hours_minutes, smv_per_pair]
        );
        return { id: r.insertId };
      });

      res.status(201).json({ success: true, data: result });
    } catch (error) {
      logger.error('Error creating production plan:', error);
      res.status(error.status || 500).json({ success: false, error: error.message });
    }
  }

  // Update production plan
  async update(req, res) {
    try {
      const { id } = req.params;
      const { plan_date, style_id, customer_id, group_id, leather_id, color_id,
              work_centre_id, total_target_per_day, target_pairs_per_tray,
              tray_count, man_hours_minutes, smv_per_pair } = req.body;

      if (!plan_date || !style_id || !customer_id || !work_centre_id ||
          !total_target_per_day || !target_pairs_per_tray || !man_hours_minutes || !smv_per_pair) {
        return res.status(400).json({ success: false, error: 'Required fields are missing' });
      }

      await withTransaction(async (conn) => {
        await assertExists(conn, 'production_plan', id, 'Plan');
        await assertExists(conn, 'styles', style_id, 'Style');
        await assertExists(conn, 'customers', customer_id, 'Customer');
        await assertExists(conn, 'work_centres', work_centre_id, 'Work centre');

        const [routingRows] = await conn.execute(
          'SELECT id FROM production_routing_header WHERE style_id = ? LIMIT 1',
          [style_id]
        );
        if (routingRows.length === 0) {
          throw Object.assign(
            new Error('No production routing found for the selected style. Please create a routing first.'),
            { status: 422 }
          );
        }

        // Prevent duplicate plan for same date + work centre (exclude current record)
        const [dupCheck] = await conn.execute(
          'SELECT id FROM production_plan WHERE plan_date = ? AND work_centre_id = ? AND id != ? LIMIT 1',
          [plan_date, work_centre_id, id]
        );
        if (dupCheck.length > 0) {
          throw Object.assign(
            new Error('A production plan already exists for this date and work centre. Please edit the existing plan.'),
            { status: 409 }
          );
        }

        const [r] = await conn.execute(
          `UPDATE production_plan 
          SET plan_date = ?, style_id = ?, customer_id = ?, group_id = ?,
              leather_id = ?, color_id = ?, work_centre_id = ?, total_target_per_day = ?,
              target_pairs_per_tray = ?, tray_count = ?, man_hours_minutes = ?, smv_per_pair = ?
          WHERE id = ?`,
          [plan_date, style_id, customer_id, group_id || null, leather_id || null, color_id || null,
           work_centre_id, total_target_per_day, target_pairs_per_tray, tray_count || 0,
           man_hours_minutes, smv_per_pair, id]
        );
        if (r.affectedRows === 0) throw Object.assign(new Error('Plan not found'), { status: 404 });
      });

      res.json({ success: true, data: { id } });
    } catch (error) {
      logger.error('Error updating production plan:', error);
      res.status(error.status || 500).json({ success: false, error: error.message });
    }
  }

  // Delete production plan
  async delete(req, res) {
    try {
      const { id } = req.params;

      await withTransaction(async (conn) => {
        await assertExists(conn, 'production_plan', id, 'Plan');
        await conn.execute('DELETE FROM production_plan WHERE id = ?', [id]);
      });

      res.json({ success: true, message: 'Plan deleted successfully' });
    } catch (error) {
      logger.error('Error deleting production plan:', error);
      res.status(error.status || 500).json({ success: false, error: error.message });
    }
  }
}

module.exports = new ProductionPlanningController();
