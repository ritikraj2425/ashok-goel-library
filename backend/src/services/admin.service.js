const Admin = require('../models/Admin');
const { ADMIN_ROLES } = require('../utils/constants');

function createError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

/**
 * Create a new admin (root-only action).
 */
async function createAdmin(username, password, createdById) {
  const existing = await Admin.findOne({ username: username.toLowerCase() });
  if (existing) {
    throw createError('Admin with this username already exists', 409);
  }

  const admin = new Admin({
    username: username.toLowerCase(),
    passwordHash: password, // Will be hashed by pre-save hook
    role: ADMIN_ROLES.ADMIN,
    createdBy: createdById,
  });

  await admin.save();
  return admin.toPublic();
}

/**
 * Get all admins (root-only action).
 */
async function getAllAdmins(page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  const [admins, total] = await Promise.all([
    Admin.find()
      .select('-passwordHash')
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Admin.countDocuments()
  ]);
  return { admins, totalPages: Math.ceil(total / limit), currentPage: page };
}

/**
 * Update an admin (root-only action).
 */
async function updateAdmin(adminId, data, requestingAdminId) {
  const admin = await Admin.findById(adminId);
  if (!admin) throw createError('Admin not found', 404);

  // Cannot deactivate root
  if (admin.role === ADMIN_ROLES.ROOT && data.isActive === false) {
    throw createError('Cannot deactivate the root admin');
  }

  if (data.isActive !== undefined) {
    admin.isActive = data.isActive;
  }

  if (data.password) {
    admin.passwordHash = data.password; // Will be hashed by pre-save hook
  }

  await admin.save();
  return admin.toPublic();
}

/**
 * Delete an admin (root-only action).
 */
async function deleteAdmin(adminId) {
  const admin = await Admin.findById(adminId);
  if (!admin) throw createError('Admin not found', 404);

  if (admin.role === ADMIN_ROLES.ROOT) {
    throw createError('Cannot delete the root admin');
  }

  await Admin.findByIdAndDelete(adminId);
  return { deleted: true };
}

module.exports = {
  createAdmin,
  getAllAdmins,
  updateAdmin,
  deleteAdmin,
};
