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
const idleReminderSettingsController = require('./controllers/idleReminderSettingsController');
const idleReminderSettingsService = require('./services/idleReminderSettingsService');
const tabBroadcastController = require('./controllers/tabBroadcastController');
const wipDailyStateController = require('./controllers/wipDailyStateController');
const lineStyleAssignmentController = require('./controllers/lineStyleAssignmentController');
const checkDayLock = require('./middleware/checkDayLock');
const requirePermission = require('./middleware/requirePermission');
const { CAPABILITIES } = require('./config/permissions');
const permissionService = require('./services/permissionService');
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
        acknowledged_by VARCHAR(255) NULL,
        snoozed_until DATETIME NULL,
        snooze_duration_mins INT NULL,
        root_cause VARCHAR(255) NULL,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    logger.info('missed_action_states table ready');
    await db.execute(`
      CREATE TABLE IF NOT EXISTS machine_time_loss_reasons (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        work_centre_id INT NOT NULL,
        machine_id VARCHAR(64) NOT NULL,
        prod_date DATE NOT NULL,
        reason VARCHAR(255) NOT NULL,
        updated_by VARCHAR(128) NULL,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_machine_time_loss_day (work_centre_id, machine_id, prod_date),
        INDEX idx_wc_date (work_centre_id, prod_date)
      )
    `);
    logger.info('machine_time_loss_reasons table ready');
    await idleReminderSettingsService.ensureTable();
    logger.info('machine_idle_reminder_settings table ready');
    // Migrate existing table — add new columns if missing
    for (const [col, def] of [
      ['acknowledged_by', 'VARCHAR(255) NULL'],
      ['snooze_duration_mins', 'INT NULL'],
      ['root_cause', 'VARCHAR(255) NULL'],
    ]) {
      try {
        await db.execute(`ALTER TABLE missed_action_states ADD COLUMN ${col} ${def}`);
        logger.info(`Added ${col} to missed_action_states`);
      } catch (e) {
        if (e.code !== 'ER_DUP_FIELDNAME') throw e;
      }
    }
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
    // Routing: mins per 6 pairs = std sec/pair × 6 ÷ 60 (observed × rating% × 1.15)
    try {
      const [routingCols] = await db.execute(`
        SELECT COLUMN_NAME, GENERATION_EXPRESSION
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'production_routing_lines'
          AND COLUMN_NAME IN ('mins_12_prs_box', 'mins_6_prs_box')
      `);
      const routingColNames = new Set(routingCols.map((c) => c.COLUMN_NAME));
      const mins6Row = routingCols.find((c) => c.COLUMN_NAME === 'mins_6_prs_box');
      const mins6Expr = String(mins6Row?.GENERATION_EXPRESSION || '');
      const mins6UsesStdFormula =
        mins6Expr.includes('rating_factor') && mins6Expr.includes('1.15');

      if (routingColNames.has('mins_12_prs_box')) {
        await db.execute('ALTER TABLE production_routing_lines DROP COLUMN mins_12_prs_box');
        logger.info('Dropped mins_12_prs_box from production_routing_lines');
      }
      if (!routingColNames.has('mins_6_prs_box') || !mins6UsesStdFormula) {
        if (routingColNames.has('mins_6_prs_box')) {
          await db.execute('ALTER TABLE production_routing_lines DROP COLUMN mins_6_prs_box');
          logger.info('Recreating mins_6_prs_box with std-time formula (rating factor + 15%)');
        }
        await db.execute(`
          ALTER TABLE production_routing_lines
          ADD COLUMN mins_6_prs_box decimal(10,4) GENERATED ALWAYS AS (
            (((((\`observed_time\` * \`rating_factor\`) / 100) * 1.15) * 6) / 60)
          ) STORED
        `);
        logger.info('Added mins_6_prs_box to production_routing_lines');
      }
    } catch (routingMinsAlterError) {
      logger.error('Failed to migrate production_routing_lines mins column:', routingMinsAlterError.message);
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
    for (const [col, def] of [
      ['input_machine_id', 'VARCHAR(64) NULL'],
      ['eol_machine_id', 'VARCHAR(64) NULL'],
    ]) {
      try {
        await db.execute(`ALTER TABLE work_centres ADD COLUMN ${col} ${def}`);
        logger.info(`Added ${col} to work_centres`);
      } catch (e) {
        if (e.code !== 'ER_DUP_FIELDNAME') throw e;
      }
    }
    try {
      await db.execute(`
        UPDATE work_centres wc
        SET input_machine_id = COALESCE(
          wc.input_machine_id,
          (SELECT mc.machine_id FROM machine_centres mc
           WHERE mc.work_centre_id = wc.id AND mc.deleted_at IS NULL
             AND (mc.machine_name LIKE '%(Input)%' OR mc.name LIKE '%(Input)%')
           ORDER BY mc.machine_id LIMIT 1)
        ),
        eol_machine_id = COALESCE(
          wc.eol_machine_id,
          (SELECT mc.machine_id FROM machine_centres mc
           WHERE mc.work_centre_id = wc.id AND mc.deleted_at IS NULL
             AND (
               mc.machine_name LIKE '%Final Output%' OR mc.name LIKE '%Final Output%'
               OR mc.machine_name LIKE '%Final Inspection%' OR mc.name LIKE '%Final Inspection%'
             )
           ORDER BY mc.machine_id DESC LIMIT 1)
        )
        WHERE wc.input_machine_id IS NULL OR wc.eol_machine_id IS NULL
      `);
      logger.info('Backfilled work_centres input/eol machine ids where missing');
    } catch (backfillErr) {
      logger.warn('work_centres machine id backfill skipped:', backfillErr.message);
    }
    // Add production_cycle_id to rework_rejection if missing
    try {
      await db.execute('ALTER TABLE rework_rejection ADD COLUMN production_cycle_id BIGINT NULL');
      logger.info('Added production_cycle_id to rework_rejection');
    } catch (e) { if (e.code !== 'ER_DUP_FIELDNAME') throw e; }
    // Add stoppage_reason to machine_centre_production if missing
    try {
      await db.execute('ALTER TABLE machine_centre_production ADD COLUMN stoppage_reason VARCHAR(255) NULL');
      logger.info('Added stoppage_reason to machine_centre_production');
    } catch (e) { if (e.code !== 'ER_DUP_FIELDNAME') throw e; }
    
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

    // ── MES WIP daily state table ─────────────────────────────────────────────
    // Persists Opening WIP, Input (line input machine, e.g. 01), Current WIP, Closing WIP
    // per work centre per day. Formula: Current WIP = Opening WIP + Input - Output
    await db.execute(`
      CREATE TABLE IF NOT EXISTS wip_daily_state (
        id              INT AUTO_INCREMENT PRIMARY KEY,
        work_centre_id  INT NOT NULL,
        state_date      DATE NOT NULL,
        opening_wip     INT NOT NULL DEFAULT 0,
        today_input     INT NOT NULL DEFAULT 0,
        current_wip     INT NOT NULL DEFAULT 0,
        closing_wip     INT NOT NULL DEFAULT 0,
        is_closed       TINYINT(1) NOT NULL DEFAULT 0,
        created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_wip_wc_date (work_centre_id, state_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    logger.info('wip_daily_state table ready');
    try {
      await db.execute(
        'ALTER TABLE wip_daily_state ADD COLUMN manual_wip_override TINYINT(1) NOT NULL DEFAULT 0'
      );
      logger.info('Added manual_wip_override to wip_daily_state');
    } catch (wipAlterError) {
      if (wipAlterError.code !== 'ER_DUP_FIELDNAME') {
        throw wipAlterError;
      }
    }

    await db.execute(`
      CREATE TABLE IF NOT EXISTS line_style_assignments (
        id                INT AUTO_INCREMENT PRIMARY KEY,
        assignment_date   DATE NOT NULL,
        work_centre_id    INT NOT NULL,
        style_id          INT NOT NULL,
        customer_id       INT NOT NULL,
        group_id          INT NULL,
        leather_id        INT NULL,
        color_id          INT NULL,
        routing_header_id INT NULL,
        notes             VARCHAR(500) NULL,
        created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at        DATETIME NULL,
        UNIQUE KEY uq_line_style_date (assignment_date, work_centre_id),
        KEY idx_lsa_wc_date (work_centre_id, assignment_date),
        KEY idx_lsa_style (style_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    logger.info('line_style_assignments table ready');

    await permissionService.bootstrapCanonicalRoles();
    await permissionService.runOneTimeMigration('menu_line_schedule_v1', async () => {
      await permissionService.addMenusToRole('Admin', ['line_schedule']);
      await permissionService.addMenusToRole('Planner', ['line_schedule']);
    });
    await permissionService.bootstrapRoleDefaultsSnapshot();
    logger.info('roles table ready (defaults snapshot initialized when missing)');

  } catch (e) {
    logger.error('Failed to init database:', e.message);
  }
};

const app = express();
const PORT = process.env.PORT || 3001;
const requireLogsAccess = requirePermission(CAPABILITIES.LOGS_REPORTS);
const requireMissedActionsReadAccess = requirePermission(
  CAPABILITIES.MISSED_ACTIONS_READ,
  CAPABILITIES.LOGS_REPORTS
);
const requireProductionRoutingAccess = requirePermission(CAPABILITIES.PRODUCTION_ROUTING);
const requireProductionRoutingReadAccess = requirePermission(
  CAPABILITIES.PRODUCTION_ROUTING_READ,
  CAPABILITIES.PRODUCTION_ROUTING
);
const requireProductionPlanningAccess = requirePermission(CAPABILITIES.PRODUCTION_PLANNING);
const requireTrackerAccess = requirePermission(CAPABILITIES.TRACKER);
const requireReworkAccess = requirePermission(CAPABILITIES.REWORK);
const requireLineSetupAccess = requirePermission(CAPABILITIES.LINE_SETUP);
const requireManualEntryAccess = requirePermission(CAPABILITIES.MANUAL_ENTRY);
const requireAdminAccess = requirePermission(CAPABILITIES.ADMIN);
const requireUsersAdminAccess = (req, res, next) => {
  if (req.params.table !== 'users') return next();
  return requirePermission(CAPABILITIES.ADMIN_USERS)(req, res, next);
};
const requireMonitoringAccess = requirePermission(CAPABILITIES.ADMIN_MONITORING);
const requireProductionLockAccess = requirePermission(CAPABILITIES.PRODUCTION_LOCK);

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

// Auto-cleanup stale missed_action_states daily (rows older than 7 days that are acked/expired-snooze)
setInterval(async () => {
  try {
    const [result] = await db.query(
      `DELETE FROM missed_action_states
       WHERE updated_at < DATE_SUB(NOW(), INTERVAL 7 DAY)
         AND (acknowledged_at IS NOT NULL OR (snoozed_until IS NOT NULL AND snoozed_until < NOW()))`
    );
    if (result.affectedRows > 0) logger.info(`Auto-cleanup: removed ${result.affectedRows} stale missed_action_states row(s)`);
  } catch (err) {
    logger.error('missed_action_states auto-cleanup error:', err.message);
  }
}, 24 * 60 * 60 * 1000); // every 24 hours

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

// Daily WIP auto-close — sets closing_wip so next day opening carries forward
const { startWipAutoCloseScheduler } = require('./services/wipAutoCloseService');
startWipAutoCloseScheduler(logger);

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
app.post('/api/login', validate(validate.schemas.login), authController.login.bind(authController));
app.get('/api/auth/session', authenticate, authController.session.bind(authController));
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
app.get('/api/reports/employee-output', authenticate, requireLogsAccess, validate(validate.schemas.dateQuery), apiController.getEmployeeOutputReport.bind(apiController));
app.get('/api/reports/employee-performance', authenticate, requireLogsAccess, validate(validate.schemas.dateQuery), apiController.getEmployeePerformanceReport.bind(apiController));
app.get('/api/reports/time-loss', authenticate, requireLogsAccess, validate(validate.schemas.dateQuery), apiController.getTimeLossReport.bind(apiController));
app.get('/api/reports/downtime', authenticate, requireLogsAccess, apiController.getDowntimeReport.bind(apiController));
app.get('/api/reports/attendance-production', authenticate, requireLogsAccess, apiController.getAttendanceProductionReport.bind(apiController));
app.get('/api/reports/shift-summary', authenticate, requireLogsAccess, apiController.getShiftSummaryReport.bind(apiController));
app.get('/api/reports/bottleneck', authenticate, requireLogsAccess, validate(validate.schemas.dateQuery), apiController.getBottleneckReport.bind(apiController));
app.get('/api/reports/breakdown', authenticate, requireLogsAccess, validate(validate.schemas.dateQuery), apiController.getBreakdownReport.bind(apiController));

// Master routes — table whitelist on all master endpoints
app.get('/api/masters/:table', validate.allowedTable, authenticateUsersTable, requireUsersAdminAccess, validate.pagination, masterController.getAll.bind(masterController));
app.get('/api/masters/:table/:id', validate.allowedTable, authenticateUsersTable, requireUsersAdminAccess, validate.numericId, masterController.getById);
app.get('/api/masters/:table/code/:code', validate.allowedTable, authenticateUsersTable, requireUsersAdminAccess, masterController.getByCode);
app.get('/api/masters/:table/:id/usage', validate.allowedTable, authenticateUsersTable, requireUsersAdminAccess, validate.numericId, masterController.getUsage.bind(masterController));
app.post('/api/masters/:table/:id/restore', validate.allowedTable, authenticate, requireAdminAccess, validate.numericId, masterController.restore.bind(masterController));
app.get('/api/masters/employees/emp_id/:empId', masterController.getByEmpId);
app.post('/api/masters/employees/quick-register', masterController.quickRegisterEmployee.bind(masterController));
app.get('/api/masters/machine_centres/machine_id/:machineId', masterController.getByMachineId);
app.post('/api/masters/:table', validate.allowedTable, authenticate, requireAdminAccess, masterController.create.bind(masterController));
app.put('/api/masters/:table/:id', validate.allowedTable, authenticate, requireAdminAccess, validate.numericId, masterController.update.bind(masterController));
app.delete('/api/masters/:table/:id', validate.allowedTable, authenticate, requireAdminAccess, validate.numericId, masterController.delete.bind(masterController));

// Production routing routes
app.get('/api/production-routing', authenticate, requireProductionRoutingAccess, validate.pagination, productionRoutingController.getAll.bind(productionRoutingController));
app.get('/api/production-routing/masters', authenticate, requireProductionRoutingAccess, productionRoutingController.getMastersData.bind(productionRoutingController));
app.get('/api/production-routing/style/:styleId', authenticate, requireProductionRoutingReadAccess, productionRoutingController.getByStyleId.bind(productionRoutingController));
app.get('/api/production-routing/:id', authenticate, requireProductionRoutingAccess, validate.numericId, productionRoutingController.getById.bind(productionRoutingController));
app.post('/api/production-routing', authenticate, requireProductionRoutingAccess, productionRoutingController.create.bind(productionRoutingController));
app.post('/api/production-routing/bulk', authenticate, requireProductionRoutingAccess, productionRoutingController.createBulk.bind(productionRoutingController));
app.put('/api/production-routing/:id', authenticate, requireProductionRoutingAccess, validate.numericId, productionRoutingController.update.bind(productionRoutingController));
app.delete('/api/production-routing/:id', authenticate, requireProductionRoutingAccess, validate.numericId, productionRoutingController.delete.bind(productionRoutingController));
app.post('/api/production-routing/:id/restore', authenticate, requireProductionRoutingAccess, validate.numericId, productionRoutingController.restore.bind(productionRoutingController));

// Production planning routes
app.get('/api/production-planning', authenticate, requireProductionPlanningAccess, validate.pagination, productionPlanningController.getAll.bind(productionPlanningController));
app.get('/api/production-planning/board/today', authenticate, requireProductionPlanningAccess, productionPlanningController.getTodayBoard.bind(productionPlanningController));
app.get('/api/production-planning/board/week', authenticate, requireProductionPlanningAccess, productionPlanningController.getWeekGrid.bind(productionPlanningController));
app.get('/api/production-planning/copy-preview', authenticate, requireProductionPlanningAccess, productionPlanningController.getCopyPreview.bind(productionPlanningController));
app.post('/api/production-planning/copy-apply', authenticate, requireProductionPlanningAccess, productionPlanningController.applyCopy.bind(productionPlanningController));
app.get('/api/production-planning/sync-schedule-preview', authenticate, requireProductionPlanningAccess, productionPlanningController.getScheduleSyncPreview.bind(productionPlanningController));
app.post('/api/production-planning/sync-schedule-apply', authenticate, requireProductionPlanningAccess, productionPlanningController.applyScheduleSync.bind(productionPlanningController));
app.get('/api/production-planning/:id', authenticate, requireProductionPlanningAccess, validate.numericId, productionPlanningController.getById.bind(productionPlanningController));
app.post('/api/production-planning', authenticate, requireProductionPlanningAccess, validate(validate.schemas.productionPlan), productionPlanningController.create.bind(productionPlanningController));
app.post('/api/production-planning/bulk', authenticate, requireProductionPlanningAccess, productionPlanningController.createBulk.bind(productionPlanningController));
app.post('/api/production-planning/:id/restore', authenticate, requireProductionPlanningAccess, validate.numericId, productionPlanningController.restore.bind(productionPlanningController));
app.put('/api/production-planning/:id', authenticate, requireProductionPlanningAccess, validate.numericId, validate(validate.schemas.productionPlan), productionPlanningController.update.bind(productionPlanningController));
app.delete('/api/production-planning/:id', authenticate, requireProductionPlanningAccess, validate.numericId, productionPlanningController.delete.bind(productionPlanningController));

// Line schedule (article-on-line assignments)
app.get('/api/line-schedule/board', authenticate, requireProductionPlanningAccess, lineStyleAssignmentController.getBoard.bind(lineStyleAssignmentController));
app.get('/api/line-schedule', authenticate, requireProductionPlanningAccess, lineStyleAssignmentController.getList.bind(lineStyleAssignmentController));
app.post('/api/line-schedule/changeover', authenticate, requireProductionPlanningAccess, lineStyleAssignmentController.changeover.bind(lineStyleAssignmentController));
app.delete('/api/line-schedule/:id', authenticate, requireProductionPlanningAccess, validate.numericId, lineStyleAssignmentController.delete.bind(lineStyleAssignmentController));

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
app.post('/api/mobile-session/activate-from-assignments', mobileSessionController.activateFromEmployeeMachineAssignments);
app.get('/api/mobile-session/active-today', mobileSessionController.getActiveSessionsSnapshot);
app.get('/api/mobile-session/active-for/:machine_id', mobileSessionController.findActiveSession);
app.get('/api/mobile-session/waiting-for/:machine_id', mobileSessionController.findWaitingSession);
app.get('/api/mobile-session/latest-active/:machineId?', mobileSessionController.getLatestActiveSession);
app.get('/api/mobile-sessions/attendance/:workCentreId', mobileSessionController.getAttendance);
app.get('/api/mobile-session/test', (req, res) => res.json({ test: 'working' }));
app.get('/api/mobile-session/:sessionId', mobileSessionController.checkSessionStatus);

// Mobile production routes (public - no JWT for factory floor use)
app.get('/api/mobile-production', mobileProductionController.getAll);
app.get('/api/mobile-production/records', authenticate, mobileProductionController.getPaginatedRecords);
app.get('/api/mobile-production/init/:machineId/:empCode', mobileProductionController.getInitData);
app.get('/api/mobile-production/machine/:machineId/latest-unfinished', mobileProductionController.getLatestUnfinishedByMachine);
app.get('/api/mobile-production/machine/:machineId/daily-cycles', missedActionsController.getMachineDailyCycles);
app.get('/api/mobile-production/machine/:machineId/yesterday-compare', mobileProductionController.getMachineYesterdayCompare);
app.get('/api/mobile-production/manual-entry', authenticate, requireManualEntryAccess, mobileProductionController.getManualEntries);
app.get('/api/mobile-production/manual-entry/audit-logs', authenticate, requireManualEntryAccess, mobileProductionController.getManualEntryAuditLogs);
app.post('/api/mobile-production/manual-entry/audit-logs/:logId/restore', authenticate, requireManualEntryAccess, mobileProductionController.restoreManualEntryFromAuditLog);
app.get('/api/mobile-production/:id', mobileProductionController.getById);
app.get('/api/mobile-production/machine/:machineId/date/:date', mobileProductionController.getByMachineAndDate);
app.get('/api/mobile-production/summary/:machineId/date/:date', mobileProductionController.getSummaryByMachineAndDate);
app.get('/api/mobile-production/live-status/:machineId', mobileProductionController.getLiveMachineStatus);
app.post('/api/mobile-production', checkDayLock('prod_date', 'work_centre_id'), mobileProductionController.create);
app.post('/api/mobile-production/manual-entry', authenticate, requireManualEntryAccess, checkDayLock('prod_date', 'work_centre_id'), mobileProductionController.createManualEntry);
app.put('/api/mobile-production/manual-entry/:id', authenticate, requireManualEntryAccess, checkDayLock('prod_date', 'work_centre_id'), mobileProductionController.updateManualEntry);
app.delete('/api/mobile-production/manual-entry/:id', authenticate, requireManualEntryAccess, checkDayLock('prod_date', 'work_centre_id'), mobileProductionController.deleteManualEntry);

// WIP daily state CRUD (manual entry area)
app.get('/api/wip-daily-state', authenticate, requireManualEntryAccess, wipDailyStateController.listWipDailyState);
app.get('/api/wip-daily-state/onboarding', authenticate, requireManualEntryAccess, wipDailyStateController.getOnboardingStatus);
app.post('/api/wip-daily-state/onboard', authenticate, requireManualEntryAccess, checkDayLock('state_date', 'work_centre_id'), wipDailyStateController.onboardLine);
app.get('/api/wip-daily-state/breakdown', authenticate, requireManualEntryAccess, wipDailyStateController.getWipBreakdown);
app.post('/api/wip-daily-state/refresh', authenticate, requireManualEntryAccess, wipDailyStateController.refreshLiveWip);
app.get('/api/wip-daily-state/:id', authenticate, requireManualEntryAccess, wipDailyStateController.getWipDailyStateById);
app.post('/api/wip-daily-state', authenticate, requireManualEntryAccess, checkDayLock('state_date', 'work_centre_id'), wipDailyStateController.createWipDailyState);
app.put('/api/wip-daily-state/:id', authenticate, requireManualEntryAccess, checkDayLock('state_date', 'work_centre_id'), wipDailyStateController.updateWipDailyState);
app.delete('/api/wip-daily-state/:id', authenticate, requireManualEntryAccess, checkDayLock('state_date', 'work_centre_id'), wipDailyStateController.deleteWipDailyState);
app.put('/api/mobile-production/:id', mobileProductionController.update);
app.patch('/api/mobile-production/:id/status', checkDayLock('prod_date', 'work_centre_id'), mobileProductionController.updateStatus);
app.delete('/api/mobile-production/:id', mobileProductionController.delete);

// Pivot data routes
app.get('/api/pivot-data', mobileProductionController.getPivotData);
app.post('/api/pivot-data/refresh', mobileProductionController.refreshPivotData);

// Production Tracker routes
app.get('/api/tracker/summary', authenticate, requireTrackerAccess, productionTrackerController.getSummary.bind(productionTrackerController));
app.get('/api/tracker/pacing', authenticate, requireTrackerAccess, productionTrackerController.getPacingData.bind(productionTrackerController));
app.get('/api/tracker/hourly', authenticate, requireTrackerAccess, productionTrackerController.getHourlyPerformance.bind(productionTrackerController));
app.get('/api/tracker/workstations', authenticate, requireTrackerAccess, productionTrackerController.getWorkstationPerformance.bind(productionTrackerController));
app.get('/api/tracker/stoppages', authenticate, requireTrackerAccess, productionTrackerController.getStoppageReasons.bind(productionTrackerController));
app.get('/api/tracker/line-performance', authenticate, requireTrackerAccess, productionTrackerController.getLinePerformance.bind(productionTrackerController));
app.post('/api/tracker/alert-actions/query', authenticate, requireTrackerAccess, productionTrackerController.getAlertActions.bind(productionTrackerController));
app.post('/api/tracker/alert-actions/ack', authenticate, requireTrackerAccess, productionTrackerController.acknowledgeAlert.bind(productionTrackerController));
app.post('/api/tracker/alert-actions/escalate', authenticate, requireTrackerAccess, productionTrackerController.escalateAlert.bind(productionTrackerController));
app.get('/api/tracker/machine-time-loss', authenticate, requireTrackerAccess, productionTrackerController.getMachineTimeLossMeta.bind(productionTrackerController));
app.get('/api/tracker/line-yesterday-compare', authenticate, requireTrackerAccess, productionTrackerController.getLineYesterdayCompare.bind(productionTrackerController));
app.post('/api/tracker/time-loss-reason', authenticate, requireTrackerAccess, productionTrackerController.saveMachineTimeLossReason.bind(productionTrackerController));
app.get('/api/missed-actions', authenticate, requireLogsAccess, missedActionsController.getMissedActions);
app.get('/api/missed-actions/daily-report', authenticate, requireMissedActionsReadAccess, missedActionsController.getMissedActionsDailyReport);
app.get('/api/missed-actions/weekly-trend', authenticate, requireLogsAccess, missedActionsController.getWeeklyTrend);
app.post('/api/missed-actions/ack', authenticate, requireLogsAccess, missedActionsController.acknowledgeMissedAction);
app.post('/api/missed-actions/snooze', authenticate, requireLogsAccess, missedActionsController.snoozeMissedAction);
app.post('/api/missed-actions/unmute', authenticate, requireLogsAccess, missedActionsController.unmuteAction);
app.post('/api/missed-actions/root-cause', authenticate, requireLogsAccess, missedActionsController.saveRootCause);
app.delete('/api/missed-actions/cleanup', authenticate, requireAdminAccess, missedActionsController.cleanupStaleStates);
app.get('/api/idle-reminder-settings', authenticate, requireLogsAccess, idleReminderSettingsController.listSettings);
app.get('/api/idle-reminder-settings/machine/:machineId', idleReminderSettingsController.getMachineSettings);
app.put('/api/idle-reminder-settings/machine/:machineId', authenticate, requireLogsAccess, idleReminderSettingsController.saveMachineSettings);
app.delete('/api/idle-reminder-settings/machine/:machineId', authenticate, requireLogsAccess, idleReminderSettingsController.resetMachineSettings);

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

// Lightweight tab broadcast routes (public view, authless machine tabs)
app.post('/api/tab-broadcast/:broadcastId/frame', tabBroadcastController.upsertFrame);
app.post('/api/tab-broadcast/:broadcastId/stop', tabBroadcastController.stopBroadcast);
app.get('/api/tab-broadcast/:broadcastId/frame', tabBroadcastController.getFrame);
app.get('/api/tab-broadcast/:broadcastId/view', tabBroadcastController.viewerPage);

// Logs routes (protected)
app.get('/api/mobile-sessions/logs', authenticate, requireLogsAccess, mobileSessionController.getSessionLogs);
app.get('/api/mobile-sessions/yesterday-login-preview', authenticate, requireLogsAccess, mobileSessionController.getYesterdayLoginPreview);
app.post('/api/mobile-sessions/activate-yesterday-logins', authenticate, requireLogsAccess, mobileSessionController.activateYesterdayLogins);
app.get('/api/mobile-sessions/cycles', authenticate, requireLogsAccess, mobileSessionController.getCycleDetails);
app.post('/api/mobile-sessions/deactivate', authenticate, requireLogsAccess, mobileSessionController.deactivateSession);
app.post('/api/mobile-sessions/reactivate', authenticate, requireLogsAccess, mobileSessionController.reactivateSessionFromLogs);
app.get(
  '/api/mobile-sessions/active-snapshot',
  authenticate,
  requirePermission(CAPABILITIES.LINE_SETUP, CAPABILITIES.MANUAL_ENTRY),
  mobileSessionController.getActiveSessionsSnapshot
);

// TV Dashboard routes
app.get('/api/tv-dashboard/work-centres', tvDashboardController.getWorkCentres);
app.get('/api/tv-dashboard/machine-centres/:workCentreId', tvDashboardController.getMachineCentresByWorkCentre);
app.get('/api/tv-dashboard/dashboard/:workCentreId', tvDashboardController.getDashboard);

// Hourly Output routes
app.get('/api/hourly-output/:workCentreId', hourlyOutputController.getHourlyOutput);
app.get('/api/hourly-output/:workCentreId/machines', hourlyOutputController.getMachineHourlyOutput);

// Rework Rejection routes
// Keep summary public for TV dashboard screens (no operator login on display units).
app.get('/api/rework-rejection/summary', reworkRejectionController.getSummaryByWorkCentre.bind(reworkRejectionController));
app.get('/api/rework-rejection', authenticate, requireReworkAccess, reworkRejectionController.getAll.bind(reworkRejectionController));
app.post('/api/rework-rejection', authenticate, requireReworkAccess, validate(validate.schemas.reworkRejection), checkDayLock('production_date', 'work_centre_id'), reworkRejectionController.save.bind(reworkRejectionController));
app.put('/api/rework-rejection/:id', authenticate, requireReworkAccess, validate.numericId, reworkRejectionController.update.bind(reworkRejectionController));
app.delete('/api/rework-rejection/:id', authenticate, requireReworkAccess, validate.numericId, reworkRejectionController.delete.bind(reworkRejectionController));
app.get('/api/rework-rejection/cycles', authenticate, requireReworkAccess, reworkRejectionController.getCyclesForDate.bind(reworkRejectionController));

// Role routes
app.get('/api/roles/menu-catalog', authenticate, requireAdminAccess, roleController.getMenuCatalog);
app.post('/api/roles/save-defaults', authenticate, requireAdminAccess, roleController.saveDefaults);
app.post('/api/roles/reset-defaults', authenticate, requireAdminAccess, roleController.resetDefaults);
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

// Production UI: serve Vite build from one process (set FRONTEND_DIST or build frontend/dist)
const FRONTEND_DIST = process.env.FRONTEND_DIST
  ? getAbsolutePath(process.env.FRONTEND_DIST)
  : path.resolve(__dirname, '../../frontend/dist');

if (fs.existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST, { index: false, maxAge: '1d' }));
  app.get('*', (req, res, next) => {
    if (
      req.method !== 'GET' ||
      req.path.startsWith('/api') ||
      req.path === '/health' ||
      req.path.startsWith('/health/')
    ) {
      return next();
    }
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'), (err) => {
      if (err) next(err);
    });
  });
  logger.info(`Serving frontend from ${FRONTEND_DIST}`);
} else {
  logger.warn(
    `Frontend build not found at ${FRONTEND_DIST}. Run "npm run build" in frontend, or set FRONTEND_DIST.`
  );
}

app.use(errorHandler);

const useHttps = false;
let server;
server = http.createServer(app);
logger.info('Running on HTTP (HTTPS disabled for mobile compatibility)');

server.listen(PORT, '0.0.0.0', () => {
  logger.info(`Server started on port ${PORT} (${useHttps ? 'HTTPS' : 'HTTP'}) and listening on all interfaces`);
  fileWatcherService.start();
  // NOTE: Do not expire active mobile sessions on backend restart.
  // Active sessions are now preserved across restarts unless the daily auto-close scheduler triggers later.
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
