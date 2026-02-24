-- TABLE 1: machine_centre_production (Detail Table – Per 12 Pairs Entry)
-- This table stores raw production entries. Each record represents production data for each 12 pairs.

CREATE TABLE IF NOT EXISTS machine_centre_production (
    id INT AUTO_INCREMENT PRIMARY KEY,
    prod_date DATE NOT NULL,
    work_centre_id INT NOT NULL,
    machine_id VARCHAR(100) NOT NULL,
    emp_id VARCHAR(10) NOT NULL,
    output_pairs INT DEFAULT 12 COMMENT 'Output pairs (normally 12 per entry)',
    target_mins DECIMAL(10,2) NOT NULL COMMENT 'Target time in minutes',
    start_time DATETIME NULL COMMENT 'Production Start Time',
    finish_time DATETIME NULL COMMENT 'Production Finish Time',
    idle_start_time DATETIME NULL COMMENT 'Idle Start Time',
    idle_stop_time DATETIME NULL COMMENT 'Idle Stop Time',
    actual_time DECIMAL(10,2) GENERATED ALWAYS AS (
        CASE 
            WHEN finish_time IS NOT NULL AND start_time IS NOT NULL 
            THEN TIMESTAMPDIFF(MINUTE, start_time, finish_time)
            ELSE 0
        END
    ) STORED COMMENT 'Calculated: finish_time - start_time',
    idle_mins DECIMAL(10,2) GENERATED ALWAYS AS (
        CASE 
            WHEN idle_stop_time IS NOT NULL AND idle_start_time IS NOT NULL 
            THEN TIMESTAMPDIFF(MINUTE, idle_start_time, idle_stop_time)
            ELSE 0
        END
    ) STORED COMMENT 'Calculated: idle_stop_time - idle_start_time',
    button_status INT DEFAULT 1 COMMENT '1 = Start / 2 = Finish / 3 = Stop',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_prod_date (prod_date),
    INDEX idx_machine_id (machine_id),
    INDEX idx_work_centre (work_centre_id),
    INDEX idx_status (button_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Raw production entries - per 12 pairs';

-- TABLE 2: machine_centre_summary (Pivot / Summary Table)
-- This table summarizes data from machine_centre_production

CREATE TABLE IF NOT EXISTS machine_centre_summary (
    id INT AUTO_INCREMENT PRIMARY KEY,
    prod_date DATE NOT NULL,
    work_centre_id INT NOT NULL,
    machine_id VARCHAR(100) NOT NULL,
    emp_id VARCHAR(10) NOT NULL,
    total_output_pairs INT DEFAULT 0 COMMENT 'SUM(output_pairs)',
    total_target_mins DECIMAL(10,2) DEFAULT 0 COMMENT 'SUM(target_mins)',
    total_actual_mins DECIMAL(10,2) DEFAULT 0 COMMENT 'SUM(actual_time)',
    total_idle_mins DECIMAL(10,2) DEFAULT 0 COMMENT 'SUM(idle_mins)',
    avg_efficiency_percent DECIMAL(5,2) DEFAULT 0 COMMENT '(total_actual_mins / total_target_mins) * 100',
    cum_avg_time DECIMAL(10,2) DEFAULT 0 COMMENT 'total_actual_mins / 12',
    button_status INT DEFAULT 1 COMMENT 'Latest status (1/2/3)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_summary (prod_date, work_centre_id, machine_id, emp_id),
    INDEX idx_summary_date (prod_date),
    INDEX idx_summary_machine (machine_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Summary/Pivot table aggregated from machine_centre_production';

-- Trigger to auto-update summary table after insert on production table
DELIMITER $$

CREATE TRIGGER after_production_insert
AFTER INSERT ON machine_centre_production
FOR EACH ROW
BEGIN
    INSERT INTO machine_centre_summary (
        prod_date, work_centre_id, machine_id, emp_id,
        total_output_pairs, total_target_mins, total_actual_mins, total_idle_mins,
        avg_efficiency_percent, cum_avg_time, button_status
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
    WHERE prod_date = NEW.prod_date
        AND work_centre_id = NEW.work_centre_id
        AND machine_id = NEW.machine_id
        AND emp_id = NEW.emp_id
    GROUP BY prod_date, work_centre_id, machine_id, emp_id
    ON DUPLICATE KEY UPDATE
        total_output_pairs = VALUES(total_output_pairs),
        total_target_mins = VALUES(total_target_mins),
        total_actual_mins = VALUES(total_actual_mins),
        total_idle_mins = VALUES(total_idle_mins),
        avg_efficiency_percent = VALUES(avg_efficiency_percent),
        cum_avg_time = VALUES(cum_avg_time),
        button_status = VALUES(button_status),
        updated_at = CURRENT_TIMESTAMP;
END$$

-- Trigger to auto-update summary table after update on production table
CREATE TRIGGER after_production_update
AFTER UPDATE ON machine_centre_production
FOR EACH ROW
BEGIN
    INSERT INTO machine_centre_summary (
        prod_date, work_centre_id, machine_id, emp_id,
        total_output_pairs, total_target_mins, total_actual_mins, total_idle_mins,
        avg_efficiency_percent, cum_avg_time, button_status
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
    WHERE prod_date = NEW.prod_date
        AND work_centre_id = NEW.work_centre_id
        AND machine_id = NEW.machine_id
        AND emp_id = NEW.emp_id
    GROUP BY prod_date, work_centre_id, machine_id, emp_id
    ON DUPLICATE KEY UPDATE
        total_output_pairs = VALUES(total_output_pairs),
        total_target_mins = VALUES(total_target_mins),
        total_actual_mins = VALUES(total_actual_mins),
        total_idle_mins = VALUES(total_idle_mins),
        avg_efficiency_percent = VALUES(avg_efficiency_percent),
        cum_avg_time = VALUES(cum_avg_time),
        button_status = VALUES(button_status),
        updated_at = CURRENT_TIMESTAMP;
END$$

DELIMITER ;
