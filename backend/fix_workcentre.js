require('dotenv').config();
const db = require('./config/database');

async function fix() {
  try {
    // Update work_centre_id from 2 to 5 (Line 2A)
    const [updateResult] = await db.query(
      'UPDATE machine_centre_production SET work_centre_id = 5 WHERE prod_date = CURDATE() AND work_centre_id = 2'
    );
    console.log(`Updated ${updateResult.affectedRows} production records to work_centre_id 5 (Line 2A)`);
    
    // Clear old summary data
    await db.query('DELETE FROM machine_centre_summary WHERE prod_date = CURDATE()');
    console.log('Cleared old summary data');
    
    // Recreate summary with correct work_centre_id
    await db.query(`
      INSERT INTO machine_centre_summary 
        (prod_date, work_centre_id, machine_id, emp_id, total_output_pairs, total_target_mins, 
         total_actual_mins, total_idle_mins, button_status)
      SELECT 
        prod_date, 
        work_centre_id, 
        machine_id, 
        emp_id,
        SUM(output_pairs), 
        SUM(target_mins), 
        SUM(actual_time), 
        0, 
        MAX(button_status)
      FROM machine_centre_production
      WHERE prod_date = CURDATE()
      GROUP BY prod_date, work_centre_id, machine_id, emp_id
    `);
    console.log('Recreated summary data with correct work_centre_id');
    
    // Show current data
    const [production] = await db.query(
      'SELECT machine_id, emp_id, output_pairs, work_centre_id FROM machine_centre_production WHERE prod_date = CURDATE()'
    );
    console.log('\nCurrent production data:');
    production.forEach(p => {
      console.log(`  Machine ${p.machine_id} (Emp ${p.emp_id}): ${p.output_pairs} pairs, Work Centre ${p.work_centre_id}`);
    });
    
    const [summary] = await db.query(
      'SELECT work_centre_id, machine_id, total_output_pairs FROM machine_centre_summary WHERE prod_date = CURDATE()'
    );
    console.log('\nCurrent summary data:');
    summary.forEach(s => {
      console.log(`  Work Centre ${s.work_centre_id}, Machine ${s.machine_id}: ${s.total_output_pairs} pairs`);
    });
    
    console.log('\n✅ Fix complete! Refresh the dashboard to see the updated data.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

fix();
