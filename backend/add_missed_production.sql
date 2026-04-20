-- Add missed production data for 9:00-10:30 AM, April 20, 2026
-- Machine 01 - S. Mythi (165) - 2 bins (24 pairs total)
INSERT INTO machine_centre_production 
  (prod_date, work_centre_id, machine_id, emp_id, output_pairs, target_mins,
   start_time, finish_time, button_status, actual_time, idle_mins)
VALUES 
  ('2026-04-20', 2, '01', 165, 12, 28.2, '2026-04-20 09:00:00', '2026-04-20 09:45:00', 2, 45, 0),
  ('2026-04-20', 2, '01', 165, 12, 28.2, '2026-04-20 09:45:00', '2026-04-20 10:30:00', 2, 45, 0);

-- Machine 06 - P. Poornima (724) - 2 bins (24 pairs total)
INSERT INTO machine_centre_production 
  (prod_date, work_centre_id, machine_id, emp_id, output_pairs, target_mins,
   start_time, finish_time, button_status, actual_time, idle_mins)
VALUES 
  ('2026-04-20', 2, '06', 724, 12, 28.2, '2026-04-20 09:00:00', '2026-04-20 09:45:00', 2, 45, 0),
  ('2026-04-20', 2, '06', 724, 12, 28.2, '2026-04-20 09:45:00', '2026-04-20 10:30:00', 2, 45, 0);

-- Update summary for Machine 01 (S. Mythi - 24 pairs, 90 actual mins)
INSERT INTO machine_centre_summary 
  (prod_date, work_centre_id, machine_id, emp_id, total_output_pairs, total_target_mins, 
   total_actual_mins, total_idle_mins, avg_efficiency_percent, cum_avg_time, button_status)
VALUES 
  ('2026-04-20', 2, '01', 165, 24, 56.4, 90, 0, 
   ROUND((56.4 / 90) * 100, 1), ROUND(90 / 12, 2), 2)
ON DUPLICATE KEY UPDATE
  total_output_pairs = VALUES(total_output_pairs),
  total_target_mins = VALUES(total_target_mins),
  total_actual_mins = VALUES(total_actual_mins),
  total_idle_mins = VALUES(total_idle_mins),
  avg_efficiency_percent = VALUES(avg_efficiency_percent),
  cum_avg_time = VALUES(cum_avg_time),
  button_status = VALUES(button_status),
  updated_at = CURRENT_TIMESTAMP;

-- Update summary for Machine 06 (P. Poornima - 24 pairs, 90 actual mins)
INSERT INTO machine_centre_summary 
  (prod_date, work_centre_id, machine_id, emp_id, total_output_pairs, total_target_mins, 
   total_actual_mins, total_idle_mins, avg_efficiency_percent, cum_avg_time, button_status)
VALUES 
  ('2026-04-20', 2, '06', 724, 24, 56.4, 90, 0,
   ROUND((56.4 / 90) * 100, 1), ROUND(90 / 12, 2), 2)
ON DUPLICATE KEY UPDATE
  total_output_pairs = VALUES(total_output_pairs),
  total_target_mins = VALUES(total_target_mins),
  total_actual_mins = VALUES(total_actual_mins),
  total_idle_mins = VALUES(total_idle_mins),
  avg_efficiency_percent = VALUES(avg_efficiency_percent),
  cum_avg_time = VALUES(cum_avg_time),
  button_status = VALUES(button_status),
  updated_at = CURRENT_TIMESTAMP;
