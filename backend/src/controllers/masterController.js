const db = require('../../config/database');
const logger = require('../utils/logger');
const { withTransaction } = require('../utils/transaction');
const { clearLineMachineCache } = require('../services/lineMachineResolver');

class MasterController {
  getArchiveEnabledTables() {
    return ['customers', 'groups_master', 'leather', 'styles', 'colors', 'work_centres', 'machine_centres', 'employees'];
  }

  getUsageCheckTables() {
    return ['groups_master', 'leather', 'styles', 'colors', 'work_centres', 'machine_centres', 'employees'];
  }

  logMasterAudit(action, req, details = {}) {
    logger.info('MASTER_AUDIT', {
      action,
      table: req.params.table,
      id: req.params.id || null,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      ...details,
    });
  }

  async getTableColumns(conn, table) {
    const [cols] = await conn.query(`SHOW COLUMNS FROM ${table}`);
    return new Set(cols.map((c) => c.Field));
  }

  async validateLineMachineAssignment(conn, workCentreId, inputMachineId, eolMachineId) {
    const inputId = inputMachineId ? String(inputMachineId).trim() : null;
    const eolId = eolMachineId ? String(eolMachineId).trim() : null;
    if (inputId && eolId && inputId === eolId) {
      throw Object.assign(new Error('Input machine and EOL machine must be different'), { status: 400 });
    }
    for (const machineId of [inputId, eolId]) {
      if (!machineId) continue;
      const [rows] = await conn.execute(
        `SELECT id FROM machine_centres
         WHERE work_centre_id = ? AND machine_id = ?
           AND deleted_at IS NULL AND COALESCE(is_active, 1) = 1
         LIMIT 1`,
        [workCentreId, machineId]
      );
      if (!rows.length) {
        throw Object.assign(
          new Error(`Machine ${machineId} is not registered on this work centre`),
          { status: 400 }
        );
      }
    }
  }

  getSoftArchiveClauses(columnSet) {
    const setClauses = [];
    if (columnSet.has('deleted_at')) setClauses.push('deleted_at = NOW()');
    if (columnSet.has('is_deleted')) setClauses.push('is_deleted = 1');
    if (columnSet.has('is_active')) setClauses.push('is_active = 0');
    if (columnSet.has('active')) setClauses.push('active = 0');
    return setClauses;
  }

  getActiveFilter(columnSet, alias = '') {
    const prefix = alias ? `${alias}.` : '';
    const filters = [];
    if (columnSet.has('deleted_at')) filters.push(`${prefix}deleted_at IS NULL`);
    if (columnSet.has('is_deleted')) filters.push(`COALESCE(${prefix}is_deleted, 0) = 0`);
    if (columnSet.has('is_active')) filters.push(`COALESCE(${prefix}is_active, 1) = 1`);
    if (columnSet.has('active')) filters.push(`COALESCE(${prefix}active, 1) = 1`);
    return filters.length > 0 ? filters.join(' AND ') : '';
  }

  async getGroupUsageSummary(conn, groupId) {
    const [[planUsage]] = await conn.execute(
      'SELECT COUNT(*) as total FROM production_plan WHERE group_id = ?',
      [groupId]
    );
    const [[routingUsage]] = await conn.execute(
      'SELECT COUNT(*) as total FROM production_routing_header WHERE group_id = ?',
      [groupId]
    );

    const details = [
      { table: 'production_plan', label: 'Production Plans', count: Number(planUsage?.total || 0) },
      { table: 'production_routing_header', label: 'Production Routings', count: Number(routingUsage?.total || 0) },
    ];
    const total = details.reduce((sum, row) => sum + row.count, 0);
    return { total, details };
  }

