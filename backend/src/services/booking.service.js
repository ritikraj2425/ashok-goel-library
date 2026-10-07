const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Cabin = require('../models/Cabin');
const User = require('../models/User');
const { BOOKING_STATUS, ACTIVE_STATUSES, TIMING } = require('../utils/constants');
const { normalizeEnrollment, normalizePhone, normalizeName } = require('../utils/normalize');
const { runCleanup } = require('./cleanup.service');
const { getFutureSlotsForToday, getSlotDetails, getTodaySchedule, getAbsoluteTimeForIST } = require('../utils/date.utils');

/**
 * Helper: Create an error with a status code.
 */
function createError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

// --- Slot-level mutex to prevent race conditions ---
const slotLocks = new Map();

function getSlotLockKey(cabinId, dateString, slotId) {
  return `${cabinId}:${dateString}:${slotId}`;
}

async function acquireSlotLock(keys) {
  // Wait until all keys are free, then lock them
  const maxWait = 5000; // 5s max wait
  const start = Date.now();
  while (true) {
    const allFree = keys.every(k => !slotLocks.has(k));
    if (allFree) {
      keys.forEach(k => slotLocks.set(k, Date.now()));
      return;
    }
    if (Date.now() - start > maxWait) {
      throw createError('This slot is currently being booked by another user. Please try again.');
    }
    await new Promise(r => setTimeout(r, 50));
  }
}

function releaseSlotLock(keys) {
  keys.forEach(k => slotLocks.delete(k));
}

/**
 * Create a new booking request.
 * Enforces ALL booking rules atomically.
 * Supports slotCount=1 (single) or slotCount=2 (two consecutive slots).
 *
 * New flow for students with peopleCount > 1:
 * - Creates booking in PENDING_MEMBERS status with a joinToken.
 * - Other members join via QR/link within 10 minutes.
 * - Once all members join, booking auto-approves.
 */
