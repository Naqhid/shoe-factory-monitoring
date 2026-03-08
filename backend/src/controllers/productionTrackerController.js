const db = require('../../config/database');
const logger = require('../utils/logger');

class ProductionTrackerController {
  // Dashboard Summary
  async getSummary(req, res) {
    try {
      const { date, workCentreId } = req.query;
      
      if (!date) {
        return res.status(400).json({ success: false, error: 'Date is required' });
      }

      const whereClause = workCentreId && workCentreId !== 'all' 
        ? 'AND mcs.work_centre_id = ?' 
        : '';
      const params = workCentreId && workCentreId !== 'all' ? [date, workCentreId] : [date];

      // Get output summary from machine_centre_summary
      const [outputData] = await db.execute(`
        SELECT 
          COALESCE(SUM(mcs.total_output_pairs), 0) as actual_pairs,
          COALESCE(SUM(pp.total_target_per_day), 0) as target_pairs,
          COALESCE(COUNT(DISTINCT ms.emp_id), 0) as present_employees,
          COALESCE(SUM(prl.manpower), 0) as target_employees
        FROM machine_centre_summary mcs
        LEFT JOIN production_plan pp ON mcs.work_centre_id = pp.work_centre_id AND DATE(pp.plan_date) = DATE(?)
        LEFT JOIN mobile_sessions ms ON mcs.work_centre_id = ms.work_centre_id AND DATE(ms.activated_at) = DATE(?) AND ms.status = 'active'
        LEFT JOIN production_routing_header prh ON pp.style_id = prh.style_id
        LEFT JOIN production_routing_lines prl ON prh.id = prl.routing_header_id
        WHERE DATE(mcs.prod_date) = DATE(?) ${whereClause}
      `, workCentreId && workCentreId !== 'all' ? [date, date, date, workCentreId] : [date, date, date]);

      const summary = outputData[0];
      const efficiency = summary.target_pairs > 0 
        ? Math.round((summary.actual_pairs / summary.target_pairs) * 100) 
        : 0;

      // Get yesterday's efficiency
      const yesterday = new Date(date);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      const [yesterdayData] = await db.execute(`
        SELECT 
          COALESCE(SUM(mcs.total_output_pairs), 0) as actual_pairs,
          COALESCE(SUM(pp.total_target_per_day), 0) as target_pairs
        FROM machine_centre_summary mcs
        LEFT JOIN production_plan pp ON mcs.work_centre_id = pp.work_centre_id AND DATE(pp.plan_date) = DATE(?)
        WHERE DATE(mcs.prod_date) = DATE(?) ${whereClause}
      `, workCentreId && workCentreId !== 'all' ? [yesterdayStr, yesterdayStr, workCentreId] : [yesterdayStr, yesterdayStr]);

      const yesterdayEfficiency = yesterdayData[0].target_pairs > 0
        ? Math.round((yesterdayData[0].actual_pairs / yesterdayData[0].target_pairs) * 100)
        : 0;

      // Get last week average
      const lastWeek = new Date(date);
      lastWeek.setDate(lastWeek.getDate() - 7);
      const lastWeekStr = lastWeek.toISOString().split('T')[0];
      const [weekData] = await db.execute(`
        SELECT 
          COALESCE(AVG(daily_eff), 0) as avg_efficiency
        FROM (
          SELECT 
            (SUM(mcs.total_output_pairs) / NULLIF(SUM(pp.total_target_per_day), 0)) * 100 as daily_eff
          FROM machine_centre_summary mcs
          LEFT JOIN production_plan pp ON mcs.work_centre_id = pp.work_centre_id AND DATE(pp.plan_date) = DATE(mcs.prod_date)
          WHERE DATE(mcs.prod_date) BETWEEN DATE(?) AND DATE(?) ${whereClause}
          GROUP BY DATE(mcs.prod_date)
        ) as daily_stats
      `, workCentreId && workCentreId !== 'all' ? [lastWeekStr, date, workCentreId] : [lastWeekStr, date]);

      const weekEfficiency = Math.round(weekData[0].avg_efficiency || 0);

      // Determine status
      let status = 'low';
      if (efficiency >= 90 && summary.actual_pairs >= summary.target_pairs * 0.9) {
        status = 'on-track';
      } else if (efficiency >= 70 && summary.actual_pairs >= summary.target_pairs * 0.7) {
        status = 'moderate';
      }

      res.json({
        success: true,
        data: {
          actual_pairs: summary.actual_pairs,
          target_pairs: summary.target_pairs,
          efficiency,
          present_employees: summary.present_employees,
          target_employees: summary.target_employees,
          status,
          yesterday_efficiency: yesterdayEfficiency,
          week_efficiency: weekEfficiency
        }
      });
    } catch (error) {
      logger.error('Error getting dashboard summary:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Hourly Performance
  async getHourlyPerformance(req, res) {
    try {
      const { date, workCentreId } = req.query;
      
      if (!date) {
        return res.status(400).json({ success: false, error: 'Date is required' });
      }

      const whereClause = workCentreId && workCentreId !== 'all' 
        ? 'AND pd.work_centre_id = ?' 
        : '';
      const params = workCentreId && workCentreId !== 'all' ? [date, workCentreId] : [date];

      const [hourlyData] = await db.execute(`
        SELECT 
          HOUR(pd.created_at) as hour,
          SUM(pd.output_pairs) as pairs
        FROM prod_data pd
        WHERE DATE(pd.prod_date) = DATE(?) ${whereClause}
        GROUP BY HOUR(pd.created_at)
        ORDER BY hour
      `, params);

      res.json({
        success: true,
        data: hourlyData
      });
    } catch (error) {
      logger.error('Error getting hourly performance:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Workstation Performance (Lowest 3) with WIP
  async getWorkstationPerformance(req, res) {
    try {
      const { date, workCentreId } = req.query;
      
      if (!date) {
        return res.status(400).json({ success: false, error: 'Date is required' });
      }

      const whereClause = workCentreId && workCentreId !== 'all' 
        ? 'AND mcs.work_centre_id = ?' 
        : '';
      const params = workCentreId && workCentreId !== 'all' ? [date, workCentreId] : [date];

      const [workstations] = await db.execute(`
        SELECT 
          mc.code as station_code,
          mc.name as station_name,
          mcs.total_output_pairs as actual_pairs,
          pp.total_target_per_day as target_pairs,
          ROUND(mcs.avg_efficiency_percent) as efficiency,
          GREATEST(0, COALESCE(pp.total_target_per_day, 0) - COALESCE(mcs.total_output_pairs, 0)) as wip
        FROM machine_centre_summary mcs
        JOIN machine_centres mc ON mcs.machine_id = mc.machine_id
        LEFT JOIN production_plan pp ON mcs.work_centre_id = pp.work_centre_id AND DATE(pp.plan_date) = DATE(?)
        WHERE DATE(mcs.prod_date) = DATE(?) ${whereClause}
        AND mcs.avg_efficiency_percent < 70
        ORDER BY mcs.avg_efficiency_percent ASC
        LIMIT 3
      `, workCentreId && workCentreId !== 'all' ? [date, date, workCentreId] : [date, date]);

      res.json({
        success: true,
        data: workstations
      });
    } catch (error) {
      logger.error('Error getting workstation performance:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Top Stoppage Reasons
  async getStoppageReasons(req, res) {
    try {
      const { date, workCentreId } = req.query;
      
      if (!date) {
        return res.status(400).json({ success: false, error: 'Date is required' });
      }

      const whereClause = workCentreId && workCentreId !== 'all' 
        ? 'AND pd.work_centre_id = ?' 
        : '';
      const params = workCentreId && workCentreId !== 'all' ? [date, workCentreId] : [date];

      const [stoppages] = await db.execute(`
        SELECT 
          pd.stoppage_reason,
          SUM(pd.idle_stop_time) as total_minutes,
          ROUND((SUM(pd.idle_stop_time) / NULLIF(SUM(SUM(pd.idle_stop_time)) OVER(), 0)) * 100) as percentage
        FROM prod_data pd
        WHERE DATE(pd.prod_date) = DATE(?) 
          AND pd.stoppage_reason IS NOT NULL 
          AND pd.idle_stop_time > 0 
          ${whereClause}
        GROUP BY pd.stoppage_reason
        ORDER BY total_minutes DESC
        LIMIT 3
      `, params);

      res.json({
        success: true,
        data: stoppages
      });
    } catch (error) {
      logger.error('Error getting stoppage reasons:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Add Line Performance method
  async getLinePerformance(req, res) {
    try {
      const { date } = req.query;
      
      if (!date) {
        return res.status(400).json({ success: false, error: 'Date is required' });
      }

      const [linePerformance] = await db.execute(`
        SELECT 
          wc.name as line_name,
          COALESCE(SUM(pp.total_target_per_day), 0) as target,
          COALESCE(SUM(mcs.total_output_pairs), 0) as output,
          CASE 
            WHEN SUM(pp.total_target_per_day) > 0 THEN 
              ROUND((SUM(mcs.total_output_pairs) / SUM(pp.total_target_per_day)) * 100, 0)
            ELSE 0 
          END as output_percentage,
          ROUND(AVG(mcs.avg_efficiency_percent), 0) as efficiency,
          GREATEST(0, COALESCE(SUM(pp.total_target_per_day), 0) - COALESCE(SUM(mcs.total_output_pairs), 0)) as wip
        FROM work_centres wc
        LEFT JOIN production_plan pp ON wc.id = pp.work_centre_id AND DATE(pp.plan_date) = DATE(?)
        LEFT JOIN machine_centre_summary mcs ON wc.id = mcs.work_centre_id AND DATE(mcs.prod_date) = DATE(?)
        GROUP BY wc.id, wc.name
        ORDER BY wc.id
      `, [date, date]);

      res.json({
        success: true,
        data: linePerformance
      });
    } catch (error) {
      logger.error('Error getting line performance:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = new ProductionTrackerController();
