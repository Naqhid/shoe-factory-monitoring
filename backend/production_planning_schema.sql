-- Production Planning Schema
CREATE TABLE IF NOT EXISTS production_plan (
    id INT AUTO_INCREMENT PRIMARY KEY,
    plan_date DATE NOT NULL,
    style_id INT NOT NULL,
    customer_id INT NOT NULL,
    group_id INT NOT NULL,
    leather_id INT NOT NULL,
    color_id INT NOT NULL,
    work_centre_id INT NOT NULL,
    total_target_per_day INT NOT NULL,
    target_pairs_per_day INT NOT NULL,
    man_hours_minutes INT NOT NULL,
    smv_per_pair DECIMAL(10, 4) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (style_id) REFERENCES styles(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (group_id) REFERENCES groups_master(id),
    FOREIGN KEY (leather_id) REFERENCES leather(id),
    FOREIGN KEY (color_id) REFERENCES colors(id),
    FOREIGN KEY (work_centre_id) REFERENCES work_centres(id)
);

-- Line Setup Schema
CREATE TABLE IF NOT EXISTS line_setup (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT NOT NULL,
    machine_id VARCHAR(100) NOT NULL,
    login_date_time DATETIME NOT NULL,
    work_centre_id INT NOT NULL,
    machine_centre_id INT NOT NULL,
    smv_per_pair DECIMAL(10, 4) NOT NULL,
    logout_date_time DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id),
    FOREIGN KEY (work_centre_id) REFERENCES work_centres(id),
    FOREIGN KEY (machine_centre_id) REFERENCES machine_centres(id)
);