async function createBookingRequest(userId, body) {
  // Run cleanup first to clear expired bookings
  await runCleanup();

  const { cabinId, timeSlotId, timeSlotIds, slotCount = 1, userType = 'student', mainStudent, groupMembers = [], peopleCount } = body;

  const user = await User.findById(userId);
  if (!user) throw createError('User not found');

  if (user.isBlocked) {
    throw createError('Your account is permanently blocked. Contact administration.', 403);
  }

  if (user.blockedUntil && user.blockedUntil > new Date()) {
    throw createError(`Your account is temporarily blocked until ${user.blockedUntil.toLocaleString()} due to a missed check-in.`, 403);
  }

  // --- Validate cabin ---
  const cabin = await Cabin.findById(cabinId);
  if (!cabin) throw createError('Cabin not found', 404);
  if (!cabin.isActive) throw createError('This cabin is currently inactive and cannot be booked');

  // --- Validate people count ---
  if (peopleCount > cabin.maxPeople) {
    throw createError(`People count cannot exceed maximum of ${cabin.maxPeople} for this cabin`);
  }
  if (userType === 'student' && peopleCount < cabin.minPeople) {
    throw createError(`People count must be at least ${cabin.minPeople} for this cabin`);
  }

  // --- Daily booking unlock check (30 min before first slot) ---
  const schedule = await getTodaySchedule();
  if (schedule.isClosed) {
    throw createError('Bookings are closed for today.');
  }
  const [firstSlotH, firstSlotM] = schedule.startTime.split(':').map(Number);
  const firstSlotStart = getAbsoluteTimeForIST(firstSlotH, firstSlotM);
  const unlockTime = new Date(firstSlotStart.getTime() - 30 * 60 * 1000); // 30 min before
  const now = new Date();
  if (now < unlockTime) {
    const unlockTimeStr = unlockTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
    throw createError(`Bookings for today will open at ${unlockTimeStr}.`);
  }

  // --- Validate slot count ---
  if (slotCount < 1 || slotCount > 2) {
    throw createError('Slot count must be 1 or 2.');
  }

  // --- Resolve all slot IDs for this booking ---
  let resolvedSlotIds;
  if (slotCount === 2) {
    resolvedSlotIds = timeSlotIds && timeSlotIds.length === 2 ? timeSlotIds : null;
    if (!resolvedSlotIds) {
      throw createError('Two time slot IDs are required for a 2-slot booking.');
    }
  } else {
    resolvedSlotIds = [timeSlotId];
  }

  // --- Validate all slots exist and are future ---
  const validSlots = await getFutureSlotsForToday();
  const allSlotDetails = [];
  for (const sid of resolvedSlotIds) {
    const isValid = validSlots.slots.some(s => s.id === sid);
    if (!isValid) {
      throw createError(`Time slot ${sid} is invalid or has already passed for today.`);
    }
    const details = await getSlotDetails(sid);
    if (!details) {
      throw createError(`Could not resolve details for slot ${sid}.`);
    }
    allSlotDetails.push(details);
  }

  // --- For 2-slot bookings, verify they are consecutive ---
  if (slotCount === 2) {
    allSlotDetails.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    const firstSlotEnd = allSlotDetails[0].endTime.getTime();
    const secondSlotStart = allSlotDetails[1].startTime.getTime();
    if (firstSlotEnd !== secondSlotStart) {
      throw createError('The two selected slots must be consecutive (back-to-back).');
    }
    resolvedSlotIds = allSlotDetails.map(s => s.id);
  }

  const primarySlotDetails = allSlotDetails[0];
  const mergedEndTime = allSlotDetails[allSlotDetails.length - 1].endTime;

  // --- Normalize inputs ---
  const normalizedMain = {
    name: normalizeName(mainStudent.name),
    phoneNumber: normalizePhone(mainStudent.phoneNumber),
  };

  // For new flow (student, peopleCount > 1): no group members needed upfront
  // For legacy/faculty flow: group members provided inline
  const normalizedGroupMembers = (groupMembers || []).map((m) => ({
    name: normalizeName(m.name),
  }));

  // Only enforce group member count for faculty or when groupMembers are explicitly provided
  if (userType === 'faculty' && normalizedGroupMembers.length > 0) {
    if (1 + normalizedGroupMembers.length !== peopleCount) {
      throw createError(
        `Number of group members (${normalizedGroupMembers.length}) plus main student must equal people count (${peopleCount})`
      );
    }
  }


  // --- Rule 11: Max 2 SLOTS per day per enrollment or account (sum slotCount) ---
  const todaysBookings = await Booking.find({
    bookingDate: primarySlotDetails.dateString,
    $and: [
      {
        $or: [
          {
            status: {
              $in: [
                BOOKING_STATUS.PENDING,
                BOOKING_STATUS.PENDING_MEMBERS,
                BOOKING_STATUS.APPROVED,
                BOOKING_STATUS.CANCEL_REQUESTED,
                BOOKING_STATUS.AWAITING_CHECKIN,
                BOOKING_STATUS.CHECKED_IN,
                BOOKING_STATUS.COMPLETED,
                BOOKING_STATUS.EARLY_CHECKOUT,
              ],
            },
          }
        ]
      },
      {
        $or: [
          { studentUserId: userId },
          { 'joinedMembers.studentUserId': userId },
          { 'joinedMembers.studentUserId': userId },
        ]
      }
    ]
  }).select('studentUserId mainStudent groupMembers joinedMembers slotCount').lean();

  const enrollmentSlotCounts = {};
  let userSlotCount = 0;

  for (const b of todaysBookings) {
    const bSlotCount = b.slotCount || 1;
    if (b.studentUserId && b.studentUserId.toString() === userId.toString()) {
      userSlotCount += bSlotCount;
    }
    // Also count if user is a joined member in another booking
    if (b.joinedMembers) {
      for (const jm of b.joinedMembers) {
        if (jm.studentUserId && jm.studentUserId.toString() === userId.toString()) {
          userSlotCount += bSlotCount;
        }
      }
    }
  }

  if (userSlotCount + slotCount > 2) {
    throw createError(`Your account has already used ${userSlotCount} slot(s) for this day. You cannot book ${slotCount} more (max 2 slots per day).`);
  }


  // --- Acquire slot lock to prevent race conditions ---
  const lockKeys = allSlotDetails.map(s => getSlotLockKey(cabin._id.toString(), s.dateString, s.id));
  await acquireSlotLock(lockKeys);

  try {
    // --- Check all requested slots for conflicts ---
    for (const slotDetail of allSlotDetails) {
      // --- Rule 3: User cannot book overlapping slots ---
      const userOverlappingBooking = await Booking.findOne({
        studentUserId: userId,
        bookingDate: slotDetail.dateString,
        status: { $in: ACTIVE_STATUSES },
        $or: [
          { timeSlotId: slotDetail.id },
          { timeSlotIds: slotDetail.id },
        ],
      });
      if (userOverlappingBooking) {
        throw createError(`You already have an active booking or request for time slot ${slotDetail.id}`);
      }

      // --- Rule 2: Cabin can have only one active booking for THIS SLOT ---
      const existingCabinBooking = await Booking.findOne({
        cabinId: cabin._id,
        bookingDate: slotDetail.dateString,
        status: { $in: ACTIVE_STATUSES },
        $or: [
          { timeSlotId: slotDetail.id },
          { timeSlotIds: slotDetail.id },
        ],
      });
      if (existingCabinBooking) {
        throw createError(`This cabin is already booked or requested for time slot ${slotDetail.id}`);
      }



      // --- Rule 8: Phone number cannot be in another active booking for THIS SLOT ---
      const phoneConflict = await Booking.findOne({
        bookingDate: slotDetail.dateString,
        status: { $in: ACTIVE_STATUSES },
        $or: [
          { timeSlotId: slotDetail.id },
          { timeSlotIds: slotDetail.id },
        ],
        'mainStudent.phoneNumber': normalizedMain.phoneNumber,
      });
      if (phoneConflict) {
        throw createError(`Phone number is already used in an active booking for time slot ${slotDetail.id}`);
      }
    }

    // --- Create the booking ---
    const requestTime = new Date();

    // Determine initial status based on user type and people count
    const isGroupBooking = userType === 'student' && peopleCount > 1;
    const crypto = require('crypto');

    const bookingData = {
      cabinId: cabin._id,
      studentUserId: userId,
      userType,
      mainStudent: normalizedMain,
      groupMembers: normalizedGroupMembers,
      peopleCount,
      bookingDate: primarySlotDetails.dateString,
      timeSlotId: resolvedSlotIds[0],
      timeSlotIds: resolvedSlotIds,
      slotCount,
      startTime: primarySlotDetails.startTime,
      endTime: mergedEndTime,
      requestedAt: requestTime,
    };

    if (isGroupBooking) {
      // New flow: PENDING_MEMBERS with join token
      bookingData.status = BOOKING_STATUS.PENDING_MEMBERS;
      bookingData.joinToken = crypto.randomBytes(16).toString('hex');
      bookingData.joinExpiresAt = new Date(requestTime.getTime() + TIMING.JOIN_EXPIRY_MS);
      bookingData.joinedMembers = [];
      bookingData.groupMembers = []; // Clear legacy group members for new flow
    } else {
      // Solo booking or faculty: auto approve
      bookingData.status = BOOKING_STATUS.APPROVED;
      bookingData.approvedAt = requestTime;
      bookingData.expiresAt = mergedEndTime;
      bookingData.checkInDeadlineAt = new Date(
        Math.min(
          Math.max(now.getTime(), primarySlotDetails.startTime.getTime()) + TIMING.CHECKIN_TIMEOUT_MS,
          mergedEndTime.getTime()
        )
      );
    }

    let booking;
    try {
      booking = await Booking.create(bookingData);
    } catch (err) {
      if (err.code === 11000) {
        throw createError('This cabin slot was just booked by someone else. Please choose a different slot.');
      }
      throw err;
    }

    return booking;
  } finally {
    releaseSlotLock(lockKeys);
  }
}


