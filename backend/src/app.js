require('dotenv').config();
const express = require('express');
const https = require('https');
const http = require('http');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const logger = require('./utils/logger');
const fileWatcherService = require('./services/fileWatcherService');
const apiController = require('./controllers/apiController');
const masterController = require('./controllers/masterController');
const productionRoutingController = require('./controllers/productionRoutingController');
const productionPlanningController = require('./controllers/productionPlanningController');
const lineSetupController = require('./controllers/lineSetupController');
const userRightsController = require('./controllers/userRightsController');
const authController = require('./controllers/authController');
const mobileProductionController = require('./controllers/mobileProductionController');
const mobileSessionController = require('./controllers/mobileSessionController');
const productionTrackerController = require('./controllers/productionTrackerController');
const machineCentreController = require('./controllers/machineCentreController');
const errorHandler = require('./middleware/errorHandler');

// Path resolution helper
const getAbsolutePath = (dirPath) => {
  if (!dirPath) return null;
  if (path.isAbsolute(dirPath)) return dirPath;
  // Resolve relative to the backend root (one level up from src)
  return path.resolve(__dirname, '..', dirPath);
};

// Create required directories
const createDirectories = () => {
  const incomingDir = getAbsolutePath(process.env.INCOMING_DIR || './data/incoming');
  const successDir = getAbsolutePath(process.env.SUCCESS_DIR || './data/processed');
  const failureDir = getAbsolutePath(process.env.FAILURE_DIR || './data/error');
  const logsDir = getAbsolutePath(process.env.LOGS_DIR || './logs');

  // Update process.env so other services get the absolute path
  process.env.INCOMING_DIR = incomingDir;
  process.env.SUCCESS_DIR = successDir;
  process.env.FAILURE_DIR = failureDir;
  process.env.LOGS_DIR = logsDir;

  const dirs = [incomingDir, successDir, failureDir, logsDir];

  dirs.forEach(dir => {
    if (dir && !fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logger.info(`Created directory: ${dir}`);
    }
  });
};

const app = express();
const PORT = process.env.PORT || 3001;

// Create directories on startup
createDirectories();

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  optionsSuccessStatus: 200
}));
app.use(express.json());

// Request logging for debugging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url} from ${req.ip} | Origin: ${req.get('Origin') || 'None'}`);
  next();
});

// Routes
app.get('/api/machines/status', apiController.getMachineStatus);
app.get('/api/reports/run-idle', apiController.getRunIdleReport);
app.get('/api/reports/hourly', apiController.getHourlyReport);
app.get('/api/reports/efficiency', apiController.getEfficiencyReport);
app.get('/api/reports/overall-efficiency', apiController.getOverallEfficiency);
app.get('/api/dashboard/daily', apiController.getDailyDashboardData);
app.get('/api/dashboard/overall-daily', apiController.getOverallDailyData);
app.post('/api/manual-event', apiController.createManualEvent);
app.post('/api/login', authController.login);

// Master routes
app.get('/api/masters/:table', masterController.getAll);
app.get('/api/masters/:table/:id', masterController.getById);
app.get('/api/masters/:table/code/:code', masterController.getByCode);
app.get('/api/masters/employees/emp_id/:empId', masterController.getByEmpId);
app.get('/api/masters/machine_centres/machine_id/:machineId', masterController.getByMachineId);
app.post('/api/masters/:table', masterController.create);
app.put('/api/masters/:table/:id', masterController.update);
app.delete('/api/masters/:table/:id', masterController.delete);

// Production routing routes
app.get('/api/production-routing', productionRoutingController.getAll);
app.get('/api/production-routing/:id', productionRoutingController.getById);
app.get('/api/production-routing/style/:styleId', productionRoutingController.getByStyleId);
app.post('/api/production-routing', productionRoutingController.create);
app.put('/api/production-routing/:id', productionRoutingController.update);
app.delete('/api/production-routing/:id', productionRoutingController.delete);

// Production planning routes
app.get('/api/production-planning', productionPlanningController.getAll);
app.get('/api/production-planning/:id', productionPlanningController.getById);
app.post('/api/production-planning', productionPlanningController.create);
app.put('/api/production-planning/:id', productionPlanningController.update);
app.delete('/api/production-planning/:id', productionPlanningController.delete);

