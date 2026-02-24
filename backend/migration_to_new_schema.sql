-- Migration Script: Old Schema to New Schema
-- This script migrates data from prod_data/pivot_data to machine_centre_production/machine_centre_summary

-- Step 1: Backup existing tables (optional but recommended)
CREATE TABLE IF NOT EXISTS prod_data_backup AS SELECT * FROM prod_data;
CREATE TABLE IF NOT EXISTS pivot_data_backup AS SELECT * FROM pivot_data;

-- Step 2: Migrate data from prod_data to machine_centre_production
INSERT INTO machine_centre_production (
    prod_date,
    work_centre_id,
    machine_id,
    emp_id,
    output_pairs,
    target_mins,
    start_time,
    finish_time,
    idle_start_time,
    idle_stop_time,
    button_status,
    created_at,
    updated_at
)
SELECT 
    prod_date,
    work_centre_id,
    machine_id,
    emp_id,
    COALESCE(output_pairs, 12) as output_pairs,
    COALESCE(target_mins, 0) as target_mins,
    CASE 
        WHEN start_time IS NOT NULL THEN CONCAT(prod_date, ' ', start_time)
        ELSE NULL
    END as start_time,
    CASE 
        WHEN finish_time IS NOT NULL THEN CONCAT(prod_date, ' ', finish_time)
        ELSE NULL
    END as finish_time,
    NULL as idle_start_time,
    NULL as idle_stop_time,
    COALESCE(button_status, 1) as button_status,
    created_at,
    updated_at
FROM prod_data
WHERE NOT EXISTS (
    SELECT 1 FROM machine_centre_production mcp 
    WHERE mcp.prod_date = prod_data.prod_date 
    AND mcp.machine_id = prod_data.machine_id
    AND mcp.emp_id = prod_data.emp_id
);

-- Step 3: The summary table will be auto-populated by triggers
-- But we can manually populate it for existing data

INSERT INTO machine_centre_summary (
    prod_date,
    work_centre_id,
    machine_id,
    emp_id,
    total_output_pairs,
    total_target_mins,
    total_actual_mins,
    total_idle_mins,
    avg_efficiency_percent,
    cum_avg_time,
    button_status
)
SELECT 
    prod_date,
    work_centre_id,
    machine_id,
    emp_id,
    SUM(output_pairs) as total_output_pairs,
    SUM(target_mins) as total_target_mins,
    SUM(actual_time) as total_actual_mins,
    SUM(idle_mins) as total_idle_mins,
    CASE 
        WHEN SUM(target_mins) > 0 THEN (SUM(actual_time) / SUM(target_mins)) * 100
        ELSE 0
    END as avg_efficiency_percent,
    SUM(actual_time) / 12 as cum_avg_time,
    MAX(button_status) as button_status
FROM machine_centre_production
GROUP BY prod_date, work_centre_id, machine_id, emp_id
ON DUPLICATE KEY UPDATE
    total_output_pairs = VALUES(total_output_pairs),
    total_target_mins = VALUES(total_target_mins),
    total_actual_mins = VALUES(total_actual_mins),
    total_idle_mins = VALUES(total_idle_mins),
    avg_efficiency_percent = VALUES(avg_efficiency_percent),
    cum_avg_time = VALUES(cum_avg_time),
    button_status = VALUES(button_status);

-- Step 4: Verify migration
SELECT 'prod_data count:' as info, COUNT(*) as count FROM prod_data
UNION ALL
SELECT 'machine_centre_production count:', COUNT(*) FROM machine_centre_production
UNION ALL
SELECT 'pivot_data count:', COUNT(*) FROM pivot_data
UNION ALL
SELECT 'machine_centre_summary count:', COUNT(*) FROM machine_centre_summary;

-- Step 5: After verification, you can optionally drop old tables
-- UNCOMMENT THESE LINES ONLY AFTER VERIFYING DATA MIGRATION
-- DROP TABLE IF EXISTS prod_data;
-- DROP TABLE IF EXISTS pivot_data;
