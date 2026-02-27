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
      [prod_date, work_centre_id, machine_id, emp_id, output_pairs !== undefined ? output_pairs : 0, target_mins || 0,
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

    // If finishing, update finish_time and output_pairs
    if (button_status === 2) {
      updateQuery += ', finish_time = NOW()';
      if (output_pairs !== undefined) {
        updateQuery += ', output_pairs = ?';
        params.push(output_pairs);
      }
    }
    // If starting/resuming, update start_time and idle_stop_time
    else if (button_status === 1) {
      updateQuery += ', start_time = NOW(), idle_stop_time = NOW()';
    }
    // If pausing (button_status === 3), update idle_start_time
    else if (button_status === 3) {
      updateQuery += ', idle_start_time = NOW()';
    }

    updateQuery += ' WHERE id = ?';
    params.push(id);

    const [result] = await db.query(updateQuery, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Production data not found' });
    }

    // If finishing, update machine_centre_summary
    if (button_status === 2) {
      const [record] = await db.query('SELECT * FROM machine_centre_production WHERE id = ?', [id]);
      if (record.length > 0) {
        const prod = record[0];
        await db.query(
          `INSERT INTO machine_centre_summary 
           (prod_date, work_centre_id, machine_id, emp_id, total_output_pairs, total_target_mins, total_actual_mins, total_idle_mins, avg_efficiency_percent, button_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
           total_output_pairs = total_output_pairs + VALUES(total_output_pairs),
           total_target_mins = total_target_mins + VALUES(total_target_mins),
           total_actual_mins = total_actual_mins + VALUES(total_actual_mins),
           total_idle_mins = total_idle_mins + VALUES(total_idle_mins),
           avg_efficiency_percent = CASE WHEN (total_target_mins + VALUES(total_target_mins)) > 0 
                                THEN ((total_actual_mins + VALUES(total_actual_mins)) / (total_target_mins + VALUES(total_target_mins))) * 100 
                                ELSE 0 END,
           button_status = VALUES(button_status)`,
          [prod.prod_date, prod.work_centre_id, prod.machine_id, prod.emp_id.toString(), 
           prod.output_pairs || 0, prod.target_mins || 0, prod.actual_time || 0, prod.idle_mins || 0,
           prod.target_mins > 0 ? (prod.actual_time / prod.target_mins) * 100 : 0, 2]
        );
      }
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

// Get summary data for a specific machine and date
exports.getSummaryByMachineAndDate = async (req, res, next) => {
  try {
    const { machineId, date } = req.params;
    const [rows] = await db.query(`
      SELECT * FROM machine_centre_summary
      WHERE machine_id = ? AND prod_date = ?
    `, [machineId, date]);

    if (rows.length === 0) {
      return res.json({ success: true, data: null });
    }

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    logger.error('Error fetching summary data:', error);
    next(error);
  }
};

// Get initialization data in one call (optimized)
exports.getInitData = async (req, res, next) => {
  try {
    const { machineId, empCode } = req.params;
    const today = new Date().toISOString().split('T')[0];

    // Fetch all data in parallel
    const [employeeRows, machineRows, existingRows] = await Promise.all([
      db.query('SELECT id, code, name FROM employees WHERE code = ?', [empCode]),
      db.query('SELECT machine_id, code, name, work_centre_id FROM machine_centres WHERE machine_id = ? OR code = ?', [machineId, machineId]),
      db.query('SELECT * FROM machine_centre_production WHERE machine_id = ? AND prod_date = ? AND button_status != 2 ORDER BY created_at DESC LIMIT 1', [machineId, today])
    ]);

    const employee = employeeRows[0][0];
    const machine = machineRows[0][0];
    const existingRecord = existingRows[0][0];

    if (!employee) {
      return res.status(404).json({ success: false, message: `Employee ${empCode} not found` });
    }

    if (!machine) {
      return res.status(404).json({ success: false, message: `Machine ${machineId} not found` });
    }

    const workCentreId = machine.work_centre_id || 1;
    
    // Get work centre
    const [wcRows] = await db.query('SELECT id, name FROM work_centres WHERE id = ?', [workCentreId]);
    const workCentre = wcRows[0] || { id: workCentreId, name: `WC-${workCentreId}` };

    // Get target mins from routing (default 16.6)
    let targetMins = 16.6;
    try {
      const [routingRows] = await db.query('SELECT id FROM production_routing_header ORDER BY created_on DESC LIMIT 1');
      if (routingRows[0]) {
        const [linesRows] = await db.query('SELECT mins_12_prs_box FROM production_routing_lines WHERE routing_header_id = ?', [routingRows[0].id]);
        if (linesRows.length > 0) {
          targetMins = linesRows.reduce((sum, line) => sum + parseFloat(line.mins_12_prs_box || 0), 0);
        }
      }
    } catch (err) {
      logger.warn('Could not fetch routing data, using default target mins:', err.message);
    }

    // Get target pairs from planning (default 0)
    let targetPairs = 0;
    try {
      const [planningRows] = await db.query('SELECT work_centre_id, target_pairs_per_tray, plan_date FROM production_plan ORDER BY plan_date DESC');
      logger.info(`Found ${planningRows.length} planning records. Looking for work_centre_id: ${workCentreId}`);
      if (planningRows.length > 0) {
        // Find matching work centre or use the latest plan
        const matchingPlan = planningRows.find((p) => p.work_centre_id === workCentreId);
        if (matchingPlan) {
          targetPairs = matchingPlan.target_pairs_per_tray || 0;
          logger.info(`Found matching plan for work_centre_id ${workCentreId}: target_pairs = ${targetPairs}`);
        } else {
          // Use latest plan if no exact match
          targetPairs = planningRows[0].target_pairs_per_tray || 0;
          logger.info(`No matching plan for work_centre_id ${workCentreId}, using latest plan: target_pairs = ${targetPairs}`);
        }
      }
    } catch (err) {
      logger.warn('Could not fetch planning data, using default target pairs:', err.message);
    }

    res.json({
      success: true,
      data: {
        employee: { id: employee.id, code: employee.code, name: employee.name },
        machine: { machine_id: machine.machine_id, name: machine.name, work_centre_id: workCentreId },
        workCentre: { id: workCentreId, name: workCentre.name },
        targetMins,
        targetPairs,
        existingRecord
      }
    });
  } catch (error) {
    logger.error('Error fetching init data:', error);
    next(error);
  }
};
