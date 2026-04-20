const db = require('./config/database');

async function checkCurrent() {
  const conn = await db.getConnection();
  try {
    const today = '2026-04-20';
    const machineId = '03';
    const empId = '278';
    
    // Check current summary
    const [summary] = await conn.execute(
      `SELECT total_output_pairs FROM machine_centre_summary 
       WHERE machine_id = ? AND emp_id = ? AND prod_date = ?`,
      [machineId, empId, today]
    );
    
    console.log('Current Summary total_output_pairs:', summary[0]?.total_output_pairs || 0);
    
    // Check finished records only
    const [finished] = await conn.execute(
      `SELECT COUNT(*) as count, SUM(output_pairs) as total 
       FROM machine_centre_production 
       WHERE machine_id = ? AND emp_id = ? AND prod_date = ? AND button_status = 2`,
      [machineId, empId, today]
    );
    
    console.log('Finished records:', finished[0]?.count || 0, 'Total output:', finished[0]?.total || 0);
    
    // Check unfinished
    const [unfinished] = await conn.execute(
      `SELECT COUNT(*) as count FROM machine_centre_production 
       WHERE machine_id = ? AND emp_id = ? AND prod_date = ? AND button_status != 2`,
      [machineId, empId, today]
    );
    console.log('Unfinished records:', unfinished[0]?.count || 0);
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    conn.release();
    process.exit(0);
  }
}

checkCurrent();
