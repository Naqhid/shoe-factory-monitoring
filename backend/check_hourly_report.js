const db = require('./config/database');

async function checkHourlyReport() {
  const conn = await db.getConnection();
  try {
    const date = '2026-04-20';
    const machineId = '03';
    
    console.log(`Checking hourly production data for Machine ${machineId} on ${date}\n`);
    
    // Check all records
    const [allRecords] = await conn.execute(
      `SELECT id, output_pairs, button_status, HOUR(start_time) as hour, start_time, finish_time, created_at
       FROM machine_centre_production 
       WHERE machine_id = ? AND prod_date = ?
       ORDER BY start_time`,
      [machineId, date]
    );
    
    console.log('All records:');
    allRecords.forEach(r => {
      console.log(`  ID ${r.id}: hour=${r.hour}, output=${r.output_pairs}, status=${r.button_status}, start=${r.start_time}, finish=${r.finish_time}`);
    });
    
    // Check finished only (button_status=2)
    const [finishedRecords] = await conn.execute(
      `SELECT HOUR(start_time) as hour, SUM(output_pairs) as total
       FROM machine_centre_production 
       WHERE machine_id = ? AND prod_date = ? AND button_status = 2
       GROUP BY HOUR(start_time)
       ORDER BY hour`,
      [machineId, date]
    );
    
    console.log('\nFinished records (button_status=2) by hour:');
    finishedRecords.forEach(r => {
      console.log(`  Hour ${r.hour}: ${r.total} pairs`);
    });
    
    // Total finished
    const [totalFinished] = await conn.execute(
      `SELECT SUM(output_pairs) as total, COUNT(*) as cycles
       FROM machine_centre_production 
       WHERE machine_id = ? AND prod_date = ? AND button_status = 2`,
      [machineId, date]
    );
    
    console.log(`\nTotal FINISHED output: ${totalFinished[0]?.total || 0} pairs (${totalFinished[0]?.cycles || 0} cycles)`);
    
    // Total all (including unfinished)
    const [totalAll] = await conn.execute(
      `SELECT SUM(output_pairs) as total, COUNT(*) as cycles,
              SUM(CASE WHEN button_status = 2 THEN output_pairs ELSE 0 END) as finished_output
       FROM machine_centre_production 
       WHERE machine_id = ? AND prod_date = ?`,
      [machineId, date]
    );
    
    console.log(`Total ALL output (including unfinished): ${totalAll[0]?.total || 0} pairs (${totalAll[0]?.cycles || 0} cycles)`);
    console.log(`Finished portion: ${totalAll[0]?.finished_output || 0} pairs`);
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    conn.release();
    process.exit(0);
  }
}

checkHourlyReport();
