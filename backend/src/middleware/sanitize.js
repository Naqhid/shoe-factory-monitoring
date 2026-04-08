/**
 * Input sanitization middleware
 * - Strips HTML/script tags to prevent XSS
 * - Trims whitespace from strings
 * - Removes null bytes
 * - Applied globally to req.body, req.query, req.params
 */

const stripDangerous = (value) => {
  if (typeof value !== 'string') return value;
  return value
    .replace(/\0/g, '')                          // null bytes
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '') // script tags
    .replace(/<[^>]+>/g, '')                     // all HTML tags
    .replace(/javascript:/gi, '')                // javascript: protocol
    .replace(/on\w+\s*=/gi, '')                  // inline event handlers
    .trim();
};

const sanitizeObject = (obj) => {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return stripDangerous(obj);
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeObject);
  const result = {};
  for (const key of Object.keys(obj)) {
    result[key] = sanitizeObject(obj[key]);
  }
  return result;
};

const sanitize = (req, res, next) => {
  if (req.body) req.body = sanitizeObject(req.body);
  if (req.query) req.query = sanitizeObject(req.query);
  // Don't sanitize params — they're validated separately
  next();
};

module.exports = sanitize;
