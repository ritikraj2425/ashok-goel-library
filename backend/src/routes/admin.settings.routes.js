const express = require('express');
const router = express.Router();
const authAdmin = require('../middleware/authAdmin');
const SystemSettings = require('../models/SystemSettings');

router.use(authAdmin);

/**
 * GET /api/admin/settings
 * Get global system settings.
 */
router.get('/', async (req, res, next) => {
  try {
    const settings = await SystemSettings.getSettings();
    res.json({ settings });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/admin/settings/schedule
 * Update the weekly schedule for one or more days.
 * Body: { weeklySchedule: { monday: { startTime, endTime, slotDuration, isClosed }, ... } }
 */
router.put('/schedule', async (req, res, next) => {
  try {
    const { weeklySchedule } = req.body;
    if (!weeklySchedule || typeof weeklySchedule !== 'object') {
      const err = new Error('weeklySchedule object is required');
      err.statusCode = 400;
      throw err;
    }

    const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const timeRegex = /^\d{2}:\d{2}$/;

    for (const [day, config] of Object.entries(weeklySchedule)) {
      if (!validDays.includes(day)) {
        const err = new Error(`Invalid day: ${day}`);
        err.statusCode = 400;
        throw err;
      }
      if (!config.isClosed) {
        if (!timeRegex.test(config.startTime) || !timeRegex.test(config.endTime)) {
          const err = new Error(`${day}: startTime and endTime must be in HH:mm format`);
          err.statusCode = 400;
          throw err;
        }
        if (config.endTime <= config.startTime) {
          const err = new Error(`${day}: endTime must be after startTime (cross-midnight schedules are not allowed)`);
          err.statusCode = 400;
          throw err;
        }
        if (config.slotDuration < 15 || config.slotDuration > 240) {
          const err = new Error(`${day}: slotDuration must be between 15 and 240 minutes`);
          err.statusCode = 400;
          throw err;
        }
      }
    }

    let settings = await SystemSettings.findOne({ key: 'global' });
    if (!settings) {
      settings = new SystemSettings({ key: 'global' });
    }

    for (const [day, config] of Object.entries(weeklySchedule)) {
      settings.weeklySchedule[day] = config;
    }

    await settings.save();
    res.json({ settings: settings.toObject() });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/settings/exceptions
 * Add a temporary date exception.
 * Body: { date, startTime, endTime, slotDuration, isClosed, label }
 */
router.post('/exceptions', async (req, res, next) => {
  try {
    const { date, startTime, endTime, slotDuration, isClosed, label } = req.body;

    if (!date) {
      const err = new Error('date is required (YYYY-MM-DD)');
      err.statusCode = 400;
      throw err;
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      const err = new Error('date must be in YYYY-MM-DD format');
      err.statusCode = 400;
      throw err;
    }

    if (!isClosed) {
      const timeRegex = /^\d{2}:\d{2}$/;
      if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
        const err = new Error('startTime and endTime must be in HH:mm format');
        err.statusCode = 400;
        throw err;
      }
      if (endTime <= startTime) {
        const err = new Error('endTime must be after startTime (cross-midnight schedules are not allowed)');
        err.statusCode = 400;
        throw err;
      }
      if (slotDuration < 15 || slotDuration > 240) {
        const err = new Error('slotDuration must be between 15 and 240 minutes');
        err.statusCode = 400;
        throw err;
      }
    }

    let settings = await SystemSettings.findOne({ key: 'global' });
    if (!settings) {
      settings = new SystemSettings({ key: 'global' });
    }

    // Remove any existing exception for the same date
    settings.exceptions = settings.exceptions.filter(e => e.date !== date);

    settings.exceptions.push({
      date,
      startTime: startTime || '09:30',
      endTime: endTime || '21:30',
      slotDuration: slotDuration || 60,
      isClosed: !!isClosed,
      label: label || '',
    });

    await settings.save();
    res.json({ settings: settings.toObject() });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/admin/settings/exceptions/:id
 * Remove a temporary date exception.
 */
router.delete('/exceptions/:id', async (req, res, next) => {
  try {
    let settings = await SystemSettings.findOne({ key: 'global' });
    if (!settings) {
      const err = new Error('Settings not found');
      err.statusCode = 404;
      throw err;
    }

    settings.exceptions = settings.exceptions.filter(
      e => e._id.toString() !== req.params.id
    );

    await settings.save();
    res.json({ settings: settings.toObject() });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
