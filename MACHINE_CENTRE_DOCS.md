# Machine Centre Production Monitoring System - Complete Documentation

## 📋 Overview

A production-ready system for real-time machine centre monitoring with dynamic status tracking, timer management, and efficiency calculations.

---

## 🎯 System Requirements Implementation

### ✅ Header Section
Displays all required information:
- **Line Name** (e.g., Line 1 – OP1 – Jeevan P)
- **Work Centre ID**
- **Machine ID**
- **Operator Name**
- **Current Date & Time** (auto-updates every second)

### ✅ Production Metrics Section
Grid layout with 6 key metrics:
1. **Target Time (mins)** - Blue card
2. **Actual Time (mins)** - Purple card (auto-increments every minute)
3. **Target Pairs** - Green card (default: 12)
4. **Total Output** - Orange card (cumulative)
5. **Average Efficiency %** - Indigo card (calculated: actual/target × 100)
6. **Status** - Dynamic color-coded card

### ✅ Status Logic (Auto-updates every minute)
```typescript
Idle → If button_status = 3 OR no activity for 5 minutes
Low → (Actual Mins / Target Mins × 100) < 80%
On-track → (Actual Mins / Target Mins × 100) >= 80%
```

**Color Coding:**
- 🟢 **On-track** = Green background
- 🔴 **Low** = Red background
- ⚪ **Idle** = Gray background

### ✅ Timer Logic

#### START Button (button_status = 1)
- Sets `actual_time = 0`
- Captures `start_time = NOW()`
- Starts 1-minute interval timer
- Disables START button
- Enables STOP and FINISH buttons

#### STOP Button (button_status = 3)
- Captures `idle_start_time = NOW()`
- Pauses timer
- Sets `button_status = 3`
- Shows only START button

#### FINISH Button (button_status = 2)
- Prompts for output pairs
- Captures `finish_time = NOW()`
- Calculates final `actual_time`
- Adds to cumulative output
- Aggregates to pivot_data table
- Redirects to mobile home

### ✅ Button Status Mapping
```
1 = START (Running)
2 = FINISH (Completed)
3 = STOP (Idle/Paused)
```

---

## 🗄️ Database Structure

### machine_centre_app Table
```sql
CREATE TABLE machine_centre_app (
    id INT AUTO_INCREMENT PRIMARY KEY,
    prod_date DATE NOT NULL,
    work_centre_id INT NOT NULL,
    machine_id INT NOT NULL,
    emp_id VARCHAR(10) NOT NULL,
    
    output_pairs INT DEFAULT 0,
    target_pairs INT DEFAULT 12,          -- NEW FIELD
    target_mins INT NOT NULL,
    
    start_time DATETIME,
    finish_time DATETIME,
    
    idle_start_time DATETIME,
    idle_stop_time DATETIME,
    idle_duration INT DEFAULT 0,
    
    actual_time INT DEFAULT 0,
    button_status INT DEFAULT 1,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### pivot_data Table (Aggregated)
```sql
CREATE TABLE pivot_data (
    id INT AUTO_INCREMENT PRIMARY KEY,
    prod_date DATE NOT NULL,
    work_centre_id INT NOT NULL,
    machine_id INT NOT NULL,
    emp_id VARCHAR(10) NOT NULL,
    
    total_output_pairs INT DEFAULT 0,
    total_target_pairs INT DEFAULT 0,    -- NEW FIELD
    total_target_mins INT DEFAULT 0,
    total_actual_time INT DEFAULT 0,
    
    cumulative_avg_time DECIMAL(10,2) DEFAULT 0,
    avg_efficiency DECIMAL(5,2) DEFAULT 0,
    
    UNIQUE KEY unique_machine_date (machine_id, prod_date, work_centre_id)
);
```

---

## 🔧 API Endpoints

### 1. Start Production
```http
POST /api/machine-centre/start
Content-Type: application/json

{
  "workCentreId": 1,
  "machineId": 101,
  "empId": "EMP001",
  "targetMins": 60,
  "targetPairs": 12
}

Response: { "success": true, "id": 123 }
```

### 2. Stop Production (Idle)
```http
POST /api/machine-centre/stop
Content-Type: application/json

{ "id": 123 }

Response: { "success": true }
```

### 3. Resume Production
```http
POST /api/machine-centre/resume
Content-Type: application/json

{ "id": 123 }

Response: { "success": true }
```

### 4. Finish Production
```http
POST /api/machine-centre/finish
Content-Type: application/json

{
  "id": 123,
  "outputPairs": 12,
  "targetPairs": 12
}

Response: { "success": true }
```

### 5. Get Machine Status
```http
GET /api/machine-centre/status/:machineId

Response: {
  "success": true,
  "data": {
    "id": 123,
    "machine_id": 101,
    "work_centre_id": 1,
    "emp_id": "EMP001",
    "operator_name": "John Doe",
    "line_name": "Line 1 - OP1",
    "target_mins": 60,
    "target_pairs": 12,
    "actual_time": 45,
    "output_pairs": 10,
    "button_status": 1,
    "updated_at": "2024-01-15T10:30:00Z"
  }
}
```

### 6. Update Actual Time (Auto-called every minute)
```http
POST /api/machine-centre/update-time
Content-Type: application/json

{ "id": 123 }

Response: { "success": true }
```

### 7. Get Production Plan
```http
GET /api/machine-centre/plan/:workCentreId/:machineId

