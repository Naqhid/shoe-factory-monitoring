require('dotenv').config();
const db = require('./config/database');

async function addMissedProduction() {
  try {
    const today = '2026-04-20';
    console.log(`Adding missed production data for date: ${today}`);

    // Machine 01 - S. Mythi (165) - Bin 1: 09:00 to 09:45
    const [prod1] = await db.query(
      `INSERT INTO machine_centre_production 
       (prod_date, work_centre_id, machine_id, emp_id, output_pairs, target_mins,
        start_time, finish_time, button_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [today, 2, '01', 165, 12, 28.2, 
       '2026-04-20 09:00:00', '2026-04-20 09:45:00', 2]
    );
    console.log(`✅ Added bin 1 for Machine 01 - S. Mythi (09:00-09:45)`);

    // Machine 01 - S. Mythi (165) - Bin 2: 09:45 to 10:30
    const [prod2] = await db.query(
      `INSERT INTO machine_centre_production 
       (prod_date, work_centre_id, machine_id, emp_id, output_pairs, target_mins,
        start_time, finish_time, button_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [today, 2, '01', 165, 12, 28.2,
       '2026-04-20 09:45:00', '2026-04-20 10:30:00', 2]
    );
    console.log(`✅ Added bin 2 for Machine 01 - S. Mythi (09:45-10:30)`);

    // Machine 06 - P. Poornima (724) - Bin 1: 09:00 to 09:45
    const [prod3] = await db.query(
      `INSERT INTO machine_centre_production 
       (prod_date, work_centre_id, machine_id, emp_id, output_pairs, target_mins,
        start_time, finish_time, button_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [today, 2, '06', 724, 12, 28.2,
       '2026-04-20 09:00:00', '2026-04-20 09:45:00', 2]
    );
    console.log(`✅ Added bin 1 for Machine 06 - P. Poornima (09:00-09:45)`);

    // Machine 06 - P. Poornima (724) - Bin 2: 09:45 to 10:30
    const [prod4] = await db.query(
      `INSERT INTO machine_centre_production 
       (prod_date, work_centre_id, machine_id, emp_id, output_pairs, target_mins,
        start_time, finish_time, button_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [today, 2, '06', 724, 12, 28.2,
       '2026-04-20 09:45:00', '2026-04-20 10:30:00', 2]
    );
    console.log(`✅ Added bin 2 for Machine 06 - P. Poornima (09:45-10:30)`);

    // Update summary for Machine 01 using the refresh logic
    await db.query(
      `INSERT INTO machine_centre_summary 
       (prod_date, work_centre_id, machine_id, emp_id, total_output_pairs, total_target_mins, 
        total_actual_mins, total_idle_mins, button_status)
       SELECT prod_date, work_centre_id, machine_id, emp_id,
         SUM(output_pairs), SUM(target_mins), SUM(actual_time), 0, MAX(button_status)
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
    console.log(`✅ Updated summary for Machine 01 - Total: 24 pairs`);

    // Update summary for Machine 06 using the refresh logic
    await db.query(
      `INSERT INTO machine_centre_summary 
       (prod_date, work_centre_id, machine_id, emp_id, total_output_pairs, total_target_mins, 
        total_actual_mins, total_idle_mins, button_status)
       SELECT prod_date, work_centre_id, machine_id, emp_id,
         SUM(output_pairs), SUM(target_mins), SUM(actual_time), 0, MAX(button_status)
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
    console.log(`✅ Updated summary for Machine 06 - Total: 24 pairs`);

    console.log('\n========================================');
    console.log('✅ All production data added successfully!');
    console.log('========================================');
    console.log('Machine 01 (S. Mythi - 165): 24 pairs (2 bins)');
    console.log('  - Bin 1: 09:00 - 09:45 (12 pairs)');
    console.log('  - Bin 2: 09:45 - 10:30 (12 pairs)');
    console.log('');
    console.log('Machine 06 (P. Poornima - 724): 24 pairs (2 bins)');
    console.log('  - Bin 1: 09:00 - 09:45 (12 pairs)');
    console.log('  - Bin 2: 09:45 - 10:30 (12 pairs)');
    console.log('========================================');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

addMissedProduction();
