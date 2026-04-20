const db = require('./config/database');

async function fixMachine03() {
  const conn = await db.getConnection();
  try {
    const today = '2026-04-20';
    const machineId = '03';
    const empId = '278';
    const workCentreId = 5;
    
    console.log(`Fixing Machine ${machineId}, Employee ${empId} on ${today}...\n`);
    
    // Recalculate summary with button_status = 2 filter
    await conn.execute(
      `INSERT INTO machine_centre_summary 
        (prod_date, work_centre_id, machine_id, emp_id, total_output_pairs, total_target_mins, total_actual_mins, total_idle_mins, cum_avg_time, button_status)
       SELECT prod_date, work_centre_id, machine_id, emp_id,
         SUM(output_pairs), SUM(target_mins), SUM(actual_time), SUM(idle_mins),
         CASE WHEN SUM(output_pairs) > 0 THEN SUM(actual_time) / SUM(output_pairs) ELSE 0 END,
         MAX(button_status)
       FROM machine_centre_production
       WHERE prod_date = ? AND work_centre_id = ? AND machine_id = ? AND emp_id = ? AND button_status = 2
       GROUP BY prod_date, work_centre_id, machine_id, emp_id
       ON DUPLICATE KEY UPDATE
         total_output_pairs = VALUES(total_output_pairs),
         total_target_mins = VALUES(total_target_mins),
         total_actual_mins = VALUES(total_actual_mins),
         total_idle_mins = VALUES(total_idle_mins),
         cum_avg_time = VALUES(cum_avg_time),
         button_status = VALUES(button_status),
         updated_at = CURRENT_TIMESTAMP`,
      [today, workCentreId, machineId, empId]
    );
    
    // Verify
    const [summary] = await conn.execute(
      `SELECT * FROM machine_centre_summary 
       WHERE machine_id = ? AND emp_id = ? AND prod_date = ?`,
      [machineId, empId, today]
    );
    
    console.log('Summary updated:', summary[0]);
    console.log(`✅ Total Output is now: ${summary[0]?.total_output_pairs || 0} pairs`);
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    conn.release();
    process.exit(0);
  }
}

fixMachine03();