Response: {
  "success": true,
  "data": {
    "smv": 5.0,
    "target_per_hour": 12,
    "style_name": "Style A",
    "customer_name": "Customer X"
  }
}
```

---

## 🎨 UI Components

### Header Section
- Compact 5-column grid on desktop
- 2-column grid on mobile
- Real-time clock updates every second
- Gradient blue background

### Metrics Cards
- 6 large metric cards in 3-column grid (2-column on mobile)
- Large numbers (3xl-5xl font size) for factory visibility
- Color-coded borders and backgrounds
- Responsive padding

### Control Buttons
- Large touch-friendly buttons (py-5 to py-6)
- Color-coded: Green (START), Yellow (STOP), Blue (FINISH)
- Active state scaling for tactile feedback
- Uppercase text with tracking

---

## 🔄 State Management

### React State Variables
```typescript
const [sessionId, setSessionId] = useState<number | null>(null);
const [status, setStatus] = useState<ProductionStatus | null>(null);
const [currentTime, setCurrentTime] = useState(new Date());
const [scanning, setScanning] = useState(!machineId);
const [empScanning, setEmpScanning] = useState(false);
```

### Auto-refresh Logic
```typescript
// Timer updates every 60 seconds when running
useEffect(() => {
  if (sessionId && status?.button_status === 1) {
    const interval = setInterval(async () => {
      await axios.post(`${API_BASE}/machine-centre/update-time`, { id: sessionId });
      fetchStatus();
    }, 60000);
    return () => clearInterval(interval);
  }
}, [sessionId, status]);

// Clock updates every second
useEffect(() => {
  const interval = setInterval(() => setCurrentTime(new Date()), 1000);
  return () => clearInterval(interval);
}, []);
```

---

## 📱 Responsive Design

### Breakpoints
- **Mobile**: < 768px (2-column metrics, stacked header)
- **Tablet**: 768px - 1199px (3-column metrics)
- **Desktop**: 1200px+ (3-column metrics, 5-column header)

### Touch Optimization
- Large button targets (min 44px height)
- Active state feedback
- No hover-dependent interactions
- Readable font sizes (minimum 14px)

---

## 🚀 Deployment Steps

### 1. Database Migration
```bash
# If existing database, run migration
mysql -u root -p shoe_factory < add-target-pairs-column-migration.sql

# If new database, run full schema
mysql -u root -p shoe_factory < machine_centre_schema.sql
```

### 2. Backend Deployment
```bash
cd backend
npm install
npm start

# Or with PM2
npm run pm2:start
```

### 3. Frontend Deployment
```bash
cd frontend
npm install
npm run build

# Deploy dist/ folder to hosting
```

---

## 🧪 Testing Checklist

### Functional Testing
- [ ] QR code scanning (machine + employee)
- [ ] START button creates new session
- [ ] Timer increments every minute
- [ ] STOP button pauses timer
- [ ] START resumes from stopped state
- [ ] FINISH prompts for output
- [ ] Status changes based on efficiency
- [ ] Idle detection after 5 minutes
- [ ] Data persists to database
- [ ] Pivot table aggregation works

### UI Testing
- [ ] Responsive on mobile (320px+)
- [ ] Responsive on tablet (768px+)
- [ ] Responsive on desktop (1200px+)
- [ ] Large numbers readable from distance
- [ ] Color coding clear and distinct
- [ ] Buttons easy to tap
- [ ] Clock updates smoothly
- [ ] No layout shifts

### Performance Testing
- [ ] Timer doesn't drift
- [ ] API calls don't block UI
- [ ] Database queries optimized
- [ ] No memory leaks
- [ ] Handles network errors gracefully

---

## 🐛 Troubleshooting

### Timer Not Updating
- Check browser console for API errors
- Verify sessionId is set
- Confirm button_status = 1
- Check network connectivity

### Status Not Changing
- Verify updated_at timestamp in database
- Check calculateStatus function logic
- Ensure efficiency calculation is correct

### Database Errors
- Run migration script if target_pairs column missing
- Check foreign key constraints
- Verify date format (YYYY-MM-DD)

---

## 📊 Efficiency Calculation

```typescript
// Frontend calculation
const efficiency = status.target_mins > 0 
  ? (status.actual_time / status.target_mins * 100) 
  : 0;

// Database calculation (pivot_data)
avg_efficiency = (SUM(actual_time) / SUM(target_mins)) * 100
```

---

## 🔐 Security Considerations

- ✅ No hardcoded credentials
- ✅ Environment variables for config
- ✅ Input validation on all endpoints
- ✅ SQL injection prevention (parameterized queries)
- ✅ Transaction-safe operations
- ✅ Error logging without exposing internals

---

## 📈 Future Enhancements

1. **Real-time WebSocket updates** (eliminate polling)
2. **Offline mode** with local storage sync
3. **Push notifications** for idle alerts
4. **Historical charts** for trend analysis
5. **Multi-language support**
6. **Dark mode** for night shifts
7. **Export reports** to PDF/Excel
8. **Barcode scanning** as alternative to QR

---

## 📞 Support

For issues or questions:
- Check logs: `backend/logs/error.log`
- Review API responses in browser DevTools
- Verify database schema matches documentation
- Test with sample data first

---

**Built for production-ready factory monitoring** 🏭
