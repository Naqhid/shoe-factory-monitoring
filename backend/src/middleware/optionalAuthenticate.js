const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  throw new Error('JWT_SECRET is required');
}

// Optional auth: if valid Bearer token is present, attach req.user.
// If missing/invalid, continue as anonymous (public access routes).
const optionalAuthenticate = (req, _res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return next();

  try {
    req.user = jwt.verify(token, SECRET);
  } catch {
    // Intentionally ignore token errors for optional auth mode.
  }
  return next();
};

module.exports = optionalAuthenticate;

