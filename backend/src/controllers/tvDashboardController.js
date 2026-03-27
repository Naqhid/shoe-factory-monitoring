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
                mc.machine_id,
                COALESCE(mcs.total_output_pairs, 0) AS total_output_pairs,
                COALESCE(pp.total_target_per_day, 12) AS target_pairs
            FROM machine_centres mc
            LEFT JOIN machine_centre_summary mcs
                ON mcs.machine_id = mc.machine_id
                AND DATE(mcs.prod_date) = ?
                AND mcs.work_centre_id = ?
            LEFT JOIN production_plan pp
                ON pp.work_centre_id = ?
                AND DATE(pp.plan_date) = ?
            WHERE mc.work_centre_id = ?
            ORDER BY mc.code
        `, [date, workCentreId, workCentreId, date, workCentreId]);

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
            'SELECT SUM(total_target_per_day) as total_target FROM production_plan WHERE plan_date = ?',
            [today]
        );
        const [summaryData] = await pool.query(
            'SELECT SUM(total_output_pairs) as total_output FROM machine_centre_summary WHERE prod_date = ?',
            [today]
        );
        const [overallEfficiency] = await pool.query(`
            SELECT (SUM(total_target_mins) / (SUM(total_actual_mins) + SUM(total_idle_mins))) * 100 AS overall_efficiency_percent
            FROM machine_centre_summary WHERE prod_date = ?
        `, [today]);
        const [wcData] = await pool.query('SELECT name FROM work_centres WHERE id = ?', [workCentreId]);

        const target = planningData[0]?.total_target || 0;
        const output = summaryData[0]?.total_output || 0;
        const outputPercent = target > 0 ? (output / target) * 100 : 0;
        const efficiencyPercent = overallEfficiency[0]?.overall_efficiency_percent || 0;

        let emojiType = 'sad';
        if (outputPercent >= 90 && efficiencyPercent >= 90) emojiType = 'happy';
        else if (outputPercent >= 70 && efficiencyPercent >= 70) emojiType = 'medium';

        const [wcPlanningData] = await pool.query(
            'SELECT SUM(total_target_per_day) as target FROM production_plan WHERE plan_date = ? AND work_centre_id = ?',
            [today, workCentreId]
        );
        const [wcSummaryData] = await pool.query(
            'SELECT SUM(total_output_pairs) as output, AVG(avg_efficiency_percent) as avg_efficiency FROM machine_centre_summary WHERE prod_date = ? AND work_centre_id = ?',
            [today, workCentreId]
        );

        const wcTarget = wcPlanningData[0]?.target || 0;
        const wcOutput = wcSummaryData[0]?.output || 0;
        const wcOutputPercent = wcTarget > 0 ? (wcOutput / wcTarget) * 100 : 0;
        const wcEfficiency = wcSummaryData[0]?.avg_efficiency || 0;

        const [attendanceTarget] = await pool.query(`
            SELECT COALESCE(SUM(prl.manpower), 0) as target_employees
            FROM production_plan pp
            JOIN production_routing_header prh ON pp.style_id = prh.style_id
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
                WHERE DATE(created_at) = ? AND work_centre_id = ?
                GROUP BY HOUR(created_at)
            ) AS hourly_data
        `, [today, workCentreId]);
        const hourlyOutput = Math.round(avgHourlyData[0]?.avg_hourly_output || 0);

        const [hourlyData] = await pool.query(`
            SELECT HOUR(updated_at) as hour, SUM(output_pairs) as output
            FROM machine_centre_production
            WHERE work_centre_id = ? AND DATE(prod_date) = ?
            GROUP BY HOUR(updated_at)
            ORDER BY hour
        `, [workCentreId, today]);

        const [bottlenecks] = await pool.query(`
            SELECT 
                mc.name as machine_centre_name,
                wc.name as work_centre_name,
                ROUND(mcs.avg_efficiency_percent, 1) as efficiency,
                GREATEST(0, COALESCE(pp.total_target_per_day, 0) - COALESCE(mcs.total_output_pairs, 0)) as wip
            FROM machine_centre_summary mcs
            JOIN machine_centres mc ON mcs.machine_id = mc.machine_id
            JOIN work_centres wc ON mcs.work_centre_id = wc.id
            LEFT JOIN production_plan pp ON mcs.work_centre_id = pp.work_centre_id AND DATE(pp.plan_date) = DATE(?)
            WHERE mcs.work_centre_id = ? AND mcs.prod_date = ? AND mcs.avg_efficiency_percent < 70
            ORDER BY mcs.avg_efficiency_percent ASC
            LIMIT 3
        `, [today, workCentreId, today]);

        const [linePerformance] = await pool.query(`
            SELECT 
                wc.id as work_centre_id,
                wc.name as line_name,
                COALESCE(SUM(pp.total_target_per_day), 0) as target,
                COALESCE(SUM(mcs.total_output_pairs), 0) as output,
                CASE WHEN SUM(pp.total_target_per_day) > 0 THEN ROUND((SUM(mcs.total_output_pairs) / SUM(pp.total_target_per_day)) * 100, 0) ELSE 0 END as output_percentage,
                ROUND(AVG(mcs.avg_efficiency_percent), 0) as efficiency,
                GREATEST(0, COALESCE(SUM(pp.total_target_per_day), 0) - COALESCE(SUM(mcs.total_output_pairs), 0)) as wip
            FROM work_centres wc
            LEFT JOIN production_plan pp ON wc.id = pp.work_centre_id AND DATE(pp.plan_date) = DATE(?)
            LEFT JOIN machine_centre_summary mcs ON wc.id = mcs.work_centre_id AND DATE(mcs.prod_date) = DATE(?)
            GROUP BY wc.id, wc.name
            ORDER BY wc.id
        `, [today, today]);

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
