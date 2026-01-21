-- Production Routing Schema
CREATE TABLE IF NOT EXISTS production_routing_header (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    group_id INT NOT NULL,
    leather_id INT NOT NULL,
    style_id INT NOT NULL,
    color_id INT NOT NULL,
    created_on DATE NOT NULL,
    category VARCHAR(50),
    target_per_day INT NOT NULL,
    target_per_hour DECIMAL(10, 2) GENERATED ALWAYS AS (target_per_day / 8) STORED,
    tot_smv DECIMAL(10, 4) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (group_id) REFERENCES groups_master(id),
    FOREIGN KEY (leather_id) REFERENCES leather(id),
    FOREIGN KEY (style_id) REFERENCES styles(id),
    FOREIGN KEY (color_id) REFERENCES colors(id)
);

CREATE TABLE IF NOT EXISTS production_routing_lines (
    id INT AUTO_INCREMENT PRIMARY KEY,
    routing_header_id INT NOT NULL,
    work_centre_id INT NOT NULL,
    machine_centre_id INT NOT NULL,
    observed_time DECIMAL(10, 2) NOT NULL,
    rating_factor DECIMAL(5, 2) NOT NULL,
    normal_time_secs_pr DECIMAL(10, 4) GENERATED ALWAYS AS (observed_time * rating_factor / 100) STORED,
    std_time_secs_pr DECIMAL(10, 4) GENERATED ALWAYS AS (observed_time * rating_factor / 100 * 1.15) STORED,
    mins_12_prs_box DECIMAL(10, 4) GENERATED ALWAYS AS ((observed_time * rating_factor / 100 * 1.15 * 12) / 60) STORED,
    manpower DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (routing_header_id) REFERENCES production_routing_header(id) ON DELETE CASCADE,
    FOREIGN KEY (work_centre_id) REFERENCES work_centres(id),
    FOREIGN KEY (machine_centre_id) REFERENCES machine_centres(id)
);
