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
        const today = new Date().toISOString().split('T')[0];

        // Top Section - Overall metrics
        const [topSection] = await pool.query(`
            SELECT 
                wc.name as work_centre_name,
                COALESCE(SUM(pp.target_pairs_per_tray), 0) as total_target,
                COALESCE(SUM(mcs.total_output_pairs), 0) as total_output,
                COALESCE(SUM(mcs.total_target_mins), 0) as total_target_mins,
                COALESCE(SUM(mcs.total_actual_mins), 0) as total_actual_mins
            FROM work_centres wc
            LEFT JOIN production_plan pp ON wc.id = pp.work_centre_id AND pp.plan_date = ?
            LEFT JOIN machine_centre_summary mcs ON wc.id = mcs.work_centre_id AND mcs.prod_date = ?
            WHERE wc.id = ?
            GROUP BY wc.id, wc.name
        `, [today, today, workCentreId]);

        const topData = topSection[0] || {};
        const outputPercent = topData.total_target > 0 ? (topData.total_output / topData.total_target * 100).toFixed(1) : 0;
        const efficiencyPercent = topData.total_actual_mins > 0 ? (topData.total_target_mins / topData.total_actual_mins * 100).toFixed(1) : 0;

        // Middle Section - Line wise output
        const [middleSection] = await pool.query(`
            SELECT 
                COALESCE(SUM(pp.target_pairs_per_tray), 0) as target,
                COALESCE(SUM(mcs.total_output_pairs), 0) as output,
                COALESCE(SUM(mcs.total_target_mins), 0) as target_mins,
                COALESCE(SUM(mcs.total_actual_mins), 0) as actual_mins
            FROM work_centres wc
            LEFT JOIN production_plan pp ON wc.id = pp.work_centre_id AND pp.plan_date = ?
            LEFT JOIN machine_centre_summary mcs ON wc.id = mcs.work_centre_id AND mcs.prod_date = ?
            WHERE wc.id = ?
        `, [today, today, workCentreId]);

        const middleData = middleSection[0] || {};
        const lineOutputPercent = middleData.target > 0 ? (middleData.output / middleData.target * 100).toFixed(1) : 0;
        const lineEfficiency = middleData.actual_mins > 0 ? (middleData.target_mins / middleData.actual_mins * 100).toFixed(1) : 0;
        
        // Calculate hourly output
        const currentHour = new Date().getHours();
        const startHour = 8;
        const passedHours = Math.max(1, currentHour - startHour + 1);
        const hourlyOutput = middleData.output > 0 ? (middleData.output / passedHours).toFixed(0) : 0;

        // Lower Section - Hourly output graph data
        const [hourlyData] = await pool.query(`
            SELECT 
                HOUR(created_at) as hour,
                SUM(output_pairs) as output
            FROM machine_centre_production
            WHERE work_centre_id = ? 
            AND DATE(prod_date) = ?
            AND HOUR(created_at) >= 8 
            AND HOUR(created_at) <= 17
            GROUP BY HOUR(created_at)
            ORDER BY hour
        `, [workCentreId, today]);

        // Lower Section - Top 3 bottleneck machine centres
        const [bottlenecks] = await pool.query(`
            SELECT 
                mc.name as machine_centre_name,
                wc.name as work_centre_name,
                mcs.avg_efficiency_percent as efficiency
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
                    workCentreName: topData.work_centre_name || 'N/A',
                    dateTime: new Date().toISOString(),
                    target: topData.total_target,
                    output: topData.total_output,
                    outputPercent: parseFloat(outputPercent),
                    efficiencyPercent: parseFloat(efficiencyPercent),
                    showHappyEmoji: outputPercent >= 90 && efficiencyPercent >= 90
                },
                middleSection: {
                    target: middleData.target,
                    output: middleData.output,
                    outputPercent: parseFloat(lineOutputPercent),
                    hourlyOutput: parseInt(hourlyOutput),
                    efficiencyPercent: parseFloat(lineEfficiency)
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
