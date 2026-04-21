const db = require('./config/database');

async function checkMachine01Today() {
  const conn = await db.getConnection();
  try {
    const today = new Date().toISOString().split('T')[0];
    const machineId = '01';
    
    console.log(`=== DIAGNOSTIC: Machine ${machineId} on ${today} ===\n`);
    
    // 1. Check all records in machine_centre_production
    console.log('1. MACHINE_CENTRE_PRODUCTION Records:');
    const [productionRecords] = await conn.execute(
      `SELECT id, emp_id, output_pairs, target_pairs, target_mins, 
              button_status, start_time, finish_time, created_at
       FROM machine_centre_production 
       WHERE machine_id = ? AND prod_date = ?
       ORDER BY created_at DESC`,
      [machineId, today]
    );
    
    if (productionRecords.length === 0) {
      console.log('   No records found.\n');
    } else {
      productionRecords.forEach(r => {
        console.log(`   ID ${r.id}: emp=${r.emp_id}, output=${r.output_pairs}, target=${r.target_pairs}, status=${r.button_status}`);
        console.log(`       start=${r.start_time}, finish=${r.finish_time}`);
      });
      console.log();
    }
    
    // 2. Check finished records only (button_status=2) - these count toward total
    console.log('2. FINISHED Records (button_status=2) - These contribute to TOTAL OUTPUT:');
    const [finishedRecords] = await conn.execute(
      `SELECT id, emp_id, output_pairs, target_pairs, 
              TIMESTAMPDIFF(MINUTE, start_time, finish_time) as actual_mins,
              finish_time
       FROM machine_centre_production 
       WHERE machine_id = ? AND prod_date = ? AND button_status = 2`,
      [machineId, today]
    );
    
    let totalFinishedOutput = 0;
    if (finishedRecords.length === 0) {
      console.log('   No finished records found.\n');
    } else {
      finishedRecords.forEach(r => {
        console.log(`   ID ${r.id}: output=${r.output_pairs} pairs, actual_mins=${r.actual_mins}`);
        totalFinishedOutput += parseInt(r.output_pairs) || 0;
      });
      console.log(`   TOTAL FINISHED OUTPUT: ${totalFinishedOutput} pairs\n`);
    }
    
    // 3. Check machine_centre_summary
    console.log('3. MACHINE_CENTRE_SUMMARY Table:');
    const [summaryRecords] = await conn.execute(
      `SELECT id, emp_id, total_output_pairs, total_cycles, cum_avg_time, updated_at
       FROM machine_centre_summary 
       WHERE machine_id = ? AND prod_date = ?`,
      [machineId, today]
    );
    
    if (summaryRecords.length === 0) {
      console.log('   No summary records found.\n');
    } else {
      summaryRecords.forEach(r => {
        console.log(`   ID ${r.id}: total_output=${r.total_output_pairs}, cycles=${r.total_cycles}, avg_time=${r.cum_avg_time}`);
      });
      console.log();
    }
    
    // 4. Check machine_centre_app (legacy table)
    console.log('4. MACHINE_CENTRE_APP Table (legacy):');
    const [appRecords] = await conn.execute(
      `SELECT id, emp_id, output_pairs, target_pairs, button_status, start_time, finish_time
       FROM machine_centre_app 
       WHERE machine_id = ? AND prod_date = CURDATE()`,
      [machineId]
    );
    
    if (appRecords.length === 0) {
      console.log('   No records found.\n');
    } else {
      appRecords.forEach(r => {
        console.log(`   ID ${r.id}: emp=${r.emp_id}, output=${r.output_pairs}, status=${r.button_status}`);
      });
      console.log();
    }
    
    // 5. Summary
    console.log('=== SUMMARY ===');
    console.log(`Production records found: ${productionRecords.length}`);
    console.log(`Finished cycles (status=2): ${finishedRecords.length}`);
    console.log(`Total output pairs (from finished): ${totalFinishedOutput}`);
    console.log(`Summary records: ${summaryRecords.length}`);
    
    if (totalFinishedOutput > 0 && productionRecords.length === 0) {
      console.log('\n⚠️  ANOMALY: Total output > 0 but no production records found!');
    }
    
    if (totalFinishedOutput === 12) {
      console.log('\n✓ Found exactly 12 pairs - this is likely 1 finished cycle with target_pairs=12');
    }
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    conn.release();
    process.exit(0);
  }
}

checkMachine01Today();
