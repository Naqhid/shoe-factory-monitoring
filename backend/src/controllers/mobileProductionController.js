const db = require('../../config/database');
const logger = require('../utils/logger');
const { withTransaction } = require('../utils/transaction');

const resolveTargetsFromPlan = async (conn, { machineId, workCentreId, prodDate }) => {
  let targetMins = 0;
  let targetPairs = 0;

  const [routingRows] = await conn.execute(
    `SELECT prl.mins_12_prs_box
     FROM production_plan pp
     JOIN production_routing_header prh ON prh.style_id = pp.style_id AND prh.deleted_at IS NULL
     JOIN production_routing_lines prl
       ON prl.routing_header_id = prh.id
       AND prl.machine_centre_id = ?
     WHERE pp.work_centre_id = ?
       AND pp.deleted_at IS NULL
       AND pp.plan_date = ?
     ORDER BY
       CASE WHEN prh.created_on <= pp.plan_date THEN 0 ELSE 1 END ASC,
       ABS(DATEDIFF(prh.created_on, pp.plan_date)) ASC,
       prh.id DESC
     LIMIT 1`,
    [machineId, workCentreId, prodDate]
  );
  if (routingRows.length > 0) {
    targetMins = parseFloat(routingRows[0].mins_12_prs_box || 0) || 0;
  }

  const [planRows] = await conn.execute(
    `SELECT target_pairs_per_tray
     FROM production_plan
     WHERE work_centre_id = ? AND deleted_at IS NULL AND plan_date = ?
     ORDER BY id DESC
     LIMIT 1`,
    [workCentreId, prodDate]
  );
  if (planRows.length > 0) {
    targetPairs = parseFloat(planRows[0].target_pairs_per_tray || 0) || 0;
  }

  return {
    targetMins: Math.max(0, targetMins),
    targetPairs: Math.max(0, targetPairs),
  };
};

/** Finished cycles on the same machine cannot overlap; touching (end == next start) is allowed. */
const MACHINE_CYCLE_OVERLAP_MSG =
  'This time overlaps another finished cycle on the same machine. The next cycle can only start after the previous one ends.';

const STOPPAGE_PREFIX_BY_TYPE = {
  bottleneck: 'BOTTLENECK',
  breakdown: 'BREAKDOWN',
};

function resolveStoppageEntryMeta(entryTypeRaw, existingStoppageReason = '') {
  const normalized = String(entryTypeRaw || '').toLowerCase();
  if (normalized === 'breakdown') {
    return { prefix: STOPPAGE_PREFIX_BY_TYPE.breakdown, isStoppageEvent: true, kind: 'breakdown' };
  }
  if (normalized === 'bottleneck') {
    return { prefix: STOPPAGE_PREFIX_BY_TYPE.bottleneck, isStoppageEvent: true, kind: 'bottleneck' };
  }
  const existing = String(existingStoppageReason || '');
  if (existing.startsWith('BREAKDOWN:')) {
    return { prefix: STOPPAGE_PREFIX_BY_TYPE.breakdown, isStoppageEvent: true, kind: 'breakdown' };
  }
  if (existing.startsWith('BOTTLENECK:')) {
    return { prefix: STOPPAGE_PREFIX_BY_TYPE.bottleneck, isStoppageEvent: true, kind: 'bottleneck' };
  }
  return { prefix: 'MANUAL', isStoppageEvent: false, kind: 'manual' };
}

function buildStoppageReason(prefix, reason, approverIdentity) {
  return `${prefix}:${String(reason || '').trim()} [Approved By: ${approverIdentity}]`;
}

const STOPPAGE_ENTRY_SQL_FILTER =
  "(stoppage_reason LIKE 'MANUAL:%' OR stoppage_reason LIKE 'BOTTLENECK:%' OR stoppage_reason LIKE 'BREAKDOWN:%')";

/** Any finished row on this machine whose [start_time, finish_time] overlaps the given window. */
const findOverlappingFinishedCycleOnMachine = async (connOrPool, { machineId, startTime, finishTime, excludeId = null }) => {
  let query = `
    SELECT id
    FROM machine_centre_production
    WHERE machine_id = ?
      AND button_status = 2
      AND start_time IS NOT NULL
      AND finish_time IS NOT NULL
      AND start_time < ?
      AND finish_time > ?`;
  const params = [machineId, finishTime, startTime];
  if (excludeId != null && excludeId !== '') {
    query += ' AND id != ?';
    params.push(excludeId);
  }
  query += ' ORDER BY id DESC LIMIT 1';
  const [rows] = await connOrPool.execute(query, params);
  return rows[0] || null;
};

const findOverlappingActiveCycleForMachineEmployee = async (
  connOrPool,
  { prodDate, machineId, empId, startTime, finishTime, excludeId = null }
) => {
  let query = `
    SELECT id
    FROM machine_centre_production
    WHERE machine_id = ?
      AND emp_id = ?
      AND DATE(prod_date) = ?
      AND button_status != 2
      AND start_time IS NOT NULL
      AND start_time < ?
      AND COALESCE(finish_time, '9999-12-31 23:59:59') > ?`;
  const params = [machineId, empId, prodDate, finishTime, startTime];
  if (excludeId != null && excludeId !== '') {
    query += ' AND id != ?';
    params.push(excludeId);
  }
  query += ' ORDER BY id DESC LIMIT 1';
  const [rows] = await connOrPool.execute(query, params);
  return rows[0] || null;
};

const hasTimezoneInDateTime = (value) => {
  if (value === null || value === undefined) return false;
  const s = String(value).trim();
  if (!s) return false;
  return /Z$/i.test(s) || /[+-]\d{2}:\d{2}$/.test(s);
};

const formatLocalDateTime = (date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
};

const toMySqlDateTimeOrNull = (value) => {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  // Preserve wall-clock from client payloads like 2026-05-21T12:28:00 (no timezone shift).
  if (!hasTimezoneInDateTime(raw)) {
    const wall = raw.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::(\d{2}))?/);
    if (wall) {
      const sec = wall[3] || '00';
      return `${wall[1]} ${wall[2]}:${sec}`;
    }
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return formatLocalDateTime(value);
  }
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return null;
  return formatLocalDateTime(dt);
};

const writeManualAuditLog = async (conn, { req, action, entryId, beforeData = null, afterData = null, reason = null }) => {
  const actor = req.user || {};
  await conn.execute(
    `INSERT INTO manual_entry_audit_logs
     (entry_id, action, actor_user_id, actor_username, actor_role, reason, before_data, after_data, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      entryId || null,
      action,
      actor.id || null,
      actor.username || actor.name || null,
      actor.role || null,
      reason || null,
      beforeData ? JSON.stringify(beforeData) : null,
      afterData ? JSON.stringify(afterData) : null,
    ]
  );
};

const recalcSummaryForDayMachineEmployee = async (conn, { prodDate, workCentreId, machineId, empId }) => {
  const [finishedRecords] = await conn.execute(
    `SELECT
      output_pairs,
      target_mins,
      TIMESTAMPDIFF(MINUTE, start_time, finish_time) as actual_mins,
      COALESCE(idle_mins, 0) as idle_mins
     FROM machine_centre_production
     WHERE DATE(prod_date) = ? AND work_centre_id = ? AND machine_id = ? AND emp_id = ? AND button_status = 2`,
    [prodDate, workCentreId, machineId, empId]
  );

  let totalOutput = 0;
  let totalTargetMins = 0;
  let totalActualMins = 0;
  let totalIdleMins = 0;

  finishedRecords.forEach((record) => {
    totalOutput += parseInt(record.output_pairs) || 0;
    totalTargetMins += parseFloat(record.target_mins) || 0;
    totalActualMins += parseFloat(record.actual_mins) || 0;
    totalIdleMins += parseFloat(record.idle_mins) || 0;
  });

  const cumAvgTime = totalOutput > 0 ? (totalActualMins / totalOutput) : 0;

  await conn.execute(
    `INSERT INTO machine_centre_summary
     (prod_date, work_centre_id, machine_id, emp_id, total_output_pairs, total_target_mins, total_actual_mins, total_idle_mins, cum_avg_time, button_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 2)
     ON DUPLICATE KEY UPDATE
       total_output_pairs = VALUES(total_output_pairs),
       total_target_mins = VALUES(total_target_mins),
       total_actual_mins = VALUES(total_actual_mins),
       total_idle_mins = VALUES(total_idle_mins),
       cum_avg_time = VALUES(cum_avg_time),
       button_status = VALUES(button_status),
       updated_at = CURRENT_TIMESTAMP`,
    [prodDate, workCentreId, machineId, empId, totalOutput, totalTargetMins, totalActualMins, totalIdleMins, cumAvgTime]
  );

  return {
    total_output_pairs: totalOutput,
    total_cycles: finishedRecords.length,
  };
};

// Get all production data
exports.getAll = async (req, res, next) => {
  try {
    const [rows] = await db.query(`
      SELECT pd.*, 
             wc.name as work_centre_name,
             e.name as employee_name
      FROM machine_centre_production pd
      LEFT JOIN work_centres wc ON pd.work_centre_id = wc.id
      LEFT JOIN employees e ON pd.emp_id = e.code
      ORDER BY pd.prod_date DESC, pd.created_at DESC
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    logger.error('Error fetching production data:', error);
    next(error);
  }
};

