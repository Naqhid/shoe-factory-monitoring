'use strict';

const pool = require('../../config/database');

const DEFAULT_INPUT_MACHINE_ID = '01';
const DEFAULT_EOL_MACHINE_ID = '07';

const inputCache = new Map();
const eolCache = new Map();

function clearLineMachineCache(workCentreId) {
  if (workCentreId == null) {
    inputCache.clear();
    eolCache.clear();
    return;
  }
  const key = Number(workCentreId);
  inputCache.delete(key);
  eolCache.delete(key);
}

async function fetchWorkCentreMachineConfig(workCentreId) {
  const [rows] = await pool.query(
    `SELECT input_machine_id, eol_machine_id
     FROM work_centres
     WHERE id = ?
     LIMIT 1`,
    [Number(workCentreId)]
  );
  return rows[0] || null;
}

async function resolveInputMachineId(workCentreId) {
  const wc = Number(workCentreId);
  if (inputCache.has(wc)) return inputCache.get(wc);

  const config = await fetchWorkCentreMachineConfig(wc);
  if (config?.input_machine_id) {
    const machineId = String(config.input_machine_id);
    inputCache.set(wc, machineId);
    return machineId;
  }

  const [rows] = await pool.query(
    `SELECT machine_id
     FROM machine_centres
     WHERE work_centre_id = ?
       AND deleted_at IS NULL
       AND COALESCE(is_active, 1) = 1
       AND (machine_name LIKE '%(Input)%' OR name LIKE '%(Input)%')
     ORDER BY machine_id
     LIMIT 1`,
    [wc]
  );

  const machineId = rows.length ? String(rows[0].machine_id) : DEFAULT_INPUT_MACHINE_ID;
  inputCache.set(wc, machineId);
  return machineId;
}

async function resolveEolMachineId(workCentreId) {
  const wc = Number(workCentreId);
  if (eolCache.has(wc)) return eolCache.get(wc);

  const config = await fetchWorkCentreMachineConfig(wc);
  if (config?.eol_machine_id) {
    const machineId = String(config.eol_machine_id);
    eolCache.set(wc, machineId);
    return machineId;
  }

  let machineId = null;

  const [named] = await pool.query(
    `SELECT machine_id
     FROM machine_centres
     WHERE work_centre_id = ?
       AND deleted_at IS NULL
       AND COALESCE(is_active, 1) = 1
       AND (
         machine_name LIKE '%Final Output%'
         OR name LIKE '%Final Output%'
         OR machine_name LIKE '%Final Inspection%'
         OR name LIKE '%Final Inspection%'
       )
     ORDER BY machine_id DESC
     LIMIT 1`,
    [wc]
  );
  if (named.length) machineId = String(named[0].machine_id);

  if (!machineId) {
    try {
      const [flagged] = await pool.query(
        `SELECT machine_id
         FROM machine_centres
         WHERE work_centre_id = ?
           AND deleted_at IS NULL
           AND COALESCE(is_active, 1) = 1
           AND COALESCE(is_end_of_line, 0) = 1
         ORDER BY machine_id
         LIMIT 1`,
        [wc]
      );
      if (flagged.length) machineId = String(flagged[0].machine_id);
    } catch {
      // is_end_of_line column may not exist on older DBs
    }
  }

  if (!machineId) machineId = DEFAULT_EOL_MACHINE_ID;

  eolCache.set(wc, machineId);
  return machineId;
}

module.exports = {
  DEFAULT_INPUT_MACHINE_ID,
  DEFAULT_EOL_MACHINE_ID,
  clearLineMachineCache,
  resolveInputMachineId,
  resolveEolMachineId,
};
