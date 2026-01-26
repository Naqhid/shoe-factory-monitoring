# Mobile App - Line Setup & Live Dashboard

## Overview

The Mobile App module is a dedicated application for supervisors and line in-charge personnel on the shop floor. It provides:

1. **Line Setup** - Employee assignment to machines with shift tracking
2. **Live Dashboard** - Real-time monitoring of production metrics by work centre

---

## Mobile App Features

### 1. Line Setup Form

**Purpose**: Register employee to machine assignment at the start of shift

**Fields**:
- **Employee** - Select employee from dropdown (required)
- **Machine ID** - Enter or select machine ID (e.g., US-01) (required)
- **Login Date & Time** - Auto-populated with current date/time (required)
- **Work Centre** - Select work centre (required)
- **Machine Centre** - Select machine centre (required)
- **SMV per Pair** - Standard Minute Value for the operation (required)

**Actions**:
- Clicking "Start Shift" creates a line setup record
- Redirects to Live Dashboard after successful creation
- Shows success/error toast notifications

**Response**: Stores data in `line_setup` table with `login_date_time`

---

### 2. Live Dashboard

**Purpose**: Real-time monitoring of production performance by work centre

**Features**:

#### Refresh Control
- Manual refresh button to update data
- Auto-refresh every 30 seconds via React Query

#### Date & Time Display
- Shows current date and time
- Helps track shift timing

#### Work Centre Filter
- Dropdown to filter by work centre
- "All Work Centres" option for overview

#### Performance Metrics (per Work Centre)

**Statistics Cards**:
- **Target**: Total target pairs for the day
- **Output**: Current number of pairs produced (status = 1)
- **Output %**: (Output / Target) × 100
- **Efficiency %**: (Output × SMV per pair) / (Employees × Man Hours)
- **Employees**: Active employees assigned to the line
- **Avg SMV**: Average Standard Minute Value

**Visual Feedback**:
- Color-coded cards (blue, green, purple, indigo, orange, pink)
- Progress bar showing output achievement
- Real-time status updates

#### Machine Status Section
- Individual machine cards showing:
  - Machine ID
  - Current status (Running / Idle)
  - Last event time
  - Green background for Running
  - Red background for Idle
  - Play/Square icons for visual indication

---

## Data Flow

```
Line Setup Form
    ↓
POST /api/line-setup
    ↓
Insert into line_setup table
    ↓
Redirect to Live Dashboard
    ↓
Fetch work centre data: GET /api/dashboard/daily?date=YYYY-MM-DD
    ↓
Fetch machine status: GET /api/machine-status
    ↓
Display real-time metrics
```

---

## API Endpoints Used

### Line Setup Management
```
POST /api/line-setup
GET /api/line-setup
GET /api/line-setup/:id
PUT /api/line-setup/:id
DELETE /api/line-setup/:id
```

### Live Dashboard Data
```
GET /api/dashboard/daily?date=YYYY-MM-DD
  Response: Array of work centre metrics

GET /api/machine-status
  Response: Latest machine status for all machines
```

### Master Data
```
GET /api/masters/employees
GET /api/masters/work_centres
GET /api/masters/machine_centres
```

---

## Calculation Formulas

### Output %
```
Output % = (Output / Target) × 100
```

### Efficiency %
```
Efficiency % = (Output × SMV per pair) / (Number of Employees × Man Hours in minutes) × 100
```

**Example**:
- Output: 100 pairs
- SMV: 0.25 minutes per pair
- Employees: 5
- Man Hours: 480 minutes

Efficiency = (100 × 0.25) / (5 × 480) × 100 = 10.42%

---

## User Interface Design

### Mobile-Optimized Layout
- Large touch targets (minimum 44px)
- Readable font sizes (base 16px)
- Full-width inputs on mobile
- Swipe-friendly navigation

### Color Scheme
- Primary: Blue (#2563EB)
- Success: Green (#16A34A)
- Warning: Orange (#EA580C)
- Error: Red (#DC2626)
- Secondary: Purple, Indigo, Pink

### Navigation
- Back button (←) to return
- Refresh button to update data
- Filter dropdown for work centre selection

---

## Device Compatibility

- **Minimum Screen Width**: 320px (mobile)
- **Responsive Breakpoints**:
  - Mobile: 320px - 640px
  - Tablet: 641px - 1024px
  - Desktop: 1025px+

---

## Key Features

✅ **Real-time Monitoring** - Data refreshes every 30 seconds
✅ **Line Setup Management** - Quick employee assignment
✅ **Performance Metrics** - Key KPIs at a glance
✅ **Machine Status Tracking** - Live machine state
✅ **Work Centre Filtering** - Focus on specific lines
✅ **Mobile-First Design** - Optimized for shop floor use
✅ **Offline Support** - Shows cached data while offline
✅ **Error Handling** - User-friendly error messages

---

## Integration Points

1. **Line Setup Table**
   - Stores employee-machine assignments
   - Tracks login/logout times
   - Links to employees, machines, and work centres

2. **Dashboard Calculations**
   - Aggregates stitching_events by work centre
   - Integrates production_plan targets
   - Calculates efficiency from line_setup SMV values

3. **Master Data**
   - Employee information
   - Machine centre details
   - Work centre hierarchy

---

## Future Enhancements

- [ ] Logout form to record shift end time
- [ ] QR code scanning for employee/machine selection
- [ ] Photo capture for quality issues
- [ ] Offline data sync
- [ ] Push notifications for alerts
- [ ] Operator comments/notes
- [ ] Multi-language support

---

## Support & Documentation

For backend API documentation, see: `/api/dashboard/daily` and `/api/line-setup` endpoints

For mobile app troubleshooting:
- Check network connectivity
- Verify API endpoint configuration
- Ensure master data is populated
- Check browser console for errors