/**
 * Get the active bookings for a student.
 */
async function getMyActiveBookings(userId) {
  await runCleanup();

  const bookings = await Booking.find({
    $or: [
      { studentUserId: userId },
      { 'joinedMembers.studentUserId': userId },
    ],
    status: { $in: ACTIVE_STATUSES },
  })
    .populate('cabinId', 'code name')
    .sort({ startTime: 1 })
    .lean();

  const today = new Date();
  const dateString = today.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const todaysBookings = await Booking.find({
    bookingDate: dateString,
    $or: [
      { studentUserId: userId },
      { 'joinedMembers.studentUserId': userId },
    ],
    status: {
      $in: [
        BOOKING_STATUS.PENDING,
        BOOKING_STATUS.PENDING_MEMBERS,
        BOOKING_STATUS.APPROVED,
        BOOKING_STATUS.CANCEL_REQUESTED,
        BOOKING_STATUS.AWAITING_CHECKIN,
        BOOKING_STATUS.CHECKED_IN,
        BOOKING_STATUS.COMPLETED,
        BOOKING_STATUS.EARLY_CHECKOUT,
      ],
    },
  }).select('slotCount').lean();

  const slotsUsedToday = todaysBookings.reduce((sum, b) => sum + (b.slotCount || 1), 0);

  return { bookings, slotsUsedToday };
}

/**
 * Get booking history for a student.
 */
async function getMyBookingHistory(userId, page = 1, limit = 20) {
  await runCleanup();

  const skip = (page - 1) * limit;

  const query = {
    $or: [
      { studentUserId: userId },
      { 'joinedMembers.studentUserId': userId },
    ]
  };

  const [bookings, total] = await Promise.all([
    Booking.find(query)
      .sort({ requestedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('cabinId', 'code name')
      .populate('studentUserId', 'name email')
      .lean(),
    Booking.countDocuments(query),
  ]);

  return { bookings, total, page, totalPages: Math.ceil(total / limit) };
}

/**
 * Cancel a pending booking by the student who created it.
 * Atomic: uses findOneAndUpdate with status check.
 */
async function cancelPendingByStudent(bookingId, userId) {
  await runCleanup();

  const now = new Date();

  // Atomic: only cancels if status is still 'pending' AND owned by this user
  const booking = await Booking.findOneAndUpdate(
    {
      _id: bookingId,
      studentUserId: userId,
      status: BOOKING_STATUS.PENDING,
    },
    {
      $set: {
        status: BOOKING_STATUS.CANCELLED_BY_STUDENT,
        cancelledAt: now,
      },
    },
    { new: true }
  );

  if (!booking) {
    // Determine specific error
    const existing = await Booking.findById(bookingId);
    if (!existing) throw createError('Booking not found', 404);
    if (existing.studentUserId.toString() !== userId.toString()) {
      throw createError('You can only cancel your own bookings', 403);
    }
    if (existing.status === BOOKING_STATUS.APPROVED) {
      throw createError('Approved bookings cannot be cancelled directly. Use "Request Cancellation" instead.');
    }
    if (existing.status === BOOKING_STATUS.CANCELLED_BY_STUDENT) {
      return existing; // Idempotent
    }
    throw createError(`Cannot cancel booking with status: ${existing.status}`);
  }

  return booking;
}

/**
 * Direct cancellation for an approved or awaiting-checkin booking (student action).
 * Only allowed before the time slot has ended.
 */
async function cancelApprovedByStudent(bookingId, userId) {
  await runCleanup();

  const now = new Date();

  const booking = await Booking.findOneAndUpdate(
    {
      _id: bookingId,
      studentUserId: userId,
      status: { $in: [BOOKING_STATUS.APPROVED, BOOKING_STATUS.AWAITING_CHECKIN] },
      startTime: { $gt: now }, // Can only cancel before time slot starts
    },
    {
      $set: {
        status: BOOKING_STATUS.CANCELLED_BY_STUDENT,
        cancelledAt: now,
      },
    },
    { new: true }
  );

  if (!booking) {
    const existing = await Booking.findById(bookingId);
    if (!existing) throw createError('Booking not found', 404);
    if (existing.studentUserId.toString() !== userId.toString()) {
      throw createError('You can only cancel your own bookings', 403);
    }
    if (existing.startTime <= now) {
      throw createError('You cannot cancel a booking after its time slot has started');
    }
    if (existing.status === BOOKING_STATUS.CANCELLED_BY_STUDENT) {
      return existing; // Idempotent
    }
    throw createError(`Cannot cancel booking with status: ${existing.status}`);
  }

  // Check for permanent block (3 or more approved cancellations in 7 days)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const pastBookings = await Booking.find({
    studentUserId: userId,
    approvedAt: { $exists: true, $ne: null }, // Only count cancellations of approved bookings
    cancelledAt: { $gte: sevenDaysAgo },
    status: { $in: [BOOKING_STATUS.CANCELLED_BY_STUDENT, BOOKING_STATUS.EARLY_CHECKOUT] }
  });

  let cancellationCount = 0;
  for (const b of pastBookings) {
    if (b.status === BOOKING_STATUS.CANCELLED_BY_STUDENT) {
      cancellationCount++;
    } else if (b.status === BOOKING_STATUS.EARLY_CHECKOUT && b.slotCount === 2 && b.timeSlotIds && b.timeSlotIds.length === 2) {
      const secondSlotStartStr = b.timeSlotIds[1].split('-')[0];
      const cancelledIST = new Date(b.cancelledAt).toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
      if (cancelledIST < secondSlotStartStr) {
        cancellationCount++;
      }
    }
  }

  if (cancellationCount >= 3) {
    await User.findByIdAndUpdate(userId, {
      $set: {
        isBlocked: true,
        blockedUntil: null, // Permanent block
      },
    });

    await Booking.updateMany(
      {
        studentUserId: userId,
        startTime: { $gt: now },
        status: { $in: [BOOKING_STATUS.PENDING, BOOKING_STATUS.APPROVED, BOOKING_STATUS.AWAITING_CHECKIN] }
      },
      {
        $set: {
          status: BOOKING_STATUS.CANCELLED_BY_ADMIN,
          cancelledAt: now,
          cancellationReason: 'Auto-cancelled due to permanent block (excessive cancellations)'
        }
      }
    );
  }

  return booking;
}

