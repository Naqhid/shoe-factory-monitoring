# Database Setup Guide

## MySQL User & Permission Configuration

### 1. Connect to MySQL
```bash
mysql -u root -p
```

### 2. Create Database
```sql
CREATE DATABASE florence;
USE florence;
```

### 3. Create Required Table
```sql
CREATE TABLE stitching_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    machine_id VARCHAR(20) NOT NULL,
    status TINYINT(1) NOT NULL,
    event_time DATETIME NOT NULL,
    source_file VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_machine_id (machine_id),
    INDEX idx_event_time (event_time)
);
```

### 4. Configure Root User (Option 1)
```sql
ALTER USER 'root'@'localhost' IDENTIFIED BY 'Shoe@123';
FLUSH PRIVILEGES;
```

### 5. Create Dedicated User (Option 2 - Recommended)
```sql
CREATE USER 'shoe_factory_user'@'localhost' IDENTIFIED BY 'Shoe@123';
GRANT ALL PRIVILEGES ON florence.* TO 'shoe_factory_user'@'localhost';
FLUSH PRIVILEGES;
```

### 6. Grant Remote Access (If Needed)
```sql
-- For specific host
CREATE USER 'root'@'192.168.5.47' IDENTIFIED BY 'Shoe@123';
GRANT ALL PRIVILEGES ON florence.* TO 'root'@'192.168.5.47';

-- For any host (less secure)
CREATE USER 'root'@'%' IDENTIFIED BY 'Shoe@123';
GRANT ALL PRIVILEGES ON florence.* TO 'root'@'%';

FLUSH PRIVILEGES;
```

### 7. Verify Permissions
```sql
SHOW GRANTS FOR 'root'@'localhost';
-- or
SHOW GRANTS FOR 'shoe_factory_user'@'localhost';
```

### 8. Test Connection
```bash
mysql -h localhost -u root -p'Shoe@123' florence
```

## Environment Configuration

Update `backend/.env` with your credentials:
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=Shoe@123
DB_NAME=florence
```

## Troubleshooting

### Access Denied Error
```sql
ALTER USER 'root'@'localhost' IDENTIFIED BY 'Shoe@123';
FLUSH PRIVILEGES;
```

### Unknown Database Error
```sql
CREATE DATABASE florence;
```

### Host Not Allowed Error
```sql
GRANT ALL PRIVILEGES ON florence.* TO 'root'@'%';
FLUSH PRIVILEGES;
```

### Connection Timeout
- Check if MySQL service is running
- Verify firewall settings
- Confirm correct host IP address