// Line setup routes
app.get('/api/line-setup', lineSetupController.getAll);
app.get('/api/line-setup/:id', lineSetupController.getById);
app.post('/api/line-setup', lineSetupController.create);
app.put('/api/line-setup/:id', lineSetupController.update);
app.delete('/api/line-setup/:id', lineSetupController.delete);

// Shift start route
app.post('/api/shift-start', lineSetupController.createShift);

// User rights routes
app.get('/api/user-rights', userRightsController.getAll);
app.get('/api/user-rights/user/:userId', userRightsController.getByUserId);
app.post('/api/user-rights', userRightsController.create);
app.put('/api/user-rights/:id', userRightsController.update);
app.delete('/api/user-rights/:id', userRightsController.delete);
app.delete('/api/user-rights/user/:userId', userRightsController.deleteByUserId);

// Mobile session routes
app.post('/api/mobile-session/init', mobileSessionController.createSession);
app.post('/api/mobile-session/activate', mobileSessionController.activateSession);
app.get('/api/mobile-session/active-for/:machine_id', mobileSessionController.findActiveSession);
app.get('/api/mobile-session/waiting-for/:machine_id', mobileSessionController.findWaitingSession);
app.get('/api/mobile-session/latest-active', mobileSessionController.getLatestActiveSession);
app.get('/api/mobile-session/test', (req, res) => res.json({ test: 'working' }));
app.get('/api/mobile-session/:sessionId', mobileSessionController.checkSessionStatus);

// Mobile production routes
app.get('/api/mobile-production', mobileProductionController.getAll);
app.get('/api/mobile-production/:id', mobileProductionController.getById);
app.get('/api/mobile-production/machine/:machineId/date/:date', mobileProductionController.getByMachineAndDate);
app.get('/api/mobile-production/live-status/:machineId', mobileProductionController.getLiveMachineStatus);
app.post('/api/mobile-production', mobileProductionController.create);
app.put('/api/mobile-production/:id', mobileProductionController.update);
app.patch('/api/mobile-production/:id/status', mobileProductionController.updateStatus);
app.delete('/api/mobile-production/:id', mobileProductionController.delete);

// Pivot data routes
app.get('/api/pivot-data', mobileProductionController.getPivotData);
app.post('/api/pivot-data/refresh', mobileProductionController.refreshPivotData);

// Production Tracker routes
app.get('/api/tracker/summary', productionTrackerController.getSummary);
app.get('/api/tracker/hourly', productionTrackerController.getHourlyPerformance);
app.get('/api/tracker/workstations', productionTrackerController.getWorkstationPerformance);
app.get('/api/tracker/stoppages', productionTrackerController.getStoppageReasons);

// Machine Centre routes
app.post('/api/machine-centre/start', machineCentreController.startProduction);
app.post('/api/machine-centre/stop', machineCentreController.stopProduction);
app.post('/api/machine-centre/resume', machineCentreController.resumeProduction);
app.post('/api/machine-centre/finish', machineCentreController.finishProduction);
app.get('/api/machine-centre/status/:machineId', machineCentreController.getMachineStatus);
app.post('/api/machine-centre/update-time', machineCentreController.updateActualTime);
app.get('/api/machine-centre/plan/:workCentreId/:machineId', machineCentreController.getProductionPlan);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling
app.use(errorHandler);

// Start server
const certPath = path.join(__dirname, '../../frontend/cert');
const keyFile = path.join(certPath, 'key.pem');
const certFile = path.join(certPath, 'cert.pem');

const useHttps = fs.existsSync(keyFile) && fs.existsSync(certFile);

let server;
if (useHttps) {
  const httpsOptions = {
    key: fs.readFileSync(keyFile),
    cert: fs.readFileSync(certFile)
  };
  server = https.createServer(httpsOptions, app);
  logger.info('HTTPS enabled for backend');
} else {
  server = http.createServer(app);
  logger.info('Running on HTTP (HTTPS certificates not found)');
}

server.listen(PORT, '0.0.0.0', () => {
  logger.info(`Server started on port ${PORT} (${useHttps ? 'HTTPS' : 'HTTP'}) and listening on all interfaces`);

  // Start file watcher
  fileWatcherService.start();
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  fileWatcherService.stop();

  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });

  // Force close after 10 seconds
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = app;