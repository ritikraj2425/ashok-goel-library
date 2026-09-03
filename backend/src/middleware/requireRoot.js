const { ADMIN_ROLES } = require('../utils/constants');

/**
 * Middleware to restrict access to root admins only.
 * Must be used after authAdmin middleware.
 */
function requireRoot(req, res, next) {
  if (!req.admin || req.admin.role !== ADMIN_ROLES.ROOT) {
    return res.status(403).json({ error: 'Root administrator access required' });
  }
  next();
}

module.exports = requireRoot;
