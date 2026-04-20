require('dotenv').config();
const db = require('./config/database');

async function deleteTodayData() {
  try {
    // Get today's date
    const today = new Date().toISOString().split('T')[0];
    console.log(`Deleting data for date: ${today}`);

    // Delete from machine_centre_production
    const [prodResult] = await db.query(
      'DELETE FROM machine_centre_production WHERE prod_date = ?',
      [today]
    );
    console.log(`✅ Deleted ${prodResult.affectedRows} rows from machine_centre_production`);

    // Delete from machine_centre_summary
    const [summaryResult] = await db.query(
      'DELETE FROM machine_centre_summary WHERE prod_date = ?',
      [today]
    );
    console.log(`✅ Deleted ${summaryResult.affectedRows} rows from machine_centre_summary`);

    console.log('Done!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

deleteTodayData();
