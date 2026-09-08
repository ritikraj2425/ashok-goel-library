const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Cabin = require('../models/Cabin');
const User = require('../models/User');
const { BOOKING_STATUS, ACTIVE_STATUSES, TIMING } = require('../utils/constants');
const { normalizeEnrollment, normalizePhone, normalizeName } = require('../utils/normalize');
const { runCleanup } = require('./cleanup.service');
const { getFutureSlotsForToday, getSlotDetails } = require('../utils/date.utils');

/**
 * Helper: Create an error with a status code.
 */
function createError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

/**
 * Create a new booking request.
 * Enforces ALL booking rules atomically.
 */
async function createBookingRequest(userId, body) {
  // Run cleanup first to clear expired bookings
  await runCleanup();

  const { cabinId, timeSlotId, userType = 'student', mainStudent, groupMembers = [], peopleCount } = body;

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

  // --- Validate time slot ---
  const validSlots = getFutureSlotsForToday();
  const isValid = validSlots.slots.some(s => s.id === timeSlotId);
  if (!isValid) {
    throw createError('Selected time slot is invalid or has already passed for today.');
  }
  const slotDetails = getSlotDetails(timeSlotId);

  // --- Normalize inputs ---
  const normalizedMain = {
    name: normalizeName(mainStudent.name),
    enrollmentNumber: normalizeEnrollment(mainStudent.enrollmentNumber),
    phoneNumber: normalizePhone(mainStudent.phoneNumber),
  };

  const normalizedGroupMembers = (groupMembers || []).map((m) => ({
    name: normalizeName(m.name),
    enrollmentNumber: normalizeEnrollment(m.enrollmentNumber),
  }));

  // --- Rule 10: 1 + groupMembers.length must equal peopleCount ---
  if (1 + normalizedGroupMembers.length !== peopleCount) {
    throw createError(
      `Number of group members (${normalizedGroupMembers.length}) plus main student must equal people count (${peopleCount})`
    );
  }

  // --- Rule 7: Main enrollment cannot be in group members ---
  const mainEnrollment = normalizedMain.enrollmentNumber;
  for (const member of normalizedGroupMembers) {
    if (member.enrollmentNumber === mainEnrollment) {
      throw createError('Main student enrollment number cannot also appear as a group member');
    }
  }

  // --- Rule 6: No duplicate enrollment numbers in group ---
  const enrollmentSet = new Set();
  for (const member of normalizedGroupMembers) {
    if (enrollmentSet.has(member.enrollmentNumber)) {
      throw createError(
        `Duplicate enrollment number in group: ${member.enrollmentNumber}`
      );
    }
    enrollmentSet.add(member.enrollmentNumber);
  }

  // --- Collect all enrollment numbers for duplicate checks ---
  const allEnrollments = [mainEnrollment, ...normalizedGroupMembers.map((m) => m.enrollmentNumber)];

  // --- Rule 11: Max 2 bookings per day per enrollment ---
  const todaysBookings = await Booking.find({
    bookingDate: slotDetails.dateString,
    status: {
      $in: [
        BOOKING_STATUS.PENDING,
        BOOKING_STATUS.APPROVED,
        BOOKING_STATUS.AWAITING_CHECKIN,
        BOOKING_STATUS.CHECKED_IN,
        BOOKING_STATUS.COMPLETED,
      ],
    },
    $or: [
      { 'mainStudent.enrollmentNumber': { $in: allEnrollments } },
      { 'groupMembers.enrollmentNumber': { $in: allEnrollments } },
    ],
  }).select('mainStudent groupMembers').lean();

  const enrollmentCounts = {};
  for (const b of todaysBookings) {
    if (b.mainStudent?.enrollmentNumber) {
      enrollmentCounts[b.mainStudent.enrollmentNumber] = (enrollmentCounts[b.mainStudent.enrollmentNumber] || 0) + 1;
    }
    for (const member of (b.groupMembers || [])) {
      if (member.enrollmentNumber) {
        enrollmentCounts[member.enrollmentNumber] = (enrollmentCounts[member.enrollmentNumber] || 0) + 1;
      }
    }
  }

  for (const enrollment of allEnrollments) {
    if (enrollmentCounts[enrollment] >= 2) {
      throw createError(`Enrollment number ${enrollment} has already 2 bookings complete on a day. More than 2 slots of cabin are not allowed for a user in a day.`);
    }
  }

  // --- Rule 3: User cannot book overlapping slots ---
  const userOverlappingBooking = await Booking.findOne({
    studentUserId: userId,
    timeSlotId: slotDetails.id,
    bookingDate: slotDetails.dateString,
    status: { $in: ACTIVE_STATUSES },
  });
  if (userOverlappingBooking) {
    throw createError('You already have an active booking or request for this specific time slot');
  }

  // --- Rule 2: Cabin can have only one active booking for THIS SLOT ---
  const existingCabinBooking = await Booking.findOne({
    cabinId: cabin._id,
    bookingDate: slotDetails.dateString,
    timeSlotId: slotDetails.id,
    status: { $in: ACTIVE_STATUSES },
  });
  if (existingCabinBooking) {
    throw createError('This cabin is already booked or requested for this specific time slot');
  }

  // --- Rules 4, 5: Check enrollment numbers against THIS SLOT's active bookings ---
  const enrollmentConflict = await Booking.findOne({
    timeSlotId: slotDetails.id,
    bookingDate: slotDetails.dateString,
    status: { $in: ACTIVE_STATUSES },
    $or: [
      { 'mainStudent.enrollmentNumber': { $in: allEnrollments } },
      { 'groupMembers.enrollmentNumber': { $in: allEnrollments } },
    ],
  });
  if (enrollmentConflict) {
    throw createError(
      'One or more enrollment numbers are already part of an active booking for this time slot'
    );
  }

  // --- Rule 8: Phone number cannot be in another active booking for THIS SLOT ---
  const phoneConflict = await Booking.findOne({
    timeSlotId: slotDetails.id,
    bookingDate: slotDetails.dateString,
    status: { $in: ACTIVE_STATUSES },
    'mainStudent.phoneNumber': normalizedMain.phoneNumber,
  });
  if (phoneConflict) {
    throw createError('Phone number is already used in an active booking for this time slot');
  }

  // --- Create the booking ---
  const now = new Date();
  const booking = await Booking.create({
    cabinId: cabin._id,
    studentUserId: userId,
    userType,
    mainStudent: normalizedMain,
    groupMembers: normalizedGroupMembers,
    peopleCount,
    bookingDate: slotDetails.dateString,
    timeSlotId: slotDetails.id,
    startTime: slotDetails.startTime,
    endTime: slotDetails.endTime,
    status: BOOKING_STATUS.PENDING,
    requestedAt: now,
    approvalDeadlineAt: new Date(now.getTime() + TIMING.PENDING_TIMEOUT_MS),
    checkInDeadlineAt: new Date(
      Math.min(
        Math.max(now.getTime(), slotDetails.startTime.getTime()) + TIMING.CHECKIN_TIMEOUT_MS,
        slotDetails.endTime.getTime()
      )
    ),
  });

  return booking;
}

