'use strict';

const logger = require('../utils/logger');
const lineStyleAssignmentService = require('../services/lineStyleAssignmentService');

class LineStyleAssignmentController {
  async getBoard(req, res) {
    try {
      const data = await lineStyleAssignmentService.getBoard(req.query.date || req.query.assignment_date);
      res.json({ success: true, data });
    } catch (error) {
      logger.error('Error loading line schedule board:', error);
      res.status(error.status || 500).json({ success: false, error: error.message });
    }
  }

  async getList(req, res) {
    try {
      const data = await lineStyleAssignmentService.listAssignments(req.query);
      res.json({ success: true, data });
    } catch (error) {
      logger.error('Error listing line schedule assignments:', error);
      res.status(error.status || 500).json({ success: false, error: error.message });
    }
  }

  async changeover(req, res) {
    try {
      const data = await lineStyleAssignmentService.applyChangeover(req.body || {});
      res.json({ success: true, data, message: `Article updated for ${data.days_updated} day(s).` });
    } catch (error) {
      logger.error('Error applying line changeover:', error);
      res.status(error.status || 500).json({ success: false, error: error.message });
    }
  }

  async delete(req, res) {
    try {
      const data = await lineStyleAssignmentService.softDeleteAssignment(req.params.id);
      res.json({ success: true, data, message: 'Assignment removed.' });
    } catch (error) {
      logger.error('Error deleting line schedule assignment:', error);
      res.status(error.status || 500).json({ success: false, error: error.message });
    }
  }
}

module.exports = new LineStyleAssignmentController();
