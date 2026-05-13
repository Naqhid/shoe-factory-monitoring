/**
 * Creates database DB_NAME (from .env) if missing, then restores the latest
 * backup-florence*.sql from data/backups (or a path passed as argv[2]).
 *
 * Usage (from backend folder):
 *   node scripts/restore-florence-from-env.js
 *   node scripts/restore-florence-from-env.js "D:\\path\\to\\backup.sql"
 *
 * Requires: network reachability to DB_HOST, root (or DB_USER) privileges
 * to CREATE DATABASE and import routines/triggers.
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const BACKUPS_DIR = path.join(__dirname, '..', 'data', 'backups');

function preprocessMysqldump(sql) {
  let out = sql.replace(/\r\n/g, '\n');
  out = out.replace(/^\s*DELIMITER\s+.*$/gm, '');
  out = out.replace(/\*\/;;/g, '*/;');
  out = out.replace(/\nEND\s*;;/g, '\nEND ;');
  return out;
}

/** Higher = newer. Uses filename dates so git/checkout does not skew mtime. */
function backupSortKey(filename) {
  const manual = filename.match(/^backup-florence-manual-(\d{4})-(\d{2})-(\d{2})\.sql$/i);
  if (manual) {
    return `${manual[1]}-${manual[2]}-${manual[3]}T23:59:59`;
  }
  const stamped = filename.match(
    /^backup-florence-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})\.sql$/i
  );
  if (stamped) {
    return stamped[1].replace(/T(\d{2})-(\d{2})-(\d{2})$/, 'T$1:$2:$3');
  }
  const st = fs.statSync(path.join(BACKUPS_DIR, filename));
  return new Date(st.mtimeMs).toISOString();
}

function findLatestFlorenceBackup() {
  const names = fs
    .readdirSync(BACKUPS_DIR)
    .filter((f) => /^backup-florence.*\.sql$/i.test(f));
  if (!names.length) {
    throw new Error(`No backup-florence*.sql under ${BACKUPS_DIR}`);
  }
  names.sort((a, b) => (backupSortKey(a) < backupSortKey(b) ? 1 : -1));
  return path.join(BACKUPS_DIR, names[0]);
}

async function main() {
  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD ?? '';
  const dbName = process.env.DB_NAME || 'florence';

  const backupPath =
    process.argv[2] && fs.existsSync(process.argv[2])
      ? path.resolve(process.argv[2])
      : findLatestFlorenceBackup();

  console.log(`Host: ${host}:${port}`);
  console.log(`Database: ${dbName}`);
  console.log(`Backup: ${backupPath}`);

  const adminConn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    multipleStatements: true,
  });

  await adminConn.query(
    `CREATE DATABASE IF NOT EXISTS \`${dbName.replace(/`/g, '``')}\` ` +
      `CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`
  );
  await adminConn.end();

  const raw = fs.readFileSync(backupPath, 'utf8');
  const sql = preprocessMysqldump(raw);

  const importConn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database: dbName,
    multipleStatements: true,
  });

  await importConn.query(sql);
  await importConn.end();

  console.log('Restore finished OK.');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
