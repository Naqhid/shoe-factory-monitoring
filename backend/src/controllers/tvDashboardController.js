const pool = require('../../config/database');

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

        const [rows] = await pool.query(`
            SELECT
                mc.id              AS machine_centre_id,
                mc.name            AS machine_centre_name,
                COALESCE(mc.machine_name, mc.name) AS machine_name,
                mc.machine_id,
                COALESCE(mcs.total_output_pairs, 0) AS total_output_pairs,
                COALESCE(
                    (SELECT ROUND(SUM(prl.mins_12_prs_box), 2)
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
            LEFT JOIN machine_centre_summary mcs
                ON mcs.machine_id = mc.machine_id
                AND DATE(mcs.prod_date) = ?
                AND mcs.work_centre_id = ?
            LEFT JOIN mobile_sessions ms
                ON ms.machine_id = mc.machine_id
                AND ms.work_centre_id = ?
                AND ms.status = 'active'
                AND DATE(ms.activated_at) = ?
            LEFT JOIN employees e ON e.id = ms.emp_id
            WHERE (mc.work_centre_id = ? OR mcs.work_centre_id = ?)
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

        const [planningData] = await pool.query(
            'SELECT SUM(total_target_per_day) as total_target FROM production_plan WHERE plan_date = ? AND work_centre_id = ?',
            [today, workCentreId]
        );
        // Get output from Machine 07 (Final Inspection) for Line 2A
        const [summaryData] = await pool.query(`
            SELECT COALESCE(total_output_pairs, 0) as total_output 
                 , COALESCE(avg_efficiency_percent, 0) as eol_efficiency_percent
            FROM machine_centre_summary 
            WHERE prod_date = ? AND work_centre_id = ? AND machine_id = '07'
            LIMIT 1
        `, [today, workCentreId]);
        const finalOutput = summaryData[0]?.total_output || 0;
        const [wcData] = await pool.query('SELECT name FROM work_centres WHERE id = ?', [workCentreId]);

        const target = planningData[0]?.total_target || 0;
        const output = finalOutput;
        const outputPercent = target > 0 ? (output / target) * 100 : 0;
        // Keep efficiency basis aligned with output basis (end-of-line machine 07)
        const efficiencyPercent = summaryData[0]?.eol_efficiency_percent || 0;

        let emojiType = 'sad';
        if (outputPercent >= 90 && efficiencyPercent >= 90) emojiType = 'happy';
        else if (outputPercent >= 70 && efficiencyPercent >= 70) emojiType = 'medium';

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

        const wcTarget = wcPlanningData[0]?.target || 0;
        const wcOutput = wcSummaryData[0]?.output || 0;
        const wcOutputPercent = wcTarget > 0 ? (wcOutput / wcTarget) * 100 : 0;
        const wcEfficiency = wcSummaryData[0]?.avg_efficiency || 0;

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

        const [bottlenecks] = await pool.query(`
            SELECT 
                mc.name as machine_centre_name,
                wc.name as work_centre_name,
                ROUND(
                    CASE
                        WHEN COALESCE(SUM(p.output_pairs), 0) = 0 THEN 0
                        WHEN SUM(TIMESTAMPDIFF(MINUTE, p.start_time, p.finish_time)) > 0
                            THEN (SUM(p.target_mins) / SUM(TIMESTAMPDIFF(MINUTE, p.start_time, p.finish_time))) * 100
                        ELSE 0
                    END, 1
                ) as efficiency,
                GREATEST(0, COALESCE(pp.total_target_per_day, 0) - COALESCE(SUM(p.output_pairs), 0)) as wip,
                COALESCE(SUM(p.output_pairs), 0) as output
            FROM machine_centres mc
            JOIN work_centres wc ON mc.work_centre_id = wc.id
            JOIN machine_centre_production p
                ON p.machine_id = mc.machine_id
                AND p.work_centre_id = mc.work_centre_id
                AND DATE(p.prod_date) = DATE(?)
                AND p.button_status = 2
                AND TIMESTAMPDIFF(MINUTE, p.start_time, p.finish_time) <= 510
            LEFT JOIN production_plan pp
                ON mc.work_centre_id = pp.work_centre_id
                AND DATE(pp.plan_date) = DATE(?)
            WHERE mc.work_centre_id = ?
              AND mc.deleted_at IS NULL
              AND COALESCE(mc.is_active, 1) = 1
            GROUP BY mc.id, mc.name, wc.name, pp.total_target_per_day
            HAVING
                SUM(p.output_pairs) = 0
                OR (SUM(TIMESTAMPDIFF(MINUTE, p.start_time, p.finish_time)) > 0
                    AND (SUM(p.target_mins) / SUM(TIMESTAMPDIFF(MINUTE, p.start_time, p.finish_time))) * 100 < 70)
            ORDER BY efficiency ASC
            LIMIT 3
        `, [today, today, workCentreId]);

        const [linePerformance] = await pool.query(`
            SELECT 
                wc.id as work_centre_id,
                wc.name as line_name,
                COALESCE(pp.target, 0) as target,
                -- For Line 2A (id=5), use Machine 07 output; for others, sum all machines
                COALESCE(CASE WHEN wc.id = 5 THEN mcs07.output ELSE mcsall.output END, 0) as output,
                CASE WHEN COALESCE(pp.target, 0) > 0 THEN ROUND((COALESCE(CASE WHEN wc.id = 5 THEN mcs07.output ELSE mcsall.output END, 0) / pp.target) * 100, 0) ELSE 0 END as output_percentage,
                CASE
                    WHEN COALESCE(CASE WHEN wc.id = 5 THEN mcs07.output ELSE mcsall.output END, 0) <= 0 THEN 0
                    WHEN COALESCE(CASE WHEN wc.id = 5 THEN mcs07.actual_mins ELSE mcsall.actual_mins END, 0) > 0
                        THEN ROUND((COALESCE(CASE WHEN wc.id = 5 THEN mcs07.target_mins ELSE mcsall.target_mins END, 0) / COALESCE(CASE WHEN wc.id = 5 THEN mcs07.actual_mins ELSE mcsall.actual_mins END, 0)) * 100, 0)
                    ELSE 0
                END as efficiency,
                GREATEST(0, COALESCE(pp.target, 0) - COALESCE(CASE WHEN wc.id = 5 THEN mcs07.output ELSE mcsall.output END, 0)) as wip
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

        res.json({
            success: true,
            data: {
                topSection: {
                    workCentreName: 'Overall Performance',
                    target: Math.round(target),
                    output: Math.round(output),
                    outputPercent: Math.round(outputPercent),
                    efficiencyPercent: Math.round(efficiencyPercent),
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
                    linePerformance: linePerformance.map(line => ({
                        work_centre_id: line.work_centre_id,
                        line_name: line.line_name,
                        target: Math.round(line.target || 0),
                        output: Math.round(line.output || 0),
                        output_percentage: Math.round(line.output_percentage || 0),
                        efficiency: Math.round(line.efficiency || 0),
                        wip: Math.round(line.wip || 0)
                    })),
                    workCentreName: wcData[0]?.name || 'N/A'
                }
            }
        });
    } catch (error) {
        console.error('Error fetching TV dashboard data:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};