// Paginated production records for supervisor view
exports.getPaginatedRecords = async (req, res, next) => {
  try {
    const { date_from, date_to, work_centre_id, machine_id, type } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const rawLimit = String(req.query.limit || '20').toLowerCase();
    const useAll = rawLimit === 'all';
    const limit = useAll ? null : Math.min(200, Math.max(1, parseInt(rawLimit, 10) || 20));
    const offset = useAll ? 0 : (page - 1) * limit;

    let where = 'WHERE pd.button_status = 2';
    const params = [];
    if (date_from) { where += ' AND DATE(pd.start_time) >= ?'; params.push(date_from); }
    if (date_to)   { where += ' AND DATE(pd.start_time) <= ?'; params.push(date_to); }
    if (work_centre_id) { where += ' AND pd.work_centre_id = ?'; params.push(work_centre_id); }
    if (machine_id) { where += ' AND pd.machine_id = ?'; params.push(machine_id); }
    if (type === 'manual') where += " AND pd.stoppage_reason LIKE 'MANUAL:%'";
    else if (type === 'real') where += " AND (pd.stoppage_reason IS NULL OR pd.stoppage_reason NOT LIKE 'MANUAL:%')";

    const [[{ total }]] = await db.query(`SELECT COUNT(*) as total FROM machine_centre_production pd ${where}`, params);
    const sql = `SELECT pd.*, wc.name as work_centre_name, e.name as employee_name
      FROM machine_centre_production pd
      LEFT JOIN work_centres wc ON pd.work_centre_id = wc.id
      LEFT JOIN employees e ON pd.emp_id = e.code
      ${where} ORDER BY pd.start_time DESC, pd.id DESC`;
    const [rows] = useAll
      ? await db.query(sql, params)
      : await db.query(`${sql} LIMIT ? OFFSET ?`, [...params, limit, offset]);
    res.json({ success: true, data: rows, meta: { page, limit: useAll ? 'all' : limit, total, total_pages: useAll ? 1 : Math.max(1, Math.ceil(total / limit)) } });
  } catch (error) {
    logger.error('Error fetching paginated production records:', error);
    next(error);
  }
};

// Get production data by ID
exports.getById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query(`
      SELECT pd.*, 
             wc.name as work_centre_name,
             e.name as employee_name
      FROM machine_centre_production pd
      LEFT JOIN work_centres wc ON pd.work_centre_id = wc.id
      LEFT JOIN employees e ON pd.emp_id = e.code
      WHERE pd.id = ?
    `, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Production data not found' });
    }

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    logger.error('Error fetching production data by ID:', error);
    next(error);
  }
};

// Get production data by machine and date
exports.getByMachineAndDate = async (req, res, next) => {
  try {
    const { machineId, date } = req.params;
    const [rows] = await db.query(`
      SELECT pd.*, 
             wc.name as work_centre_name,
             e.name as employee_name
      FROM machine_centre_production pd
      LEFT JOIN work_centres wc ON pd.work_centre_id = wc.id
      LEFT JOIN employees e ON pd.emp_id = e.code
      WHERE pd.machine_id = ? AND pd.prod_date = ?
      ORDER BY pd.created_at DESC
    `, [machineId, date]);

    res.json({ success: true, data: rows });
  } catch (error) {
    logger.error('Error fetching production data by machine and date:', error);
    next(error);
  }
};

// Get latest unfinished production data by machine (today only)
exports.getLatestUnfinishedByMachine = async (req, res, next) => {
  try {
    const { machineId } = req.params;
    const [rows] = await db.query(`
      SELECT pd.*, 
             wc.name as work_centre_name,
             e.name as employee_name
      FROM machine_centre_production pd
      LEFT JOIN work_centres wc ON pd.work_centre_id = wc.id
      LEFT JOIN employees e ON pd.emp_id = e.code
      WHERE pd.machine_id = ?
        AND pd.button_status != 2
        AND DATE(pd.prod_date) = CURDATE()
      ORDER BY pd.created_at DESC
      LIMIT 1
    `, [machineId]);

    res.json({ success: true, data: rows[0] || null });
  } catch (error) {
    logger.error('Error fetching latest unfinished production data by machine:', error);
    next(error);
  }
};

// Create production data
exports.create = async (req, res, next) => {
  try {
    const {
      prod_date,
      work_centre_id,
      machine_id,
      emp_id,
      output_pairs,
      target_mins,
      start_time,
      finish_time,
      idle_start_time,
      idle_stop_time,
      button_status
    } = req.body;

    const timezoneFields = { finish_time, idle_start_time, idle_stop_time };
    for (const [field, value] of Object.entries(timezoneFields)) {
      if (hasTimezoneInDateTime(value)) {
        return res.status(400).json({
          success: false,
          message: `${field} must be local datetime without timezone (send YYYY-MM-DD HH:mm:ss or YYYY-MM-DDTHH:mm:ss).`,
        });
      }
    }

    // SECURITY: Prevent creating records that are already finished
    // Records must be created in status 1 (running) or 3 (idle), NOT 2 (finished)
    const requestedStatus = button_status || 1;
    if (requestedStatus === 2) {
      logger.warn(`BLOCKED: Attempt to create already-finished record for machine ${machine_id}, emp ${emp_id}`);
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot create production record in finished state. Records must start as running (1) or idle (3).' 
      });
    }

    // Check for existing active record for this machine/employee/date to prevent duplicates.
    // Use DB local date (CURDATE) when prod_date isn't provided to avoid UTC day drift.
    let existingRows;
    if (prod_date) {
      const [rows] = await db.query(
        `SELECT id, button_status FROM machine_centre_production 
         WHERE machine_id = ? AND emp_id = ? AND prod_date = ? AND button_status != 2`,
        [machine_id, emp_id, prod_date.split('T')[0]]
      );
      existingRows = rows;
    } else {
      const [rows] = await db.query(
        `SELECT id, button_status FROM machine_centre_production 
         WHERE machine_id = ? AND emp_id = ? AND prod_date = CURDATE() AND button_status != 2`,
        [machine_id, emp_id]
      );
      existingRows = rows;
    }
    
    if (existingRows.length > 0) {
      logger.warn(`BLOCKED: Duplicate record creation attempt for machine ${machine_id}, emp ${emp_id}. Existing record: ${existingRows[0].id}`);
      return res.status(409).json({ 
        success: false, 
        message: 'Active production record already exists for this machine and employee',
        data: { existing_id: existingRows[0].id }
      });
    }

    // Block start if a manual entry covers the current time for this machine+employee.
    const startCheckDate = prod_date ? prod_date.split('T')[0] : null;
    const [manualBlockRows] = startCheckDate
      ? await db.query(
          `SELECT id FROM machine_centre_production
           WHERE machine_id = ? AND emp_id = ? AND DATE(prod_date) = ?
             AND button_status = 2 AND stoppage_reason LIKE 'MANUAL:%'
             AND start_time <= NOW() AND finish_time >= NOW()
           LIMIT 1`,
          [machine_id, emp_id, startCheckDate]
        )
      : await db.query(
          `SELECT id FROM machine_centre_production
           WHERE machine_id = ? AND emp_id = ? AND DATE(prod_date) = CURDATE()
             AND button_status = 2 AND stoppage_reason LIKE 'MANUAL:%'
             AND start_time <= NOW() AND finish_time >= NOW()
           LIMIT 1`,
          [machine_id, emp_id]
        );
    if (manualBlockRows.length > 0) {
      logger.warn(`BLOCKED: Manual entry #${manualBlockRows[0].id} covers NOW() for machine ${machine_id}, emp ${emp_id}.`);
      return res.status(409).json({
        success: false,
        message: 'A manual production entry already covers this time slot. Remove it before starting a new cycle.',
        data: { existing_id: manualBlockRows[0].id }
      });
    }

    // Extract YYYY-MM-DD from ISO timestamp for MySQL DATE column
    const formattedDate = prod_date ? prod_date.split('T')[0] : null;

    const normalizedFinishTime = toMySqlDateTimeOrNull(finish_time);
    const normalizedIdleStartTime = toMySqlDateTimeOrNull(idle_start_time);
    const normalizedIdleStopTime = toMySqlDateTimeOrNull(idle_stop_time);

    const [result] = await db.query(
      `INSERT INTO machine_centre_production
       (prod_date, work_centre_id, machine_id, emp_id, output_pairs, target_mins,
        start_time, finish_time, idle_start_time, idle_stop_time, button_status)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?)`,
      [formattedDate, work_centre_id, machine_id, emp_id,
       output_pairs !== undefined ? output_pairs : 0,
       target_mins || 0,
       normalizedFinishTime,
       normalizedIdleStartTime,
       normalizedIdleStopTime,
       requestedStatus]
    );

    res.status(201).json({
      success: true,
      message: 'Production data created successfully',
      data: { id: result.insertId }
    });
  } catch (error) {
    logger.error('Error creating production data:', error);
    next(error);
  }
};

