'use strict';

const pool = require('../../config/database');

const DEFAULT_IDLE_INTERVAL_SECS = 40;
const MIN_IDLE_INTERVAL_SECS = 15;
const MAX_IDLE_INTERVAL_SECS = 7200; // 2 hours

const DEFAULTS = {
  idle_interval_secs: DEFAULT_IDLE_INTERVAL_SECS,
  idle_interval_mins: 0,
  idle_interval_secs_part: 40,
  alarm_duration_secs: 12,
  finish_grace_mins: 0,
};

const clamp = (value, min, max, fallback) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
};

function splitIdleInterval(totalSecs) {
  const idle_interval_secs = clamp(totalSecs, MIN_IDLE_INTERVAL_SECS, MAX_IDLE_INTERVAL_SECS, DEFAULT_IDLE_INTERVAL_SECS);
  return {
    idle_interval_secs,
    idle_interval_mins: Math.floor(idle_interval_secs / 60),
    idle_interval_secs_part: idle_interval_secs % 60,
  };
}

function parseIdleIntervalFromPayload(payload) {
  if (payload.idle_interval_secs != null && payload.idle_interval_secs !== '') {
    return clamp(payload.idle_interval_secs, MIN_IDLE_INTERVAL_SECS, MAX_IDLE_INTERVAL_SECS, DEFAULT_IDLE_INTERVAL_SECS);
  }
  const mins = clamp(payload.idle_interval_mins, 0, 120, 0);
  const secsPart = clamp(payload.idle_interval_secs_part, 0, 59, 0);
  const total = mins * 60 + secsPart;
  return clamp(total, MIN_IDLE_INTERVAL_SECS, MAX_IDLE_INTERVAL_SECS, DEFAULT_IDLE_INTERVAL_SECS);
}

