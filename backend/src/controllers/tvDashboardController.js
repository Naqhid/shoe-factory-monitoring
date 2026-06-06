/**
 * tvDashboardController.js
 *
 * TV Dashboard API controller.
 *
 * MES WIP LOGIC (replaces old Target - Output formula):
 *   Current WIP = Opening WIP + Input - Output
 *
 *   - Input  : Production from the line input machine (e.g. 01 Quarter Zig Zag Stitching (Input)).
 *   - Output : End-of-line completed production (existing logic, unchanged).
 *   - Opening WIP : From wip_daily_state only (seed SQL or prior closeDay carry-forward).
 *
 * Line 3 is the primary line using this WIP formula.
 * Requires a wip_daily_state row for the date; no code fallback values.
 */

'use strict';

const pool = require('../../config/database');
const wipStateService = require('../services/wipStateService');
const { getRoutingMinsSqlExpr } = require('../utils/routingMinsColumn');
const { aggregateMachineCycleLosses, aggregateWorkCentreCycleLoss } = require('../utils/cycleLossMins');

// ── Work Centre ID for Line 3 (legacy constant; input machine resolved per line) ──
const LINE_3_WORK_CENTRE_ID = 3;

// ── Machine ID constants ──────────────────────────────────────────────────────
/** End-of-line Final Inspection machine for Line 2A (work_centre_id = 5) */
const EOL_MACHINE_LINE_2A = '07';

// ─────────────────────────────────────────────────────────────────────────────

