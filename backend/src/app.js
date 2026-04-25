require('dotenv').config();
const express = require('express');
const https = require('https');
const http = require('http');
const cors = require('cors');
const compression = require('compression');
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
const tvDashboardController = require('./controllers/tvDashboardController');
const hourlyOutputController = require('./controllers/hourlyOutputController');
const reworkRejectionController = require('./controllers/reworkRejectionController');
const roleController = require('./controllers/roleController');
const productionLockController = require('./controllers/productionLockController');
const alertController = require('./controllers/alertController');
const backupController = require('./controllers/backupController');
const missedActionsController = require('./controllers/missedActionsController');
const checkDayLock = require('./middleware/checkDayLock');
const backupService = require('./services/backupService');
const errorHandler = require('./middleware/errorHandler');
const authenticate = require('./middleware/authenticate');
const optionalAuthenticate = require('./middleware/optionalAuthenticate');
const requestLogger = require('./middleware/requestLogger');
const sanitize = require('./middleware/sanitize');
const validate = require('./middleware/validate');
const healthController = require('./controllers/healthController');

// Path resolution helper
const getAbsolutePath = (dirPath) => {
  if (!dirPath) return null;
  if (path.isAbsolute(dirPath)) return dirPath;
  return path.resolve(__dirname, '..', dirPath);
};

// Create required directories
const createDirectories = () => {
  const incomingDir = getAbsolutePath(process.env.INCOMING_DIR || './data/incoming');
  const successDir = getAbsolutePath(process.env.SUCCESS_DIR || './data/processed');
  const failureDir = getAbsolutePath(process.env.FAILURE_DIR || './data/error');
  const logsDir = getAbsolutePath(process.env.LOGS_DIR || './logs');

  process.env.INCOMING_DIR = incomingDir;
  process.env.SUCCESS_DIR = successDir;
  process.env.FAILURE_DIR = failureDir;
  process.env.LOGS_DIR = logsDir;

  [incomingDir, successDir, failureDir, logsDir].forEach(dir => {
    if (dir && !fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logger.info(`Created directory: ${dir}`);
    }
  });
};

