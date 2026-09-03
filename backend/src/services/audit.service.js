const AuditLog = require('../models/AuditLog');

/**
 * Log an admin action for audit trail.
 */
async function logAction({ action, performedBy, targetType, targetId, details = {} }) {
  try {
    await AuditLog.create({
      action,
      performedBy,
      targetType,
      targetId,
      details,
      timestamp: new Date(),
    });
  } catch (error) {
    // Audit logging should never break the main flow
    console.error('Audit log error:', error.message);
  }
}

module.exports = { logAction };
