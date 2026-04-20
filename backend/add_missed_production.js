require('dotenv').config();
const db = require('./config/database');

async function addMissedProduction() {
  try {
    const today = new Date().toISOString().split('T')[0];
    console.log(`Adding missed production data for date: ${today}`);

    // Machine 01 - S. Mythi (165) - 2 bins completed between 9:00-10:30
    // Start: 09:00:00, Finish: 09:45:00 (45 mins for first bin)
    const [prod1] = await db.query(
      `INSERT INTO machine_centre_production 
       (prod_date, work_centre_id, machine_id, emp_id, output_pairs, target_mins, target_pairs,
        start_time, finish_time, button_status, actual_time, idle_mins)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [today, 2, '01', 165, 12, 28.2, 12, 
       '2026-04-20 09:00:00', '2026-04-20 09:45:00', 2, 45, 0]
    );
    console.log(`✅ Added bin 1 for Machine 01 (ID: ${prod1.insertId})`);

    // Machine 01 - S. Mythi (165) - 2nd bin
    // Start: 09:45:00, Finish: 10:30:00 (45 mins for second bin)
    const [prod2] = await db.query(
      `INSERT INTO machine_centre_production 
       (prod_date, work_centre_id, machine_id, emp_id, output_pairs, target_mins, target_pairs,
        start_time, finish_time, button_status, actual_time, idle_mins)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [today, 2, '01', 165, 12, 28.2, 12,
       '2026-04-20 09:45:00', '2026-04-20 10:30:00', 2, 45, 0]
    );
    console.log(`✅ Added bin 2 for Machine 01 (ID: ${prod2.insertId})`);

    // Machine 06 - P. Poornima (724) - 2 bins completed between 9:00-10:30
    // Start: 09:00:00, Finish: 09:45:00 (45 mins for first bin)
    const [prod3] = await db.query(
      `INSERT INTO machine_centre_production 
       (prod_date, work_centre_id, machine_id, emp_id, output_pairs, target_mins, target_pairs,
        start_time, finish_time, button_status, actual_time, idle_mins)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [today, 2, '06', 724, 12, 28.2, 12,
       '2026-04-20 09:00:00', '2026-04-20 09:45:00', 2, 45, 0]
    );
    console.log(`✅ Added bin 1 for Machine 06 (ID: ${prod3.insertId})`);

    // Machine 06 - P. Poornima (724) - 2nd bin
    // Start: 09:45:00, Finish: 10:30:00 (45 mins for second bin)
    const [prod4] = await db.query(
      `INSERT INTO machine_centre_production 
       (prod_date, work_centre_id, machine_id, emp_id, output_pairs, target_mins, target_pairs,
        start_time, finish_time, button_status, actual_time, idle_mins)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [today, 2, '06', 724, 12, 28.2, 12,
       '2026-04-20 09:45:00', '2026-04-20 10:30:00', 2, 45, 0]
    );
    console.log(`✅ Added bin 2 for Machine 06 (ID: ${prod4.insertId})`);

    // Update summary for Machine 01
    await db.query(
      `INSERT INTO machine_centre_summary 
       (prod_date, work_centre_id, machine_id, emp_id, total_output_pairs, total_target_mins, 
        total_actual_mins, total_idle_mins, button_status)
       SELECT prod_date, work_centre_id, machine_id, emp_id,
         SUM(output_pairs), SUM(target_mins), SUM(actual_time), SUM(idle_mins), MAX(button_status)
       FROM machine_centre_production
       WHERE prod_date = ? AND machine_id = ? AND emp_id = ?
       GROUP BY prod_date, work_centre_id, machine_id, emp_id
       ON DUPLICATE KEY UPDATE
         total_output_pairs = VALUES(total_output_pairs),
         total_target_mins = VALUES(total_target_mins),
         total_actual_mins = VALUES(total_actual_mins),
         total_idle_mins = VALUES(total_idle_mins),
         button_status = VALUES(button_status),
         updated_at = CURRENT_TIMESTAMP`,
      [today, '01', 165]
    );
    console.log(`✅ Updated summary for Machine 01`);

    // Update summary for Machine 06
    await db.query(
      `INSERT INTO machine_centre_summary 
       (prod_date, work_centre_id, machine_id, emp_id, total_output_pairs, total_target_mins, 
        total_actual_mins, total_idle_mins, button_status)
       SELECT prod_date, work_centre_id, machine_id, emp_id,
         SUM(output_pairs), SUM(target_mins), SUM(actual_time), SUM(idle_mins), MAX(button_status)
       FROM machine_centre_production
       WHERE prod_date = ? AND machine_id = ? AND emp_id = ?
       GROUP BY prod_date, work_centre_id, machine_id, emp_id
       ON DUPLICATE KEY UPDATE
         total_output_pairs = VALUES(total_output_pairs),
         total_target_mins = VALUES(total_target_mins),
         total_actual_mins = VALUES(total_actual_mins),
         total_idle_mins = VALUES(total_idle_mins),
         button_status = VALUES(button_status),
         updated_at = CURRENT_TIMESTAMP`,
      [today, '06', 724]
    );
    console.log(`✅ Updated summary for Machine 06`);

    console.log('\n✅ All production data added successfully!');
    console.log('Machine 01 (S. Mythi): 24 pairs (2 bins)');
    console.log('Machine 06 (P. Poornima): 24 pairs (2 bins)');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

addMissedProduction();
