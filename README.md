# Shoe Factory Machine Monitoring System - Windows Server Setup

## Prerequisites
1. Node.js LTS (18.x or higher)
2. MySQL 8.0
3. PM2 (npm install -g pm2)

## Installation Steps

### 1. Database Setup
```sql
-- Connect to MySQL as root
mysql -u root -p

-- Run the database setup script
source E:/Florence-IOT/database_setup.sql
```

### 2. Environment Configuration
Edit `.env` file with your database credentials:
```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=shoe_factory
```

### 3. Install Dependencies
```cmd
cd E:\Florence-IOT
npm install
```

### 4. Start with PM2
```cmd
# Start the application
npm run pm2:start

# Check status
pm2 status

# View logs
pm2 logs shoe-factory-monitoring

# Restart
npm run pm2:restart

# Stop
npm run pm2:stop
```

## API Endpoints

### 1. Machine Status
```
GET http://localhost:3000/api/machines/status
```
Returns latest status for each machine.

### 2. Run/Idle Report
```
GET http://localhost:3000/api/reports/run-idle?date=2024-01-15
```
Returns run vs idle minutes per machine for specified date.

### 3. Hourly Report
```
GET http://localhost:3000/api/reports/hourly?date=2024-01-15
```
Returns hour-wise event counts for specified date.

### 4. Health Check
```
GET http://localhost:3000/health
```

## File Processing

### Input Directory
- Place JSON files in: `E:/Florence-IOT/incoming`
- Files are automatically processed when detected

### JSON Format
```json
{
  "data": [
    { "machine_id": "US-01", "status": 1 },
    { "machine_id": "US-02", "status": 0 }
  ]
}
```

### Processing Results
- Success: Files moved to `E:/Florence-IOT/success`
- Failure: Files moved to `E:/Florence-IOT/failure`

## Logs
- Application logs: `E:/Florence-IOT/logs/`
- PM2 logs: `pm2 logs shoe-factory-monitoring`

## Testing
1. Copy `sample_data.json` to `incoming` directory
2. Check logs for processing confirmation
3. Verify file moved to `success` directory
4. Test API endpoints

## Troubleshooting
- Check PM2 status: `pm2 status`
- View logs: `pm2 logs shoe-factory-monitoring`
- Restart: `npm run pm2:restart`
- Check database connection in logs