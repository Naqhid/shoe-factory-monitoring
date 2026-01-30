const db = require('../../config/database');
const logger = require('../utils/logger');

// Get all production data
exports.getAll = async (req, res, next) => {
  try {
    const [rows] = await db.query(`
      SELECT pd.*, 
             wc.name as work_centre_name,
             e.name as employee_name
      FROM prod_data pd
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
      FROM prod_data pd
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
      FROM prod_data pd
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
      idle_stop_time,
      idle_start_time,
      actual_time,
      button_status
    } = req.body;

    const [result] = await db.query(
      `INSERT INTO prod_data 
       (prod_date, work_centre_id, machine_id, emp_id, output_pairs, target_mins, 
        start_time, finish_time, idle_stop_time, idle_start_time, actual_time, button_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [prod_date, work_centre_id, machine_id, emp_id, output_pairs || 0, target_mins || 0,
        start_time, finish_time, idle_stop_time || 0, idle_start_time || 0, actual_time || 0, button_status || 1]
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
      idle_stop_time,
      idle_start_time,
      actual_time,
      button_status
    } = req.body;

    const [result] = await db.query(
      `UPDATE prod_data 
       SET prod_date = ?, work_centre_id = ?, machine_id = ?, emp_id = ?,
           output_pairs = ?, target_mins = ?, start_time = ?, finish_time = ?,
           idle_stop_time = ?, idle_start_time = ?, actual_time = ?, button_status = ?
       WHERE id = ?`,
      [prod_date, work_centre_id, machine_id, emp_id, output_pairs, target_mins,
        start_time, finish_time, idle_stop_time, idle_start_time, actual_time, button_status, id]
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
    const { button_status, output_pairs } = req.body;

    let updateQuery = 'UPDATE prod_data SET button_status = ?';
    let params = [button_status];

    // If finishing, update finish_time
    if (button_status === 2) {
      updateQuery += ', finish_time = CURRENT_TIME()';
    }
    // If starting, update start_time
    if (button_status === 1) {
      updateQuery += ', start_time = CURRENT_TIME()';
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
    const [result] = await db.query('DELETE FROM prod_data WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Production data not found' });
    }

    res.json({ success: true, message: 'Production data deleted successfully' });
  } catch (error) {
    logger.error('Error deleting production data:', error);
    next(error);
  }
};

// Get pivot data (aggregated)
exports.getPivotData = async (req, res, next) => {
  try {
    const [rows] = await db.query(`
      SELECT pd.*, 
             wc.name as work_centre_name,
             e.name as employee_name
      FROM pivot_data pd
      LEFT JOIN work_centres wc ON pd.work_centre_id = wc.id
      LEFT JOIN employees e ON pd.emp_id = e.id
      ORDER BY pd.prod_date DESC, pd.created_at DESC
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    logger.error('Error fetching pivot data:', error);
    next(error);
  }
};

// Refresh pivot data (aggregate from prod_data)
exports.refreshPivotData = async (req, res, next) => {
  try {
    // Clear existing pivot data
    await db.query('TRUNCATE TABLE pivot_data');

    // Aggregate data from prod_data
    await db.query(`
      INSERT INTO pivot_data 
        (prod_date, work_centre_id, machine_id, emp_id, output_pairs, target_mins, actual_time, cum_avg_time, button_status)
      SELECT 
        prod_date,
        work_centre_id,
        machine_id,
        emp_id,
        SUM(output_pairs) as output_pairs,
        SUM(target_mins) as target_mins,
        SUM(actual_time) as actual_time,
        FLOOR(SUM(actual_time) / 12) as cum_avg_time,
        MAX(button_status) as button_status
      FROM prod_data
      GROUP BY prod_date, work_centre_id, machine_id, emp_id
    `);

    res.json({ success: true, message: 'Pivot data refreshed successfully' });
  } catch (error) {
    logger.error('Error refreshing pivot data:', error);
    next(error);
  }
};
