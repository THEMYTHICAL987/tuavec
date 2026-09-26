const jwt = require('jsonwebtoken');

const authenticateUser = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'change-this-jwt-secret');
    next();
  } catch (_error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired session' });
  }
};

const optionalAuthenticateUser = (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) {
    try {
      req.user = jwt.verify(token, process.env.JWT_SECRET || 'change-this-jwt-secret');
    } catch (_error) {
      // Guest checkout remains available when an old session has expired.
    }
  }
  next();
};

// Admin authentication middleware - checks for admin token in header
const adminAuth = (req, res, next) => {
  const adminToken = req.headers['x-admin-token'];
  const expectedToken = process.env.ADMIN_TOKEN || 'admin-secret-key-change-in-production';

  if (!adminToken || adminToken !== expectedToken) {
    return res.status(403).json({
      success: false,
      message: 'Unauthorized: Admin token required'
    });
  }

  next();
};

module.exports = { adminAuth, authenticateUser, optionalAuthenticateUser };
