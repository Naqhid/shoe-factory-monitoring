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