const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function restoreDatabase() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'your_password',
    multipleStatements: true
  });

  try {
    const sqlDump = fs.readFileSync(path.join(__dirname, 'dump-shoe_factory-202603041608.sql'), 'utf8');
    await connection.query(sqlDump);
    console.log('Database restored successfully!');
  } catch (error) {
    console.error('Error restoring database:', error);
  } finally {
    await connection.end();
  }
}

restoreDatabase();
