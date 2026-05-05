const db = require('../../config/database');
const logger = require('../utils/logger');

class ReworkRejectionController {
  validateRow(row) {
    const totalOutput = Number(row.total_output_pairs || 0);
    const reworkQty = Number(row.rework_qty || 0);
    const rejectionQty = Number(row.rejection_qty || 0);
    if (!Number.isFinite(totalOutput) || totalOutput < 0) {
      return 'total_output_pairs must be a non-negative number';
    }
    if (!Number.isFinite(reworkQty) || reworkQty < 0 || !Number.isFinite(rejectionQty) || rejectionQty < 0) {
      return 'rework_qty and rejection_qty must be non-negative numbers';
    }
    if (reworkQty + rejectionQty > totalOutput) {
      return `Rework + rejection (${reworkQty + rejectionQty}) cannot exceed total output (${totalOutput})`;
    }
    if ((reworkQty > 0 || rejectionQty > 0) && (!row.reason_category || !String(row.reason || '').trim())) {
      return 'Reason category and reason are required when rework/rejection is greater than zero';
    }
    return null;
  }

  async getAll(req, res) {
    try {
      const { work_centre_id, date, machine_centre_name } = req.query;
      let query = `SELECT rr.*, wc.name as work_centre_name 
                   FROM rework_rejection rr
                   LEFT JOIN work_centres wc ON rr.work_centre_id = wc.id
                   WHERE 1=1`;
      const params = [];
      if (work_centre_id) { query += ` AND rr.work_centre_id = ?`; params.push(work_centre_id); }
      if (date) { query += ` AND DATE(rr.production_date) = ?`; params.push(date); }
      if (machine_centre_name) { query += ` AND rr.machine_centre_name = ?`; params.push(machine_centre_name); }
      query += ` ORDER BY rr.saved_at DESC`;
      const [rows] = await db.execute(query, params);
      res.json({ success: true, data: rows });
    } catch (error) {
      logger.error('Error fetching rework rejection:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async save(req, res) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const { work_centre_id, production_date, rows } = req.body;
      if (!work_centre_id || !production_date || !Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ success: false, error: 'work_centre_id, production_date and rows are required' });
      }
      for (const row of rows) {
        const validationError = this.validateRow(row);
        if (validationError) {
          await conn.rollback();
          return res.status(400).json({ success: false, error: validationError });
        }
      }

      // Idempotent save: replace existing rows for same work centre + date.
      await conn.execute(
        `DELETE FROM rework_rejection
         WHERE work_centre_id = ? AND DATE(production_date) = DATE(?)`,
        [work_centre_id, production_date]
      );

      for (const row of rows) {
        await conn.execute(
          `INSERT INTO rework_rejection 
           (work_centre_id, production_date, machine_centre_name, total_output_pairs, bins_completed, rework_qty, rejection_qty, reason_category, reason, saved_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [work_centre_id, production_date, row.machine_centre_name, row.total_output_pairs,
           row.bins_completed, row.rework_qty || 0, row.rejection_qty || 0,
           row.reason_category || null, row.reason || null]
        );
      }
      await conn.commit();
      res.json({ success: true });
    } catch (error) {
      await conn.rollback();
      logger.error('Error saving rework rejection:', error);
      res.status(500).json({ success: false, error: error.message });
    } finally {
      conn.release();
    }
  }

  async update(req, res) {
    try {
      const { id } = req.params;
      const { rework_qty, rejection_qty, reason_category, reason } = req.body;
      const [existingRows] = await db.execute(
        `SELECT total_output_pairs FROM rework_rejection WHERE id = ?`,
        [id]
      );
      if (existingRows.length === 0) {
        return res.status(404).json({ success: false, error: 'Record not found' });
      }
      const rowError = this.validateRow({
        total_output_pairs: existingRows[0].total_output_pairs,
        rework_qty,
        rejection_qty,
        reason_category,
        reason
      });
      if (rowError) {
        return res.status(400).json({ success: false, error: rowError });
      }
      const [result] = await db.execute(
        `UPDATE rework_rejection SET rework_qty = ?, rejection_qty = ?, reason_category = ?, reason = ? WHERE id = ?`,
        [rework_qty ?? 0, rejection_qty ?? 0, reason_category || null, reason || null, id]
      );
      if (result.affectedRows === 0) return res.status(404).json({ success: false, error: 'Record not found' });
      res.json({ success: true });
    } catch (error) {
      logger.error('Error updating rework rejection:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async delete(req, res) {
    try {
      const { id } = req.params;
      const [result] = await db.execute(`DELETE FROM rework_rejection WHERE id = ?`, [id]);
      if (result.affectedRows === 0) return res.status(404).json({ success: false, error: 'Record not found' });
      res.json({ success: true });
    } catch (error) {
      logger.error('Error deleting rework rejection:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getCyclesForDate(req, res) {
    try {
      const { date, work_centre_id } = req.query;
      if (!date) return res.status(400).json({ success: false, error: 'date is required' });
      const params = [date];
      let wcFilter = '';
      if (work_centre_id) { wcFilter = ' AND mcp.work_centre_id = ?'; params.push(work_centre_id); }
      const [rows] = await db.execute(
        `SELECT mcp.id, mcp.machine_centre_id, mcp.work_centre_id,
                mc.name as machine_centre_name, mc.machine_id,
                mcp.prod_date, mcp.start_time, mcp.finish_time,
                mcp.total_output_pairs, mcp.bins_completed
         FROM machine_centre_production mcp
         LEFT JOIN machine_centres mc ON mcp.machine_centre_id = mc.id
         WHERE DATE(mcp.prod_date) = ?${wcFilter}
         ORDER BY mc.name ASC, mcp.start_time ASC`,
        params
      );
      res.json({ success: true, data: rows });
    } catch (error) {
      logger.error('Error fetching cycles for date:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getSummaryByWorkCentre(req, res) {
    try {
      const { date } = req.query;
      const targetDate = date || new Date().toISOString().split('T')[0];
      const [rows] = await db.execute(
        `SELECT work_centre_id,
                SUM(rework_qty) as total_rework,
                SUM(rejection_qty) as total_rejection
         FROM rework_rejection
         WHERE DATE(production_date) = ?
         GROUP BY work_centre_id`,
        [targetDate]
      );
      res.json({ success: true, data: rows });
    } catch (error) {
      logger.error('Error fetching rework summary:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = new ReworkRejectionController();
