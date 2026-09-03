const express = require('express');
const router = express.Router();
const authAdmin = require('../middleware/authAdmin');
const { getAnalytics } = require('../services/analytics.service');

/**
 * GET /api/admin/analytics
 * Get analytics data with date range filters.
 * Query params: startDate, endDate, period (daily|weekly|monthly)
 */
router.get('/', authAdmin, async (req, res, next) => {
  try {
    let { startDate, endDate, period } = req.query;

    const now = new Date();

    // Default to "today" as per user preference
    if (!startDate || !endDate) {
      if (period === 'weekly') {
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        endDate = now.toISOString();
      } else if (period === 'monthly') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        endDate = now.toISOString();
      } else {
        // Default: today
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        endDate = now.toISOString();
      }
    }

    const analytics = await getAnalytics(startDate, endDate);
    res.json(analytics);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/analytics/bookings
 * Get detailed bookings for a specific status.
 * Query params: startDate, endDate, period (daily|weekly|monthly), status
 */
router.get('/bookings', authAdmin, async (req, res, next) => {
  try {
    let { startDate, endDate, period, status } = req.query;
    const now = new Date();

    if (!startDate || !endDate) {
      if (period === 'weekly') {
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        endDate = now.toISOString();
      } else if (period === 'monthly') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        endDate = now.toISOString();
      } else {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        endDate = now.toISOString();
      }
    }

    const { getAnalyticsBookings } = require('../services/analytics.service');
    const bookings = await getAnalyticsBookings(startDate, endDate, status);
    res.json(bookings);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
