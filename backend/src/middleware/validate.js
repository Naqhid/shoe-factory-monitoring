/**
 * Validation middleware factory
 * Usage: validate(schema) — schema has body/query/params keys with field rules
 */

const ALLOWED_TABLES = [
  'customers', 'groups_master', 'leather', 'styles', 'colors',
  'work_centres', 'machine_centres', 'employees', 'users', 'forms_master'
];

const checkField = (value, rule, fieldName) => {
  if (rule.required && (value === undefined || value === null || value === '')) {
    return `${fieldName} is required`;
  }
  if (value === undefined || value === null || value === '') return null;

  if (rule.type === 'int') {
    const n = parseInt(value, 10);
    if (isNaN(n)) return `${fieldName} must be an integer`;
    if (rule.min !== undefined && n < rule.min) return `${fieldName} must be >= ${rule.min}`;
    if (rule.max !== undefined && n > rule.max) return `${fieldName} must be <= ${rule.max}`;
  }
  if (rule.type === 'float') {
    const n = parseFloat(value);
    if (isNaN(n)) return `${fieldName} must be a number`;
    if (rule.min !== undefined && n < rule.min) return `${fieldName} must be >= ${rule.min}`;
  }
  if (rule.type === 'string') {
    if (typeof value !== 'string') return `${fieldName} must be a string`;
    if (rule.maxLen && value.length > rule.maxLen) return `${fieldName} must be <= ${rule.maxLen} characters`;
    if (rule.pattern && !rule.pattern.test(value)) return `${fieldName} has invalid format`;
  }
  if (rule.type === 'date') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${fieldName} must be a valid date (YYYY-MM-DD)`;
  }
  if (rule.enum && !rule.enum.includes(value)) {
    return `${fieldName} must be one of: ${rule.enum.join(', ')}`;
  }
  return null;
};

const validate = (schema) => (req, res, next) => {
  const errors = [];
  for (const [section, fields] of Object.entries(schema)) {
    const source = req[section] || {};
    for (const [fieldName, rule] of Object.entries(fields)) {
      const err = checkField(source[fieldName], rule, fieldName);
      if (err) errors.push(err);
    }
  }
  if (errors.length > 0) {
    return res.status(400).json({ success: false, error: errors[0], errors });
  }
  next();
};

// Whitelist :table param to prevent SQL injection via table name
validate.allowedTable = (req, res, next) => {
  const { table } = req.params;
  if (!ALLOWED_TABLES.includes(table)) {
    return res.status(400).json({ success: false, error: `Invalid table: ${table}` });
  }
  next();
};

// Validate :id is a positive integer
validate.numericId = (req, res, next) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id) || id < 1) {
    return res.status(400).json({ success: false, error: 'Invalid ID' });
  }
  req.params.id = id;
  next();
};

// Validate pagination query params and clamp to safe values
validate.pagination = (req, res, next) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 10));
  req.query.page = page;
  req.query.limit = limit;
  next();
};

// Schemas for specific routes
validate.schemas = {
  login: {
    body: {
      login: { required: true, type: 'string', maxLen: 50 },
      password: { required: true, type: 'string', maxLen: 100 },
    }
  },
  productionPlan: {
    body: {
      plan_date: { required: true, type: 'date' },
      style_id: { required: true, type: 'int', min: 1 },
      customer_id: { required: true, type: 'int', min: 1 },
      work_centre_id: { required: true, type: 'int', min: 1 },
      total_target_per_day: { required: true, type: 'int', min: 1 },
      smv_per_pair: { required: true, type: 'float', min: 0 },
    }
  },
  reworkRejection: {
    body: {
      work_centre_id: { required: true, type: 'int', min: 1 },
      production_date: { required: true, type: 'date' },
      rework_qty: { type: 'int', min: 0 },
      rejection_qty: { type: 'int', min: 0 },
    }
  },
  dateQuery: {
    query: {
      fromDate: { required: true, type: 'date' },
      toDate: { required: true, type: 'date' },
    }
  },
};

module.exports = validate;
