-- Sample data for Production Tracker Dashboard
-- Run this after setting up production_planning and prod_data tables

-- Insert sample production planning for today
INSERT INTO production_planning (plan_date, work_centre_id, routing_id, target_pairs, created_at)
VALUES 
  (CURDATE(), 1, 1, 500, NOW()),
  (CURDATE(), 2, 2, 450, NOW());

-- Get the planning IDs (adjust these based on your actual IDs)
SET @planning_id_1 = LAST_INSERT_ID();
SET @planning_id_2 = @planning_id_1 + 1;

-- Insert sample production data for today (hourly data)
INSERT INTO prod_data (planning_id, prod_date, emp_id, machine_id, work_centre_id, output_pairs, target_pairs, idle_stop_time, stoppage_reason, created_at)
VALUES
  -- Hour 8 AM
  (@planning_id_1, CURDATE(), 1, 'M-001', 1, 45, 50, 0, NULL, CONCAT(CURDATE(), ' 08:30:00')),
  (@planning_id_1, CURDATE(), 2, 'M-002', 1, 42, 50, 5, 'Material Shortage', CONCAT(CURDATE(), ' 08:45:00')),
  
  -- Hour 9 AM
  (@planning_id_1, CURDATE(), 1, 'M-001', 1, 48, 50, 0, NULL, CONCAT(CURDATE(), ' 09:30:00')),
  (@planning_id_1, CURDATE(), 2, 'M-002', 1, 50, 50, 0, NULL, CONCAT(CURDATE(), ' 09:45:00')),
  (@planning_id_1, CURDATE(), 3, 'M-003', 1, 40, 50, 10, 'Machine Breakdown', CONCAT(CURDATE(), ' 09:50:00')),
  
  -- Hour 10 AM
  (@planning_id_1, CURDATE(), 1, 'M-001', 1, 50, 50, 0, NULL, CONCAT(CURDATE(), ' 10:30:00')),
  (@planning_id_1, CURDATE(), 2, 'M-002', 1, 47, 50, 3, 'Power Cut', CONCAT(CURDATE(), ' 10:45:00')),
  (@planning_id_1, CURDATE(), 3, 'M-003', 1, 45, 50, 5, 'Material Shortage', CONCAT(CURDATE(), ' 10:50:00')),
  
  -- Hour 11 AM
  (@planning_id_1, CURDATE(), 1, 'M-001', 1, 52, 50, 0, NULL, CONCAT(CURDATE(), ' 11:30:00')),
  (@planning_id_1, CURDATE(), 2, 'M-002', 1, 48, 50, 2, 'Quality Issue', CONCAT(CURDATE(), ' 11:45:00')),
  (@planning_id_1, CURDATE(), 3, 'M-003', 1, 50, 50, 0, NULL, CONCAT(CURDATE(), ' 11:50:00')),
  
  -- Hour 1 PM (13:00)
  (@planning_id_1, CURDATE(), 1, 'M-001', 1, 46, 50, 4, 'Material Shortage', CONCAT(CURDATE(), ' 13:30:00')),
  (@planning_id_1, CURDATE(), 2, 'M-002', 1, 50, 50, 0, NULL, CONCAT(CURDATE(), ' 13:45:00')),
  (@planning_id_1, CURDATE(), 3, 'M-003', 1, 48, 50, 2, 'Machine Breakdown', CONCAT(CURDATE(), ' 13:50:00')),
  
  -- Hour 2 PM (14:00)
  (@planning_id_1, CURDATE(), 1, 'M-001', 1, 50, 50, 0, NULL, CONCAT(CURDATE(), ' 14:30:00')),
  (@planning_id_1, CURDATE(), 2, 'M-002', 1, 49, 50, 1, 'Power Cut', CONCAT(CURDATE(), ' 14:45:00')),
  (@planning_id_1, CURDATE(), 3, 'M-003', 1, 50, 50, 0, NULL, CONCAT(CURDATE(), ' 14:50:00'));

-- Insert yesterday's data for comparison
INSERT INTO production_planning (plan_date, work_centre_id, routing_id, target_pairs, created_at)
VALUES 
  (DATE_SUB(CURDATE(), INTERVAL 1 DAY), 1, 1, 500, DATE_SUB(NOW(), INTERVAL 1 DAY));

SET @yesterday_planning_id = LAST_INSERT_ID();

INSERT INTO prod_data (planning_id, prod_date, emp_id, machine_id, work_centre_id, output_pairs, target_pairs, created_at)
VALUES
  (@yesterday_planning_id, DATE_SUB(CURDATE(), INTERVAL 1 DAY), 1, 'M-001', 1, 420, 500, DATE_SUB(NOW(), INTERVAL 1 DAY));

-- Insert last week's data for comparison
INSERT INTO production_planning (plan_date, work_centre_id, routing_id, target_pairs, created_at)
VALUES 
  (DATE_SUB(CURDATE(), INTERVAL 7 DAY), 1, 1, 500, DATE_SUB(NOW(), INTERVAL 7 DAY));

SET @lastweek_planning_id = LAST_INSERT_ID();

INSERT INTO prod_data (planning_id, prod_date, emp_id, machine_id, work_centre_id, output_pairs, target_pairs, created_at)
VALUES
  (@lastweek_planning_id, DATE_SUB(CURDATE(), INTERVAL 7 DAY), 1, 'M-001', 1, 400, 500, DATE_SUB(NOW(), INTERVAL 7 DAY));

SELECT 'Sample production tracker data inserted successfully!' as message;
