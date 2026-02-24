require('dotenv').config();
const mysql = require('mysql2/promise');

async function runMigration() {
  let connection;
  
  try {
    console.log('🔄 Connecting to database...');
    
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'shoe_factory',
      multipleStatements: true
    });

    console.log('✅ Connected to database');
    console.log('🔄 Creating machine_centre_production table...');

    // Create machine_centre_production table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS machine_centre_production (
        id INT AUTO_INCREMENT PRIMARY KEY,
        prod_date DATE NOT NULL,
        work_centre_id INT NOT NULL,
        machine_id VARCHAR(100) NOT NULL,
        emp_id VARCHAR(10) NOT NULL,
        output_pairs INT DEFAULT 12 COMMENT 'Output pairs (normally 12 per entry)',
        target_mins DECIMAL(10,2) NOT NULL COMMENT 'Target time in minutes',
        start_time DATETIME NULL COMMENT 'Production Start Time',
        finish_time DATETIME NULL COMMENT 'Production Finish Time',
        idle_start_time DATETIME NULL COMMENT 'Idle Start Time',
        idle_stop_time DATETIME NULL COMMENT 'Idle Stop Time',
        actual_time DECIMAL(10,2) GENERATED ALWAYS AS (
          CASE 
            WHEN finish_time IS NOT NULL AND start_time IS NOT NULL 
            THEN TIMESTAMPDIFF(MINUTE, start_time, finish_time)
            ELSE 0
          END
        ) STORED COMMENT 'Calculated: finish_time - start_time',
        idle_mins DECIMAL(10,2) GENERATED ALWAYS AS (
          CASE 
            WHEN idle_stop_time IS NOT NULL AND idle_start_time IS NOT NULL 
            THEN TIMESTAMPDIFF(MINUTE, idle_start_time, idle_stop_time)
            ELSE 0
          END
        ) STORED COMMENT 'Calculated: idle_stop_time - idle_start_time',
        button_status INT DEFAULT 1 COMMENT '1 = Start / 2 = Finish / 3 = Stop',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_prod_date (prod_date),
        INDEX idx_machine_id (machine_id),
        INDEX idx_work_centre (work_centre_id),
        INDEX idx_status (button_status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Raw production entries - per 12 pairs'
    `);

    console.log('✅ machine_centre_production table created');
    console.log('🔄 Creating machine_centre_summary table...');

    // Create machine_centre_summary table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS machine_centre_summary (
        id INT AUTO_INCREMENT PRIMARY KEY,
        prod_date DATE NOT NULL,
        work_centre_id INT NOT NULL,
        machine_id VARCHAR(100) NOT NULL,
        emp_id VARCHAR(10) NOT NULL,
        total_output_pairs INT DEFAULT 0 COMMENT 'SUM(output_pairs)',
        total_target_mins DECIMAL(10,2) DEFAULT 0 COMMENT 'SUM(target_mins)',
        total_actual_mins DECIMAL(10,2) DEFAULT 0 COMMENT 'SUM(actual_time)',
        total_idle_mins DECIMAL(10,2) DEFAULT 0 COMMENT 'SUM(idle_mins)',
        avg_efficiency_percent DECIMAL(5,2) DEFAULT 0 COMMENT '(total_actual_mins / total_target_mins) * 100',
        cum_avg_time DECIMAL(10,2) DEFAULT 0 COMMENT 'total_actual_mins / 12',
        button_status INT DEFAULT 1 COMMENT 'Latest status (1/2/3)',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_summary (prod_date, work_centre_id, machine_id, emp_id),
        INDEX idx_summary_date (prod_date),
        INDEX idx_summary_machine (machine_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Summary/Pivot table aggregated from machine_centre_production'
    `);

    console.log('✅ machine_centre_summary table created');
    console.log('🔄 Checking for existing data to migrate...');

    // Check if prod_data table exists
    const [tables] = await connection.execute("SHOW TABLES LIKE 'prod_data'");
    
    if (tables.length > 0) {
      console.log('📦 Found prod_data table, migrating data...');
      
      const [result] = await connection.execute(`
        INSERT IGNORE INTO machine_centre_production (
          prod_date, work_centre_id, machine_id, emp_id, output_pairs,
          target_mins, start_time, finish_time, button_status, created_at, updated_at
        )
        SELECT 
          prod_date, work_centre_id, machine_id, emp_id,
          COALESCE(output_pairs, 12),
          COALESCE(target_mins, 0),
          CASE WHEN start_time IS NOT NULL THEN CONCAT(prod_date, ' ', start_time) ELSE NULL END,
          CASE WHEN finish_time IS NOT NULL THEN CONCAT(prod_date, ' ', finish_time) ELSE NULL END,
          COALESCE(button_status, 1),
          created_at, updated_at
        FROM prod_data
      `);
      
      console.log(`✅ Migrated ${result.affectedRows} records from prod_data`);
    } else {
      console.log('ℹ️  No prod_data table found, skipping data migration');
    }

    console.log('🔄 Populating summary table...');

    // Populate summary table
    const [summaryResult] = await connection.execute(`
      INSERT INTO machine_centre_summary (
        prod_date, work_centre_id, machine_id, emp_id,
        total_output_pairs, total_target_mins, total_actual_mins, total_idle_mins,
        avg_efficiency_percent, cum_avg_time, button_status
      )
      SELECT 
        prod_date, work_centre_id, machine_id, emp_id,
        SUM(output_pairs),
        SUM(target_mins),
        SUM(actual_time),
        SUM(idle_mins),
        CASE WHEN SUM(target_mins) > 0 THEN (SUM(actual_time) / SUM(target_mins)) * 100 ELSE 0 END,
        SUM(actual_time) / 12,
        MAX(button_status)
      FROM machine_centre_production
      GROUP BY prod_date, work_centre_id, machine_id, emp_id
      ON DUPLICATE KEY UPDATE
        total_output_pairs = VALUES(total_output_pairs),
        total_target_mins = VALUES(total_target_mins),
        total_actual_mins = VALUES(total_actual_mins),
        total_idle_mins = VALUES(total_idle_mins),
        avg_efficiency_percent = VALUES(avg_efficiency_percent),
        cum_avg_time = VALUES(cum_avg_time),
        button_status = VALUES(button_status)
    `);

    console.log(`✅ Summary table populated with ${summaryResult.affectedRows} records`);

    // Get final counts
    const [prodCount] = await connection.execute('SELECT COUNT(*) as count FROM machine_centre_production');
    const [summaryCount] = await connection.execute('SELECT COUNT(*) as count FROM machine_centre_summary');

    console.log('\n📊 Migration Summary:');
    console.log(`   Production records: ${prodCount[0].count}`);
    console.log(`   Summary records: ${summaryCount[0].count}`);
    console.log('\n✅ Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run migration
runMigration();
