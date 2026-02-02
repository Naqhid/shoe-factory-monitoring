const mysql = require('mysql2/promise');
require('dotenv').config();

async function setupMobileProductionTables() {
  let connection;

  try {
    // Create connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'shoe_factory'
    });

    console.log('Connected to database...');

    // Create prod_data table
    console.log('Creating prod_data table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS prod_data (
        id INT AUTO_INCREMENT PRIMARY KEY,
        prod_date DATE NOT NULL,
        work_centre_id INT NOT NULL,
        machine_id VARCHAR(100) NOT NULL,
        emp_id INT NOT NULL,
        output_pairs INT DEFAULT 0,
        target_mins INT DEFAULT 0,
        start_time TIME NULL,
        finish_time TIME NULL,
        idle_stop_time INT DEFAULT 0,
        idle_start_time INT DEFAULT 0,
        actual_time INT DEFAULT 0,
        button_status TINYINT DEFAULT 1 COMMENT '1=Start, 2=Finish, 3=Stop',
        target_pairs_per_tray INT DEFAULT 0,
        tray_count INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_prod_date (prod_date),
        INDEX idx_machine_id (machine_id),
        INDEX idx_work_centre (work_centre_id)
      )
    `);
    console.log('✓ prod_data table created successfully');

    // Create pivot_data table
    console.log('Creating pivot_data table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS pivot_data (
        id INT AUTO_INCREMENT PRIMARY KEY,
        table_name VARCHAR(50) NOT NULL DEFAULT 'Prod Data',
        prod_date DATE NOT NULL,
        work_centre_id INT NOT NULL,
        machine_id VARCHAR(100) NOT NULL,
        emp_id INT NOT NULL,
        output_pairs INT DEFAULT 0 COMMENT 'Sum of Target pairs',
        target_mins INT DEFAULT 0 COMMENT 'Sum of Target mins',
        actual_time INT DEFAULT 0 COMMENT 'Sum of Actual time',
        cum_avg_time INT DEFAULT 0 COMMENT 'Actual time/12',
        button_status TINYINT DEFAULT 1 COMMENT '1=Start, 2=Finish, 3=Stop',
        target_pairs_per_tray INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_pivot_prod_date (prod_date),
        INDEX idx_pivot_machine_id (machine_id)
      )
    `);
    console.log('✓ pivot_data table created successfully');

    // Create mobile_sessions table
    console.log('Creating mobile_sessions table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS mobile_sessions (
        session_id VARCHAR(36) PRIMARY KEY,
        machine_id VARCHAR(100),
        status ENUM('waiting', 'active', 'expired') DEFAULT 'waiting',
        work_centre_id INT,
        emp_id INT,
        emp_code VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        activated_at TIMESTAMP NULL,
        INDEX idx_session_status (status)
      )
    `);
    console.log('✓ mobile_sessions table created successfully');

    console.log('\n✅ All mobile production tables created successfully!');

  } catch (error) {
    console.error('❌ Error setting up tables:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed.');
    }
  }
}

// Run the setup
setupMobileProductionTables()
  .then(() => {
    console.log('\n🎉 Setup completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Setup failed:', error);
    process.exit(1);
  });