// Manual entry for supervisors/admins: directly save a finished production cycle.
exports.createManualEntry = async (req, res, next) => {
  try {
    const {
      prod_date,
      work_centre_id,
      machine_id,
      emp_id,
      start_time,
      finish_time,
      output_pairs,
      stoppage_reason,
      approved_by,
      entry_type
    } = req.body;

    const entryMeta = resolveStoppageEntryMeta(entry_type);
    const isStoppageEvent = entryMeta.isStoppageEvent;

    const finishProvided =
      finish_time !== undefined && finish_time !== null && String(finish_time).trim() !== '';

    if (!work_centre_id || !machine_id || !emp_id || !start_time) {
      return res.status(400).json({
        success: false,
        message: 'work_centre_id, machine_id, emp_id and start_time are required'
      });
    }
    if (!isStoppageEvent && !finishProvided) {
      return res.status(400).json({
        success: false,
        message: 'finish_time is required for manual production entries'
      });
    }
    if (output_pairs === undefined || output_pairs === null || Number.isNaN(Number(output_pairs))) {
      return res.status(400).json({
        success: false,
        message: 'output_pairs is required and must be a number'
      });
    }
    const manualOutputPairs = isStoppageEvent ? 0 : Math.max(0, Math.round(Number(output_pairs)));

    const start = new Date(start_time);
    if (Number.isNaN(start.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid start_time' });
    }

    const isOngoingStoppage = isStoppageEvent && !finishProvided;
    let finish = null;
    if (finishProvided) {
      finish = new Date(finish_time);
      if (Number.isNaN(finish.getTime())) {
        return res.status(400).json({ success: false, message: 'Invalid finish_time' });
      }
      if (finish <= start) {
        return res.status(400).json({ success: false, message: 'finish_time must be later than start_time' });
      }
    }

    const startDate = start_time.split('T')[0];
    const finishDate = finishProvided ? finish_time.split('T')[0] : startDate;
    const prodDate = (prod_date || startDate).split('T')[0];

    if (finishProvided && startDate !== finishDate) {
      return res.status(400).json({
        success: false,
        message: 'Start and end time must be on the same date for manual entry'
      });
    }
    if (prodDate !== startDate) {
      return res.status(400).json({
        success: false,
        message: 'prod_date must match the start/end date'
      });
    }

    const [machineRows] = await db.query(
      'SELECT machine_id, work_centre_id FROM machine_centres WHERE (machine_id = ? OR code = ?) AND work_centre_id = ? LIMIT 1',
      [machine_id, machine_id, work_centre_id]
    );
    if (machineRows.length === 0) {
      return res.status(400).json({ success: false, message: `Machine ${machine_id} not found for selected line` });
    }

    const [empRows] = await db.query(
      'SELECT code, work_centre_id FROM employees WHERE code = ? AND work_centre_id = ? LIMIT 1',
      [emp_id, work_centre_id]
    );
    if (empRows.length === 0) {
      return res.status(400).json({ success: false, message: `Employee ${emp_id} not found for selected line` });
    }

    const normalizedStartTime = toMySqlDateTimeOrNull(start_time);
    const normalizedFinishTime = finishProvided ? toMySqlDateTimeOrNull(finish_time) : null;

    const activeOverlap = await findOverlappingActiveCycleForMachineEmployee(db, {
      prodDate,
      machineId: machine_id,
      empId: emp_id,
      startTime: normalizedStartTime,
      finishTime: normalizedFinishTime || '9999-12-31 23:59:59',
    });
    if (activeOverlap) {
      return res.status(409).json({
        success: false,
        message: 'Cannot add manual entry because an active cycle overlaps this time window for the same machine and employee',
        data: { existing_id: activeOverlap.id }
      });
    }

    const approverIdentity = String(
      approved_by ||
      req?.user?.username ||
      req?.user?.name ||
      req?.user?.email ||
      req?.user?.id ||
      'Unknown'
    ).trim();

    let insertedId = null;
    let summaryData = null;
    let enforcedTargets = { targetMins: 0, targetPairs: 0 };

    await withTransaction(async (conn) => {
      enforcedTargets = await resolveTargetsFromPlan(conn, {
        machineId: machine_id,
        workCentreId: work_centre_id,
        prodDate,
      });

      if (finishProvided) {
        const overlapping = await findOverlappingFinishedCycleOnMachine(conn, {
          machineId: machine_id,
          startTime: start_time,
          finishTime: finish_time,
        });
        if (overlapping) {
          throw Object.assign(new Error(`${MACHINE_CYCLE_OVERLAP_MSG} (record #${overlapping.id})`), {
            statusCode: 409,
            exposeMessage: `${MACHINE_CYCLE_OVERLAP_MSG} (record #${overlapping.id})`,
          });
        }
      } else if (isOngoingStoppage) {
        const [openRows] = await conn.execute(
          `SELECT id
           FROM machine_centre_production
           WHERE work_centre_id = ?
             AND machine_id = ?
             AND button_status = 1
             AND stoppage_reason LIKE ?
             AND idle_stop_time IS NULL
           LIMIT 1`,
          [work_centre_id, machine_id, `${entryMeta.prefix}:%`]
        );
        if (openRows.length > 0) {
          throw Object.assign(
            new Error(`An open ${entryMeta.kind} is already recorded for this machine (record #${openRows[0].id}). Close it before starting another.`),
            {
              statusCode: 409,
              exposeMessage: `An open ${entryMeta.kind} is already recorded for this machine (record #${openRows[0].id}). Close it before starting another.`,
            }
          );
        }
      }

      if (!isStoppageEvent) {
        const [duplicateRows] = await conn.execute(
          `SELECT id
           FROM machine_centre_production
           WHERE work_centre_id = ?
             AND machine_id = ?
             AND emp_id = ?
             AND button_status = 2
             AND stoppage_reason IS NOT NULL
             AND stoppage_reason LIKE 'MANUAL:%'
             AND start_time = ?
             AND finish_time = ?
           ORDER BY id DESC
           LIMIT 1`,
          [work_centre_id, machine_id, emp_id, normalizedStartTime, normalizedFinishTime]
        );
        if (duplicateRows.length > 0) {
          throw Object.assign(new Error(`Duplicate manual entry for this machine/employee/time slot (record #${duplicateRows[0].id})`), {
            statusCode: 409,
            exposeMessage: `Duplicate manual entry for this machine/employee/time slot (record #${duplicateRows[0].id})`,
          });
        }
      } else if (finishProvided) {
        const [duplicateRows] = await conn.execute(
          `SELECT id
           FROM machine_centre_production
           WHERE work_centre_id = ?
             AND machine_id = ?
             AND emp_id = ?
             AND button_status = 2
             AND stoppage_reason IS NOT NULL
             AND stoppage_reason LIKE ?
             AND start_time = ?
             AND finish_time = ?
           ORDER BY id DESC
           LIMIT 1`,
          [work_centre_id, machine_id, emp_id, `${entryMeta.prefix}:%`, normalizedStartTime, normalizedFinishTime]
        );
        if (duplicateRows.length > 0) {
          throw Object.assign(
            new Error(`Duplicate ${entryMeta.kind} entry for this machine/employee/time slot (record #${duplicateRows[0].id})`),
            {
              statusCode: 409,
              exposeMessage: `Duplicate ${entryMeta.kind} entry for this machine/employee/time slot (record #${duplicateRows[0].id})`,
            }
          );
        }
      }

      const stoppageReasonValue = isStoppageEvent
        ? buildStoppageReason(entryMeta.prefix, stoppage_reason, approverIdentity)
        : `MANUAL:${(stoppage_reason || '').trim() || 'Manual entry'} [Approved By: ${approverIdentity}]`;
      const buttonStatus = isOngoingStoppage ? 1 : 2;
      const idleStartTime = isOngoingStoppage ? normalizedStartTime : null;
      const idleStopTime = null;

      const afterData = {
        prod_date: prodDate,
        work_centre_id,
        machine_id,
        emp_id,
        start_time,
        finish_time: finishProvided ? finish_time : null,
        target_mins: isStoppageEvent ? 0 : enforcedTargets.targetMins * (manualOutputPairs / 12),
        output_pairs: manualOutputPairs,
        stoppage_reason: stoppageReasonValue,
        button_status: buttonStatus,
      };

      const [insertResult] = await conn.execute(
        `INSERT INTO machine_centre_production
         (prod_date, work_centre_id, machine_id, emp_id, output_pairs, target_mins,
          start_time, finish_time, idle_start_time, idle_stop_time, stoppage_reason, button_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          prodDate,
          work_centre_id,
          machine_id,
          emp_id,
          manualOutputPairs,
          isStoppageEvent ? 0 : enforcedTargets.targetMins * (manualOutputPairs / 12),
          normalizedStartTime,
          normalizedFinishTime,
          idleStartTime,
          idleStopTime,
          stoppageReasonValue,
          buttonStatus,
        ]
      );
      insertedId = insertResult.insertId;

      await writeManualAuditLog(conn, {
        req,
        action: 'CREATE',
        entryId: insertedId,
        afterData,
        reason: 'Manual entry created',
      });

      summaryData = await recalcSummaryForDayMachineEmployee(conn, {
        prodDate,
        workCentreId: work_centre_id,
        machineId: machine_id,
        empId: emp_id,
      });
    }, { isolationLevel: 'READ COMMITTED' });

    return res.status(201).json({
      success: true,
      message: isStoppageEvent
        ? `${entryMeta.kind === 'breakdown' ? 'Breakdown' : 'Bottleneck'} entry saved successfully`
        : 'Manual production entry saved successfully',
      data: { id: insertedId, target_mins: enforcedTargets.targetMins, output_pairs: manualOutputPairs, ...summaryData }
    });
  } catch (error) {
    if (error?.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.exposeMessage || error.message });
    }
    logger.error('Error creating manual production entry:', error);
    next(error);
  }
};

exports.getManualEntries = async (req, res, next) => {
  try {
    const { date, from_date, to_date, work_centre_id, machine_id, emp_id, search } = req.query;
    const type = String(req.query.type || 'manual').trim().toLowerCase();
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const rawLimit = String(req.query.limit || '20').trim().toLowerCase();
    const useAll = rawLimit === 'all';
    const limit = useAll ? null : Math.min(200, Math.max(1, parseInt(rawLimit, 10) || 20));
    const offset = useAll ? 0 : (page - 1) * limit;
    const sortByRaw = String(req.query.sort_by || 'created_at').trim();
    const sortOrder = String(req.query.sort_order || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const sortByMap = {
      created_at: 'mcp.created_at',
      start_time: 'mcp.start_time',
      finish_time: 'mcp.finish_time',
      output_pairs: 'mcp.output_pairs',
      target_mins: 'mcp.target_mins',
      machine_id: 'mcp.machine_id',
      emp_id: 'mcp.emp_id',
    };
    const sortBy = sortByMap[sortByRaw] || sortByMap.created_at;

    let where = 'WHERE mcp.stoppage_reason IS NOT NULL';
    const params = [];
    if (type === 'manual') {
      where += ' AND mcp.button_status = 2 AND mcp.stoppage_reason LIKE ?';
      params.push('MANUAL:%');
    } else if (type === 'bottleneck') {
      where += ' AND mcp.button_status IN (1, 2) AND mcp.stoppage_reason LIKE ?';
      params.push('BOTTLENECK:%');
    } else if (type === 'breakdown') {
      where += ' AND mcp.button_status IN (1, 2) AND mcp.stoppage_reason LIKE ?';
      params.push('BREAKDOWN:%');
    } else {
      where += ' AND mcp.button_status = 2';
    }
    if (date) {
      where += ' AND DATE(mcp.prod_date) = ?';
      params.push(date);
    } else {
      if (from_date) {
        where += ' AND DATE(mcp.prod_date) >= ?';
        params.push(from_date);
      }
      if (to_date) {
        where += ' AND DATE(mcp.prod_date) <= ?';
        params.push(to_date);
      }
    }
    if (work_centre_id) {
      where += ' AND mcp.work_centre_id = ?';
      params.push(work_centre_id);
    }
    if (machine_id) {
      where += ' AND mcp.machine_id = ?';
      params.push(machine_id);
    }
    if (emp_id) {
      where += ' AND mcp.emp_id = ?';
      params.push(emp_id);
    }
    if (search && String(search).trim()) {
      const q = `%${String(search).trim()}%`;
      where += ` AND (
        mcp.machine_id LIKE ?
        OR COALESCE(mc.machine_name, mc.name, '') LIKE ?
        OR mcp.emp_id LIKE ?
        OR COALESCE(e.name, '') LIKE ?
        OR COALESCE(wc.name, '') LIKE ?
      )`;
      params.push(q, q, q, q, q);
    }

    const [countRows] = await db.query(
      `SELECT COUNT(*) as total
       FROM machine_centre_production mcp
       LEFT JOIN work_centres wc ON wc.id = mcp.work_centre_id
       LEFT JOIN machine_centres mc ON mc.machine_id = mcp.machine_id
       LEFT JOIN employees e ON e.code = mcp.emp_id
       ${where}`,
      params
    );
    const total = Number(countRows[0]?.total || 0);

    const [sumRows] = await db.query(
      `SELECT COALESCE(SUM(mcp.output_pairs), 0) as total_output_pairs
       FROM machine_centre_production mcp
       LEFT JOIN work_centres wc ON wc.id = mcp.work_centre_id
       LEFT JOIN machine_centres mc ON mc.machine_id = mcp.machine_id
       LEFT JOIN employees e ON e.code = mcp.emp_id
       ${where}`,
      params
    );
    const totalOutputPairs = Number(sumRows[0]?.total_output_pairs || 0);

    const dataSql = `SELECT
        mcp.id,
        mcp.prod_date,
        mcp.work_centre_id,
        wc.name AS work_centre_name,
        mcp.machine_id,
        COALESCE(mc.machine_name, mc.name) AS machine_name,
        mcp.emp_id,
        e.name AS employee_name,
        mcp.target_mins,
        mcp.output_pairs,
        mcp.start_time,
        mcp.finish_time,
        mcp.idle_start_time,
        mcp.idle_stop_time,
        mcp.button_status,
        mcp.stoppage_reason,
        mcp.created_at,
        mcp.updated_at
       FROM machine_centre_production mcp
       LEFT JOIN work_centres wc ON wc.id = mcp.work_centre_id
       LEFT JOIN machine_centres mc ON mc.machine_id = mcp.machine_id
       LEFT JOIN employees e ON e.code = mcp.emp_id
       ${where}
       ORDER BY ${sortBy} ${sortOrder}, mcp.id DESC`;
    const [rows] = useAll
      ? await db.query(dataSql, params)
      : await db.query(`${dataSql} LIMIT ? OFFSET ?`, [...params, limit, offset]);

    const resolvedLimit = useAll ? total : limit;
    const totalPages = useAll ? 1 : Math.max(1, Math.ceil(total / limit));
    res.json({
      success: true,
      data: rows,
      meta: {
        page,
        limit: useAll ? 'all' : resolvedLimit,
        total,
        total_pages: totalPages,
        total_output_pairs: totalOutputPairs,
      }
    });
  } catch (error) {
    logger.error('Error fetching manual production entries:', error);
    next(error);
  }
};

exports.updateManualEntry = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      prod_date,
      work_centre_id,
      machine_id,
      emp_id,
      start_time,
      finish_time,
      output_pairs,
      stoppage_reason,
      approved_by,
      audit_reason,
      entry_type
    } = req.body;

    const [existingRows] = await db.query(
      `SELECT * FROM machine_centre_production WHERE id = ? AND button_status IN (1, 2) AND stoppage_reason IS NOT NULL AND ${STOPPAGE_ENTRY_SQL_FILTER}`,
      [id]
    );
    if (existingRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Manual entry not found' });
    }

    const entryMeta = resolveStoppageEntryMeta(entry_type, existingRows[0].stoppage_reason);
    const finishProvided =
      finish_time !== undefined && finish_time !== null && String(finish_time).trim() !== '';

    if (!prod_date || !work_centre_id || !machine_id || !emp_id || !start_time) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    if (!entryMeta.isStoppageEvent && !finishProvided) {
      return res.status(400).json({ success: false, message: 'finish_time is required for manual production entries' });
    }
    if (output_pairs === undefined || output_pairs === null || Number.isNaN(Number(output_pairs))) {
      return res.status(400).json({ success: false, message: 'output_pairs is required and must be a number' });
    }
    if (!audit_reason || !String(audit_reason).trim()) {
      return res.status(400).json({ success: false, message: 'audit_reason is required for manual entry updates' });
    }
    const manualOutputPairs = entryMeta.isStoppageEvent
      ? 0
      : Math.max(0, Math.round(Number(output_pairs)));
    const approverIdentity = String(
      approved_by ||
      req?.user?.username ||
      req?.user?.name ||
      req?.user?.email ||
      req?.user?.id ||
      'Unknown'
    ).trim();

    const start = new Date(start_time);
    if (Number.isNaN(start.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid start_time' });
    }
    let finish = null;
    if (finishProvided) {
      finish = new Date(finish_time);
      if (Number.isNaN(finish.getTime()) || finish <= start) {
        return res.status(400).json({ success: false, message: 'Invalid start/end time' });
      }
    }
    const startDate = start_time.split('T')[0];
    const finishDate = finishProvided ? finish_time.split('T')[0] : startDate;
    const prodDate = prod_date.split('T')[0];
    if ((finishProvided && startDate !== finishDate) || prodDate !== startDate) {
      return res.status(400).json({ success: false, message: 'prod_date must match start/end date' });
    }
    const normalizedStartTime = toMySqlDateTimeOrNull(start_time);
    const normalizedFinishTime = finishProvided ? toMySqlDateTimeOrNull(finish_time) : null;
    const isClosingStoppage = entryMeta.isStoppageEvent && finishProvided;
    const isOngoingStoppage = entryMeta.isStoppageEvent && !finishProvided;
    const buttonStatus = isOngoingStoppage ? 1 : 2;
    const idleStartTime = isOngoingStoppage ? normalizedStartTime : (isClosingStoppage ? (existingRows[0].idle_start_time || normalizedStartTime) : null);
    const idleStopTime = isClosingStoppage ? normalizedFinishTime : null;

    const [machineRows] = await db.query(
      'SELECT machine_id FROM machine_centres WHERE (machine_id = ? OR code = ?) AND work_centre_id = ? LIMIT 1',
      [machine_id, machine_id, work_centre_id]
    );
    if (machineRows.length === 0) {
      return res.status(400).json({ success: false, message: `Machine ${machine_id} not found for selected line` });
    }
    const [empRows] = await db.query(
      'SELECT code FROM employees WHERE code = ? AND work_centre_id = ? LIMIT 1',
      [emp_id, work_centre_id]
    );
    if (empRows.length === 0) {
      return res.status(400).json({ success: false, message: `Employee ${emp_id} not found for selected line` });
    }

    let summaryData = null;
    let enforcedTargets = { targetMins: 0, targetPairs: 0 };
    const beforeData = existingRows[0];
    await withTransaction(async (conn) => {
      enforcedTargets = await resolveTargetsFromPlan(conn, {
        machineId: machine_id,
        workCentreId: work_centre_id,
        prodDate,
      });

      if (finishProvided) {
        const overlapping = await findOverlappingFinishedCycleOnMachine(conn, {
          machineId: machine_id,
          startTime: start_time,
          finishTime: finish_time,
          excludeId: id,
        });
        if (overlapping) {
          throw Object.assign(new Error(`${MACHINE_CYCLE_OVERLAP_MSG} (record #${overlapping.id})`), {
            statusCode: 409,
            exposeMessage: `${MACHINE_CYCLE_OVERLAP_MSG} (record #${overlapping.id})`,
          });
        }
      }

      const afterData = {
        id: Number(id),
        prod_date: prodDate,
        work_centre_id,
        machine_id,
        emp_id,
        start_time,
        finish_time: finishProvided ? finish_time : null,
        target_mins: entryMeta.isStoppageEvent ? 0 : enforcedTargets.targetMins * (manualOutputPairs / 12),
        output_pairs: manualOutputPairs,
        stoppage_reason: entryMeta.isStoppageEvent
          ? buildStoppageReason(entryMeta.prefix, stoppage_reason, approverIdentity)
          : `MANUAL:${(stoppage_reason || '').trim() || 'Manual entry'} [Approved By: ${approverIdentity}]`,
        button_status: buttonStatus,
      };

      const scaledTargetMins = entryMeta.isStoppageEvent ? 0 : enforcedTargets.targetMins * (manualOutputPairs / 12);

      await conn.execute(
        `UPDATE machine_centre_production
         SET prod_date = ?, work_centre_id = ?, machine_id = ?, emp_id = ?, target_mins = ?, output_pairs = ?,
             start_time = ?, finish_time = ?, idle_start_time = ?, idle_stop_time = ?,
             stoppage_reason = ?, button_status = ?
         WHERE id = ?`,
        [
          prodDate,
          work_centre_id,
          machine_id,
          emp_id,
          scaledTargetMins,
          manualOutputPairs,
          normalizedStartTime,
          normalizedFinishTime,
          idleStartTime,
          idleStopTime,
          afterData.stoppage_reason,
          buttonStatus,
          id,
        ]
      );

      await writeManualAuditLog(conn, {
        req,
        action: 'UPDATE',
        entryId: Number(id),
        beforeData,
        afterData,
        reason: String(audit_reason).trim(),
      });

      summaryData = await recalcSummaryForDayMachineEmployee(conn, {
        prodDate,
        workCentreId: work_centre_id,
        machineId: machine_id,
        empId: emp_id,
      });
    }, { isolationLevel: 'READ COMMITTED' });

    return res.json({
      success: true,
      message: 'Manual entry updated successfully',
      data: { target_mins: enforcedTargets.targetMins, output_pairs: manualOutputPairs, ...summaryData }
    });
  } catch (error) {
    if (error?.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.exposeMessage || error.message });
    }
    logger.error('Error updating manual production entry:', error);
    next(error);
  }
};

