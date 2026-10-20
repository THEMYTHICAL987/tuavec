const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');

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
  const expectedToken = process.env.ADMIN_TOKEN;

  if (typeof adminToken !== 'string' || !expectedToken) {
    return res.status(403).json({
      success: false,
      message: 'Admin access is not configured or the token is missing'
    });
  }

  const supplied = Buffer.from(adminToken);
  const expected = Buffer.from(expectedToken);
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) {
    return res.status(403).json({ success: false, message: 'Invalid admin token' });
  }

  next();
};

module.exports = { adminAuth, authenticateUser, optionalAuthenticateUser };
