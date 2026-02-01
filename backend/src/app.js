require('dotenv').config();
const express = require('express');
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
const errorHandler = require('./middleware/errorHandler');

// Create required directories
const createDirectories = () => {
  const dirs = [
    process.env.INCOMING_DIR,
    process.env.SUCCESS_DIR,
    process.env.FAILURE_DIR,
    process.env.LOGS_DIR
  ];

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
  origin: [
    'http://localhost:3000',
    'https://naqhid.github.io'
  ],
  credentials: true
}));
app.use(express.json());

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
app.get('/api/mobile-session/:sessionId', mobileSessionController.checkSessionStatus);
app.post('/api/mobile-session/activate', mobileSessionController.activateSession);
app.get('/api/mobile-session/active-for/:machine_id', mobileSessionController.findActiveSession);
app.get('/api/mobile-session/waiting-for/:machine_id', mobileSessionController.findWaitingSession);

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

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling
app.use(errorHandler);

// Start server
const server = app.listen(PORT, () => {
  logger.info(`Server started on port ${PORT}`);

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