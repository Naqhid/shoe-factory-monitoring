require('dotenv').config();
const db = require('./config/database');

async function addThirdBinRunning() {
  try {
    const today = '2026-04-20';
    console.log(`Adding 3rd bin data (RUNNING status) for date: ${today}`);

    // Machine 01 - S. Mythi (165) - Bin 3: Started at 10:25, status = 1 (running), no finish time
    const [prod1] = await db.query(
      `INSERT INTO machine_centre_production 
       (prod_date, work_centre_id, machine_id, emp_id, output_pairs, target_mins,
        start_time, finish_time, button_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [today, 5, '01', 165, 0, 28.2, 
       '2026-04-20 10:25:00', null, 1]
    );
    console.log(`✅ Added bin 3 for Machine 01 - S. Mythi - RUNNING since 10:25`);

    // Machine 06 - P. Poornima (724) - Bin 3: Started at 10:25, status = 1 (running), no finish time
    const [prod2] = await db.query(
      `INSERT INTO machine_centre_production 
       (prod_date, work_centre_id, machine_id, emp_id, output_pairs, target_mins,
        start_time, finish_time, button_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [today, 5, '06', 724, 0, 28.2,
       '2026-04-20 10:25:00', null, 1]
    );
    console.log(`✅ Added bin 3 for Machine 06 - P. Poornima - RUNNING since 10:25`);

    // Recalculate summary for Machine 01 (still 24 pairs finished, but now has running record)
    await db.query(
      `INSERT INTO machine_centre_summary 
       (prod_date, work_centre_id, machine_id, emp_id, total_output_pairs, total_target_mins, 
        total_actual_mins, total_idle_mins, button_status)
       SELECT prod_date, work_centre_id, machine_id, emp_id,
         SUM(CASE WHEN button_status = 2 THEN output_pairs ELSE 0 END), 
         SUM(target_mins), 
         SUM(actual_time), 
         0, 
         MAX(button_status)
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
    console.log(`✅ Updated summary for Machine 01 - 24 pairs finished, 1 bin running`);

    // Recalculate summary for Machine 06 (still 24 pairs finished, but now has running record)
    await db.query(
      `INSERT INTO machine_centre_summary 
       (prod_date, work_centre_id, machine_id, emp_id, total_output_pairs, total_target_mins, 
        total_actual_mins, total_idle_mins, button_status)
       SELECT prod_date, work_centre_id, machine_id, emp_id,
         SUM(CASE WHEN button_status = 2 THEN output_pairs ELSE 0 END), 
         SUM(target_mins), 
         SUM(actual_time), 
         0, 
         MAX(button_status)
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
    console.log(`✅ Updated summary for Machine 06 - 24 pairs finished, 1 bin running`);

    console.log('\n========================================');
    console.log('✅ 3rd bin added - RUNNING status!');
    console.log('========================================');
    console.log('Machine 01 (S. Mythi - 165):');
    console.log('  - 2 bins FINISHED: 24 pairs');
    console.log('  - 1 bin RUNNING: started at 10:25');
    console.log('');
    console.log('Machine 06 (P. Poornima - 724):');
    console.log('  - 2 bins FINISHED: 24 pairs');
    console.log('  - 1 bin RUNNING: started at 10:25');
    console.log('========================================');
    console.log('Operators can now press FINISH when done');
    console.log('========================================');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

addThirdBinRunning();
