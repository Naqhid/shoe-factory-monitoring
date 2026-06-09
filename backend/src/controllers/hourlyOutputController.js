const db = require('../../config/database');
const logger = require('../utils/logger');
const wipStateService = require('../services/wipStateService');

/** Standard working hours for prorating daily pair targets (matches production_routing_header.target_per_hour = target_per_day / 8). */
const SHIFT_HOURS = 8;

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

      const eolMachineId = await wipStateService.resolveEolMachineId(Number(workCentreId));

      const [checkData] = await db.query(`
        SELECT COUNT(*) as count, MIN(start_time) as min_start, MAX(finish_time) as max_finish
        FROM machine_centre_production
        WHERE work_centre_id = ? AND DATE(prod_date) = ?
      `, [workCentreId, requestedDate]);

      logger.info(`Data check result:`, checkData[0]);

      // End-of-line machine output only (matches TV dashboard / overall performance)
      let [hourlyData] = await db.query(`
        SELECT HOUR(start_time) as hour, SUM(output_pairs) as production
        FROM machine_centre_production
        WHERE work_centre_id = ? AND DATE(prod_date) = ? AND start_time IS NOT NULL AND button_status = 2
          AND machine_id = ?
        GROUP BY HOUR(start_time)
        ORDER BY hour
      `, [workCentreId, requestedDate, eolMachineId]);

      logger.info(`Found ${hourlyData.length} hourly records:`, hourlyData);

      if (hourlyData.length === 0) {
        const [altHourlyData] = await db.query(`
          SELECT HOUR(finish_time) as hour, SUM(output_pairs) as production
          FROM machine_centre_production
          WHERE work_centre_id = ? AND DATE(prod_date) = ? AND finish_time IS NOT NULL AND button_status = 2
            AND machine_id = ?
          GROUP BY HOUR(finish_time)
          ORDER BY hour
        `, [workCentreId, requestedDate, eolMachineId]);

        logger.info(`Alternative query found ${altHourlyData.length} records:`, altHourlyData);
        hourlyData = altHourlyData;
      }

      const [avgResult] = await db.query(`
        SELECT AVG(hourly_sum) as average
        FROM (
          SELECT SUM(output_pairs) as hourly_sum
          FROM machine_centre_production
          WHERE work_centre_id = ? AND DATE(prod_date) = ? AND button_status = 2
            AND machine_id = ?
          GROUP BY HOUR(start_time)
        ) as hourly_totals
      `, [workCentreId, requestedDate, eolMachineId]);

      const dataMap = {};
      hourlyData.forEach(row => { dataMap[row.hour] = parseInt(row.production) || 0; });
      const availableHours = Object.keys(dataMap).map(h => parseInt(h)).sort((a, b) => a - b);
      const formattedData = availableHours.map(hour => ({
        hour: `${formatHour(hour)} - ${formatHour(hour + 1)}`,
        production: dataMap[hour] || 0
      }));

      const average = avgResult[0]?.average ? parseFloat(avgResult[0].average).toFixed(1) : 0;

      // Daily pairs: prefer production routing header (source of truth for line capacity), else production plan.
      // Routing join matches productionTrackerController.getSummary so hourly pacing stays consistent with planning.
      const [targetRows] = await db.query(
        `
        SELECT
          COALESCE(prh.target_per_day, pp.total_target_per_day, 0) AS daily_target,
          pp.total_target_per_day AS plan_target_per_day,
          prh.target_per_day AS routing_target_per_day
        FROM production_plan pp
        LEFT JOIN production_routing_header prh ON prh.id = (
          SELECT prh2.id
          FROM production_routing_header prh2
          WHERE prh2.style_id = pp.style_id
            AND DATE(prh2.created_on) <= DATE(pp.plan_date)
          ORDER BY prh2.created_on DESC, prh2.id DESC
          LIMIT 1
        )
        WHERE pp.work_centre_id = ?
          AND DATE(pp.plan_date) = DATE(?)
          AND pp.deleted_at IS NULL
        LIMIT 1
        `,
        [workCentreId, requestedDate]
      );

      const dailyTarget = Number(targetRows[0]?.daily_target) || 0;
      // Integer hourly pairs — same convention as ProductionRoutingForm (round(day / 8)).
      const hourlyPace = dailyTarget > 0 ? Math.round(dailyTarget / SHIFT_HOURS) : 0;

      res.json({
        success: true,
        data: {
          hourlyData: formattedData,
          average: parseFloat(average),
          /** Hourly pair pace for chart reference line (= dailyTarget / SHIFT_HOURS). */
          target: hourlyPace,
          /** Full shift daily target (pairs); use for totals / achievement %, not (hourly × bucket count). */
          dailyTarget,
          shiftHours: SHIFT_HOURS,
        },
      });
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
