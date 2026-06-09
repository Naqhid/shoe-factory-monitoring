const db = require('../../config/database');
const logger = require('../utils/logger');
const { aggregateMachineCycleLosses } = require('../utils/cycleLossMins');
const wipStateService = require('../services/wipStateService');
const { activeWorkCentreWhere } = require('../utils/workCentreSql');

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const AS_OF_LOCAL_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

function addDaysToDateKey(dateKey, deltaDays) {
  const base = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(base.getTime())) return dateKey;
  base.setDate(base.getDate() + deltaDays);
  const y = base.getFullYear();
  const m = String(base.getMonth() + 1).padStart(2, '0');
  const d = String(base.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function shiftAsOfToPreviousDay(asOfLocal) {
  const m = String(asOfLocal || '').match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})$/);
  if (!m) return null;
  return `${addDaysToDateKey(m[1], -1)} ${m[2]}`;
}

class ProductionTrackerController {
  normalizeIssueKey(input) {
    return String(input || '').trim();
  }

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
        LEFT JOIN production_plan pp ON mcs.work_centre_id = pp.work_centre_id AND DATE(pp.plan_date) = DATE(?) AND pp.deleted_at IS NULL
        LEFT JOIN mobile_sessions ms ON mcs.work_centre_id = ms.work_centre_id AND DATE(ms.activated_at) = DATE(?) AND ms.status = 'active'
        LEFT JOIN production_routing_header prh ON prh.id = (
          SELECT prh2.id
          FROM production_routing_header prh2
          WHERE prh2.style_id = pp.style_id
            AND DATE(prh2.created_on) <= DATE(pp.plan_date)
          ORDER BY prh2.created_on DESC, prh2.id DESC
          LIMIT 1
        )
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
        LEFT JOIN production_plan pp ON mcs.work_centre_id = pp.work_centre_id AND DATE(pp.plan_date) = DATE(?) AND pp.deleted_at IS NULL
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
          LEFT JOIN production_plan pp ON mcs.work_centre_id = pp.work_centre_id AND DATE(pp.plan_date) = DATE(mcs.prod_date) AND pp.deleted_at IS NULL
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
          HOUR(pd.updated_at) as hour,
          SUM(pd.output_pairs) as pairs
        FROM machine_centre_production pd
        WHERE DATE(pd.prod_date) = DATE(?) ${whereClause}
          AND pd.button_status = 2
        GROUP BY HOUR(pd.updated_at)
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
        LEFT JOIN production_plan pp ON mcs.work_centre_id = pp.work_centre_id AND DATE(pp.plan_date) = DATE(?) AND pp.deleted_at IS NULL
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
          mcp.stoppage_reason,
          mcp.machine_id,
          mc.name as machine_name,
          mcp.emp_id,
          e.name as employee_name,
          COUNT(*) as occurrences,
          SUM(TIMESTAMPDIFF(MINUTE, mcp.idle_start_time, COALESCE(mcp.idle_stop_time, NOW()))) as total_minutes,
          MAX(mcp.idle_start_time) as last_stopped_at,
          ROUND((SUM(TIMESTAMPDIFF(MINUTE, mcp.idle_start_time, COALESCE(mcp.idle_stop_time, NOW()))) / 
            NULLIF(SUM(SUM(TIMESTAMPDIFF(MINUTE, mcp.idle_start_time, COALESCE(mcp.idle_stop_time, NOW())))) OVER(), 0)) * 100) as percentage
        FROM machine_centre_production mcp
        LEFT JOIN machine_centres mc ON mc.machine_id = mcp.machine_id
        LEFT JOIN employees e ON e.code = mcp.emp_id
        WHERE DATE(mcp.prod_date) = DATE(?) 
          AND mcp.stoppage_reason IS NOT NULL
          AND mcp.idle_start_time IS NOT NULL
          ${whereClause.replace('pd.work_centre_id', 'mcp.work_centre_id')}
        GROUP BY mcp.stoppage_reason, mcp.machine_id, mc.name, mcp.emp_id, e.name
        ORDER BY total_minutes DESC
        LIMIT 10
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
        LEFT JOIN production_plan pp ON wc.id = pp.work_centre_id AND DATE(pp.plan_date) = DATE(?) AND pp.deleted_at IS NULL
        LEFT JOIN machine_centre_summary mcs ON wc.id = mcs.work_centre_id AND DATE(mcs.prod_date) = DATE(?)
        WHERE ${activeWorkCentreWhere('wc')}
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