exports.deleteManualEntry = async (req, res, next) => {
  try {
    const { id } = req.params;
    const auditReason = String(req.body?.audit_reason || '').trim();
    if (!auditReason) {
      return res.status(400).json({ success: false, message: 'audit_reason is required for manual entry deletion' });
    }
    const [existingRows] = await db.query(
      `SELECT id, prod_date, work_centre_id, machine_id, emp_id
       FROM machine_centre_production
       WHERE id = ? AND button_status IN (1, 2) AND stoppage_reason IS NOT NULL AND ${STOPPAGE_ENTRY_SQL_FILTER}`,
      [id]
    );
    if (existingRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Manual entry not found' });
    }
    const existing = existingRows[0];

    let summaryData = null;
    await withTransaction(async (conn) => {
      await conn.execute('DELETE FROM machine_centre_production WHERE id = ?', [id]);
      await writeManualAuditLog(conn, {
        req,
        action: 'DELETE',
        entryId: Number(id),
        beforeData: existing,
        reason: auditReason,
      });
      summaryData = await recalcSummaryForDayMachineEmployee(conn, {
        prodDate: existing.prod_date,
        workCentreId: existing.work_centre_id,
        machineId: existing.machine_id,
        empId: existing.emp_id,
      });
    }, { isolationLevel: 'READ COMMITTED' });

    return res.json({ success: true, message: 'Manual entry deleted successfully', data: summaryData });
  } catch (error) {
    logger.error('Error deleting manual production entry:', error);
    next(error);
  }
};