  async getMasterUsageSummary(conn, table, id) {
    if (table === 'groups_master') return this.getGroupUsageSummary(conn, id);

    if (table === 'work_centres') {
      const [[machineUsage]] = await conn.execute('SELECT COUNT(*) as total FROM machine_centres WHERE work_centre_id = ?', [id]);
      const [[employeeUsage]] = await conn.execute('SELECT COUNT(*) as total FROM employees WHERE work_centre_id = ?', [id]);
      const [[userUsage]] = await conn.execute('SELECT COUNT(*) as total FROM users WHERE work_centre_id = ?', [id]);
      const [[planUsage]] = await conn.execute('SELECT COUNT(*) as total FROM production_plan WHERE work_centre_id = ?', [id]);
      const [[activeSessionUsage]] = await conn.execute(
        "SELECT COUNT(*) as total FROM mobile_sessions WHERE work_centre_id = ? AND status = 'active'",
        [id]
      );
      const details = [
        { table: 'machine_centres', label: 'Machine Centres', count: Number(machineUsage?.total || 0) },
        { table: 'employees', label: 'Employees', count: Number(employeeUsage?.total || 0) },
        { table: 'users', label: 'Users', count: Number(userUsage?.total || 0) },
        { table: 'production_plan', label: 'Production Plans', count: Number(planUsage?.total || 0) },
        { table: 'mobile_sessions', label: 'Active Mobile Sessions', count: Number(activeSessionUsage?.total || 0) },
      ];
      return { total: details.reduce((sum, row) => sum + row.count, 0), details };
    }

    if (table === 'machine_centres') {
      const [[machineRow]] = await conn.execute(
        'SELECT id, machine_id FROM machine_centres WHERE id = ?',
        [id]
      );
      if (!machineRow) return { total: 0, details: [] };

      const machineId = machineRow.machine_id;
      const [[employeeUsage]] = await conn.execute(
        'SELECT COUNT(*) as total FROM employees WHERE machine_centre_id = ?',
        [id]
      );
      const [[activeSessionUsage]] = await conn.execute(
        "SELECT COUNT(*) as total FROM mobile_sessions WHERE machine_id = ? AND status = 'active'",
        [machineId]
      );
      const [[productionUsage]] = await conn.execute(
        'SELECT COUNT(*) as total FROM machine_centre_production WHERE machine_id = ?',
        [machineId]
      );
      const [[summaryUsage]] = await conn.execute(
        'SELECT COUNT(*) as total FROM machine_centre_summary WHERE machine_id = ?',
        [machineId]
      );
      const [[routingUsage]] = await conn.execute(
        'SELECT COUNT(*) as total FROM production_routing_lines WHERE machine_centre_id = ?',
        [machineId]
      );

      const details = [
        { table: 'employees', label: 'Employees', count: Number(employeeUsage?.total || 0) },
        { table: 'mobile_sessions', label: 'Active Mobile Sessions', count: Number(activeSessionUsage?.total || 0) },
        { table: 'machine_centre_production', label: 'Production Records', count: Number(productionUsage?.total || 0) },
        { table: 'machine_centre_summary', label: 'Summary Records', count: Number(summaryUsage?.total || 0) },
        { table: 'production_routing_lines', label: 'Routing Links', count: Number(routingUsage?.total || 0) },
      ];
      return { total: details.reduce((sum, row) => sum + row.count, 0), details };
    }

    if (table === 'employees') {
      const [[empRow]] = await conn.execute(
        'SELECT id, code FROM employees WHERE id = ?',
        [id]
      );
      if (!empRow) return { total: 0, details: [] };

      const employeeId = empRow.id;
      const employeeCode = empRow.code;
      const [[activeSessionUsage]] = await conn.execute(
        "SELECT COUNT(*) as total FROM mobile_sessions WHERE (emp_id = ? OR emp_code = ?) AND status = 'active'",
        [employeeId, employeeCode]
      );
      const [[productionUsage]] = await conn.execute(
        'SELECT COUNT(*) as total FROM machine_centre_production WHERE emp_id = ?',
        [employeeCode]
      );
      const [[summaryUsage]] = await conn.execute(
        'SELECT COUNT(*) as total FROM machine_centre_summary WHERE emp_id = ?',
        [employeeCode]
      );
      const details = [
        { table: 'mobile_sessions', label: 'Active Mobile Sessions', count: Number(activeSessionUsage?.total || 0) },
        { table: 'machine_centre_production', label: 'Production Records', count: Number(productionUsage?.total || 0) },
        { table: 'machine_centre_summary', label: 'Summary Records', count: Number(summaryUsage?.total || 0) },
      ];
      return { total: details.reduce((sum, row) => sum + row.count, 0), details };
    }

    if (table === 'styles') {
      const [[planUsage]] = await conn.execute('SELECT COUNT(*) as total FROM production_plan WHERE style_id = ?', [id]);
      const [[routingUsage]] = await conn.execute('SELECT COUNT(*) as total FROM production_routing_header WHERE style_id = ?', [id]);
      const details = [
        { table: 'production_plan', label: 'Production Plans', count: Number(planUsage?.total || 0) },
        { table: 'production_routing_header', label: 'Production Routings', count: Number(routingUsage?.total || 0) },
      ];
      return { total: details.reduce((sum, row) => sum + row.count, 0), details };
    }

    if (table === 'colors') {
      const [[planUsage]] = await conn.execute('SELECT COUNT(*) as total FROM production_plan WHERE color_id = ?', [id]);
      const [[routingUsage]] = await conn.execute('SELECT COUNT(*) as total FROM production_routing_header WHERE color_id = ?', [id]);
      const details = [
        { table: 'production_plan', label: 'Production Plans', count: Number(planUsage?.total || 0) },
        { table: 'production_routing_header', label: 'Production Routings', count: Number(routingUsage?.total || 0) },
      ];
      return { total: details.reduce((sum, row) => sum + row.count, 0), details };
    }

    if (table === 'leather') {
      const [[planUsage]] = await conn.execute('SELECT COUNT(*) as total FROM production_plan WHERE leather_id = ?', [id]);
      const [[routingUsage]] = await conn.execute('SELECT COUNT(*) as total FROM production_routing_header WHERE leather_id = ?', [id]);
      const details = [
        { table: 'production_plan', label: 'Production Plans', count: Number(planUsage?.total || 0) },
        { table: 'production_routing_header', label: 'Production Routings', count: Number(routingUsage?.total || 0) },
      ];
      return { total: details.reduce((sum, row) => sum + row.count, 0), details };
    }

    return { total: 0, details: [] };
  }