// Auto-create rework_rejection table and archive old data
const initDb = async () => {
  try {
    const db = require('../config/database');
    await db.execute(`
      CREATE TABLE IF NOT EXISTS rework_rejection (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        work_centre_id INT NOT NULL,
        production_date DATE NOT NULL,
        machine_centre_name VARCHAR(100),
        total_output_pairs INT DEFAULT 0,
        bins_completed INT DEFAULT 0,
        rework_qty INT DEFAULT 0,
        rejection_qty INT DEFAULT 0,
        reason_category VARCHAR(20),
        reason VARCHAR(100),
        saved_at DATETIME NOT NULL,
        INDEX idx_wc_date (work_centre_id, production_date)
      )
    `);
    logger.info('rework_rejection table ready');
    await db.execute(`
      CREATE TABLE IF NOT EXISTS missed_action_states (
        issue_key VARCHAR(255) NOT NULL PRIMARY KEY,
        acknowledged_at DATETIME NULL,
        snoozed_until DATETIME NULL,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    logger.info('missed_action_states table ready');
    try {
      await db.execute('ALTER TABLE production_routing_header ADD COLUMN deleted_at DATETIME NULL');
      logger.info('Added deleted_at to production_routing_header');
    } catch (routingAlterError) {
      if (routingAlterError.code !== 'ER_DUP_FIELDNAME') {
        throw routingAlterError;
      }
    }
    try {
      await db.execute('ALTER TABLE production_plan ADD COLUMN deleted_at DATETIME NULL');
      logger.info('Added deleted_at to production_plan');
    } catch (planAlterError) {
      if (planAlterError.code !== 'ER_DUP_FIELDNAME') {
        throw planAlterError;
      }
    }
    await db.execute(`
      CREATE TABLE IF NOT EXISTS tracker_alert_actions (
        issue_key VARCHAR(255) NOT NULL PRIMARY KEY,
        acknowledged_at DATETIME NULL,
        escalated_at DATETIME NULL,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    logger.info('tracker_alert_actions table ready');
    await db.execute(`
      CREATE TABLE IF NOT EXISTS manual_entry_audit_logs (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        entry_id BIGINT NULL,
        action ENUM('CREATE','UPDATE','DELETE') NOT NULL,
        actor_user_id BIGINT NULL,
        actor_username VARCHAR(255) NULL,
        actor_role VARCHAR(100) NULL,
        reason VARCHAR(255) NULL,
        before_data LONGTEXT NULL,
        after_data LONGTEXT NULL,
        created_at DATETIME NOT NULL,
        INDEX idx_manual_entry_audit_entry (entry_id),
        INDEX idx_manual_entry_audit_created (created_at)
      )
    `);
    logger.info('manual_entry_audit_logs table ready');
    
    // Archive old machine centre summary data on startup
    try {
      await db.execute('CALL ArchiveSummaryData()');
      logger.info('Old machine centre summary data archived on startup');
    } catch (archiveError) {
      // If stored procedure doesn't exist, log but don't fail startup
      if (archiveError.code === 'ER_SP_DOES_NOT_EXIST') {
        logger.warn('ArchiveSummaryData procedure not found - skipping archive on startup');
      } else {
        logger.error('Failed to archive old data on startup:', archiveError.message);
      }
    }
  } catch (e) {
    logger.error('Failed to init database:', e.message);
  }
};

const app = express();
const PORT = process.env.PORT || 3001;
const LOGS_ALLOWED_ROLES = new Set(['Admin', 'Line Supervisor', 'IED', 'Planner', 'Unit Head']);
const PRODUCTION_ROUTING_ALLOWED_ROLES = new Set(['Admin', 'IED']);
const PRODUCTION_PLANNING_ALLOWED_ROLES = new Set(['Admin', 'Planner']);
const TRACKER_ALLOWED_ROLES = new Set(['Admin', 'Line Supervisor', 'IED', 'Planner', 'Unit Head']);
const REWORK_ALLOWED_ROLES = new Set(['Admin', 'Line Supervisor', 'IED']);
const ADMIN_ALLOWED_ROLES = new Set(['Admin']);
const LINE_SETUP_ALLOWED_ROLES = new Set(['Admin', 'Line Supervisor']);
const MANUAL_ENTRY_ALLOWED_ROLES = new Set(['Admin', 'Line Supervisor', 'IED', 'Planner', 'Unit Head']);

const requireLogsAccess = (req, res, next) => {
  const role = req.user?.role;
  if (!role || !LOGS_ALLOWED_ROLES.has(role)) {
    return res.status(403).json({ success: false, message: 'Access denied for logs' });
  }
  next();
};

const requireProductionRoutingAccess = (req, res, next) => {
  const role = req.user?.role;
  if (!role || !PRODUCTION_ROUTING_ALLOWED_ROLES.has(role)) {
    return res.status(403).json({ success: false, message: 'Access denied for production routing' });
  }
  next();
};

const requireProductionPlanningAccess = (req, res, next) => {
  const role = req.user?.role;
  if (!role || !PRODUCTION_PLANNING_ALLOWED_ROLES.has(role)) {
    return res.status(403).json({ success: false, message: 'Access denied for production planning' });
  }
  next();
};

const requireTrackerAccess = (req, res, next) => {
  const role = req.user?.role;
  if (!role || !TRACKER_ALLOWED_ROLES.has(role)) {
    return res.status(403).json({ success: false, message: 'Access denied for production tracker' });
  }
  next();
};

const requireReworkAccess = (req, res, next) => {
  const role = req.user?.role;
  if (!role || !REWORK_ALLOWED_ROLES.has(role)) {
    return res.status(403).json({ success: false, message: 'Access denied for rework rejection tracker' });
  }
  next();
};

const requireLineSetupAccess = (req, res, next) => {
  const role = req.user?.role;
  if (!role || !LINE_SETUP_ALLOWED_ROLES.has(role)) {
    return res.status(403).json({ success: false, message: 'Access denied for line setup' });
  }
  next();
};

const requireManualEntryAccess = (req, res, next) => {
  const role = req.user?.role;
  if (!role || !MANUAL_ENTRY_ALLOWED_ROLES.has(role)) {
    return res.status(403).json({ success: false, message: 'Access denied for manual production entry' });
  }
  next();
};

const requireUsersAdminAccess = (req, res, next) => {
  if (req.params.table !== 'users') return next();
  const role = req.user?.role;
  if (!role || !ADMIN_ALLOWED_ROLES.has(role)) {
    return res.status(403).json({ success: false, message: 'Access denied for user administration' });
  }
  next();
};

const requireMonitoringAccess = (req, res, next) => {
  const role = req.user?.role;
  if (!role || !ADMIN_ALLOWED_ROLES.has(role)) {
    return res.status(403).json({ success: false, message: 'Access denied for monitoring dashboard' });
  }
  next();
};

const requireAdminAccess = (req, res, next) => {
  const role = req.user?.role;
  if (!role || !ADMIN_ALLOWED_ROLES.has(role)) {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  next();
};

const LOCK_ALLOWED_ROLES = new Set(['Admin', 'Line Supervisor']);
const requireProductionLockAccess = (req, res, next) => {
  const role = req.user?.role;
  if (!role || !LOCK_ALLOWED_ROLES.has(role)) {
    return res.status(403).json({ success: false, message: 'Only supervisors/admins can lock production days' });
  }
  next();
};

const authenticateUsersTable = (req, res, next) => {
  if (req.params.table !== 'users') return next();
  return authenticate(req, res, next);
};

createDirectories();
initDb();

// Start daily backup scheduler
backupService.scheduleDaily();

// Run alert checks every hour
const { runChecks: runAlertChecks } = require('./controllers/alertController');
setInterval(() => {
  const today = new Date().toISOString().split('T')[0];
  runAlertChecks(today);
}, 60 * 60 * 1000); // every hour

// Auto-close all active mobile sessions daily (configurable)
const AUTO_CLOSE_ENABLED = (process.env.MOBILE_SESSION_AUTO_CLOSE_ENABLED || 'true').toLowerCase() !== 'false';
const AUTO_CLOSE_TIME = process.env.MOBILE_SESSION_AUTO_CLOSE_TIME || '18:35'; // HH:mm (24h)
const AUTO_FINISH_ENABLED = (process.env.MOBILE_PRODUCTION_AUTO_FINISH_ENABLED || 'true').toLowerCase() !== 'false';
const AUTO_FINISH_TIME = process.env.MOBILE_PRODUCTION_AUTO_FINISH_TIME || '18:30'; // HH:mm (24h)
const SESSION_CLEANUP_ENABLED = (process.env.MOBILE_SESSION_CLEANUP_ENABLED || 'true').toLowerCase() !== 'false';
const SESSION_EXPIRED_RETENTION_DAYS = Number.parseInt(process.env.MOBILE_SESSION_EXPIRED_RETENTION_DAYS || '60', 10);
const SESSION_CLEANUP_INTERVAL_MINUTES = Number.parseInt(process.env.MOBILE_SESSION_CLEANUP_INTERVAL_MINUTES || '360', 10);

const parseAutoCloseTime = (timeValue) => {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec((timeValue || '').trim());
  if (!match) return null;
  return { hour: Number(match[1]), minute: Number(match[2]) };
};

const autoCloseTimeParts = parseAutoCloseTime(AUTO_CLOSE_TIME) || { hour: 18, minute: 35 };
if (!parseAutoCloseTime(AUTO_CLOSE_TIME)) {
  logger.warn(`Invalid MOBILE_SESSION_AUTO_CLOSE_TIME="${AUTO_CLOSE_TIME}". Falling back to 18:35.`);
}
const autoFinishTimeParts = parseAutoCloseTime(AUTO_FINISH_TIME) || { hour: 18, minute: 30 };
if (!parseAutoCloseTime(AUTO_FINISH_TIME)) {
  logger.warn(`Invalid MOBILE_PRODUCTION_AUTO_FINISH_TIME="${AUTO_FINISH_TIME}". Falling back to 18:30.`);
}

let lastSessionAutoCloseDate = null;
let lastProductionAutoFinishDate = null;
const getLocalDateKey = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const runAutoSessionCloseCheck = async () => {
  try {
    if (!AUTO_CLOSE_ENABLED) return;

    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setHours(autoCloseTimeParts.hour, autoCloseTimeParts.minute, 0, 0);

    const todayKey = getLocalDateKey(now);
    if (now >= cutoff && lastSessionAutoCloseDate !== todayKey) {
      const closedCount = await mobileSessionController.expireAllActiveSessions();
      lastSessionAutoCloseDate = todayKey;
      logger.info(`Auto-close check completed for ${todayKey} at/after ${AUTO_CLOSE_TIME}. Closed sessions: ${closedCount}`);
    }
  } catch (error) {
    logger.error(`Auto-close scheduler error: ${error.message}`);
  }
};

const runAutoProductionFinishCheck = async () => {
  try {
    if (!AUTO_FINISH_ENABLED) return;

    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setHours(autoFinishTimeParts.hour, autoFinishTimeParts.minute, 0, 0);

    const todayKey = getLocalDateKey(now);
    if (now >= cutoff && lastProductionAutoFinishDate !== todayKey) {
      const closedCycles = await mobileSessionController.autoFinishUnfinishedProductions();
      lastProductionAutoFinishDate = todayKey;
      logger.info(`Auto-finish check completed for ${todayKey} at/after ${AUTO_FINISH_TIME}. Closed cycles: ${closedCycles}`);
    }
  } catch (error) {
    logger.error(`Auto-finish scheduler error: ${error.message}`);
  }
};

const runExpiredSessionCleanup = async () => {
  try {
    if (!SESSION_CLEANUP_ENABLED) return;
    const retentionDays = Number.isFinite(SESSION_EXPIRED_RETENTION_DAYS) && SESSION_EXPIRED_RETENTION_DAYS > 0
      ? SESSION_EXPIRED_RETENTION_DAYS
      : 60;
    const removed = await mobileSessionController.cleanupExpiredSessionsHistory(retentionDays);
    logger.info(`Session cleanup check completed. Removed: ${removed}`);
  } catch (error) {
    logger.error(`Session cleanup scheduler error: ${error.message}`);
  }
};

if (AUTO_CLOSE_ENABLED) {
  logger.info(`Mobile session auto-close is enabled. Daily cutoff: ${AUTO_CLOSE_TIME} (server local time).`);
  setInterval(runAutoSessionCloseCheck, 60 * 1000); // check every minute
  setTimeout(runAutoSessionCloseCheck, 10 * 1000); // run once shortly after startup
} else {
  logger.info('Mobile session auto-close is disabled via MOBILE_SESSION_AUTO_CLOSE_ENABLED=false.');
}

if (AUTO_FINISH_ENABLED) {
  logger.info(`Mobile production auto-finish is enabled. Daily cutoff: ${AUTO_FINISH_TIME} (server local time).`);
  setInterval(runAutoProductionFinishCheck, 60 * 1000); // check every minute
  setTimeout(runAutoProductionFinishCheck, 15 * 1000); // run once shortly after startup
} else {
  logger.info('Mobile production auto-finish is disabled via MOBILE_PRODUCTION_AUTO_FINISH_ENABLED=false.');
}

if (SESSION_CLEANUP_ENABLED) {
  const intervalMinutes = Number.isFinite(SESSION_CLEANUP_INTERVAL_MINUTES) && SESSION_CLEANUP_INTERVAL_MINUTES > 0
    ? SESSION_CLEANUP_INTERVAL_MINUTES
    : 360;
  logger.info(`Mobile session history cleanup is enabled. Retention: ${SESSION_EXPIRED_RETENTION_DAYS || 60} day(s), interval: ${intervalMinutes} minute(s).`);
  setInterval(runExpiredSessionCleanup, intervalMinutes * 60 * 1000);
  setTimeout(runExpiredSessionCleanup, 20 * 1000); // run once shortly after startup
} else {
  logger.info('Mobile session history cleanup is disabled via MOBILE_SESSION_CLEANUP_ENABLED=false.');
}

// Email alerts DISABLED - re-enable by uncommenting below code and setting EMAIL_USER/EMAIL_PASS in .env
// Poll for un-emailed alerts every 5 minutes (catches DB-trigger-created alerts too)
// const { sendAlertDigest } = require('./services/emailService');
const db = require('../config/database');

// Ensure emailed column exists
// db.execute(`ALTER TABLE production_alerts ADD COLUMN emailed TINYINT(1) DEFAULT 0`)
//   .catch(() => {}); // ignore if already exists

// const pollAndEmailAlerts = async () => {
//   try {
//     const today = new Date().toISOString().split('T')[0];
//     const [unEmailed] = await db.execute(`
//       SELECT pa.*, wc.name as work_centre_name
//       FROM production_alerts pa
//       LEFT JOIN work_centres wc ON pa.work_centre_id = wc.id
//       WHERE pa.alert_date = ? AND pa.emailed = 0
//       ORDER BY pa.severity DESC, pa.created_at DESC
//     `, [today]);

//     if (unEmailed.length > 0) {
//       await sendAlertDigest(unEmailed, today);
//       const ids = unEmailed.map(a => a.id);
//       const placeholders = ids.map(() => '?').join(',');
//       await db.execute(`UPDATE production_alerts SET emailed = 1 WHERE id IN (${placeholders})`, ids);
//     }
//   } catch (err) {
//     const logger = require('./utils/logger');
//     logger.error('Alert email poller error:', err.message);
//   }
// };

// Run immediately on startup, then every 5 minutes
// setTimeout(pollAndEmailAlerts, 10000); // 10s after startup
// setInterval(pollAndEmailAlerts, 5 * 60 * 1000); // every 5 minutes

// Middleware
app.use(compression());
const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Sanitize all inputs globally
app.use(sanitize);

// Request logging with metrics
app.use(requestLogger);

app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url} from ${req.ip} | Origin: ${req.get('Origin') || 'None'}`);
  next();
});

// Routes
app.post('/api/login', validate(validate.schemas.login), authController.login);
app.post('/api/auth/refresh', authController.refresh.bind(authController));

// Email test endpoint DISABLED - re-enable when email is configured
// app.post('/api/alerts/send-test-email', async (req, res) => {
//   try {
//     const { sendAlertDigest } = require('./services/emailService');
//     const today = new Date().toISOString().split('T')[0];
//     const [alerts] = await db.execute(`
//       SELECT pa.*, wc.name as work_centre_name
//       FROM production_alerts pa
//       LEFT JOIN work_centres wc ON pa.work_centre_id = wc.id
//       WHERE pa.alert_date = ?
//       ORDER BY pa.severity DESC, pa.created_at DESC
//     `, [today]);
//     if (alerts.length === 0) return res.json({ success: false, message: 'No alerts for today' });
//     await sendAlertDigest(alerts, today);
//     res.json({ success: true, message: `Test email sent with ${alerts.length} alerts` });
//   } catch (err) {
//     res.status(500).json({ success: false, error: err.message, stack: err.stack });
//   }
// });

app.get('/api/reports/hourly-production', authenticate, requireLogsAccess, validate(validate.schemas.dateQuery), apiController.getHourlyProductionStatus.bind(apiController));
app.get('/api/reports/line-efficiency', authenticate, requireLogsAccess, validate(validate.schemas.dateQuery), apiController.getLineProcessEfficiency.bind(apiController));
app.get('/api/reports/attendance', authenticate, requireLogsAccess, validate(validate.schemas.dateQuery), apiController.getAttendanceReport.bind(apiController));
app.get('/api/reports/rework-rejection', authenticate, requireLogsAccess, validate(validate.schemas.dateQuery), apiController.getReworkRejectionReport.bind(apiController));
app.get('/api/reports/machine-output', authenticate, requireLogsAccess, validate(validate.schemas.dateQuery), apiController.getMachineOutputReport.bind(apiController));
app.get('/api/reports/employee-output', authenticate, requireLogsAccess, validate(validate.schemas.dateQuery), apiController.getEmployeeOutputReport.bind(apiController));
app.get('/api/reports/employee-performance', authenticate, requireLogsAccess, validate(validate.schemas.dateQuery), apiController.getEmployeePerformanceReport.bind(apiController));

// Master routes — table whitelist on all master endpoints
app.get('/api/masters/:table', validate.allowedTable, authenticateUsersTable, requireUsersAdminAccess, validate.pagination, masterController.getAll.bind(masterController));
app.get('/api/masters/:table/:id', validate.allowedTable, authenticateUsersTable, requireUsersAdminAccess, validate.numericId, masterController.getById);
app.get('/api/masters/:table/code/:code', validate.allowedTable, authenticateUsersTable, requireUsersAdminAccess, masterController.getByCode);
app.get('/api/masters/:table/:id/usage', validate.allowedTable, authenticateUsersTable, requireUsersAdminAccess, validate.numericId, masterController.getUsage.bind(masterController));
app.post('/api/masters/:table/:id/restore', validate.allowedTable, authenticate, requireAdminAccess, validate.numericId, masterController.restore.bind(masterController));
app.get('/api/masters/employees/emp_id/:empId', masterController.getByEmpId);
app.get('/api/masters/machine_centres/machine_id/:machineId', masterController.getByMachineId);
app.post('/api/masters/:table', validate.allowedTable, authenticate, requireAdminAccess, masterController.create.bind(masterController));
app.put('/api/masters/:table/:id', validate.allowedTable, authenticate, requireAdminAccess, validate.numericId, masterController.update.bind(masterController));
app.delete('/api/masters/:table/:id', validate.allowedTable, authenticate, requireAdminAccess, validate.numericId, masterController.delete.bind(masterController));

// Production routing routes
app.get('/api/production-routing', authenticate, requireProductionRoutingAccess, validate.pagination, productionRoutingController.getAll.bind(productionRoutingController));
app.get('/api/production-routing/masters', authenticate, requireProductionRoutingAccess, productionRoutingController.getMastersData.bind(productionRoutingController));
app.get('/api/production-routing/style/:styleId', authenticate, requireProductionRoutingAccess, productionRoutingController.getByStyleId.bind(productionRoutingController));
app.get('/api/production-routing/:id', authenticate, requireProductionRoutingAccess, validate.numericId, productionRoutingController.getById.bind(productionRoutingController));
app.post('/api/production-routing', authenticate, requireProductionRoutingAccess, productionRoutingController.create.bind(productionRoutingController));
app.put('/api/production-routing/:id', authenticate, requireProductionRoutingAccess, validate.numericId, productionRoutingController.update.bind(productionRoutingController));
app.delete('/api/production-routing/:id', authenticate, requireProductionRoutingAccess, validate.numericId, productionRoutingController.delete.bind(productionRoutingController));
app.post('/api/production-routing/:id/restore', authenticate, requireProductionRoutingAccess, validate.numericId, productionRoutingController.restore.bind(productionRoutingController));

// Production planning routes
app.get('/api/production-planning', authenticate, requireProductionPlanningAccess, validate.pagination, productionPlanningController.getAll.bind(productionPlanningController));
app.get('/api/production-planning/:id', authenticate, requireProductionPlanningAccess, validate.numericId, productionPlanningController.getById.bind(productionPlanningController));
app.post('/api/production-planning', authenticate, requireProductionPlanningAccess, validate(validate.schemas.productionPlan), productionPlanningController.create.bind(productionPlanningController));
app.post('/api/production-planning/bulk', authenticate, requireProductionPlanningAccess, productionPlanningController.createBulk.bind(productionPlanningController));
app.post('/api/production-planning/:id/restore', authenticate, requireProductionPlanningAccess, validate.numericId, productionPlanningController.restore.bind(productionPlanningController));
app.put('/api/production-planning/:id', authenticate, requireProductionPlanningAccess, validate.numericId, validate(validate.schemas.productionPlan), productionPlanningController.update.bind(productionPlanningController));
app.delete('/api/production-planning/:id', authenticate, requireProductionPlanningAccess, validate.numericId, productionPlanningController.delete.bind(productionPlanningController));

// Line setup routes
app.get('/api/line-setup', authenticate, requireLineSetupAccess, lineSetupController.getAll);
app.get('/api/line-setup/:id', authenticate, requireLineSetupAccess, lineSetupController.getById);
app.post('/api/line-setup', authenticate, requireLineSetupAccess, lineSetupController.create);
app.put('/api/line-setup/:id', authenticate, requireLineSetupAccess, lineSetupController.update);
app.delete('/api/line-setup/:id', authenticate, requireLineSetupAccess, lineSetupController.delete);
app.post('/api/shift-start', authenticate, requireLineSetupAccess, lineSetupController.createShift);

// User rights routes
app.get('/api/user-rights', authenticate, requireAdminAccess, userRightsController.getAll);
app.get('/api/user-rights/user/:userId', authenticate, requireAdminAccess, userRightsController.getByUserId);
app.post('/api/user-rights', authenticate, requireAdminAccess, userRightsController.create);
app.put('/api/user-rights/:id', authenticate, requireAdminAccess, userRightsController.update);
app.delete('/api/user-rights/:id', authenticate, requireAdminAccess, userRightsController.delete);
app.delete('/api/user-rights/user/:userId', authenticate, requireAdminAccess, userRightsController.deleteByUserId);

// ============================================================================
// PUBLIC ROUTES - NO JWT REQUIRED (Production floor tablets/machines)
// These routes are intentionally unprotected for 100+ factory floor devices
// Security is handled via employee QR scan + machine session validation
// ============================================================================

// Mobile session routes (public)
app.post('/api/mobile-session/init', mobileSessionController.createSession);
app.post('/api/mobile-session/activate', mobileSessionController.activateSession);
app.get('/api/mobile-session/active-for/:machine_id', mobileSessionController.findActiveSession);
app.get('/api/mobile-session/waiting-for/:machine_id', mobileSessionController.findWaitingSession);
app.get('/api/mobile-session/latest-active/:machineId?', mobileSessionController.getLatestActiveSession);
app.get('/api/mobile-sessions/attendance/:workCentreId', mobileSessionController.getAttendance);
app.get('/api/mobile-session/test', (req, res) => res.json({ test: 'working' }));
app.get('/api/mobile-session/:sessionId', mobileSessionController.checkSessionStatus);

// Mobile production routes (public - no JWT for factory floor use)
app.get('/api/mobile-production', mobileProductionController.getAll);
app.get('/api/mobile-production/init/:machineId/:empCode', mobileProductionController.getInitData);
app.get('/api/mobile-production/machine/:machineId/latest-unfinished', mobileProductionController.getLatestUnfinishedByMachine);
app.get('/api/mobile-production/manual-entry', authenticate, requireManualEntryAccess, mobileProductionController.getManualEntries);
app.get('/api/mobile-production/manual-entry/audit-logs', authenticate, requireManualEntryAccess, mobileProductionController.getManualEntryAuditLogs);
app.post('/api/mobile-production/manual-entry/audit-logs/:logId/restore', authenticate, requireManualEntryAccess, mobileProductionController.restoreManualEntryFromAuditLog);
app.get('/api/mobile-production/:id', mobileProductionController.getById);
app.get('/api/mobile-production/machine/:machineId/date/:date', mobileProductionController.getByMachineAndDate);
app.get('/api/mobile-production/summary/:machineId/date/:date', mobileProductionController.getSummaryByMachineAndDate);
app.get('/api/mobile-production/live-status/:machineId', mobileProductionController.getLiveMachineStatus);
app.post('/api/mobile-production', mobileProductionController.create);
app.post('/api/mobile-production/manual-entry', authenticate, requireManualEntryAccess, checkDayLock('prod_date', 'work_centre_id'), mobileProductionController.createManualEntry);
app.put('/api/mobile-production/manual-entry/:id', authenticate, requireManualEntryAccess, checkDayLock('prod_date', 'work_centre_id'), mobileProductionController.updateManualEntry);
app.delete('/api/mobile-production/manual-entry/:id', authenticate, requireManualEntryAccess, checkDayLock('prod_date', 'work_centre_id'), mobileProductionController.deleteManualEntry);
app.put('/api/mobile-production/:id', mobileProductionController.update);
app.patch('/api/mobile-production/:id/status', mobileProductionController.updateStatus);
app.delete('/api/mobile-production/:id', mobileProductionController.delete);

// Pivot data routes
app.get('/api/pivot-data', mobileProductionController.getPivotData);
app.post('/api/pivot-data/refresh', mobileProductionController.refreshPivotData);

// Production Tracker routes
app.get('/api/tracker/summary', authenticate, requireTrackerAccess, productionTrackerController.getSummary.bind(productionTrackerController));
app.get('/api/tracker/hourly', authenticate, requireTrackerAccess, productionTrackerController.getHourlyPerformance.bind(productionTrackerController));
app.get('/api/tracker/workstations', authenticate, requireTrackerAccess, productionTrackerController.getWorkstationPerformance.bind(productionTrackerController));
app.get('/api/tracker/stoppages', authenticate, requireTrackerAccess, productionTrackerController.getStoppageReasons.bind(productionTrackerController));
app.get('/api/tracker/line-performance', authenticate, requireTrackerAccess, productionTrackerController.getLinePerformance.bind(productionTrackerController));
app.post('/api/tracker/alert-actions/query', authenticate, requireTrackerAccess, productionTrackerController.getAlertActions.bind(productionTrackerController));
app.post('/api/tracker/alert-actions/ack', authenticate, requireTrackerAccess, productionTrackerController.acknowledgeAlert.bind(productionTrackerController));
app.post('/api/tracker/alert-actions/escalate', authenticate, requireTrackerAccess, productionTrackerController.escalateAlert.bind(productionTrackerController));
app.get('/api/missed-actions', authenticate, requireLogsAccess, missedActionsController.getMissedActions);
app.post('/api/missed-actions/ack', authenticate, requireLogsAccess, missedActionsController.acknowledgeMissedAction);
app.post('/api/missed-actions/snooze', authenticate, requireLogsAccess, missedActionsController.snoozeMissedAction);

// Machine Centre routes (public - no JWT for factory floor use)
app.post('/api/machine-centre/start', checkDayLock('prod_date', 'work_centre_id'), machineCentreController.startProduction);
app.post('/api/machine-centre/stop', machineCentreController.stopProduction);
app.post('/api/machine-centre/resume', machineCentreController.resumeProduction);
app.post('/api/machine-centre/finish', machineCentreController.finishProduction);
app.get('/api/machine-centre/status/:machineId', machineCentreController.getMachineStatus);
app.post('/api/machine-centre/update-time', machineCentreController.updateActualTime);
app.get('/api/machine-centre/plan/:workCentreId/:machineId', machineCentreController.getProductionPlan);

// Alert routes (public - factory floor can see alerts)
app.get('/api/alerts', optionalAuthenticate, alertController.getAlerts.bind(alertController));
app.get('/api/alerts/center', authenticate, requireLogsAccess, alertController.getRealtimeCenterAlerts.bind(alertController));

// Logs routes (protected)
app.get('/api/mobile-sessions/logs', authenticate, requireLogsAccess, mobileSessionController.getSessionLogs);
app.get('/api/mobile-sessions/cycles', authenticate, requireLogsAccess, mobileSessionController.getCycleDetails);
app.get('/api/mobile-sessions/active-snapshot', authenticate, requireManualEntryAccess, mobileSessionController.getActiveSessionsSnapshot);

// TV Dashboard routes
app.get('/api/tv-dashboard/work-centres', tvDashboardController.getWorkCentres);
app.get('/api/tv-dashboard/machine-centres/:workCentreId', tvDashboardController.getMachineCentresByWorkCentre);
app.get('/api/tv-dashboard/dashboard/:workCentreId', tvDashboardController.getDashboard);

// Hourly Output routes
app.get('/api/hourly-output/:workCentreId', hourlyOutputController.getHourlyOutput);
app.get('/api/hourly-output/:workCentreId/machines', hourlyOutputController.getMachineHourlyOutput);

// Rework Rejection routes
app.get('/api/rework-rejection/summary', authenticate, requireReworkAccess, reworkRejectionController.getSummaryByWorkCentre.bind(reworkRejectionController));
app.get('/api/rework-rejection', authenticate, requireReworkAccess, reworkRejectionController.getAll.bind(reworkRejectionController));
app.post('/api/rework-rejection', authenticate, requireReworkAccess, validate(validate.schemas.reworkRejection), checkDayLock('production_date', 'work_centre_id'), reworkRejectionController.save.bind(reworkRejectionController));
app.put('/api/rework-rejection/:id', authenticate, requireReworkAccess, validate.numericId, reworkRejectionController.update.bind(reworkRejectionController));
app.delete('/api/rework-rejection/:id', authenticate, requireReworkAccess, validate.numericId, reworkRejectionController.delete.bind(reworkRejectionController));

// Role routes
app.get('/api/roles', authenticate, requireAdminAccess, roleController.getAll);
app.get('/api/roles/:id', authenticate, requireAdminAccess, roleController.getById);
app.post('/api/roles', authenticate, requireAdminAccess, roleController.create);
app.put('/api/roles/:id', authenticate, requireAdminAccess, roleController.update);
app.delete('/api/roles/:id', authenticate, requireAdminAccess, roleController.delete);

// Auth — password management
app.post('/api/auth/change-password', authenticate, authController.changePassword.bind(authController));
app.post('/api/auth/reset-password/:userId', authenticate, authController.resetPassword.bind(authController));

// Production day lock routes
app.get('/api/production-lock', authenticate, requireProductionLockAccess, productionLockController.isLocked.bind(productionLockController));
app.get('/api/production-lock/all', authenticate, requireProductionLockAccess, productionLockController.getAll.bind(productionLockController));
app.post('/api/production-lock/lock', authenticate, requireProductionLockAccess, productionLockController.lockDay.bind(productionLockController));
app.post('/api/production-lock/unlock', authenticate, requireAdminAccess, productionLockController.unlockDay.bind(productionLockController));

// Alert routes (protected - only admin can mark read or run checks)
app.post('/api/alerts/mark-read', authenticate, alertController.markRead.bind(alertController));
app.post('/api/alerts/acknowledge', authenticate, requireLogsAccess, alertController.acknowledge.bind(alertController));
app.post('/api/alerts/run-checks', authenticate, requireAdminAccess, alertController.runChecks.bind(alertController));

// Backup routes (admin only)
app.post('/api/backup/trigger', authenticate, requireAdminAccess, backupController.triggerBackup.bind(backupController));
app.get('/api/backup/list', authenticate, requireAdminAccess, backupController.getBackups.bind(backupController));

// Health check endpoints
app.get('/health', healthController.basic.bind(healthController));
app.get('/health/detailed', authenticate, requireMonitoringAccess, healthController.detailed.bind(healthController));
app.get('/health/metrics', authenticate, requireMonitoringAccess, healthController.metrics.bind(healthController));

app.use(errorHandler);

const useHttps = false;
let server;
server = http.createServer(app);
logger.info('Running on HTTP (HTTPS disabled for mobile compatibility)');

server.listen(PORT, '0.0.0.0', () => {
  logger.info(`Server started on port ${PORT} (${useHttps ? 'HTTPS' : 'HTTP'}) and listening on all interfaces`);
  fileWatcherService.start();
});

const gracefulShutdown = (signal) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  fileWatcherService.stop();
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = app;
