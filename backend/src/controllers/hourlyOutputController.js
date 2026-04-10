const db = require('../../config/database');
const logger = require('../utils/logger');

class HourlyOutputController {
  async getHourlyOutput(req, res) {
    try {
      const { workCentreId } = req.params;
      const requestedDate = req.query.date || new Date().toISOString().split('T')[0];
      
      logger.info(`Fetching hourly output for work centre: ${workCentreId}, date: ${requestedDate}`);
      
      // First, check if any data exists for this work centre and date
      const [checkData] = await db.query(`
        SELECT COUNT(*) as count, MIN(start_time) as min_start, MAX(finish_time) as max_finish
        FROM machine_centre_production
        WHERE work_centre_id = ? AND DATE(prod_date) = ?
      `, [workCentreId, requestedDate]);
      
      logger.info(`Data check result:`, checkData[0]);

      // Get hourly output data - use start_time for better hourly distribution
      let [hourlyData] = await db.query(`
        SELECT 
          HOUR(start_time) as hour,
          SUM(output_pairs) as production
        FROM machine_centre_production
        WHERE work_centre_id = ?
          AND DATE(prod_date) = ?
          AND start_time IS NOT NULL
        GROUP BY HOUR(start_time)
        ORDER BY hour
      `, [workCentreId, requestedDate]);
      
      logger.info(`Found ${hourlyData.length} hourly records:`, hourlyData);

      // If no data found, try with finish_time
      if (hourlyData.length === 0) {
        const [altHourlyData] = await db.query(`
          SELECT 
            HOUR(finish_time) as hour,
            SUM(output_pairs) as production
          FROM machine_centre_production
          WHERE work_centre_id = ?
            AND DATE(prod_date) = ?
            AND finish_time IS NOT NULL
          GROUP BY HOUR(finish_time)
          ORDER BY hour
        `, [workCentreId, requestedDate]);
        
        logger.info(`Alternative query found ${altHourlyData.length} records:`, altHourlyData);
        hourlyData = altHourlyData;
      }

      // Calculate average hourly output
      const [avgResult] = await db.query(`
        SELECT AVG(hourly_sum) as average
        FROM (
          SELECT SUM(output_pairs) as hourly_sum
          FROM machine_centre_production
          WHERE work_centre_id = ?
            AND DATE(prod_date) = ?
          GROUP BY HOUR(start_time)
        ) as hourly_totals
      `, [workCentreId, requestedDate]);

      // Create a map of existing data
      const dataMap = {};
      hourlyData.forEach(row => {
        dataMap[row.hour] = parseInt(row.production) || 0;
      });

      // Generate hours based on available data, not hardcoded range
      const availableHours = Object.keys(dataMap).map(h => parseInt(h)).sort((a, b) => a - b);
      const formattedData = availableHours.map(hour => ({
        hour: `${formatHour(hour)} - ${formatHour(hour + 1)}`,
        production: dataMap[hour] || 0
      }));

      const average = avgResult[0]?.average ? parseFloat(avgResult[0].average).toFixed(1) : 0;

      // Get target from production plan: target_per_day / 8 hours
      const [planData] = await db.query(
        'SELECT total_target_per_day FROM production_plan WHERE work_centre_id = ? AND plan_date = ? LIMIT 1',
        [workCentreId, requestedDate]
      );
      const target = planData[0]?.total_target_per_day
        ? Math.ceil(planData[0].total_target_per_day / 8)
        : 0;

      res.json({
        success: true,
        data: {
          hourlyData: formattedData,
          average: parseFloat(average),
          target
        }
      });
    } catch (error) {
      logger.error('Error fetching hourly output:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

function formatHour(hour) {
  if (hour === 0) return '12 AM';
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return '12 PM';
  return `${hour - 12} PM`;
}

module.exports = new HourlyOutputController();
