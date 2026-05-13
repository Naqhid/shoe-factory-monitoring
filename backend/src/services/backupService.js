const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const BACKUP_DIR = process.env.BACKUP_DIR
  ? path.resolve(process.env.BACKUP_DIR)
  : path.resolve(__dirname, '../../data/backups');

const RETENTION_DAYS = parseInt(process.env.BACKUP_RETENTION_DAYS || '30');
const BACKUP_HOUR = parseInt(process.env.BACKUP_HOUR || '17', 10);
const BACKUP_MINUTE = parseInt(process.env.BACKUP_MINUTE || '0', 10);

/** @returns {{ hour: number, minute: number }[]} */
function parseBackupTimeSlots() {
  const raw = (process.env.BACKUP_TIMES || '').trim();
  if (raw) {
    const slots = [];
    const seen = new Set();
    for (const part of raw.split(',')) {
      const m = part.trim().match(/^(\d{1,2}):(\d{1,2})$/);
      if (!m) {
        logger.warn(`BACKUP_TIMES: ignored invalid entry "${part.trim()}"`);
        continue;
      }
      const hour = parseInt(m[1], 10);
      const minute = parseInt(m[2], 10);
      if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
        logger.warn(`BACKUP_TIMES: out of range "${part.trim()}"`);
        continue;
      }
      const key = `${hour}:${minute}`;
      if (seen.has(key)) continue;
      seen.add(key);
      slots.push({ hour, minute });
    }
    if (slots.length) return slots;
  }
  return [{ hour: BACKUP_HOUR, minute: BACKUP_MINUTE }];
}

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

function runBackup() {
  ensureBackupDir();
  const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME } = process.env;
  if (!DB_HOST || !DB_USER || !DB_NAME) {
    logger.warn('Backup skipped: DB env vars not set');
    return;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename  = `backup-${DB_NAME}-${timestamp}.sql`;
  const filepath  = path.join(BACKUP_DIR, filename);

  // Use full path to mysqldump on Windows
  const mysqldump = fs.existsSync('C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqldump.exe')
    ? 'C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqldump.exe'
    : 'mysqldump';

  const cmd = `cmd /c ""${mysqldump}" -h ${DB_HOST} -P ${DB_PORT || 3306} -u ${DB_USER} -p${DB_PASSWORD} --single-transaction --routines --triggers ${DB_NAME} > \"${filepath}\""`;

  exec(cmd, { shell: false }, (err) => {
    if (err) {
      logger.error(`DB backup FAILED (mysqldump error): ${err.message}`);
      // Delete the empty file so it doesn't get committed to git as 0 bytes
      if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
      return;
    }

    // Guard: if file is missing or 0 bytes, the dump silently failed
    const fileSize = fs.existsSync(filepath) ? fs.statSync(filepath).size : 0;
    if (fileSize < 1024) {
      logger.error(`DB backup FAILED: output file is ${fileSize} bytes (expected >1KB). Deleting empty file.`);
      if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
      return;
    }

    logger.info(`DB backup created: ${filename} (${(fileSize / 1024).toFixed(1)} KB)`);
    pruneOldBackups();
    gitPush(filename);
  });
}

function gitPush(filename) {
  const repoRoot = path.resolve(__dirname, '../../..');
  const branch = process.env.GIT_BACKUP_BRANCH || 'develop';
  const date = new Date().toLocaleString();
  const message = `chore: DB backup ${filename} - ${date}`;

  const gitCmd = `git -C "${repoRoot}" add . && git -C "${repoRoot}" commit -m "${message}" && git -C "${repoRoot}" push origin ${branch}`;

  exec(gitCmd, (err, stdout) => {
    if (err) {
      logger.error(`Git push after backup failed: ${err.message}`);
      return;
    }
    logger.info(`Git push to '${branch}' after backup succeeded: ${stdout.trim() || 'ok'}`);
  });
}

function pruneOldBackups() {
  try {
    const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const files = fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith('backup-') && f.endsWith('.sql'));
    let pruned = 0;
    for (const file of files) {
      const fp = path.join(BACKUP_DIR, file);
      if (fs.statSync(fp).mtimeMs < cutoff) {
        fs.unlinkSync(fp);
        pruned++;
      }
    }
    if (pruned > 0) logger.info(`Pruned ${pruned} old backup(s) older than ${RETENTION_DAYS} days`);
  } catch (err) {
    logger.error('Backup pruning error:', err.message);
  }
}

function scheduleRecurringSlot(hour, minute) {
  const pad = (n) => String(n).padStart(2, '0');
  const label = `${pad(hour)}:${pad(minute)}`;

  const scheduleNext = () => {
    const now = new Date();
    const next = new Date();
    next.setHours(hour, minute, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    const delay = next - now;
    logger.info(
      `Next DB backup (${label}) at ${next.toLocaleString()} (in ${Math.round(delay / 60000)} min)`
    );
    setTimeout(() => {
      runBackup();
      scheduleNext();
    }, delay);
  };

  scheduleNext();
}

function scheduleDaily() {
  const slots = parseBackupTimeSlots();
  for (const { hour, minute } of slots) {
    scheduleRecurringSlot(hour, minute);
  }
}

function listBackups() {
  ensureBackupDir();
  return fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('backup-') && f.endsWith('.sql'))
    .map(f => {
      const fp = path.join(BACKUP_DIR, f);
      const stat = fs.statSync(fp);
      return { filename: f, size_kb: (stat.size / 1024).toFixed(1), created_at: stat.mtime };
    })
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

module.exports = { scheduleDaily, runBackup, listBackups, BACKUP_DIR };
