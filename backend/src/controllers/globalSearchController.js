const db = require('../../config/database');
const logger = require('../utils/logger');

class GlobalSearchController {
  async globalSearch(req, res) {
    try {
      const { q, limit = 10 } = req.query;
      const searchQuery = String(q || '').trim();

      if (!searchQuery || searchQuery.length < 2) {
        return res.json({ success: true, data: [] });
      }

      const searchLimit = Math.min(parseInt(limit) || 10, 50);
      const searchTerm = `%${searchQuery}%`;

      // Search across multiple entities
      const results = [];

      // Helper function to safely execute queries
      const safeQuery = async (sql, params) => {
        try {
          const [rows] = await db.query(sql, params);
          return rows;
        } catch (error) {
          if (error.code === 'ER_BAD_FIELD_ERROR') {
            // Column doesn't exist, return empty array
            logger.warn(`Column not found in query: ${sql.substring(0, 50)}...`);
            return [];
          }
          throw error;
        }
      };

      // Search customers
      const customers = await safeQuery(
        `SELECT id, code, name, 'customer' as type, '/customers' as route 
         FROM customers 
         WHERE code LIKE ? OR name LIKE ? 
         LIMIT ?`,
        [searchTerm, searchTerm, searchLimit]
      );
      results.push(...customers);

      // Search groups
      const groups = await safeQuery(
        `SELECT id, code, name, 'group' as type, '/groups' as route 
         FROM groups_master 
         WHERE code LIKE ? OR name LIKE ? 
         LIMIT ?`,
        [searchTerm, searchTerm, searchLimit]
      );
      results.push(...groups);

      // Search leather
      const leathers = await safeQuery(
        `SELECT id, code, name, 'leather' as type, '/leather' as route 
         FROM leather 
         WHERE code LIKE ? OR name LIKE ? 
         LIMIT ?`,
        [searchTerm, searchTerm, searchLimit]
      );
      results.push(...leathers);

      // Search styles
      const styles = await safeQuery(
        `SELECT id, code, name, 'style' as type, '/styles' as route 
         FROM styles 
         WHERE code LIKE ? OR name LIKE ? 
         LIMIT ?`,
        [searchTerm, searchTerm, searchLimit]
      );
      results.push(...styles);

      // Search colors
      const colors = await safeQuery(
        `SELECT id, code, name, 'color' as type, '/colors' as route 
         FROM colors 
         WHERE code LIKE ? OR name LIKE ? 
         LIMIT ?`,
        [searchTerm, searchTerm, searchLimit]
      );
      results.push(...colors);

      // Search work centres
      const workCentres = await safeQuery(
        `SELECT id, code, name, 'work_centre' as type, '/work_centres' as route 
         FROM work_centres 
         WHERE deleted_at IS NULL AND (code LIKE ? OR name LIKE ?) 
         LIMIT ?`,
        [searchTerm, searchTerm, searchLimit]
      );
      results.push(...workCentres);

      // Search machine centres
      const machineCentres = await safeQuery(
        `SELECT id, code, name, 'machine_centre' as type, '/machine_centres' as route 
         FROM machine_centres 
         WHERE deleted_at IS NULL AND (code LIKE ? OR name LIKE ? OR machine_id LIKE ?) 
         LIMIT ?`,
        [searchTerm, searchTerm, searchTerm, searchLimit]
      );
      results.push(...machineCentres);

      // Search employees
      const employees = await safeQuery(
        `SELECT id, code, name, 'employee' as type, '/employees' as route 
         FROM employees 
         WHERE deleted_at IS NULL AND (code LIKE ? OR name LIKE ?) 
         LIMIT ?`,
        [searchTerm, searchTerm, searchLimit]
      );
      results.push(...employees);

      // Search users
      const users = await safeQuery(
        `SELECT id, code, name, 'user' as type, '/users' as route 
         FROM users 
         WHERE code LIKE ? OR name LIKE ? 
         LIMIT ?`,
        [searchTerm, searchTerm, searchLimit]
      );
      results.push(...users);

      // Search roles
      const roles = await safeQuery(
        `SELECT id, role_name as name, role_name as code, 'role' as type, '/roles' as route 
         FROM roles 
         WHERE role_name LIKE ? 
         LIMIT ?`,
        [searchTerm, searchLimit]
      );
      results.push(...roles);

      // Search production routing headers
      const routings = await safeQuery(
        `SELECT prh.id, CONCAT('R', prh.id) as code, 
         CONCAT(s.name, ' - ', c.name, ' - ', l.name) as name, 
         'production_routing' as type, '/production_routing' as route 
         FROM production_routing_header prh
         LEFT JOIN styles s ON prh.style_id = s.id
         LEFT JOIN colors c ON prh.color_id = c.id
         LEFT JOIN leather l ON prh.leather_id = l.id
         WHERE prh.deleted_at IS NULL AND (
           s.name LIKE ? OR c.name LIKE ? OR l.name LIKE ? OR 
           CONCAT(s.name, ' - ', c.name) LIKE ?
         )
         LIMIT ?`,
        [searchTerm, searchTerm, searchTerm, searchTerm, searchLimit]
      );
      results.push(...routings);

      // Search production plans
      const plans = await safeQuery(
        `SELECT pp.id, CONCAT('P', pp.id) as code,
         CONCAT(s.name, ' - ', c.name, ' - ', DATE(pp.plan_date)) as name,
         'production_plan' as type, '/production_planning' as route
         FROM production_plan pp
         LEFT JOIN styles s ON pp.style_id = s.id
         LEFT JOIN colors c ON pp.color_id = c.id
         LEFT JOIN leather l ON pp.leather_id = l.id
         LEFT JOIN work_centres wc ON pp.work_centre_id = wc.id
         WHERE pp.deleted_at IS NULL AND (
           s.name LIKE ? OR c.name LIKE ? OR l.name LIKE ? OR wc.name LIKE ?
         )
         LIMIT ?`,
        [searchTerm, searchTerm, searchTerm, searchTerm, searchLimit]
      );
      results.push(...plans);

      // Search production alerts
      const alerts = await safeQuery(
        `SELECT pa.id, CONCAT('A', pa.id) as code,
         CONCAT(pa.alert_type, ': ', pa.message) as name,
         'production_alert' as type, '/alert_center' as route
         FROM production_alerts pa
         WHERE pa.alert_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) AND (
           pa.alert_type LIKE ? OR pa.message LIKE ?
         )
         LIMIT ?`,
        [searchTerm, searchTerm, searchLimit]
      );
      results.push(...alerts);

      // Sort results by relevance (exact matches first, then starts with, then contains)
      results.sort((a, b) => {
        const aCode = (a.code || '').toLowerCase();
        const bCode = (b.code || '').toLowerCase();
        const aName = (a.name || '').toLowerCase();
        const bName = (b.name || '').toLowerCase();
        const searchLower = searchQuery.toLowerCase();

        // Exact code match
        if (aCode === searchLower && bCode !== searchLower) return -1;
        if (bCode === searchLower && aCode !== searchLower) return 1;

        // Exact name match
        if (aName === searchLower && bName !== searchLower) return -1;
        if (bName === searchLower && aName !== searchLower) return 1;

        // Starts with code
        if (aCode.startsWith(searchLower) && !bCode.startsWith(searchLower)) return -1;
        if (bCode.startsWith(searchLower) && !aCode.startsWith(searchLower)) return 1;

        // Starts with name
        if (aName.startsWith(searchLower) && !bName.startsWith(searchLower)) return -1;
        if (bName.startsWith(searchLower) && !aName.startsWith(searchLower)) return 1;

        return 0;
      });

      // Limit total results
      const finalResults = results.slice(0, searchLimit);

      res.json({ success: true, data: finalResults });
    } catch (error) {
      logger.error('Error in global search:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = new GlobalSearchController();
