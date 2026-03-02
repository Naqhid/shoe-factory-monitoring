const express = require('express');
const router = express.Router();
const pool = require('../../config/database');

// Get all work centres for rotation
exports.getWorkCentres = async (req, res) => {
    try {
        const [workCentres] = await pool.query(
            'SELECT id, name FROM work_centres ORDER BY id'
        );
        res.json({ success: true, data: workCentres });
    } catch (error) {
        console.error('Error fetching work centres:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Get TV dashboard data for a specific work centre
exports.getDashboard = async (req, res) => {
    try {
        const { workCentreId } = req.params;
        const today = req.query.date || new Date().toISOString().split('T')[0];

        // Top Section - Overall metrics (all work centres)
        const [planningData] = await pool.query(
            'SELECT SUM(total_target_per_day) as total_target FROM production_plan WHERE plan_date = ?',
            [today]
        );
        const [summaryData] = await pool.query(
            'SELECT SUM(total_output_pairs) as total_output, AVG(avg_efficiency_percent) as avg_efficiency FROM machine_centre_summary WHERE prod_date = ?',
            [today]
        );
        const [wcData] = await pool.query('SELECT name FROM work_centres WHERE id = ?', [workCentreId]);

        const target = planningData[0]?.total_target || 0;
        const output = summaryData[0]?.total_output || 0;
        const outputPercent = target > 0 ? (output / target) * 100 : 0;
        const efficiencyPercent = summaryData[0]?.avg_efficiency || 0;

        let emojiType = 'sad';
        if (outputPercent >= 90 && efficiencyPercent >= 90) emojiType = 'happy';
        else if (outputPercent >= 70 && efficiencyPercent >= 70) emojiType = 'medium';

        // Middle Section - Line wise output (filtered by work centre)
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

        // Calculate hourly output based on earliest start_time for the work centre
        const [startTimeData] = await pool.query(
            'SELECT MIN(start_time) as earliest_start FROM machine_centre_production WHERE work_centre_id = ? AND DATE(prod_date) = ? AND start_time IS NOT NULL',
            [workCentreId, today]
        );
        const earliestStart = startTimeData[0]?.earliest_start;
        let passedHours = 1;
        if (earliestStart) {
            const startTime = new Date(earliestStart);
            const now = new Date();
            const diffMs = now.getTime() - startTime.getTime();
            passedHours = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60)));
        }
        const hourlyOutput = Math.round(wcOutput / passedHours);

        // Lower Section - Hourly output graph (based on updated_at)
        const [hourlyData] = await pool.query(`
            SELECT 
                HOUR(updated_at) as hour,
                SUM(output_pairs) as output
            FROM machine_centre_production
            WHERE work_centre_id = ? 
            AND DATE(prod_date) = ?
            GROUP BY HOUR(updated_at)
            ORDER BY hour
        `, [workCentreId, today]);

        // Lower Section - Top 3 bottleneck machine centres
        const [bottlenecks] = await pool.query(`
            SELECT 
                mc.name as machine_centre_name,
                wc.name as work_centre_name,
                ROUND(mcs.avg_efficiency_percent, 1) as efficiency
            FROM machine_centre_summary mcs
            JOIN machine_centres mc ON mcs.machine_id = mc.machine_id
            JOIN work_centres wc ON mcs.work_centre_id = wc.id
            WHERE mcs.work_centre_id = ?
            AND mcs.prod_date = ?
            AND mcs.avg_efficiency_percent < 70
            ORDER BY mcs.avg_efficiency_percent ASC
            LIMIT 3
        `, [workCentreId, today]);

        res.json({
            success: true,
            data: {
                topSection: {
                    workCentreName: wcData[0]?.name || 'N/A',
                    target: Math.round(target),
                    output: Math.round(output),
                    outputPercent: Math.round(outputPercent),
                    efficiencyPercent: Math.round(efficiencyPercent),
                    showHappyEmoji: emojiType === 'happy',
                    showMediumEmoji: emojiType === 'medium'
                },
                middleSection: {
                    target: Math.round(wcTarget),
                    output: Math.round(wcOutput),
                    outputPercent: Math.round(wcOutputPercent),
                    hourlyOutput: hourlyOutput,
                    efficiencyPercent: Math.round(wcEfficiency)
                },
                lowerSection: {
                    hourlyData: hourlyData,
                    bottlenecks: bottlenecks
                }
            }
        });
    } catch (error) {
        console.error('Error fetching TV dashboard data:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};
