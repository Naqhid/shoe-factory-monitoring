-- Create database (Commented out to use env DB)
-- CREATE DATABASE IF NOT EXISTS shoe_factory;
-- USE shoe_factory;

-- Create stitching_events table
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

-- Sample data for testing
INSERT INTO stitching_events (machine_id, status, event_time, source_file) VALUES
('US-01', 1, '2024-01-15 08:00:00', 'sample1.json'),
('US-01', 0, '2024-01-15 08:30:00', 'sample1.json'),
('US-02', 1, '2024-01-15 08:15:00', 'sample2.json'),
('US-02', 1, '2024-01-15 08:45:00', 'sample2.json');

-- ============================================================
-- SECURITY: Production day locks
-- ============================================================
CREATE TABLE IF NOT EXISTS production_day_locks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  lock_date DATE NOT NULL,
  work_centre_id INT NOT NULL,
  locked_by INT NOT NULL,
  locked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notes VARCHAR(255),
  UNIQUE KEY unique_lock (lock_date, work_centre_id),
  INDEX idx_lock_date (lock_date)
);

-- ============================================================
-- ALERTS: Production alerts log
-- ============================================================
CREATE TABLE IF NOT EXISTS production_alerts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  alert_type ENUM('efficiency_low','headcount_low','machine_idle','target_at_risk','custom') NOT NULL,
  severity ENUM('info','warning','critical') NOT NULL DEFAULT 'warning',
  work_centre_id INT,
  machine_id VARCHAR(100),
  alert_date DATE NOT NULL,
  message TEXT NOT NULL,
  threshold_value DECIMAL(10,2),
  actual_value DECIMAL(10,2),
  is_read TINYINT(1) DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_alert_date (alert_date),
  INDEX idx_unread (is_read, alert_date),
  INDEX idx_wc (work_centre_id)
);

-- ============================================================
-- MIGRATION: Hash existing plaintext passwords
-- Run this once after deploying the new auth code.
-- Passwords will also auto-upgrade on next login.
-- ============================================================
-- (No SQL needed — auto-upgrade happens on login via authController)
