const db = require('../../config/database');
const logger = require('../utils/logger');
const { withTransaction, assertExists } = require('../utils/transaction');
const productionPlanningBoardService = require('../services/productionPlanningBoardService');

const PLAN_LIST_SELECT = `
  pp.id,
  DATE_FORMAT(pp.plan_date, '%Y-%m-%d') AS plan_date,
  pp.style_id,
  pp.customer_id,
  pp.group_id,
  pp.leather_id,
  pp.color_id,
  pp.work_centre_id,
  pp.total_target_per_day,
  pp.target_pairs_per_tray,
  pp.tray_count,
  pp.man_hours_minutes,
  pp.smv_per_pair,
  pp.created_at,
  pp.updated_at,
  pp.deleted_at
`;

class ProductionPlanningController {
  normalizePlanPayload(payload = {}) {
    const planDateRaw = payload.plan_date;
    const plan_date = planDateRaw
      ? String(planDateRaw).trim().split('T')[0]
      : planDateRaw;
    return {
      plan_date,
      style_id: payload.style_id,
      customer_id: payload.customer_id,
      group_id: payload.group_id || null,
      leather_id: payload.leather_id || null,
      color_id: payload.color_id || null,
      work_centre_id: payload.work_centre_id,
      total_target_per_day: payload.total_target_per_day,
      target_pairs_per_tray: payload.target_pairs_per_tray,
      tray_count: payload.tray_count || 0,
      man_hours_minutes: payload.man_hours_minutes,
      smv_per_pair: payload.smv_per_pair,
    };
  }

