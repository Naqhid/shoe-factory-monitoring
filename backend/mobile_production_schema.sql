-- Mobile Production Data Schema
-- This table stores pivot/aggregated data for mobile production tracking

CREATE TABLE IF NOT EXISTS prod_data (
    id INT AUTO_INCREMENT PRIMARY KEY,
    prod_date DATE NOT NULL,
    work_centre_id INT NOT NULL,
    machine_id VARCHAR(100) NOT NULL,
    emp_id INT NOT NULL,
    output_pairs INT DEFAULT 0,
    target_mins INT DEFAULT 0,
    start_time TIME NULL,
    finish_time TIME NULL,
    idle_stop_time INT DEFAULT 0,
    idle_start_time INT DEFAULT 0,
    actual_time INT DEFAULT 0,
    button_status TINYINT DEFAULT 1 COMMENT '1=Start, 2=Finish, 3=Stop',
    target_pairs_per_tray INT DEFAULT 0,
    tray_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_prod_date (prod_date),
    INDEX idx_machine_id (machine_id),
    INDEX idx_work_centre (work_centre_id)
);

-- Pivot Data Table (Aggregated view for reporting)
CREATE TABLE IF NOT EXISTS pivot_data (
    id INT AUTO_INCREMENT PRIMARY KEY,
    table_name VARCHAR(50) NOT NULL DEFAULT 'Prod Data',
    prod_date DATE NOT NULL,
    work_centre_id INT NOT NULL,
    machine_id VARCHAR(100) NOT NULL,
    emp_id INT NOT NULL,
    output_pairs INT DEFAULT 0 COMMENT 'Sum of Target pairs',
    target_mins INT DEFAULT 0 COMMENT 'Sum of Target mins',
    actual_time INT DEFAULT 0 COMMENT 'Sum of Actual time',
    cum_avg_time INT DEFAULT 0 COMMENT 'Actual time/12',
    button_status TINYINT DEFAULT 1 COMMENT '1=Start, 2=Finish, 3=Stop',
    target_pairs_per_tray INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_pivot_prod_date (prod_date),
    INDEX idx_pivot_machine_id (machine_id)
);
