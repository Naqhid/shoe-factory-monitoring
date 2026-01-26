const db = require('../../config/database');
const logger = require('../utils/logger');

class ProductionRoutingController {
  // Get all production routings with details
  async getAll(req, res) {
    try {
      const [rows] = await db.execute(`
        SELECT 
          prh.*,
          c.name as customer_name,
          g.name as group_name,
          l.name as leather_name,
          s.name as style_name,
          col.name as color_name
        FROM production_routing_header prh
        LEFT JOIN customers c ON prh.customer_id = c.id
        LEFT JOIN groups_master g ON prh.group_id = g.id
        LEFT JOIN leather l ON prh.leather_id = l.id
        LEFT JOIN styles s ON prh.style_id = s.id
        LEFT JOIN colors col ON prh.color_id = col.id
        ORDER BY prh.created_on DESC
      `);
      
      res.json({ success: true, data: rows });
    } catch (error) {
      logger.error('Error getting production routings:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Get single production routing with lines
  async getById(req, res) {
    try {
      const { id } = req.params;
      
      // Get header
      const [headers] = await db.execute(`
        SELECT 
          prh.*,
          c.name as customer_name,
          g.name as group_name,
          l.name as leather_name,
          s.name as style_name,
          col.name as color_name
        FROM production_routing_header prh
        LEFT JOIN customers c ON prh.customer_id = c.id
        LEFT JOIN groups_master g ON prh.group_id = g.id
        LEFT JOIN leather l ON prh.leather_id = l.id
        LEFT JOIN styles s ON prh.style_id = s.id
        LEFT JOIN colors col ON prh.color_id = col.id
        WHERE prh.id = ?
      `, [id]);
      
      if (headers.length === 0) {
        return res.status(404).json({ success: false, error: 'Routing not found' });
      }
      
      // Get lines
      const [lines] = await db.execute(`
        SELECT 
          prl.*,
          wc.name as work_centre_name,
          mc.name as machine_centre_name
        FROM production_routing_lines prl
        LEFT JOIN work_centres wc ON prl.work_centre_id = wc.id
        LEFT JOIN machine_centres mc ON prl.machine_centre_id = mc.id
        WHERE prl.routing_header_id = ?
        ORDER BY prl.id
      `, [id]);
      
      res.json({ 
        success: true, 
        data: {
          header: headers[0],
          lines: lines
        }
      });
    } catch (error) {
      logger.error('Error getting production routing by id:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Create production routing with lines
  async create(req, res) {
    const connection = await db.getConnection();
    
    try {
      await connection.beginTransaction();
      
      const { header, lines } = req.body;
      
      if (!header || !lines || lines.length === 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'Header and at least one line item are required' 
        });
      }
      
      // Insert header
      const [headerResult] = await connection.execute(
        `INSERT INTO production_routing_header 
        (customer_id, group_id, leather_id, style_id, color_id, created_on, category, target_per_day, tot_smv) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          header.customer_id,
          header.group_id,
          header.leather_id,
          header.style_id,
          header.color_id,
          header.created_on,
          header.category,
          header.target_per_day,
          header.tot_smv
        ]
      );
      
      const headerId = headerResult.insertId;
      
      // Insert lines
      for (const line of lines) {
        await connection.execute(
          `INSERT INTO production_routing_lines 
          (routing_header_id, machine_centre_id, observed_time, rating_factor, manpower) 
          VALUES (?, ?, ?, ?, ?)`,
          [
            headerId,
            line.machine_centre_id,
            line.observed_time,
            line.rating_factor,
            line.manpower
          ]
        );
      }
      
      await connection.commit();
      
      res.status(201).json({ 
        success: true, 
        data: { id: headerId } 
      });
    } catch (error) {
      await connection.rollback();
      logger.error('Error creating production routing:', error);
      res.status(500).json({ success: false, error: error.message });
    } finally {
      connection.release();
    }
  }

  // Update production routing
  async update(req, res) {
    const connection = await db.getConnection();
    
    try {
      await connection.beginTransaction();
      
      const { id } = req.params;
      const { header, lines } = req.body;
      
      if (!header || !lines || lines.length === 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'Header and at least one line item are required' 
        });
      }
      
      // Update header
      const [result] = await connection.execute(
        `UPDATE production_routing_header 
        SET customer_id = ?, group_id = ?, leather_id = ?, style_id = ?, color_id = ?, 
            created_on = ?, category = ?, target_per_day = ?, tot_smv = ?
        WHERE id = ?`,
        [
          header.customer_id,
          header.group_id,
          header.leather_id,
          header.style_id,
          header.color_id,
          header.created_on,
          header.category,
          header.target_per_day,
          header.tot_smv,
          id
        ]
      );
      
      if (result.affectedRows === 0) {
        await connection.rollback();
        return res.status(404).json({ success: false, error: 'Routing not found' });
      }
      
      // Delete existing lines
      await connection.execute(
        'DELETE FROM production_routing_lines WHERE routing_header_id = ?',
        [id]
      );
      
      // Insert new lines
      for (const line of lines) {
        await connection.execute(
          `INSERT INTO production_routing_lines 
          (routing_header_id, work_centre_id, machine_centre_id, observed_time, rating_factor, manpower) 
          VALUES (?, ?, ?, ?, ?, ?)`,
          [
            id,
            line.work_centre_id,
            line.machine_centre_id,
            line.observed_time,
            line.rating_factor,
            line.manpower
          ]
        );
      }
      
      await connection.commit();
      
      res.json({ success: true, data: { id } });
    } catch (error) {
      await connection.rollback();
      logger.error('Error updating production routing:', error);
      res.status(500).json({ success: false, error: error.message });
    } finally {
      connection.release();
    }
  }

  // Delete production routing
  async delete(req, res) {
    try {
      const { id } = req.params;
      const [result] = await db.execute(
        'DELETE FROM production_routing_header WHERE id = ?',
        [id]
      );
      
      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, error: 'Routing not found' });
      }
      
      res.json({ success: true, message: 'Routing deleted successfully' });
    } catch (error) {
      logger.error('Error deleting production routing:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Get routing by style_id
  async getByStyleId(req, res) {
    try {
      const { styleId } = req.params;
      
      const [rows] = await db.execute(`
        SELECT 
          prh.*,
          c.name as customer_name,
          g.name as group_name,
          l.name as leather_name,
          s.name as style_name,
          col.name as color_name
        FROM production_routing_header prh
        LEFT JOIN customers c ON prh.customer_id = c.id
        LEFT JOIN groups_master g ON prh.group_id = g.id
        LEFT JOIN leather l ON prh.leather_id = l.id
        LEFT JOIN styles s ON prh.style_id = s.id
        LEFT JOIN colors col ON prh.color_id = col.id
        WHERE prh.style_id = ?
        ORDER BY prh.created_on DESC
        LIMIT 1
      `, [styleId]);
      
      if (rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Routing not found for this style' });
      }
      
      res.json({ success: true, data: rows[0] });
    } catch (error) {
      logger.error('Error getting routing by style:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = new ProductionRoutingController();
