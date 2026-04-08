const db = require('../../config/database');
const logger = require('../utils/logger');

class ApiController {
  async getHourlyProductionStatus(req, res) {
    try {
      const { fromDate, toDate } = req.query;
      
      if (!fromDate || !toDate) {
        return res.status(400).json({
          success: false,
          error: 'fromDate and toDate are required'
        });
      }

      const [data] = await db.query(`
        SELECT 
          DATE(mcp.prod_date) as date,
          wc.name as line,
          c.name as customer,
          s.name as article_no,
          col.name as color,
          l.name as leather,
          g.name as \`group\`,
          pp.total_target_per_day as total_planned_qty,
          SUM(mcp.output_pairs) as total_output,
          ROUND(AVG(mcp.output_pairs), 1) as avg_hourly_output,
          SUM(CASE WHEN HOUR(mcp.start_time) = 9 THEN mcp.output_pairs ELSE 0 END) as \`9_10\`,
          SUM(CASE WHEN HOUR(mcp.start_time) = 10 THEN mcp.output_pairs ELSE 0 END) as \`10_11\`,
          SUM(CASE WHEN HOUR(mcp.start_time) = 11 THEN mcp.output_pairs ELSE 0 END) as \`11_12\`,
          SUM(CASE WHEN HOUR(mcp.start_time) = 12 THEN mcp.output_pairs ELSE 0 END) as \`12_1\`,
          SUM(CASE WHEN HOUR(mcp.start_time) = 14 THEN mcp.output_pairs ELSE 0 END) as \`2_3\`,
          SUM(CASE WHEN HOUR(mcp.start_time) = 15 THEN mcp.output_pairs ELSE 0 END) as \`3_4\`,
          SUM(CASE WHEN HOUR(mcp.start_time) = 16 THEN mcp.output_pairs ELSE 0 END) as \`4_5\`,
          SUM(CASE WHEN HOUR(mcp.start_time) = 17 THEN mcp.output_pairs ELSE 0 END) as \`5_6\`
        FROM machine_centre_production mcp
        LEFT JOIN work_centres wc ON mcp.work_centre_id = wc.id
        LEFT JOIN production_plan pp ON mcp.work_centre_id = pp.work_centre_id AND DATE(mcp.prod_date) = pp.plan_date
        LEFT JOIN customers c ON pp.customer_id = c.id
        LEFT JOIN styles s ON pp.style_id = s.id
        LEFT JOIN colors col ON pp.color_id = col.id
        LEFT JOIN leather l ON pp.leather_id = l.id
        LEFT JOIN groups_master g ON pp.group_id = g.id
        WHERE DATE(mcp.prod_date) BETWEEN ? AND ?
        GROUP BY DATE(mcp.prod_date), mcp.work_centre_id, pp.total_target_per_day, c.name, s.name, col.name, l.name, g.name
        ORDER BY date, wc.name
      `, [fromDate, toDate]);

      res.json({
        success: true,
        fromDate,
        toDate,
        data
      });
    } catch (error) {
      logger.error('Error getting hourly production status:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async getLineProcessEfficiency(req, res) {
    try {
      const { fromDate, toDate } = req.query;
      
      if (!fromDate || !toDate) {
        return res.status(400).json({
          success: false,
          error: 'fromDate and toDate are required'
        });
      }

      const [data] = await db.query(`
        SELECT 
          DATE(mcs.prod_date) as date,
          wc.name as line,
          mc.name as process,
          c.name as customer,
          s.name as article_no,
          col.name as color,
          l.name as leather,
          g.name as \`group\`,
          pp.total_target_per_day as total_planned_qty,
          mcs.total_output_pairs as total_output,
          ROUND((mcs.total_output_pairs / pp.total_target_per_day) * 100, 2) as output_percent,
          mcs.total_target_mins as total_standard_mins_value,
          mcs.total_actual_mins as total_produced_mins_value,
          mcs.total_idle_mins as total_idle_mins,
          70.0 as threshold_limit_percent,
          ROUND((mcs.total_idle_mins / (mcs.total_actual_mins + mcs.total_idle_mins)) * 100, 2) as idle_mins_percent,
          ROUND(pp.total_target_per_day * (mcs.total_target_mins / (8 * 60)), 0) as targeted_output_smv,
          mcs.total_output_pairs as achieved_output,
          mcs.avg_efficiency_percent as efficiency_percent
        FROM machine_centre_summary mcs
        LEFT JOIN work_centres wc ON mcs.work_centre_id = wc.id
        LEFT JOIN machine_centres mc ON mcs.machine_id = mc.machine_id
        LEFT JOIN production_plan pp ON mcs.work_centre_id = pp.work_centre_id AND DATE(mcs.prod_date) = pp.plan_date
        LEFT JOIN customers c ON pp.customer_id = c.id
        LEFT JOIN styles s ON pp.style_id = s.id
        LEFT JOIN colors col ON pp.color_id = col.id
        LEFT JOIN leather l ON pp.leather_id = l.id
        LEFT JOIN groups_master g ON pp.group_id = g.id
        WHERE DATE(mcs.prod_date) BETWEEN ? AND ?
        ORDER BY date, wc.name, mc.name
      `, [fromDate, toDate]);

      res.json({
        success: true,
        fromDate,
        toDate,
        data
      });
    } catch (error) {
      logger.error('Error getting line process efficiency:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
}

module.exports = new ApiController();