/**
 * Approve a cancellation request (admin action).
 * Works on CANCEL_REQUESTED and AWAITING_CHECKIN (if admin wants to approve cancel during check-in window).
 */
async function approveCancellation(bookingId, adminId) {
  await runCleanup();

  const now = new Date();

  const booking = await Booking.findOneAndUpdate(
    {
      _id: bookingId,
      status: BOOKING_STATUS.AWAITING_CHECKIN,
    },
    {
      $set: {
        status: BOOKING_STATUS.CANCELLED_BY_STUDENT,
        cancelledAt: now,
        cancelledBy: adminId,
      },
    },
    { new: true }
  );

  if (!booking) {
    throw createError('Booking not found or not in a cancellable state', 404);
  }

  return booking;
}

/**
 * Approve a pending booking (admin action).
 * Atomic: prevents double-approve and late approval.
 */
async function approveBooking(bookingId, adminId) {
  await runCleanup();

  const now = new Date();

  const existing = await Booking.findById(bookingId);
  if (!existing) throw createError('Booking not found', 404);

  // If the slot has already ended, auto-reject it instead of approving.
  if (now >= existing.endTime) {
    existing.status = BOOKING_STATUS.AUTO_REJECTED;
    existing.rejectedAt = now;
    existing.rejectionReason = 'Slot time has already ended before approval.';
    await existing.save();
    throw createError('Cannot approve booking: the time slot has already ended. Booking has been auto-rejected.');
  }

  // Calculate new check-in deadline to give them a fair 10 minutes from approval time
  const newCheckInDeadline = new Date(
    Math.min(
      Math.max(now.getTime(), existing.startTime.getTime()) + TIMING.CHECKIN_TIMEOUT_MS,
      existing.endTime.getTime()
    )
  );

  // Atomic update: only if pending AND deadline not passed
  const booking = await Booking.findOneAndUpdate(
    {
      _id: bookingId,
      status: BOOKING_STATUS.PENDING,
      approvalDeadlineAt: { $gt: now },
    },
    {
      $set: {
        status: BOOKING_STATUS.APPROVED,
        approvedAt: now,
        checkInDeadlineAt: newCheckInDeadline,
        expiresAt: existing.endTime, // Expires exactly when the slot ends
        approvedBy: adminId,
      },
    },
    { new: true }
  );

  if (!booking) {
    if (existing.status !== BOOKING_STATUS.PENDING) {
      throw createError(`Cannot approve booking with status: ${existing.status}`);
    }
    if (existing.approvalDeadlineAt <= now) {
      throw createError('Approval deadline has passed. The request has been auto-rejected.');
    }
    throw createError('Unable to approve booking');
  }

  // Belt-and-suspenders: verify no other active booking for this cabin+slot
  const conflictCount = await Booking.countDocuments({
    cabinId: booking.cabinId,
    bookingDate: booking.bookingDate,
    timeSlotId: booking.timeSlotId,
    status: { $in: [BOOKING_STATUS.APPROVED, BOOKING_STATUS.AWAITING_CHECKIN, BOOKING_STATUS.CHECKED_IN] },
    _id: { $ne: booking._id },
  });

  if (conflictCount > 0) {
    // Rollback: revert to pending (extremely rare edge case)
    await Booking.findByIdAndUpdate(booking._id, {
      $set: { status: BOOKING_STATUS.PENDING },
      $unset: { approvedAt: 1, expiresAt: 1, approvedBy: 1 },
    });
    throw createError('Another booking was approved for this cabin simultaneously. Please retry.');
  }

  return booking;
}

