const db = require('../../config/database');
const logger = require('../utils/logger');
const { getRoutingMinsSqlExpr, getPairsPerRoutingBin } = require('../utils/routingMinsColumn');

// Start production
exports.startProduction = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { workCentreId, machineId, empId, targetMins, targetPairs } = req.body;
    
    await connection.beginTransaction();
    
    const [result] = await connection.execute(
      `INSERT INTO machine_centre_app 
       (prod_date, work_centre_id, machine_id, emp_id, target_mins, target_pairs, output_pairs, start_time, button_status, actual_time)
       VALUES (CURDATE(), ?, ?, ?, ?, ?, 0, NOW(), 1, 0)`,
      [workCentreId, machineId, empId, targetMins, targetPairs || 12]
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

    if (!id) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    await connection.execute(
      `UPDATE machine_centre_app
       SET idle_stop_time = NOW(),
           idle_duration = idle_duration + COALESCE(TIMESTAMPDIFF(MINUTE, idle_start_time, NOW()), 0),
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
    const { id, outputPairs, targetPairs } = req.body;
    
    await connection.beginTransaction();
    
    await connection.execute(
      `UPDATE machine_centre_app 
       SET finish_time = NOW(),
           output_pairs = ?,
           target_pairs = ?,
           actual_time = TIMESTAMPDIFF(MINUTE, start_time, NOW()) - idle_duration,
           button_status = 2
       WHERE id = ?`,
      [outputPairs, targetPairs || 12, id]
    );
    
    // Aggregate to pivot table
    await connection.execute(
      `INSERT INTO pivot_data 
       (prod_date, work_centre_id, machine_id, emp_id, total_output_pairs, total_target_pairs, total_target_mins, total_actual_time, cumulative_avg_time, avg_efficiency)
       SELECT 
         prod_date,
         work_centre_id,
         machine_id,
         emp_id,
         SUM(output_pairs),
         SUM(target_pairs),
         SUM(target_mins),
         SUM(actual_time),
         CASE WHEN SUM(output_pairs) > 0 THEN SUM(actual_time) / (SUM(output_pairs) / 6) ELSE 0 END,
         CASE WHEN SUM(target_mins) > 0 THEN (SUM(actual_time) / SUM(target_mins)) * 100 ELSE 0 END
       FROM machine_centre_app
       WHERE id = ?
       GROUP BY prod_date, work_centre_id, machine_id, emp_id
       ON DUPLICATE KEY UPDATE
         total_output_pairs = VALUES(total_output_pairs),
         total_target_pairs = VALUES(total_target_pairs),
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
         e.name as operator_name,
         wc.name as line_name,
         mc.name as process_name,
         mca.updated_at as last_activity
       FROM machine_centre_app mca
       LEFT JOIN employees e ON mca.emp_id = e.code
       LEFT JOIN work_centres wc ON mca.work_centre_id = wc.id
       LEFT JOIN machine_centres mc ON mca.machine_id = mc.machine_id
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
    const routingMinsExpr = await getRoutingMinsSqlExpr('prl');
    const pairsPerBin = await getPairsPerRoutingBin();

    const [rows] = await db.execute(
      `SELECT 
         pp.*,
         prh.target_per_day as pairs_per_day,
         prh.target_per_hour,
         ${routingMinsExpr} as target_mins_per_bin,
         (${routingMinsExpr} / ${pairsPerBin}) as smv,
         c.name as customer_name,
         s.name as style_name,
         col.name as color_name
       FROM production_plan pp
       LEFT JOIN customers c ON pp.customer_id = c.id
       LEFT JOIN styles s ON pp.style_id = s.id
       LEFT JOIN colors col ON pp.color_id = col.id
       LEFT JOIN production_routing_header prh 
         ON prh.style_id = pp.style_id
       LEFT JOIN production_routing_lines prl
         ON prl.routing_header_id = prh.id
         AND prl.machine_centre_id = ?
       WHERE pp.work_centre_id = ?
         AND pp.plan_date = CURDATE()
         AND prl.id IS NOT NULL
       ORDER BY
         CASE WHEN prh.created_on <= pp.plan_date THEN 0 ELSE 1 END ASC,
         ABS(DATEDIFF(prh.created_on, pp.plan_date)) ASC,
         prh.id DESC
       LIMIT 1`,
      [machineId, workCentreId]
    );
    
    res.json({ success: true, data: rows[0] || null });
  } catch (error) {
    logger.error('Get production plan error:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = exports;
