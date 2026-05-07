const db = require('../../config/database');
const logger = require('../utils/logger');

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseRequestedDate(rawDate) {
  const requestedDate = rawDate || new Date().toISOString().split('T')[0];
  if (!DATE_ONLY_RE.test(requestedDate)) {
    return { ok: false, error: 'Invalid date format. Expected YYYY-MM-DD.' };
  }
  const parsed = new Date(`${requestedDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return { ok: false, error: 'Invalid date value.' };
  }
  const normalized = parsed.toISOString().slice(0, 10);
  if (normalized !== requestedDate) {
    return { ok: false, error: 'Invalid date value.' };
  }
  return { ok: true, requestedDate };
}

function formatHour(hour) {
  if (hour === 0) return '12 AM';
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return '12 PM';
  return `${hour - 12} PM`;
}

class HourlyOutputController {
  async getHourlyOutput(req, res) {
    try {
      const { workCentreId } = req.params;
      const parsedDate = parseRequestedDate(req.query.date);
      if (!parsedDate.ok) {
        return res.status(400).json({ success: false, error: parsedDate.error });
      }
      const { requestedDate } = parsedDate;

      logger.info(`Fetching hourly output for work centre: ${workCentreId}, date: ${requestedDate}`);

      const [checkData] = await db.query(`
        SELECT COUNT(*) as count, MIN(start_time) as min_start, MAX(finish_time) as max_finish
        FROM machine_centre_production
        WHERE work_centre_id = ? AND DATE(prod_date) = ?
      `, [workCentreId, requestedDate]);

      logger.info(`Data check result:`, checkData[0]);

      // For Line 2A (workCentreId=5), only show Final Inspection (Machine 07) output
      // This matches how Overall Performance OUTPUT is calculated
      let [hourlyData] = await db.query(`
        SELECT HOUR(start_time) as hour, SUM(output_pairs) as production
        FROM machine_centre_production
        WHERE work_centre_id = ? AND DATE(prod_date) = ? AND start_time IS NOT NULL AND button_status = 2
          AND machine_id = '07'
        GROUP BY HOUR(start_time)
        ORDER BY hour
      `, [workCentreId, requestedDate]);

      logger.info(`Found ${hourlyData.length} hourly records:`, hourlyData);

      if (hourlyData.length === 0) {
        const [altHourlyData] = await db.query(`
          SELECT HOUR(finish_time) as hour, SUM(output_pairs) as production
          FROM machine_centre_production
          WHERE work_centre_id = ? AND DATE(prod_date) = ? AND finish_time IS NOT NULL AND button_status = 2
            AND machine_id = '07'
          GROUP BY HOUR(finish_time)
          ORDER BY hour
        `, [workCentreId, requestedDate]);

        logger.info(`Alternative query found ${altHourlyData.length} records:`, altHourlyData);
        hourlyData = altHourlyData;
      }

      const [avgResult] = await db.query(`
        SELECT AVG(hourly_sum) as average
        FROM (
          SELECT SUM(output_pairs) as hourly_sum
          FROM machine_centre_production
          WHERE work_centre_id = ? AND DATE(prod_date) = ? AND button_status = 2
            AND machine_id = '07'
          GROUP BY HOUR(start_time)
        ) as hourly_totals
      `, [workCentreId, requestedDate]);

      const dataMap = {};
      hourlyData.forEach(row => { dataMap[row.hour] = parseInt(row.production) || 0; });
      const availableHours = Object.keys(dataMap).map(h => parseInt(h)).sort((a, b) => a - b);
      const formattedData = availableHours.map(hour => ({
        hour: `${formatHour(hour)} - ${formatHour(hour + 1)}`,
        production: dataMap[hour] || 0
      }));

      const average = avgResult[0]?.average ? parseFloat(avgResult[0].average).toFixed(1) : 0;

      const [planData] = await db.query(
        'SELECT total_target_per_day FROM production_plan WHERE work_centre_id = ? AND plan_date = ? LIMIT 1',
        [workCentreId, requestedDate]
      );
      const target = planData[0]?.total_target_per_day
        ? Math.ceil(planData[0].total_target_per_day / 8)
        : 0;

      res.json({ success: true, data: { hourlyData: formattedData, average: parseFloat(average), target } });
    } catch (error) {
      logger.error('Error fetching hourly output:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getMachineHourlyOutput(req, res) {
    try {
      const { workCentreId } = req.params;
      const parsedDate = parseRequestedDate(req.query.date);
      if (!parsedDate.ok) {
        return res.status(400).json({ success: false, error: parsedDate.error });
      }
      const { requestedDate } = parsedDate;

      const [machines] = await db.query(
        `SELECT mc.machine_id, mc.name AS machine_name
         FROM machine_centres mc
         WHERE mc.work_centre_id = ?
         ORDER BY mc.machine_id`,
        [workCentreId]
      );

      const result = [];
      for (const machine of machines) {
        let [hourlyData] = await db.query(`
          SELECT HOUR(start_time) as hour, SUM(output_pairs) as production
          FROM machine_centre_production
          WHERE work_centre_id = ? AND machine_id = ? AND DATE(prod_date) = ? AND start_time IS NOT NULL AND button_status = 2
          GROUP BY HOUR(start_time)
          ORDER BY hour
        `, [workCentreId, machine.machine_id, requestedDate]);

        if (hourlyData.length === 0) {
          [hourlyData] = await db.query(`
            SELECT HOUR(finish_time) as hour, SUM(output_pairs) as production
            FROM machine_centre_production
            WHERE work_centre_id = ? AND machine_id = ? AND DATE(prod_date) = ? AND finish_time IS NOT NULL AND button_status = 2
            GROUP BY HOUR(finish_time)
            ORDER BY hour
          `, [workCentreId, machine.machine_id, requestedDate]);
        }

        const dataMap = {};
        hourlyData.forEach(row => { dataMap[row.hour] = parseInt(row.production) || 0; });
        const availableHours = Object.keys(dataMap).map(h => parseInt(h)).sort((a, b) => a - b);
        const formattedData = availableHours.map(hour => ({
          hour: `${formatHour(hour)} - ${formatHour(hour + 1)}`,
          production: dataMap[hour] || 0
        }));

        const total = formattedData.reduce((s, r) => s + r.production, 0);
        const average = formattedData.length > 0
          ? parseFloat((total / formattedData.length).toFixed(1))
          : 0;

        result.push({
          machine_id: machine.machine_id,
          machine_name: machine.machine_name,
          hourlyData: formattedData,
          average,
          total
        });
      }

      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('Error fetching machine hourly output:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = new HourlyOutputController();
