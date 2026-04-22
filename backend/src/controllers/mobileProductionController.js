const db = require('../../config/database');
const logger = require('../utils/logger');
const { withTransaction } = require('../utils/transaction');

// Get all production data
exports.getAll = async (req, res, next) => {
  try {
    const [rows] = await db.query(`
      SELECT pd.*, 
             wc.name as work_centre_name,
             e.name as employee_name
      FROM machine_centre_production pd
      LEFT JOIN work_centres wc ON pd.work_centre_id = wc.id
      LEFT JOIN employees e ON pd.emp_id = e.code
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
      LEFT JOIN employees e ON pd.emp_id = e.code
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
      LEFT JOIN employees e ON pd.emp_id = e.code
      WHERE pd.machine_id = ? AND pd.prod_date = ?
      ORDER BY pd.created_at DESC
    `, [machineId, date]);

    res.json({ success: true, data: rows });
  } catch (error) {
    logger.error('Error fetching production data by machine and date:', error);
    next(error);
  }
};

// Get latest unfinished production data by machine (date-agnostic)
exports.getLatestUnfinishedByMachine = async (req, res, next) => {
  try {
    const { machineId } = req.params;
    const [rows] = await db.query(`
      SELECT pd.*, 
             wc.name as work_centre_name,
             e.name as employee_name
      FROM machine_centre_production pd
      LEFT JOIN work_centres wc ON pd.work_centre_id = wc.id
      LEFT JOIN employees e ON pd.emp_id = e.code
      WHERE pd.machine_id = ? AND pd.button_status != 2
      ORDER BY pd.created_at DESC
      LIMIT 1
    `, [machineId]);

    res.json({ success: true, data: rows[0] || null });
  } catch (error) {
    logger.error('Error fetching latest unfinished production data by machine:', error);
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

    // SECURITY: Prevent creating records that are already finished
    // Records must be created in status 1 (running) or 3 (idle), NOT 2 (finished)
    const requestedStatus = button_status || 1;
    if (requestedStatus === 2) {
      logger.warn(`BLOCKED: Attempt to create already-finished record for machine ${machine_id}, emp ${emp_id}`);
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot create production record in finished state. Records must start as running (1) or idle (3).' 
      });
    }

    // Check for existing active record for this machine/employee/date to prevent duplicates
    const [existingRows] = await db.query(
      `SELECT id, button_status FROM machine_centre_production 
       WHERE machine_id = ? AND emp_id = ? AND prod_date = ? AND button_status != 2`,
      [machine_id, emp_id, prod_date ? prod_date.split('T')[0] : new Date().toISOString().split('T')[0]]
    );
    
    if (existingRows.length > 0) {
      logger.warn(`BLOCKED: Duplicate record creation attempt for machine ${machine_id}, emp ${emp_id}. Existing record: ${existingRows[0].id}`);
      return res.status(409).json({ 
        success: false, 
        message: 'Active production record already exists for this machine and employee',
        data: { existing_id: existingRows[0].id }
      });
    }

    // Extract YYYY-MM-DD from ISO timestamp for MySQL DATE column
    const formattedDate = prod_date ? prod_date.split('T')[0] : null;

    const [result] = await db.query(
      `INSERT INTO machine_centre_production
       (prod_date, work_centre_id, machine_id, emp_id, output_pairs, target_mins,
        start_time, finish_time, idle_start_time, idle_stop_time, button_status)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?)`,
      [formattedDate, work_centre_id, machine_id, emp_id,
       output_pairs !== undefined ? output_pairs : 0,
       target_mins || 0,
       finish_time || null,
       idle_start_time || null,
       idle_stop_time || null,
       requestedStatus]
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

    // SECURITY: Block status changes through PUT - use PATCH /status instead
    if (button_status !== undefined) {
      logger.warn(`BLOCKED: Attempt to change button_status via PUT for record ${id}. Use PATCH /status endpoint instead.`);
      return res.status(400).json({
        success: false,
        message: 'Status changes not allowed via PUT. Use PATCH /api/mobile-production/:id/status endpoint instead.'
      });
    }

    const [result] = await db.query(
      `UPDATE machine_centre_production 
       SET prod_date = ?, work_centre_id = ?, machine_id = ?, emp_id = ?,
           output_pairs = ?, target_mins = ?, start_time = ?, finish_time = ?,
           idle_start_time = ?, idle_stop_time = ?
       WHERE id = ?`,
      [prod_date, work_centre_id, machine_id, emp_id, output_pairs, target_mins,
        start_time, finish_time, idle_start_time, idle_stop_time, id]
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

// Update button status (Start/Finish/Stop) and/or actual_time
exports.updateStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { button_status, output_pairs, actual_time, stoppage_reason, emp_id, session_id } = req.body;
    const normalizedButtonStatus = button_status === 3 ? 1 : button_status;

    // DEBUG: Log all status change requests for troubleshooting ghost records
    logger.info(`[STATUS-CHANGE] Record ${id}: requested_status=${button_status}, normalized=${normalizedButtonStatus}, emp_id=${emp_id}, session_id=${session_id}, output_pairs=${output_pairs}, ip=${req.ip}, ua=${req.headers['user-agent']?.substring(0, 50)}`);

    // Get existing record first (outside transaction to ensure we have current data)
    const [existingRows] = await db.execute('SELECT * FROM machine_centre_production WHERE id = ?', [id]);
    if (existingRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Production data not found' });
    }
    const existingRecord = existingRows[0];
    
    // DEBUG: Log current state before change
    logger.info(`[STATUS-CHANGE] Record ${id}: current_status=${existingRecord.button_status}, current_start_time=${existingRecord.start_time}, current_finish_time=${existingRecord.finish_time}`);

    let updateQuery = 'UPDATE machine_centre_production SET';
    let params = [];
    let hasUpdate = false;

    // Handle button_status update (may not be provided during time-only sync)
    if (normalizedButtonStatus !== undefined) {
      updateQuery += ' button_status = ?';
      params.push(normalizedButtonStatus);
      hasUpdate = true;

      if (normalizedButtonStatus === 2) {
        // GHOST RECORD DETECTION: Block finishes within 1 minute to prevent accidental clicks
        // Most production cycles take 15-30 minutes, so 1 minute minimum prevents mistakes
        const startTime = existingRecord.start_time ? new Date(existingRecord.start_time) : null;
        const now = new Date();
        const elapsedSeconds = startTime ? Math.floor((now - startTime) / 1000) : 0;
        
        if (startTime && elapsedSeconds < 60) {
          logger.warn(`[GHOST-DETECTED] Record ${id} being finished after only ${elapsedSeconds} seconds! Machine=${existingRecord.machine_id}, Emp=${existingRecord.emp_id}. Blocking suspicious finish.`);
          return res.status(400).json({
            success: false,
            message: `Cannot finish production cycle after only ${elapsedSeconds} seconds. Minimum cycle time is 1 minute.`
          });
        }
        
        updateQuery += ', finish_time = NOW()';
        if (output_pairs !== undefined) { updateQuery += ', output_pairs = ?'; params.push(output_pairs); }
      } else if (normalizedButtonStatus === 1) {
        updateQuery += ', idle_stop_time = NOW()';
      }
    }

    if (!hasUpdate) {
      return res.json({ success: true, message: 'No updates required' });
    }

    updateQuery += ' WHERE id = ?';
    params.push(id);
    
    // CRITICAL: Use transaction for atomicity - both production update AND summary update succeed or fail together
    let updateResult, summaryData;
    
    try {
      await withTransaction(async (conn) => {
        // 1. Update production record
        [updateResult] = await conn.execute(updateQuery, params);
        
        if (updateResult.affectedRows === 0) {
          throw new Error(`Record ${id} not updated - may not exist or already finished`);
        }
        
        logger.info(`[FINISH-SUCCESS] Record ${id} updated: button_status=${normalizedButtonStatus}, affectedRows=${updateResult.affectedRows}`);

        // 2. On finish: update summary table atomically within same transaction
        if (normalizedButtonStatus === 2) {
          const prod = existingRecord;
          
          // IMPORTANT: Use CURRENT_DATE to get TODAY's records, not record's prod_date
          // The record's prod_date might be old (e.g., April 18) but we want today's summary (April 21)
          const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
          
          // Get all finished records and calculate sums manually
          const [finishedRecords] = await conn.execute(
            `SELECT 
              output_pairs, 
              target_mins,
              TIMESTAMPDIFF(MINUTE, start_time, finish_time) as actual_mins,
              COALESCE(idle_mins, 0) as idle_mins
             FROM machine_centre_production 
             WHERE DATE(prod_date) = ? AND work_centre_id = ? AND machine_id = ? AND emp_id = ? AND button_status = 2`,
            [today, prod.work_centre_id, prod.machine_id, prod.emp_id]
          );
          
          // Calculate totals manually
          let totalOutput = 0;
          let totalTargetMins = 0;
          let totalActualMins = 0;
          let totalIdleMins = 0;
          
          finishedRecords.forEach(record => {
            totalOutput += parseInt(record.output_pairs) || 0;
            totalTargetMins += parseFloat(record.target_mins) || 0;
            totalActualMins += parseFloat(record.actual_mins) || 0;
            totalIdleMins += parseFloat(record.idle_mins) || 0;
          });
          
          const cumAvgTime = totalOutput > 0 ? (totalActualMins / totalOutput) : 0;
          
          // avg_efficiency_percent is a GENERATED COLUMN - MySQL calculates it automatically
          // Formula in DB: (total_target_mins / total_actual_mins) * 100
          
          logger.info(`[SUMMARY-CALC] ${prod.machine_id}: output=${totalOutput}, cycles=${finishedRecords.length}, target=${totalTargetMins}m, actual=${totalActualMins}m`);
          
          // Update summary atomically within transaction
          const [summaryResult] = await conn.execute(
            `INSERT INTO machine_centre_summary
             (prod_date, work_centre_id, machine_id, emp_id, total_output_pairs, total_target_mins, total_actual_mins, total_idle_mins, cum_avg_time, button_status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               total_output_pairs = VALUES(total_output_pairs),
               total_target_mins = VALUES(total_target_mins),
               total_actual_mins = VALUES(total_actual_mins),
               total_idle_mins = VALUES(total_idle_mins),
               cum_avg_time = VALUES(cum_avg_time),
               button_status = VALUES(button_status),
               updated_at = CURRENT_TIMESTAMP`,
            [today, prod.work_centre_id, prod.machine_id, prod.emp_id,
             totalOutput, totalTargetMins, totalActualMins, totalIdleMins, cumAvgTime, 2]
          );
          
          logger.info(`[SUMMARY-UPDATED] ${prod.machine_id}: ${totalOutput} pairs, affectedRows=${summaryResult.affectedRows}`);
          
          summaryData = {
            total_output_pairs: totalOutput,
            total_cycles: finishedRecords.length,
            summary_updated: true
          };
        }
      }, { isolationLevel: 'READ COMMITTED' }); // Ensure we see our own changes
      
      // Transaction succeeded - send response
      if (normalizedButtonStatus === 2 && summaryData) {
        res.json({ 
          success: true, 
          message: 'Status updated successfully',
          data: summaryData
        });
      } else {
        res.json({ success: true, message: 'Status updated successfully' });
      }
      
    } catch (txError) {
      logger.error(`[TRANSACTION-FAILED] Record ${id}:`, txError);
      return res.status(500).json({ 
        success: false, 
        message: 'Database update failed. Please retry.',
        error: txError.message 
      });
    }
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
      LEFT JOIN employees e ON pd.emp_id = e.code
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
      JOIN employees e ON pd.emp_id = e.code
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
    logger.info(`Fetching summary for machine: ${machineId}, date: ${date}`);
    
    // CRITICAL FIX: Always recalculate from production records to ensure fresh data
    // Don't rely solely on summary table which may have stale/generated column issues
    // Use DATE(prod_date) to handle timezone differences in date comparison
    const [productionRows] = await db.query(`
      SELECT 
        SUM(output_pairs) as total_output_pairs,
        SUM(target_mins) as total_target_mins,
        SUM(TIMESTAMPDIFF(MINUTE, start_time, finish_time)) as total_actual_mins,
        SUM(COALESCE(idle_mins, 0)) as total_idle_mins,
        COUNT(*) as total_cycles
      FROM machine_centre_production
      WHERE machine_id = ? AND DATE(prod_date) = ? AND button_status = 2
    `, [machineId, date]);
    
    const prodData = productionRows[0];
    
    if (!prodData || !prodData.total_output_pairs) {
      logger.info(`No finished production records found for ${machineId} on ${date}`);
      return res.json({ success: true, data: null });
    }
    
    // Calculate derived values
    const totalOutput = parseInt(prodData.total_output_pairs) || 0;
    const totalTargetMins = parseFloat(prodData.total_target_mins) || 0;
    const totalActualMins = parseFloat(prodData.total_actual_mins) || 0;
    const totalIdleMins = parseFloat(prodData.total_idle_mins) || 0;
    
    // Efficiency = (target / actual) * 100 (higher is better - they beat the target)
    const avgEfficiency = totalActualMins > 0 
      ? ((totalTargetMins / totalActualMins) * 100).toFixed(1)
      : '0';
    const cumAvgTime = totalOutput > 0
      ? (totalActualMins / totalOutput).toFixed(2)
      : '0';
    
    const result = {
      machine_id: machineId,
      prod_date: date,
      total_output_pairs: totalOutput,
      total_target_mins: totalTargetMins,
      total_actual_mins: totalActualMins,
      total_idle_mins: totalIdleMins,
      avg_efficiency_percent: avgEfficiency,
      cum_avg_time: cumAvgTime,
      total_cycles: parseInt(prodData.total_cycles) || 0
    };
    
    logger.info(`Fresh calc for ${machineId}: ${JSON.stringify(result)}`);
    
    // Note: Summary is already updated atomically by transaction in updateStatus
    // No background sync needed - prevents race conditions
    
    res.json({ success: true, data: result });
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
    
    // Override with session work_centre_id if available (set from QR scan)
    const [sessionRows] = await db.query(
      'SELECT work_centre_id FROM mobile_sessions WHERE machine_id = ? AND status = ? ORDER BY activated_at DESC LIMIT 1',
      [machineId, 'active']
    );
    const finalWorkCentreId = (sessionRows[0]?.work_centre_id) || workCentreId;

    // Get work centre
    const [wcRows] = await db.query('SELECT id, name FROM work_centres WHERE id = ?', [finalWorkCentreId]);
    const workCentre = wcRows[0] || { id: finalWorkCentreId, name: `WC-${finalWorkCentreId}` };

    // Get target mins from routing for today's plan and machine
    let targetMins = 0;
    try {
      const [linesRows] = await db.query(
        `SELECT prl.mins_12_prs_box
         FROM production_plan pp
         JOIN production_routing_header prh ON prh.style_id = pp.style_id
         JOIN production_routing_lines prl
           ON prl.routing_header_id = prh.id
           AND prl.machine_centre_id = ?
         WHERE pp.work_centre_id = ?
           AND pp.plan_date = CURDATE()
         ORDER BY
           CASE WHEN prh.created_on <= pp.plan_date THEN 0 ELSE 1 END ASC,
           ABS(DATEDIFF(prh.created_on, pp.plan_date)) ASC,
           prh.id DESC
         LIMIT 1`,
        [machineId, finalWorkCentreId]
      );
      if (linesRows.length > 0) targetMins = parseFloat(linesRows[0].mins_12_prs_box || 0);
    } catch (err) {
      logger.warn('Could not fetch routing data, using fallback target mins 0:', err.message);
    }

    // Get target pairs from planning (default 0)
    let targetPairs = 0;
    try {
      const [planningRows] = await db.query('SELECT work_centre_id, target_pairs_per_tray, plan_date FROM production_plan ORDER BY plan_date DESC');
      logger.info(`Found ${planningRows.length} planning records. Looking for work_centre_id: ${finalWorkCentreId}`);
      if (planningRows.length > 0) {
        // Find matching work centre or use the latest plan
        const matchingPlan = planningRows.find((p) => p.work_centre_id === finalWorkCentreId);
        if (matchingPlan) {
          targetPairs = matchingPlan.target_pairs_per_tray || 0;
          logger.info(`Found matching plan for work_centre_id ${finalWorkCentreId}: target_pairs = ${targetPairs}`);
        } else {
          // Use latest plan if no exact match
          targetPairs = planningRows[0].target_pairs_per_tray || 0;
          logger.info(`No matching plan for work_centre_id ${finalWorkCentreId}, using latest plan: target_pairs = ${targetPairs}`);
        }
      }
    } catch (err) {
      logger.warn('Could not fetch planning data, using default target pairs:', err.message);
    }

    // Keep unfinished row aligned with latest routing target so resumed sessions don't show stale values.
    if (existingRecord && existingRecord.button_status !== 2) {
      const existingTarget = Number(existingRecord.target_mins || 0);
      const latestTarget = Number(targetMins || 0);
      if (latestTarget > 0 && existingTarget !== latestTarget) {
        await db.query(
          'UPDATE machine_centre_production SET target_mins = ? WHERE id = ?',
          [latestTarget, existingRecord.id]
        );
        existingRecord.target_mins = latestTarget;
      }
    }

    res.json({
      success: true,
      data: {
        employee: { id: employee.code, code: employee.code, name: employee.name }, // Use code as ID for consistency
        machine: { machine_id: machine.machine_id, name: machine.name, machine_name: machine.machine_name, work_centre_id: finalWorkCentreId },
        workCentre: { id: finalWorkCentreId, name: workCentre.name },
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
