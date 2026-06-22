const mysql = require('mysql2/promise');

async function main() {
  const db = await mysql.createConnection({
    host: 'localhost', port: 3306, user: 'root', password: 'Shoe@123', database: 'florence'
  });

  // 1. Raw count for June 20
  const [[r1]] = await db.query(
    "SELECT COUNT(*) as cnt FROM machine_centre_production WHERE DATE(prod_date) = '2026-06-20' AND button_status = 2"
  );
  console.log('Records on 2026-06-20 (button_status=2):', r1.cnt);

  // 2. What dates do we actually have near June 20?
  const [r2] = await db.query(
    "SELECT DATE(prod_date) as d, COUNT(*) as cnt FROM machine_centre_production WHERE prod_date BETWEEN '2026-06-18' AND '2026-06-22' GROUP BY DATE(prod_date) ORDER BY d"
  );
  console.log('Data around June 20:');
  console.table(r2);

  // 3. Check what machine_id the EOL resolver would pick for work_centre 5
  const [r3] = await db.query(
    "SELECT DISTINCT machine_id FROM machine_centre_production WHERE DATE(prod_date) = '2026-06-20' AND button_status = 2"
  );
  console.log('machine_ids on 2026-06-20:', r3.map(r => r.machine_id));

  // 4. Show sample rows
  const [r4] = await db.query(
    "SELECT id, prod_date, work_centre_id, machine_id, output_pairs, button_status FROM machine_centre_production WHERE DATE(prod_date) = '2026-06-20' AND button_status = 2 LIMIT 5"
  );
  console.log('Sample rows:');
  console.table(r4);

  await db.end();
}
main().catch(console.error);