/** Match machine_centres / work_centres (utf8mb4_0900_ai_ci) to avoid JOIN collation errors. */
const TABLE_COLLATION = 'utf8mb4_0900_ai_ci';

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS machine_idle_reminder_settings (
      machine_id VARCHAR(100) NOT NULL PRIMARY KEY,
      idle_interval_mins INT NOT NULL DEFAULT 0,
      idle_interval_secs INT NOT NULL DEFAULT 40,
      alarm_duration_secs INT NOT NULL DEFAULT 12,
      finish_grace_mins INT NOT NULL DEFAULT 0,
      updated_by VARCHAR(255) NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=${TABLE_COLLATION}
  `);
  try {
    await pool.query(
      `ALTER TABLE machine_idle_reminder_settings ADD COLUMN idle_interval_secs INT NOT NULL DEFAULT ${DEFAULT_IDLE_INTERVAL_SECS}`
    );
  } catch (err) {
    if (err.code !== 'ER_DUP_FIELDNAME') throw err;
  }
  try {
    await pool.query(
      `ALTER TABLE machine_idle_reminder_settings CONVERT TO CHARACTER SET utf8mb4 COLLATE ${TABLE_COLLATION}`
    );
  } catch (err) {
    if (err.code !== 'ER_NO_SUCH_TABLE') throw err;
  }
  await pool.query(`
    UPDATE machine_idle_reminder_settings
    SET idle_interval_secs = GREATEST(${MIN_IDLE_INTERVAL_SECS}, idle_interval_mins * 60)
    WHERE idle_interval_secs IS NULL OR idle_interval_secs < ${MIN_IDLE_INTERVAL_SECS}
  `);
}

function normalizeRow(row) {
  if (!row) {
    return {
      ...DEFAULTS,
      ...splitIdleInterval(DEFAULT_IDLE_INTERVAL_SECS),
    };
  }
  let totalSecs = Number(row.idle_interval_secs);
  if (!Number.isFinite(totalSecs) || totalSecs < MIN_IDLE_INTERVAL_SECS) {
    const legacyMins = Number(row.idle_interval_mins);
    totalSecs = Number.isFinite(legacyMins) && legacyMins > 0
      ? legacyMins * 60
      : DEFAULT_IDLE_INTERVAL_SECS;
  }
  return {
    ...splitIdleInterval(totalSecs),
    alarm_duration_secs: clamp(row.alarm_duration_secs, 3, 60, DEFAULTS.alarm_duration_secs),
    finish_grace_mins: clamp(row.finish_grace_mins, 0, 60, DEFAULTS.finish_grace_mins),
  };
}

async function getForMachine(machineId) {
  await ensureTable();
  const id = String(machineId || '').trim();
  if (!id) return { machine_id: null, ...DEFAULTS, ...splitIdleInterval(DEFAULT_IDLE_INTERVAL_SECS) };
  const [rows] = await pool.query(
    `SELECT machine_id, idle_interval_mins, idle_interval_secs, alarm_duration_secs, finish_grace_mins, updated_by, updated_at
     FROM machine_idle_reminder_settings WHERE machine_id = ? LIMIT 1`,
    [id]
  );
  const settings = normalizeRow(rows[0]);
  return { machine_id: id, ...settings, is_custom: !!rows[0] };
}

async function getMapByMachineId() {
  await ensureTable();
  const [rows] = await pool.query(
    `SELECT machine_id, idle_interval_mins, idle_interval_secs, alarm_duration_secs, finish_grace_mins
     FROM machine_idle_reminder_settings`
  );
  const map = {};
  rows.forEach((row) => {
    map[String(row.machine_id)] = normalizeRow(row);
  });
  return map;
}

async function listWithMachines() {
  await ensureTable();
  const [rows] = await pool.query(
    `SELECT
       mc.machine_id,
       mc.code,
       COALESCE(NULLIF(TRIM(mc.machine_name), ''), mc.name, mc.code) AS machine_name,
       wc.id AS work_centre_id,
       wc.name AS work_centre_name,
       COALESCE(s.idle_interval_secs, ${DEFAULT_IDLE_INTERVAL_SECS}) AS idle_interval_secs,
       COALESCE(s.alarm_duration_secs, ${DEFAULTS.alarm_duration_secs}) AS alarm_duration_secs,
       COALESCE(s.finish_grace_mins, ${DEFAULTS.finish_grace_mins}) AS finish_grace_mins,
       s.updated_by,
       s.updated_at,
       CASE WHEN s.machine_id IS NULL THEN 0 ELSE 1 END AS is_custom
     FROM machine_centres mc
     LEFT JOIN work_centres wc ON wc.id = mc.work_centre_id
     LEFT JOIN machine_idle_reminder_settings s
       ON s.machine_id COLLATE ${TABLE_COLLATION} = mc.machine_id
     WHERE mc.machine_id IS NOT NULL AND TRIM(mc.machine_id) != ''
     ORDER BY wc.name, mc.machine_id`
  );
  return rows.map((row) => ({
    ...row,
    ...normalizeRow({
      idle_interval_secs: row.idle_interval_secs,
      idle_interval_mins: Math.floor(Number(row.idle_interval_secs || DEFAULT_IDLE_INTERVAL_SECS) / 60),
      alarm_duration_secs: row.alarm_duration_secs,
      finish_grace_mins: row.finish_grace_mins,
    }),
    is_custom: Number(row.is_custom) === 1,
  }));
}

async function upsert(machineId, payload, updatedBy = null) {
  await ensureTable();
  const id = String(machineId || '').trim();
  if (!id) throw new Error('machine_id is required');

  const [machineRows] = await pool.query(
    'SELECT machine_id FROM machine_centres WHERE machine_id = ? OR code = ? LIMIT 1',
    [id, id]
  );
  if (!machineRows.length) throw new Error(`Machine ${id} not found`);

  const canonicalId = String(machineRows[0].machine_id);
  const idle_interval_secs = parseIdleIntervalFromPayload(payload);
  const idle_interval_mins = Math.floor(idle_interval_secs / 60);
  const alarm_duration_secs = clamp(payload.alarm_duration_secs, 3, 60, DEFAULTS.alarm_duration_secs);
  const finish_grace_mins = clamp(payload.finish_grace_mins, 0, 60, DEFAULTS.finish_grace_mins);

  await pool.query(
    `INSERT INTO machine_idle_reminder_settings
       (machine_id, idle_interval_mins, idle_interval_secs, alarm_duration_secs, finish_grace_mins, updated_by)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       idle_interval_mins = VALUES(idle_interval_mins),
       idle_interval_secs = VALUES(idle_interval_secs),
       alarm_duration_secs = VALUES(alarm_duration_secs),
       finish_grace_mins = VALUES(finish_grace_mins),
       updated_by = VALUES(updated_by)`,
    [canonicalId, idle_interval_mins, idle_interval_secs, alarm_duration_secs, finish_grace_mins, updatedBy]
  );

  return getForMachine(canonicalId);
}

async function removeCustom(machineId) {
  await ensureTable();
  const id = String(machineId || '').trim();
  if (!id) return { machine_id: null, ...DEFAULTS, ...splitIdleInterval(DEFAULT_IDLE_INTERVAL_SECS) };
  await pool.query('DELETE FROM machine_idle_reminder_settings WHERE machine_id = ?', [id]);
  return getForMachine(id);
}

function resolveForMachine(settingsMap, machineId) {
  const key = String(machineId || '');
  return normalizeRow(settingsMap[key] || null);
}

module.exports = {
  DEFAULTS,
  DEFAULT_IDLE_INTERVAL_SECS,
  MIN_IDLE_INTERVAL_SECS,
  MAX_IDLE_INTERVAL_SECS,
  ensureTable,
  getForMachine,
  getMapByMachineId,
  listWithMachines,
  upsert,
  removeCustom,
  resolveForMachine,
  splitIdleInterval,
};
