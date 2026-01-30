const mysql = require('mysql2/promise');
require('dotenv').config();

async function setupDatabase() {
  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'shoe_factory',
    multipleStatements: true,
  };

  try {
    console.log('Connecting to MySQL...');
    const connection = await mysql.createConnection(config);
    console.log('Connected successfully!');

    // Read and execute all schema files
    const fs = require('fs');
    const path = require('path');

    const schemaFiles = [
      'database_setup.sql',
      'masters_schema.sql',
      'production_planning_schema.sql',
      'production_routing_schema.sql',
    ];

    for (const file of schemaFiles) {
      const filePath = path.join(__dirname, file);
      if (fs.existsSync(filePath)) {
        console.log(`\nExecuting ${file}...`);
        const sql = fs.readFileSync(filePath, 'utf8');
        await connection.query(sql);
        console.log(`✓ ${file} executed successfully`);
      } else {
        console.warn(`Warning: ${file} not found`);
      }
    }

    await connection.end();
    console.log('\n✓ Database setup completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error setting up database:', error.message);
    process.exit(1);
  }
}

setupDatabase();