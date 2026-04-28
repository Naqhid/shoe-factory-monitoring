# Shoe Factory Monitoring System

Short overview: this app helps supervisors and operators track shoe production in real time, monitor machine performance, and review daily productivity and cycle exceptions from one dashboard.

## What this app includes

- Real-time machine and line monitoring
- Production cycle tracking (start, running, finish, idle)
- Missed actions and inactive-time visibility
- Login/session logs for operator activity
- Production routing and planning management (with bulk Excel upload)
- Reports for efficiency and daily operations

## Tech stack

- Backend: Node.js, Express, MySQL
- Frontend: React, TypeScript, Tailwind CSS
- Data flow: API-driven dashboard + automated production data ingestion

## 🏗️ **Architecture**

```
Workstation Device → JSON Files → Backend Processing → Database → Frontend Dashboard
```

- **Backend**: Node.js + Express + MySQL (File processing & APIs)
- **Frontend**: React + TypeScript + Tailwind CSS (Real-time dashboard)
- **Database**: MySQL 8.0 (Railway hosted)
- **File Processing**: Automated JSON ingestion with chokidar

## 🚀 **Quick Start**

### **Prerequisites**
- Node.js 18+ LTS
- MySQL 8.0 (or Railway account)
- Git

### **1. Clone Repository**
```bash
git clone https://github.com/Naqhid/shoe-factory-monitoring.git
cd shoe-factory-monitoring
```

## 🔧 **Backend Setup**

### **1. Install Dependencies**
```bash
cd backend
npm install
```

### **2. Database Setup**
```bash
# Connect to MySQL and run:
mysql -u root -p < database_setup.sql
```

### **3. Environment Configuration**
Create `.env` file in backend directory:
```env
DB_HOST=your_mysql_host
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=shoe_factory
PORT=3001
NODE_ENV=production
INCOMING_DIR=E:/Florence-IOT/incoming
SUCCESS_DIR=E:/Florence-IOT/success
FAILURE_DIR=E:/Florence-IOT/failure
LOGS_DIR=E:/Florence-IOT/logs
```

### **4. Start Backend**
```bash
# Development
npm start

# Production with PM2
npm run pm2:start
```

**Backend runs on:** `http://localhost:3001`

## 🎨 **Frontend Setup**

### **1. Install Dependencies**
```bash
cd frontend
npm install
```

### **2. Start Development Server**
```bash
npm run dev
```

**Frontend runs on:** `http://localhost:3000`

### **3. Build for Production**
```bash
npm run build
```

## 📊 **API Endpoints**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/machines/status` | GET | Latest status per machine |
| `/api/reports/run-idle?date=YYYY-MM-DD` | GET | Run vs idle minutes |
| `/api/reports/hourly?date=YYYY-MM-DD` | GET | Hourly event analysis |
| `/api/reports/efficiency?date=YYYY-MM-DD` | GET | Machine efficiency ranking |
| `/api/reports/overall-efficiency?date=YYYY-MM-DD` | GET | Factory-wide efficiency |
| `/api/missed-actions/daily-report?date=YYYY-MM-DD&line=LINE` | GET | Daily inactive/lost-minutes report |
| `/api/production-routing/bulk` | POST | Bulk create routing from parsed Excel rows |
| `/api/production-planning/bulk` | POST | Bulk create planning records from parsed Excel rows |
| `/health` | GET | System health check |

## 📁 **File Processing**

### **JSON Format**
```json
{
  "data": [
    { "machine_id": "US-01", "status": 1 },
    { "machine_id": "US-02", "status": 0 }
  ]
}
```

### **Processing Flow**
1. Drop JSON files in `incoming/` directory
2. Backend validates and processes automatically
3. Success → `success/` directory
4. Failure → `failure/` directory
5. Data inserted into MySQL with timestamps

## 🎛️ **Dashboard Features**

### **Real-time Monitoring**
- ✅ Live machine status (5-second refresh)
- ✅ Efficiency percentages per machine
- ✅ Overall factory efficiency
- ✅ Connection status indicator
- ✅ Auto-refresh timestamps

### **Interactive Elements**
- 🖱️ Click machine cards for detailed view
- 💡 Hover tooltips on status icons
- 📊 Efficiency ranking charts
- 📱 Responsive design (mobile/tablet/desktop)
- 📁 Excel template preview/download and bulk import for routing/planning
- 📉 Daily lost-minutes analysis by line and machine

### **Visual Indicators**
- 🟢 **Running** (Status 1): Machine producing
- 🔴 **Idle** (Status 0): Machine stopped
- 🏆 **90%+**: Excellent efficiency
- ⚠️ **<70%**: Needs attention

## 🛠️ **Tech Stack**

### **Backend**
- **Runtime**: Node.js 18+ LTS
- **Framework**: Express.js
- **Database**: MySQL 8.0 with mysql2/promise
- **File Watching**: Chokidar
- **Logging**: Winston
- **Process Manager**: PM2
- **Environment**: dotenv

### **Frontend**
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Data Fetching**: React Query + Axios
- **Charts**: Recharts
- **Icons**: Lucide React
- **Notifications**: React Hot Toast

## 📱 **Responsive Design**

- **Desktop (1200px+)**: 4-column machine grid + sidebar charts
- **Tablet (768-1199px)**: 2-column grid + stacked charts
- **Mobile (320-767px)**: Single column + touch-optimized

## 🔒 **Security & Best Practices**

- ✅ Environment variables for secrets
- ✅ CORS protection
- ✅ Input validation
- ✅ Transaction-safe database operations
- ✅ Error handling and logging
- ✅ Graceful shutdown support

## 📈 **Production Deployment**

### **Backend (PM2)**
```bash
cd backend
npm run pm2:start
pm2 save
pm2 startup
```

### **Frontend (Static Hosting)**
```bash
cd frontend
npm run build
# Deploy dist/ folder to your hosting service
```

## 🧪 **Testing**

### **Backend Testing**
```bash
# Test file processing
cp sample_data.json incoming/

# Check API endpoints
curl http://localhost:3001/health
curl http://localhost:3001/api/machines/status
```

### **Frontend Testing**
```bash
# Start development server
npm run dev

# Access dashboard
open http://localhost:3000
```

## 📊 **Database Schema**

```sql
CREATE TABLE stitching_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    machine_id VARCHAR(20) NOT NULL,
    status TINYINT(1) NOT NULL,
    event_time DATETIME NOT NULL,
    source_file VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 🤝 **Contributing**

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 **License**

This project is licensed under the MIT License.

## 👨‍💻 **Author**

**Naqhid** - [GitHub](https://github.com/Naqhid)

---

**Built with ❤️ for modern manufacturing efficiency**