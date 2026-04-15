const db = require('../../config/database');
const logger = require('../utils/logger');

class ProductionRoutingController {
  async ensureUniqueStyle(connection, { styleId, excludeId = null }) {
    const query = excludeId
      ? `SELECT id FROM production_routing_header
         WHERE style_id = ? AND id <> ?
         LIMIT 1`
      : `SELECT id FROM production_routing_header
         WHERE style_id = ?
         LIMIT 1`;
    const params = excludeId ? [styleId, excludeId] : [styleId];
    const [dupRows] = await connection.execute(query, params);
    if (dupRows.length > 0) {
      return 'A routing already exists for this style. Please edit the existing routing.';
    }
    return null;
  }


  validateLines(lines) {
    if (!Array.isArray(lines) || lines.length === 0) return 'At least one line item is required';
    const seenMachineIds = new Set();
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] || {};
      const machineId = String(line.machine_centre_id || '').trim();
      const observedTime = Number(line.observed_time);
      const ratingFactor = Number(line.rating_factor);
      const manpower = Number(line.manpower);
      if (!machineId) return `Line ${i + 1}: machine centre is required`;
      if (seenMachineIds.has(machineId)) return `Line ${i + 1}: duplicate machine centre ${machineId} is not allowed`;
      seenMachineIds.add(machineId);
      if (!Number.isFinite(observedTime) || observedTime <= 0) return `Line ${i + 1}: observed time must be greater than 0`;
      if (!Number.isFinite(ratingFactor) || ratingFactor <= 0 || ratingFactor > 200) return `Line ${i + 1}: rating factor must be between 0 and 200`;
      if (!Number.isFinite(manpower) || manpower <= 0) return `Line ${i + 1}: manpower must be greater than 0`;
    }
    return null;
  }

  async validateMachineCentresExist(connection, lines) {
    const machineIds = Array.from(new Set(lines.map((line) => String(line.machine_centre_id || '').trim()).filter(Boolean)));
    if (machineIds.length === 0) return 'At least one valid machine centre is required';

    const placeholders = machineIds.map(() => '?').join(', ');
    const [rows] = await connection.execute(
      `SELECT machine_id FROM machine_centres WHERE machine_id IN (${placeholders})`,
      machineIds
    );
    const existing = new Set(rows.map((row) => String(row.machine_id)));
    const missing = machineIds.filter((id) => !existing.has(id));
    if (missing.length > 0) return `Invalid machine centre id(s): ${missing.join(', ')}`;
    return null;
  }

  // Get all production routings with details
  async getAll(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;

      const [rows] = await db.query(`
        SELECT 
          prh.*,
          c.name as customer_name,
          g.name as group_name,
          l.name as leather_name,
          s.name as style_name,
          col.name as color_name,
          COUNT(prl.id) as line_count
        FROM production_routing_header prh
        LEFT JOIN customers c ON prh.customer_id = c.id
        LEFT JOIN groups_master g ON prh.group_id = g.id
        LEFT JOIN leather l ON prh.leather_id = l.id
        LEFT JOIN styles s ON prh.style_id = s.id
        LEFT JOIN colors col ON prh.color_id = col.id
        LEFT JOIN production_routing_lines prl ON prl.routing_header_id = prh.id
        GROUP BY prh.id
        ORDER BY prh.created_on DESC
        LIMIT ? OFFSET ?
      `, [limit, offset]);

      const [countResult] = await db.query('SELECT COUNT(*) as total FROM production_routing_header');
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
          mc.name as machine_centre_name
        FROM production_routing_lines prl
        LEFT JOIN machine_centres mc ON prl.machine_centre_id = mc.machine_id
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

      // const lineError = this.validateLines(lines);
      // if (lineError) {
      //   await connection.rollback();
      //   return res.status(400).json({ success: false, error: lineError });
      // }
      // const machineError = await this.validateMachineCentresExist(connection, lines);
      // if (machineError) {
      //   await connection.rollback();
      //   return res.status(400).json({ success: false, error: machineError });
      // }
      // const uniquenessError = await this.ensureUniqueStyle(connection, { styleId: header.style_id });
      // if (uniquenessError) {
      //   await connection.rollback();
      //   return res.status(409).json({ success: false, error: uniquenessError });
      // }
      
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
          (routing_header_id, machine_centre_id, process, observed_time, rating_factor, manpower) 
          VALUES (?, ?, ?, ?, ?, ?)`,
          [headerId, line.machine_centre_id, line.process || null, line.observed_time, line.rating_factor, line.manpower]
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
      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ success: false, error: 'A routing already exists for this style in the selected machine centre. Please edit the existing one or choose a different machine centre.' });
      }
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

      // const lineError = this.validateLines(lines);
      // if (lineError) {
      //   await connection.rollback();
      //   return res.status(400).json({ success: false, error: lineError });
      // }
      // const machineError = await this.validateMachineCentresExist(connection, lines);
      // if (machineError) {
      //   await connection.rollback();
      //   return res.status(400).json({ success: false, error: machineError });
      // }
      // const uniquenessError = await this.ensureUniqueStyle(connection, {
      //   styleId: header.style_id,
      //   excludeId: id
      // });
      // if (uniquenessError) {
      //   await connection.rollback();
      //   return res.status(409).json({ success: false, error: uniquenessError });
      // }
      
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
          (routing_header_id, machine_centre_id, process, observed_time, rating_factor, manpower) 
          VALUES (?, ?, ?, ?, ?, ?)`,
          [id, line.machine_centre_id, line.process || null, line.observed_time, line.rating_factor, line.manpower]
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
      const [headerRows] = await db.execute(
        'SELECT id, style_id, created_on FROM production_routing_header WHERE id = ?',
        [id]
      );
      if (headerRows.length === 0) {
        return res.status(404).json({ success: false, error: 'Routing not found' });
      }
      const header = headerRows[0];

      const [planRefs] = await db.execute(
        'SELECT COUNT(*) as cnt FROM production_plan WHERE style_id = ?',
        [header.style_id]
      );
      if ((planRefs[0]?.cnt || 0) > 0) {
        return res.status(409).json({
          success: false,
          error: 'Cannot delete this routing because it is referenced by production plans. Please keep it for historical consistency.'
        });
      }

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
        ORDER BY prh.id DESC
        LIMIT 1
      `, [styleId]);

      if (rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Routing not found for this style' });
      }

      const [lines] = await db.execute(
        'SELECT observed_time, rating_factor, manpower FROM production_routing_lines WHERE routing_header_id = ?',
        [rows[0].id]
      );

      res.json({ success: true, data: { ...rows[0], lines } });
    } catch (error) {
      logger.error('Error getting routing by style:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Get all masters data in one call (optimized)
  async getMastersData(req, res) {
    try {
      const [customers, groups, leathers, styles, colors, machineCentres] = await Promise.all([
        db.execute('SELECT id, code, name FROM customers ORDER BY name'),
        db.execute('SELECT id, code, name FROM groups_master ORDER BY name'),
        db.execute('SELECT id, code, name FROM leather ORDER BY name'),
        db.execute('SELECT id, code, name FROM styles ORDER BY name'),
        db.execute('SELECT id, code, name FROM colors ORDER BY name'),
        db.execute('SELECT id, code, name, machine_id, machine_name FROM machine_centres ORDER BY machine_id')
      ]);

      res.json({
        success: true,
        data: {
          customers: customers[0],
          groups: groups[0],
          leathers: leathers[0],
          styles: styles[0],
          colors: colors[0],
          machineCentres: machineCentres[0]
        }
      });
    } catch (error) {
      logger.error('Error getting masters data:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = new ProductionRoutingController();
