'use strict';

const pool = require('../../config/database');
const logger = require('../utils/logger');
const wipStateService = require('../services/wipStateService');

function clampWip(value) {
  return Math.max(0, Math.round(Number(value) || 0));
}

function toDateKey(value) {
  if (!value) return '';
  if (value instanceof Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
  const s = String(value).trim();
  return s.includes('T') ? s.split('T')[0] : s.slice(0, 10);
}

function mapRow(row) {
  return {
    id: row.id,
    work_centre_id: row.work_centre_id,
    work_centre_name: row.work_centre_name || null,
    state_date: toDateKey(row.state_date),
    opening_wip: clampWip(row.opening_wip),
    today_input: clampWip(row.today_input),
    current_wip: clampWip(row.current_wip),
    closing_wip: clampWip(row.closing_wip),
    is_closed: Boolean(row.is_closed),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function parseBodyFields(body) {
  const work_centre_id = Number(body.work_centre_id);
  const state_date = toDateKey(body.state_date);
  const opening_wip = clampWip(body.opening_wip);
  const today_input = clampWip(body.today_input);
  const current_wip = clampWip(body.current_wip);
  const closing_wip = clampWip(body.closing_wip);
  const is_closed = body.is_closed === true || body.is_closed === 1 || body.is_closed === '1';

  return {
    work_centre_id,
    state_date,
    opening_wip,
    today_input,
    current_wip,
    closing_wip,
    is_closed,
  };
}

exports.listWipDailyState = async (req, res, next) => {
  try {
    const fromDate = toDateKey(req.query.from_date || req.query.date_from);
    const toDate = toDateKey(req.query.to_date || req.query.date_to);
    const workCentreId = req.query.work_centre_id ? Number(req.query.work_centre_id) : null;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    const offset = (page - 1) * limit;
    const sortOrder = String(req.query.sort_order || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const conditions = [];
    const params = [];

    if (fromDate) {
      conditions.push('w.state_date >= ?');
      params.push(fromDate);
    }
    if (toDate) {
      conditions.push('w.state_date <= ?');
      params.push(toDate);
    }
    if (workCentreId) {
      conditions.push('w.work_centre_id = ?');
      params.push(workCentreId);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM wip_daily_state w ${where}`,
      params
    );
    const total = Number(countRows[0]?.total || 0);

    const [rows] = await pool.query(
      `SELECT w.*, wc.name AS work_centre_name
       FROM wip_daily_state w
       LEFT JOIN work_centres wc ON wc.id = w.work_centre_id
       ${where}
       ORDER BY w.state_date ${sortOrder}, w.work_centre_id ASC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return res.json({
      success: true,
      data: rows.map(mapRow),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    logger.error('Error listing wip_daily_state:', error);
    return next(error);
  }
};

exports.getWipDailyStateById = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [rows] = await pool.query(
      `SELECT w.*, wc.name AS work_centre_name
       FROM wip_daily_state w
       LEFT JOIN work_centres wc ON wc.id = w.work_centre_id
       WHERE w.id = ?`,
      [id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'WIP record not found' });
    }
    return res.json({ success: true, data: mapRow(rows[0]) });
  } catch (error) {
    logger.error('Error fetching wip_daily_state:', error);
    return next(error);
  }
};

exports.createWipDailyState = async (req, res, next) => {
  try {
    const fields = parseBodyFields(req.body);

    if (!fields.work_centre_id || !fields.state_date) {
      return res.status(400).json({
        success: false,
        message: 'work_centre_id and state_date are required',
      });
    }

    const [existing] = await pool.query(
      `SELECT id FROM wip_daily_state WHERE work_centre_id = ? AND state_date = ?`,
      [fields.work_centre_id, fields.state_date]
    );
    if (existing.length) {
      return res.status(409).json({
        success: false,
        message: `WIP record already exists for this line on ${fields.state_date} (id #${existing[0].id})`,
      });
    }

    const [result] = await pool.query(
      `INSERT INTO wip_daily_state
         (work_centre_id, state_date, opening_wip, today_input, current_wip, closing_wip, is_closed, manual_wip_override)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        fields.work_centre_id,
        fields.state_date,
        fields.opening_wip,
        fields.today_input,
        fields.current_wip,
        fields.closing_wip,
        fields.is_closed ? 1 : 0,
      ]
    );

    const [rows] = await pool.query(
      `SELECT w.*, wc.name AS work_centre_name
       FROM wip_daily_state w
       LEFT JOIN work_centres wc ON wc.id = w.work_centre_id
       WHERE w.id = ?`,
      [result.insertId]
    );

    if (fields.is_closed) {
      const closingForNext =
        fields.closing_wip > 0 ? fields.closing_wip : fields.current_wip;
      await wipStateService.openNextDayRowFromClose(
        fields.work_centre_id,
        fields.state_date,
        closingForNext
      );
    }

    return res.status(201).json({
      success: true,
      message: 'WIP record created',
      data: mapRow(rows[0]),
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'WIP record already exists for this line and date' });
    }
    logger.error('Error creating wip_daily_state:', error);
    return next(error);
  }
};

exports.updateWipDailyState = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const fields = parseBodyFields(req.body);

    const [existing] = await pool.query(`SELECT * FROM wip_daily_state WHERE id = ?`, [id]);
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'WIP record not found' });
    }

    const workCentreId = fields.work_centre_id || existing[0].work_centre_id;
    const stateDate = fields.state_date || toDateKey(existing[0].state_date);

    const [dup] = await pool.query(
      `SELECT id FROM wip_daily_state WHERE work_centre_id = ? AND state_date = ? AND id <> ?`,
      [workCentreId, stateDate, id]
    );
    if (dup.length) {
      return res.status(409).json({
        success: false,
        message: `Another WIP record already exists for this line on ${stateDate}`,
      });
    }

    await pool.query(
      `UPDATE wip_daily_state
       SET work_centre_id = ?,
           state_date = ?,
           opening_wip = ?,
           today_input = ?,
           current_wip = ?,
           closing_wip = ?,
           is_closed = ?,
           manual_wip_override = 1
       WHERE id = ?`,
      [
        workCentreId,
        stateDate,
        fields.opening_wip,
        fields.today_input,
        fields.current_wip,
        fields.closing_wip,
        fields.is_closed ? 1 : 0,
        id,
      ]
    );

    if (fields.is_closed) {
      const closingForNext =
        fields.closing_wip > 0 ? fields.closing_wip : fields.current_wip;
      await wipStateService.openNextDayRowFromClose(
        workCentreId,
        stateDate,
        closingForNext
      );
    }

    const [rows] = await pool.query(
      `SELECT w.*, wc.name AS work_centre_name
       FROM wip_daily_state w
       LEFT JOIN work_centres wc ON wc.id = w.work_centre_id
       WHERE w.id = ?`,
      [id]
    );

    return res.json({
      success: true,
      message: 'WIP record updated',
      data: mapRow(rows[0]),
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'WIP record already exists for this line and date' });
    }
    logger.error('Error updating wip_daily_state:', error);
    return next(error);
  }
};

exports.deleteWipDailyState = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [existing] = await pool.query(`SELECT * FROM wip_daily_state WHERE id = ?`, [id]);
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'WIP record not found' });
    }

    await pool.query(`DELETE FROM wip_daily_state WHERE id = ?`, [id]);

    return res.json({
      success: true,
      message: 'WIP record deleted',
      data: mapRow(existing[0]),
    });
  } catch (error) {
    logger.error('Error deleting wip_daily_state:', error);
    return next(error);
  }
};
