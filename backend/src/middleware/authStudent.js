const jwt = require('jsonwebtoken');
const User = require('../models/User');
const env = require('../config/env');

/**
 * Middleware to authenticate student users.
 * Checks JWT from cookie OR Authorization header (for localStorage token).
 */
async function authStudent(req, res, next) {
  try {
    let token = req.cookies?.student_token;

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
      decoded = jwt.verify(token, env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    if (decoded.type !== 'student') {
      return res.status(401).json({ error: 'Invalid token type' });
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    if (user.isBlocked) {
      return res.status(403).json({ error: 'Your account is permanently blocked. Contact administration.' });
    }

    if (user.blockedUntil && user.blockedUntil > new Date()) {
      return res.status(403).json({ error: `Your account is temporarily blocked until ${user.blockedUntil.toLocaleString()} due to a missed check-in.` });
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = authStudent;
