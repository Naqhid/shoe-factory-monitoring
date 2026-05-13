/**
 * Prints SQL to run ON the MySQL server (mysql -u root -p) so this Windows PC
 * can connect. Use when you see: Host '...' is not allowed to connect.
 *
 *   node scripts/print-mysql-grant-for-this-pc.js
 *
 * This script never connects as a MySQL client; it only prints SQL for a DBA
 * to paste on the machine where mysqld is running.
 */
const net = require('net');
const os = require('os');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

function escSql(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/'/g, "''");
}

/** Local IPv4 used for a TCP connection toward MySQL (more reliable than UDP). */
function tcpLocalIp(host, port) {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    const done = (addr) => {
      try {
        sock.destroy();
      } catch {
        /* ignore */
      }
      resolve(addr);
    };
    sock.setTimeout(8000);
    sock.once('error', () => done(null));
    sock.once('timeout', () => done(null));
    sock.connect(port, host, () => {
      const addr = sock.localAddress;
      done(/^\d+\.\d+\.\d+\.\d+$/.test(addr) ? addr : null);
    });
  });
}

async function main() {
  const dbHost = process.env.DB_HOST || '127.0.0.1';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD ?? '';
  const dbName = process.env.DB_NAME || 'florence';
  const pcName = os.hostname();
  const clientIp = await tcpLocalIp(dbHost, port);
  const dbId = `\`${String(dbName).replace(/`/g, '``')}\``;

  console.log(
    '>>> This command does NOT change MySQL. It only prints SQL.\n' +
      `>>> Someone must log in on the PC that runs MySQL (${dbHost}), open "mysql -u root -p", and paste the lines below.\n` +
      '>>> Pasting into Git Bash on your dev PC does nothing.\n'
  );

  console.log(`-- On ${dbHost}: mysql -u root -p\n`);

  console.log(
    `CREATE USER IF NOT EXISTS '${escSql(user)}'@'${escSql(pcName)}' IDENTIFIED BY '${escSql(password)}';`
  );
  console.log(`GRANT ALL PRIVILEGES ON ${dbId}.* TO '${escSql(user)}'@'${escSql(pcName)}';`);

  if (clientIp) {
    console.log(
      `\n-- Exact client IPv4 seen from this PC toward ${dbHost}:${port}: ${clientIp}`
    );
    console.log(
      `CREATE USER IF NOT EXISTS '${escSql(user)}'@'${escSql(clientIp)}' IDENTIFIED BY '${escSql(password)}';`
    );
    console.log(`GRANT ALL PRIVILEGES ON ${dbId}.* TO '${escSql(user)}'@'${escSql(clientIp)}';`);

    const wild = clientIp.replace(/\.\d+$/, '.%');
    if (wild !== clientIp) {
      console.log(`\n-- Same /24 subnet (${wild}) if you prefer a pattern:`);
      console.log(
        `CREATE USER IF NOT EXISTS '${escSql(user)}'@'${escSql(wild)}' IDENTIFIED BY '${escSql(password)}';`
      );
      console.log(`GRANT ALL PRIVILEGES ON ${dbId}.* TO '${escSql(user)}'@'${escSql(wild)}';`);
    }
  } else {
    console.log(
      '\n-- (Could not detect this PC IPv4 via TCP to MySQL; add grants manually from ipconfig.)'
    );
  }

  console.log(
    "\n-- Last resort on a trusted LAN only (any client host):\n" +
      `-- CREATE USER IF NOT EXISTS '${escSql(user)}'@'%' IDENTIFIED BY '${escSql(password)}';\n` +
      `-- GRANT ALL PRIVILEGES ON ${dbId}.* TO '${escSql(user)}'@'%';\n`
  );

  console.log('FLUSH PRIVILEGES;\n');
}

main();
