const db = require('../../config/database');
const logger = require('../utils/logger');

// Shared pagination helper — wraps any query with COUNT + LIMIT/OFFSET
const paginate = (page, limit) => {
  const p = Math.max(1, parseInt(page) || 1);
  const l = Math.min(500, Math.max(1, parseInt(limit) || 50));
  return { page: p, limit: l, offset: (p - 1) * l };
};

class ApiController {

  async getHourlyProductionStatus(req, res) {
    try {
      const { fromDate, toDate, workCentreId, machineId, search, page, limit } = req.query;
      if (!fromDate || !toDate) return res.status(400).json({ success: false, error: 'fromDate and toDate are required' });

      const { page: p, limit: l, offset } = paginate(page, limit);
      let where = 'WHERE DATE(mcp.prod_date) BETWEEN ? AND ?';
      const params = [fromDate, toDate];
      if (workCentreId) { where += ' AND mcp.work_centre_id = ?'; params.push(workCentreId); }
      if (machineId) { where += ' AND mcp.machine_id = ?'; params.push(machineId); }
      if (search) { where += ' AND (wc.name LIKE ? OR c.name LIKE ? OR s.name LIKE ? OR col.name LIKE ?)'; const s = `%${search}%`; params.push(s,s,s,s); }

      const baseQuery = `
        FROM machine_centre_production mcp
        LEFT JOIN work_centres wc ON mcp.work_centre_id = wc.id
        LEFT JOIN production_plan pp ON mcp.work_centre_id = pp.work_centre_id AND DATE(mcp.prod_date) = pp.plan_date
        LEFT JOIN customers c ON pp.customer_id = c.id
        LEFT JOIN styles s ON pp.style_id = s.id
        LEFT JOIN colors col ON pp.color_id = col.id
        LEFT JOIN leather l ON pp.leather_id = l.id
        LEFT JOIN groups_master g ON pp.group_id = g.id
        ${where}
        GROUP BY DATE(mcp.prod_date), mcp.work_centre_id, pp.total_target_per_day, c.name, s.name, col.name, l.name, g.name`;

      const [[{ total }]] = await db.query(`SELECT COUNT(*) as total FROM (SELECT 1 ${baseQuery}) t`, params);
      const [data] = await db.query(`
        SELECT DATE(mcp.prod_date) as date, wc.name as line, c.name as customer, s.name as article_no,
          col.name as color, l.name as leather, g.name as \`group\`,
          pp.total_target_per_day as total_planned_qty, SUM(mcp.output_pairs) as total_output,
          ROUND(AVG(mcp.output_pairs),1) as avg_hourly_output,
          SUM(CASE WHEN HOUR(mcp.start_time)=9 THEN mcp.output_pairs ELSE 0 END) as \`9_10\`,
          SUM(CASE WHEN HOUR(mcp.start_time)=10 THEN mcp.output_pairs ELSE 0 END) as \`10_11\`,
          SUM(CASE WHEN HOUR(mcp.start_time)=11 THEN mcp.output_pairs ELSE 0 END) as \`11_12\`,
          SUM(CASE WHEN HOUR(mcp.start_time)=12 THEN mcp.output_pairs ELSE 0 END) as \`12_1\`,
          SUM(CASE WHEN HOUR(mcp.start_time)=14 THEN mcp.output_pairs ELSE 0 END) as \`2_3\`,
          SUM(CASE WHEN HOUR(mcp.start_time)=15 THEN mcp.output_pairs ELSE 0 END) as \`3_4\`,
          SUM(CASE WHEN HOUR(mcp.start_time)=16 THEN mcp.output_pairs ELSE 0 END) as \`4_5\`,
          SUM(CASE WHEN HOUR(mcp.start_time)=17 THEN mcp.output_pairs ELSE 0 END) as \`5_6\`
        ${baseQuery} ORDER BY date, wc.name LIMIT ? OFFSET ?`, [...params, l, offset]);

      res.json({ success: true, data, pagination: { total, page: p, limit: l, totalPages: Math.ceil(total / l) } });
    } catch (error) {
      logger.error('Error getting hourly production status:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  async getLineProcessEfficiency(req, res) {
    try {
      const { fromDate, toDate, workCentreId, search, page, limit } = req.query;
      if (!fromDate || !toDate) return res.status(400).json({ success: false, error: 'fromDate and toDate are required' });

      const { page: p, limit: l, offset } = paginate(page, limit);
      logger.info(`Line efficiency search: "${search}", workCentreId: ${workCentreId}, params: ${JSON.stringify(req.query)}`);
      let where = 'WHERE DATE(mcs.prod_date) BETWEEN ? AND ?';
      const params = [fromDate, toDate];
      if (workCentreId) { where += ' AND mcs.work_centre_id = ?'; params.push(workCentreId); }
      if (search) { where += ' AND (wc.name LIKE ? OR mc.name LIKE ? OR mc.machine_name LIKE ? OR c.name LIKE ?)'; const s = `%${search}%`; params.push(s,s,s,s); }

      const baseQuery = `
        FROM machine_centre_summary mcs
        LEFT JOIN work_centres wc ON mcs.work_centre_id = wc.id
        LEFT JOIN machine_centres mc ON mcs.machine_id = mc.machine_id
        LEFT JOIN production_plan pp ON mcs.work_centre_id = pp.work_centre_id AND DATE(mcs.prod_date) = pp.plan_date
        LEFT JOIN customers c ON pp.customer_id = c.id
        LEFT JOIN styles s ON pp.style_id = s.id
        LEFT JOIN colors col ON pp.color_id = col.id
        LEFT JOIN leather l ON pp.leather_id = l.id
        LEFT JOIN groups_master g ON pp.group_id = g.id
        ${where}`;

      const [[{ total }]] = await db.query(`SELECT COUNT(*) as total ${baseQuery}`, params);
      const [data] = await db.query(`
        SELECT DATE(mcs.prod_date) as date, wc.name as line, mc.name as process,
          c.name as customer, s.name as article_no, col.name as color, l.name as leather, g.name as \`group\`,
          pp.total_target_per_day as total_planned_qty, mcs.total_output_pairs as total_output,
          ROUND((mcs.total_output_pairs/NULLIF(pp.total_target_per_day,0))*100,2) as output_percent,
          mcs.total_target_mins as total_standard_mins_value, mcs.total_actual_mins as total_produced_mins_value,
          ROUND(pp.total_target_per_day*(mcs.total_target_mins/(8*60)),0) as targeted_output_smv,
          mcs.avg_efficiency_percent as efficiency_percent
        ${baseQuery} ORDER BY date, wc.name, mc.name LIMIT ? OFFSET ?`, [...params, l, offset]);

      res.json({ success: true, data, pagination: { total, page: p, limit: l, totalPages: Math.ceil(total / l) } });
    } catch (error) {
      logger.error('Error getting line process efficiency:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  async getAttendanceReport(req, res) {
    try {
      const { fromDate, toDate, workCentreId, search, page, limit } = req.query;
      if (!fromDate || !toDate) return res.status(400).json({ success: false, error: 'fromDate and toDate are required' });

      const { page: p, limit: l, offset } = paginate(page, limit);
      let wcFilter = '';
      const params = [fromDate, fromDate, toDate];
      if (workCentreId) { wcFilter = 'AND e.work_centre_id = ?'; params.push(workCentreId); }
      if (search) { wcFilter += ' AND (e.name LIKE ? OR e.code LIKE ? OR wc.name LIKE ?)'; const s = `%${search}%`; params.push(s,s,s); }

      const baseQuery = `
        FROM employees e
        JOIN work_centres wc ON e.work_centre_id = wc.id
        CROSS JOIN (
          SELECT DATE_ADD(?, INTERVAL seq DAY) as d
          FROM (SELECT 0 seq UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4
                UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9
                UNION SELECT 10 UNION SELECT 11 UNION SELECT 12 UNION SELECT 13 UNION SELECT 14
                UNION SELECT 15 UNION SELECT 16 UNION SELECT 17 UNION SELECT 18 UNION SELECT 19
                UNION SELECT 20 UNION SELECT 21 UNION SELECT 22 UNION SELECT 23 UNION SELECT 24
                UNION SELECT 25 UNION SELECT 26 UNION SELECT 27 UNION SELECT 28 UNION SELECT 29
                UNION SELECT 30) nums
          WHERE DATE_ADD(?, INTERVAL seq DAY) <= ?
        ) dates
        LEFT JOIN mobile_sessions ms ON ms.emp_id = e.id AND DATE(ms.activated_at) = dates.d AND ms.status = 'active'
        WHERE e.work_centre_id IS NOT NULL ${wcFilter}`;

      const [[{ total }]] = await db.query(`SELECT COUNT(*) as total FROM (SELECT 1 ${baseQuery}) t`, params);
      const [data] = await db.query(`
        SELECT wc.name as line, e.name as emp_name, e.code as emp_code, dates.d as date,
          CASE WHEN ms.emp_id IS NOT NULL THEN 'Present' ELSE 'Absent' END as status,
          ms.activated_at as login_time
        ${baseQuery} ORDER BY dates.d, wc.name, e.name LIMIT ? OFFSET ?`, [...params, l, offset]);

      res.json({ success: true, data, pagination: { total, page: p, limit: l, totalPages: Math.ceil(total / l) } });
    } catch (error) {
      logger.error('Error getting attendance report:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  async getReworkRejectionReport(req, res) {
    try {
      const { fromDate, toDate, workCentreId, search, page, limit } = req.query;
      if (!fromDate || !toDate) return res.status(400).json({ success: false, error: 'fromDate and toDate are required' });

      const { page: p, limit: l, offset } = paginate(page, limit);
      let where = 'WHERE DATE(rr.production_date) BETWEEN ? AND ?';
      const params = [fromDate, toDate];
      if (workCentreId) { where += ' AND rr.work_centre_id = ?'; params.push(workCentreId); }
      if (search) { where += ' AND (wc.name LIKE ? OR rr.machine_centre_name LIKE ? OR rr.reason LIKE ?)'; const s = `%${search}%`; params.push(s,s,s); }

      const baseQuery = `FROM rework_rejection rr LEFT JOIN work_centres wc ON rr.work_centre_id = wc.id ${where}`;
      const [[{ total }]] = await db.query(`SELECT COUNT(*) as total ${baseQuery}`, params);
      const [data] = await db.query(`
        SELECT DATE(rr.production_date) as date, wc.name as line, rr.machine_centre_name as machine,
          rr.total_output_pairs as output, rr.bins_completed, rr.rework_qty, rr.rejection_qty,
          ROUND((rr.rework_qty/NULLIF(rr.total_output_pairs,0))*100,2) as rework_percent,
          ROUND((rr.rejection_qty/NULLIF(rr.total_output_pairs,0))*100,2) as rejection_percent,
          rr.reason_category, rr.reason
        ${baseQuery} ORDER BY date, wc.name, rr.machine_centre_name LIMIT ? OFFSET ?`, [...params, l, offset]);

      res.json({ success: true, data, pagination: { total, page: p, limit: l, totalPages: Math.ceil(total / l) } });
    } catch (error) {
      logger.error('Error getting rework rejection report:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  async getMachineOutputReport(req, res) {
    try {
      const { fromDate, toDate, workCentreId, search, page, limit } = req.query;
      if (!fromDate || !toDate) return res.status(400).json({ success: false, error: 'fromDate and toDate are required' });

      const { page: p, limit: l, offset } = paginate(page, limit);
      let where = 'WHERE DATE(mcs.prod_date) BETWEEN ? AND ?';
      const params = [fromDate, toDate];
      if (workCentreId) { where += ' AND mcs.work_centre_id = ?'; params.push(workCentreId); }
      if (search) { where += ' AND (wc.name LIKE ? OR mc.machine_id LIKE ? OR mc.machine_name LIKE ? OR mc.name LIKE ?)'; const s = `%${search}%`; params.push(s,s,s,s); }

      const baseQuery = `
        FROM machine_centre_summary mcs
        LEFT JOIN work_centres wc ON mcs.work_centre_id = wc.id
        LEFT JOIN machine_centres mc ON mcs.machine_id = mc.machine_id
        ${where}`;

      const [[{ total }]] = await db.query(`SELECT COUNT(*) as total ${baseQuery}`, params);
      const [data] = await db.query(`
        SELECT DATE(mcs.prod_date) as date, wc.name as line, mc.machine_id,
          COALESCE(mc.machine_name, mc.name) as machine_name,
          mcs.total_output_pairs as output, mcs.total_target_mins as target_mins,
          mcs.total_actual_mins as actual_mins, mcs.total_idle_mins as idle_mins,
          ROUND(mcs.avg_efficiency_percent,1) as efficiency_percent
        ${baseQuery} ORDER BY date, wc.name, mc.machine_id LIMIT ? OFFSET ?`, [...params, l, offset]);

      res.json({ success: true, data, pagination: { total, page: p, limit: l, totalPages: Math.ceil(total / l) } });
    } catch (error) {
      logger.error('Error getting machine output report:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  async getEmployeeOutputReport(req, res) {
    try {
      const { fromDate, toDate, workCentreId, search, page, limit } = req.query;
      if (!fromDate || !toDate) return res.status(400).json({ success: false, error: 'fromDate and toDate are required' });

      const { page: p, limit: l, offset } = paginate(page, limit);
      let where = 'WHERE DATE(ms.activated_at) BETWEEN ? AND ?';
      const params = [fromDate, toDate];
      if (workCentreId) { where += ' AND ms.work_centre_id = ?'; params.push(workCentreId); }
      if (search) { where += ' AND (e.name LIKE ? OR e.code LIKE ? OR wc.name LIKE ? OR mc.machine_name LIKE ?)'; const s = `%${search}%`; params.push(s,s,s,s); }

      const baseQuery = `
        FROM mobile_sessions ms
        JOIN employees e ON ms.emp_id = e.id
        JOIN work_centres wc ON ms.work_centre_id = wc.id
        LEFT JOIN machine_centres mc ON ms.machine_id = mc.machine_id
        LEFT JOIN machine_centre_production mcp ON mcp.machine_id = ms.machine_id
          AND mcp.work_centre_id = ms.work_centre_id
          AND DATE(mcp.prod_date) = DATE(ms.activated_at)
        ${where}
        GROUP BY DATE(mcp.prod_date), ms.work_centre_id, ms.emp_id, ms.machine_id`;

      const [[{ total }]] = await db.query(`SELECT COUNT(*) as total FROM (SELECT 1 ${baseQuery}) t`, params);
      const [data] = await db.query(`
        SELECT DATE(mcp.prod_date) as date, wc.name as line, e.code as emp_code, e.name as emp_name,
          ms.machine_id, COALESCE(mc.machine_name, mc.name) as machine_name,
          SUM(mcp.output_pairs) as total_output
        ${baseQuery} ORDER BY date, wc.name, e.name LIMIT ? OFFSET ?`, [...params, l, offset]);

      res.json({ success: true, data, pagination: { total, page: p, limit: l, totalPages: Math.ceil(total / l) } });
    } catch (error) {
      logger.error('Error getting employee output report:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  async getEmployeePerformanceReport(req, res) {
    try {
      const { fromDate, toDate, workCentreId, search, page, limit } = req.query;
      if (!fromDate || !toDate) return res.status(400).json({ success: false, error: 'fromDate and toDate are required' });

      const { page: p, limit: l, offset } = paginate(page, limit);
      let where = 'WHERE DATE(mcs.prod_date) BETWEEN ? AND ?';
      const params = [fromDate, toDate];
      if (workCentreId) { where += ' AND mcs.work_centre_id = ?'; params.push(workCentreId); }
      if (search) { where += ' AND (e.name LIKE ? OR e.code LIKE ? OR wc.name LIKE ? OR mc.machine_name LIKE ?)'; const s = `%${search}%`; params.push(s,s,s,s); }

      const baseQuery = `
        FROM machine_centre_summary mcs
        JOIN employees e ON mcs.emp_id = e.code
        JOIN work_centres wc ON mcs.work_centre_id = wc.id
        LEFT JOIN machine_centres mc ON mcs.machine_id = mc.machine_id
        LEFT JOIN production_plan pp ON mcs.work_centre_id = pp.work_centre_id AND DATE(mcs.prod_date) = DATE(pp.plan_date)
        ${where}`;

      const [[{ total }]] = await db.query(`SELECT COUNT(*) as total ${baseQuery}`, params);
      const [data] = await db.query(`
        SELECT DATE(mcs.prod_date) as date, wc.name as line, e.code as emp_code, e.name as emp_name,
          mcs.machine_id, COALESCE(mc.machine_name, mc.name) as machine_name,
          mcs.total_output_pairs as output, pp.total_target_per_day as target,
          ROUND((mcs.total_output_pairs/NULLIF(pp.total_target_per_day,0))*100,1) as output_percent,
          mcs.total_target_mins as target_mins, mcs.total_actual_mins as actual_mins,
          mcs.total_idle_mins as idle_mins, ROUND(mcs.avg_efficiency_percent,1) as efficiency_percent,
          CASE WHEN mcs.avg_efficiency_percent>=90 THEN 'Excellent'
               WHEN mcs.avg_efficiency_percent>=75 THEN 'Good'
               WHEN mcs.avg_efficiency_percent>=60 THEN 'Average'
               ELSE 'Below Target' END as performance_grade
        ${baseQuery} ORDER BY date, wc.name, e.name LIMIT ? OFFSET ?`, [...params, l, offset]);

      res.json({ success: true, data, pagination: { total, page: p, limit: l, totalPages: Math.ceil(total / l) } });
    } catch (error) {
      logger.error('Error getting employee performance report:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
}

module.exports = new ApiController();
