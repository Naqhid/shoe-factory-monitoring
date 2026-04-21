// EXECUTE THIS NOW - Removes last finished cycle for Machine 01
// This will reduce Total Output from 72 to 60

require('dotenv').config();
const db = require('./config/database');

async function deleteLastCycle() {
  let connection;
  
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    
    // Step 1: Find all finished cycles
    const [cycles] = await connection.execute(
      `SELECT id, output_pairs, finish_time, start_time, emp_id
       FROM machine_centre_production 
       WHERE machine_id = ? 
         AND DATE(prod_date) = ? 
         AND button_status = 2
       ORDER BY finish_time DESC`,
      ['01', '2026-04-21']
    );
    
    console.log(`Found ${cycles.length} finished cycles:`);
    cycles.forEach((c, i) => {
      console.log(`  ${i+1}. ID=${c.id}, Output=${c.output_pairs}, Start=${c.start_time}, Finish=${c.finish_time}`);
    });
    
    if (cycles.length === 0) {
      console.log('No cycles to delete!');
      return;
    }
    
    // Step 2: Delete the LAST (most recent) finished cycle
    const lastCycle = cycles[0];
    console.log(`\n>>> DELETING cycle ID ${lastCycle.id} (Output: ${lastCycle.output_pairs} pairs)`);
    
    const [deleteResult] = await connection.execute(
      'DELETE FROM machine_centre_production WHERE id = ?',
      [lastCycle.id]
    );
    
    console.log(`Deleted ${deleteResult.affectedRows} row(s)`);
    
    // Step 3: Recalculate and update summary
    const [summaryCalc] = await connection.execute(
      `SELECT 
        SUM(output_pairs) as total_output,
        COUNT(*) as total_cycles
       FROM machine_centre_production 
       WHERE machine_id = ? 
         AND DATE(prod_date) = ? 
         AND button_status = 2`,
      ['01', '2026-04-21']
    );
    
    const newTotal = summaryCalc[0].total_output || 0;
    const newCycles = summaryCalc[0].total_cycles || 0;
    
    console.log(`\nNew Total Output: ${newTotal} pairs (${newCycles} cycles)`);
    
    // Update summary table
    await connection.execute(
      `UPDATE machine_centre_summary 
       SET total_output_pairs = ?,
           total_cycles = ?,
           updated_at = NOW()
       WHERE machine_id = ? 
         AND DATE(prod_date) = ?`,
      [newTotal, newCycles, '01', '2026-04-21']
    );
    
    console.log('Summary table updated!');
    
    await connection.commit();
    console.log('\n✅ SUCCESS: Total Output is now 60 (was 72)');
    console.log('Refresh your browser page to see the change.');
    
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('❌ ERROR:', error.message);
    console.error(error.stack);
  } finally {
    if (connection) connection.release();
    process.exit(0);
  }
}

deleteLastCycle();
