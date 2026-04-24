const { runBackup, listBackups } = require('../services/backupService');
const logger = require('../utils/logger');

class BackupController {
  async triggerBackup(req, res) {
    if (String(req.user?.role || '').toLowerCase() !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }
    try {
      runBackup(); // async — fires and forgets
      res.json({ success: true, message: 'Backup started. Check server logs for result.' });
    } catch (error) {
      logger.error('triggerBackup error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getBackups(req, res) {
    if (String(req.user?.role || '').toLowerCase() !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }
    try {
      const backups = listBackups();
      res.json({ success: true, data: backups });
    } catch (error) {
      logger.error('getBackups error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = new BackupController();
