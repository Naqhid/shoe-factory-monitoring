require('dotenv').config();
const pool = require('./config/database');

const database = process.env.DB_NAME;
if (!database) {
  console.error('ERROR: DB_NAME must be set in .env to repair definers.');
  process.exit(1);
}

const normalizeCreateStatement = (sql) => {
  return sql.replace(/^CREATE\s+DEFINER\s*=\s*`[^`]+`@`[^`]+`/i, 'CREATE DEFINER=CURRENT_USER');
};

const extractCreateSql = (row) => {
  const createKey = Object.keys(row).find((key) => /^(Create|SQL Original Statement)/i.test(key));
  if (!createKey) {
    throw new Error('Unable to locate CREATE statement from SHOW CREATE result');
  }
  return row[createKey];
};

const main = async () => {
  console.log(`Repairing invalid DEFINER entries in database: ${database}`);

  const [triggers] = await pool.query(
    `SELECT TRIGGER_NAME, EVENT_OBJECT_TABLE, DEFINER
     FROM information_schema.TRIGGERS
     WHERE TRIGGER_SCHEMA = ? AND DEFINER LIKE '%root@%'`,
    [database]
  );

  if (triggers.length === 0) {
    console.log('No triggers with invalid DEFINER found.');
  } else {
    for (const trigger of triggers) {
      console.log(`Updating trigger definer for ${trigger.TRIGGER_NAME}...`);
      const [rows] = await pool.query(`SHOW CREATE TRIGGER \`${database}\`.\`${trigger.TRIGGER_NAME}\``);
      const createSql = normalizeCreateStatement(extractCreateSql(rows[0]));
      if (createSql === rows[0][Object.keys(rows[0]).find((key) => /Original Statement|Create/i.test(key))]) {
        console.warn(`Warning: no DEFINER replacement applied for trigger ${trigger.TRIGGER_NAME}`);
      }
      await pool.query(`DROP TRIGGER IF EXISTS \`${database}\`.\`${trigger.TRIGGER_NAME}\``);
      await pool.query(createSql);
    }
  }

  const [routines] = await pool.query(
    `SELECT ROUTINE_NAME, ROUTINE_TYPE, DEFINER
     FROM information_schema.ROUTINES
     WHERE ROUTINE_SCHEMA = ? AND DEFINER LIKE '%root@%'`,
    [database]
  );

  if (routines.length === 0) {
    console.log('No routines with invalid DEFINER found.');
  } else {
    for (const routine of routines) {
      console.log(`Updating routine definer for ${routine.ROUTINE_TYPE} ${routine.ROUTINE_NAME}...`);
      const [rows] = await pool.query(`SHOW CREATE ${routine.ROUTINE_TYPE} \`${database}\`.\`${routine.ROUTINE_NAME}\``);
      const createSql = normalizeCreateStatement(extractCreateSql(rows[0]));
      if (createSql === rows[0][Object.keys(rows[0]).find((key) => /Original Statement|Create/i.test(key))]) {
        console.warn(`Warning: no DEFINER replacement applied for ${routine.ROUTINE_TYPE} ${routine.ROUTINE_NAME}`);
      }
      await pool.query(`DROP ${routine.ROUTINE_TYPE} IF EXISTS \`${database}\`.\`${routine.ROUTINE_NAME}\``);
      await pool.query(createSql);
    }
  }

  console.log('DEFINER repair complete.');
  process.exit(0);
};

main().catch((error) => {
  console.error('Failed to repair DEFINER entries:', error.message || error);
  process.exit(1);
});
