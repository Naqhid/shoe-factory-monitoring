require('dotenv').config();
const db = require('../config/database');

(async () => {
  const [routingCols] = await db.execute(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'production_routing_lines'
      AND COLUMN_NAME IN ('mins_12_prs_box', 'mins_6_prs_box')
  `);
  const names = new Set(routingCols.map((c) => c.COLUMN_NAME));
  if (names.has('mins_12_prs_box')) {
    await db.execute('ALTER TABLE production_routing_lines DROP COLUMN mins_12_prs_box');
    console.log('Dropped mins_12_prs_box');
  }
  if (!names.has('mins_6_prs_box')) {
    await db.execute(`
      ALTER TABLE production_routing_lines
      ADD COLUMN mins_6_prs_box decimal(10,4) GENERATED ALWAYS AS (
        (((((\`observed_time\` * \`rating_factor\`) / 100) * 1.15) * 6) / 60)
      ) STORED
    `);
    console.log('Added mins_6_prs_box');
  } else {
    console.log('mins_6_prs_box already exists');
  }
  const [sample] = await db.execute(
    'SELECT machine_centre_id, observed_time, rating_factor, mins_6_prs_box FROM production_routing_lines LIMIT 3'
  );
  console.log('Sample:', sample);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
