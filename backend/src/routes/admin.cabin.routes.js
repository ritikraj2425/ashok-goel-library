const express = require('express');
const router = express.Router();
const authAdmin = require('../middleware/authAdmin');
const requireRoot = require('../middleware/requireRoot');
const validate = require('../middleware/validate');
const { createCabinSchema, updateCabinSchema } = require('../validators/cabin.validator');
const cabinService = require('../services/cabin.service');
const { logAction } = require('../services/audit.service');
const { AUDIT_ACTIONS } = require('../utils/constants');

/**
 * GET /api/admin/cabins
 * Get all cabins (admin view).
 */
router.get('/', authAdmin, async (req, res, next) => {
  try {
    const cabins = await cabinService.getAllCabins();
    res.json({ cabins });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/cabins/status
 * Get cabin status with slots for admin booking interface.
 */
router.get('/status', authAdmin, async (req, res, next) => {
  try {
    const result = await cabinService.getCabinStatusForStudents();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/cabins
 * Create a new cabin (root only).
 */
router.post(
  '/',
  authAdmin,
  requireRoot,
  validate(createCabinSchema),
  async (req, res, next) => {
    try {
      const cabin = await cabinService.createCabin(req.body);

      await logAction({
        action: AUDIT_ACTIONS.CABIN_CREATED,
        performedBy: req.admin._id,
        targetType: 'Cabin',
        targetId: cabin._id,
        details: { code: cabin.code },
      });

      res.status(201).json({ message: 'Cabin created', cabin });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/admin/cabins/:id
 * Update a cabin.
 */
router.patch(
  '/:id',
  authAdmin,
  validate(updateCabinSchema),
  async (req, res, next) => {
    try {
      const cabin = await cabinService.updateCabin(req.params.id, req.body);

      await logAction({
        action: AUDIT_ACTIONS.CABIN_UPDATED,
        performedBy: req.admin._id,
        targetType: 'Cabin',
        targetId: cabin._id,
        details: req.body,
      });

      res.json({ message: 'Cabin updated', cabin });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/admin/cabins/:id
 * Delete a cabin (root only).
 */
router.delete(
  '/:id',
  authAdmin,
  requireRoot,
  async (req, res, next) => {
    try {
      const cabin = await cabinService.deleteCabin(req.params.id);

      await logAction({
        action: 'CABIN_DELETED',
        performedBy: req.admin._id,
        targetType: 'Cabin',
        targetId: cabin._id,
        details: { code: cabin.code },
      });

      res.json({ message: 'Cabin deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