/**
 * Reject a pending booking (admin action).
 */
async function rejectBooking(bookingId, adminId, reason) {
  await runCleanup();

  const now = new Date();

  const booking = await Booking.findOneAndUpdate(
    {
      _id: bookingId,
      status: BOOKING_STATUS.PENDING,
    },
    {
      $set: {
        status: BOOKING_STATUS.REJECTED,
        rejectedAt: now,
        rejectedBy: adminId,
        ...(reason && { rejectionReason: reason }),
      },
    },
    { new: true }
  );

  if (!booking) {
    const existing = await Booking.findById(bookingId);
    if (!existing) throw createError('Booking not found', 404);
    throw createError(`Cannot reject booking with status: ${existing.status}`);
  }

  return booking;
}

/**
 * Check in a booking (admin action).
 * Only works on AWAITING_CHECKIN status.
 */
async function checkInBooking(bookingId, adminId) {
  await runCleanup();

  const now = new Date();

  const booking = await Booking.findOneAndUpdate(
    {
      _id: bookingId,
      status: BOOKING_STATUS.AWAITING_CHECKIN,
    },
    {
      $set: {
        status: BOOKING_STATUS.CHECKED_IN,
        checkedInAt: now,
        checkedInBy: adminId,
      },
    },
    { new: true }
  );

  if (!booking) {
    const existing = await Booking.findById(bookingId);
    if (!existing) throw createError('Booking not found', 404);
    throw createError(`Cannot check in booking with status: ${existing.status}`);
  }

  return booking;
}

/**
 * Cancel an active booking (admin action).
 * Works on any active status.
 */
async function cancelBookingByAdmin(bookingId, adminId, reason) {
  await runCleanup();

  const now = new Date();

  const bookingToCancel = await Booking.findOne({ _id: bookingId, status: { $in: ACTIVE_STATUSES } });
  if (!bookingToCancel) {
    const existing = await Booking.findById(bookingId);
    if (!existing) throw createError('Booking not found', 404);
    throw createError(`Cannot cancel booking with status: ${existing.status}`);
  }

  const newStatus = bookingToCancel.status === BOOKING_STATUS.CHECKED_IN
    ? BOOKING_STATUS.EARLY_CHECKOUT
    : BOOKING_STATUS.CANCELLED_BY_ADMIN;

  let secondSlotCancelledByStudent = false;
  if (newStatus === BOOKING_STATUS.EARLY_CHECKOUT && bookingToCancel.slotCount === 2 && bookingToCancel.timeSlotIds && bookingToCancel.timeSlotIds.length === 2) {
    const secondSlotStartStr = bookingToCancel.timeSlotIds[1].split('-')[0];
    const cancelledIST = now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
    if (cancelledIST < secondSlotStartStr) {
      secondSlotCancelledByStudent = true;
    }
  }

  const booking = await Booking.findOneAndUpdate(
    { _id: bookingId },
    {
      $set: {
        status: newStatus,
        cancelledAt: now,
        cancelledBy: adminId,
        ...(reason && { cancellationReason: reason }),
      },
    },
    { new: true }
  );

  if (secondSlotCancelledByStudent && booking.studentUserId) {
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const pastBookings = await Booking.find({
      studentUserId: booking.studentUserId,
      approvedAt: { $exists: true, $ne: null },
      cancelledAt: { $gte: sevenDaysAgo },
      status: { $in: [BOOKING_STATUS.CANCELLED_BY_STUDENT, BOOKING_STATUS.EARLY_CHECKOUT] }
    });

    let cancellationCount = 0;
    for (const b of pastBookings) {
      if (b.status === BOOKING_STATUS.CANCELLED_BY_STUDENT) {
        cancellationCount++;
      } else if (b.status === BOOKING_STATUS.EARLY_CHECKOUT && b.slotCount === 2 && b.timeSlotIds && b.timeSlotIds.length === 2) {
        const secondSlotStartStr = b.timeSlotIds[1].split('-')[0];
        const cancelledIST = new Date(b.cancelledAt).toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
        if (cancelledIST < secondSlotStartStr) {
          cancellationCount++;
        }
      }
    }

    if (cancellationCount >= 3) {
      await User.findByIdAndUpdate(booking.studentUserId, {
        $set: {
          isBlocked: true,
          blockedUntil: null,
        },
      });

      await Booking.updateMany(
        {
          studentUserId: booking.studentUserId,
          startTime: { $gt: now },
          status: { $in: [BOOKING_STATUS.PENDING, BOOKING_STATUS.APPROVED, BOOKING_STATUS.AWAITING_CHECKIN] }
        },
        {
          $set: {
            status: BOOKING_STATUS.CANCELLED_BY_ADMIN,
            cancelledAt: now,
            cancellationReason: 'Auto-cancelled due to permanent block (excessive cancellations)'
          }
        }
      );
    }
  }

  return booking;
}

