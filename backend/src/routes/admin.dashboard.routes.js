const express = require('express');
const router = express.Router();
const authAdmin = require('../middleware/authAdmin');
const bookingService = require('../services/booking.service');

/**
 * GET /api/admin/dashboard
 * Get admin dashboard data: pending, booked, empty cabins.
 */
router.get('/', authAdmin, async (req, res, next) => {
  try {
    const dashboard = await bookingService.getAdminDashboard();
    res.json(dashboard);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
