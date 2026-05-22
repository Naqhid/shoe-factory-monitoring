# ProdPulse Demo Walkthrough (Business + Calculations)

This document is a demo-day guide for explaining the full software in plain language, including how key numbers are calculated.

---

## 1) What This Software Does

ProdPulse is a production monitoring platform for shoe manufacturing that combines:

- Real-time machine/session tracking
- Planning and routing masters
- Manual production corrections (with audit trail)
- Alerting and missed-action monitoring
- Production tracker and TV dashboard views
- Downloadable operational reports

Core value: supervisors can see **target vs actual**, identify bottlenecks early, and act before end-of-shift misses.

---

## 2) High-Level Architecture

Data flow:

1. Operator/session activity and production events are recorded.
2. Backend APIs write/read MySQL tables (`machine_centre_production`, `machine_centre_summary`, `mobile_sessions`, `production_plan`, etc.).
3. Frontend dashboards poll APIs and show live KPIs.
4. Alert engine runs checks and updates realtime alert center.

Stack:

- Backend: Node.js + Express + MySQL
- Frontend: React + TypeScript + Tailwind

---

## 3) Main User Areas (What to Show in Demo)

## 3.1 Overview / TV Dashboard

Shows top KPIs and line-level status:

- Today Target
- Produced
- Efficiency
- WIP
- Line cards
- Bottleneck list

Special rule already implemented:

- For line 2A top output, end-of-line machine (`machine_id = '07'`) is used as source of truth for produced pairs.

## 3.2 Production Tracker

Operational control panel:

- Target/progress risk projection
- Intraday pacing (`expected by now`, `current rate`, `required rate`, `projected EOD`)
- Alerts card (now aligned with Alert Center unacknowledged count)
- Line cards and drilldown

## 3.3 Manual Production Entry

Used by supervisors/admin to add or adjust completed cycles with:

- Validation (date/time, employee, machine, output)
- Overlap checks
- Conflict highlighting
- Audit logs + restore

## 3.4 Realtime Alert Center

Shows warning/critical conditions with:

- Group duplicates
- Acknowledge flow
- SLA aging labels
- Auto-refresh
- Machine id + machine name in alert messages

## 3.5 Masters / Planning / Routing

Admin/planner setup modules:

- Customers, groups, leather, styles, colors
- Work centres, machine centres, employees, users, roles
- Production planning + routing (including bulk upload)

## 3.6 Logs / Missed Actions / Monitoring

- Session and machine activity logs
- Missed-actions dashboard
- Monitoring/health views

---

## 4) Role Access (Demo Notes)

Roles configured in app:

- Admin
- Line Supervisor
- Machine Centre User
- IED
- Planner
- Unit Head

Each role sees only allowed menus. Example:

- Machine Centre User defaults to mobile flow
- Planner can access planning/master data needed for target setup

---

## 5) Key Calculations (Most Important Demo Section)

Below are the formulas users usually ask about.

## 5.1 Output %

Used widely in dashboard/line cards.

Formula:

`output_percentage = (actual_output / target_output) * 100`

If target is 0, output % is shown as 0 to avoid divide-by-zero.

## 5.2 Efficiency %

Machine/line efficiency uses target time vs actual time.

Common formula:

`efficiency_percent = (total_target_mins / total_actual_mins) * 100`

Where:

- `total_target_mins`: planned/standard minutes
- `total_actual_mins`: actual elapsed production minutes

Important behavior:

- Efficiency can exceed 100% if actual mins are lower than target mins.
- In TV dashboard, when output basis is EOL machine, efficiency basis is aligned to that same source.

## 5.3 Intraday Pace (Production Tracker)

Shift window from env (default approx 9:00 to 17:30).

Definitions:

- `elapsed_fraction = elapsed_mins / total_shift_mins`
- `expected_by_now = round(target * elapsed_fraction)`
- `gap = actual - expected_by_now`
- `pace_rate = round((actual / expected_by_now) * 100)` (if expected > 0)
- `projected_eod = round((actual / elapsed_mins) * total_shift_mins)`
- `current_rate_per_hour = round(actual / elapsed_mins * 60)`
- `required_rate_per_hour = round(max(0, target - actual) / remaining_mins * 60)`

Interpretation:

- Negative gap means behind pace.
- Projected EOD compares likely shift-end output vs target.

## 5.4 WIP

Shown as remaining quantity:

`wip = max(0, target - output)`

## 5.5 Bottleneck & Breakdown (TV)

TV shows supervisor-logged events for the selected line today:

- **Bottleneck**: `BOTTLENECK:` entries (excluding machine-breakdown reasons)
- **Breakdown**: active machine stops with breakdown reason, `BREAKDOWN:` entries, or bottleneck entries tagged as machine breakdown

All matching events for the day are listed (not limited to top 3).

## 5.6 Alert SLA Labels

Alert-center badges are time-age based:

- Open
- SLA Warning
- SLA Breach

with special handling for heartbeat/no-cycle-update alerts.

---

## 6) Data Integrity and Safety Rules

## 6.1 Manual Entry Restrictions

Manual entry is blocked when:

- required fields missing
- finish <= start
- machine/employee not valid for selected line
- active cycle overlaps manual time window (same machine + employee + day)
- finished-cycle overlap on same machine

## 6.2 Overlap Rule

Finished cycles on same machine cannot overlap.

Allowed:

- touching boundary (`previous_finish == next_start`)

Blocked:

- any interval overlap

This is enforced in API, and migration SQL exists for DB trigger-level enforcement.

## 6.3 Auditability

Manual create/update/delete actions are written to audit logs with before/after snapshots and actor info.

---

## 7) Alert Behavior (Current)

Implemented behavior includes:

- stale machine-offline alerts resolved when machine becomes active
- machine name included in alert context
- bell count and tracker alert card count aligned with realtime alert center unacknowledged count
- heartbeat/no-cycle-update tuned to avoid false positives while cycle is still within expected target window

---

## 8) Suggested Demo Flow (10–15 min)

1. **Overview/TV Dashboard**  
   Explain target/output/efficiency and line cards.

2. **Production Tracker**  
   Show single consolidated risk card and pace math (`Now`, `Need`, `EOD`).

3. **Alert Center**  
   Show grouped duplicates, acknowledge flow, machine-name context.

4. **Manual Entry**  
   Add/edit a record; explain overlap validation + audit logs.

5. **Reports**  
   Export/filter example.

6. **Role-based access**  
   Mention planner/supervisor/mobile user segmentation.

---

## 9) FAQ-Style Talking Points

- **Why can efficiency be >100%?**  
  Because efficiency is target mins divided by actual mins. Faster-than-standard cycles can exceed 100%.

- **Why does alert count match page count now?**  
  Both use the same center endpoint and unacknowledged filtering.

- **Can users edit wrong past entries safely?**  
  Yes, with validations + overlap checks + audit log trail.

- **How do we avoid stale offline warnings?**  
  Offline alerts are resolved/hidden once active session is detected.

---

## 10) Pre-Demo Checklist

- Backend running and connected to DB
- Frontend running
- At least one active session in `mobile_sessions`
- Production plan exists for demo date/line
- Alert center has sample entries
- Manual entry form tested for both valid and invalid overlap case

---

If needed, this document can be converted into a slide deck structure directly.
