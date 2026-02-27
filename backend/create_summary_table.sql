-- Create machine_centre_summary table if not exists
CREATE TABLE IF NOT EXISTS machine_centre_summary (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    prod_date DATE NOT NULL,
    work_centre_id INT NOT NULL,
    machine_id VARCHAR(50) NOT NULL,
    emp_id INT NOT NULL,
    total_output_pairs INT DEFAULT 0,
    total_target_mins DECIMAL(10,2) DEFAULT 0,
    total_actual_time DECIMAL(10,2) DEFAULT 0,
    avg_efficiency DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_summary (prod_date, work_centre_id, machine_id, emp_id)
);