/**
 * Get admin dashboard data with clear, non-overlapping sections.
 *
 * Sections:
 * 1. pendingRequests — status=pending (need approve/reject)
 * 2. checkInRequired — status=awaiting_checkin (need check-in within 10m)
 * 3. ongoingBookings — status=checked_in (currently in use)
 * 4. upcomingBookings — status=approved AND slot NOT started (confirmed, waiting for slot)
 * 5. cabinAvailability — ALL active cabins with their available slots for today
 */
async function getAdminDashboard() {
  await runCleanup();

  const now = new Date();

  const [
    pendingBookings,
    checkInRequired,
    ongoingBookings,
    upcomingBookings,
    allActiveTodayBookings,
    cabins,
  ] = await Promise.all([
    // 1. Pending approval (removed, now auto-approved)
    Promise.resolve([]),

    // 2. Awaiting check-in (slot started, need admin check-in)
    Booking.find({ status: BOOKING_STATUS.AWAITING_CHECKIN })
      .populate('cabinId', 'code name')
      .populate('studentUserId', 'email name')
      .sort({ checkInDeadlineAt: 1 })
      .lean(),

    // 3. Ongoing (checked in)
    Booking.find({ status: BOOKING_STATUS.CHECKED_IN })
      .populate('cabinId', 'code name')
      .populate('studentUserId', 'email name')
      .populate('checkedInBy', 'username')
      .sort({ checkedInAt: 1 })
      .lean(),

    // 4. Upcoming approved (slot not started yet)
    Booking.find({
      status: BOOKING_STATUS.APPROVED,
      startTime: { $gt: now },
    })
      .populate('cabinId', 'code name')
      .populate('studentUserId', 'email name')
      .sort({ startTime: 1 })
      .lean(),

    // For cabin availability: all active bookings for today
    Booking.find({
      bookingDate: now.toISOString().split('T')[0],
      status: { $in: ACTIVE_STATUSES },
    })
      .select('cabinId timeSlotId timeSlotIds')
      .lean(),

    // All cabins
    Cabin.find({ isActive: true }).sort({ code: 1 }).lean(),
  ]);

  // Build per-cabin occupied slots set
  const cabinOccupiedSlots = {};
  for (const b of allActiveTodayBookings) {
    const cabinIdStr = b.cabinId.toString();
    if (!cabinOccupiedSlots[cabinIdStr]) cabinOccupiedSlots[cabinIdStr] = new Set();
    const slots = (b.timeSlotIds && b.timeSlotIds.length > 0) ? b.timeSlotIds : [b.timeSlotId];
    for (const slot of slots) {
      cabinOccupiedSlots[cabinIdStr].add(slot);
    }
  }

  // Get future slots for today
  const futureSlotsData = await getFutureSlotsForToday();
  const futureSlots = futureSlotsData.slots;

  // Build cabin availability: each active cabin with its available (unbooked) future slots
  const cabinAvailability = cabins.map((cabin) => {
    const occupied = cabinOccupiedSlots[cabin._id.toString()] || new Set();
    const availableSlots = futureSlots.filter((s) => !occupied.has(s.id));
    return {
      ...cabin,
      availableSlots,
      totalFutureSlots: futureSlots.length,
    };
  });

  return {
    pendingRequests: pendingBookings,
    checkInRequired,
    ongoingBookings,
    upcomingBookings,
    cabinAvailability,
  };
}

/**
 * Get booking details by ID (admin view).
 */
async function getBookingById(bookingId) {
  const booking = await Booking.findById(bookingId)
    .populate('cabinId', 'code name')
    .populate('studentUserId', 'email name')
    .populate('approvedBy', 'username')
    .populate('rejectedBy', 'username')
    .populate('cancelledBy', 'username')
    .populate('checkedInBy', 'username')
    .lean();

  if (!booking) {
    throw createError('Booking not found', 404);
  }

  return booking;
}

/**
 * Join a group booking via invite token.
 * Atomically adds the joining user to the booking's joinedMembers array.
 * If the group is now full, auto-approves the booking.
 */
