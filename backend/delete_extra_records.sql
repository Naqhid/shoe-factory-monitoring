-- Delete extra records for Machine 01, Employee 165 on 2026-04-20
-- Keep only first 7 records (7 × 12 = 84 pairs), delete the rest

-- First, see what we have
SELECT id, output_pairs, created_at 
FROM machine_centre_production 
WHERE machine_id = '01' AND emp_id = '165' AND prod_date = '2026-04-20'
ORDER BY id;

-- Delete records beyond the first 7 (keeps total at 84 pairs)
DELETE FROM machine_centre_production 
WHERE id IN (
    SELECT id FROM (
        SELECT id 
        FROM machine_centre_production 
        WHERE machine_id = '01' AND emp_id = '165' AND prod_date = '2026-04-20'
        ORDER BY id 
        LIMIT 9999 OFFSET 7
    ) as temp
);

-- Recalculate summary after deletion
INSERT INTO machine_centre_summary 
    (prod_date, work_centre_id, machine_id, emp_id, total_output_pairs, total_target_mins, total_actual_mins, total_idle_mins, cum_avg_time, button_status)
SELECT 
    prod_date, work_centre_id, machine_id, emp_id,
    SUM(output_pairs), SUM(target_mins), SUM(actual_time), SUM(idle_mins),
    CASE WHEN SUM(output_pairs) > 0 THEN SUM(actual_time) / SUM(output_pairs) ELSE 0 END,
    MAX(button_status)
FROM machine_centre_production
WHERE machine_id = '01' AND emp_id = '165' AND prod_date = '2026-04-20'
GROUP BY prod_date, work_centre_id, machine_id, emp_id
ON DUPLICATE KEY UPDATE
    total_output_pairs = VALUES(total_output_pairs),
    total_target_mins = VALUES(total_target_mins),
    total_actual_mins = VALUES(total_actual_mins),
    total_idle_mins = VALUES(total_idle_mins),
    cum_avg_time = VALUES(cum_avg_time),
    button_status = VALUES(button_status),
    updated_at = CURRENT_TIMESTAMP;

-- Verify
SELECT * FROM machine_centre_summary 
WHERE machine_id = '01' AND emp_id = '165' AND prod_date = '2026-04-20';
