const express = require('express');
const router = express.Router();
const authAdmin = require('../middleware/authAdmin');
const User = require('../models/User');

router.use(authAdmin);

/**
 * GET /api/admin/students/blocked
 * Get all temporarily blocked students.
 */
router.get('/blocked', async (req, res, next) => {
  try {
    const now = new Date();
    const blockedStudents = await User.find({
      $or: [
        { isBlocked: true },
        { blockedUntil: { $gt: now } }
      ]
    }).select('name email enrollmentNumber isBlocked blockedUntil').lean();

    res.json({ blockedStudents });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/students/search
 * Search students by email (for autocomplete).
 */
router.get('/search', async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) {
      return res.json({ students: [] });
    }

    const students = await User.find({
      email: { $regex: q, $options: 'i' }
    })
      .select('email name')
      .limit(10)
      .lean();

    res.json({ students });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/students/block
 * Manually permanently block a student by email.
 */
router.post('/block', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      const err = new Error('Email is required');
      err.statusCode = 400;
      throw err;
    }

    const student = await User.findOneAndUpdate(
      { email: email.toLowerCase() },
      { $set: { isBlocked: true } },
      { new: true }
    );

    if (!student) {
      const err = new Error('Student not found with this email');
      err.statusCode = 404;
      throw err;
    }

    res.json({ message: 'Student successfully permanently blocked', student });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/students/:id/unblock
 * Unblock a student (removes blockedUntil and isBlocked).
 */
router.post('/:id/unblock', async (req, res, next) => {
  try {
    const student = await User.findByIdAndUpdate(
      req.params.id,
      {
        $set: { isBlocked: false },
        $unset: { blockedUntil: 1 }
      },
      { new: true }
    );

    if (!student) {
      const err = new Error('Student not found');
      err.statusCode = 404;
      throw err;
    }

    res.json({ message: 'Student successfully unblocked', student });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
