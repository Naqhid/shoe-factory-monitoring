const db = require('./config/database');

async function checkRecords() {
  const conn = await db.getConnection();
  try {
    const today = '2026-04-20';
    const machineId = '03';
    const empId = '278';
    
    console.log(`Checking all records for Machine ${machineId}, Employee ${empId} on ${today}...\n`);
    
    // Check production records with button_status
    const [production] = await conn.execute(
      `SELECT id, output_pairs, button_status, start_time, finish_time, actual_time, created_at, updated_at 
       FROM machine_centre_production 
       WHERE machine_id = ? AND emp_id = ? AND prod_date = ?
       ORDER BY id DESC`,
      [machineId, empId, today]
    );
    
    console.log('All production records:');
    production.forEach(r => {
      console.log(`  ID ${r.id}: output_pairs=${r.output_pairs}, button_status=${r.button_status}, finish_time=${r.finish_time}`);
    });
    
    // Count finished records
    const finished = production.filter(r => r.button_status === 2);
    console.log(`\nFinished records (button_status=2): ${finished.length}`);
    const totalFinishedOutput = finished.reduce((sum, r) => sum + r.output_pairs, 0);
    console.log(`Total output from finished records: ${totalFinishedOutput}`);
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    conn.release();
    process.exit(0);
  }
}

checkRecords();
