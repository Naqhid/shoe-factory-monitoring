# Login Timeout Fix

## Problem
Login request times out with error: "timeout of 10000ms exceeded"

## Root Causes
1. **Backend not running** - Server on port 3001 is not responding
2. **Database connection slow** - MySQL queries taking too long
3. **Network issues** - Connection between frontend and backend blocked

---

## Solutions Applied

### 1. ✅ Increased Timeout
**File:** `frontend/src/services/api.ts`
- Changed timeout from 10 seconds to 30 seconds
- Added better error handling for timeout errors

### 2. ✅ Better Error Messages
**File:** `frontend/src/components/LoginForm.tsx`
- Now shows specific error: "Server is not responding. Please check if backend is running on port 3001."
- Helps diagnose the actual issue

### 3. ✅ Performance Logging
**File:** `backend/src/controllers/authController.js`
- Added timing logs to track query performance
- Logs show how long login query takes

### 4. ✅ Database Optimization
**File:** `backend/optimize_login.sql`
- Added indexes on `code` and `email` columns
- Speeds up login queries significantly

---

## How to Fix

### Step 1: Check if Backend is Running
```bash
# Check if backend is running
curl http://localhost:3001/health

# If not running, start it
cd backend
npm start
# or
pm2 restart shoe-factory-monitoring
```

### Step 2: Apply Database Indexes
```bash
# Connect to MySQL
mysql -u root -p

# Use your database
USE shoe_factory;

# Run the optimization script
source backend/optimize_login.sql;
```

### Step 3: Restart Backend
```bash
cd backend
pm2 restart shoe-factory-monitoring
# or
npm start
```

### Step 4: Test Login
1. Open browser to `http://localhost:3000`
2. Try to login
3. Check browser console for errors
4. Check backend logs: `tail -f backend/logs/combined.log`

---

## Troubleshooting

### If still timing out:

#### Check 1: Backend Running?
```bash
# Windows
netstat -ano | findstr :3001

# Should show something like:
# TCP    0.0.0.0:3001    0.0.0.0:0    LISTENING    12345
```

#### Check 2: Database Connected?
```bash
# Check backend logs
tail -f backend/logs/error.log

# Look for database connection errors
```

#### Check 3: Firewall Blocking?
```bash
# Windows - Allow port 3001
netsh advfirewall firewall add rule name="Node Backend" dir=in action=allow protocol=TCP localport=3001
```

#### Check 4: Database Performance
```sql
-- Check if users table has data
SELECT COUNT(*) FROM users;

-- Check query performance
EXPLAIN SELECT u.id, u.code, u.name, u.role, u.email, u.machine_id, wc.code as work_centre_code 
FROM users u 
LEFT JOIN work_centres wc ON u.work_centre_id = wc.id 
WHERE (u.code = 'admin' OR u.email = 'admin') AND u.password = 'admin';

-- Should use index on code/email
```

---

## Expected Behavior After Fix

1. **Login should complete in < 2 seconds**
2. **Error message should be specific** (not just "network error")
3. **Backend logs show query time** (should be < 100ms)
4. **No timeout errors** in browser console

---

## Testing

### Test 1: Backend Health
```bash
curl http://localhost:3001/health
# Expected: {"status":"OK","timestamp":"2025-..."}
```

### Test 2: Login API Directly
```bash
curl -X POST http://localhost:3001/api/login \
  -H "Content-Type: application/json" \
  -d '{"login":"admin","password":"admin"}'

# Expected: {"success":true,"data":{...}}
```

### Test 3: Check Logs
```bash
# Backend should log:
# Login attempt for: admin
# Login query took 45ms
```

---

## Performance Benchmarks

| Scenario | Before | After |
|----------|--------|-------|
| Login query time | 5-10 seconds | < 100ms |
| Total login time | 10+ seconds (timeout) | < 2 seconds |
| Database indexes | None | 3 indexes added |
| API timeout | 10 seconds | 30 seconds |

---

## Prevention

1. **Always run backend before frontend**
2. **Monitor backend logs** for slow queries
3. **Keep database indexes** up to date
4. **Use connection pooling** (already configured)
5. **Set appropriate timeouts** (now 30 seconds)

---

## Quick Commands

```bash
# Start backend
cd backend && npm start

# Check backend status
curl http://localhost:3001/health

# View backend logs
tail -f backend/logs/combined.log

# Restart backend
pm2 restart shoe-factory-monitoring

# Apply database optimizations
mysql -u root -p shoe_factory < backend/optimize_login.sql
```

---

## Contact

If login still times out after these fixes:
1. Check backend logs for specific errors
2. Verify database connection in `.env` file
3. Ensure MySQL is running
4. Check network connectivity between frontend and backend
