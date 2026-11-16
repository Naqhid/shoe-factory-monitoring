const db = require('../../config/database');
const logger = require('../utils/logger');
const { withTransaction, assertExists } = require('../utils/transaction');
const productionPlanningBoardService = require('../services/productionPlanningBoardService');

const MAX_ARTICLES_PER_LINE = 20;

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

  /**
   * Upserts the line/day plan (header) row. Any extra per-article rows of the plan are cleared,
   * so callers such as changeover, copy and schedule sync keep their single-article behaviour.
   * Pass { keepArticles: true } when the caller writes the article rows itself.
   */
  async validateAndUpsertPlan(conn, payload, existingId = null, opts = {}) {
    const result = await this.validateAndUpsertPlanRow(conn, payload, existingId);
    if (!opts.keepArticles) {
      // Single-article save: drop extra article rows (blocked if any already has production).
      await this.replacePlanArticles(conn, result.id, [payload]);
    }
    return result;
  }

  /** Throws if the group of article lines is not valid (limits, duplicates, targets, routing). */
  async validateArticleGroup(conn, rawLines) {
    if (rawLines.length > MAX_ARTICLES_PER_LINE) {
      throw Object.assign(
        new Error(`A line can have at most ${MAX_ARTICLES_PER_LINE} articles per day`),
        { status: 400 }
      );
    }
    const seen = new Set();
    for (const raw of rawLines) {
      const line = this.normalizePlanPayload(raw);
      const target = Number(line.total_target_per_day);
      if (!Number.isInteger(target) || target < 1 || target > 999999) {
        throw Object.assign(
          new Error('Target per article must be a whole number from 1 to 999,999'),
          { status: 400 }
        );
      }
      const styleKey = String(line.style_id);
      if (seen.has(styleKey)) {
        const [rows] = await conn.execute('SELECT code, name FROM styles WHERE id = ? LIMIT 1', [line.style_id]);
        const label = rows[0] ? `${rows[0].name} (${rows[0].code})` : `style ${line.style_id}`;
        throw Object.assign(
          new Error(`Article ${label} is already planned on this line for the same day`),
          { status: 409 }
        );
      }
      seen.add(styleKey);
    }
    if (rawLines.length > 1) {
      for (const raw of rawLines) {
        const line = this.normalizePlanPayload(raw);
        await assertExists(conn, 'styles', line.style_id, 'Style');
        const [routingRows] = await conn.execute(
          'SELECT id FROM production_routing_header WHERE style_id = ? AND deleted_at IS NULL LIMIT 1',
          [line.style_id]
        );
        if (routingRows.length === 0) {
          const [styleRows] = await conn.execute('SELECT code FROM styles WHERE id = ? LIMIT 1', [line.style_id]);
          throw Object.assign(
            new Error(`No production routing found for article ${styleRows[0]?.code || line.style_id}. Please create a routing first.`),
            { status: 422 }
          );
        }
      }
    }
  }

  /**
   * Stores one row per article for a multi-article line/day and sets the header total target
   * to the sum of the article targets. A single-article group stores no article rows.
   */
  async replacePlanArticles(conn, planId, rawLines) {
    const wanted = rawLines.length > 1 ? rawLines.map((raw) => this.normalizePlanPayload(raw)) : [];
    const wantedStyles = new Set(wanted.map((l) => Number(l.style_id)));

    const [existing] = await conn.execute(
      'SELECT id, style_id FROM production_plan_articles WHERE plan_id = ?',
      [planId]
    );
    // Articles that are being removed must not have recorded production (keeps cycle attribution intact).
    for (const row of existing) {
      if (wantedStyles.has(Number(row.style_id))) continue;
      const [[used]] = await conn.execute(
        'SELECT COUNT(*) AS c FROM machine_centre_production WHERE plan_article_id = ?',
        [row.id]
      );
      if (Number(used.c) > 0) {
        const [styleRows] = await conn.execute('SELECT name FROM styles WHERE id = ? LIMIT 1', [row.style_id]);
        throw Object.assign(
          new Error(`Cannot remove article ${styleRows[0]?.name || row.style_id}: production has been recorded for it`),
          { status: 409 }
        );
      }
      await conn.execute('DELETE FROM article_machine_assignments WHERE plan_article_id = ?', [row.id]);
      await conn.execute('DELETE FROM production_plan_articles WHERE id = ?', [row.id]);
    }
    if (wanted.length === 0) return;

    const byStyle = new Map(existing.map((r) => [Number(r.style_id), r.id]));
    let sequence = 1;
    let total = 0;
    for (const l of wanted) {
      total += Number(l.total_target_per_day);
      const params = [
        sequence, l.customer_id, l.group_id, l.leather_id, l.color_id,
        l.total_target_per_day, l.target_pairs_per_tray, l.tray_count || 0,
        l.man_hours_minutes, l.smv_per_pair,
      ];
      const existingId = byStyle.get(Number(l.style_id));
      if (existingId) {
        await conn.execute(
          `UPDATE production_plan_articles
           SET sequence_no = ?, customer_id = ?, group_id = ?, leather_id = ?, color_id = ?,
               total_target_per_day = ?, target_pairs_per_tray = ?, tray_count = ?,
               man_hours_minutes = ?, smv_per_pair = ?
           WHERE id = ?`,
          [...params, existingId]
        );
      } else {
        await conn.execute(
          `INSERT INTO production_plan_articles
             (sequence_no, customer_id, group_id, leather_id, color_id,
              total_target_per_day, target_pairs_per_tray, tray_count, man_hours_minutes, smv_per_pair,
              plan_id, style_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [...params, planId, l.style_id]
        );
      }
      sequence += 1;
    }
    await conn.execute('UPDATE production_plan SET total_target_per_day = ? WHERE id = ?', [total, planId]);
  }

  /** Adds the `articles` array (empty for single-article plans) to plan rows. */
  async attachArticles(rows) {
    if (!rows.length) return rows;
    const ids = rows.map((r) => r.id);
    const [articles] = await db.query(
      `SELECT a.id, a.plan_id, a.sequence_no, a.style_id, a.customer_id, a.group_id, a.leather_id, a.color_id,
              a.total_target_per_day, a.target_pairs_per_tray, a.tray_count, a.man_hours_minutes, a.smv_per_pair,
              s.name AS style_name, s.code AS style_code, c.name AS customer_name,
              g.name AS group_name, l.name AS leather_name, col.name AS color_name
       FROM production_plan_articles a
       LEFT JOIN styles s ON a.style_id = s.id
       LEFT JOIN customers c ON a.customer_id = c.id
       LEFT JOIN groups_master g ON a.group_id = g.id
       LEFT JOIN leather l ON a.leather_id = l.id
       LEFT JOIN colors col ON a.color_id = col.id
       WHERE a.plan_id IN (?)
       ORDER BY a.plan_id, a.sequence_no`,
      [ids]
    );
    const byPlan = new Map();
    for (const a of articles) {
      if (!byPlan.has(a.plan_id)) byPlan.set(a.plan_id, []);
      byPlan.get(a.plan_id).push(a);
    }
    return rows.map((r) => ({ ...r, articles: byPlan.get(r.id) || [] }));
  }

  async validateAndUpsertPlanRow(conn, payload, existingId = null) {
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

      const data = await this.attachArticles(rows);

      res.json({ 
        success: true, 
        data,
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

      const [plan] = await this.attachArticles([rows[0]]);
      res.json({ success: true, data: plan });
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

  // Update a plan together with all its articles (multi-article line/day)
  async updateArticles(req, res) {
    try {
      const { id } = req.params;
      const planDate = req.body?.plan_date;
      const lines = Array.isArray(req.body?.lines) ? req.body.lines : [];
      if (lines.length === 0) {
        return res.status(400).json({ success: false, error: 'At least one article is required' });
      }
      const withDate = lines.map((line) => ({ ...line, plan_date: planDate || line.plan_date }));
      const wcIds = new Set(withDate.map((l) => String(l.work_centre_id)));
      if (wcIds.size > 1) {
        return res.status(400).json({ success: false, error: 'All articles of a plan must be on the same line' });
      }

      await withTransaction(async (conn) => {
        await this.validateArticleGroup(conn, withDate);
        await this.validateAndUpsertPlan(conn, withDate[0], id, { keepArticles: true });
        await this.replacePlanArticles(conn, id, withDate);
      });

      res.json({ success: true, data: { id, articles: lines.length } });
    } catch (error) {
      logger.error('Error updating production plan articles:', error);
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

      // Several lines for the same work centre and date are the articles of one multi-article plan.
      const groups = new Map();
      for (const line of lines) {
        const key = `${String(line.plan_date).split('T')[0]}::${line.work_centre_id}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(line);
      }

      const result = await withTransaction(async (conn) => {
        const insertedIds = [];
        for (const group of groups.values()) {
          await this.validateArticleGroup(conn, group);
          const inserted = await this.validateAndUpsertPlan(conn, group[0], null, { keepArticles: true });
          await this.replacePlanArticles(conn, inserted.id, group);
          insertedIds.push(inserted.id);
        }
        return insertedIds;
      });

      res.status(201).json({ success: true, data: { count: lines.length, plans: result.length, ids: result } });
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
