const mysql = require('mysql2/promise');
require('dotenv').config();

async function expireSession() {
  let conn;
  try {
    conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    // Find and expire the session for machine 04, operator 346, with activation time around 5/20/2026 9:24:47 AM
    const sessionTime = '2026-05-20 09:24:47';
    const machineId = '04';
    const empCode = '346';

    // First, let's find the session
    const [sessions] = await conn.execute(
      `SELECT * FROM mobile_sessions 
       WHERE machine_id = ? AND emp_code = ? AND status = 'active' 
       AND DATE(activated_at) = '2026-05-20'`,
      [machineId, empCode]
    );

    if (sessions.length === 0) {
      console.log('❌ No active session found for the given criteria');
      return;
    }

    console.log('Found sessions:');
    sessions.forEach((s, i) => {
      console.log(`${i + 1}. Session ID: ${s.session_id}`);
      console.log(`   Machine: ${s.machine_id} (Folding)`);
      console.log(`   Operator: ${s.emp_code} (K. Latha)`);
      console.log(`   Work Centre: ${s.work_centre_id}`);
      console.log(`   Status: ${s.status}`);
      console.log(`   Activated at: ${s.activated_at}`);
    });

    if (sessions.length === 1) {
      // Expire the session
      const sessionId = sessions[0].session_id;
      await conn.execute(
        `UPDATE mobile_sessions SET status = 'expired' WHERE session_id = ?`,
        [sessionId]
      );
      console.log(`\n✅ Session ${sessionId} has been expired`);
    } else {
      console.log(`\n⚠️ Found ${sessions.length} sessions. Please specify which one to expire.`);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    if (conn) await conn.end();
  }
}

expireSession();
