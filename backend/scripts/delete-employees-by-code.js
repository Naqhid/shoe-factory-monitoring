/**
 * Hard-delete employees by code and all app-known dependent rows.
 * Usage: node scripts/delete-employees-by-code.js 108,85
 */
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function main() {
  const raw = process.argv[2] || '108,85';
  const codes = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!codes.length) {
    console.error('Pass comma-separated employee codes, e.g. 108,85');
    process.exit(1);
  }

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME || 'florence',
    multipleStatements: true,
  });

  const [rows] = await conn.query(
    `SELECT id, code, name FROM employees WHERE code IN (${codes.map(() => '?').join(',')})`,
    codes
  );
  if (rows.length !== codes.length) {
    console.error('Expected employees not all found:', rows);
    process.exit(1);
  }
  console.log('Deleting:', rows);

  const ids = rows.map((r) => r.id);
  const idPlace = ids.map(() => '?').join(',');

  await conn.beginTransaction();
  try {
    for (const code of codes) {
      await conn.query(`DELETE FROM missed_action_states WHERE issue_key LIKE ?`, [`%__${code}__%`]);
    }

    await conn.query(
      `DELETE FROM mobile_sessions WHERE emp_code IN (${codes.map(() => '?').join(',')}) OR emp_id IN (${idPlace})`,
      [...codes, ...ids]
    );

    await conn.query(`DELETE FROM pivot_data WHERE emp_id IN (${idPlace})`, ids);

    await conn.query(
      `DELETE FROM machine_centre_production WHERE emp_id IN (${codes.map(() => '?').join(',')})`,
      codes
    );
    await conn.query(
      `DELETE FROM machine_centre_summary WHERE emp_id IN (${codes.map(() => '?').join(',')})`,
      codes
    );
    await conn.query(
      `DELETE FROM machine_centre_summary_history WHERE emp_id IN (${codes.map(() => '?').join(',')})`,
      codes
    );

    await conn.query(`DELETE FROM line_setup WHERE employee_id IN (${idPlace})`, ids);

    const [del] = await conn.query(`DELETE FROM employees WHERE id IN (${idPlace})`, ids);
    console.log('employees deleted:', del.affectedRows);

    await conn.commit();
    console.log('Done.');
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