exports.getManualEntryAuditLogs = async (req, res, next) => {
  try {
    const { entry_id, search, action } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const rawLimit = String(req.query.limit || '50').trim().toLowerCase();
    const useAll = rawLimit === 'all';
    const safeLimit = useAll ? null : Math.min(500, Math.max(1, parseInt(rawLimit, 10) || 50));
    const offset = useAll ? 0 : (page - 1) * safeLimit;

    let where = 'WHERE 1=1';
    const params = [];

    if (entry_id) {
      where += ' AND al.entry_id = ?';
      params.push(Number(entry_id));
    }
    if (action && ['CREATE', 'UPDATE', 'DELETE'].includes(String(action).toUpperCase())) {
      where += ' AND al.action = ?';
      params.push(String(action).toUpperCase());
    }
    if (search && String(search).trim()) {
      const q = `%${String(search).trim()}%`;
      where += ` AND (
        CAST(al.entry_id AS CHAR) LIKE ?
        OR COALESCE(al.actor_username, '') LIKE ?
        OR COALESCE(al.actor_role, '') LIKE ?
        OR COALESCE(al.reason, '') LIKE ?
        OR COALESCE(al.action, '') LIKE ?
      )`;
      params.push(q, q, q, q, q);
    }

    const [countRows] = await db.query(
      `SELECT COUNT(*) AS total
       FROM manual_entry_audit_logs al
       ${where}`,
      params
    );
    const total = Number(countRows[0]?.total || 0);

    const baseSql = `SELECT
        al.id,
        al.entry_id,
        al.action,
        al.actor_user_id,
        al.actor_username,
        al.actor_role,
        al.reason,
        al.before_data,
        al.after_data,
        al.created_at
      FROM manual_entry_audit_logs al
      ${where}
      ORDER BY al.created_at DESC, al.id DESC`;

    const [rows] = useAll
      ? await db.query(baseSql, params)
      : await db.query(`${baseSql} LIMIT ? OFFSET ?`, [...params, safeLimit, offset]);

    res.json({
      success: true,
      data: rows,
      meta: {
        page,
        limit: useAll ? 'all' : safeLimit,
        total,
        total_pages: useAll ? 1 : Math.max(1, Math.ceil(total / safeLimit)),
      },
    });
  } catch (error) {
    logger.error('Error fetching manual entry audit logs:', error);
    next(error);
  }
};

exports.restoreManualEntryFromAuditLog = async (req, res, next) => {
  try {
    const { logId } = req.params;
    const [logRows] = await db.query(
      `SELECT id, entry_id, action, before_data, after_data
       FROM manual_entry_audit_logs
       WHERE id = ?
       LIMIT 1`,
      [logId]
    );
    if (logRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Audit log not found' });
    }

    const log = logRows[0];
    if (log.action !== 'DELETE') {
      return res.status(400).json({ success: false, message: 'Only DELETE audit logs can be restored' });
    }

    let snapshot = null;
    try {
      snapshot = log.before_data ? JSON.parse(log.before_data) : null;
    } catch {
      snapshot = null;
    }

    const hasRequiredSnapshotFields = (obj) => {
      if (!obj || typeof obj !== 'object') return false;
      return !!(
        obj.prod_date &&
        obj.work_centre_id &&
        obj.machine_id &&
        obj.emp_id &&
        obj.start_time &&
        obj.finish_time
      );
    };

    // Backward compatibility: older DELETE logs may only contain minimal fields.
    // If required fields are missing, recover from the latest CREATE/UPDATE after_data for same entry.
    if (!hasRequiredSnapshotFields(snapshot) && log.entry_id) {
      const [fallbackRows] = await db.query(
        `SELECT id, action, after_data
         FROM manual_entry_audit_logs
         WHERE entry_id = ?
           AND action IN ('CREATE', 'UPDATE')
           AND after_data IS NOT NULL
         ORDER BY id DESC
         LIMIT 1`,
        [log.entry_id]
      );

      if (fallbackRows.length > 0) {
        try {
          const fallbackSnapshot = JSON.parse(fallbackRows[0].after_data);
          if (hasRequiredSnapshotFields(fallbackSnapshot)) {
            snapshot = fallbackSnapshot;
          }
        } catch {
          // ignore and continue with validation below
        }
      }
    }

    if (!hasRequiredSnapshotFields(snapshot)) {
      return res.status(400).json({
        success: false,
        message: 'Audit snapshot does not contain required fields',
      });
    }

    const prodDate = String(snapshot.prod_date || '').split('T')[0];
    const workCentreId = Number(snapshot.work_centre_id);
    const machineId = String(snapshot.machine_id || '');
    const empId = String(snapshot.emp_id || '');
    const startTime = snapshot.start_time;
    const finishTime = snapshot.finish_time;
    const targetMins = Number(snapshot.target_mins || 0);
    const outputPairs = Number(snapshot.output_pairs || 0);
    const stoppageReason = String(snapshot.stoppage_reason || 'MANUAL:Restored from audit log');

    if (!prodDate || !workCentreId || !machineId || !empId || !startTime || !finishTime) {
      return res.status(400).json({ success: false, message: 'Audit snapshot does not contain required fields' });
    }

    const [lockRows] = await db.query(
      'SELECT id FROM production_day_locks WHERE lock_date = ? AND work_centre_id = ? LIMIT 1',
      [prodDate, workCentreId]
    );
    if (lockRows.length > 0) {
      return res.status(423).json({
        success: false,
        message: `Production for ${prodDate} is locked and cannot be modified.`
      });
    }

    const [machineRows] = await db.query(
      'SELECT machine_id FROM machine_centres WHERE (machine_id = ? OR code = ?) AND work_centre_id = ? LIMIT 1',
      [machineId, machineId, workCentreId]
    );
    if (machineRows.length === 0) {
      return res.status(400).json({ success: false, message: `Machine ${machineId} not found for selected line` });
    }

    const [empRows] = await db.query(
      'SELECT code FROM employees WHERE code = ? AND work_centre_id = ? LIMIT 1',
      [empId, workCentreId]
    );
    if (empRows.length === 0) {
      return res.status(400).json({ success: false, message: `Employee ${empId} not found for selected line` });
    }

    const [unfinishedRows] = await db.query(
      `SELECT id
       FROM machine_centre_production
       WHERE machine_id = ? AND emp_id = ? AND DATE(prod_date) = ? AND button_status != 2
       ORDER BY created_at DESC
       LIMIT 1`,
      [machineId, empId, prodDate]
    );
    if (unfinishedRows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Cannot restore while an active production cycle exists for this machine and employee',
        data: { existing_id: unfinishedRows[0].id }
      });
    }

    let restoredId = null;
    let summaryData = null;
    await withTransaction(async (conn) => {
      const overlapping = await findOverlappingFinishedCycleOnMachine(conn, {
        machineId,
        startTime,
        finishTime,
      });
      if (overlapping) {
        throw Object.assign(new Error(`${MACHINE_CYCLE_OVERLAP_MSG} (record #${overlapping.id})`), {
          statusCode: 409,
          exposeMessage: `${MACHINE_CYCLE_OVERLAP_MSG} (record #${overlapping.id})`,
        });
      }

      const [insertResult] = await conn.execute(
        `INSERT INTO machine_centre_production
         (prod_date, work_centre_id, machine_id, emp_id, output_pairs, target_mins,
          start_time, finish_time, idle_start_time, idle_stop_time, stoppage_reason, button_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, 2)`,
        [prodDate, workCentreId, machineId, empId, Math.max(0, outputPairs), Math.max(0, targetMins), startTime, finishTime, stoppageReason]
      );
      restoredId = insertResult.insertId;

      await writeManualAuditLog(conn, {
        req,
        action: 'CREATE',
        entryId: restoredId,
        afterData: {
          prod_date: prodDate,
          work_centre_id: workCentreId,
          machine_id: machineId,
          emp_id: empId,
          start_time: startTime,
          finish_time: finishTime,
          target_mins: Math.max(0, targetMins),
          output_pairs: Math.max(0, outputPairs),
          stoppage_reason: stoppageReason,
        },
        reason: `Restored from audit log #${log.id}${log.entry_id ? ` (entry ${log.entry_id})` : ''}`,
      });

      summaryData = await recalcSummaryForDayMachineEmployee(conn, {
        prodDate,
        workCentreId,
        machineId,
        empId,
      });
    }, { isolationLevel: 'READ COMMITTED' });

    return res.json({
      success: true,
      message: 'Manual entry restored successfully',
      data: { id: restoredId, restored_from_log_id: Number(log.id), ...summaryData },
    });
  } catch (error) {
    if (error?.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.exposeMessage || error.message });
    }
    logger.error('Error restoring manual entry from audit log:', error);
    next(error);
  }
};

