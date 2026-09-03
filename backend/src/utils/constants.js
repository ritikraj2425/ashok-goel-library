/**
 * Application constants — booking statuses, timing, and config.
 */

const BOOKING_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  CANCEL_REQUESTED: 'cancel_requested',
  AWAITING_CHECKIN: 'awaiting_checkin',
  CHECKED_IN: 'checked_in',
  REJECTED: 'rejected',
  AUTO_REJECTED: 'auto_rejected',
  CANCELLED_BY_STUDENT: 'cancelled_by_student',
  CANCELLED_BY_ADMIN: 'cancelled_by_admin',
  COMPLETED: 'completed',
  NO_SHOW: 'no_show',
};

// Statuses that occupy a cabin slot (block new bookings for same slot)
const ACTIVE_STATUSES = [
  BOOKING_STATUS.PENDING,
  BOOKING_STATUS.APPROVED,
  BOOKING_STATUS.CANCEL_REQUESTED,
  BOOKING_STATUS.AWAITING_CHECKIN,
  BOOKING_STATUS.CHECKED_IN,
];

const ADMIN_ROLES = {
  ROOT: 'root',
  ADMIN: 'admin',
};

// Timing constants (in milliseconds)
const TIMING = {
  PENDING_TIMEOUT_MS: 15 * 60 * 1000,       // 15 minutes for admin approval
  CHECKIN_TIMEOUT_MS: 10 * 60 * 1000,        // 10 minutes for admin check-in
  BLOCK_DURATION_MS: 2 * 24 * 60 * 60 * 1000, // 2 days block for no-show
  CLEANUP_INTERVAL_MS: 60 * 1000,            // 1 minute
  STUDENT_POLL_INTERVAL_MS: 20 * 1000,       // 20 seconds
  ADMIN_POLL_INTERVAL_MS: 10 * 1000,         // 10 seconds
};

// Default cabin configurations
const DEFAULT_CABINS = [
  { code: 'P1', name: 'Cabin P1', minPeople: 2, maxPeople: 6 },
  { code: 'P2', name: 'Cabin P2', minPeople: 2, maxPeople: 6 },
  { code: 'P3', name: 'Cabin P3', minPeople: 4, maxPeople: 10 },
  { code: 'P4', name: 'Cabin P4', minPeople: 2, maxPeople: 4 },
  { code: 'P5', name: 'Cabin P5', minPeople: 2, maxPeople: 4 },
];

// Audit log actions
const AUDIT_ACTIONS = {
  BOOKING_APPROVED: 'BOOKING_APPROVED',
  BOOKING_REJECTED: 'BOOKING_REJECTED',
  BOOKING_CANCELLED: 'BOOKING_CANCELLED',
  BOOKING_CHECKED_IN: 'BOOKING_CHECKED_IN',
  BOOKING_NO_SHOW: 'BOOKING_NO_SHOW',
  CABIN_CREATED: 'CABIN_CREATED',
  CABIN_UPDATED: 'CABIN_UPDATED',
  ADMIN_CREATED: 'ADMIN_CREATED',
  ADMIN_UPDATED: 'ADMIN_UPDATED',
  ADMIN_DELETED: 'ADMIN_DELETED',
  ADMIN_PASSWORD_RESET: 'ADMIN_PASSWORD_RESET',
};

module.exports = {
  BOOKING_STATUS,
  ACTIVE_STATUSES,
  ADMIN_ROLES,
  TIMING,
  DEFAULT_CABINS,
  AUDIT_ACTIONS,
};
