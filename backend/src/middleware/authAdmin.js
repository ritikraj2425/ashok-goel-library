const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const env = require('../config/env');

/**
 * Middleware to authenticate admin users.
 * Checks JWT from cookie OR Authorization header.
 */
async function authAdmin(req, res, next) {
  try {
    let token = req.cookies?.admin_token;

    // Also check Authorization header for localStorage-based auth
    if (!token && req.headers.authorization) {
      const parts = req.headers.authorization.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        token = parts[1];
      }
    }

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, env.JWT_ADMIN_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    if (decoded.type !== 'admin') {
      return res.status(401).json({ error: 'Invalid token type' });
    }

    const admin = await Admin.findById(decoded.adminId);
    if (!admin) {
      return res.status(401).json({ error: 'Admin not found' });
    }

    // Deactivated admins lose access immediately
    if (!admin.isActive) {
      return res.status(403).json({ error: 'Account has been deactivated' });
    }

    req.admin = admin;
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = authAdmin;
