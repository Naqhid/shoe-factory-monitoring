const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'shoe_factory'
};

async function addZaidEmployee() {
    let connection;
    try {
        console.log('Connecting to database...');
        connection = await mysql.createConnection(dbConfig);

        // Check if Zaid already exists
        const [existingRows] = await connection.execute('SELECT id FROM employees WHERE name = "Zaid" OR code LIKE "%zaid%"');
        if (existingRows.length > 0) {
            console.log('Zaid already exists in database');
            return;
        }

        // Get work centre ID (use existing one or default to 1)
        const [wcRows] = await connection.execute('SELECT id FROM work_centres LIMIT 1');
        const wcId = wcRows.length > 0 ? wcRows[0].id : 1;

        // Add Zaid as employee
        const [result] = await connection.execute(
            'INSERT INTO employees (code, name, work_centre_id) VALUES (?, ?, ?)',
            ['EMP-ZAID', 'Zaid', wcId]
        );

        console.log(`✅ Successfully added Zaid as employee with ID: ${result.insertId}`);
        console.log(`   Code: EMP-ZAID`);
        console.log(`   Name: Zaid`);
        console.log(`   Work Centre ID: ${wcId}`);

    } catch (error) {
        console.error('❌ Error adding Zaid:', error);
    } finally {
        if (connection) await connection.end();
    }
}

addZaidEmployee();