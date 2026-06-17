# ProdPulse — Application Features Guide

**Product:** ProdPulse (Smart Production Tracking)  
**Purpose:** Shoe factory manufacturing execution system (MES) for real-time production monitoring, operator floor workflows, planning, quality, and administration.

---

## Table of contents

1. [Overview](#1-overview)
2. [User roles & access](#2-user-roles--access)
3. [Navigation & routes](#3-navigation--routes)
4. [Feature modules](#4-feature-modules)
5. [Mobile & floor workflows](#5-mobile--floor-workflows)
6. [Reports & analytics](#6-reports--analytics)
7. [Administration & master data](#7-administration--master-data)
8. [Key business logic](#8-key-business-logic)
9. [Backend API summary](#9-backend-api-summary)
10. [Automated jobs & background services](#10-automated-jobs--background-services)

---

## 1. Overview

ProdPulse connects shop-floor production with planning and supervision. Operators run cycles on tablets at machines; supervisors monitor lines on TV dashboards and mobile trackers; planners set targets and schedules; quality teams record rework and rejections.

**Tech stack**

| Layer | Technology |
|-------|------------|
| Frontend | React, TypeScript, Vite, Tailwind CSS |
| Backend | Node.js, Express |
| Database | MySQL |
| Floor devices | Tablets / browsers at machine centres (often no login — session-based) |

**Typical users**

- **Operators** — start/finish production cycles on assigned machines
- **Line supervisors** — set up logins, monitor tracker, handle exceptions
- **Planners / IED** — routing, daily plans, line schedules
- **Management** — TV dashboard, reports, missed actions
- **Admins** — users, roles, master data, monitoring

---

## 2. User roles & access

Permissions are stored in the database and loaded at login via `/api/auth/session`. The **Roles** screen can change menus without redeploying code.

### 2.1 Built-in roles

| Role | Default landing page | Primary use |
|------|---------------------|-------------|
| **Admin** | TV Dashboard (`/overview`) | Full system access |
| **Line Supervisor** | Line Setup (`/line_setup_form`) | Floor setup, tracker, rework, reports |
| **Machine Centre User** | Line Monitor (`/mobile`) | Operator at one assigned machine |
| **IED** | Production Tracker | Routing and line performance |
| **Planner** | Production Planning | Plans, schedules, product masters |
| **Unit Head** | TV Dashboard | Executive overview |
| **Production Manager** | Production Tracker | Tracker, missed actions, alerts |
| **Quality** | Production Tracker | Rework/rejection, missed actions |

**Note:** Custom roles can be created in **Roles** with any combination of allowed menus and a custom default route (e.g. “Project Monitor”).

### 2.2 Menu access (default)

| Menu | Admin | Line Sup. | Machine User | IED | Planner | Unit Head | Prod. Mgr | Quality |
|------|:-----:|:---------:|:------------:|:---:|:-------:|:---------:|:---------:|:-------:|
| TV Dashboard | ✓ | ✓ | | ✓ | ✓ | ✓ | | |
| Production Tracker | ✓ | ✓ | | ✓ | ✓ | ✓ | ✓ | ✓ |
| Line Setup | ✓ | ✓ | | | | | | |
| Line Monitor (mobile) | ✓ | | ✓ | | | | | |
| Login Logs | ✓ | ✓ | | ✓ | ✓ | ✓ | | |
| Missed Actions | ✓ | ✓ | | ✓ | ✓ | ✓ | ✓ | ✓ |
| Alert Center | ✓ | ✓ | | ✓ | ✓ | ✓ | ✓ | ✓ |
| Reports | ✓ | ✓ | | ✓ | ✓ | ✓ | | |
| Production Routing | ✓ | | | ✓ | | | | |
| Production Planning | ✓ | | | | ✓ | | | |
| Line Schedule | ✓ | | | | ✓ | | | |
| Manual Production Entry | ✓ | | | | | | | |
| Rework / Rejection Tracker | ✓ | ✓ | | | | | | ✓ |
| Master data (8 tables) | ✓ | | | | ✓* | | | |
| Users / Roles / Monitoring | ✓ | | | | | | | |

\*Planner: product and line masters only (not users/roles).

---

## 3. Navigation & routes

The app uses path-based routing. The first URL segment selects the screen.

### 3.1 Operations (Process)

| Route | Screen name | Description |
|-------|-------------|-------------|
| `/overview` | TV Dashboard | Large-format line carousel for shop floor |
| `/production_tracker` | Production Tracker | Supervisor command center for all lines |
| `/production_tracker/line/:id` | Line detail | Machine-level pace, time loss, yesterday compare |
| `/line_setup_form` | Line Setup | QR login — assign operator to machine |
| `/mobile` | Line Monitor | Pick a machine to open floor UI |
| `/mobile/:machineId` | Machine (waiting) | QR / session wait screen |
| `/mobile/:machineId/:empCode` | Machine production | Operator cycle screen (Start / Finish) |
| `/logs` | Login Logs | Session history, bulk “same as yesterday” login |
| `/missed_actions` | Missed Actions | Live issues, discipline, reminder settings |
| `/alert_center` | Alert Center | Acknowledge real-time alerts |
| `/reports` | Reports | Hourly, efficiency, stoppages, shift summary |
| `/manual_production_entry` | Manual Entry | Backfill production, WIP, audit |
| `/rework_rejection_tracker` | Rework / Rejection | Quality quantities and stoppages |
| `/production_planning` | Production Planning | Daily targets per line/style |
| `/production_routing` | Production Routing | SMV / machine steps per style |
| `/line_schedule` | Line Schedule | Article-on-line / changeover board |

### 3.2 Master data

| Route | Entity |
|-------|--------|
| `/customers` | Customers |
| `/groups` | Groups |
| `/leather` | Leather types |
| `/styles` | Styles |
| `/colors` | Colors |
| `/work_centres` | Production lines |
| `/machine_centres` | Machines |
| `/employees` | Operators |

### 3.3 Setup

| Route | Purpose |
|-------|---------|
| `/users` | User accounts (login, role, machine assignment) |
| `/roles` | Role menus and default landing page |
| `/monitoring` | Server health and request metrics |

---

## 4. Feature modules

### 4.1 TV Dashboard (`/overview`)

**Audience:** Management, supervisors, planners

Full-screen display for one or all production lines (auto-rotating carousel).

**Shows per line**

- Target vs output, input %, WIP
- Pace efficiency (% of expected output by now)
- Time loss (inactive + extra cycle time)
- Hourly output chart
- Per-machine pace panel (expected vs actual within shift)
- Live bottleneck / breakdown stoppage cards
- Rework & rejection summary

**Tips**

- Pin a single line from the UI (saved in browser)
- Designed for wall-mounted TVs; hides normal app chrome

---

### 4.2 Production Tracker (`/production_tracker`)

**Audience:** Supervisors, IED, planners, production managers, quality

Mobile-friendly supervisor dashboard for all lines.

**Line list**

- Risk sorting (Monitor / At Risk / Critical)
- Pace %, projected end-of-day output, output gap
- Attendance from mobile sessions
- Alert count badge
- Auto-refresh: 10s / 30s / manual

**Line detail** (`/production_tracker/line/:workCentreId`)

- Per-machine pace cards (actual / expected / projected EOD)
- **vs last working day** — same clock time and full-day compare
- **Fix first — time loss** — machines with highest net time loss
- Capture time-loss reasons per machine
- Hourly chart and reports shortcuts

---

### 4.3 Line Setup (`/line_setup_form`)

**Audience:** Line supervisors, admins

Supervisor workflow to log operators onto machines.

**Steps**

1. Select production line and machine (or scan machine QR)
2. Select or scan employee QR
3. Activate session → operator can use machine tablet
4. Optional: shift start, view who is already logged in today

**Rules**

- One active session per machine (deactivate from Login Logs to reassign)
- Operator cannot be on two machines without deactivating first
- Production day lock can block changes on locked dates

---

### 4.4 Login Logs (`/logs`)

**Audience:** Supervisors, planners, IED, unit head

Audit and control of operator machine sessions.

**Features**

- Filter by line and date (today / yesterday presets)
- Summary KPIs: total sessions, active now, total output
- Per session: operator, machine, cycles, output, pace efficiency, idle time
- Expand row → cycle-level detail (target vs actual mins per cycle)
- **Deactivate** / **reactivate** sessions
- **Same as yesterday** — preview last operator per machine from prior working day, edit assignments, bulk login today
- Warning banner when opening from a machine PC (`?machine=03`) if that machine is not logged in

---

### 4.5 Missed Actions (`/missed_actions`)

**Audience:** Supervisors, management, quality, production managers

Operational discipline — overdue operator actions.

| Tab | Purpose |
|-----|---------|
| **Live Issues** | START_PENDING / FINISH_PENDING with overdue minutes |
| **Daily Inactive Report** | Historical inactive-time events |
| **Cycle Discipline** | Aggregated late/slow cycle analysis |
| **Reminder Settings** | Per-machine idle alarm intervals |

**Actions:** Acknowledge, snooze, set root cause, export, link to machine/logs

---

### 4.6 Manual Production Entry (`/manual_production_entry`)

**Audience:** Admin (default)

Back-office tool when floor data is missing or wrong.

| Tab | Purpose |
|-----|---------|
| **Entries** | Create/edit manual production rows |
| **Coverage** | Hints for missing entries vs sessions and plan |
| **Audit** | Change log with restore |
| **Production** | Live in-progress records |
| **Summary** | Aggregated manual entry totals |
| **WIP** | Daily WIP state per line |

Respects **production day lock**. Integrates with WIP formula (opening + input − output).

---

### 4.7 Production Planning (`/production_planning`)

**Audience:** Admin, planner

Define daily production targets per work centre and style.

- Customer / group / leather / color / style selection
- Trays, SMV, manpower, target pairs per day
- Today/week boards, copy from prior days
- Excel import/export
- Sync with line schedule preview

---

### 4.8 Production Routing (`/production_routing`)

**Audience:** Admin, IED

Engineering routings — machine sequence and standard times.

- Observed time, rating %, manpower per machine step
- Computed standard: `mins_6_prs_box` (time for 6 pairs at routing standard)
- Used for cycle targets, shift targets, and pace efficiency everywhere
- Excel template import/export

---

### 4.9 Line Schedule (`/line_schedule`)

**Audience:** Admin, planner

**Article-on-line** board — which style runs on which line for a given date.

- Changeover wizard with routing preview
- Optional plan update when style changes on a line

---

### 4.10 Alert Center (`/alert_center`)

**Audience:** Broad operational roles

Real-time alert inbox with severity and acknowledge.

**Alert types (examples)**

- Efficiency low, idle too long, over target time
- No scan heartbeat, machine offline / idle
- Headcount low, target at risk

**Alert bell** in sidebar polls the same feed. Hourly server checks generate new alerts.

---

### 4.11 Rework / Rejection Tracker (`/rework_rejection_tracker`)

**Audience:** Line supervisors, quality, admin

- Record rework and rejection by line, machine, cycle
- Bottleneck and breakdown stoppage entry
- Line supervisors scoped to their work centre
- Summary feeds TV Dashboard (public read API)

---

### 4.12 Monitoring (`/monitoring`)

**Audience:** Admin

Server health: database ping, disk, memory, CPU, request latency (p95/p99), error rate, recent requests.

---

## 5. Mobile & floor workflows

### 5.1 Session flow

```
Supervisor (Line Setup) → scan machine + employee QR → session active
Display tablet polls session → redirects to /mobile/{machine}/{emp}
Operator → Start cycle → Running → Finish cycle
End of day → auto-finish cycles (~18:30), auto-close sessions (~18:35)
```

### 5.2 Machine production screen

**URL:** `/mobile/:machineId/:empCode?session=...`

**Collapsed header:** status badge — tap to expand details.

**Expanded details**

- Actual vs speed (pairs now / expected by now)
- Shift target (routing-based daily pairs)
- **vs last working day** (same time + full day compare)
- Operator, machine, line, process name
- Bins completed today, date/time
- Idle reminder on/off

**Main metrics**

- Cycle time progress bar (turns red when over target)
- Output today vs expected, pace efficiency %
- Boxes completed (always 6 pairs/box standard)
- Current / required pairs per hour
- Idle pill when waiting after finish

**Actions**

- **Start** — begin new cycle
- **Finish** — complete cycle (may prompt stoppage reason)
- Late cycles bell — view timing discipline for today
- Pull down to refresh

**Pairs/box dropdown (1–12)** affects cycle target time and finish quantity only — **not** the boxes count (boxes always use 6 pairs/box).

### 5.3 Security model on floor

Many mobile APIs are **public** (no JWT) because tablets stay logged in at machines. Security relies on:

- Valid mobile session for machine + operator
- Session token in URL where required
- Machine Centre User role tied to assigned `machine_id`

---

## 6. Reports & analytics

**Route:** `/reports`  
**Audience:** Admin, line supervisor, IED, planner, unit head

| Report | Description |
|--------|-------------|
| **Hourly Production** | Hour-by-hour output; optional machine filter |
| **Line & Process Efficiency** | Line/machine efficiency with pace enrichment |
| **Rework & Rejection** | Quality quantities by line/machine |
| **Time Loss & Stoppages** | Time loss, bottleneck, breakdown views |
| **Shift Summary** | End-of-shift rollup |

**Export:** Excel, PDF, WhatsApp image snapshot  
**Compare:** Period-over-period where supported

---

## 7. Administration & master data

### 7.1 Master tables

Generic CRUD with soft-delete, restore, usage check, Excel export:

| Master | Used for |
|--------|----------|
| Customer | Brand / buyer |
| Group | Product grouping |
| Leather | Material |
| Style | Shoe model (links to routing) |
| Color | Colorway |
| Work Centre | Production line; input/EOL machine IDs |
| Machine Centre | Individual machines on a line |
| Employee | Operators; quick-register from Line Setup |

### 7.2 Users

- Login name, password, role
- Optional work centre and machine assignment (Machine Centre User auto-routes to machine)

### 7.3 Roles

- Edit **allowed menus** and **default route** per role
- Restore factory defaults from snapshot
- Changes apply on next session refresh / re-login

### 7.4 Production day lock

Lock a line + date to block production edits. Supervisors can lock from Line Setup; admin can unlock. Affects mobile production, manual entry, WIP, rework.

### 7.5 Database backup

Admin can trigger backups from the API (`/api/backup`).

---

## 8. Key business logic

### 8.1 Shift & pace efficiency

- **Shift window:** configurable (default ~09:05–17:35); lunch excluded (Mon–Thu/Sat 13:30–14:00; Fri 12:30–13:00)
- **Expected output at now** = `(daily_target × elapsed_productive_mins) / total_productive_mins`
- **Pace %** = `actual ÷ expected × 100`
- **Daily target** from routing = `(productive_mins ÷ mins_per_6_pairs) × 6`
- Used consistently on TV Dashboard, Production Tracker, mobile, and Login Logs

### 8.2 Last working day compare

- Finds the most recent prior day with production (skips days with zero output)
- Compares output at **same wall-clock time** and **full day** total
- **Line level:** EOL machine output (Production Tracker detail)
- **Machine level:** that machine’s finished pairs (mobile expanded details)
- Past dates use shift end (17:35) as “as-of” time

### 8.3 Same-as-yesterday login

- Login Logs → preview yesterday’s last operator per machine
- Edit operator per row before bulk activate
- Handles conflicts: same operator refresh, different operator replace, cross-machine conflicts with optional “clear active sessions”

### 8.4 Routing standard time

```
mins_6_prs_box = ((observed_time × rating% / 100) × 1.15) × 6 / 60
```

Drives cycle target minutes and shift targets.

### 8.5 WIP

```
Current WIP = Opening WIP + Today Input − Output
```

Closing WIP carries to next day’s opening (auto-close scheduler).

### 8.6 Missed actions

- **START_PENDING** — logged in but no cycle started within threshold
- **FINISH_PENDING** — cycle running past target + grace
- Net lost minutes from idle gaps and slow cycles
- Acknowledge, snooze, root cause; auto-cleanup after 7 days

### 8.7 Cycle time loss

- **Inactive** — gap before first cycle or between cycles
- **Extra** — actual cycle time over target
- **Early** — faster than target (offsets loss in net balance)

---

## 9. Backend API summary

| Area | Prefix | Typical auth |
|------|--------|--------------|
| Auth | `/api/login`, `/api/auth/*` | Public login; session JWT |
| TV Dashboard | `/api/tv-dashboard/*` | Public |
| Hourly output | `/api/hourly-output/*` | Public |
| Mobile session | `/api/mobile-session/*`, `/api/mobile-sessions/*` | Public floor; logs need auth |
| Mobile production | `/api/mobile-production/*` | Public floor; manual-entry needs auth |
| Machine centre | `/api/machine-centre/*` | Public |
| Production tracker | `/api/tracker/*` | JWT + tracker permission |
| Missed actions | `/api/missed-actions/*` | JWT |
| Reports | `/api/reports/*` | JWT + reports permission |
| Planning | `/api/production-planning/*` | JWT + planning |
| Routing | `/api/production-routing/*` | JWT + routing |
| Line schedule | `/api/line-schedule/*` | JWT + planning |
| WIP | `/api/wip-daily-state/*` | JWT + manual entry |
| Rework | `/api/rework-rejection/*` | Summary public; writes auth |
| Alerts | `/api/alerts/*` | Read often public; ack auth |
| Masters | `/api/masters/:table/*` | Admin |
| Roles / users | `/api/roles/*`, user masters | Admin |
| Health | `/health`, `/health/detailed` | Basic public |
| Backup | `/api/backup/*` | Admin |

---

## 10. Automated jobs & background services

| Job | Typical schedule | Purpose |
|-----|------------------|---------|
| Session auto-close | ~18:35 daily | Deactivate stale mobile sessions |
| Production auto-finish | ~18:30 daily | Close open cycles |
| WIP auto-close | End of day | Carry closing WIP to next day |
| Missed-action cleanup | Periodic | Remove old acknowledged items |
| Alert checks | Hourly | Generate efficiency, idle, target alerts |
| File watcher | On startup | Ingest workstation JSON into database |
| DB backup | Scheduled / manual | SQL backups to `backend/data/backups` |

---

## Quick start by role

| I am a… | Start here |
|---------|------------|
| Operator | Line Setup logs me in → machine tablet at `/mobile/{machine}/{code}` |
| Line supervisor | Line Setup → Production Tracker → Login Logs |
| Planner | Production Planning → Line Schedule |
| IED | Production Routing → Production Tracker |
| Management | TV Dashboard → Reports |
| Admin | Users & Roles → Masters → Monitoring |

---

## Document info

- **Applies to:** ProdPulse codebase (`shoe-factory-monitoring`)
- **Permissions:** Runtime values from database override static defaults in code
- **For technical setup:** see project README and environment configuration in `backend/`

*Last updated: June 2026*
