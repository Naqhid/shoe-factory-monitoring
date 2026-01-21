# Florence IOT - Setup Guide

## Overview
Complete Production ERP System with IOT Machine Monitoring Dashboard for shoe manufacturing.

## Features Implemented

### ✅ Master Forms (All Complete with Excel Export)
1. **Customer Master** - Auto-generated codes, CRUD operations
2. **Group Master** - Group management
3. **Leather Master** - Leather type management
4. **Style Master** - Style definitions
5. **Color Master** - Color catalog
6. **Work Centre Master** - Work center configuration
7. **Machine Centre Master** - Machine centers with work centre dropdown

### ✅ Production Management
8. **Production Routing** - Complex form with:
   - Header section (Customer, Group, Leather, Style, Color, Targets, SMV)
   - Line items with auto-calculated fields:
     - Normal Time (seconds/pair) = Observed Time × Rating Factor / 100
     - Std Time (seconds/pair) = Normal Time × 1.15
     - Mins 12 prs/box = (Std Time × 12) / 60
     - Pairs/hr = Target per Day / 8
     - Pairs/day = Pairs/hr × 8

9. **Production Planning** - Auto-populate from routing:
   - Select Style → Auto-fills Customer, Group, Leather, Color from latest routing
   - Production Line assignment (default options: 1-6)
   - Target per day with auto-calculated target per hour

### ✅ Dashboard (Existing + Enhanced)
10. **Real-time IOT Dashboard**:
    - Machine status monitoring
    - Efficiency charts
    - Overall OEE metrics
    - Machine-wise performance

### ✅ Backend Features
11. **Listener App** - JSON file processor (batch model)
    - Reads incoming JSON files every 3 minutes
    - Inserts into MySQL with server timestamp
    - Moves to /processed or /error folders

## Database Setup

### 1. Create Database and Tables

Run the following SQL files in order:

```sql
-- 1. Basic setup
SOURCE E:/Florence-IOT/backend/database_setup.sql;

-- 2. Master tables
SOURCE E:/Florence-IOT/backend/masters_schema.sql;

-- 3. Production routing
SOURCE E:/Florence-IOT/backend/production_routing_schema.sql;

-- 4. Production planning
SOURCE E:/Florence-IOT/backend/production_planning_schema.sql;
```

Or run them individually:

```bash
mysql -u root -p < backend/database_setup.sql
mysql -u root -p shoe_factory < backend/masters_schema.sql
mysql -u root -p shoe_factory < backend/production_routing_schema.sql
mysql -u root -p shoe_factory < backend/production_planning_schema.sql
```

### 2. Environment Configuration

Create `.env` file in the `backend` directory:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=shoe_factory

# Directories
INCOMING_DIR=../incoming
SUCCESS_DIR=../success
FAILURE_DIR=../failure
LOGS_DIR=../logs

# Server
PORT=3001
```

## Installation

### Backend Setup

```bash
cd backend
npm install
```

### Frontend Setup

```bash
cd frontend
npm install
```

## Running the Application

### Start Backend Server

```bash
cd backend
npm start
```

The backend will:
- Start Express server on port 3001
- Start file watcher service (monitors /incoming folder every 3 minutes)
- Process JSON files and insert into database

### Start Frontend

```bash
cd frontend
npm run dev
```

Access the application at: `http://localhost:3000`

## JSON Data Format (IOT Device)

Place JSON files in the `incoming` folder:

```json
{
  "data": [
    { "machine_id": "US-01", "status": 1 },
    { "machine_id": "US-01", "status": 0 },
    { "machine_id": "US-02", "status": 1 }
  ]
}
```

**Note:**
- `status: 1` = Running/Pass
- `status: 0` = Idle/Stop
- Files are processed automatically every 3 minutes
- Successful files → `/success` folder
- Failed files → `/failure` folder

## Using the Application

### Master Data Management

1. Navigate to **ERP Masters** in the sidebar
2. Select any master form (Customer, Group, Leather, etc.)
3. Click **Add New** to create records
4. Click **Export to Excel** to download data
5. For Machine Centre: Select Work Centre from dropdown

### Production Routing

1. Go to **Production Routing** from Production menu
2. Fill Header Information:
   - Select Customer, Group, Leather, Style, Color
   - Enter Target per Day (Target per Hour auto-calculates)
   - Enter Total SMV
3. Add Line Items:
   - Select Work Centre and Machine Centre
   - Enter Observed Time and Rating Factor
   - All calculations happen automatically
   - Add multiple lines as needed
4. Click **Save Routing**

### Production Planning

1. Go to **Production Planning**
2. Select **Plan Date** and **Style**
3. System auto-populates Customer, Group, Leather, Color from latest routing
4. Select **Production Line** (1-6)
5. Enter or modify **Target per Day**
6. Click **Save Plan**

### Dashboard Monitoring

1. Navigate to **Dashboard**
2. View real-time machine status
3. Monitor efficiency charts
4. Check overall OEE metrics
5. Click on any machine card for detailed view

## API Endpoints

### Masters
- `GET /api/masters/:table` - Get all records
- `GET /api/masters/:table/:id` - Get single record
- `POST /api/masters/:table` - Create record
- `PUT /api/masters/:table/:id` - Update record
- `DELETE /api/masters/:table/:id` - Delete record

### Production Routing
- `GET /api/production-routing` - Get all routings
- `GET /api/production-routing/:id` - Get single routing
- `GET /api/production-routing/style/:styleId` - Get routing by style
- `POST /api/production-routing` - Create routing
- `PUT /api/production-routing/:id` - Update routing
- `DELETE /api/production-routing/:id` - Delete routing

### Production Planning
- `GET /api/production-planning` - Get all plans
- `GET /api/production-planning/:id` - Get single plan
- `POST /api/production-planning` - Create plan
- `PUT /api/production-planning/:id` - Update plan
- `DELETE /api/production-planning/:id` - Delete plan

### Machine Monitoring
- `GET /api/machines/status` - Real-time machine status
- `GET /api/reports/run-idle` - Run/Idle report
- `GET /api/reports/hourly` - Hourly report
- `GET /api/reports/efficiency` - Efficiency by machine
- `GET /api/reports/overall-efficiency` - Overall OEE

## Troubleshooting

### Database Connection Issues
- Verify MySQL is running
- Check `.env` credentials
- Ensure database `shoe_factory` exists

### File Processing Not Working
- Check `/incoming` folder permissions
- Verify file watcher service is running
- Check logs in `/logs` folder

### Frontend Not Loading
- Ensure backend is running on port 3001
- Check browser console for errors
- Verify API_BASE URL in components

## Technology Stack

**Backend:**
- Node.js + Express
- MySQL with mysql2
- PM2 for process management
- Winston for logging
- Chokidar for file watching

**Frontend:**
- React + TypeScript
- Vite
- TailwindCSS
- React Query
- Recharts for graphs
- XLSX for Excel export

## Production Deployment

### Backend
```bash
cd backend
npm install --production
pm2 start ecosystem.config.js
```

### Frontend
```bash
cd frontend
npm run build
# Deploy dist folder to web server
```

## Support

For issues or questions, refer to the documentation in this repository.
