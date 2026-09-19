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
    let { startDate, endDate, period, search } = req.query;

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

    const analytics = await getAnalytics(startDate, endDate, search);
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
    let { startDate, endDate, period, status, page, limit, search } = req.query;
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

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;

    const { getAnalyticsBookings } = require('../services/analytics.service');
    const result = await getAnalyticsBookings(startDate, endDate, status, pageNum, limitNum, search);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/analytics/download-csv
 * Download analytics bookings as a CSV file with selectable columns.
 * Body: { columns: [...], period, startDate, endDate, status, search }
 */
router.post('/download-csv', authAdmin, async (req, res, next) => {
  try {
    const { generateAnalyticsCSV } = require('../services/analytics.service');
    let { columns, period, startDate, endDate, statuses, search } = req.body;

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

    const csv = await generateAnalyticsCSV(startDate, endDate, columns, statuses, search);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="analytics_report_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
