const stitchingEventRepository = require('../repositories/stitchingEventRepository');
const logger = require('../utils/logger');

class ApiController {
  async getMachineStatus(req, res) {
    try {
      const machines = await stitchingEventRepository.getLatestMachineStatus();
      res.json({
        success: true,
        data: machines
      });
    } catch (error) {
      logger.error('Error getting machine status:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async getRunIdleReport(req, res) {
    try {
      const { date } = req.query;
      
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid date format. Use YYYY-MM-DD'
        });
      }

      const report = await stitchingEventRepository.getRunIdleReport(date);
      res.json({
        success: true,
        date,
        data: report
      });
    } catch (error) {
      logger.error('Error getting run-idle report:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async getHourlyReport(req, res) {
    try {
      const { date } = req.query;
      
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid date format. Use YYYY-MM-DD'
        });
      }

      const report = await stitchingEventRepository.getHourlyReport(date);
      res.json({
        success: true,
        date,
        data: report
      });
    } catch (error) {
      logger.error('Error getting hourly report:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async getEfficiencyReport(req, res) {
    try {
      const { date } = req.query;
      
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid date format. Use YYYY-MM-DD'
        });
      }

      const report = await stitchingEventRepository.getEfficiencyReport(date);
      res.json({
        success: true,
        date,
        data: report
      });
    } catch (error) {
      logger.error('Error getting efficiency report:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async getOverallEfficiency(req, res) {
    try {
      const { date } = req.query;
      
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid date format. Use YYYY-MM-DD'
        });
      }

      const efficiency = await stitchingEventRepository.getOverallEfficiency(date);
      res.json({
        success: true,
        date,
        data: efficiency
      });
    } catch (error) {
      logger.error('Error getting overall efficiency:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
}

module.exports = new ApiController();