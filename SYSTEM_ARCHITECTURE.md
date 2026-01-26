# System Architecture & Navigation Guide

## Application Structure

```
Florence-IOT
├── backend/                    (Node.js + Express)
│   ├── src/
│   │   ├── controllers/       (API logic)
│   │   ├── repositories/      (Database queries)
│   │   ├── services/          (Business logic)
│   │   └── app.js             (Express server)
│   ├── database_setup.sql     (stitching_events table)
│   ├── masters_schema.sql     (Master data tables)
│   ├── production_planning_schema.sql
│   ├── production_routing_schema.sql
│   └── package.json
│
├── frontend/                   (React + TypeScript + Vite)
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navigation.tsx              ← Sidebar menu
│   │   │   ├── Header.tsx
│   │   │   ├── StatsPanel.tsx
│   │   │   ├── MachineCard.tsx
│   │   │   ├── EfficiencyChart.tsx
│   │   │   ├── MachineDetailModal.tsx
│   │   │   ├── MasterForm.tsx              ← Generic master forms
│   │   │   ├── ProductionRoutingForm.tsx
│   │   │   ├── ProductionPlanningForm.tsx
│   │   │   ├── LineSetupForm.tsx           ← Web version
│   │   │   ├── MobileLineSetupForm.tsx     ← Mobile version
│   │   │   ├── MobileLiveDashboard.tsx     ← Mobile version
│   │   │   └── Reports.tsx
│   │   ├── hooks/
│   │   │   └── useApi.ts                   (React Query hooks)
│   │   ├── services/
│   │   │   └── api.ts                      (API client)
│   │   ├── types/
│   │   │   └── index.ts
│   │   └── App.tsx                         (Main app component)
│   └── package.json
│
├── MOBILE_APP_GUIDE.md        ← Mobile app documentation
└── MOBILE_APP_IMPLEMENTATION.md
```

---

## Sidebar Navigation Structure

### Web Dashboard (Desktop/Tablet)

```
┌─────────────────────────────┐
│     ERP System              │
├─────────────────────────────┤
│                             │
│ ▼ Production Dashboard      │
│   • TV Dashboard            │
│   • Reports                 │
│   • Production Routing      │
│   • Production Planning     │
│   • Line Setup              │
│                             │
│ ▼ Mobile App                │  ← NEW SECTION
│   • Line Setup              │  ← For shop floor supervisors
│   • Live Dashboard          │
│                             │
│ ▼ ERP Masters               │
│   • Customer                │
│   • Group                   │
│   • Leather                 │
│   • Style                   │
│   • Color                   │
│   • Work Centre             │
│   • Machine Centre          │
│   • User                    │
│   • Employee                │
│                             │
└─────────────────────────────┘
```

---

## Route Mapping

### Web Application Routes

| URL | Component | Purpose |
|-----|-----------|---------|
| `/overview` | StatsPanel + MachineCard + EfficiencyChart | TV Dashboard |
| `/reports` | Reports | Production reports |
| `/production_routing` | ProductionRoutingForm | Define manufacturing process |
| `/production_planning` | ProductionPlanningForm | Set daily targets & plans |
| `/line_setup` | LineSetupForm | Line setup (web version) |
| `/customers` | MasterForm | Customer master |
| `/employees` | MasterForm | Employee master |
| `/users` | MasterForm | User master |
| `/{other_masters}` | MasterForm | Other master data |

### Mobile Application Routes

| URL | Component | Purpose |
|-----|-----------|---------|
| `/mobile_line_setup` | MobileLineSetupForm | Start shift (mobile) |
| `/mobile_live_dashboard` | MobileLiveDashboard | Monitor production (mobile) |

---

## Component Hierarchy

```
App.tsx
├── Navigation.tsx (Sidebar)
│   ├── Production Dashboard menu
│   ├── Mobile App menu ← NEW
│   └── ERP Masters menu
│
├── Header.tsx (Top navigation)
├── StatsPanel.tsx (Dashboard stats)
├── MachineCard.tsx (Machine status)
├── EfficiencyChart.tsx (Efficiency chart)
├── MachineDetailModal.tsx (Machine details)
├── MasterForm.tsx (All master data forms)
├── ProductionRoutingForm.tsx
├── ProductionPlanningForm.tsx
├── LineSetupForm.tsx
├── MobileLineSetupForm.tsx ← NEW
├── MobileLiveDashboard.tsx ← NEW
└── Reports.tsx
```

---

## Data Flow Architecture

### From Device to Dashboard

```
1. IoT Device (Microcontroller)
   └─ Creates event: { machine_id, status }
   
2. Transmits to Router (every 3 minutes)
   └─ JSON batch file created
   
3. Uploaded to Server (/incoming)
   └─ File watcher detects
   
4. Node.js Backend Processes
   ├─ Validates JSON structure
   ├─ Adds server timestamp
   ├─ Inserts into stitching_events
   ├─ Moves to /processed (success) or /error (failure)
   
5. Frontend Fetches Data
   ├─ useMachineStatus() - Latest machine status
   ├─ useDailyDashboardData() - Work centre metrics
   ├─ useOverallDailyData() - Overall daily performance
   
6. Displays on Dashboards
   ├─ TV Dashboard (Real-time)
   ├─ Web Dashboard (Stats + Charts)
   └─ Mobile Dashboard (Filtered view)
```