/**
 * Get the active bookings for a student.
 */
async function getMyActiveBookings(userId) {
  await runCleanup();

  const bookings = await Booking.find({
    studentUserId: userId,
    status: { $in: ACTIVE_STATUSES },
  })
    .populate('cabinId', 'code name')
    .sort({ startTime: 1 })
    .lean();

  return bookings;
}

/**
 * Get booking history for a student.
 */
async function getMyBookingHistory(userId, page = 1, limit = 20) {
  await runCleanup();

  const skip = (page - 1) * limit;

  const [bookings, total] = await Promise.all([
    Booking.find({ studentUserId: userId })
      .sort({ requestedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('cabinId', 'code name')
      .lean(),
    Booking.countDocuments({ studentUserId: userId }),
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
    throw createError(`Cannot cancel booking with status: ${existing.status}`);
  }

  // Check for permanent block (3 or more approved cancellations in 7 days)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const cancellationCount = await Booking.countDocuments({
    studentUserId: userId,
    status: BOOKING_STATUS.CANCELLED_BY_STUDENT,
    approvedAt: { $exists: true, $ne: null }, // Only count cancellations of approved bookings
    cancelledAt: { $gte: sevenDaysAgo },
  });

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
    // 1. Pending approval
    Booking.find({ status: BOOKING_STATUS.PENDING })
      .populate('cabinId', 'code name')
      .populate('studentUserId', 'email name')
      .sort({ requestedAt: 1 })
      .lean(),

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
      .select('cabinId timeSlotId')
      .lean(),

    // All cabins
    Cabin.find({ isActive: true }).sort({ code: 1 }).lean(),
  ]);

  // Build per-cabin occupied slots set
  const cabinOccupiedSlots = {};
  for (const b of allActiveTodayBookings) {
    const cabinIdStr = b.cabinId.toString();
    if (!cabinOccupiedSlots[cabinIdStr]) cabinOccupiedSlots[cabinIdStr] = new Set();
    cabinOccupiedSlots[cabinIdStr].add(b.timeSlotId);
  }

  // Get future slots for today
  const futureSlots = getFutureSlotsForToday().slots;

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
};
