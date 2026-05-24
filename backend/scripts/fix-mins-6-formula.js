require('dotenv').config();
const db = require('../config/database');

(async () => {
  const [cols] = await db.query(`
    SELECT COLUMN_NAME, GENERATION_EXPRESSION
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'production_routing_lines'
      AND COLUMN_NAME = 'mins_6_prs_box'
  `);
  const expr = String(cols[0]?.GENERATION_EXPRESSION || '');
  if (cols.length && expr.includes('1.15')) {
    await db.query('ALTER TABLE production_routing_lines DROP COLUMN mins_6_prs_box');
    await db.query(`
      ALTER TABLE production_routing_lines
      ADD COLUMN mins_6_prs_box decimal(10,4) GENERATED ALWAYS AS ((\`observed_time\` * 6) / 60) STORED
    `);
    console.log('Updated mins_6_prs_box formula');
  } else if (!cols.length) {
    await db.query(`
      ALTER TABLE production_routing_lines
      ADD COLUMN mins_6_prs_box decimal(10,4) GENERATED ALWAYS AS ((\`observed_time\` * 6) / 60) STORED
    `);
    console.log('Added mins_6_prs_box');
  } else {
    console.log('mins_6_prs_box already uses observed-time formula');
  }

  const [row] = await db.query(
    `SELECT machine_centre_id, observed_time, rating_factor, mins_6_prs_box
     FROM production_routing_lines WHERE machine_centre_id = '01' LIMIT 1`
  );
  console.log('Machine 01:', row[0]);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