// Update production data
exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      prod_date,
      work_centre_id,
      machine_id,
      emp_id,
      output_pairs,
      target_mins,
      start_time,
      finish_time,
      idle_start_time,
      idle_stop_time,
      button_status
    } = req.body;

    const timezoneFields = { start_time, finish_time, idle_start_time, idle_stop_time };
    for (const [field, value] of Object.entries(timezoneFields)) {
      if (hasTimezoneInDateTime(value)) {
        return res.status(400).json({
          success: false,
          message: `${field} must be local datetime without timezone (send YYYY-MM-DD HH:mm:ss or YYYY-MM-DDTHH:mm:ss).`,
        });
      }
    }

    // SECURITY: Block status changes through PUT - use PATCH /status instead
    if (button_status !== undefined) {
      logger.warn(`BLOCKED: Attempt to change button_status via PUT for record ${id}. Use PATCH /status endpoint instead.`);
      return res.status(400).json({
        success: false,
        message: 'Status changes not allowed via PUT. Use PATCH /api/mobile-production/:id/status endpoint instead.'
      });
    }

    const normalizedStartTime = toMySqlDateTimeOrNull(start_time);
    const normalizedFinishTime = toMySqlDateTimeOrNull(finish_time);
    const normalizedIdleStartTime = toMySqlDateTimeOrNull(idle_start_time);
    const normalizedIdleStopTime = toMySqlDateTimeOrNull(idle_stop_time);
    const [existingRows] = await db.query('SELECT * FROM machine_centre_production WHERE id = ? LIMIT 1', [id]);
    if (existingRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Production data not found' });
    }
    const existingRecord = existingRows[0];

    const toDateOnly = (value) => {
      if (!value) return null;
      if (typeof value === 'string') return value.slice(0, 10);
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return null;
      const pad = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    };

    // Normalize prod_date to start_time date when available to avoid day drift.
    const normalizedProdDate =
      toDateOnly(normalizedStartTime) ||
      toDateOnly(prod_date) ||
      toDateOnly(existingRecord.prod_date);
    // If finish_time is provided, this row is completed.
    const normalizedButtonStatus = normalizedFinishTime ? 2 : Number(existingRecord.button_status || 1);

    if (normalizedStartTime && normalizedFinishTime) {
      if (new Date(normalizedFinishTime) <= new Date(normalizedStartTime)) {
        return res.status(400).json({
          success: false,
          message: 'finish_time must be after start_time',
        });
      }
      const overlap = await findOverlappingFinishedCycleOnMachine(db, {
        machineId: machine_id,
        startTime: normalizedStartTime,
        finishTime: normalizedFinishTime,
        excludeId: id,
      });
      if (overlap) {
        return res.status(409).json({
          success: false,
          message: `${MACHINE_CYCLE_OVERLAP_MSG} (conflicts with record #${overlap.id})`,
        });
      }
    }

    const [result] = await db.query(
      `UPDATE machine_centre_production 
       SET prod_date = ?, work_centre_id = ?, machine_id = ?, emp_id = ?,
           output_pairs = ?, target_mins = ?, start_time = ?, finish_time = ?,
           idle_start_time = ?, idle_stop_time = ?, button_status = ?
       WHERE id = ?`,
      [
        normalizedProdDate,
        work_centre_id,
        machine_id,
        emp_id,
        output_pairs,
        target_mins,
        normalizedStartTime,
        normalizedFinishTime,
        normalizedIdleStartTime,
        normalizedIdleStopTime,
        normalizedButtonStatus,
        id
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Production data not found' });
    }

    let summaryData = null;
    if (normalizedButtonStatus === 2 && normalizedProdDate && work_centre_id && machine_id && emp_id) {
      summaryData = await recalcSummaryForDayMachineEmployee(db, {
        prodDate: normalizedProdDate,
        workCentreId: work_centre_id,
        machineId: machine_id,
        empId: emp_id,
      });
    }

    res.json({
      success: true,
      message: 'Production data updated successfully',
      data: {
        id: Number(id),
        prod_date: normalizedProdDate,
        button_status: normalizedButtonStatus,
        ...(summaryData || {}),
      },
    });
  } catch (error) {
    logger.error('Error updating production data:', error);
    next(error);
  }
};

