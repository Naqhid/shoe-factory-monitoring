const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'shoe_factory'
};

async function seedDemoData() {
    let connection;
    try {
        console.log('Connecting to database...');
        connection = await mysql.createConnection(dbConfig);

        // 1. Clear existing demo data (optional, but good for clean state)
        // We won't delete everything, just ensure our demo records exist.

        // 2. Insert Work Centre
        console.log('Seeding Work Centres...');
        const [wcRows] = await connection.execute('SELECT id FROM work_centres WHERE code = "WC-DEMO-01"');
        let wcId;
        if (wcRows.length === 0) {
            const [res] = await connection.execute(
                'INSERT INTO work_centres (code, name) VALUES (?, ?)',
                ['WC-DEMO-01', 'Stitching Line A']
            );
            wcId = res.insertId;
            console.log('Created Work Centre: Stitching Line A');
        } else {
            wcId = wcRows[0].id;
            console.log('Work Centre exists');
        }

        // 3. Insert Machines (Machine Centres)
        const demoMachines = [
            { code: 'M-001', name: 'Stitching Machine 1', machine_id: 'MAC-001' },
            { code: 'M-002', name: 'Stitching Machine 2', machine_id: 'MAC-002' },
            { code: 'M-003', name: 'Stitching Machine 3', machine_id: 'MAC-003' }
        ];

        for (const machine of demoMachines) {
            const [mRows] = await connection.execute('SELECT id FROM machine_centres WHERE code = ?', [machine.code]);
            if (mRows.length === 0) {
                await connection.execute(
                    'INSERT INTO machine_centres (work_centre_id, code, name, machine_id) VALUES (?, ?, ?, ?)',
                    [wcId, machine.code, machine.name, machine.machine_id]
                );
                console.log(`Created Machine: ${machine.name} (${machine.machine_id})`);
            } else {
                console.log(`Machine ${machine.name} exists`);
            }
        }

        // 4. Insert Employees
        const demoEmployees = [
            { code: 'EMP-1001', name: 'John Doe' },
            { code: 'EMP-1002', name: 'Jane Smith' },
            { code: 'EMP-1003', name: 'Bob Operator' }
        ];

        for (const emp of demoEmployees) {
            const [eRows] = await connection.execute('SELECT id FROM employees WHERE code = ?', [emp.code]);
            if (eRows.length === 0) {
                await connection.execute(
                    'INSERT INTO employees (code, name, work_centre_id) VALUES (?, ?, ?)',
                    [emp.code, emp.name, wcId]
                );
                console.log(`Created Employee: ${emp.name} (${emp.code})`);
            } else {
                console.log(`Employee ${emp.name} exists`);
            }
        }

        // 5. Insert Users for Web Login
        const demoUsers = [
            { code: 'admin', name: 'Admin User', email: 'admin@example.com', password: 'admin123', role: 'admin' },
            { code: 'user', name: 'Standard User', email: 'user@example.com', password: 'user123', role: 'user' }
        ];

        for (const user of demoUsers) {
            const [uRows] = await connection.execute('SELECT id FROM users WHERE code = ?', [user.code]);
            if (uRows.length === 0) {
                // In a real app, hash the password! For demo, storing plain text as schema implies (VARCHAR).
                await connection.execute(
                    'INSERT INTO users (code, name, email, password, role) VALUES (?, ?, ?, ?, ?)',
                    [user.code, user.name, user.email, user.password, user.role]
                );
                console.log(`Created User: ${user.code}`);
            } else {
                console.log(`User ${user.code} exists`);
            }
        }

        console.log('\n✅ Demo Data Seeded Successfully!');

    } catch (error) {
        console.error('❌ Error seeding data:', error);
    } finally {
        if (connection) await connection.end();
    }
}

seedDemoData();
