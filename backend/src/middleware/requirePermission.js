'use strict';

const permissionService = require('../services/permissionService');

/**
 * @param {...string} capabilities - user must hold at least one (with routing-read aliases)
 */
function requirePermission(...capabilities) {
  return async (req, res, next) => {
    try {
      if (!req.user?.role) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }
      const ok = await permissionService.userHasAnyCapability(req.user, capabilities);
      if (!ok) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = requirePermission;
