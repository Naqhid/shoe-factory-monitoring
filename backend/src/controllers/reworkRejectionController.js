const db = require('../../config/database');
const logger = require('../utils/logger');

class ReworkRejectionController {
  async getAll(req, res) {
    try {
      const { work_centre_id, date } = req.query;
      let query = `SELECT rr.*, wc.name as work_centre_name 
                   FROM rework_rejection rr
                   LEFT JOIN work_centres wc ON rr.work_centre_id = wc.id
                   WHERE 1=1`;
      const params = [];
      if (work_centre_id) { query += ` AND rr.work_centre_id = ?`; params.push(work_centre_id); }
      if (date) { query += ` AND DATE(rr.production_date) = ?`; params.push(date); }
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
