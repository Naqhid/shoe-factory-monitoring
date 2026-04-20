const db = require('./config/database');

async function fixSummary() {
  const conn = await db.getConnection();
  try {
    console.log('Checking current records for Machine 01, Employee 165 on 2026-04-20...');
    
    const [records] = await conn.execute(
      `SELECT id, output_pairs, created_at 
       FROM machine_centre_production 
       WHERE machine_id = ? AND emp_id = ? AND prod_date = ?
       ORDER BY id`,
      ['01', '165', '2026-04-20']
    );
    
    console.log(`Found ${records.length} records:`, records.map(r => ({id: r.id, pairs: r.output_pairs})));
    
    if (records.length > 7) {
      const idsToDelete = records.slice(7).map(r => r.id);
      console.log(`Deleting extra records with IDs: ${idsToDelete.join(', ')}`);
      
      // Use query instead of execute for IN clause with array
      const placeholders = idsToDelete.map(() => '?').join(',');
      await conn.execute(
        `DELETE FROM machine_centre_production WHERE id IN (${placeholders})`,
        idsToDelete
      );
      console.log('Extra records deleted.');
    }
    
    console.log('Recalculating summary...');
    await conn.execute(
      `INSERT INTO machine_centre_summary 
        (prod_date, work_centre_id, machine_id, emp_id, total_output_pairs, total_target_mins, total_actual_mins, total_idle_mins, cum_avg_time, button_status)
       SELECT prod_date, work_centre_id, machine_id, emp_id,
         SUM(output_pairs), SUM(target_mins), SUM(actual_time), SUM(idle_mins),
         CASE WHEN SUM(output_pairs) > 0 THEN SUM(actual_time) / SUM(output_pairs) ELSE 0 END,
         MAX(button_status)
       FROM machine_centre_production
       WHERE machine_id = ? AND emp_id = ? AND prod_date = ?
       GROUP BY prod_date, work_centre_id, machine_id, emp_id
       ON DUPLICATE KEY UPDATE
         total_output_pairs = VALUES(total_output_pairs),
         total_target_mins = VALUES(total_target_mins),
         total_actual_mins = VALUES(total_actual_mins),
         total_idle_mins = VALUES(total_idle_mins),
         cum_avg_time = VALUES(cum_avg_time),
         button_status = VALUES(button_status),
         updated_at = CURRENT_TIMESTAMP`,
      ['01', '165', '2026-04-20']
    );
    
    const [summary] = await conn.execute(
      `SELECT * FROM machine_centre_summary 
       WHERE machine_id = ? AND emp_id = ? AND prod_date = ?`,
      ['01', '165', '2026-04-20']
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

fixSummary();
