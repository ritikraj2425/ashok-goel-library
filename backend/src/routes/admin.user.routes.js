const express = require('express');
const router = express.Router();
const authAdmin = require('../middleware/authAdmin');
const requireRoot = require('../middleware/requireRoot');
const validate = require('../middleware/validate');
const { createAdminSchema, updateAdminSchema } = require('../validators/admin.validator');
const adminService = require('../services/admin.service');
const { logAction } = require('../services/audit.service');
const { AUDIT_ACTIONS } = require('../utils/constants');

// All routes require root admin
router.use(authAdmin, requireRoot);

/**
 * GET /api/admin/users
 * Get all admins.
 */
router.get('/', async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    
    const result = await adminService.getAllAdmins(pageNum, limitNum);
    res.json(result); // result already contains admins, totalPages, currentPage
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/users
 * Create a new admin.
 */
router.post('/', validate(createAdminSchema), async (req, res, next) => {
  try {
    const admin = await adminService.createAdmin(req.body.username, req.body.password, req.admin._id);

    await logAction({
      action: AUDIT_ACTIONS.ADMIN_CREATED,
      performedBy: req.admin._id,
      targetType: 'Admin',
      targetId: admin.id,
      details: { username: admin.username },
    });

    res.status(201).json({ message: 'Admin created', admin });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/admin/users/:id
 * Update an admin (activate/deactivate, reset password).
 */
router.patch('/:id', validate(updateAdminSchema), async (req, res, next) => {
  try {
    const admin = await adminService.updateAdmin(req.params.id, req.body, req.admin._id);

    const action = req.body.password ? AUDIT_ACTIONS.ADMIN_PASSWORD_RESET : AUDIT_ACTIONS.ADMIN_UPDATED;
    await logAction({
      action,
      performedBy: req.admin._id,
      targetType: 'Admin',
      targetId: admin.id,
      details: { isActive: admin.isActive },
    });

    res.json({ message: 'Admin updated', admin });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/admin/users/:id
 * Delete an admin (cannot delete root).
 */
router.delete('/:id', async (req, res, next) => {
  try {
    await adminService.deleteAdmin(req.params.id);

    await logAction({
      action: AUDIT_ACTIONS.ADMIN_DELETED,
      performedBy: req.admin._id,
      targetType: 'Admin',
      targetId: req.params.id,
    });

    res.json({ message: 'Admin deleted' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
