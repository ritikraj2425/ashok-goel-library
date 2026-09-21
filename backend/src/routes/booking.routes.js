const express = require('express');
const router = express.Router();
const authStudent = require('../middleware/authStudent');
const validate = require('../middleware/validate');
const { bookingLimiter } = require('../middleware/rateLimiter');
const { createBookingSchema } = require('../validators/booking.validator');
const bookingService = require('../services/booking.service');

/**
 * POST /api/bookings/request
 * Create a new booking request.
 */
router.post(
  '/request',
  authStudent,
  bookingLimiter,
  validate(createBookingSchema),
  async (req, res, next) => {
    try {
      const booking = await bookingService.createBookingRequest(req.user._id, req.body);
      res.status(201).json({
        message: 'Booking request submitted successfully',
        booking,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/bookings/my-active
 * Get the current student's active booking (if any).
 */
router.get('/my-active', authStudent, async (req, res, next) => {
  try {
    const { bookings, slotsUsedToday } = await bookingService.getMyActiveBookings(req.user._id);
    res.json({ bookings, slotsUsedToday });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/bookings/my-history
 * Get the current student's booking history.
 */
router.get('/my-history', authStudent, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const result = await bookingService.getMyBookingHistory(req.user._id, page, limit);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/bookings/:id/cancel-pending
 * Cancel a pending booking (student can only cancel their own).
 */
router.post('/:id/cancel-pending', authStudent, async (req, res, next) => {
  try {
    const booking = await bookingService.cancelPendingByStudent(req.params.id, req.user._id);
    res.json({ message: 'Booking request cancelled', booking });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/bookings/:id/cancel-approved
 * Cancel an approved booking directly (student)
 */
router.post('/:id/cancel-approved', authStudent, async (req, res, next) => {
  try {
    const { cancelApprovedByStudent } = require('../services/booking.service');
    const booking = await cancelApprovedByStudent(req.params.id, req.user._id);
    res.json({ message: 'Booking cancelled', booking });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