---

## API Endpoints

### Core Endpoints

**Machine Status**:
```
GET /api/machine-status
```

**Dashboard Data**:
```
GET /api/dashboard/daily?date=2026-01-26
GET /api/dashboard/overall-daily?date=2026-01-26
```

**Line Setup**:
```
GET /api/line-setup
POST /api/line-setup
PUT /api/line-setup/:id
DELETE /api/line-setup/:id
```

**Master Data**:
```
GET /api/masters/{table}
POST /api/masters/{table}
PUT /api/masters/{table}/:id
DELETE /api/masters/{table}/:id
```

**Production**:
```
GET /api/production-planning
POST /api/production-planning
GET /api/production-routing
POST /api/production-routing
```

---

## Database Schema Overview

### Core Tables

**stitching_events** - Device data
```
id, machine_id, status, event_time, source_file, created_at
```

**line_setup** - Shift management
```
id, employee_id, machine_id, login_date_time, 
work_centre_id, machine_centre_id, smv_per_pair, 
logout_date_time, created_at, updated_at
```

**production_plan** - Daily targets
```
id, plan_date, style_id, customer_id, group_id, leather_id, 
color_id, work_centre_id, total_target_per_day, 
target_pairs_per_day, man_hours_minutes, created_at, updated_at
```

**production_routing_header** - Manufacturing process
```
id, customer_id, group_id, leather_id, style_id, color_id, 
created_on, category, target_per_day, tot_smv, created_at, updated_at
```

**production_routing_lines** - Process steps
```
id, routing_header_id, work_centre_id, machine_centre_id, 
observed_time, rating_factor, normal_time_secs_pr, 
std_time_secs_pr, mins_12_prs_box, manpower, created_at, updated_at
```

### Master Tables

```
customers, groups_master, leather, styles, colors,
work_centres, machine_centres, users, employees
```

---

## User Roles & Access

### 1. Administrator
- Access: All menus
- Permissions: Create/Edit/Delete all data
- Dashboard: TV Dashboard + Reports

### 2. Production Manager
- Access: Production Routing, Production Planning, Reports
- Permissions: View and create production data

### 3. Supervisor (Mobile)
- Access: Mobile App only
- Permissions: Line Setup, View Live Dashboard
- Tools: Mobile app on floor

### 4. Operator
- Device: IoT microcontroller
- Action: Press PASS/STOP button
- Data: Auto-collected to system

---

## Key Calculations

### Daily Metrics

**Output %**:
```
(Count of status=1 events / Production Plan target) × 100
```

**Efficiency %**:
```
(Output × SMV per pair) / (Number of Employees × Man Hours) × 100
```

**Example**:
- Output: 100 pairs
- SMV: 0.25 min/pair
- Employees: 5
- Man Hours: 480 min

Efficiency = (100 × 0.25) / (5 × 480) × 100 = 10.42%

---

## Technology Stack

### Backend
- **Runtime**: Node.js (v18+)
- **Framework**: Express.js
- **Database**: MySQL
- **Monitoring**: Winston (logging)
- **File Watching**: Chokidar

### Frontend
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **State Management**: React Query
- **Routing**: React Router
- **Icons**: Lucide React
- **Notifications**: React Hot Toast

---

## Performance Features

✅ **Auto-refresh**: 5-30 second intervals via React Query
✅ **Caching**: React Query automatic cache management
✅ **Lazy Loading**: Components load on demand
✅ **Pagination**: Master forms support pagination
✅ **Indexing**: Database indexes on key fields
✅ **Connection Pool**: MySQL connection pooling (10 connections)
✅ **Responsive**: Mobile-first design
✅ **Error Handling**: Try-catch + user feedback

---

## Security Considerations

- Input validation on all forms
- SQL injection prevention (parameterized queries)
- CORS enabled for cross-origin requests
- Environment variables for sensitive data
- Error messages don't expose internals
- File upload validation in fileProcessorService

---

## Deployment Checklist

- [ ] Database setup completed (npm run setup-db)
- [ ] Environment variables configured (.env)
- [ ] Backend server started (npm start)
- [ ] Frontend build successful (npm run build)
- [ ] Master data populated
- [ ] IoT devices connected
- [ ] API endpoints tested
- [ ] SSL/TLS configured (production)
- [ ] Backups configured
- [ ] Monitoring active

---

## Troubleshooting

### Common Issues

**Dashboard shows no data**:
1. Check IoT devices are sending data
2. Verify database connection
3. Check /incoming folder for JSON files
4. Review logs: `backend/logs/`

**Line Setup fails**:
1. Verify employee exists
2. Check work centre is created
3. Ensure machine centre is linked
4. Validate SMV value

**Mobile Dashboard blank**:
1. Verify production plan exists for today
2. Check line setup records exist
3. Ensure devices have events recorded
4. Refresh browser cache

**API connection timeout**:
1. Check network connectivity
2. Verify API base URL in .env
3. Check firewall settings
4. Review API server logs

---

## Quick Start

```bash
# Backend
cd backend
npm install
npm run setup-db
npm start

# Frontend (new terminal)
cd frontend
npm install
npm run dev

# Open browser
http://localhost:5173
```

---

**System ready for production! 🚀**