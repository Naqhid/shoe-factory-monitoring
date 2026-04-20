-- Fix machine_centre_summary totals for Machine 01, Employee 165 on 2026-04-20
-- First, check current production records
SELECT 
    id,
    machine_id,
    emp_id,
    output_pairs,
    target_mins,
    actual_time,
    button_status,
    created_at,
    updated_at
FROM machine_centre_production
WHERE machine_id = '01' 
  AND emp_id = '165'
  AND prod_date = '2026-04-20'
ORDER BY id;

-- Calculate what the summary SHOULD be
SELECT 
    COUNT(*) as total_cycles,
    SUM(output_pairs) as correct_total_output,
    SUM(target_mins) as correct_total_target,
    SUM(actual_time) as correct_total_actual,
    SUM(idle_mins) as correct_total_idle
FROM machine_centre_production
WHERE machine_id = '01' 
  AND emp_id = '165'
  AND prod_date = '2026-04-20';

-- Update the summary with correct totals (replace XXX with actual calculated values)
-- UPDATE machine_centre_summary 
-- SET 
--     total_output_pairs = 84,
--     total_target_mins = (SELECT SUM(target_mins) FROM machine_centre_production WHERE machine_id = '01' AND emp_id = '165' AND prod_date = '2026-04-20'),
--     total_actual_mins = (SELECT SUM(actual_time) FROM machine_centre_production WHERE machine_id = '01' AND emp_id = '165' AND prod_date = '2026-04-20'),
--     total_idle_mins = (SELECT SUM(idle_mins) FROM machine_centre_production WHERE machine_id = '01' AND emp_id = '165' AND prod_date = '2026-04-20'),
--     cum_avg_time = (SELECT SUM(actual_time) / SUM(output_pairs) FROM machine_centre_production WHERE machine_id = '01' AND emp_id = '165' AND prod_date = '2026-04-20'),
--     updated_at = CURRENT_TIMESTAMP
-- WHERE machine_id = '01' 
--   AND emp_id = '165'
--   AND prod_date = '2026-04-20';

-- Or use this INSERT...ON DUPLICATE KEY UPDATE to completely recalculate
INSERT INTO machine_centre_summary 
    (prod_date, work_centre_id, machine_id, emp_id, total_output_pairs, total_target_mins, total_actual_mins, total_idle_mins, cum_avg_time, button_status)
SELECT 
    prod_date,
    work_centre_id,
    machine_id,
    emp_id,
    SUM(output_pairs),
    SUM(target_mins),
    SUM(actual_time),
    SUM(idle_mins),
    CASE WHEN SUM(output_pairs) > 0 THEN SUM(actual_time) / SUM(output_pairs) ELSE 0 END,
    MAX(button_status)
FROM machine_centre_production
WHERE machine_id = '01' 
  AND emp_id = '165'
  AND prod_date = '2026-04-20'
GROUP BY prod_date, work_centre_id, machine_id, emp_id
ON DUPLICATE KEY UPDATE
    total_output_pairs = VALUES(total_output_pairs),
    total_target_mins = VALUES(total_target_mins),
    total_actual_mins = VALUES(total_actual_mins),
    total_idle_mins = VALUES(total_idle_mins),
    cum_avg_time = VALUES(cum_avg_time),
    button_status = VALUES(button_status),
    updated_at = CURRENT_TIMESTAMP;

-- Verify the fix
SELECT * FROM machine_centre_summary 
WHERE machine_id = '01' 
  AND emp_id = '165'
  AND prod_date = '2026-04-20';
