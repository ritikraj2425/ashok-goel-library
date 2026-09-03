const express = require('express');
const router = express.Router();
const authStudent = require('../middleware/authStudent');
const validate = require('../middleware/validate');
const { loginLimiter } = require('../middleware/rateLimiter');
const { googleAuthSchema } = require('../validators/auth.validator');
const { verifyGoogleToken } = require('../config/google');
const { isValidCollegeEmail } = require('../utils/email.utils');
const { setStudentToken, clearStudentToken } = require('../utils/cookie.utils');
const User = require('../models/User');

/**
 * POST /api/auth/google
 * Authenticate student with Google ID token.
 */
router.post('/google', loginLimiter, validate(googleAuthSchema), async (req, res, next) => {
  try {
    const { idToken } = req.body;

    // Verify Google token
    let googleUser;
    try {
      googleUser = await verifyGoogleToken(idToken);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid Google token' });
    }

    // Validate college email domain
    if (!isValidCollegeEmail(googleUser.email)) {
      return res.status(403).json({
        error: 'Only Rishihood University email addresses are allowed',
      });
    }

    // Upsert user
    let user = await User.findOne({ googleId: googleUser.googleId });

    if (user) {
      user.lastLoginAt = new Date();
      user.name = googleUser.name;
      await user.save();
    } else {
      user = await User.create({
        googleId: googleUser.googleId,
        email: googleUser.email,
        name: googleUser.name,
        lastLoginAt: new Date(),
      });
    }

    // Set token in cookie and return it for localStorage
    const token = setStudentToken(res, user);

    res.json({
      message: 'Login successful',
      token,
      user: user.toPublic(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/logout
 * Clear student auth cookie.
 */
router.post('/logout', (req, res) => {
  clearStudentToken(res);
  res.json({ message: 'Logged out successfully' });
});

/**
 * GET /api/me
 * Get current authenticated student.
 */
router.get('/me', authStudent, (req, res) => {
  res.json({ user: req.user.toPublic() });
});

/**
 * PUT /api/auth/profile
 * Update student profile.
 */
router.put('/profile', authStudent, async (req, res, next) => {
  try {
    const { phoneNumber, enrollmentNumber } = req.body;
    
    // We only update what is provided
    if (phoneNumber !== undefined) {
      req.user.phoneNumber = phoneNumber.trim();
    }
    if (enrollmentNumber !== undefined) {
      req.user.enrollmentNumber = enrollmentNumber.trim();
    }
    
    await req.user.save();
    
    res.json({ message: 'Profile updated successfully', user: req.user.toPublic() });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
