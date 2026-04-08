# ProdPulse System Monitoring Dashboard

**URL:** http://192.168.5.47:3000/monitoring  
**Access:** Admin only  
**Auto-refresh:** Every 15 seconds

---

## What is it?

The Monitoring Dashboard is a real-time system health and performance page built into ProdPulse. It gives administrators a live view of the backend server's health, database connectivity, memory usage, and API traffic — all in one place without needing any external tools.

It pulls data from the backend endpoint `GET /health/detailed` every 15 seconds.

---

## Sections Explained

### 1. Status Badge (top right of title)
Shows the overall system health at a glance.

| Badge | Meaning |
|-------|---------|
| `healthy` | All checks passing — database connected, no issues |
| `degraded` | One or more checks failing — needs attention |

---

### 2. Stat Cards

| Card | What it shows |
|------|--------------|
| Uptime | How long the backend server has been running since last restart |
| Total Requests | Total API calls handled since server started |
| Avg Response | Average API response time. Also shows p95 (95% of requests are faster than this) |
| Errors Logged | Count of errors and warnings written to the Winston log files |

---

### 3. Health Checks

#### Database
- Pings the MySQL database with a `SELECT 1` query
- Shows response time in milliseconds
- Status `ok` means the database is reachable and responding
- Status `error` means the backend cannot connect to MySQL — production data will not load

#### Disk
- Checks available disk space on the server PC (192.168.5.47) where the backend is running
- Shows percentage used and free space in MB
- Status turns `warn` if disk usage exceeds 90%

#### Memory
- Shows Node.js process memory usage
- **Heap Used / Heap Total** — JavaScript memory actively in use vs allocated
- **RSS** — Total memory the process is using including Node internals
- The progress bar shows heap utilisation at a glance

---

### 4. Recent Requests Table

Shows the last 20 API requests made to the backend in reverse chronological order.

| Column | Meaning |
|--------|---------|
| Time | When the request was received |
| Method | HTTP method — GET (read), POST (create), PUT (update), DELETE (remove) |
| URL | The API endpoint that was called |
| Status | HTTP response code (200 = success, 304 = cached, 401 = unauthorised, 500 = server error) |
| Duration | How long the server took to respond in milliseconds |
| IP | The client IP address that made the request |

**Row colours:**
- White — successful request (2xx)
- Yellow — client error (4xx), e.g. unauthorised or not found
- Red — server error (5xx), e.g. database failure or unhandled exception

**Common status codes you'll see:**
- `200` — Request succeeded
- `201` — Record created successfully
- `304` — Response unchanged, browser used cached data (normal, not an error)
- `401` — JWT token missing or expired — user needs to log in again
- `400` — Bad request, e.g. duplicate entry or missing fields
- `500` — Server error — check the error logs

---

### 5. Process Info

| Field | Meaning |
|-------|---------|
| PID | Operating system process ID of the backend server |
| Node | Node.js version running the backend |
| Log Level | Current Winston logging level (`info` in normal operation) |
| CPU Load (1m) | Server CPU load average over the last 1 minute. `0.00` means idle |

---

## Backend Health Endpoints

The dashboard uses these backend endpoints directly:

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | Simple liveness check — returns `{status: "OK"}`. Used by uptime monitors |
| `GET /health/detailed` | Full health report — used by the monitoring dashboard |
| `GET /health/metrics` | Lightweight metrics only — for polling without full check overhead |

These endpoints do **not** require JWT authentication so they can be used by external monitoring tools.

---

## Log Files

Winston writes structured logs to the server at:

| File | Contains |
|------|---------|
| `backend/logs/combined.log` | All requests and events (info, warn, error) |
| `backend/logs/error.log` | Errors only |

Logs rotate automatically at 10MB (error) and 20MB (combined), keeping the last 7 files.

---

## What to do when something looks wrong

| Symptom | Action |
|---------|--------|
| Status shows `degraded` | Check the Database and Disk check sections for the specific failure |
| Database status `error` | Verify MySQL is running on the server. Check `DB_HOST`, `DB_USER`, `DB_PASSWORD` in `backend/.env` |
| High error rate | Look at the Recent Requests table for red rows — note the URL and status code |
| Errors Logged count rising | Check `backend/logs/error.log` for stack traces |
| Disk `warn` | Free up space on the server — logs or old data files may need archiving |
| High memory (heap near 100%) | Restart the backend server with `pm2 restart shoe-factory-monitoring` |
| Slow avg response time | Check if the database is under load or if a specific endpoint is slow (visible in the requests table) |
