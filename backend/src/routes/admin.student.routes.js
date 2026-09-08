const express = require('express');
const router = express.Router();
const authAdmin = require('../middleware/authAdmin');
const User = require('../models/User');
const Booking = require('../models/Booking');
const { BOOKING_STATUS } = require('../utils/constants');

router.use(authAdmin);

/**
 * GET /api/admin/students/blocked
 * Get all temporarily blocked students.
 */
router.get('/blocked', async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const skip = (pageNum - 1) * limitNum;

    const now = new Date();
    const filter = {
      $or: [
        { isBlocked: true },
        { blockedUntil: { $gt: now } }
      ]
    };

    const [blockedStudents, total] = await Promise.all([
      User.find(filter)
        .select('name email enrollmentNumber isBlocked blockedUntil')
        .skip(skip)
        .limit(limitNum)
        .lean(),
      User.countDocuments(filter)
    ]);

    res.json({ 
      blockedStudents, 
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum 
    });
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

    const now = new Date();
    await Booking.updateMany(
      {
        studentUserId: student._id,
        startTime: { $gt: now },
        status: { $in: [BOOKING_STATUS.PENDING, BOOKING_STATUS.APPROVED, BOOKING_STATUS.AWAITING_CHECKIN] }
      },
      {
        $set: {
          status: BOOKING_STATUS.CANCELLED_BY_ADMIN,
          cancelledAt: now,
          cancellationReason: 'Auto-cancelled due to permanent block'
        }
      }
    );

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
