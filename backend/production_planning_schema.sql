-- Production Planning Schema
CREATE TABLE IF NOT EXISTS production_plan (
    id INT AUTO_INCREMENT PRIMARY KEY,
    plan_date DATE NOT NULL,
    style_id INT NOT NULL,
    customer_id INT NOT NULL,
    group_id INT NOT NULL,
    leather_id INT NOT NULL,
    color_id INT NOT NULL,
    production_line VARCHAR(50) NOT NULL,
    target_per_day INT NOT NULL,
    target_per_hour DECIMAL(10, 2) GENERATED ALWAYS AS (target_per_day / 8) STORED,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (style_id) REFERENCES styles(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (group_id) REFERENCES groups_master(id),
    FOREIGN KEY (leather_id) REFERENCES leather(id),
    FOREIGN KEY (color_id) REFERENCES colors(id)
);