// Update button status (Start/Finish/Stop) and/or actual_time
exports.updateStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { button_status, output_pairs, actual_time, stoppage_reason, emp_id, session_id } = req.body;
    const normalizedButtonStatus = button_status === 3 ? 1 : button_status;
    const isGoingIdle = button_status === 3; // original 3 = stop/idle

    // DEBUG: Log all status change requests for troubleshooting ghost records
    logger.info(`[STATUS-CHANGE] Record ${id}: requested_status=${button_status}, normalized=${normalizedButtonStatus}, emp_id=${emp_id}, session_id=${session_id}, output_pairs=${output_pairs}, ip=${req.ip}, ua=${req.headers['user-agent']?.substring(0, 50)}`);

    // Get existing record first (outside transaction to ensure we have current data)
    const [existingRows] = await db.execute('SELECT * FROM machine_centre_production WHERE id = ?', [id]);
    if (existingRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Production data not found' });
    }
    const existingRecord = existingRows[0];
    
    // DEBUG: Log current state before change
    logger.info(`[STATUS-CHANGE] Record ${id}: current_status=${existingRecord.button_status}, current_start_time=${existingRecord.start_time}, current_finish_time=${existingRecord.finish_time}`);

    let updateQuery = 'UPDATE machine_centre_production SET';
    let params = [];
    let hasUpdate = false;

    // Handle button_status update (may not be provided during time-only sync)
    if (normalizedButtonStatus !== undefined) {
      updateQuery += ' button_status = ?';
      params.push(normalizedButtonStatus);
      hasUpdate = true;

      if (normalizedButtonStatus === 2) {
        // GHOST RECORD DETECTION: Block finishes within 1 minute to prevent accidental clicks
        // Most production cycles take 15-30 minutes, so 1 minute minimum prevents mistakes
        const startTime = existingRecord.start_time ? new Date(existingRecord.start_time) : null;
        const now = new Date();
        const elapsedSeconds = startTime ? Math.floor((now - startTime) / 1000) : 0;
        
        if (startTime && elapsedSeconds < 60) {
          logger.warn(`[GHOST-DETECTED] Record ${id} being finished after only ${elapsedSeconds} seconds! Machine=${existingRecord.machine_id}, Emp=${existingRecord.emp_id}. Blocking suspicious finish.`);
          return res.status(400).json({
            success: false,
            message: `Cannot finish production cycle after only ${elapsedSeconds} seconds. Minimum cycle time is 1 minute.`
          });
        }
        
        // Root-cause fix:
        // Some machines resume an older unfinished record (date-agnostic lookup).
        // If that old record is finished today, it previously kept old prod_date and
        // was excluded from today's output summary. Force prod_date to today on FINISH
        // so the completed cycle is counted in today's totals.
        // Block finish if a manual entry already covers the start→now window for this machine+employee.
        const finishNow = new Date();
        const [manualOverlap] = await db.query(
          `SELECT id FROM machine_centre_production
           WHERE machine_id = ? AND emp_id = ? AND DATE(prod_date) = CURDATE()
             AND button_status = 2 AND stoppage_reason LIKE 'MANUAL:%'
             AND start_time < ? AND finish_time > ?
           LIMIT 1`,
          [existingRecord.machine_id, existingRecord.emp_id,
           finishNow.toISOString().slice(0, 19).replace('T', ' '),
           existingRecord.start_time]
        );
        if (manualOverlap.length > 0) {
          logger.warn(`[MANUAL-OVERLAP] Record ${id} finish blocked — manual entry #${manualOverlap[0].id} covers this time window.`);
          return res.status(409).json({
            success: false,
            message: 'A manual production entry already covers this time period. Cannot finish this cycle.'
          });
        }

        const normalizedOutputPairs = Number(output_pairs);
        const finishOutputPairsRaw = Number.isFinite(normalizedOutputPairs) && normalizedOutputPairs > 0 ? normalizedOutputPairs : 6;
        const finishOutputPairs = Math.max(1, Math.min(12, Math.round(finishOutputPairsRaw)));
        if (finishOutputPairs !== normalizedOutputPairs) {
          logger.warn(`[STATUS-CHANGE] Record ${id}: invalid finish output_pairs=${output_pairs}. Forcing to ${finishOutputPairs}.`);
        }

        const [[todayRow]] = await db.execute('SELECT CURDATE() as today');
        const today = todayRow?.today;
        const resolvedTargets = await resolveTargetsFromPlan(db, {
          machineId: existingRecord.machine_id,
          workCentreId: existingRecord.work_centre_id,
          prodDate: today,
        });
        const baseTargetMins = Number(resolvedTargets?.targetMins || existingRecord.target_mins || 0);
        const scaledTargetMins = baseTargetMins > 0 ? (baseTargetMins * (finishOutputPairs / 12)) : 0;

        updateQuery += ', finish_time = NOW(), prod_date = CURDATE(), output_pairs = ?, target_mins = ?';
        params.push(finishOutputPairs, scaledTargetMins);
      } else if (normalizedButtonStatus === 1) {
        if (isGoingIdle) {
          // Machine stopping — record idle start time and reason
          updateQuery += ', idle_start_time = NOW()';
          if (stoppage_reason) { updateQuery += ', stoppage_reason = ?'; params.push(stoppage_reason); }
        } else {
          // Machine resuming from idle
          updateQuery += ', idle_stop_time = NOW()';
        }
      }
    }

    if (!hasUpdate) {
      return res.json({ success: true, message: 'No updates required' });
    }

    updateQuery += ' WHERE id = ?';
    params.push(id);
    
    // CRITICAL: Use transaction for atomicity - both production update AND summary update succeed or fail together
    let updateResult, summaryData;
    
    try {
      await withTransaction(async (conn) => {
        if (normalizedButtonStatus === 2 && existingRecord.start_time) {
          const [overlapRows] = await conn.execute(
            `SELECT id FROM machine_centre_production
             WHERE machine_id = ? AND button_status = 2 AND id != ?
               AND start_time IS NOT NULL AND finish_time IS NOT NULL
               AND start_time < NOW() AND finish_time > ?`,
            [existingRecord.machine_id, id, existingRecord.start_time]
          );
          if (overlapRows.length > 0) {
            throw Object.assign(
              new Error(`Finish blocked: overlapping cycle #${overlapRows[0].id}`),
              {
                statusCode: 409,
                exposeMessage: `${MACHINE_CYCLE_OVERLAP_MSG} (conflicts with record #${overlapRows[0].id})`,
              }
            );
          }
        }
        // 1. Update production record
        [updateResult] = await conn.execute(updateQuery, params);
        
        if (updateResult.affectedRows === 0) {
          throw new Error(`Record ${id} not updated - may not exist or already finished`);
        }
        
        logger.info(`[FINISH-SUCCESS] Record ${id} updated: button_status=${normalizedButtonStatus}, affectedRows=${updateResult.affectedRows}`);

        // 2. On finish: update summary table atomically within same transaction
        if (normalizedButtonStatus === 2) {
          const prod = existingRecord;
          
          // IMPORTANT: Use DB date (CURDATE) for consistency with DB timezone.
          const [[todayRow]] = await conn.execute('SELECT CURDATE() as today');
          const today = todayRow.today;
          
          // Get all finished records and calculate sums manually
          const [finishedRecords] = await conn.execute(
            `SELECT 
              output_pairs, 
              target_mins,
              TIMESTAMPDIFF(MINUTE, start_time, finish_time) as actual_mins,
              COALESCE(idle_mins, 0) as idle_mins
             FROM machine_centre_production 
             WHERE DATE(prod_date) = ? AND work_centre_id = ? AND machine_id = ? AND emp_id = ? AND button_status = 2`,
            [today, prod.work_centre_id, prod.machine_id, prod.emp_id]
          );
          
          // Calculate totals manually
          let totalOutput = 0;
          let totalTargetMins = 0;
          let totalActualMins = 0;
          let totalIdleMins = 0;
          
          finishedRecords.forEach(record => {
            totalOutput += parseInt(record.output_pairs) || 0;
            totalTargetMins += parseFloat(record.target_mins) || 0;
            totalActualMins += parseFloat(record.actual_mins) || 0;
            totalIdleMins += parseFloat(record.idle_mins) || 0;
          });
          
          const cumAvgTime = totalOutput > 0 ? (totalActualMins / totalOutput) : 0;
          
          // avg_efficiency_percent is a GENERATED COLUMN - MySQL calculates it automatically
          // Formula in DB: (total_target_mins / total_actual_mins) * 100
          
          logger.info(`[SUMMARY-CALC] ${prod.machine_id}: output=${totalOutput}, cycles=${finishedRecords.length}, target=${totalTargetMins}m, actual=${totalActualMins}m`);
          
          // Update summary atomically within transaction
          const [summaryResult] = await conn.execute(
            `INSERT INTO machine_centre_summary
             (prod_date, work_centre_id, machine_id, emp_id, total_output_pairs, total_target_mins, total_actual_mins, total_idle_mins, cum_avg_time, button_status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               total_output_pairs = VALUES(total_output_pairs),
               total_target_mins = VALUES(total_target_mins),
               total_actual_mins = VALUES(total_actual_mins),
               total_idle_mins = VALUES(total_idle_mins),
               cum_avg_time = VALUES(cum_avg_time),
               button_status = VALUES(button_status),
               updated_at = CURRENT_TIMESTAMP`,
            [today, prod.work_centre_id, prod.machine_id, prod.emp_id,
             totalOutput, totalTargetMins, totalActualMins, totalIdleMins, cumAvgTime, 2]
          );
          
          logger.info(`[SUMMARY-UPDATED] ${prod.machine_id}: ${totalOutput} pairs, affectedRows=${summaryResult.affectedRows}`);
          
          summaryData = {
            total_output_pairs: totalOutput,
            total_cycles: finishedRecords.length,
            summary_updated: true
          };
        }
      }, { isolationLevel: 'READ COMMITTED' }); // Ensure we see our own changes
      
      // Transaction succeeded - send response
      if (normalizedButtonStatus === 2 && summaryData) {
        res.json({ 
          success: true, 
          message: 'Status updated successfully',
          data: summaryData
        });
      } else {
        res.json({ success: true, message: 'Status updated successfully' });
      }
      
    } catch (txError) {
      if (txError?.statusCode === 409) {
        return res.status(409).json({
          success: false,
          message: txError.exposeMessage || txError.message,
        });
      }
      logger.error(`[TRANSACTION-FAILED] Record ${id}:`, txError);
      return res.status(500).json({ 
        success: false, 
        message: 'Database update failed. Please retry.',
        error: txError.message 
      });
    }
  } catch (error) {
    logger.error('Error updating status:', error);
    next(error);
  }
};

// Delete production data
exports.delete = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Fetch record metadata before deleting so we can recalculate the summary
    const [existingRows] = await db.query(
      'SELECT id, prod_date, work_centre_id, machine_id, emp_id FROM machine_centre_production WHERE id = ?',
      [id]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Production data not found' });
    }

    const existing = existingRows[0];

    let summaryData = null;
    await withTransaction(async (conn) => {
      const [result] = await conn.execute('DELETE FROM machine_centre_production WHERE id = ?', [id]);
      if (result.affectedRows === 0) {
        throw Object.assign(new Error('Production data not found'), { status: 404 });
      }
      // Recalculate summary so TV dashboard and reports stay in sync
      summaryData = await recalcSummaryForDayMachineEmployee(conn, {
        prodDate: existing.prod_date,
        workCentreId: existing.work_centre_id,
        machineId: existing.machine_id,
        empId: existing.emp_id,
      });
    }, { isolationLevel: 'READ COMMITTED' });

    res.json({ success: true, message: 'Production data deleted successfully', data: summaryData });
  } catch (error) {
    if (error.status === 404) {
      return res.status(404).json({ success: false, message: error.message });
    }
    logger.error('Error deleting production data:', error);
    next(error);
  }
};

