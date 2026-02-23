// Add missing stoppage columns to prod_data table
require('dotenv').config();
const mysql = require('mysql2/promise');

async function addColumns() {
  console.log('Connecting to database...');
  
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });
    
    console.log('✅ Connected');
    
    // Add stoppage_reason column
    console.log('Adding stoppage_reason column...');
    try {
      await connection.execute(`ALTER TABLE prod_data ADD COLUMN stoppage_reason VARCHAR(100)`);
      console.log('✅ stoppage_reason added');
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log('✅ stoppage_reason already exists');
      } else {
        throw err;
      }
    }
    
    // Add idle_stop_time column
    console.log('Adding idle_stop_time column...');
    try {
      await connection.execute(`ALTER TABLE prod_data ADD COLUMN idle_stop_time INT DEFAULT 0`);
      console.log('✅ idle_stop_time added');
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log('✅ idle_stop_time already exists');
      } else {
        throw err;
      }
    }
    
    await connection.end();
    console.log('\n✅ Done! Restart backend.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

addColumns();
