const express = require('express');
const router = express.Router();
const authStudent = require('../middleware/authStudent');
const { getCabinStatusForStudents } = require('../services/cabin.service');

/**
 * GET /api/cabins/status
 * Get all cabins with their current booking status (student view).
 */
router.get('/status', authStudent, async (req, res, next) => {
  try {
    const result = await getCabinStatusForStudents();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
