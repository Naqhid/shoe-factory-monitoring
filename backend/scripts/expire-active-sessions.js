const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');

(async () => {
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'florence',
    });

    const [res] = await conn.execute(
      `UPDATE mobile_sessions SET status = 'expired' WHERE status = 'active' AND DATE(activated_at) = CURDATE()`
    );

    console.log(`Expired sessions: ${res.affectedRows}`);

    const [rows] = await conn.execute(
      `SELECT machine_id, emp_code, activated_at FROM mobile_sessions WHERE status = 'active' AND DATE(activated_at) = CURDATE() ORDER BY activated_at DESC LIMIT 20`
    );

    if (rows.length === 0) {
      console.log('No active sessions remain for today.');
    } else {
      console.log('Still-active sessions (sample):');
      rows.forEach((r) => console.log(r.machine_id, r.emp_code, r.activated_at));
    }

    await conn.end();
    process.exit(0);
  } catch (err) {
    console.error('Error expiring sessions:', err.message || err);
    process.exit(2);
  }
})();
