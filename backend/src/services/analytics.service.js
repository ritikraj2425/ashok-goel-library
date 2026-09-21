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
    { $group: { _id: '$status', count: { $sum: 1 }, studentCount: { $sum: '$peopleCount' } } },
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
    early_checkout: 0,
  };

  const studentCounts = { ...counts };

  for (const item of statusCounts) {
    counts[item._id] = item.count;
    counts.total += item.count;
    studentCounts[item._id] = item.studentCount || 0;
    studentCounts.total += item.studentCount || 0;
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
        totalSlots: { $sum: { $ifNull: ['$slotCount', 1] } },
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
      $addFields: {
        allSlots: {
          $cond: {
            if: { $and: [{ $isArray: '$timeSlotIds' }, { $gt: [{ $size: '$timeSlotIds' }, 0] }] },
            then: '$timeSlotIds',
            else: ['$timeSlotId']
          }
        }
      }
    },
    { $unwind: '$allSlots' },
    {
      $group: {
        _id: '$allSlots',
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
    studentCounts,
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
/**
 * Generate CSV string for analytics download with selectable columns.
 */
async function generateAnalyticsCSV(startDate, endDate, columns = [], statuses = [], search = '') {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  const filter = { requestedAt: { $gte: start, $lte: end } };
  if (statuses && statuses.length > 0 && !statuses.includes('total')) {
    filter.status = { $in: statuses };
  }
  if (search) {
    filter.$or = [
      { 'mainStudent.name': { $regex: `^${search}$`, $options: 'i' } },
      { 'mainStudent.enrollmentNumber': search },
      { 'groupMembers.name': { $regex: `^${search}$`, $options: 'i' } },
      { 'groupMembers.enrollmentNumber': search },
    ];
  }

  const bookings = await Booking.find(filter)
    .populate('studentUserId', 'name email')
    .populate('cabinId', 'name code')
    .sort({ requestedAt: -1 })
    .lean();

  // All possible columns and their extractors
  const COLUMN_MAP = {
    date: { header: 'Date', extract: (b) => b.bookingDate || '' },
    slot: { 
      header: 'Time Slot', 
      extract: (b) => {
        if (b.timeSlotIds && b.timeSlotIds.length > 1) {
          const first = b.timeSlotIds[0].split('-')[0];
          const last = b.timeSlotIds[b.timeSlotIds.length - 1].split('-')[1];
          return `${first}-${last}`;
        }
        return b.timeSlotId || '';
      }
    },
    cabin: { header: 'Cabin', extract: (b) => b.cabinId?.name || '' },
    cabin_code: { header: 'Cabin Code', extract: (b) => b.cabinId?.code || '' },
    student_name: { header: 'Student Name', extract: (b) => b.mainStudent?.name || '' },
    enrollment: { header: 'Enrollment No.', extract: (b) => b.mainStudent?.enrollmentNumber || '' },
    phone: { header: 'Phone', extract: (b) => b.mainStudent?.phoneNumber || '' },
    email: { header: 'Email', extract: (b) => b.studentUserId?.email || '' },
    people_count: { header: 'People Count', extract: (b) => b.peopleCount || '' },
    group_members: {
      header: 'Group Members',
      extract: (b) =>
        (b.groupMembers || []).map((m) => `${m.name} (${m.enrollmentNumber})`).join('; '),
    },
    status: {
      header: 'Status',
      extract: (b) =>
        (b.status || '').replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
    },
    requested_at: { header: 'Requested At', extract: (b) => b.requestedAt ? new Date(b.requestedAt).toLocaleString() : '' },
    approved_at: { header: 'Approved At', extract: (b) => b.approvedAt ? new Date(b.approvedAt).toLocaleString() : '' },
    checked_in_at: { header: 'Checked In At', extract: (b) => b.checkedInAt ? new Date(b.checkedInAt).toLocaleString() : '' },
    completed_at: { header: 'Completed At', extract: (b) => b.completedAt ? new Date(b.completedAt).toLocaleString() : '' },
    cancellation_reason: { header: 'Cancellation Reason', extract: (b) => b.cancellationReason || b.rejectionReason || '' },
  };

  // If no columns specified, use a sensible default set
  const selectedColumns = columns && columns.length > 0
    ? columns.filter((c) => COLUMN_MAP[c])
    : ['date', 'slot', 'cabin', 'student_name', 'enrollment', 'phone', 'status'];

  // Build CSV
  const escapeCSV = (val) => {
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerRow = selectedColumns.map((c) => escapeCSV(COLUMN_MAP[c].header)).join(',');
  const dataRows = bookings.map((b) =>
    selectedColumns.map((c) => escapeCSV(COLUMN_MAP[c].extract(b))).join(',')
  );

  // Compute summary statistics
  const summaryCounts = {};
  const summaryStudents = {};
  let totalBookings = 0;
  let totalStudents = 0;

  for (const b of bookings) {
    const s = b.status || 'unknown';
    summaryCounts[s] = (summaryCounts[s] || 0) + 1;
    summaryStudents[s] = (summaryStudents[s] || 0) + (b.peopleCount || 0);
    totalBookings++;
    totalStudents += (b.peopleCount || 0);
  }

  const formatStatus = (s) => s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  const summaryLines = [
    '--- SUMMARY STATISTICS ---',
    `Total Bookings,${totalBookings}`,
    `Total Students,${totalStudents}`,
    '',
    'Breakdown by Status:',
    'Status,Bookings,Students',
    ...Object.keys(summaryCounts).map(s => `${escapeCSV(formatStatus(s))},${summaryCounts[s]},${summaryStudents[s]}`),
    '',
    '--- DETAILED DATA ---'
  ];

  return [...summaryLines, headerRow, ...dataRows].join('\n');
}

module.exports = { getAnalytics, getAnalyticsBookings, generateAnalyticsCSV };
