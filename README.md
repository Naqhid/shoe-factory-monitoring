# ProdPulse — Smart Production Tracking System

A manufacturing execution system (MES) for shoe factories. Connects shop-floor operators, line supervisors, planners, and management through real-time production monitoring, mobile workflows, and automated reporting.

## Features Summary

### TV Dashboard (`/overview`)
Full-screen display for wall-mounted TVs. Auto-rotating carousel across production lines showing:
- Target vs actual output, input %, WIP
- Pace efficiency (expected vs actual output by current time)
- Time loss breakdown (inactive + extra cycle time)
- Hourly output chart
- Per-machine pace panel
- Live bottleneck / breakdown cards
- Rework & rejection summary

### Production Tracker (`/production_tracker`)
Supervisor command center for all lines:
- Risk-sorted line list (Monitor / At Risk / Critical)
- Pace %, projected end-of-day output, output gap
- Auto-refresh (10s / 30s / manual)
- Line detail: per-machine pace cards, vs last working day compare, time-loss reasons
- Fix-first ranking — machines with highest net time loss

### Line Monitor / Mobile Production (`/mobile`)
Operator tablet workflow at machines:
- QR scan or session-based login
- Start / Finish cycle with progress bar
- Actual vs expected output, pace efficiency
- Boxes completed (6 pairs/box standard)
- Idle reminders and late-cycle alerts
- Pairs/box dropdown (1–12) for variable finishes
- vs last working day compare at machine level

### Line Setup (`/line_setup_form`)
Supervisor workflow to assign operators to machines:
- Select line + machine (or scan QR)
- Select or scan employee QR
- One active session per machine enforcement
- Shift start and current session visibility

### Login Logs (`/logs`)
Session audit and control:
- Filter by line and date
- Per-session: operator, machine, cycles, output, pace, idle time
- Expand for cycle-level detail
- Deactivate / reactivate sessions
- **Same as yesterday** — bulk-login today's operators from prior day's assignments

### Missed Actions (`/missed_actions`)
Operational discipline tracking:
- Live issues: START_PENDING / FINISH_PENDING with overdue time
- Daily inactive report
- Cycle discipline analysis
- Idle reminder settings per machine
- Acknowledge, snooze, root cause

### Alert Center (`/alert_center`)
Real-time alert inbox:
- Efficiency low, idle too long, target at risk
- No scan heartbeat, machine offline
- Headcount low
- Acknowledge with notes

### Reports (`/reports`)
- Hourly production (with machine filter)
- Line & process efficiency with pace enrichment
- Rework & rejection by line/machine
- Time loss & stoppages
- Shift summary
- Export: Excel, PDF, WhatsApp image snapshot

### Manual Production Entry (`/manual_production_entry`)
Back-office tool for missing/incorrect floor data:
- Create/edit manual production rows
- Coverage hints (missing entries vs sessions and plan)
- Audit log with restore
- WIP daily state per line
- Respects production day lock

### Production Planning (`/production_planning`)
Daily production targets:
- Customer / group / leather / color / style selection
- Trays, SMV, manpower, target pairs per day
- Copy from prior days, Excel import/export

### Production Routing (`/production_routing`)
Engineering routings — machine sequence and standard times:
- Observed time, rating %, manpower per machine step
- Computed standard time (mins_6_prs_box)
- Drives cycle targets and shift targets
- Excel template import/export

### Line Schedule (`/line_schedule`)
Article-on-line board:
- Which style runs on which line per date
- Changeover wizard with routing preview

### Rework / Rejection Tracker (`/rework_rejection_tracker`)
Quality tracking:
- Record rework and rejection by line, machine, cycle
- Bottleneck and breakdown stoppage entry
- Scoped by work centre for line supervisors

### Master Data
CRUD with soft-delete, restore, usage check, Excel export:
- Customers, Groups, Leather, Styles, Colors
- Work Centres (production lines)
- Machine Centres (individual machines)
- Employees (operators)

