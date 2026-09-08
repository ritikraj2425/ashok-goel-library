const Booking = require('../models/Booking');
const User = require('../models/User');
const { BOOKING_STATUS, TIMING } = require('../utils/constants');

/**
 * Clean up and transition bookings through their lifecycle.
 *
 * Jobs:
 * 1. PENDING → AUTO_REJECTED (15m approval timeout)
 * 2. APPROVED/CANCEL_REQUESTED → AWAITING_CHECKIN (slot time started, set 10m check-in deadline)
 * 3. AWAITING_CHECKIN → NO_SHOW + block student (10m check-in timeout)
 * 4. CHECKED_IN → COMPLETED (slot time ended)
 *
 * Called lazily before reads/writes and on a 60s setInterval.
 */
async function runCleanup() {
  const now = new Date();

  try {
    // --- Job 1: Auto-reject expired pending requests ---
    const autoRejected = await Booking.updateMany(
      {
        status: BOOKING_STATUS.PENDING,
        approvalDeadlineAt: { $lt: now },
      },
      {
        $set: {
          status: BOOKING_STATUS.AUTO_REJECTED,
          rejectedAt: now,
        },
      }
    );

    // --- Job 2: Transition to AWAITING_CHECKIN when slot starts ---
    const awaitingCheckin = await Booking.updateMany(
      {
        status: BOOKING_STATUS.APPROVED,
        startTime: { $lte: now },
      },
      {
        $set: {
          status: BOOKING_STATUS.AWAITING_CHECKIN,
        },
      }
    );

    // --- Job 3: No-show — check-in deadline passed ---
    // If an AWAITING_CHECKIN booking passes its checkInDeadlineAt, it's a no-show.
    const noShowBookings = await Booking.find({
      status: BOOKING_STATUS.AWAITING_CHECKIN,
      checkInDeadlineAt: { $lt: now },
    }).select('_id studentUserId');

    if (noShowBookings.length > 0) {
      const bookingIds = noShowBookings.map(b => b._id);
      const studentIds = [...new Set(noShowBookings.map(b => b.studentUserId.toString()))];

      // Mark bookings as NO_SHOW
      await Booking.updateMany(
        { _id: { $in: bookingIds } },
        {
          $set: {
            status: BOOKING_STATUS.NO_SHOW,
            noShowAt: now,
          },
        }
      );

      // Block students for 2 days
      const blockUntil = new Date(now.getTime() + TIMING.BLOCK_DURATION_MS);
      await User.updateMany(
        { _id: { $in: studentIds } },
        {
          $set: { blockedUntil: blockUntil },
        }
      );

      // Auto-cancel all future active bookings for blocked students
      await Booking.updateMany(
        {
          studentUserId: { $in: studentIds },
          startTime: { $gt: now },
          status: { $in: [BOOKING_STATUS.PENDING, BOOKING_STATUS.APPROVED, BOOKING_STATUS.AWAITING_CHECKIN] }
        },
        {
          $set: {
            status: BOOKING_STATUS.CANCELLED_BY_ADMIN,
            cancelledAt: now,
            cancellationReason: 'Auto-cancelled due to temporary block (missed check-in)'
          }
        }
      );

      console.log(
        `Cleanup: ${noShowBookings.length} no-show(s), ${studentIds.length} student(s) blocked until ${blockUntil.toISOString()}`
      );
    }

    // --- Job 4: Complete checked-in bookings when slot ends ---
    const completed = await Booking.updateMany(
      {
        status: BOOKING_STATUS.CHECKED_IN,
        endTime: { $lt: now },
      },
      {
        $set: {
          status: BOOKING_STATUS.COMPLETED,
          completedAt: now,
        },
      }
    );

    const totalTransitions =
      autoRejected.modifiedCount +
      awaitingCheckin.modifiedCount +
      noShowBookings.length +
      completed.modifiedCount;

    if (totalTransitions > 0) {
      console.log(
        `Cleanup: ${autoRejected.modifiedCount} auto-rejected, ` +
        `${awaitingCheckin.modifiedCount} → awaiting check-in, ` +
        `${noShowBookings.length} no-show, ` +
        `${completed.modifiedCount} completed`
      );
    }
  } catch (error) {
    console.error('Cleanup error:', error.message);
  }
}

/**
 * Start the periodic cleanup interval.
 * Returns the interval ID for cleanup on shutdown.
 */
function startCleanupInterval(intervalMs = 60000) {
  const intervalId = setInterval(runCleanup, intervalMs);
  console.log(`Cleanup interval started (every ${intervalMs / 1000}s)`);
  return intervalId;
}

module.exports = { runCleanup, startCleanupInterval };