  async validateAndUpsertPlan(conn, payload, existingId = null) {
    const {
      plan_date, style_id, customer_id, group_id, leather_id, color_id,
      work_centre_id, total_target_per_day, target_pairs_per_tray,
      tray_count, man_hours_minutes, smv_per_pair
    } = this.normalizePlanPayload(payload);

    if (!plan_date || !style_id || !customer_id || !work_centre_id ||
      !total_target_per_day || !target_pairs_per_tray || !man_hours_minutes || !smv_per_pair) {
      throw Object.assign(new Error('Required fields are missing'), { status: 400 });
    }

    if (existingId) {
      const [existingRows] = await conn.execute(
        'SELECT id FROM production_plan WHERE id = ? AND deleted_at IS NULL LIMIT 1',
        [existingId]
      );
      if (existingRows.length === 0) {
        throw Object.assign(new Error('Plan not found'), { status: 404 });
      }
    }
    await assertExists(conn, 'styles', style_id, 'Style');
    await assertExists(conn, 'customers', customer_id, 'Customer');
    await assertExists(conn, 'work_centres', work_centre_id, 'Work centre');

    const [routingRows] = await conn.execute(
      'SELECT id FROM production_routing_header WHERE style_id = ? AND deleted_at IS NULL LIMIT 1',
      [style_id]
    );
    if (routingRows.length === 0) {
      throw Object.assign(
        new Error('No production routing found for the selected style. Please create a routing first.'),
        { status: 422 }
      );
    }

    const [dupCheck] = await conn.execute(
      existingId
        ? 'SELECT id FROM production_plan WHERE DATE(plan_date) = DATE(?) AND work_centre_id = ? AND id != ? AND deleted_at IS NULL LIMIT 1'
        : 'SELECT id FROM production_plan WHERE DATE(plan_date) = DATE(?) AND work_centre_id = ? AND deleted_at IS NULL LIMIT 1',
      existingId ? [plan_date, work_centre_id, existingId] : [plan_date, work_centre_id]
    );

    const planFields = [
      plan_date, style_id, customer_id, group_id, leather_id, color_id,
      work_centre_id, total_target_per_day, target_pairs_per_tray, tray_count,
      man_hours_minutes, smv_per_pair,
    ];

    if (dupCheck.length > 0 && !existingId) {
      const replaceId = dupCheck[0].id;
      const [r] = await conn.execute(
        `UPDATE production_plan 
         SET plan_date = ?, style_id = ?, customer_id = ?, group_id = ?,
             leather_id = ?, color_id = ?, work_centre_id = ?, total_target_per_day = ?,
             target_pairs_per_tray = ?, tray_count = ?, man_hours_minutes = ?, smv_per_pair = ?
         WHERE id = ? AND deleted_at IS NULL`,
        [...planFields, replaceId]
      );
      if (r.affectedRows === 0) {
        throw Object.assign(new Error('Plan not found'), { status: 404 });
      }
      return { id: replaceId, replaced: true };
    }
    if (dupCheck.length > 0 && existingId) {
      throw Object.assign(
        new Error('A production plan already exists for this date and work centre. Please edit the existing plan.'),
        { status: 409 }
      );
    }

    if (existingId) {
      const [r] = await conn.execute(
        `UPDATE production_plan 
         SET plan_date = ?, style_id = ?, customer_id = ?, group_id = ?,
             leather_id = ?, color_id = ?, work_centre_id = ?, total_target_per_day = ?,
             target_pairs_per_tray = ?, tray_count = ?, man_hours_minutes = ?, smv_per_pair = ?
         WHERE id = ? AND deleted_at IS NULL`,
        [...planFields, existingId]
      );
      if (r.affectedRows === 0) throw Object.assign(new Error('Plan not found'), { status: 404 });
      return { id: existingId };
    }

    // Soft-deleted row still occupies unique (plan_date, work_centre_id) — revive instead of INSERT
    const [deletedDup] = await conn.execute(
      'SELECT id FROM production_plan WHERE DATE(plan_date) = DATE(?) AND work_centre_id = ? AND deleted_at IS NOT NULL LIMIT 1',
      [plan_date, work_centre_id]
    );
    if (deletedDup.length > 0) {
      const reviveId = deletedDup[0].id;
      await conn.execute(
        `UPDATE production_plan 
         SET deleted_at = NULL, plan_date = ?, style_id = ?, customer_id = ?, group_id = ?,
             leather_id = ?, color_id = ?, work_centre_id = ?, total_target_per_day = ?,
             target_pairs_per_tray = ?, tray_count = ?, man_hours_minutes = ?, smv_per_pair = ?
         WHERE id = ?`,
        [...planFields, reviveId]
      );
      return { id: reviveId, revived: true };
    }

    try {
      const [r] = await conn.execute(
        `INSERT INTO production_plan 
         (plan_date, style_id, customer_id, group_id, leather_id, color_id, work_centre_id,
          total_target_per_day, target_pairs_per_tray, tray_count, man_hours_minutes, smv_per_pair) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        planFields
      );
      return { id: r.insertId };
    } catch (insertErr) {
      if (insertErr && insertErr.code === 'ER_DUP_ENTRY') {
        throw Object.assign(
          new Error('A production plan already exists for this date and work centre (including deleted). Enable "Show deleted" to restore it.'),
          { status: 409 }
        );
      }
      throw insertErr;
    }
  }

  // Get all production plans
  async getAll(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;
      const search = String(req.query.search || '').trim();
      const planDate = String(req.query.plan_date || '').trim();
      const workCentreId = String(req.query.work_centre_id || '').trim();
      const styleId = String(req.query.style_id || '').trim();
      const includeDeleted = String(req.query.include_deleted || '').trim() === '1';
      const whereParts = includeDeleted ? [] : ['pp.deleted_at IS NULL'];
      const params = [];

      if (planDate) {
        whereParts.push('DATE(pp.plan_date) = DATE(?)');
        params.push(planDate.split('T')[0]);
      }
      if (workCentreId) {
        whereParts.push('pp.work_centre_id = ?');
        params.push(workCentreId);
      }
      if (styleId) {
        whereParts.push('pp.style_id = ?');
        params.push(styleId);
      }
      if (search) {
        whereParts.push(`(
          s.name LIKE ? OR c.name LIKE ? OR wc.name LIKE ? OR
          pp.total_target_per_day LIKE ? OR pp.target_pairs_per_tray LIKE ?
        )`);
        const like = `%${search}%`;
        params.push(like, like, like, like, like);
      }
      const whereClause = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

      const [rows] = await db.query(`
        SELECT 
          ${PLAN_LIST_SELECT},
          CASE WHEN pp.deleted_at IS NULL THEN 0 ELSE 1 END as is_deleted,
          s.name as style_name,
          c.name as customer_name,
          g.name as group_name,
          l.name as leather_name,
          col.name as color_name,
          wc.name as work_centre_name
        FROM production_plan pp
        LEFT JOIN styles s ON pp.style_id = s.id
        LEFT JOIN customers c ON pp.customer_id = c.id
        LEFT JOIN groups_master g ON pp.group_id = g.id
        LEFT JOIN leather l ON pp.leather_id = l.id
        LEFT JOIN colors col ON pp.color_id = col.id
        LEFT JOIN work_centres wc ON pp.work_centre_id = wc.id
        ${whereClause}
        ORDER BY pp.plan_date DESC
        LIMIT ? OFFSET ?
      `, [...params, limit, offset]);

      const [countResult] = await db.query(
        `SELECT COUNT(*) as total
         FROM production_plan pp
         LEFT JOIN styles s ON pp.style_id = s.id
         LEFT JOIN customers c ON pp.customer_id = c.id
         LEFT JOIN work_centres wc ON pp.work_centre_id = wc.id
         ${whereClause}`,
        params
      );
      const total = countResult[0].total;

      res.json({ 
        success: true, 
        data: rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      logger.error('Error getting production plans:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Get single production plan
  async getById(req, res) {
    try {
      const { id } = req.params;

      const [rows] = await db.execute(`
        SELECT 
          ${PLAN_LIST_SELECT},
          s.name as style_name,
          c.name as customer_name,
          g.name as group_name,
          l.name as leather_name,
          col.name as color_name,
          wc.name as work_centre_name
        FROM production_plan pp
        LEFT JOIN styles s ON pp.style_id = s.id
        LEFT JOIN customers c ON pp.customer_id = c.id
        LEFT JOIN groups_master g ON pp.group_id = g.id
        LEFT JOIN leather l ON pp.leather_id = l.id
        LEFT JOIN colors col ON pp.color_id = col.id
        LEFT JOIN work_centres wc ON pp.work_centre_id = wc.id
        WHERE pp.id = ? AND pp.deleted_at IS NULL
      `, [id]);

      if (rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Plan not found' });
      }

      res.json({ success: true, data: rows[0] });
    } catch (error) {
      logger.error('Error getting production plan by id:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Create production plan
  async create(req, res) {
    try {
      const result = await withTransaction(async (conn) => this.validateAndUpsertPlan(conn, req.body));

      res.status(201).json({ success: true, data: result });
    } catch (error) {
      logger.error('Error creating production plan:', error);
      res.status(error.status || 500).json({ success: false, error: error.message });
    }
  }

  // Update production plan
  async update(req, res) {
    try {
      const { id } = req.params;
      await withTransaction(async (conn) => this.validateAndUpsertPlan(conn, req.body, id));

      res.json({ success: true, data: { id } });
    } catch (error) {
      logger.error('Error updating production plan:', error);
      res.status(error.status || 500).json({ success: false, error: error.message });
    }
  }

  // Delete production plan
  async delete(req, res) {
    try {
      const { id } = req.params;

      await withTransaction(async (conn) => {
        const [rows] = await conn.execute(
          'SELECT id FROM production_plan WHERE id = ? AND deleted_at IS NULL LIMIT 1',
          [id]
        );
        if (rows.length === 0) {
          throw Object.assign(new Error('Plan not found'), { status: 404 });
        }
        await conn.execute('UPDATE production_plan SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL', [id]);
      });

      res.json({ success: true, message: 'Plan moved to deleted records' });
    } catch (error) {
      logger.error('Error deleting production plan:', error);
      res.status(error.status || 500).json({ success: false, error: error.message });
    }
  }

  async createBulk(req, res) {
    try {
      const lines = Array.isArray(req.body?.lines) ? req.body.lines : [];
      if (lines.length === 0) {
        return res.status(400).json({ success: false, error: 'At least one line is required' });
      }

      const duplicateKeys = new Set();
      for (const line of lines) {
        const key = `${line.plan_date}::${line.work_centre_id}`;
        if (duplicateKeys.has(key)) {
          return res.status(409).json({
            success: false,
            error: 'Duplicate work centre entries found in the same bulk request for the selected date.'
          });
        }
        duplicateKeys.add(key);
      }

      const result = await withTransaction(async (conn) => {
        const insertedIds = [];
        for (const line of lines) {
          const inserted = await this.validateAndUpsertPlan(conn, line);
          insertedIds.push(inserted.id);
        }
        return insertedIds;
      });

      res.status(201).json({ success: true, data: { count: result.length, ids: result } });
    } catch (error) {
      logger.error('Error creating production plans in bulk:', error);
      res.status(error.status || 500).json({ success: false, error: error.message });
    }
  }

  async getTodayBoard(req, res) {
    try {
      const data = await productionPlanningBoardService.getTodayBoard(req.query.date);
      res.json({ success: true, data });
    } catch (error) {
      logger.error('Error getting planning today board:', error);
      res.status(error.status || 500).json({ success: false, error: error.message });
    }
  }

  async getWeekGrid(req, res) {
    try {
      const anchor = req.query.date || req.query.week_start;
      const data = await productionPlanningBoardService.getWeekGrid(anchor);
      res.json({ success: true, data });
    } catch (error) {
      logger.error('Error getting planning week grid:', error);
      res.status(error.status || 500).json({ success: false, error: error.message });
    }
  }

  async getCopyPreview(req, res) {
    try {
      const data = await productionPlanningBoardService.getCopyPreview({
        targetDate: req.query.target_date,
        sourceDate: req.query.source_date,
        onlyGaps: String(req.query.only_gaps || '') === '1',
      });
      res.json({ success: true, data });
    } catch (error) {
      logger.error('Error building copy preview:', error);
      res.status(error.status || 500).json({ success: false, error: error.message });
    }
  }

  async applyCopy(req, res) {
    try {
      const data = await productionPlanningBoardService.applyCopyLines({
        targetDate: req.body.target_date,
        lines: req.body.lines || [],
        replaceConflicts: Boolean(req.body.replace_conflicts),
      });
      res.json({
        success: true,
        data,
        message: `Saved ${data.saved_count} plan(s).`,
      });
    } catch (error) {
      logger.error('Error applying copy plans:', error);
      res.status(error.status || 500).json({ success: false, error: error.message });
    }
  }

  async getScheduleSyncPreview(req, res) {
    try {
      const data = await productionPlanningBoardService.getScheduleSyncPreview(req.query.target_date);
      res.json({ success: true, data });
    } catch (error) {
      logger.error('Error building schedule sync preview:', error);
      res.status(error.status || 500).json({ success: false, error: error.message });
    }
  }

  async applyScheduleSync(req, res) {
    try {
      const data = await productionPlanningBoardService.applyScheduleSync({
        targetDate: req.body.target_date,
        workCentreIds: req.body.work_centre_ids,
        replaceConflicts: req.body.replace_conflicts !== false,
      });
      res.json({
        success: true,
        data,
        message: `Synced ${data.saved_count} plan(s) from line schedule.`,
      });
    } catch (error) {
      logger.error('Error applying schedule sync:', error);
      res.status(error.status || 500).json({ success: false, error: error.message });
    }
  }

  async restore(req, res) {
    try {
      const { id } = req.params;
      await withTransaction(async (conn) => {
        const [rows] = await conn.execute(
          'SELECT id, plan_date, work_centre_id, deleted_at FROM production_plan WHERE id = ?',
          [id]
        );
        if (rows.length === 0) {
          throw Object.assign(new Error('Plan not found'), { status: 404 });
        }
        const plan = rows[0];
        if (!plan.deleted_at) {
          throw Object.assign(new Error('Plan is already active'), { status: 400 });
        }

        const [dupCheck] = await conn.execute(
          'SELECT id FROM production_plan WHERE DATE(plan_date) = DATE(?) AND work_centre_id = ? AND id != ? AND deleted_at IS NULL LIMIT 1',
          [plan.plan_date, plan.work_centre_id, id]
        );
        if (dupCheck.length > 0) {
          throw Object.assign(
            new Error('Cannot restore because an active plan already exists for this date and work centre.'),
            { status: 409 }
          );
        }

        await conn.execute(
          'UPDATE production_plan SET deleted_at = NULL WHERE id = ?',
          [id]
        );
      });

      res.json({ success: true, message: 'Plan restored successfully' });
    } catch (error) {
      logger.error('Error restoring production plan:', error);
      res.status(error.status || 500).json({ success: false, error: error.message });
    }
  }
}

module.exports = new ProductionPlanningController();
