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
const { ACTIVE_WORK_CENTRE_WHERE, activeWorkCentreWhere } = require('../utils/workCentreSql');

// ── Work Centre ID for Line 3 (legacy constant; input machine resolved per line) ──
const LINE_3_WORK_CENTRE_ID = 3;

// ── Machine ID constants ──────────────────────────────────────────────────────
/** End-of-line Final Inspection machine for Line 2A (work_centre_id = 5) */
const EOL_MACHINE_LINE_2A = '07';

// ─────────────────────────────────────────────────────────────────────────────

exports.getWorkCentres = async (req, res) => {
    try {
        const [workCentres] = await pool.query(
            `SELECT id, name, sequence_no FROM work_centres WHERE ${ACTIVE_WORK_CENTRE_WHERE} ORDER BY (sequence_no IS NULL), sequence_no, id`
        );
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
                       AND pp2.deleted_at IS NULL
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
            WHERE mc.work_centre_id = ?
              AND mc.deleted_at IS NULL
              AND COALESCE(mc.is_active, 1) = 1
            ORDER BY mc.machine_id
        `, [workCentreId, date, date, workCentreId, workCentreId, date, workCentreId]);

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
            'SELECT SUM(total_target_per_day) as total_target FROM production_plan WHERE DATE(plan_date) = DATE(?) AND work_centre_id = ? AND deleted_at IS NULL',
            [today, workCentreId]
        );

        // ── 2. Output (end-of-line) ───────────────────────────────────────────
        // Line 3 (work_centre_id=5): EOL Final Inspection machine 07 (from production, then summary).
        const finalOutput = await wipStateService.getEolOutput(Number(workCentreId), today);
        const eolMachineId = await wipStateService.resolveEolMachineId(Number(workCentreId));

        const [summaryData] = await pool.query(`
            SELECT COALESCE(avg_efficiency_percent, 0) as eol_efficiency_percent
            FROM machine_centre_summary
            WHERE prod_date = ? AND work_centre_id = ? AND machine_id = ?
            LIMIT 1
        `, [today, workCentreId, eolMachineId]);

        const [wcData] = await pool.query('SELECT name FROM work_centres WHERE id = ?', [workCentreId]);

        // ── Current article for this work centre ──────────────────────────────
        const [[currentArticle]] = await pool.query(`
            SELECT s.code AS style_code, s.name AS style_name
            FROM line_style_assignments lsa
            JOIN styles s ON s.id = lsa.style_id
            WHERE lsa.work_centre_id = ? AND lsa.assignment_date <= ? AND lsa.deleted_at IS NULL
            ORDER BY lsa.assignment_date DESC, lsa.id DESC
            LIMIT 1
        `, [workCentreId, today]);
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
            'SELECT SUM(total_target_per_day) as target FROM production_plan WHERE DATE(plan_date) = DATE(?) AND work_centre_id = ? AND deleted_at IS NULL',
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
            WHERE DATE(pp.plan_date) = DATE(?) AND pp.work_centre_id = ? AND pp.deleted_at IS NULL
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
            SELECT rr.id, wc.name AS work_centre_name, rr.rework_qty, rr.rejection_qty, rr.reason_category, rr.reason
            FROM rework_rejection rr
            LEFT JOIN work_centres wc ON wc.id = rr.work_centre_id
            WHERE rr.work_centre_id = ?
              AND DATE(rr.production_date) = DATE(?)
              AND (rr.rework_qty > 0 OR rr.rejection_qty > 0)
            ORDER BY (rr.rework_qty + rr.rejection_qty) DESC, rr.id ASC
        `, [workCentreId, today]);

        const reworkTotals = reworkRows.reduce(
            (acc, row) => ({
                total_rework: acc.total_rework + Number(row.rework_qty || 0),
                total_rejection: acc.total_rejection + Number(row.rejection_qty || 0),
            }),
            { total_rework: 0, total_rejection: 0 }
        );

        // Rework % = rework / total output recorded in rework_rejection (line-wise and all lines).
        const [[reworkLineAgg]] = await pool.query(`
            SELECT COALESCE(SUM(total_output_pairs), 0) AS total_output,
                   COALESCE(SUM(rework_qty), 0) AS rework_qty,
                   COALESCE(SUM(rejection_qty), 0) AS rejection_qty
            FROM rework_rejection
            WHERE work_centre_id = ? AND DATE(production_date) = DATE(?)
        `, [workCentreId, today]);
        const [[reworkAllAgg]] = await pool.query(`
            SELECT COALESCE(SUM(total_output_pairs), 0) AS total_output,
                   COALESCE(SUM(rework_qty), 0) AS rework_qty,
                   COALESCE(SUM(rejection_qty), 0) AS rejection_qty
            FROM rework_rejection
            WHERE DATE(production_date) = DATE(?)
        `, [today]);
        const toReworkPercents = (agg) => {
            const out = Number(agg.total_output) || 0;
            return {
                total_output: out,
                total_rework: Number(agg.rework_qty) || 0,
                total_rejection: Number(agg.rejection_qty) || 0,
                rework_percent: out > 0 ? Math.round((Number(agg.rework_qty) / out) * 1000) / 10 : 0,
                rejection_percent: out > 0 ? Math.round((Number(agg.rejection_qty) / out) * 1000) / 10 : 0,
            };
        };
        reworkTotals.total_output = Number(reworkLineAgg.total_output) || 0;
        reworkTotals.rework_percent = toReworkPercents(reworkLineAgg).rework_percent;
        reworkTotals.rejection_percent = toReworkPercents(reworkLineAgg).rejection_percent;
        const reworkOverall = toReworkPercents(reworkAllAgg);

        // Per-line rework/rejection for today (Line Performance table and the Rework dialog).
        const [reworkByLineRows] = await pool.query(`
            SELECT work_centre_id,
                   COALESCE(SUM(total_output_pairs), 0) AS total_output,
                   COALESCE(SUM(rework_qty), 0) AS rework_qty,
                   COALESCE(SUM(rejection_qty), 0) AS rejection_qty
            FROM rework_rejection
            WHERE DATE(production_date) = DATE(?)
            GROUP BY work_centre_id
        `, [today]);
        const reworkByLine = {};
        for (const row of reworkByLineRows) {
            reworkByLine[Number(row.work_centre_id)] = toReworkPercents(row);
        }

        // Multi-article line: per-article target / output / WIP (null for single-article lines).
        let lineArticles = null;
        try {
            const summary = await require('../services/articleAttributionService').getLineArticleSummary(workCentreId, today);
            lineArticles = summary.multi_article ? summary : null;
        } catch (articleErr) {
            console.warn(`Line article summary unavailable for WC ${workCentreId}: ${articleErr.message}`);
        }

        // Breakdown loss: minutes per event and total as % of available machine-minutes (480 min shift x machines on line).
        const SHIFT_MINS = 480;
        const nowMs = Date.now();
        const breakdownMins = (row) => {
            const live = Number(row.button_status) === 1;
            const startRaw = live ? (row.idle_start_time || row.start_time) : (row.start_time || row.idle_start_time);
            const start = startRaw ? new Date(startRaw).getTime() : NaN;
            const end = row.finish_time && !live ? new Date(row.finish_time).getTime() : nowMs;
            if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
            return Math.round(((end - start) / 60000) * 10) / 10;
        };
        breakdowns.forEach((row) => { row.duration_mins = breakdownMins(row); });
        const [[machineCountRow]] = await pool.query(
            'SELECT COUNT(*) AS c FROM machine_centres WHERE work_centre_id = ?',
            [workCentreId]
        );
        const breakdownTotalMins = Math.round(breakdowns.reduce((s, r) => s + r.duration_mins, 0) * 10) / 10;
        const availableMachineMins = SHIFT_MINS * Math.max(1, Number(machineCountRow.c) || 1);
        const breakdownLoss = {
            total_mins: breakdownTotalMins,
            percent: Math.round((breakdownTotalMins / availableMachineMins) * 1000) / 10,
            events: breakdowns.length,
        };

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
                WHERE DATE(plan_date) = DATE(?) AND deleted_at IS NULL
                GROUP BY work_centre_id
            ) pp ON wc.id = pp.work_centre_id
            LEFT JOIN (
                SELECT mcs.work_centre_id,
                       mcs.total_output_pairs as output,
                       mcs.total_target_mins as target_mins,
                       mcs.total_actual_mins as actual_mins
                FROM machine_centre_summary mcs
                INNER JOIN work_centres wc_eol ON wc_eol.id = mcs.work_centre_id
                WHERE DATE(mcs.prod_date) = DATE(?)
                  AND mcs.machine_id = COALESCE(NULLIF(wc_eol.eol_machine_id, ''), '07')
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
            WHERE ${activeWorkCentreWhere('wc')}
            ORDER BY (wc.sequence_no IS NULL), wc.sequence_no, wc.id
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

                // Fetch current article for this line
                const [[lineArticle]] = await pool.query(`
                    SELECT s.code AS style_code, s.name AS style_name
                    FROM line_style_assignments lsa
                    JOIN styles s ON s.id = lsa.style_id
                    WHERE lsa.work_centre_id = ? AND lsa.assignment_date <= ? AND lsa.deleted_at IS NULL
                    ORDER BY lsa.assignment_date DESC, lsa.id DESC
                    LIMIT 1
                `, [lineWcId, today]);

                return {
                    work_centre_id: lineWcId,
                    line_name: line.line_name,
                    style_code: lineArticle?.style_code || null,
                    style_name: lineArticle?.style_name || null,
                    target: Math.round(line.target || 0),
                    input: lineInput,
                    output: Math.round(lineEolOutput),
                    output_percentage: line.target > 0
                        ? Math.round((lineEolOutput / line.target) * 100)
                        : 0,
                    efficiency: Math.round(line.efficiency || 0),
                    wip: lineWip.currentWip,
                    opening_wip: lineWip.openingWip,
                };
            })
        );

        // ── 10. Build response ────────────────────────────────────────────────
        // Aggregate all-lines totals for the Overall Performance top section
        const allLinesTarget = linePerformance.reduce((sum, l) => sum + Number(l.target || 0), 0);
        const allLinesInput = linePerformance.reduce((sum, l) => sum + Number(l.input || 0), 0);
        const allLinesOutput = linePerformance.reduce((sum, l) => sum + Number(l.output || 0), 0);
        const allLinesOutputPercent = allLinesTarget > 0 ? (allLinesOutput / allLinesTarget) * 100 : 0;
        const allLinesWip = linePerformance.reduce((sum, l) => sum + Number(l.wip || 0), 0);
        const allLinesOpeningWip = linePerformance.reduce((sum, l) => sum + Number(l.opening_wip || 0), 0);

        res.json({
            success: true,
            data: {
                topSection: {
                    workCentreName: 'Overall Performance',
                    styleCode: currentArticle?.style_code || null,
                    styleName: currentArticle?.style_name || null,
                    target: Math.round(allLinesTarget),
                    input: allLinesInput,
                    output: Math.round(allLinesOutput),
                    outputPercent: Math.round(allLinesOutputPercent),
                    efficiencyPercent: Math.round(efficiencyPercent),
                    lossOfMinutes: cycleLoss.lossOfMinutes,
                    lossInactiveMins: cycleLoss.inactiveMins,
                    lossExtraMins: cycleLoss.extraMins,
                    // MES WIP fields for overall section
                    openingWip: allLinesOpeningWip,
                    currentWip: allLinesWip,
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
                    reworkOverall,
                    reworkByLine,
                    breakdownLoss,
                    lineArticles,
                    linePerformance,
                    workCentreName: wcData[0]?.name || 'N/A',
                    perLineTimeLosses: await (async () => {
                        const result = {};
                        for (const line of linePerformance) {
                            const lineWcId = Number(line.work_centre_id);
                            const lineLosses = await aggregateMachineCycleLosses(pool, lineWcId, today);

                            // Several articles on one line: split the losses per article (by routing machines)
                            // so the dashboard can show each article in its own carousel slide.
                            let articles = [];
                            try {
                                const [planArticles] = await pool.query(`
                                    SELECT a.style_id, a.total_target_per_day, s.code AS style_code, s.name AS style_name
                                    FROM production_plan pp
                                    JOIN production_plan_articles a ON a.plan_id = pp.id
                                    JOIN styles s ON s.id = a.style_id
                                    WHERE pp.work_centre_id = ? AND DATE(pp.plan_date) = DATE(?) AND pp.deleted_at IS NULL
                                    ORDER BY a.sequence_no, a.id
                                `, [lineWcId, today]);
                                if (planArticles.length > 1) {
                                    for (const art of planArticles) {
                                        const [routingMachines] = await pool.query(`
                                            SELECT prl.machine_centre_id
                                            FROM production_routing_lines prl
                                            WHERE prl.routing_header_id = (
                                                SELECT prh.id FROM production_routing_header prh
                                                WHERE prh.style_id = ? AND DATE(prh.created_on) <= DATE(?)
                                                ORDER BY prh.created_on DESC, prh.id DESC
                                                LIMIT 1
                                            )
                                            ORDER BY prl.id
                                        `, [art.style_id, today]);
                                        const machineIds = routingMachines.map((r) => String(r.machine_centre_id));
                                        const ids = new Set(machineIds);
                                        // Article output = output of its last routing machine (end of line).
                                        let artOutput = 0;
                                        if (machineIds.length > 0) {
                                            const [[outRow]] = await pool.query(
                                                `SELECT COALESCE(SUM(total_output_pairs), 0) AS output
                                                 FROM machine_centre_summary
                                                 WHERE work_centre_id = ? AND DATE(prod_date) = DATE(?) AND machine_id = ?`,
                                                [lineWcId, today, machineIds[machineIds.length - 1]]
                                            );
                                            artOutput = Number(outRow?.output || 0);
                                        }
                                        articles.push({
                                            style_id: art.style_id,
                                            style_code: art.style_code,
                                            style_name: art.style_name,
                                            target: Number(art.total_target_per_day || 0),
                                            output: artOutput,
                                            machine_ids: machineIds,
                                            losses: lineLosses.filter((l) => ids.has(String(l.machine_id))),
                                        });
                                    }
                                }
                            } catch (e) {
                                console.error('Per-article time loss split failed:', e.message);
                                articles = [];
                            }

                            result[lineWcId] = { lineName: line.line_name, losses: lineLosses, articles };
                        }
                        return result;
                    })()
                }
            }
        });
    } catch (error) {
        console.error('Error fetching TV dashboard data:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};
