-- Performance Optimization Indexes
-- Run this file to add indexes for faster queries

-- Machine Centre App Indexes
CREATE INDEX IF NOT EXISTS idx_machine_date ON machine_centre_app(machine_id, prod_date);
CREATE INDEX IF NOT EXISTS idx_work_centre ON machine_centre_app(work_centre_id);
CREATE INDEX IF NOT EXISTS idx_button_status ON machine_centre_app(button_status);
CREATE INDEX IF NOT EXISTS idx_emp_id ON machine_centre_app(emp_id);
CREATE INDEX IF NOT EXISTS idx_prod_date ON machine_centre_app(prod_date);

-- Production Planning Indexes
CREATE INDEX IF NOT EXISTS idx_planning_wc_date ON production_planning(work_centre_id, plan_date);
CREATE INDEX IF NOT EXISTS idx_planning_date ON production_planning(plan_date);
CREATE INDEX IF NOT EXISTS idx_planning_style ON production_planning(style_id);

-- Production Routing Indexes
CREATE INDEX IF NOT EXISTS idx_routing_machine ON production_routing(machine_id);
CREATE INDEX IF NOT EXISTS idx_routing_style ON production_routing(style_id);
CREATE INDEX IF NOT EXISTS idx_routing_wc ON production_routing(work_centre_id);

-- Pivot Data Indexes
CREATE INDEX IF NOT EXISTS idx_pivot_machine_date ON pivot_data(machine_id, prod_date);
CREATE INDEX IF NOT EXISTS idx_pivot_date ON pivot_data(prod_date);

-- Mobile Production Indexes
CREATE INDEX IF NOT EXISTS idx_mobile_machine_date ON mobile_production(machine_id, prod_date);
CREATE INDEX IF NOT EXISTS idx_mobile_status ON mobile_production(button_status);

-- Stitching Events Indexes
CREATE INDEX IF NOT EXISTS idx_stitching_machine ON stitching_events(machine_id);
CREATE INDEX IF NOT EXISTS idx_stitching_time ON stitching_events(event_time);

-- Employees Index
CREATE INDEX IF NOT EXISTS idx_emp_code ON employees(code);
CREATE INDEX IF NOT EXISTS idx_emp_name ON employees(name);

-- Machine Centres Index
CREATE INDEX IF NOT EXISTS idx_machine_code ON machine_centres(machine_id);
CREATE INDEX IF NOT EXISTS idx_machine_wc ON machine_centres(work_centre_id);

-- Work Centres Index
CREATE INDEX IF NOT EXISTS idx_wc_name ON work_centres(work_centre_name);

-- Show created indexes
SELECT 
    TABLE_NAME,
    INDEX_NAME,
    GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS COLUMNS
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = 'shoe_factory'
    AND INDEX_NAME LIKE 'idx_%'
GROUP BY TABLE_NAME, INDEX_NAME
ORDER BY TABLE_NAME, INDEX_NAME;

-- Analyze tables for optimization
ANALYZE TABLE machine_centre_app;
ANALYZE TABLE production_planning;
ANALYZE TABLE production_routing;
ANALYZE TABLE pivot_data;
ANALYZE TABLE mobile_production;

SELECT 'Indexes created successfully!' AS status;
