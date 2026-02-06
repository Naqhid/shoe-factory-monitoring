const mysql = require('mysql2/promise');
require('dotenv').config();

async function insertSampleData() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    console.log('Connected to database...');

    // Add stoppage_reason column if not exists
    try {
      await connection.execute(
        'ALTER TABLE prod_data ADD COLUMN stoppage_reason VARCHAR(255) NULL'
      );
      console.log('Added stoppage_reason column');
    } catch (e) {
      console.log('stoppage_reason column already exists');
    }

    // Add target_pairs column if not exists
    try {
      await connection.execute(
        'ALTER TABLE prod_data ADD COLUMN target_pairs INT DEFAULT 0'
      );
      console.log('Added target_pairs column');
    } catch (e) {
      console.log('target_pairs column already exists');
    }

    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const lastWeek = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

    // Insert hourly production data for today
    const prodData = [
      [today, 1, 'M-001', 1, 45, 50, 0, null, `${today} 08:30:00`],
      [today, 2, 'M-002', 1, 42, 50, 5, 'Material Shortage', `${today} 08:45:00`],
      [today, 1, 'M-001', 1, 48, 50, 0, null, `${today} 09:30:00`],
      [today, 2, 'M-002', 1, 50, 50, 0, null, `${today} 09:45:00`],
      [today, 3, 'M-003', 1, 40, 50, 10, 'Machine Breakdown', `${today} 09:50:00`],
      [today, 1, 'M-001', 1, 50, 50, 0, null, `${today} 10:30:00`],
      [today, 2, 'M-002', 1, 47, 50, 3, 'Power Cut', `${today} 10:45:00`],
      [today, 3, 'M-003', 1, 45, 50, 5, 'Material Shortage', `${today} 10:50:00`],
      [today, 1, 'M-001', 1, 52, 50, 0, null, `${today} 11:30:00`],
      [today, 2, 'M-002', 1, 48, 50, 2, 'Quality Issue', `${today} 11:45:00`],
      [today, 3, 'M-003', 1, 50, 50, 0, null, `${today} 11:50:00`],
      [today, 1, 'M-001', 1, 46, 50, 4, 'Material Shortage', `${today} 13:30:00`],
      [today, 2, 'M-002', 1, 50, 50, 0, null, `${today} 13:45:00`],
      [today, 3, 'M-003', 1, 48, 50, 2, 'Machine Breakdown', `${today} 13:50:00`],
      [today, 1, 'M-001', 1, 50, 50, 0, null, `${today} 14:30:00`],
      [today, 2, 'M-002', 1, 49, 50, 1, 'Power Cut', `${today} 14:45:00`],
      [today, 3, 'M-003', 1, 50, 50, 0, null, `${today} 14:50:00`]
    ];

    for (const data of prodData) {
      await connection.execute(
        `INSERT INTO prod_data (prod_date, work_centre_id, machine_id, emp_id, output_pairs, target_pairs, idle_stop_time, stoppage_reason, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        data
      );
    }

    // Insert yesterday's data
    await connection.execute(
      'INSERT INTO prod_data (prod_date, work_centre_id, machine_id, emp_id, output_pairs, target_pairs, created_at) VALUES (?, 1, "M-001", 1, 420, 500, ?)',
      [yesterday, `${yesterday} 14:00:00`]
    );

    // Insert last week's data
    await connection.execute(
      'INSERT INTO prod_data (prod_date, work_centre_id, machine_id, emp_id, output_pairs, target_pairs, created_at) VALUES (?, 1, "M-001", 1, 400, 500, ?)',
      [lastWeek, `${lastWeek} 14:00:00`]
    );

    console.log('✅ Sample production tracker data inserted successfully!');
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

insertSampleData();