  // Generic CRUD operations for all master tables
  async getAll(req, res) {
    try {
      const { table } = req.params;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;
      const search = String(req.query.search || '').trim();
      const includeArchived = String(req.query.includeArchived || 'false') === 'true';
      const styleId = parseInt(req.query.styleId, 10);
      const workCentreId = parseInt(req.query.work_centre_id, 10);
      
      let rows, countResult;

      if (table === 'machine_centres') {
        const params = [];
        const whereParts = [];
        if (!Number.isNaN(workCentreId) && workCentreId > 0) {
          whereParts.push('mc.work_centre_id = ?');
          params.push(workCentreId);
        }
        if (search) {
          whereParts.push(`(
            mc.machine_id LIKE ?
            OR mc.code LIKE ?
            OR mc.name LIKE ?
            OR mc.machine_name LIKE ?
            OR wc.name LIKE ?
          )`);
          params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
        }
        if (!Number.isNaN(styleId) && styleId > 0) {
          whereParts.push(`EXISTS (
            SELECT 1
            FROM production_routing_lines prl
            INNER JOIN production_routing_header prh ON prh.id = prl.routing_header_id
            WHERE prl.machine_centre_id = mc.machine_id
              AND prh.style_id = ?
              AND prh.deleted_at IS NULL
          )`);
          params.push(styleId);
        }
        if (!includeArchived) {
          const colSet = await this.getTableColumns(db, table);
          const activeFilter = this.getActiveFilter(colSet, 'mc');
          if (activeFilter) whereParts.push(activeFilter);
        }
        const where = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';
        [rows] = await db.query(
          `SELECT mc.*, wc.name as work_centre_name
           FROM machine_centres mc
           LEFT JOIN work_centres wc ON mc.work_centre_id = wc.id
           ${where}
           ORDER BY mc.machine_id
           LIMIT ? OFFSET ?`,
          [...params, limit, offset]
        );
        [countResult] = await db.query(
          `SELECT COUNT(*) as total
           FROM machine_centres mc
           LEFT JOIN work_centres wc ON mc.work_centre_id = wc.id
           ${where}`,
          params
        );
      } else if (table === 'users') {
        const whereParts = [];
        const params = [];
        if (search) {
          whereParts.push(`(
              u.code LIKE ?
              OR u.name LIKE ?
              OR u.role LIKE ?
              OR wc.name LIKE ?
              OR u.machine_id LIKE ?
            )`);
          params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
        }
        const roleFilter = String(req.query.role || '').trim();
        if (roleFilter) {
          whereParts.push('u.role = ?');
          params.push(roleFilter);
        }
        const styleFilter = parseInt(req.query.style_id, 10);
        let styleJoin = '';
        if (!Number.isNaN(styleFilter) && styleFilter > 0) {
          // Filter users whose work_centre currently has this style assigned
          styleJoin = `INNER JOIN line_style_assignments lsa ON lsa.work_centre_id = u.work_centre_id
            AND lsa.deleted_at IS NULL
            AND lsa.id = (
              SELECT lsa2.id FROM line_style_assignments lsa2
              WHERE lsa2.work_centre_id = u.work_centre_id AND lsa2.assignment_date <= CURDATE() AND lsa2.deleted_at IS NULL
              ORDER BY lsa2.assignment_date DESC, lsa2.id DESC LIMIT 1
            )`;
          whereParts.push('lsa.style_id = ?');
          params.push(styleFilter);
        }
        const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
        [rows] = await db.query(
          `SELECT u.id, u.code, u.name, u.role, u.password, u.work_centre_id, u.machine_id, wc.code as work_centre_code, wc.name as work_centre_name 
           FROM users u 
           LEFT JOIN work_centres wc ON u.work_centre_id = wc.id
           ${styleJoin}
           ${where}
           ORDER BY u.code LIMIT ? OFFSET ?`,
          [...params, limit, offset]
        );
        [countResult] = await db.query(
          `SELECT COUNT(*) as total
           FROM users u
           LEFT JOIN work_centres wc ON u.work_centre_id = wc.id
           ${styleJoin}
           ${where}`,
          params
        );
      } else if (table === 'employees') {
        const params = [];
        const whereParts = [];
        if (search) {
          whereParts.push(`(
            e.code LIKE ?
            OR e.name LIKE ?
            OR wc.name LIKE ?
            OR mc.name LIKE ?
          )`);
          params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
        }
        if (!includeArchived) {
          const colSet = await this.getTableColumns(db, table);
          const activeFilter = this.getActiveFilter(colSet, 'e');
          if (activeFilter) whereParts.push(activeFilter);
        }
        const where = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';
        [rows] = await db.query(
          `SELECT e.*, wc.name as work_centre_name, mc.name as machine_centre_name 
           FROM employees e 
           LEFT JOIN work_centres wc ON e.work_centre_id = wc.id 
           LEFT JOIN machine_centres mc ON e.machine_centre_id = mc.id 
           ${where}
           ORDER BY e.code LIMIT ? OFFSET ?`,
          [...params, limit, offset]
        );
        [countResult] = await db.query(
          `SELECT COUNT(*) as total
           FROM employees e
           LEFT JOIN work_centres wc ON e.work_centre_id = wc.id
           LEFT JOIN machine_centres mc ON e.machine_centre_id = mc.id
           ${where}`,
          params
        );
      } else if (table === 'work_centres') {
        const params = [];
        const whereParts = [];
        if (search) {
          whereParts.push('(wc.code LIKE ? OR wc.name LIKE ?)');
          params.push(`%${search}%`, `%${search}%`);
        }
        if (!includeArchived) {
          const colSet = await this.getTableColumns(db, table);
          const activeFilter = this.getActiveFilter(colSet, 'wc');
          if (activeFilter) whereParts.push(activeFilter);
        }
        const where = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';
        [rows] = await db.query(
          `SELECT wc.*,
                  mc_in.name AS input_machine_label,
                  mc_eol.name AS eol_machine_label
           FROM work_centres wc
           LEFT JOIN machine_centres mc_in
             ON mc_in.work_centre_id = wc.id AND mc_in.machine_id = wc.input_machine_id
           LEFT JOIN machine_centres mc_eol
             ON mc_eol.work_centre_id = wc.id AND mc_eol.machine_id = wc.eol_machine_id
           ${where}
           ORDER BY wc.code
           LIMIT ? OFFSET ?`,
          [...params, limit, offset]
        );
        [countResult] = await db.query(
          `SELECT COUNT(*) as total FROM work_centres wc ${where}`,
          params
        );
      } else {
        const params = [];
        const whereParts = [];
        if (search) {
          whereParts.push('(code LIKE ? OR name LIKE ?)');
          params.push(`%${search}%`, `%${search}%`);
        }
        if (this.getArchiveEnabledTables().includes(table) && !includeArchived) {
          const colSet = await this.getTableColumns(db, table);
          const activeFilter = this.getActiveFilter(colSet);
          if (activeFilter) whereParts.push(activeFilter);
        }
        const where = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';
        [rows] = await db.query(
          `SELECT * FROM ${table} ${where} ORDER BY code LIMIT ? OFFSET ?`,
          [...params, limit, offset]
        );
        [countResult] = await db.query(
          `SELECT COUNT(*) as total FROM ${table} ${where}`,
          params
        );
      }

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
      logger.error(`Error getting ${req.params.table}:`, error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getUsage(req, res) {
    try {
      const { table, id } = req.params;
      if (!this.getUsageCheckTables().includes(table)) {
        return res.json({ success: true, data: { total: 0, details: [] } });
      }
      const usage = await this.getMasterUsageSummary(db, table, id);
      return res.json({ success: true, data: usage });
    } catch (error) {
      logger.error(`Error getting usage for ${req.params.table}:`, error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async restore(req, res) {
    try {
      const { table, id } = req.params;
      if (!this.getArchiveEnabledTables().includes(table)) {
        return res.status(400).json({ success: false, error: 'Restore not supported for this table' });
      }
      const columnSet = await this.getTableColumns(db, table);
      const resetClauses = [];
      if (columnSet.has('deleted_at')) resetClauses.push('deleted_at = NULL');
      if (columnSet.has('is_deleted')) resetClauses.push('is_deleted = 0');
      if (columnSet.has('is_active')) resetClauses.push('is_active = 1');
      if (columnSet.has('active')) resetClauses.push('active = 1');
      if (resetClauses.length === 0) {
        return res.status(400).json({ success: false, error: 'Table does not support restore' });
      }

      const [result] = await db.execute(`UPDATE ${table} SET ${resetClauses.join(', ')} WHERE id = ?`, [id]);
      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, error: 'Record not found' });
      }
      this.logMasterAudit('restore', req, { recordId: id });
      return res.json({ success: true, message: 'Record restored successfully' });
    } catch (error) {
      logger.error(`Error restoring ${req.params.table}:`, error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async getById(req, res) {
    try {
      const { table, id } = req.params;
      let query;

      if (table === 'machine_centres') {
        query = `SELECT * FROM machine_centres WHERE id = ?`;
      } else if (table === 'users') {
        query = `SELECT u.id, u.code, u.name, u.role, u.work_centre_id, u.machine_id, wc.name as work_centre_name 
                 FROM users u 
                 LEFT JOIN work_centres wc ON u.work_centre_id = wc.id 
                 WHERE u.id = ?`;
      } else if (table === 'employees') {
        query = `SELECT e.*, wc.name as work_centre_name, mc.name as machine_centre_name 
                 FROM employees e 
                 LEFT JOIN work_centres wc ON e.work_centre_id = wc.id 
                 LEFT JOIN machine_centres mc ON e.machine_centre_id = mc.id 
                 WHERE e.id = ?`;
      } else {
        query = `SELECT * FROM ${table} WHERE id = ?`;
      }

      const [rows] = await db.execute(query, [id]);
      if (rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Record not found' });
      }
      res.json({ success: true, data: rows[0] });
    } catch (error) {
      logger.error(`Error getting ${req.params.table} by id:`, error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getByCode(req, res) {
    try {
      const { table, code } = req.params;
      let query;
      let params = [code];

      if (table === 'machine_centres') {
        query = `SELECT * FROM machine_centres WHERE code = ? OR machine_id = ?`;
        params = [code, code];
      } else if (table === 'users') {
        query = `SELECT u.id, u.code, u.name, u.role, u.work_centre_id, u.machine_id, wc.name as work_centre_name 
                 FROM users u 
                 LEFT JOIN work_centres wc ON u.work_centre_id = wc.id 
                 WHERE u.code = ?`;
      } else if (table === 'employees') {
        query = `SELECT e.*, wc.name as work_centre_name, mc.name as machine_centre_name 
                 FROM employees e 
                 LEFT JOIN work_centres wc ON e.work_centre_id = wc.id 
                 LEFT JOIN machine_centres mc ON e.machine_centre_id = mc.id 
                 WHERE e.code = ?`;
      } else {
        query = `SELECT * FROM ${table} WHERE code = ?`;
      }

      const [rows] = await db.execute(query, params);
      if (rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Record not found' });
      }
      res.json({ success: true, data: rows[0] });
    } catch (error) {
      logger.error(`Error getting ${req.params.table} by code:`, error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async create(req, res) {
    try {
      const { table } = req.params;
      const data = req.body;

      const result = await withTransaction(async (conn) => {
        if (table === 'users') {
          const { code, name, password, role, work_centre_id, machine_id } = data;
          if (!code || !name || !password) throw Object.assign(new Error('Code, name and password are required'), { status: 400 });
          // Integrity: validate work_centre_id if provided
          if (work_centre_id) {
            const [wc] = await conn.execute('SELECT id FROM work_centres WHERE id = ?', [work_centre_id]);
            if (wc.length === 0) throw Object.assign(new Error('Work centre not found'), { status: 400 });
          }
          const [r] = await conn.execute(
            `INSERT INTO users (code, name, password, role, work_centre_id, machine_id) VALUES (?, ?, ?, ?, ?, ?)`,
            [code, name, password, role || 'user', work_centre_id || null, machine_id || null]
          );
          return { id: r.insertId };
        }

        if (table === 'employees') {
          const { code, name, work_centre_id, machine_centre_id } = data;
          if (!code || !name) throw Object.assign(new Error('Code and name are required'), { status: 400 });
          const wcId = work_centre_id ? parseInt(work_centre_id, 10) : null;
          if (wcId) {
            const [wc] = await conn.execute('SELECT id FROM work_centres WHERE id = ?', [wcId]);
            if (wc.length === 0) throw Object.assign(new Error('Work centre not found'), { status: 400 });
          }
          if (machine_centre_id) {
            const [mc] = await conn.execute('SELECT id FROM machine_centres WHERE id = ?', [machine_centre_id]);
            if (mc.length === 0) throw Object.assign(new Error('Machine centre not found'), { status: 400 });
          }
          const [r] = await conn.execute(
            `INSERT INTO employees (code, name, work_centre_id, machine_centre_id) VALUES (?, ?, ?, ?)`,
            [code, name, wcId, machine_centre_id || null]
          );
          return { id: r.insertId };
        }

        const { code, name, machine_id, machine_name, work_centre_id, input_machine_id, eol_machine_id } = data;
        if (!code || !name) throw Object.assign(new Error('Code and name are required'), { status: 400 });

        if (table === 'work_centres') {
          const inputId = input_machine_id ? String(input_machine_id).trim() : null;
          const eolId = eol_machine_id ? String(eol_machine_id).trim() : null;
          const [r] = await conn.execute(
            `INSERT INTO work_centres (code, name, input_machine_id, eol_machine_id)
             VALUES (?, ?, ?, ?)`,
            [code, name, inputId, eolId]
          );
          if (inputId || eolId) {
            await this.validateLineMachineAssignment(conn, r.insertId, inputId, eolId);
          }
          clearLineMachineCache(Number(r.insertId));
          return { id: r.insertId, code, name, input_machine_id: inputId, eol_machine_id: eolId };
        }

        let r;
        if (table === 'machine_centres' && machine_id) {
          if (work_centre_id) {
            const [wc] = await conn.execute('SELECT id FROM work_centres WHERE id = ?', [work_centre_id]);
            if (wc.length === 0) throw Object.assign(new Error('Work centre not found'), { status: 400 });
          }
          [r] = await conn.execute(
            `INSERT INTO ${table} (code, name, machine_id, machine_name, work_centre_id) VALUES (?, ?, ?, ?, ?)`,
            [code, name, machine_id, machine_name || null, work_centre_id || null]
          );
        } else {
          [r] = await conn.execute(`INSERT INTO ${table} (code, name) VALUES (?, ?)`, [code, name]);
        }
        return { id: r.insertId, code, name, machine_id };
      });

      this.logMasterAudit('create', req, {
        recordId: result.id,
        code: data.code || null,
        name: data.name || null,
      });

      res.status(201).json({ success: true, data: result });
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') return res.status(400).json({ success: false, error: 'Code already exists' });
      logger.error(`Error creating ${req.params.table}:`, error);
      res.status(error.status || 500).json({ success: false, error: error.message });
    }
  }

  async update(req, res) {
    try {
      const { table, id } = req.params;
      const data = req.body;

      await withTransaction(async (conn) => {
        // Verify record exists
        const [existing] = await conn.execute(`SELECT id FROM ${table} WHERE id = ?`, [id]);
        if (existing.length === 0) throw Object.assign(new Error('Record not found'), { status: 404 });

        if (table === 'users') {
          const { code, name, password, role, work_centre_id, machine_id } = data;
          if (!code || !name) throw Object.assign(new Error('Code and name are required'), { status: 400 });
          if (work_centre_id) {
            const [wc] = await conn.execute('SELECT id FROM work_centres WHERE id = ?', [work_centre_id]);
            if (wc.length === 0) throw Object.assign(new Error('Work centre not found'), { status: 400 });
          }
          let query = `UPDATE users SET code = ?, name = ?, role = ?, work_centre_id = ?, machine_id = ?`;
          let params = [code, name, role || 'user', work_centre_id || null, machine_id || null];
          if (password) {
            query += `, password = ?`;
            params.push(password);
          }
          query += ` WHERE id = ?`;
          params.push(id);
          await conn.execute(query, params);
          return;
        }

        if (table === 'employees') {
          const { code, name, work_centre_id, machine_centre_id } = data;
          if (!code || !name) throw Object.assign(new Error('Code and name are required'), { status: 400 });
          const wcId = work_centre_id ? parseInt(work_centre_id, 10) : null;
          if (wcId) {
            const [wc] = await conn.execute('SELECT id FROM work_centres WHERE id = ?', [wcId]);
            if (wc.length === 0) throw Object.assign(new Error('Work centre not found'), { status: 400 });
          }
          if (machine_centre_id) {
            const [mc] = await conn.execute('SELECT id FROM machine_centres WHERE id = ?', [machine_centre_id]);
            if (mc.length === 0) throw Object.assign(new Error('Machine centre not found'), { status: 400 });
          }
          await conn.execute(
            `UPDATE employees SET code = ?, name = ?, work_centre_id = ?, machine_centre_id = ? WHERE id = ?`,
            [code, name, wcId, machine_centre_id || null, id]
          );
          return;
        }

        if (table === 'forms_master') {
          const { name } = data;
          if (!name) throw Object.assign(new Error('Name is required'), { status: 400 });
          await conn.execute(`UPDATE forms_master SET name = ? WHERE id = ?`, [name, id]);
          return;
        }

        const { code, name, machine_id, machine_name, work_centre_id, input_machine_id, eol_machine_id } = data;
        if (!code || !name) throw Object.assign(new Error('Code and name are required'), { status: 400 });

        if (table === 'work_centres') {
          const inputId = input_machine_id ? String(input_machine_id).trim() : null;
          const eolId = eol_machine_id ? String(eol_machine_id).trim() : null;
          await this.validateLineMachineAssignment(conn, Number(id), inputId, eolId);
          await conn.execute(
            `UPDATE work_centres SET code = ?, name = ?, input_machine_id = ?, eol_machine_id = ? WHERE id = ?`,
            [code, name, inputId, eolId, id]
          );
          return;
        }

        if (table === 'machine_centres' && machine_id) {
          if (work_centre_id) {
            const [wc] = await conn.execute('SELECT id FROM work_centres WHERE id = ?', [work_centre_id]);
            if (wc.length === 0) throw Object.assign(new Error('Work centre not found'), { status: 400 });
          }
          const [[existing_mc]] = await conn.execute('SELECT machine_id FROM machine_centres WHERE id = ?', [id]);
          const oldMachineId = existing_mc?.machine_id;
          if (oldMachineId && oldMachineId !== machine_id) {
            await conn.execute('SET FOREIGN_KEY_CHECKS = 0');
            await conn.execute('UPDATE machine_centres SET machine_id = ? WHERE id = ?', [machine_id, id]);
            await conn.execute('UPDATE production_routing_lines SET machine_centre_id = ? WHERE machine_centre_id = ?', [machine_id, oldMachineId]);
            await conn.execute('UPDATE mobile_sessions SET machine_id = ? WHERE machine_id = ?', [machine_id, oldMachineId]);
            await conn.execute('UPDATE machine_centre_production SET machine_id = ? WHERE machine_id = ?', [machine_id, oldMachineId]);
            await conn.execute('UPDATE machine_centre_summary SET machine_id = ? WHERE machine_id = ?', [machine_id, oldMachineId]);
            await conn.execute('SET FOREIGN_KEY_CHECKS = 1');
            await conn.execute(
              `UPDATE ${table} SET code = ?, name = ?, machine_name = ?, work_centre_id = ? WHERE id = ?`,
              [code, name, machine_name || null, work_centre_id || null, id]
            );
          } else {
            await conn.execute(
              `UPDATE ${table} SET code = ?, name = ?, machine_id = ?, machine_name = ?, work_centre_id = ? WHERE id = ?`,
              [code, name, machine_id, machine_name || null, work_centre_id || null, id]
            );
          }
        } else {
          await conn.execute(`UPDATE ${table} SET code = ?, name = ? WHERE id = ?`, [code, name, id]);
        }
      });

      if (table === 'work_centres') clearLineMachineCache(Number(id));

      this.logMasterAudit('update', req, {
        recordId: id,
        code: data.code || null,
        name: data.name || null,
      });

      res.json({ success: true, data: { id } });
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') return res.status(400).json({ success: false, error: 'Code already exists' });
      logger.error(`Error updating ${req.params.table}:`, error);
      res.status(error.status || 500).json({ success: false, error: error.message });
    }
  }

  async getByEmpId(req, res) {
    try {
      const { empId } = req.params;
      const query = `SELECT e.*, wc.name as work_centre_name, mc.name as machine_centre_name 
                     FROM employees e 
                     LEFT JOIN work_centres wc ON e.work_centre_id = wc.id 
                     LEFT JOIN machine_centres mc ON e.machine_centre_id = mc.id 
                     WHERE e.code = ?
                       AND (e.deleted_at IS NULL)
                       AND (COALESCE(e.is_active, 1) = 1)`;
      const [rows] = await db.execute(query, [empId]);
      if (rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Employee not found' });
      }
      res.json({ success: true, data: rows[0] });
    } catch (error) {
      logger.error('Error getting employee by emp_id:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Public quick-register: called from mobile line setup when a scanned employee code is unknown.
  // Creates the employee with the scanned code, provided name, and the first available work centre.
  async quickRegisterEmployee(req, res) {
    try {
      const { code, name, work_centre_id } = req.body;
      if (!code || !name) {
        return res.status(400).json({ success: false, error: 'code and name are required' });
      }

      // Resolve work_centre_id: use provided value if valid, otherwise fall back to first available
      let wcId = parseInt(work_centre_id) || null;
      if (!wcId) {
        const [[firstWc]] = await db.execute('SELECT id FROM work_centres ORDER BY id LIMIT 1');
        if (!firstWc) return res.status(400).json({ success: false, error: 'No work centres configured' });
        wcId = firstWc.id;
      } else {
        const [[wc]] = await db.execute('SELECT id FROM work_centres WHERE id = ?', [wcId]);
        if (!wc) return res.status(400).json({ success: false, error: 'Work centre not found' });
      }

      const [r] = await db.execute(
        'INSERT INTO employees (code, name, work_centre_id) VALUES (?, ?, ?)',
        [code, name.trim(), wcId]
      );

      logger.info(`QUICK_REGISTER employee code=${code} name=${name} work_centre_id=${wcId} id=${r.insertId}`);
      res.status(201).json({ success: true, data: { id: r.insertId, code, name: name.trim(), work_centre_id: wcId } });
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ success: false, error: 'Employee code already exists' });
      }
      logger.error('Error in quickRegisterEmployee:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getByMachineId(req, res) {
    try {
      const { machineId } = req.params;
      const query = `SELECT * FROM machine_centres WHERE machine_id = ?`;
      const [rows] = await db.execute(query, [machineId]);
      if (rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Machine not found' });
      }
      res.json({ success: true, data: rows[0] });
    } catch (error) {
      logger.error('Error getting machine by machine_id:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async delete(req, res) {
    try {
      const { table, id } = req.params;
      let result;

      // Block archive/delete when record is still referenced.
      if (this.getUsageCheckTables().includes(table)) {
        const usage = await this.getMasterUsageSummary(db, table, id);
        if (usage.total > 0) {
          return res.status(400).json({
            success: false,
            error: 'Cannot archive/delete this record because it is used in other records.',
            data: usage,
          });
        }
      }

      // Business-critical masters: prefer archive over hard delete if table supports it.
      if (this.getArchiveEnabledTables().includes(table)) {
        const columnSet = await this.getTableColumns(db, table);
        const setClauses = this.getSoftArchiveClauses(columnSet);
        if (setClauses.length > 0) {
          [result] = await db.execute(`UPDATE ${table} SET ${setClauses.join(', ')} WHERE id = ?`, [id]);
          if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, error: 'Record not found' });
          }
          this.logMasterAudit('archive', req, { recordId: id, mode: 'soft' });
          return res.json({ success: true, message: 'Record archived successfully' });
        }
      }

      [result] = await db.execute(`DELETE FROM ${table} WHERE id = ?`, [id]);

      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, error: 'Record not found' });
      }

      this.logMasterAudit('delete', req, { recordId: id, mode: 'hard' });
      res.json({ success: true, message: 'Record deleted successfully' });
    } catch (error) {
      if (error.code === 'ER_ROW_IS_REFERENCED_2' || error.code === 'ER_ROW_IS_REFERENCED') {
        return res.status(400).json({
          success: false,
          error: 'Cannot delete this record because it is being used by other records (e.g., Machines or Users).'
        });
      }
      logger.error(`Error deleting ${req.params.table}:`, error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = new MasterController();