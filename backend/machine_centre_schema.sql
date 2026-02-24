-- Machine Centre Production Monitoring Schema

-- Raw production logs table
CREATE TABLE IF NOT EXISTS machine_centre_app (
    id INT AUTO_INCREMENT PRIMARY KEY,
    prod_date DATE NOT NULL,
    work_centre_id INT NOT NULL,
    machine_id INT NOT NULL,
    emp_id VARCHAR(10) NOT NULL,
    
    output_pairs INT DEFAULT 0,
    target_pairs INT DEFAULT 12,
    target_mins INT NOT NULL,
    
    start_time DATETIME,
    finish_time DATETIME,
    
    idle_start_time DATETIME,
    idle_stop_time DATETIME,
    idle_duration INT DEFAULT 0 COMMENT 'Total idle minutes',
    
    actual_time INT DEFAULT 0 COMMENT 'Minutes elapsed',
    
    button_status INT DEFAULT 1 COMMENT '1=Running, 2=Finished, 3=Stopped',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_machine_date (machine_id, prod_date),
    INDEX idx_work_centre (work_centre_id),
    INDEX idx_status (button_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Aggregated pivot data table
CREATE TABLE IF NOT EXISTS pivot_data (
    id INT AUTO_INCREMENT PRIMARY KEY,
    prod_date DATE NOT NULL,
    work_centre_id INT NOT NULL,
    machine_id INT NOT NULL,
    emp_id VARCHAR(10) NOT NULL,
    
    total_output_pairs INT DEFAULT 0,
    total_target_pairs INT DEFAULT 0,
    total_target_mins INT DEFAULT 0,
    total_actual_time INT DEFAULT 0,
    
    cumulative_avg_time DECIMAL(10,2) DEFAULT 0 COMMENT 'Avg time per 12 pairs',
    avg_efficiency DECIMAL(5,2) DEFAULT 0 COMMENT 'Average efficiency %',
    
    button_status INT DEFAULT 1,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_machine_date (machine_id, prod_date, work_centre_id),
    INDEX idx_date (prod_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
