const db = require('../../config/database');
const logger = require('../utils/logger');

// Get all production data
exports.getAll = async (req, res, next) => {
  try {
    const [rows] = await db.query(`
      SELECT pd.*, 
             wc.name as work_centre_name,
             e.name as employee_name
      FROM machine_centre_production pd
      LEFT JOIN work_centres wc ON pd.work_centre_id = wc.id
      LEFT JOIN employees e ON pd.emp_id = e.id
      ORDER BY pd.prod_date DESC, pd.created_at DESC
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    logger.error('Error fetching production data:', error);
    next(error);
  }
};

// Get production data by ID
exports.getById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query(`
      SELECT pd.*, 
             wc.name as work_centre_name,
             e.name as employee_name
      FROM machine_centre_production pd
      LEFT JOIN work_centres wc ON pd.work_centre_id = wc.id
      LEFT JOIN employees e ON pd.emp_id = e.id
      WHERE pd.id = ?
    `, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Production data not found' });
    }

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    logger.error('Error fetching production data by ID:', error);
    next(error);
  }
};

// Get production data by machine and date
exports.getByMachineAndDate = async (req, res, next) => {
  try {
    const { machineId, date } = req.params;
    const [rows] = await db.query(`
      SELECT pd.*, 
             wc.name as work_centre_name,
             e.name as employee_name
      FROM machine_centre_production pd
      LEFT JOIN work_centres wc ON pd.work_centre_id = wc.id
      LEFT JOIN employees e ON pd.emp_id = e.id
      WHERE pd.machine_id = ? AND pd.prod_date = ?
      ORDER BY pd.created_at DESC
    `, [machineId, date]);

    res.json({ success: true, data: rows });
  } catch (error) {
    logger.error('Error fetching production data by machine and date:', error);
    next(error);
  }
};

// Create production data
exports.create = async (req, res, next) => {
  try {
    const {
      prod_date,
      work_centre_id,
      machine_id,
      emp_id,
      output_pairs,
      target_mins,
      start_time,
      finish_time,
      idle_start_time,
      idle_stop_time,
      button_status
    } = req.body;

    const [result] = await db.query(
      `INSERT INTO machine_centre_production 
       (prod_date, work_centre_id, machine_id, emp_id, output_pairs, target_mins, 
        start_time, finish_time, idle_start_time, idle_stop_time, button_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [prod_date, work_centre_id, machine_id, emp_id, output_pairs || 12, target_mins || 0,
        start_time, finish_time, idle_start_time, idle_stop_time, button_status || 1]
    );

    res.status(201).json({
      success: true,
      message: 'Production data created successfully',
      data: { id: result.insertId }
    });
  } catch (error) {
    logger.error('Error creating production data:', error);
    next(error);
  }
};

// Update production data
exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      prod_date,
      work_centre_id,
      machine_id,
      emp_id,
      output_pairs,
      target_mins,
      start_time,
      finish_time,
      idle_start_time,
      idle_stop_time,
      button_status
    } = req.body;

    const [result] = await db.query(
      `UPDATE machine_centre_production 
       SET prod_date = ?, work_centre_id = ?, machine_id = ?, emp_id = ?,
           output_pairs = ?, target_mins = ?, start_time = ?, finish_time = ?,
           idle_start_time = ?, idle_stop_time = ?, button_status = ?
       WHERE id = ?`,
      [prod_date, work_centre_id, machine_id, emp_id, output_pairs, target_mins,
        start_time, finish_time, idle_start_time, idle_stop_time, button_status, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Production data not found' });
    }

    res.json({ success: true, message: 'Production data updated successfully' });
  } catch (error) {
    logger.error('Error updating production data:', error);
    next(error);
  }
};

// Update button status (Start/Finish/Stop)
exports.updateStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { button_status, output_pairs, actual_time } = req.body;

    let updateQuery = 'UPDATE machine_centre_production SET button_status = ?';
    let params = [button_status];

    // If finishing, update finish_time
    if (button_status === 2) {
      updateQuery += ', finish_time = NOW()';
    }
    // If starting/resuming, update start_time and idle_stop_time
    if (button_status === 1) {
      updateQuery += ', start_time = NOW(), idle_stop_time = NOW()';
    }
    // If pausing (button_status === 3), update idle_start_time
    if (button_status === 3) {
      updateQuery += ', idle_start_time = NOW()';
    }
    // Update output pairs if provided
    if (output_pairs !== undefined) {
      updateQuery += ', output_pairs = output_pairs + ?';
      params.push(output_pairs);
    }

    updateQuery += ' WHERE id = ?';
    params.push(id);

    const [result] = await db.query(updateQuery, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Production data not found' });
    }

    res.json({ success: true, message: 'Status updated successfully' });
  } catch (error) {
    logger.error('Error updating status:', error);
    next(error);
  }
};

// Delete production data
exports.delete = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [result] = await db.query('DELETE FROM machine_centre_production WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Production data not found' });
    }

    res.json({ success: true, message: 'Production data deleted successfully' });
  } catch (error) {
    logger.error('Error deleting production data:', error);
    next(error);
  }
};

// Get summary data (aggregated)
exports.getPivotData = async (req, res, next) => {
  try {
    const [rows] = await db.query(`
      SELECT pd.*, 
             wc.name as work_centre_name,
             e.name as employee_name
      FROM machine_centre_summary pd
      LEFT JOIN work_centres wc ON pd.work_centre_id = wc.id
      LEFT JOIN employees e ON pd.emp_id = e.id
      ORDER BY pd.prod_date DESC, pd.created_at DESC
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    logger.error('Error fetching summary data:', error);
    next(error);
  }
};

// Refresh summary data (aggregate from machine_centre_production)
exports.refreshPivotData = async (req, res, next) => {
  try {
    await db.query('TRUNCATE TABLE machine_centre_summary');

    await db.query(`
      INSERT INTO machine_centre_summary 
        (prod_date, work_centre_id, machine_id, emp_id, total_output_pairs, total_target_mins, 
         total_actual_mins, total_idle_mins, avg_efficiency_percent, cum_avg_time, button_status)
      SELECT 
        prod_date, work_centre_id, machine_id, emp_id,
        SUM(output_pairs),
        SUM(target_mins),
        SUM(actual_time),
        SUM(idle_mins),
        CASE WHEN SUM(target_mins) > 0 THEN (SUM(actual_time) / SUM(target_mins)) * 100 ELSE 0 END,
        SUM(actual_time) / 12,
        MAX(button_status)
      FROM machine_centre_production
      GROUP BY prod_date, work_centre_id, machine_id, emp_id
    `);

    res.json({ success: true, message: 'Summary data refreshed successfully' });
  } catch (error) {
    logger.error('Error refreshing summary data:', error);
    next(error);
  }
};

// Get current live status for a specific machine
exports.getLiveMachineStatus = async (req, res, next) => {
  try {
    const { machineId } = req.params;
    const today = new Date().toISOString().split('T')[0];

    const [rows] = await db.query(`
      SELECT pd.*, e.name as emp_name, e.code as emp_code
      FROM machine_centre_production pd
      JOIN employees e ON pd.emp_id = e.id
      WHERE pd.machine_id = ? AND pd.prod_date = ?
      ORDER BY pd.created_at DESC LIMIT 1
    `, [machineId, today]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'No live data for this machine today' });
    }

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    logger.error('Error fetching live machine status:', error);
    next(error);
  }
};
