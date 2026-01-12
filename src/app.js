require('dotenv').config();
const express = require('express');
const cors = require('cors');
const logger = require('./utils/logger');
const fileWatcherService = require('./services/fileWatcherService');
const apiController = require('./controllers/apiController');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get('/api/machines/status', apiController.getMachineStatus);
app.get('/api/reports/run-idle', apiController.getRunIdleReport);
app.get('/api/reports/hourly', apiController.getHourlyReport);
app.get('/api/reports/efficiency', apiController.getEfficiencyReport);
app.get('/api/reports/overall-efficiency', apiController.getOverallEfficiency);

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