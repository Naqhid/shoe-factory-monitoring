// Script to remove the last finished cycle for Machine 01 on Apr 21, 2026
// This will reduce Total Output from 72 to 60

require('dotenv').config();
const db = require('./config/database');

async function removeLastCycle() {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // Find the last finished cycle
    const [lastCycle] = await connection.execute(
      `SELECT id, output_pairs, finish_time, machine_id, emp_id
       FROM machine_centre_production 
       WHERE machine_id = ? 
         AND DATE(prod_date) = ? 
         AND button_status = 2
       ORDER BY finish_time DESC 
       LIMIT 1`,
      ['01', '2026-04-21']
    );
    
    if (lastCycle.length === 0) {
      console.log('No finished cycles found for Machine 01 on 2026-04-21');
      return;
    }
    
    const cycle = lastCycle[0];
    console.log(`Found last cycle: ID=${cycle.id}, Output=${cycle.output_pairs}, Finished=${cycle.finish_time}`);
    
    // Confirm before deleting
    console.log(`\nThis will DELETE cycle ${cycle.id} and reduce Total Output from 72 to 60.`);
    console.log('To confirm deletion, uncomment the DELETE lines below and run again.');
    
    // Uncomment these lines to actually delete:
    // await connection.execute(
    //   'DELETE FROM machine_centre_production WHERE id = ?',
    //   [cycle.id]
    // );
    // console.log(`Deleted cycle ${cycle.id}`);
    
    // Update summary table after deletion
    // await connection.execute(
    //   `INSERT INTO machine_centre_summary (...)
    //    SELECT ... FROM machine_centre_production ...
    //    WHERE machine_id = '01' AND DATE(prod_date) = '2026-04-21' AND button_status = 2
    //    GROUP BY ...
    //    ON DUPLICATE KEY UPDATE ...`
    // );
    
    await connection.commit();
    console.log('Operation completed. Check the Total Output display.');
    
  } catch (error) {
    await connection.rollback();
    console.error('Error:', error);
  } finally {
    connection.release();
    process.exit(0);
  }
}

removeLastCycle();