### Users & Roles
- User accounts with login, password, role, machine assignment
- Role management: configurable menus and default landing page per role
- Changes apply without redeployment

### Monitoring (`/monitoring`)
Server health: database ping, disk, memory, CPU, request latency (p95/p99), error rate.

### Settings (`/settings`)
Dashboard configuration and system preferences.

---

## User Roles

| Role | Default Landing | Primary Use |
|------|----------------|-------------|
| Admin | TV Dashboard | Full system access |
| Line Supervisor | Line Setup | Floor setup, tracker, rework |
| Machine Centre User | Line Monitor | Operator at assigned machine |
| Final Output Machine | Line Monitor | End-of-line output machine |
| IED | Production Tracker | Routing and line performance |
| Planner | Production Planning | Plans, schedules, masters |
| Unit Head | TV Dashboard | Executive overview |
| Production Manager | Production Tracker | Tracker, missed actions, alerts |
| Quality | Production Tracker | Rework/rejection tracking |
| Project Monitor | Production Tracker | Cross-line monitoring + masters |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, React Query |
| Backend | Node.js, Express.js, MySQL 8.0 |
| Charts | Recharts |
| Icons | Lucide React |
| PWA | vite-plugin-pwa (offline-capable) |
| Process Manager | PM2 |
| File Processing | Chokidar (JSON ingestion from workstations) |

---

## Architecture

```
Workstation Devices → JSON Files → Backend File Watcher → MySQL Database
                                                              ↓
Operators (Tablets) ←→ Express API ←→ React Frontend (SPA)
                                         ↓
                              TV Displays / Mobile Browsers
```

**Single-server production mode:** Backend serves both the API and the built frontend (`frontend/dist`) on one port.

---

## Quick Start

### Prerequisites
- Node.js 18+ LTS
- MySQL 8.0
- Git

### Setup

```bash
git clone https://github.com/Naqhid/shoe-factory-monitoring.git
cd shoe-factory-monitoring

# Backend
cd backend
npm install
# Configure backend/.env (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, PORT)
PORT=3101 npm start

# Frontend (development with hot reload)
cd ../frontend
npm install
npm run dev -- --port 3002 --host 0.0.0.0

# Frontend (production — served by backend)
npm run build
# Then just run the backend — it serves frontend/dist automatically
```

### Production (single process)

```bash
cd frontend && npm run build
cd ../backend && PORT=3101 npm start
# Access at http://your-ip:3101
```

---

## Automated Background Jobs

| Job | Schedule | Purpose |
|-----|----------|---------|
| Session auto-close | ~18:35 daily | Deactivate stale mobile sessions |
| Production auto-finish | ~18:30 daily | Close open cycles |
| WIP auto-close | ~18:45 daily | Carry closing WIP to next day |
| Missed-action cleanup | Periodic | Remove old acknowledged items |
| Alert checks | Hourly | Generate efficiency/idle/target alerts |
| File watcher | On startup | Ingest workstation JSON into database |
| DB backup | Scheduled (configurable) | SQL dumps to `backend/data/backups` |

---

## Key Business Logic

- **Shift window:** ~09:05–17:35 with lunch exclusion
- **Pace efficiency:** `actual_output ÷ expected_output_at_now × 100`
- **Routing standard:** `mins_6_prs_box = ((observed × rating% / 100) × 1.15) × 6 / 60`
- **WIP:** `Opening WIP + Today Input − Output`
- **Last working day compare:** Finds most recent day with production, compares at same clock time

---

## Environment Variables (Backend)

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=florence
PORT=3101
NODE_ENV=production
INCOMING_DIR=./data/incoming
SUCCESS_DIR=./data/processed
FAILURE_DIR=./data/error
JWT_SECRET=your_secret_key
BACKUP_TIMES=13:45,17:45
```

---

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/my-feature`)
3. Commit changes (`git commit -m 'Add feature'`)
4. Push to branch (`git push origin feature/my-feature`)
5. Open Pull Request

## License

MIT License

## Author

**Naqhid** — [GitHub](https://github.com/Naqhid)
