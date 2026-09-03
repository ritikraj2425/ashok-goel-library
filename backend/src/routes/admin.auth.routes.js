const express = require('express');
const router = express.Router();
const authAdmin = require('../middleware/authAdmin');
const validate = require('../middleware/validate');
const { loginLimiter } = require('../middleware/rateLimiter');
const { adminLoginSchema } = require('../validators/admin.validator');
const { setAdminToken, clearAdminToken } = require('../utils/cookie.utils');
const Admin = require('../models/Admin');

/**
 * POST /api/admin/auth/login
 * Admin login with username/password.
 */
router.post('/login', loginLimiter, validate(adminLoginSchema), async (req, res, next) => {
  try {
    const { username, password } = req.body;

    const admin = await Admin.findOne({ username: username.toLowerCase() });

    // Generic error message for security
    if (!admin) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!admin.isActive) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    admin.lastLoginAt = new Date();
    await admin.save();

    const token = setAdminToken(res, admin);

    res.json({
      message: 'Login successful',
      token,
      admin: admin.toPublic(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/auth/logout
 * Clear admin auth cookie.
 */
router.post('/logout', (req, res) => {
  clearAdminToken(res);
  res.json({ message: 'Logged out successfully' });
});

/**
 * GET /api/admin/me
 * Get current authenticated admin.
 */
router.get('/me', authAdmin, (req, res) => {
  res.json({ admin: req.admin.toPublic() });
});

module.exports = router;
