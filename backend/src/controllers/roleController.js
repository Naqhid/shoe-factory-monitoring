const db = require('../../config/database');
const permissionService = require('../services/permissionService');
const { ALL_MENU_DEFINITIONS } = require('../config/roleDefaults');

exports.getMenuCatalog = async (req, res) => {
  res.json({ success: true, data: ALL_MENU_DEFINITIONS });
};

exports.saveDefaults = async (req, res) => {
  try {
    const result = await permissionService.snapshotRolesAsDefaults();
    res.json({
      success: true,
      message: `Saved current ${result.count} role(s) as factory defaults`,
      count: result.count,
    });
  } catch (error) {
    console.error('Role saveDefaults error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.resetDefaults = async (req, res) => {
  try {
    const result = await permissionService.restoreRolesFromDefaults();
    res.json({
      success: true,
      message: `Restored ${result.count} role(s) from saved factory defaults`,
      count: result.count,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    console.error('Role resetDefaults error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getAll = async (req, res) => {
  try {
    const [roles] = await db.query('SELECT * FROM roles ORDER BY role_name');
    const parsedRoles = roles.map(role => {
      let allowedMenus = role.allowed_menus;
      if (typeof allowedMenus === 'string') {
        allowedMenus = JSON.parse(allowedMenus);
      }
      return {
        ...role,
        allowed_menus: allowedMenus
      };
    });
    res.json(parsedRoles);
  } catch (error) {
    console.error('Role getAll error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const [roles] = await db.query('SELECT * FROM roles WHERE id = ?', [req.params.id]);
    if (roles.length === 0) return res.status(404).json({ error: 'Role not found' });
    let allowedMenus = roles[0].allowed_menus;
    if (typeof allowedMenus === 'string') {
      allowedMenus = JSON.parse(allowedMenus);
    }
    const role = { ...roles[0], allowed_menus: allowedMenus };
    res.json(role);
  } catch (error) {
    console.error('Role getById error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { role_name, default_route, allowed_menus } = req.body;
    const [result] = await db.query(
      'INSERT INTO roles (role_name, default_route, allowed_menus) VALUES (?, ?, ?)',
      [role_name, default_route, JSON.stringify(allowed_menus)]
    );
    permissionService.invalidateCache();
    res.status(201).json({ id: result.insertId, message: 'Role created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.update = async (req, res) => {
  try {
    const { role_name, default_route, allowed_menus } = req.body;
    await db.query(
      'UPDATE roles SET role_name = ?, default_route = ?, allowed_menus = ? WHERE id = ?',
      [role_name, default_route, JSON.stringify(allowed_menus), req.params.id]
    );
    permissionService.invalidateCache();
    res.json({ message: 'Role updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.delete = async (req, res) => {
  try {
    await db.query('DELETE FROM roles WHERE id = ?', [req.params.id]);
    permissionService.invalidateCache();
    res.json({ message: 'Role deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
