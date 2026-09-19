const express = require('express');
const router = express.Router();
const authAdmin = require('../middleware/authAdmin');
const validate = require('../middleware/validate');
const { adminBookingActionSchema } = require('../validators/admin.validator');
const bookingService = require('../services/booking.service');
const { logAction } = require('../services/audit.service');
const { AUDIT_ACTIONS } = require('../utils/constants');

/**
 * POST /api/admin/bookings/admin-book
 * Create a booking requested by an admin on their own behalf.
 */
router.post('/admin-book', authAdmin, async (req, res, next) => {
  try {
    const booking = await bookingService.createAdminBooking(req.admin._id, req.admin.username, req.body);
    
    await logAction({
      action: AUDIT_ACTIONS.BOOKING_APPROVED,
      performedBy: req.admin._id,
      targetType: 'Booking',
      targetId: booking._id,
      details: { message: 'Admin self-booked cabin', cabinId: booking.cabinId },
    });
    
    res.json({ message: 'Booking created successfully', booking });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/bookings/:id
 * Get booking details.
 */
router.get('/:id', authAdmin, async (req, res, next) => {
  try {
    const booking = await bookingService.getBookingById(req.params.id);
    res.json({ booking });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/bookings/:id/approve
 * Approve a pending booking request.
 */
router.post('/:id/approve', authAdmin, async (req, res, next) => {
  try {
    const booking = await bookingService.approveBooking(req.params.id, req.admin._id);

    await logAction({
      action: AUDIT_ACTIONS.BOOKING_APPROVED,
      performedBy: req.admin._id,
      targetType: 'Booking',
      targetId: booking._id,
      details: { cabinId: booking.cabinId },
    });

    res.json({ message: 'Booking approved', booking });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/bookings/:id/reject
 * Reject a pending booking request.
 */
router.post(
  '/:id/reject',
  authAdmin,
  validate(adminBookingActionSchema),
  async (req, res, next) => {
    try {
      const booking = await bookingService.rejectBooking(
        req.params.id,
        req.admin._id,
        req.body.reason
      );

      await logAction({
        action: AUDIT_ACTIONS.BOOKING_REJECTED,
        performedBy: req.admin._id,
        targetType: 'Booking',
        targetId: booking._id,
        details: { reason: req.body.reason },
      });

      res.json({ message: 'Booking rejected', booking });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/admin/bookings/:id/cancel
 * Cancel a pending or approved booking.
 */
router.post(
  '/:id/cancel',
  authAdmin,
  validate(adminBookingActionSchema),
  async (req, res, next) => {
    try {
      const booking = await bookingService.cancelBookingByAdmin(
        req.params.id,
        req.admin._id,
        req.body.reason
      );

      await logAction({
        action: AUDIT_ACTIONS.BOOKING_CANCELLED,
        performedBy: req.admin._id,
        targetType: 'Booking',
        targetId: booking._id,
        details: { reason: req.body.reason },
      });

      res.json({ message: 'Booking cancelled', booking });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/admin/bookings/:id/approve-cancel
 * Approve a cancellation request
 */
router.post('/:id/approve-cancel', authAdmin, async (req, res, next) => {
  try {
    const { approveCancellation } = require('../services/booking.service');
    const booking = await approveCancellation(req.params.id, req.admin._id);
    res.json({ message: 'Cancellation approved', booking });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/bookings/:id/check-in
 * Check in a student for their booking (admin action).
 */
router.post('/:id/check-in', authAdmin, async (req, res, next) => {
  try {
    const { checkInBooking } = require('../services/booking.service');
    const booking = await checkInBooking(req.params.id, req.admin._id);
    res.json({ message: 'Student checked in successfully', booking });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
