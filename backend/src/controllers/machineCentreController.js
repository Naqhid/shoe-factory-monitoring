const db = require('../../config/database');
const logger = require('../utils/logger');

// Start production
exports.startProduction = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { workCentreId, machineId, empId, targetMins, targetPairs } = req.body;
    
    await connection.beginTransaction();
    
    const [result] = await connection.execute(
      `INSERT INTO machine_centre_app 
       (prod_date, work_centre_id, machine_id, emp_id, target_mins, output_pairs, start_time, button_status, actual_time)
       VALUES (CURDATE(), ?, ?, ?, ?, 0, NOW(), 1, 0)`,
      [workCentreId, machineId, empId, targetMins]
    );
    
    await connection.commit();
    res.json({ success: true, id: result.insertId });
  } catch (error) {
    await connection.rollback();
    logger.error('Start production error:', error);
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
};

// Stop production (idle)
exports.stopProduction = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { id } = req.body;
    
    await connection.execute(
      `UPDATE machine_centre_app 
       SET idle_start_time = NOW(), button_status = 3
       WHERE id = ?`,
      [id]
    );
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Stop production error:', error);
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
};

// Resume production
exports.resumeProduction = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { id } = req.body;
    
    await connection.execute(
      `UPDATE machine_centre_app 
       SET idle_stop_time = NOW(), 
           idle_duration = idle_duration + TIMESTAMPDIFF(MINUTE, idle_start_time, NOW()),
           button_status = 1
       WHERE id = ?`,
      [id]
    );
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Resume production error:', error);
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
};

// Finish production
exports.finishProduction = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { id, outputPairs } = req.body;
    
    await connection.beginTransaction();
    
    await connection.execute(
      `UPDATE machine_centre_app 
       SET finish_time = NOW(),
           output_pairs = ?,
           actual_time = TIMESTAMPDIFF(MINUTE, start_time, NOW()) - idle_duration,
           button_status = 2
       WHERE id = ?`,
      [outputPairs, id]
    );
    
    // Aggregate to pivot table
    await connection.execute(
      `INSERT INTO pivot_data 
       (prod_date, work_centre_id, machine_id, emp_id, total_output_pairs, total_target_mins, total_actual_time, cumulative_avg_time, avg_efficiency)
       SELECT 
         prod_date,
         work_centre_id,
         machine_id,
         emp_id,
         SUM(output_pairs),
         SUM(target_mins),
         SUM(actual_time),
         CASE WHEN SUM(output_pairs) > 0 THEN SUM(actual_time) / (SUM(output_pairs) / 12) ELSE 0 END,
         CASE WHEN SUM(target_mins) > 0 THEN (SUM(actual_time) / SUM(target_mins)) * 100 ELSE 0 END
       FROM machine_centre_app
       WHERE id = ?
       GROUP BY prod_date, work_centre_id, machine_id, emp_id
       ON DUPLICATE KEY UPDATE
         total_output_pairs = VALUES(total_output_pairs),
         total_target_mins = VALUES(total_target_mins),
         total_actual_time = VALUES(total_actual_time),
         cumulative_avg_time = VALUES(cumulative_avg_time),
         avg_efficiency = VALUES(avg_efficiency)`,
      [id]
    );
    
    await connection.commit();
    res.json({ success: true });
  } catch (error) {
    await connection.rollback();
    logger.error('Finish production error:', error);
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
};

// Get machine status
exports.getMachineStatus = async (req, res) => {
  try {
    const { machineId } = req.params;
    
    const [rows] = await db.execute(
      `SELECT 
         mca.*,
         e.emp_name as operator_name,
         wc.work_centre_name as line_name,
         CASE 
           WHEN button_status = 3 THEN 'Idle'
           WHEN button_status = 2 THEN 'Finished'
           WHEN (actual_time / target_mins * 100) < 80 THEN 'Low'
           ELSE 'On-track'
         END as status_label,
         CASE WHEN target_mins > 0 THEN (actual_time / target_mins * 100) ELSE 0 END as efficiency
       FROM machine_centre_app mca
       LEFT JOIN employees e ON mca.emp_id = e.emp_id
       LEFT JOIN work_centres wc ON mca.work_centre_id = wc.id
       WHERE mca.machine_id = ? 
         AND mca.prod_date = CURDATE()
         AND mca.button_status IN (1, 3)
       ORDER BY mca.id DESC
       LIMIT 1`,
      [machineId]
    );
    
    res.json({ success: true, data: rows[0] || null });
  } catch (error) {
    logger.error('Get machine status error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Update actual time (called every minute by frontend)
exports.updateActualTime = async (req, res) => {
  try {
    const { id } = req.body;
    
    await db.execute(
      `UPDATE machine_centre_app 
       SET actual_time = TIMESTAMPDIFF(MINUTE, start_time, NOW()) - idle_duration
       WHERE id = ? AND button_status = 1`,
      [id]
    );
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Update actual time error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get production planning data for machine
exports.getProductionPlan = async (req, res) => {
  try {
    const { workCentreId, machineId } = req.params;
    
    const [rows] = await db.execute(
      `SELECT 
         pp.*,
         pr.smv,
         pr.target_per_hour,
         pr.pairs_per_day,
         c.customer_name,
         s.style_name,
         col.color_name
       FROM production_planning pp
       LEFT JOIN production_routing pr ON pp.style_id = pr.style_id
       LEFT JOIN customers c ON pp.customer_id = c.id
       LEFT JOIN styles s ON pp.style_id = s.id
       LEFT JOIN colors col ON pp.color_id = col.id
       WHERE pp.work_centre_id = ?
         AND pr.machine_id = ?
         AND pp.plan_date = CURDATE()
       LIMIT 1`,
      [workCentreId, machineId]
    );
    
    res.json({ success: true, data: rows[0] || null });
  } catch (error) {
    logger.error('Get production plan error:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = exports;
