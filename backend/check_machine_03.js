const db = require('./config/database');

async function checkMachine03() {
  const conn = await db.getConnection();
  try {
    const today = '2026-04-20';
    const machineId = '03';
    const empId = '278';
    
    console.log(`Checking Machine ${machineId}, Employee ${empId} on ${today}...\n`);
    
    // Check production records
    const [production] = await conn.execute(
      `SELECT id, output_pairs, button_status, start_time, finish_time, actual_time, created_at, updated_at 
       FROM machine_centre_production 
       WHERE machine_id = ? AND emp_id = ? AND prod_date = ?
       ORDER BY id DESC`,
      [machineId, empId, today]
    );
    console.log('Production records:', production);
    
    // Check summary
    const [summary] = await conn.execute(
      `SELECT * FROM machine_centre_summary 
       WHERE machine_id = ? AND emp_id = ? AND prod_date = ?`,
      [machineId, empId, today]
    );
    console.log('\nSummary record:', summary);
    
    // Check if there's any active session
    const [sessions] = await conn.execute(
      `SELECT * FROM mobile_sessions 
       WHERE machine_id = ? AND emp_id = ? AND status = 'active'`,
      [machineId, empId]
    );
    console.log('\nActive sessions:', sessions);
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    conn.release();
    process.exit(0);
  }
}

checkMachine03();