// Get summary data (aggregated)
exports.getPivotData = async (req, res, next) => {
  try {
    const [rows] = await db.query(`
      SELECT pd.*, 
             wc.name as work_centre_name,
             e.name as employee_name
      FROM machine_centre_summary pd
      LEFT JOIN work_centres wc ON pd.work_centre_id = wc.id
      LEFT JOIN employees e ON pd.emp_id = e.code
      ORDER BY pd.prod_date DESC, pd.created_at DESC
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    logger.error('Error fetching summary data:', error);
    next(error);
  }
};

// Refresh summary data (aggregate from machine_centre_production)
exports.refreshPivotData = async (req, res, next) => {
  try {
    await db.query('TRUNCATE TABLE machine_centre_summary');

    await db.query(`
      INSERT INTO machine_centre_summary 
        (prod_date, work_centre_id, machine_id, emp_id, total_output_pairs, total_target_mins, 
         total_actual_mins, total_idle_mins, avg_efficiency_percent, cum_avg_time, button_status)
      SELECT 
        prod_date, work_centre_id, machine_id, emp_id,
        SUM(output_pairs),
        SUM(target_mins),
        SUM(actual_time),
        SUM(idle_mins),
        CASE WHEN SUM(target_mins) > 0 THEN (SUM(actual_time) / SUM(target_mins)) * 100 ELSE 0 END,
        SUM(actual_time) / 12,
        MAX(button_status)
      FROM machine_centre_production
      GROUP BY prod_date, work_centre_id, machine_id, emp_id
    `);

    res.json({ success: true, message: 'Summary data refreshed successfully' });
  } catch (error) {
    logger.error('Error refreshing summary data:', error);
    next(error);
  }
};

// Get current live status for a specific machine
exports.getLiveMachineStatus = async (req, res, next) => {
  try {
    const { machineId } = req.params;

    const [rows] = await db.query(`
      SELECT pd.*, e.name as emp_name, e.code as emp_code
      FROM machine_centre_production pd
      JOIN employees e ON pd.emp_id = e.code
      WHERE pd.machine_id = ? AND pd.prod_date = CURDATE()
      ORDER BY pd.created_at DESC LIMIT 1
    `, [machineId]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'No live data for this machine today' });
    }

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    logger.error('Error fetching live machine status:', error);
    next(error);
  }
};

/** URL / DB sometimes disagree on leading zeros (e.g. "02" vs "2"). */
const expandMachineIdKeys = (machineId) => {
  const raw = String(machineId || '').trim();
  if (!raw) return [];
  const keys = new Set([raw]);
  if (/^\d+$/.test(raw)) {
    const n = parseInt(raw, 10);
    if (Number.isFinite(n)) {
      keys.add(String(n));
      keys.add(String(n).padStart(2, '0'));
    }
  }
  return [...keys];
};

// Get summary data for a specific machine and date
exports.getSummaryByMachineAndDate = async (req, res, next) => {
  try {
    const { machineId, date } = req.params;
    logger.info(`Fetching summary for machine: ${machineId}, date: ${date}`);

    const machineKeys = expandMachineIdKeys(machineId);
    const inList = machineKeys.length ? machineKeys : [machineId];
    const ph = inList.map(() => '?').join(', ');

    let workCentreId = null;

    const [mcFromMaster] = await db.query(
      `SELECT work_centre_id FROM machine_centres
       WHERE machine_id IN (${ph}) OR code IN (${ph})
       LIMIT 1`,
      [...inList, ...inList]
    );
    if (mcFromMaster.length > 0 && mcFromMaster[0].work_centre_id != null) {
      workCentreId = mcFromMaster[0].work_centre_id;
    }

    if (workCentreId == null) {
      const [sessRows] = await db.query(
        `SELECT work_centre_id FROM mobile_sessions
         WHERE machine_id IN (${ph}) AND status = 'active'
         ORDER BY activated_at DESC
         LIMIT 1`,
        [...inList]
      );
      if (sessRows.length > 0 && sessRows[0].work_centre_id != null) {
        workCentreId = sessRows[0].work_centre_id;
      }
    }

    if (workCentreId == null) {
      const [prodWcRows] = await db.query(
        `SELECT work_centre_id FROM machine_centre_production
         WHERE machine_id IN (${ph}) AND DATE(prod_date) = DATE(?)
         ORDER BY id DESC
         LIMIT 1`,
        [...inList, date]
      );
      if (prodWcRows.length > 0 && prodWcRows[0].work_centre_id != null) {
        workCentreId = prodWcRows[0].work_centre_id;
      }
    }

    let dailyTargetPairs = null;
    let planManHoursMinutes = null;
    if (workCentreId != null) {
      // Match TV dashboard / line performance: sum all styles for the line+date, tolerate DATE vs DATETIME
      const [planAgg] = await db.query(
        `SELECT
           COALESCE(SUM(total_target_per_day), 0) AS total_target_sum,
           COALESCE(MAX(NULLIF(man_hours_minutes, 0)), NULL) AS man_hours_pick
         FROM production_plan
         WHERE work_centre_id = ?
           AND DATE(plan_date) = DATE(?)
           AND deleted_at IS NULL`,
        [workCentreId, date]
      );
      if (planAgg.length > 0) {
        const sumT = parseInt(planAgg[0].total_target_sum, 10);
        if (Number.isFinite(sumT) && sumT > 0) {
          dailyTargetPairs = sumT;
        }
        const mh = parseInt(planAgg[0].man_hours_pick, 10);
        if (Number.isFinite(mh) && mh > 0) {
          planManHoursMinutes = mh;
        }
      }
    }

    // CRITICAL FIX: Always recalculate from production records to ensure fresh data
    // Don't rely solely on summary table which may have stale/generated column issues
    // Use DATE(prod_date) to handle timezone differences in date comparison
    const [productionRows] = await db.query(`
      SELECT 
        COALESCE(SUM(output_pairs), 0) as total_output_pairs,
        COALESCE(SUM(target_mins), 0) as total_target_mins,
        COALESCE(SUM(TIMESTAMPDIFF(MINUTE, start_time, finish_time)), 0) as total_actual_mins,
        COALESCE(SUM(COALESCE(idle_mins, 0)), 0) as total_idle_mins,
        COUNT(*) as total_cycles
      FROM machine_centre_production
      WHERE machine_id IN (${ph}) AND DATE(prod_date) = DATE(?) AND button_status = 2
    `, [...inList, date]);

    const prodData = productionRows[0] || {};

    const totalOutput = parseInt(prodData.total_output_pairs, 10) || 0;
    const totalTargetMins = parseFloat(prodData.total_target_mins) || 0;
    const totalActualMins = parseFloat(prodData.total_actual_mins) || 0;
    const totalIdleMins = parseFloat(prodData.total_idle_mins) || 0;
    const totalCycles = parseInt(prodData.total_cycles, 10) || 0;

    // Efficiency = (target / actual) * 100 (higher is better - they beat the target)
    const avgEfficiency = totalActualMins > 0
      ? ((totalTargetMins / totalActualMins) * 100).toFixed(1)
      : '0';
    const cumAvgTime = totalOutput > 0
      ? (totalActualMins / totalOutput).toFixed(2)
      : '0';

    const result = {
      machine_id: machineId,
      prod_date: date,
      work_centre_id: workCentreId,
      total_output_pairs: totalOutput,
      total_target_mins: totalTargetMins,
      total_actual_mins: totalActualMins,
      total_idle_mins: totalIdleMins,
      avg_efficiency_percent: avgEfficiency,
      cum_avg_time: cumAvgTime,
      total_cycles: totalCycles,
      daily_target_pairs: dailyTargetPairs,
      plan_man_hours_minutes: planManHoursMinutes,
    };

    logger.info(`Fresh calc for ${machineId}: ${JSON.stringify(result)}`);

    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Error fetching summary data:', error);
    next(error);
  }
};

// Get initialization data in one call (optimized)
exports.getInitData = async (req, res, next) => {
  try {
    const { machineId, empCode } = req.params;

    // Fetch all data in parallel
    const [employeeRows, machineRows, existingRows] = await Promise.all([
      db.query('SELECT id, code, name FROM employees WHERE code = ?', [empCode]),
      db.query('SELECT machine_id, code, name, work_centre_id FROM machine_centres WHERE machine_id = ? OR code = ?', [machineId, machineId]),
      db.query('SELECT * FROM machine_centre_production WHERE machine_id = ? AND prod_date = CURDATE() AND button_status != 2 ORDER BY created_at DESC LIMIT 1', [machineId])
    ]);

    const employee = employeeRows[0][0];
    const machine = machineRows[0][0];
    const existingRecord = existingRows[0][0];

    if (!employee) {
      return res.status(404).json({ success: false, message: `Employee ${empCode} not found` });
    }

    if (!machine) {
      return res.status(404).json({ success: false, message: `Machine ${machineId} not found` });
    }

    const workCentreId = machine.work_centre_id || 1;
    
    // Override with session work_centre_id if available (set from QR scan)
    const [sessionRows] = await db.query(
      'SELECT work_centre_id FROM mobile_sessions WHERE machine_id = ? AND status = ? ORDER BY activated_at DESC LIMIT 1',
      [machineId, 'active']
    );
    const finalWorkCentreId = (sessionRows[0]?.work_centre_id) || workCentreId;

    // Get work centre
    const [wcRows] = await db.query('SELECT id, name FROM work_centres WHERE id = ?', [finalWorkCentreId]);
    const workCentre = wcRows[0] || { id: finalWorkCentreId, name: `WC-${finalWorkCentreId}` };

    // Get target mins from routing for today's plan and machine
    let targetMins = 0;
    try {
      const [linesRows] = await db.query(
        `SELECT prl.mins_12_prs_box
         FROM production_plan pp
         JOIN production_routing_header prh ON prh.style_id = pp.style_id AND prh.deleted_at IS NULL
         JOIN production_routing_lines prl
           ON prl.routing_header_id = prh.id
           AND prl.machine_centre_id = ?
         WHERE pp.work_centre_id = ?
           AND pp.deleted_at IS NULL
           AND pp.plan_date = CURDATE()
         ORDER BY
           CASE WHEN prh.created_on <= pp.plan_date THEN 0 ELSE 1 END ASC,
           ABS(DATEDIFF(prh.created_on, pp.plan_date)) ASC,
           prh.id DESC
         LIMIT 1`,
        [machineId, finalWorkCentreId]
      );
      if (linesRows.length > 0) targetMins = parseFloat(linesRows[0].mins_12_prs_box || 0);
    } catch (err) {
      logger.warn('Could not fetch routing data, using fallback target mins 0:', err.message);
    }

    // Get target pairs from planning (default 0)
    let targetPairs = 0;
    try {
      const [planningRows] = await db.query('SELECT work_centre_id, target_pairs_per_tray, plan_date FROM production_plan WHERE deleted_at IS NULL ORDER BY plan_date DESC');
      logger.info(`Found ${planningRows.length} planning records. Looking for work_centre_id: ${finalWorkCentreId}`);
      if (planningRows.length > 0) {
        // Find matching work centre or use the latest plan
        const matchingPlan = planningRows.find((p) => p.work_centre_id === finalWorkCentreId);
        if (matchingPlan) {
          targetPairs = matchingPlan.target_pairs_per_tray || 0;
          logger.info(`Found matching plan for work_centre_id ${finalWorkCentreId}: target_pairs = ${targetPairs}`);
        } else {
          // Use latest plan if no exact match
          targetPairs = planningRows[0].target_pairs_per_tray || 0;
          logger.info(`No matching plan for work_centre_id ${finalWorkCentreId}, using latest plan: target_pairs = ${targetPairs}`);
        }
      }
    } catch (err) {
      logger.warn('Could not fetch planning data, using default target pairs:', err.message);
    }

    // Keep unfinished row aligned with latest routing target so resumed sessions don't show stale values.
    if (existingRecord && existingRecord.button_status !== 2) {
      const existingTarget = Number(existingRecord.target_mins || 0);
      const latestTarget = Number(targetMins || 0);
      if (latestTarget > 0 && existingTarget !== latestTarget) {
        await db.query(
          'UPDATE machine_centre_production SET target_mins = ? WHERE id = ?',
          [latestTarget, existingRecord.id]
        );
        existingRecord.target_mins = latestTarget;
      }
    }

    res.json({
      success: true,
      data: {
        employee: { id: employee.code, code: employee.code, name: employee.name }, // Use code as ID for consistency
        machine: { machine_id: machine.machine_id, name: machine.name, machine_name: machine.machine_name, work_centre_id: finalWorkCentreId },
        workCentre: { id: finalWorkCentreId, name: workCentre.name },
        targetMins,
        targetPairs,
        existingRecord
      }
    });
  } catch (error) {
    logger.error('Error fetching init data:', error);
    next(error);
  }
};
