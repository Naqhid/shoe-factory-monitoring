# Shoe Factory Monitoring Dashboard

A responsive React TypeScript dashboard for monitoring shoe factory machine status and efficiency.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- Backend server running on `http://localhost:3001`

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## 📱 Features

### Responsive Design
- **Desktop**: Full dashboard with sidebar efficiency chart
- **Tablet**: 2-column machine grid, stacked charts
- **Mobile**: Single column layout, optimized for touch

### Real-time Monitoring
- **Machine Status**: Live updates every 5 seconds
- **Efficiency Metrics**: Updates every 30 seconds
- **Connection Status**: Visual indicator in header
- **Auto-refresh**: Automatic data polling

### Dashboard Components
- **Header**: Company branding, current time, connection status
- **Stats Panel**: Overview metrics (running/idle machines, efficiency, events)
- **Machine Cards**: Individual machine status with efficiency percentage
- **Efficiency Chart**: Ranked bar chart with color-coded performance
- **Error Handling**: Connection error states with retry functionality

## 🎨 Design System

### Colors
- **Running**: Green (#22C55E)
- **Idle**: Red (#EF4444) 
- **Warning**: Yellow (#F59E0B)
- **Info**: Blue (#3B82F6)

### Efficiency Levels
- **🏆 90-100%**: Excellent (Green)
- **🥈 80-89%**: Good (Yellow)
- **🥉 70-79%**: Average (Orange)
- **⚠️ <70%**: Poor (Red)

## 📊 API Integration

The dashboard connects to these backend endpoints:
- `GET /api/machines/status` - Real-time machine status
- `GET /api/reports/efficiency?date=YYYY-MM-DD` - Efficiency report
- `GET /api/reports/overall-efficiency?date=YYYY-MM-DD` - Overall metrics

## 🛠 Tech Stack

- **React 18** with TypeScript
- **Vite** for fast development
- **Tailwind CSS** for styling
- **React Query** for data fetching
- **Recharts** for data visualization
- **Lucide React** for icons
- **Date-fns** for date handling

## 📱 Responsive Breakpoints

- **Mobile**: 320px - 767px (1 column)
- **Tablet**: 768px - 1199px (2 columns)
- **Desktop**: 1200px+ (4 columns + sidebar)

## 🔧 Configuration

Update API base URL in `src/services/api.ts`:
```typescript
const API_BASE = 'http://localhost:3001/api';
```

## 🚀 Deployment

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

The built files will be in the `dist/` directory, ready for deployment to any static hosting service.