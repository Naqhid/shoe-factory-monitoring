// Test database connection
require('dotenv').config();
const mysql = require('mysql2/promise');

async function testConnection() {
  console.log('Testing database connection...');
  console.log('Host:', process.env.DB_HOST);
  console.log('Port:', process.env.DB_PORT);
  console.log('User:', process.env.DB_USER);
  console.log('Database:', process.env.DB_NAME);
  
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      connectTimeout: 5000
    });
    
    console.log('✅ Connected successfully!');
    
    // Test query
    const [rows] = await connection.execute('SELECT COUNT(*) as count FROM users');
    console.log(`✅ Found ${rows[0].count} users in database`);
    
    await connection.end();
    console.log('✅ Connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.error('Error code:', error.code);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 MySQL is not running or wrong host/port');
      console.error('   Check: Is MySQL running on 192.168.56.103:3306?');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('\n💡 Wrong username or password');
      console.error('   Check: DB_USER and DB_PASSWORD in .env file');
    } else if (error.code === 'ETIMEDOUT') {
      console.error('\n💡 Connection timeout');
      console.error('   Check: Can you reach 192.168.56.103 from this machine?');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.error('\n💡 Database does not exist');
      console.error('   Check: Does "shoe_factory" database exist?');
    }
    
    process.exit(1);
  }
}

testConnection();
