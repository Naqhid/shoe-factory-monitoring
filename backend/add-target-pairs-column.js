// Add missing target_pairs column to prod_data table
require('dotenv').config();
const mysql = require('mysql2/promise');

async function addColumn() {
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
    
    // Add target_pairs column
    console.log('Adding target_pairs column...');
    try {
      await connection.execute(`
        ALTER TABLE prod_data 
        ADD COLUMN target_pairs INT DEFAULT 0 AFTER output_pairs
      `);
      console.log('✅ Column added successfully!');
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log('✅ Column already exists!');
      } else {
        throw err;
      }
    }
    
    // Verify
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'prod_data'
    `, [process.env.DB_NAME]);
    
    console.log('\nColumns in prod_data table:');
    columns.forEach(col => console.log('  -', col.COLUMN_NAME));
    
    await connection.end();
    console.log('\n✅ Done! Restart the backend now.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

addColumn();