async function joinGroupBooking(token, userId) {
  await runCleanup();

  const user = await User.findById(userId);
  if (!user) throw createError('User not found', 404);

  if (user.isBlocked) {
    throw createError('Your account is permanently blocked. You cannot join group bookings.', 403);
  }

  if (user.blockedUntil && user.blockedUntil > new Date()) {
    throw createError(`Your account is temporarily blocked until ${user.blockedUntil.toLocaleString()}.`, 403);
  }

  // Look up the booking by token
  const booking = await Booking.findOne({
    joinToken: token,
    status: BOOKING_STATUS.PENDING_MEMBERS,
  }).populate('cabinId', 'code name').lean();

  if (!booking) {
    // Check if this was a valid token that was already used up
    const expiredBooking = await Booking.findOne({ joinToken: token });
    if (expiredBooking) {
      if (expiredBooking.status === BOOKING_STATUS.APPROVED) {
        throw createError('This booking group is already full and has been confirmed.', 410);
      }
      throw createError('This invite link has expired.', 410);
    }
    // Also check if the token was cleared (booking approved)
    const completedBooking = await Booking.findOne({
      joinedMembers: { $elemMatch: { studentUserId: userId } },
      status: { $in: [BOOKING_STATUS.APPROVED, BOOKING_STATUS.AWAITING_CHECKIN, BOOKING_STATUS.CHECKED_IN] }
    });
    if (completedBooking) {
      throw createError('This booking has already been confirmed.', 410);
    }
    throw createError('Invalid or expired invite link.', 404);
  }

  // Check if invite has expired
  if (booking.joinExpiresAt && new Date() > new Date(booking.joinExpiresAt)) {
    throw createError('This invite link has expired. The 10-minute window has passed.', 410);
  }

  // Host cannot join their own booking
  if (booking.studentUserId.toString() === userId.toString()) {
    throw createError('You cannot join your own booking. Share this link with your group members.', 400);
  }

  // Check if user is already in the group
  const alreadyJoined = booking.joinedMembers.some(
    m => m.studentUserId && m.studentUserId.toString() === userId.toString()
  );
  if (alreadyJoined) {
    throw createError('You have already joined this booking.', 400);
  }

  // Check remaining slot quota for the joining user
  const today = new Date();
  const dateString = today.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const joinerTodaysBookings = await Booking.find({
    bookingDate: dateString,
    $or: [
      { studentUserId: userId },
      { 'joinedMembers.studentUserId': userId },
    ],
    status: {
      $in: [
        BOOKING_STATUS.PENDING,
        BOOKING_STATUS.PENDING_MEMBERS,
        BOOKING_STATUS.APPROVED,
        BOOKING_STATUS.CANCEL_REQUESTED,
        BOOKING_STATUS.AWAITING_CHECKIN,
        BOOKING_STATUS.CHECKED_IN,
        BOOKING_STATUS.COMPLETED,
        BOOKING_STATUS.EARLY_CHECKOUT,
      ],
    },
  }).select('slotCount').lean();

  const joinerSlotsUsed = joinerTodaysBookings.reduce((sum, b) => sum + (b.slotCount || 1), 0);
  const bookingSlotCount = booking.slotCount || 1;

  if (joinerSlotsUsed + bookingSlotCount > 2) {
    throw createError(
      `You have already used ${joinerSlotsUsed} slot(s) today. This booking requires ${bookingSlotCount} slot(s), which exceeds your daily limit of 2.`,
      400
    );
  }

  // Check if user has a conflicting booking for the same time slots
  const bookingSlots = (booking.timeSlotIds && booking.timeSlotIds.length > 0) ? booking.timeSlotIds : [booking.timeSlotId];
  for (const slotId of bookingSlots) {
    const conflict = await Booking.findOne({
      bookingDate: booking.bookingDate,
      status: { $in: ACTIVE_STATUSES },
      $and: [
        {
          $or: [
            { studentUserId: userId },
            { 'joinedMembers.studentUserId': userId },
          ]
        },
        {
          $or: [
            { timeSlotId: slotId },
            { timeSlotIds: slotId },
          ]
        }
      ]
    });
    if (conflict) {
      throw createError(`You already have an active booking for time slot ${slotId}.`, 400);
    }
  }

  // Atomic update: push to joinedMembers only if capacity not exceeded
  const requiredMembers = booking.peopleCount - 1;
  const now = new Date();

  const updatedBooking = await Booking.findOneAndUpdate(
    {
      _id: booking._id,
      joinToken: token,
      status: BOOKING_STATUS.PENDING_MEMBERS,
      joinExpiresAt: { $gt: now },
      $expr: { $lt: [{ $size: { $ifNull: ['$joinedMembers', []] } }, requiredMembers] }
    },
    {
      $push: {
        joinedMembers: {
          studentUserId: userId,
          name: user.name,
          email: user.email,
          joinedAt: now,
        }
      }
    },
    { new: true }
  );

  if (!updatedBooking) {
    throw createError('Unable to join. The group may be full or the invite has expired.', 400);
  }

  // Check if group is now full -> auto-approve
  if (updatedBooking.joinedMembers.length >= requiredMembers) {
    const approvalTime = new Date();
    const checkInDeadline = new Date(
      Math.min(
        Math.max(approvalTime.getTime(), updatedBooking.startTime.getTime()) + TIMING.CHECKIN_TIMEOUT_MS,
        updatedBooking.endTime.getTime()
      )
    );

    await Booking.findByIdAndUpdate(updatedBooking._id, {
      $set: {
        status: BOOKING_STATUS.APPROVED,
        approvedAt: approvalTime,
        checkInDeadlineAt: checkInDeadline,
        expiresAt: updatedBooking.endTime,
      },
      $unset: {
        joinToken: 1,
        joinExpiresAt: 1,
      }
    });

    return {
      booking: { ...updatedBooking.toObject ? updatedBooking.toObject() : updatedBooking, status: BOOKING_STATUS.APPROVED },
      groupFull: true,
      message: 'You have joined the group! The booking has been automatically approved.',
    };
  }

  return {
    booking: updatedBooking,
    groupFull: false,
    message: `You have joined the group! Waiting for ${requiredMembers - updatedBooking.joinedMembers.length} more member(s).`,
  };
}

/**
 * Get the join status for a booking (used by host for polling).
 */
async function getJoinStatus(bookingId, userId) {
  await runCleanup();

  const booking = await Booking.findOne({
    _id: bookingId,
    $or: [
      { studentUserId: userId },
      { 'joinedMembers.studentUserId': userId },
    ]
  }).populate('cabinId', 'code name').lean();

  if (!booking) {
    throw createError('Booking not found', 404);
  }

  return {
    status: booking.status,
    joinedCount: (booking.joinedMembers || []).length,
    totalNeeded: booking.peopleCount - 1,
    joinedMembers: (booking.joinedMembers || []).map(m => ({ name: m.name, email: m.email, joinedAt: m.joinedAt })),
    joinToken: booking.joinToken,
    joinExpiresAt: booking.joinExpiresAt,
  };
}

