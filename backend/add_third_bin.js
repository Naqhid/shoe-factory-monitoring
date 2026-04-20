require('dotenv').config();
const db = require('./config/database');

async function addThirdBin() {
  try {
    const today = '2026-04-20';
    console.log(`Adding 3rd bin data for date: ${today}`);

    // Machine 01 - S. Mythi (165) - Bin 3: Started at 10:25, finished at ~10:53 (28.2 mins target)
    const [prod1] = await db.query(
      `INSERT INTO machine_centre_production 
       (prod_date, work_centre_id, machine_id, emp_id, output_pairs, target_mins,
        start_time, finish_time, button_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [today, 5, '01', 165, 12, 28.2, 
       '2026-04-20 10:25:00', '2026-04-20 10:53:00', 2]
    );
    console.log(`✅ Added bin 3 for Machine 01 - S. Mythi (10:25-10:53) - 12 pairs`);

    // Machine 06 - P. Poornima (724) - Bin 3: Started at 10:25, finished at ~10:53
    const [prod2] = await db.query(
      `INSERT INTO machine_centre_production 
       (prod_date, work_centre_id, machine_id, emp_id, output_pairs, target_mins,
        start_time, finish_time, button_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [today, 5, '06', 724, 12, 28.2,
       '2026-04-20 10:25:00', '2026-04-20 10:53:00', 2]
    );
    console.log(`✅ Added bin 3 for Machine 06 - P. Poornima (10:25-10:53) - 12 pairs`);

    // Recalculate summary for Machine 01 (now 36 pairs total)
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
    console.log(`✅ Updated summary for Machine 01 - Total: 36 pairs (3 bins)`);

    // Recalculate summary for Machine 06 (now 36 pairs total)
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
    console.log(`✅ Updated summary for Machine 06 - Total: 36 pairs (3 bins)`);

    console.log('\n========================================');
    console.log('✅ 3rd bin data added successfully!');
    console.log('========================================');
    console.log('Machine 01 (S. Mythi - 165): 36 pairs total');
    console.log('  - Bin 1: 09:00 - 09:45 (12 pairs)');
    console.log('  - Bin 2: 09:45 - 10:30 (12 pairs)');
    console.log('  - Bin 3: 10:25 - 10:53 (12 pairs) ← Added');
    console.log('');
    console.log('Machine 06 (P. Poornima - 724): 36 pairs total');
    console.log('  - Bin 1: 09:00 - 09:45 (12 pairs)');
    console.log('  - Bin 2: 09:45 - 10:30 (12 pairs)');
    console.log('  - Bin 3: 10:25 - 10:53 (12 pairs) ← Added');
    console.log('========================================');
    console.log('Line 2A Total Output: 72 pairs');
    console.log('========================================');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

addThirdBin();
