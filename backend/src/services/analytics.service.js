const Booking = require('../models/Booking');
const { BOOKING_STATUS } = require('../utils/constants');
const { runCleanup } = require('./cleanup.service');

/**
 * Get analytics data for a given date range.
 */
async function getAnalytics(startDate, endDate, search = '') {
  await runCleanup();

  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  const filter = { requestedAt: { $gte: start, $lte: end } };

  if (search) {
    filter.$or = [
      { 'mainStudent.name': { $regex: `^${search}$`, $options: 'i' } },
      { 'mainStudent.enrollmentNumber': search },
      { 'groupMembers.name': { $regex: `^${search}$`, $options: 'i' } },
      { 'groupMembers.enrollmentNumber': search }
    ];
  }

  // --- Status counts ---
  const statusCounts = await Booking.aggregate([
    { $match: filter },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);

  const counts = {
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    auto_rejected: 0,
    cancelled_by_student: 0,
    cancelled_by_admin: 0,
    completed: 0,
    cancel_requested: 0,
    awaiting_checkin: 0,
    checked_in: 0,
    no_show: 0,
  };

  for (const item of statusCounts) {
    counts[item._id] = item.count;
    counts.total += item.count;
  }

  // --- Cabin-wise usage (only approved + completed bookings count as usage) ---
  const cabinUsage = await Booking.aggregate([
    {
      $match: {
        ...filter,
        status: { 
          $in: [
            BOOKING_STATUS.APPROVED, 
            BOOKING_STATUS.COMPLETED,
            BOOKING_STATUS.AWAITING_CHECKIN,
            BOOKING_STATUS.CHECKED_IN,
            BOOKING_STATUS.CANCELLED_BY_ADMIN,
            BOOKING_STATUS.EARLY_CHECKOUT
          ] 
        },
      },
    },
    {
      $lookup: {
        from: 'cabins',
        localField: 'cabinId',
        foreignField: '_id',
        as: 'cabin',
      },
    },
    { $unwind: '$cabin' },
    {
      $group: {
        _id: '$cabinId',
        cabinCode: { $first: '$cabin.code' },
        cabinName: { $first: '$cabin.name' },
        bookingCount: { $sum: 1 },
        totalPeople: { $sum: '$peopleCount' },
      },
    },
    { $sort: { bookingCount: -1 } },
  ]);

  // --- Popular Slots (by timeSlotId) ---
  const popularSlotsRaw = await Booking.aggregate([
    {
      $match: {
        ...filter,
        status: { 
          $in: [
            BOOKING_STATUS.APPROVED, 
            BOOKING_STATUS.COMPLETED,
            BOOKING_STATUS.AWAITING_CHECKIN,
            BOOKING_STATUS.CHECKED_IN,
            BOOKING_STATUS.CANCELLED_BY_ADMIN,
            BOOKING_STATUS.EARLY_CHECKOUT
          ] 
        },
      },
    },
    {
      $group: {
        _id: '$timeSlotId',
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const popularSlots = popularSlotsRaw.map((s) => ({
    slot: s._id,
    count: s.count,
  }));

  // --- Average approval time (for approved/completed bookings) ---
  const avgApprovalTime = await Booking.aggregate([
    {
      $match: {
        ...filter,
        approvedAt: { $exists: true },
        status: { $in: [BOOKING_STATUS.APPROVED, BOOKING_STATUS.COMPLETED] },
      },
    },
    {
      $project: {
        approvalTimeMs: { $subtract: ['$approvedAt', '$requestedAt'] },
      },
    },
    {
      $group: {
        _id: null,
        avgMs: { $avg: '$approvalTimeMs' },
      },
    },
  ]);

  // --- Average occupancy duration (for completed bookings) ---
  const avgOccupancy = await Booking.aggregate([
    {
      $match: {
        ...filter,
        completedAt: { $exists: true },
        approvedAt: { $exists: true },
        status: BOOKING_STATUS.COMPLETED,
      },
    },
    {
      $project: {
        durationMs: { $subtract: ['$completedAt', '$approvedAt'] },
      },
    },
    {
      $group: {
        _id: null,
        avgMs: { $avg: '$durationMs' },
      },
    },
  ]);

  // --- Most used cabin ---
  const mostUsedCabin = cabinUsage.length > 0 ? cabinUsage[0] : null;

  return {
    dateRange: { start: start.toISOString(), end: end.toISOString() },
    counts,
    cabinUsage,
    peakHours: popularSlots, // rename in frontend later, or keep key as peakHours to avoid massive renaming
    popularSlots,
    averageApprovalTimeMs: avgApprovalTime.length > 0 ? Math.round(avgApprovalTime[0].avgMs) : null,
    averageOccupancyDurationMs: avgOccupancy.length > 0 ? Math.round(avgOccupancy[0].avgMs) : null,
    mostUsedCabin,
  };
}

/**
 * Get detailed bookings for a specific status and date range.
 */
async function getAnalyticsBookings(startDate, endDate, status, page = 1, limit = 20, search = '') {
  await runCleanup();

  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  const filter = { requestedAt: { $gte: start, $lte: end } };

  if (status && status !== 'total') {
    filter.status = status;
  }

  if (search) {
    filter.$or = [
      { 'mainStudent.name': { $regex: `^${search}$`, $options: 'i' } },
      { 'mainStudent.enrollmentNumber': search },
      { 'groupMembers.name': { $regex: `^${search}$`, $options: 'i' } },
      { 'groupMembers.enrollmentNumber': search }
    ];
  }

  const skip = (page - 1) * limit;

  const [bookings, total, totalStudentsAgg] = await Promise.all([
    Booking.find(filter)
      .populate('studentUserId', 'name email')
      .populate('cabinId', 'name code')
      .sort({ requestedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Booking.countDocuments(filter),
    Booking.aggregate([
      { $match: filter },
      { $group: { _id: null, totalStudents: { $sum: '$peopleCount' } } }
    ])
  ]);

  const totalStudents = totalStudentsAgg.length > 0 ? totalStudentsAgg[0].totalStudents : 0;

  return {
    bookings,
    totalPages: Math.ceil(total / limit),
    currentPage: page,
    totalStudents,
  };
}

module.exports = { getAnalytics, getAnalyticsBookings };
