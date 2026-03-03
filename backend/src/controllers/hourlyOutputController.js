const db = require('../../config/database');
const logger = require('../utils/logger');

class HourlyOutputController {
  async getHourlyOutput(req, res) {
    try {
      const { workCentreId } = req.params;
      const today = new Date().toISOString().split('T')[0];

      // Get hourly output data
      const [hourlyData] = await db.query(`
        SELECT 
          HOUR(created_at) as hour,
          SUM(output_pairs) as production
        FROM machine_centre_production
        WHERE work_centre_id = ?
          AND DATE(created_at) = ?
        GROUP BY HOUR(created_at)
        ORDER BY hour
      `, [workCentreId, today]);

      // Calculate average hourly output
      const [avgResult] = await db.query(`
        SELECT AVG(hourly_sum) as average
        FROM (
          SELECT SUM(output_pairs) as hourly_sum
          FROM machine_centre_production
          WHERE work_centre_id = ?
            AND DATE(created_at) = ?
          GROUP BY HOUR(created_at)
        ) as hourly_totals
      `, [workCentreId, today]);

      // Format hourly data with AM/PM
      const formattedData = hourlyData.map(row => ({
        hour: formatHour(row.hour),
        production: parseInt(row.production) || 0
      }));

      const average = avgResult[0]?.average ? parseFloat(avgResult[0].average).toFixed(1) : 0;
      const target = 95; // Fixed target value

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
