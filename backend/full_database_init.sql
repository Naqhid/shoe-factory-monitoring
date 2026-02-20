-- ==========================================
-- COMPLETE DATABASE SCHEMA FOR FLORENCE-IOT
-- ==========================================
-- This file contains all tables required for the application.
-- Instructions: 
-- 1. Create the database first: CREATE DATABASE IF NOT EXISTS shoe_factory;
-- 2. Use the database: USE shoe_factory;
-- 3. Execute this entire script.

-- ------------------------------------------
-- 1. MASTER TABLES
-- ------------------------------------------

CREATE TABLE IF NOT EXISTS customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS groups_master (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS leather (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS styles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS colors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS work_centres (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS machine_centres (
    id INT AUTO_INCREMENT PRIMARY KEY,
    work_centre_id INT,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    machine_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (work_centre_id) REFERENCES work_centres(id)
);

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    password VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user',
    work_centre_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (work_centre_id) REFERENCES work_centres(id)
);

CREATE TABLE IF NOT EXISTS employees (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    work_centre_id INT,
    machine_centre_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (work_centre_id) REFERENCES work_centres(id),
    FOREIGN KEY (machine_centre_id) REFERENCES machine_centres(id)
);

-- ------------------------------------------
-- 2. PLANNING & ROUTING TABLES
-- ------------------------------------------

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
    FOREIGN KEY (machine_centre_id) REFERENCES machine_centres(id)
);

-- ------------------------------------------
-- 3. LINE SETUP & SETTINGS
-- ------------------------------------------

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

CREATE TABLE IF NOT EXISTS forms_master (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_rights (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    form_id INT NOT NULL,
    read_permission BOOLEAN DEFAULT FALSE,
    write_permission BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (form_id) REFERENCES forms_master(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_form (user_id, form_id)
);

-- ------------------------------------------
-- 4. PRODUCTION DATA & SESSIONS
-- ------------------------------------------

CREATE TABLE IF NOT EXISTS stitching_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    machine_id VARCHAR(20) NOT NULL,
    status TINYINT(1) NOT NULL,
    event_time DATETIME NOT NULL,
    source_file VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_machine_id (machine_id),
    INDEX idx_event_time (event_time),
    INDEX idx_machine_event_time (machine_id, event_time)
);

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

CREATE TABLE IF NOT EXISTS pivot_data (
    id INT AUTO_INCREMENT PRIMARY KEY,
    table_name VARCHAR(50) NOT NULL DEFAULT 'Prod Data',
    prod_date DATE NOT NULL,
    work_centre_id INT NOT NULL,
    machine_id VARCHAR(100) NOT NULL,
    emp_id INT NOT NULL,
    output_pairs INT DEFAULT 0,
    target_mins INT DEFAULT 0,
    actual_time INT DEFAULT 0,
    cum_avg_time INT DEFAULT 0,
    button_status TINYINT DEFAULT 1,
    target_pairs_per_tray INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_pivot_prod_date (prod_date),
    INDEX idx_pivot_machine_id (machine_id)
);

CREATE TABLE IF NOT EXISTS mobile_sessions (
    session_id VARCHAR(36) PRIMARY KEY,
    machine_id VARCHAR(100),
    status ENUM('waiting', 'active', 'expired') DEFAULT 'waiting',
    work_centre_id INT,
    emp_id INT,
    emp_code VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    activated_at TIMESTAMP NULL,
    INDEX idx_session_status (status)
);

-- ------------------------------------------
-- 5. SEED DATA (DEFAULT FORMS)
-- ------------------------------------------

INSERT IGNORE INTO forms_master (code, name) VALUES
('FRM001', 'Customer Master'),
('FRM002', 'Group Master'),
('FRM003', 'Leather Master'),
('FRM004', 'Style Master'),
('FRM005', 'Color Master'),
('FRM006', 'Work Centre Master'),
('FRM007', 'Machine Centre Master'),
('FRM008', 'Employee Master'),
('FRM009', 'TV Dashboard'),
('FRM010', 'Reports'),
('FRM011', 'Production Routing'),
('FRM012', 'Production Planning'),
('FRM013', 'Line Setup Form'),
('FRM014', 'Mobile Live Dashboard'),
('FRM015', 'Users'),
('FRM016', 'Forms Master'),
('FRM017', 'User Rights');