exports.getWorkCentres = async (req, res) => {
    try {
        const [workCentres] = await pool.query('SELECT id, name FROM work_centres ORDER BY id');
        res.json({ success: true, data: workCentres });
    } catch (error) {
        console.error('Error fetching work centres:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.getMachineCentresByWorkCentre = async (req, res) => {
    try {
        const { workCentreId } = req.params;
        const date = req.query.date || new Date().toISOString().split('T')[0];
        const routingMinsExpr = await getRoutingMinsSqlExpr('prl');

        // Summary is keyed by (date, line, machine, employee); aggregate to one row per machine.
        const [rows] = await pool.query(`
            SELECT
                mc.id              AS machine_centre_id,
                mc.name            AS machine_centre_name,
                COALESCE(mc.machine_name, mc.name) AS machine_name,
                mc.machine_id,
                COALESCE(mcs_agg.total_output_pairs, 0) AS total_output_pairs,
                COALESCE(ROUND(mcs_agg.avg_efficiency_percent, 1), 0) AS avg_efficiency_percent,
                COALESCE(
                    (SELECT ROUND(SUM(${routingMinsExpr}), 2)
                     FROM production_routing_lines prl
                     JOIN production_routing_header prh ON prl.routing_header_id = prh.id
                     JOIN production_plan pp2 ON prh.style_id = pp2.style_id
                     WHERE prl.machine_centre_id = mc.machine_id
                       AND pp2.work_centre_id = ?
                       AND DATE(pp2.plan_date) = ?
                    ), 0
                ) AS target_mins_per_box,
                ms.emp_code,
                e.name AS emp_name
            FROM machine_centres mc
            LEFT JOIN (
                SELECT
                    machine_id,
                    work_centre_id,
                    SUM(total_output_pairs) AS total_output_pairs,
                    CASE
                        WHEN SUM(total_actual_mins + total_idle_mins) > 0
                        THEN LEAST(
                            (SUM(total_target_mins) / SUM(total_actual_mins + total_idle_mins)) * 100,
                            9999.99
                        )
                        ELSE 0
                    END AS avg_efficiency_percent
                FROM machine_centre_summary
                WHERE DATE(prod_date) = ?
                  AND work_centre_id = ?
                GROUP BY machine_id, work_centre_id
            ) mcs_agg
                ON mcs_agg.machine_id = mc.machine_id
            LEFT JOIN mobile_sessions ms
                ON ms.machine_id = mc.machine_id
                AND ms.work_centre_id = ?
                AND ms.status = 'active'
                AND DATE(ms.activated_at) = ?
            LEFT JOIN employees e ON e.id = ms.emp_id
            WHERE (mc.work_centre_id = ? OR mcs_agg.work_centre_id = ?)
              AND mc.deleted_at IS NULL
              AND COALESCE(mc.is_active, 1) = 1
            ORDER BY mc.machine_id
        `, [workCentreId, date, date, workCentreId, workCentreId, date, workCentreId, workCentreId]);

        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error fetching machine centres for work centre:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.getDashboard = async (req, res) => {
    try {
        const { workCentreId } = req.params;
        const today = req.query.date || new Date().toISOString().split('T')[0];

        // ── 1. Target ─────────────────────────────────────────────────────────
        const [planningData] = await pool.query(
            'SELECT SUM(total_target_per_day) as total_target FROM production_plan WHERE plan_date = ? AND work_centre_id = ?',
            [today, workCentreId]
        );

        // ── 2. Output (end-of-line) ───────────────────────────────────────────
        // Line 3 (work_centre_id=5): EOL Final Inspection machine 07 (from production, then summary).
        const finalOutput = await wipStateService.getEolOutput(Number(workCentreId), today);

        const [summaryData] = await pool.query(`
            SELECT COALESCE(avg_efficiency_percent, 0) as eol_efficiency_percent
            FROM machine_centre_summary
            WHERE prod_date = ? AND work_centre_id = ? AND machine_id = '07'
            LIMIT 1
        `, [today, workCentreId]);

        const [wcData] = await pool.query('SELECT name FROM work_centres WHERE id = ?', [workCentreId]);

        const target = planningData[0]?.total_target || 0;
        const output = finalOutput;
        const outputPercent = target > 0 ? (output / target) * 100 : 0;
        const efficiencyPercent = summaryData[0]?.eol_efficiency_percent || 0;

        // ── 3. Input from line input machine (e.g. 01 — Quarter Zig Zag Stitching) ──
        const overallInput = await wipStateService.getTodayInput(Number(workCentreId), today);

        // ── 4. MES WIP: Opening WIP + Input - Output ──────────────────────────
        // Replaces old formula: WIP = Target - Output
        const wipData = await wipStateService.computeAndPersistWip(Number(workCentreId), today);
        const wipBreakdown = await wipStateService.getWipBreakdown(Number(workCentreId), today);

        let emojiType = 'sad';
        if (outputPercent >= 90 && efficiencyPercent >= 90) emojiType = 'happy';
        else if (outputPercent >= 70 && efficiencyPercent >= 70) emojiType = 'medium';

        // ── 5. Work centre summary (middle section) ───────────────────────────
        const [wcPlanningData] = await pool.query(
            'SELECT SUM(total_target_per_day) as target FROM production_plan WHERE plan_date = ? AND work_centre_id = ?',
            [today, workCentreId]
        );
        const [wcSummaryData] = await pool.query(
            `SELECT SUM(total_output_pairs) as output,
             CASE
                WHEN SUM(total_output_pairs) <= 0 THEN 0
                WHEN SUM(total_actual_mins) > 0 THEN (SUM(total_target_mins) / SUM(total_actual_mins)) * 100
                ELSE 0
             END as avg_efficiency
             FROM machine_centre_summary WHERE prod_date = ? AND work_centre_id = ?`,
            [today, workCentreId]
        );

        const cycleLoss = await aggregateWorkCentreCycleLoss(pool, Number(workCentreId), today);
        const machineTimeLosses = await aggregateMachineCycleLosses(pool, Number(workCentreId), today);

        const wcTarget = wcPlanningData[0]?.target || 0;
        const wcOutput = wcSummaryData[0]?.output || 0;
        const wcOutputPercent = wcTarget > 0 ? (wcOutput / wcTarget) * 100 : 0;
        const wcEfficiency = wcSummaryData[0]?.avg_efficiency || 0;

        // ── 6. Attendance ─────────────────────────────────────────────────────
        const [attendanceTarget] = await pool.query(`
            SELECT COALESCE(SUM(prl.manpower), 0) as target_employees
            FROM production_plan pp
            JOIN production_routing_header prh ON prh.id = (
                SELECT prh2.id
                FROM production_routing_header prh2
                WHERE prh2.style_id = pp.style_id
                  AND DATE(prh2.created_on) <= DATE(pp.plan_date)
                ORDER BY prh2.created_on DESC, prh2.id DESC
                LIMIT 1
            )
            JOIN production_routing_lines prl ON prh.id = prl.routing_header_id
            WHERE DATE(pp.plan_date) = DATE(?) AND pp.work_centre_id = ?
        `, [today, workCentreId]);

        const [attendancePresent] = await pool.query(`
            SELECT COUNT(DISTINCT emp_id) as present_employees
            FROM mobile_sessions
            WHERE DATE(activated_at) = DATE(?) AND status = 'active'
        `, [today]);

        // ── 7. Hourly output ──────────────────────────────────────────────────
        const [avgHourlyData] = await pool.query(`
            SELECT AVG(hourly_output) AS avg_hourly_output
            FROM (
                SELECT HOUR(created_at) AS hr, SUM(output_pairs) AS hourly_output
                FROM machine_centre_production
                WHERE DATE(created_at) = ? AND work_centre_id = ? AND button_status = 2
                GROUP BY HOUR(created_at)
            ) AS hourly_data
        `, [today, workCentreId]);
        const hourlyOutput = Math.round(avgHourlyData[0]?.avg_hourly_output || 0);

        const [hourlyData] = await pool.query(`
            SELECT HOUR(updated_at) as hour, SUM(output_pairs) as output
            FROM machine_centre_production
            WHERE work_centre_id = ? AND DATE(prod_date) = ? AND button_status = 2
            GROUP BY HOUR(updated_at)
            ORDER BY hour
        `, [workCentreId, today]);

        // ── 8. Bottleneck & breakdown events (supervisor-logged + active machine stops) ──
        const stoppageEventSelect = `
            SELECT
                mc.name AS machine_centre_name,
                wc.name AS work_centre_name,
                mb.start_time,
                mb.finish_time,
                mb.idle_start_time,
                mb.stoppage_reason AS detail,
                mb.button_status
        `;

        const [bottlenecks] = await pool.query(`
            ${stoppageEventSelect}
            FROM machine_centre_production mb
            JOIN machine_centres mc
              ON mc.machine_id = mb.machine_id
              AND mc.work_centre_id = mb.work_centre_id
            JOIN work_centres wc ON wc.id = mb.work_centre_id
            WHERE mb.work_centre_id = ?
              AND DATE(mb.prod_date) = ?
              AND (
                  (mb.button_status = 1
                   AND mb.idle_start_time IS NOT NULL
                   AND mb.idle_stop_time IS NULL
                   AND mb.stoppage_reason LIKE 'BOTTLENECK:%')
                  OR (mb.button_status = 2
                      AND mb.stoppage_reason LIKE 'BOTTLENECK:%'
                      AND LOWER(mb.stoppage_reason) NOT LIKE '%breakdown%')
              )
            ORDER BY COALESCE(mb.idle_start_time, mb.start_time) DESC
        `, [workCentreId, today]);

        const [breakdowns] = await pool.query(`
            ${stoppageEventSelect}
            FROM machine_centre_production mb
            JOIN machine_centres mc
              ON mc.machine_id = mb.machine_id
              AND mc.work_centre_id = mb.work_centre_id
            JOIN work_centres wc ON wc.id = mb.work_centre_id
            WHERE mb.work_centre_id = ?
              AND DATE(mb.prod_date) = ?
              AND (
                  (mb.button_status = 1
                   AND mb.idle_start_time IS NOT NULL
                   AND mb.idle_stop_time IS NULL
                   AND (
                       LOWER(mb.stoppage_reason) LIKE '%breakdown%'
                       OR mb.stoppage_reason LIKE 'BREAKDOWN:%'
                   ))
                  OR (mb.button_status = 2
                      AND (
                          mb.stoppage_reason LIKE 'BREAKDOWN:%'
                          OR LOWER(mb.stoppage_reason) LIKE '%machine breakdown%'
                          OR (mb.stoppage_reason LIKE 'BOTTLENECK:%'
                              AND LOWER(mb.stoppage_reason) LIKE '%breakdown%')
                      ))
              )
            ORDER BY COALESCE(mb.idle_start_time, mb.start_time) DESC
        `, [workCentreId, today]);

        const [reworkRows] = await pool.query(`
            SELECT machine_centre_name, rework_qty, rejection_qty, reason_category, reason
            FROM rework_rejection
            WHERE work_centre_id = ?
              AND DATE(production_date) = DATE(?)
              AND (rework_qty > 0 OR rejection_qty > 0)
            ORDER BY (rework_qty + rejection_qty) DESC, machine_centre_name ASC
        `, [workCentreId, today]);

        const reworkTotals = reworkRows.reduce(
            (acc, row) => ({
                total_rework: acc.total_rework + Number(row.rework_qty || 0),
                total_rejection: acc.total_rejection + Number(row.rejection_qty || 0),
            }),
            { total_rework: 0, total_rejection: 0 }
        );

        // ── 9. Line Performance with MES WIP ─────────────────────────────────
        // Fetch raw line data first, then enrich with MES WIP per line.
        const [linePerformanceRaw] = await pool.query(`
            SELECT
                wc.id as work_centre_id,
                wc.name as line_name,
                COALESCE(pp.target, 0) as target,
                -- For Line 2A (id=5), use Machine 07 output; for others, sum all machines
                COALESCE(CASE WHEN wc.id = 5 THEN mcs07.output ELSE mcsall.output END, 0) as output,
                CASE WHEN COALESCE(pp.target, 0) > 0
                     THEN ROUND((COALESCE(CASE WHEN wc.id = 5 THEN mcs07.output ELSE mcsall.output END, 0) / pp.target) * 100, 0)
                     ELSE 0
                END as output_percentage,
                CASE
                    WHEN COALESCE(CASE WHEN wc.id = 5 THEN mcs07.output ELSE mcsall.output END, 0) <= 0 THEN 0
                    WHEN COALESCE(CASE WHEN wc.id = 5 THEN mcs07.actual_mins ELSE mcsall.actual_mins END, 0) > 0
                        THEN ROUND((COALESCE(CASE WHEN wc.id = 5 THEN mcs07.target_mins ELSE mcsall.target_mins END, 0) /
                                    COALESCE(CASE WHEN wc.id = 5 THEN mcs07.actual_mins ELSE mcsall.actual_mins END, 0)) * 100, 0)
                    ELSE 0
                END as efficiency
            FROM work_centres wc
            LEFT JOIN (
                SELECT work_centre_id, SUM(total_target_per_day) as target
                FROM production_plan
                WHERE DATE(plan_date) = DATE(?)
                GROUP BY work_centre_id
            ) pp ON wc.id = pp.work_centre_id
            LEFT JOIN (
                -- Machine 07 output for Line 2A (Final Inspection)
                SELECT work_centre_id,
                       total_output_pairs as output,
                       total_target_mins as target_mins,
                       total_actual_mins as actual_mins
                FROM machine_centre_summary
                WHERE DATE(prod_date) = DATE(?) AND machine_id = '07'
            ) mcs07 ON wc.id = mcs07.work_centre_id
            LEFT JOIN (
                -- All machines output for other lines
                SELECT work_centre_id,
                       SUM(total_output_pairs) as output,
                       SUM(total_target_mins) as target_mins,
                       SUM(total_actual_mins) as actual_mins
                FROM machine_centre_summary
                WHERE DATE(prod_date) = DATE(?)
                GROUP BY work_centre_id
            ) mcsall ON wc.id = mcsall.work_centre_id
            ORDER BY wc.id
        `, [today, today, today]);

        // Enrich each line with MES WIP (Opening WIP + Input - Output)
        // and live Input from the line input machine
        const linePerformance = await Promise.all(
            linePerformanceRaw.map(async (line) => {
                const lineWcId = Number(line.work_centre_id);

                // Fetch live input from the line input machine
                const lineInput = await wipStateService.getTodayInput(lineWcId, today);
                const lineEolOutput = await wipStateService.getEolOutput(lineWcId, today);

                // Compute and persist MES WIP for this line (EOL output only — not sum of all machines)
                const lineWip = await wipStateService.computeAndPersistWip(lineWcId, today);

                return {
                    work_centre_id: lineWcId,
                    line_name: line.line_name,
                    target: Math.round(line.target || 0),
                    input: lineInput,
                    output: Math.round(lineEolOutput),
                    output_percentage: Math.round(line.output_percentage || 0),
                    efficiency: Math.round(line.efficiency || 0),
                    wip: lineWip.currentWip,                  // NEW: MES WIP formula
                    opening_wip: lineWip.openingWip,          // For transparency/debugging
                };
            })
        );

        // ── 10. Build response ────────────────────────────────────────────────
        res.json({
            success: true,
            data: {
                topSection: {
                    workCentreName: 'Overall Performance',
                    target: Math.round(target),
                    input: overallInput,
                    output: Math.round(output),
                    outputPercent: Math.round(outputPercent),
                    efficiencyPercent: Math.round(efficiencyPercent),
                    lossOfMinutes: cycleLoss.lossOfMinutes,
                    lossInactiveMins: cycleLoss.inactiveMins,
                    lossExtraMins: cycleLoss.extraMins,
                    // MES WIP fields for overall section
                    openingWip: wipData.openingWip,
                    currentWip: wipData.currentWip,
                    closingWip: wipData.closingWip,
                    wipBreakdown,
                    showHappyEmoji: emojiType === 'happy',
                    showMediumEmoji: emojiType === 'medium'
                },
                middleSection: {
                    workCentreName: wcData[0]?.name || 'N/A',
                    target: Math.round(wcTarget),
                    output: Math.round(wcOutput),
                    outputPercent: Math.round(wcOutputPercent),
                    hourlyOutput: hourlyOutput,
                    efficiencyPercent: Math.round(wcEfficiency),
                    present: Math.round(attendancePresent[0]?.present_employees || 0),
                    target_employees: Math.round(attendanceTarget[0]?.target_employees || 0)
                },
                lowerSection: {
                    hourlyData: hourlyData,
                    bottlenecks: bottlenecks,
                    breakdowns: breakdowns,
                    machineTimeLosses,
                    reworkEntries: reworkRows,
                    reworkTotals,
                    linePerformance,
                    workCentreName: wcData[0]?.name || 'N/A'
                }
            }
        });
    } catch (error) {
        console.error('Error fetching TV dashboard data:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};
