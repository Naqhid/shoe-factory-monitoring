const logger = require('../utils/logger');
const idleReminderSettings = require('../services/idleReminderSettingsService');

exports.listSettings = async (req, res) => {
  try {
    const data = await idleReminderSettings.listWithMachines();
    res.json({
      success: true,
      data,
      defaults: idleReminderSettings.DEFAULTS,
    });
  } catch (error) {
    logger.error('list idle reminder settings error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      code: error.code || null,
    });
  }
};

exports.getMachineSettings = async (req, res) => {
  try {
    const data = await idleReminderSettings.getForMachine(req.params.machineId);
    res.json({ success: true, data, defaults: idleReminderSettings.DEFAULTS });
  } catch (error) {
    logger.error('get idle reminder settings error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.saveMachineSettings = async (req, res) => {
  try {
    const {
      idle_interval_mins,
      idle_interval_secs,
      idle_interval_secs_part,
      alarm_duration_secs,
      finish_grace_mins,
    } = req.body || {};
    const updatedBy = req.user?.username || req.user?.name || req.user?.email || null;
    const data = await idleReminderSettings.upsert(req.params.machineId, {
      idle_interval_mins,
      idle_interval_secs,
      idle_interval_secs_part,
      alarm_duration_secs,
      finish_grace_mins,
    }, updatedBy);
    res.json({ success: true, data });
  } catch (error) {
    logger.error('save idle reminder settings error:', error);
    const status = /not found/i.test(error.message) ? 404 : 500;
    res.status(status).json({ success: false, error: error.message });
  }
};

exports.resetMachineSettings = async (req, res) => {
  try {
    const data = await idleReminderSettings.removeCustom(req.params.machineId);
    res.json({ success: true, data, defaults: idleReminderSettings.DEFAULTS });
  } catch (error) {
    logger.error('reset idle reminder settings error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};
