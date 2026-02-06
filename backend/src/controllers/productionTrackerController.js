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
        ? 'AND pd.work_centre_id = ?' 
        : '';
      const params = workCentreId && workCentreId !== 'all' ? [date, workCentreId] : [date];

      // Get output summary
      const [outputData] = await db.execute(`
        SELECT 
          COALESCE(SUM(pd.output_pairs), 0) as actual_pairs,
          COALESCE(SUM(pd.target_pairs), 0) as target_pairs,
          COALESCE(COUNT(DISTINCT pd.emp_id), 0) as present_employees,
          10 as target_employees
        FROM prod_data pd
        WHERE pd.prod_date = ? ${whereClause}
      `, params);

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
          COALESCE(SUM(pd.output_pairs), 0) as actual_pairs,
          COALESCE(SUM(pd.target_pairs), 0) as target_pairs
        FROM prod_data pd
        WHERE pd.prod_date = ? ${whereClause}
      `, workCentreId && workCentreId !== 'all' ? [yesterdayStr, workCentreId] : [yesterdayStr]);

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
            (SUM(pd.output_pairs) / NULLIF(SUM(pd.target_pairs), 0)) * 100 as daily_eff
          FROM prod_data pd
          WHERE pd.prod_date BETWEEN ? AND ? ${whereClause}
          GROUP BY pd.prod_date
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
        WHERE pd.prod_date = ? ${whereClause}
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

  // Workstation Performance (Lowest 3)
  async getWorkstationPerformance(req, res) {
    try {
      const { date, workCentreId } = req.query;
      
      if (!date) {
        return res.status(400).json({ success: false, error: 'Date is required' });
      }

      const whereClause = workCentreId && workCentreId !== 'all' 
        ? 'AND pd.work_centre_id = ?' 
        : '';
      const params = workCentreId && workCentreId !== 'all' ? [date, workCentreId] : [date];

      const [workstations] = await db.execute(`
        SELECT 
          mc.code as station_code,
          mc.name as station_name,
          SUM(pd.output_pairs) as actual_pairs,
          SUM(pd.target_pairs) as target_pairs,
          ROUND((SUM(pd.output_pairs) / NULLIF(SUM(pd.target_pairs), 0)) * 100) as efficiency
        FROM prod_data pd
        JOIN machine_centres mc ON pd.machine_id = mc.machine_id
        WHERE pd.prod_date = ? ${whereClause}
        GROUP BY mc.id, mc.code, mc.name
        HAVING target_pairs > 0
        ORDER BY efficiency ASC
        LIMIT 3
      `, params);

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
        WHERE pd.prod_date = ? 
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
}

module.exports = new ProductionTrackerController();
