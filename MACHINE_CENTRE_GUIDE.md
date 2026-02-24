# Machine Centre Production Monitoring - Setup Guide

## Quick Setup

### 1. Setup Database
```bash
cd backend
node setup-machine-centre.js
```

### 2. Restart Backend
```bash
npm start
```

### 3. Access System
Open on mobile: `https://192.168.1.11:3000/mobile/machine-centre`

---

## How It Works

### Step 1: Scan Machine QR Code
- Machine QR contains: `{"workCentreId": 101, "machineId": 12}`
- System fetches production plan for today

### Step 2: Scan Employee QR Code
- Employee QR contains: `{"emp_id": "EMP001"}`
- System calculates target mins from SMV
- Production session starts automatically

### Step 3: Production Monitoring
Screen shows:
- Line name & Operator name
- Target Time vs Actual Time
- Output pairs
- Efficiency %
- Status (Idle/Low/On-track)

### Step 4: Control Buttons
- **START**: Resume after stop
- **STOP**: Pause production (tracks idle time)
- **FINISH**: Complete session (enter output pairs)

---

## Data Flow

```
Production Planning → Fetch Target + SMV
         ↓
Generate Machine QR (static)
         ↓
Scan Machine QR → Scan Employee QR
         ↓
START Production
         ↓
Timer increments every minute
         ↓
STOP (idle tracking) or FINISH
         ↓
Save to machine_centre_app
         ↓
Aggregate to pivot_data
```

---

## Status Logic

- **Idle**: STOP button pressed
- **Low**: Efficiency < 80%
- **On-track**: Efficiency ≥ 80%

## Efficiency Formula

```
Efficiency % = (Actual Time / Target Time) × 100
```

---

## Database Tables

### machine_centre_app (Raw Logs)
- Stores each production session
- Tracks start/stop/finish times
- Records idle duration
- Updates actual_time every minute

### pivot_data (Aggregated)
- Daily summary per machine
- Total output, target, actual time
- Cumulative average time per 12 pairs
- Average efficiency %

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/machine-centre/start` | POST | Start production |
| `/api/machine-centre/stop` | POST | Stop (idle) |
| `/api/machine-centre/resume` | POST | Resume after stop |
| `/api/machine-centre/finish` | POST | Finish session |
| `/api/machine-centre/status/:machineId` | GET | Get current status |
| `/api/machine-centre/update-time` | POST | Update timer (auto) |
| `/api/machine-centre/plan/:workCentreId/:machineId` | GET | Get production plan |

---

## QR Code Generation

### Machine QR (Static - print and paste on machine)
```json
{
  "workCentreId": 101,
  "machineId": 12
}
```

### Employee QR (From employee master)
```json
{
  "emp_id": "EMP001"
}
```

---

## Troubleshooting

**No production plan found**
→ Check production_planning table has entry for today

**SMV not calculated**
→ Check production_routing has SMV for the style

**Timer not updating**
→ Check button_status = 1 (running)

**Efficiency shows 0%**
→ Check target_mins > 0

---

## Mobile Access

URL: `https://192.168.1.11:3000/mobile/machine-centre`

Ensure:
- HTTPS certificate installed on mobile
- Backend running on port 3001
- Frontend running on port 3000