/**
 * Get join info for a token (public view for the join page).
 */
async function getJoinInfo(token) {
  const booking = await Booking.findOne({ joinToken: token })
    .populate('cabinId', 'code name')
    .populate('studentUserId', 'name email')
    .lean();

  if (!booking) {
    throw createError('Invalid or expired invite link.', 404);
  }

  if (booking.status !== BOOKING_STATUS.PENDING_MEMBERS) {
    if (booking.status === BOOKING_STATUS.APPROVED) {
      throw createError('This booking group is already full and has been confirmed.', 410);
    }
    throw createError('This invite link is no longer valid.', 410);
  }

  if (booking.joinExpiresAt && new Date() > new Date(booking.joinExpiresAt)) {
    throw createError('This invite link has expired. The 10-minute window has passed.', 410);
  }

  const requiredMembers = booking.peopleCount - 1;
  const joinedCount = (booking.joinedMembers || []).length;

  return {
    hostName: booking.studentUserId?.name || booking.mainStudent?.name || 'Unknown',
    cabinName: booking.cabinId?.name || 'Unknown Cabin',
    cabinCode: booking.cabinId?.code || '',
    bookingDate: booking.bookingDate,
    timeSlotIds: booking.timeSlotIds,
    slotCount: booking.slotCount,
    peopleCount: booking.peopleCount,
    joinedCount,
    spotsRemaining: requiredMembers - joinedCount,
    joinExpiresAt: booking.joinExpiresAt,
  };
}

/**
 * Cancel a PENDING_MEMBERS booking by the host.
 * Does NOT count as a strike since it was never approved.
 */
async function cancelPendingMembers(bookingId, userId) {
  await runCleanup();

  const now = new Date();
  const booking = await Booking.findOneAndUpdate(
    {
      _id: bookingId,
      studentUserId: userId,
      status: BOOKING_STATUS.PENDING_MEMBERS,
    },
    {
      $set: {
        status: BOOKING_STATUS.CANCELLED_BY_STUDENT,
        cancelledAt: now,
      },
      $unset: {
        joinToken: 1,
        joinExpiresAt: 1,
      }
    },
    { new: true }
  );

  if (!booking) {
    const existing = await Booking.findById(bookingId);
    if (!existing) throw createError('Booking not found', 404);
    if (existing.studentUserId.toString() !== userId.toString()) {
      throw createError('You can only cancel your own bookings', 403);
    }
    throw createError(`Cannot cancel booking with status: ${existing.status}`);
  }

  return booking;
}

module.exports = {
  createBookingRequest,
  getMyActiveBookings,
  getMyBookingHistory,
  cancelPendingByStudent,
  cancelApprovedByStudent,
  approveCancellation,
  approveBooking,
  rejectBooking,
  checkInBooking,
  cancelBookingByAdmin,
  getAdminDashboard,
  getBookingById,
  createAdminBooking,
  joinGroupBooking,
  getJoinStatus,
  getJoinInfo,
  cancelPendingMembers,
};

/**
 * Create a booking requested by an admin.
 * Bypasses student rules and limits. Uses 'faculty' mode.
 */
async function createAdminBooking(adminId, adminUsername, body) {
  const { cabinId, timeSlotId } = body;

  const cabin = await Cabin.findById(cabinId);
  if (!cabin) throw createError('Cabin not found', 404);
  if (!cabin.isActive) throw createError('This cabin is currently inactive');

  const schedule = await getTodaySchedule();
  if (schedule.isClosed) {
    throw createError('Library is closed today');
  }

  const validSlots = await getFutureSlotsForToday();
  const isValid = validSlots.slots.some(s => s.id === timeSlotId);
  if (!isValid) {
    throw createError('Selected time slot is invalid or has already passed for today.');
  }

  const slotDetails = await getSlotDetails(timeSlotId);
  
  if (!slotDetails) {
    throw createError('Invalid time slot');
  }

  // --- Rule: Cabin can have only one active booking for THIS SLOT ---
  const existingCabinBooking = await Booking.findOne({
    cabinId: cabin._id,
    bookingDate: slotDetails.dateString,
    timeSlotId: slotDetails.id,
    status: { $in: ACTIVE_STATUSES },
  });
  if (existingCabinBooking) {
    throw createError('This cabin is already booked or requested for this specific time slot');
  }

  const requestTime = new Date();
  
  const booking = await Booking.create({
    cabinId: cabin._id,
    studentUserId: adminId, // Uses admin's ID
    userType: 'faculty', // Bypass schema changes by using faculty mode
    mainStudent: {
      name: `Admin: ${adminUsername}`,
      phoneNumber: 'N/A'
    },
    groupMembers: [],
    peopleCount: 1,
    bookingDate: slotDetails.dateString,
    timeSlotId: slotDetails.id,
    startTime: slotDetails.startTime,
    endTime: slotDetails.endTime,
    status: BOOKING_STATUS.APPROVED,
    requestedAt: requestTime,
    approvedAt: requestTime,
    approvedBy: adminId,
    ...(body.message && { adminNote: body.message }),
  });

  return booking;
}