  // Intraday Pacing
  async getPacingData(req, res) {
    try {
      const { date, workCentreId } = req.query;
      if (!date) return res.status(400).json({ success: false, error: 'Date is required' });

      const SHIFT_START_HOUR = parseInt(process.env.SHIFT_START_HOUR || '9', 10);
      const SHIFT_START_MINUTE = parseInt(process.env.SHIFT_START_MINUTE || '5', 10);
      const SHIFT_END_HOUR = parseInt(process.env.SHIFT_END_HOUR || '17', 10);
      const SHIFT_END_MINUTE = parseInt(process.env.SHIFT_END_MINUTE || '35', 10);

      const now = new Date();
      const shiftStart = new Date(now);
      shiftStart.setHours(SHIFT_START_HOUR, SHIFT_START_MINUTE, 0, 0);
      const shiftEnd = new Date(now);
      shiftEnd.setHours(SHIFT_END_HOUR, SHIFT_END_MINUTE, 0, 0);

      const totalShiftMins = Math.max(1, Math.floor((shiftEnd - shiftStart) / 60000));
      const elapsedMins = Math.max(1, Math.min(
        Math.floor((now - shiftStart) / 60000),
        totalShiftMins
      ));
      const remainingMins = Math.max(0, totalShiftMins - elapsedMins);
      const elapsedFraction = elapsedMins / totalShiftMins;

      // Get target from production_plan (same as dashboard)
      const [planRows] = await db.execute(`
        SELECT COALESCE(SUM(total_target_per_day), 0) AS target_pairs
        FROM production_plan
        WHERE DATE(plan_date) = DATE(?)
          AND deleted_at IS NULL
          ${workCentreId && workCentreId !== 'all' ? 'AND work_centre_id = ?' : ''}
      `, workCentreId && workCentreId !== 'all' ? [date, workCentreId] : [date]);

      // EOL output per line (uses work_centres.eol_machine_id)
      let actual = 0;
      if (workCentreId && workCentreId !== 'all') {
        actual = await wipStateService.getEolOutput(Number(workCentreId), date);
      } else {
        const [outputRows] = await db.execute(`
          SELECT COALESCE(SUM(mcs.total_output_pairs), 0) AS actual_pairs
          FROM machine_centre_summary mcs
          INNER JOIN work_centres wc ON wc.id = mcs.work_centre_id
          WHERE DATE(mcs.prod_date) = DATE(?)
            AND mcs.machine_id = COALESCE(NULLIF(wc.eol_machine_id, ''), '07')
        `, [date]);
        actual = Number(outputRows[0]?.actual_pairs || 0);
      }
      const target = Number(planRows[0]?.target_pairs || 0);
      const expectedByNow = Math.round(target * elapsedFraction);
      const gap = actual - expectedByNow;
      const projectedEod = elapsedMins > 0 ? Math.round((actual / elapsedMins) * totalShiftMins) : 0;
      const paceRate = expectedByNow > 0 ? Math.round((actual / expectedByNow) * 100) : 100;
      const requiredRate = remainingMins > 0
        ? Math.round(Math.max(0, target - actual) / remainingMins * 60)
        : 0;
      const currentRate = elapsedMins > 0 ? Math.round(actual / elapsedMins * 60) : 0;

      res.json({
        success: true,
        data: {
          actual,
          target,
          expected_by_now: expectedByNow,
          gap,
          pace_rate: paceRate,
          projected_eod: projectedEod,
          current_rate_per_hour: currentRate,
          required_rate_per_hour: requiredRate,
          elapsed_mins: elapsedMins,
          remaining_mins: remainingMins,
          total_shift_mins: totalShiftMins,
          elapsed_fraction: Math.round(elapsedFraction * 100),
        }
      });
    } catch (error) {
      logger.error('Error getting pacing data:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getAlertActions(req, res) {
    try {
      const keys = Array.isArray(req.body?.keys)
        ? req.body.keys.map((k) => this.normalizeIssueKey(k)).filter(Boolean)
        : [];
      if (keys.length === 0) {
        return res.json({ success: true, data: {} });
      }
      const placeholders = keys.map(() => '?').join(', ');
      const [rows] = await db.execute(
        `SELECT issue_key, acknowledged_at, escalated_at
         FROM tracker_alert_actions
         WHERE issue_key IN (${placeholders})`,
        keys
      );
      const data = {};
      rows.forEach((row) => {
        data[row.issue_key] = {
          ack: !!row.acknowledged_at,
          escalated: !!row.escalated_at,
        };
      });
      res.json({ success: true, data });
    } catch (error) {
      logger.error('Error querying tracker alert actions:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async acknowledgeAlert(req, res) {
    try {
      const issueKey = this.normalizeIssueKey(req.body?.issue_key);
      if (!issueKey) {
        return res.status(400).json({ success: false, error: 'issue_key is required' });
      }
      await db.execute(
        `INSERT INTO tracker_alert_actions (issue_key, acknowledged_at, escalated_at, updated_at)
         VALUES (?, NOW(), NULL, NOW())
         ON DUPLICATE KEY UPDATE acknowledged_at = NOW(), updated_at = NOW()`,
        [issueKey]
      );
      res.json({ success: true });
    } catch (error) {
      logger.error('Error acknowledging tracker alert:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async escalateAlert(req, res) {
    try {
      const issueKey = this.normalizeIssueKey(req.body?.issue_key);
      if (!issueKey) {
        return res.status(400).json({ success: false, error: 'issue_key is required' });
      }
      await db.execute(
        `INSERT INTO tracker_alert_actions (issue_key, acknowledged_at, escalated_at, updated_at)
         VALUES (?, NULL, NOW(), NOW())
         ON DUPLICATE KEY UPDATE escalated_at = NOW(), updated_at = NOW()`,
        [issueKey]
      );
      res.json({ success: true });
    } catch (error) {
      logger.error('Error escalating tracker alert:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getMachineTimeLossMeta(req, res) {
    try {
      const workCentreId = Number(req.query?.work_centre_id);
      const rawDate = String(req.query?.date || '');
      const dateKey = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : new Date().toISOString().slice(0, 10);

      if (!Number.isFinite(workCentreId) || workCentreId <= 0) {
        return res.status(400).json({ success: false, error: 'work_centre_id is required' });
      }

      const losses = await aggregateMachineCycleLosses(db, workCentreId, dateKey);
      const [reasonRows] = await db.execute(
        `SELECT machine_id, reason, updated_by, updated_at
         FROM machine_time_loss_reasons
         WHERE work_centre_id = ? AND prod_date = DATE(?)`,
        [workCentreId, dateKey]
      );

      const reasonByMachine = new Map();
      reasonRows.forEach((row) => {
        reasonByMachine.set(String(row.machine_id), {
          reason: row.reason,
          updated_by: row.updated_by,
          updated_at: row.updated_at,
        });
      });

      const lossByMachine = new Map();
      losses.forEach((row) => {
        lossByMachine.set(String(row.machine_id), row);
      });

      const machineIds = new Set([...lossByMachine.keys(), ...reasonByMachine.keys()]);
      const machines = Array.from(machineIds).map((machineId) => {
        const loss = lossByMachine.get(machineId);
        const meta = reasonByMachine.get(machineId);
        return {
          machine_id: machineId,
          machine_name: loss?.machine_name || `Machine ${machineId}`,
          net_mins: Number(loss?.net_mins ?? 0),
          reason: meta?.reason || null,
          updated_by: meta?.updated_by || null,
          updated_at: meta?.updated_at || null,
        };
      });

      return res.json({
        success: true,
        date: dateKey,
        work_centre_id: workCentreId,
        machines,
      });
    } catch (error) {
      logger.error('Error getting machine time loss meta:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /** EOL output: yesterday at same clock time vs yesterday full day (for line detail). */
  async getLineYesterdayCompare(req, res) {
    try {
      const workCentreId = Number(req.query?.work_centre_id);
      const rawDate = String(req.query?.date || '');
      const dateKey = DATE_ONLY_RE.test(rawDate) ? rawDate : new Date().toISOString().slice(0, 10);
      const asOfLocal = String(req.query?.as_of || '').trim();

      if (!Number.isFinite(workCentreId) || workCentreId <= 0) {
        return res.status(400).json({ success: false, error: 'work_centre_id is required' });
      }
      if (!AS_OF_LOCAL_RE.test(asOfLocal)) {
        return res.status(400).json({
          success: false,
          error: 'as_of is required (YYYY-MM-DD HH:mm:ss)',
        });
      }

      const yesterdayKey = addDaysToDateKey(dateKey, -1);
      const yesterdayAsOf = shiftAsOfToPreviousDay(asOfLocal);
      if (!yesterdayAsOf) {
        return res.status(400).json({ success: false, error: 'Invalid as_of value' });
      }

      const [yesterdaySameTime, yesterdayFullDay] = await Promise.all([
        wipStateService.getEolOutputUpTo(workCentreId, yesterdayKey, yesterdayAsOf),
        wipStateService.getEolOutput(workCentreId, yesterdayKey),
      ]);

      const asOfTimeLabel = asOfLocal.slice(11, 16);

      return res.json({
        success: true,
        date: dateKey,
        yesterday_date: yesterdayKey,
        as_of: asOfLocal,
        as_of_time_label: asOfTimeLabel,
        yesterday_same_time_output: yesterdaySameTime,
        yesterday_full_day_output: yesterdayFullDay,
      });
    } catch (error) {
      logger.error('Error getting line yesterday compare:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async saveMachineTimeLossReason(req, res) {
    try {
      const workCentreId = Number(req.body?.work_centre_id);
      const machineId = String(req.body?.machine_id || '').trim();
      const rawDate = String(req.body?.date || '');
      const dateKey = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : new Date().toISOString().slice(0, 10);
      const reason = String(req.body?.reason || '').trim();

      if (!Number.isFinite(workCentreId) || workCentreId <= 0) {
        return res.status(400).json({ success: false, error: 'work_centre_id is required' });
      }
      if (!machineId) {
        return res.status(400).json({ success: false, error: 'machine_id is required' });
      }
      if (!reason) {
        return res.status(400).json({ success: false, error: 'reason is required' });
      }

      const updatedBy =
        String(req.user?.code || req.user?.name || req.user?.username || 'tracker').trim() || 'tracker';

      await db.execute(
        `INSERT INTO machine_time_loss_reasons (work_centre_id, machine_id, prod_date, reason, updated_by)
         VALUES (?, ?, DATE(?), ?, ?)
         ON DUPLICATE KEY UPDATE reason = VALUES(reason), updated_by = VALUES(updated_by), updated_at = NOW()`,
        [workCentreId, machineId, dateKey, reason.slice(0, 255), updatedBy]
      );

      return res.json({ success: true, machine_id: machineId, reason, updated_by: updatedBy });
    } catch (error) {
      logger.error('Error saving machine time loss reason:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = new ProductionTrackerController();
