-- Per-machine idle reminder / missed-start timing (mobile alarm + Missed Actions thresholds)
CREATE TABLE IF NOT EXISTS machine_idle_reminder_settings (
    machine_id VARCHAR(100) NOT NULL PRIMARY KEY,
    idle_interval_mins INT NOT NULL DEFAULT 0 COMMENT 'Legacy: whole minutes part of idle interval',
    idle_interval_secs INT NOT NULL DEFAULT 40 COMMENT 'Seconds idle before reminder / START missed',
    alarm_duration_secs INT NOT NULL DEFAULT 12 COMMENT 'How long the reminder alarm plays',
    finish_grace_mins INT NOT NULL DEFAULT 0 COMMENT 'Extra minutes after target before FINISH missed alert',
    updated_by VARCHAR(255) NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_idle_reminder_machine FOREIGN KEY (machine_id) REFERENCES machine_centres(machine_id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
