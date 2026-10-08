const Booking = require('../models/Booking');
const { BOOKING_STATUS } = require('../utils/constants');
const { runCleanup } = require('./cleanup.service');
const { getISTParts } = require('../utils/date.utils');
const mongoose = require('mongoose');

function expandBookings(bookings) {
  let expanded = [];
  for (const b of bookings) {
    if (b.slotCount === 2 && b.timeSlotIds && b.timeSlotIds.length === 2) {
      let b1 = { ...b, timeSlotId: b.timeSlotIds[0], timeSlotIds: [b.timeSlotIds[0]], isExpanded: true, expandedSlotIndex: 0 };
      let b2 = { ...b, timeSlotId: b.timeSlotIds[1], timeSlotIds: [b.timeSlotIds[1]], isExpanded: true, expandedSlotIndex: 1 };
      
      if (b.status === BOOKING_STATUS.EARLY_CHECKOUT && b.cancelledAt) {
        const secondSlotStartStr = b.timeSlotIds[1].split('-')[0];
        const cancelledIST = new Date(b.cancelledAt).toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
        
        if (cancelledIST < secondSlotStartStr) {
          b1.status = BOOKING_STATUS.EARLY_CHECKOUT;
          b2.status = BOOKING_STATUS.CANCELLED_BY_STUDENT;
        } else {
          b1.status = BOOKING_STATUS.EARLY_CHECKOUT;
          b2.status = BOOKING_STATUS.EARLY_CHECKOUT;
        }
      }
      
      expanded.push(b1, b2);
    } else {
      expanded.push(b);
    }
  }
  return expanded;
}

/**
 * Get analytics data for a given date range.
 */
async function getAnalytics(startDate, endDate, search = '', cabinId = '') {
  await runCleanup();

  const startParts = getISTParts(new Date(startDate));
  const pad = (n) => n.toString().padStart(2, '0');
  const startStr = `${startParts.year}-${pad(startParts.month)}-${pad(startParts.day)}`;

  const endParts = getISTParts(new Date(endDate));
  const endStr = `${endParts.year}-${pad(endParts.month)}-${pad(endParts.day)}`;

  const filter = { bookingDate: { $gte: startStr, $lte: endStr } };
  
  if (cabinId) {
    filter.cabinId = new mongoose.Types.ObjectId(cabinId);
  }

  if (search) {
    filter.$or = [
      { 'mainStudent.name': { $regex: search, $options: 'i' } },
      { 'groupMembers.name': { $regex: search, $options: 'i' } }
    ];
  }

  const allBookingsRaw = await Booking.find(filter).populate('cabinId').lean();
  const allBookings = expandBookings(allBookingsRaw);

  const counts = {
    total: 0, pending: 0, approved: 0, rejected: 0, auto_rejected: 0,
    cancelled_by_student: 0, cancelled_by_admin: 0, completed: 0, cancel_requested: 0,
    awaiting_checkin: 0, checked_in: 0, no_show: 0, early_checkout: 0,
  };
  const studentCounts = { ...counts };

  const cabinUsageMap = {};
  const popularSlotsMap = {};

  let totalApprovalTimeMs = 0;
  let approvedCount = 0;
  
  let totalOccupancyMs = 0;
  let completedCount = 0;

  for (const b of allBookings) {
    counts.total += 1;
    counts[b.status] = (counts[b.status] || 0) + 1;
    
    studentCounts.total += b.peopleCount || 0;
    studentCounts[b.status] = (studentCounts[b.status] || 0) + (b.peopleCount || 0);

    const isUsage = [BOOKING_STATUS.APPROVED, BOOKING_STATUS.COMPLETED, BOOKING_STATUS.AWAITING_CHECKIN, BOOKING_STATUS.CHECKED_IN, BOOKING_STATUS.CANCELLED_BY_ADMIN, BOOKING_STATUS.EARLY_CHECKOUT].includes(b.status);
    
    if (isUsage && b.cabinId && b.cabinId._id) {
      const cid = b.cabinId._id.toString();
      if (!cabinUsageMap[cid]) {
        cabinUsageMap[cid] = {
          _id: b.cabinId._id,
          cabinCode: b.cabinId.code,
          cabinName: b.cabinId.name,
          bookingCount: 0,
          totalSlots: 0,
          totalPeople: 0
        };
      }
      cabinUsageMap[cid].bookingCount += 1;
      cabinUsageMap[cid].totalSlots += 1;
      if (!b.isExpanded || b.expandedSlotIndex === 0) {
        cabinUsageMap[cid].totalPeople += b.peopleCount || 0;
      }

      const slot = b.timeSlotId;
      if (slot) {
        popularSlotsMap[slot] = (popularSlotsMap[slot] || 0) + 1;
      }
    }

    if (b.approvedAt && b.requestedAt && [BOOKING_STATUS.APPROVED, BOOKING_STATUS.COMPLETED].includes(b.status)) {
      totalApprovalTimeMs += (new Date(b.approvedAt) - new Date(b.requestedAt));
      approvedCount++;
    }

    if (b.completedAt && b.approvedAt && b.status === BOOKING_STATUS.COMPLETED) {
      totalOccupancyMs += (new Date(b.completedAt) - new Date(b.approvedAt));
      completedCount++;
    }
  }

  const cabinUsage = Object.values(cabinUsageMap).sort((a, b) => b.bookingCount - a.bookingCount);
  
  const popularSlots = Object.keys(popularSlotsMap)
    .sort((a, b) => a.localeCompare(b))
    .map(slot => ({ slot, count: popularSlotsMap[slot] }));

  const mostUsedCabin = cabinUsage.length > 0 ? cabinUsage[0] : null;

  return {
    dateRange: { start: start.toISOString(), end: end.toISOString() },
    counts,
    studentCounts,
    cabinUsage,
    peakHours: popularSlots, 
    popularSlots,
    averageApprovalTimeMs: approvedCount > 0 ? Math.round(totalApprovalTimeMs / approvedCount) : null,
    averageOccupancyDurationMs: completedCount > 0 ? Math.round(totalOccupancyMs / completedCount) : null,
    mostUsedCabin,
  };
}

/**
 * Get detailed bookings for a specific status and date range.
 */
async function getAnalyticsBookings(startDate, endDate, status, page = 1, limit = 20, search = '', cabinId = '') {
  await runCleanup();

  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  const filter = { requestedAt: { $gte: start, $lte: end } };
  
  if (cabinId) {
    filter.cabinId = new mongoose.Types.ObjectId(cabinId);
  }

  if (search) {
    filter.$or = [
      { 'mainStudent.name': { $regex: search, $options: 'i' } },
      { 'groupMembers.name': { $regex: search, $options: 'i' } }
    ];
  }

  const rawBookings = await Booking.find(filter)
    .populate('studentUserId', 'name email')
    .populate('cabinId', 'name code')
    .sort({ requestedAt: -1 })
    .lean();

  let expanded = expandBookings(rawBookings);

  if (status && status !== 'total') {
    expanded = expanded.filter(b => b.status === status);
  }

  const skip = (page - 1) * limit;
  const paginatedBookings = expanded.slice(skip, skip + limit);
  const total = expanded.length;
  const totalStudents = expanded.reduce((sum, b) => sum + (b.peopleCount || 0), 0);

  return {
    bookings: paginatedBookings,
    totalPages: Math.ceil(total / limit),
    currentPage: page,
    totalStudents,
  };
}
/**
 * Generate CSV string for analytics download with selectable columns.
 */
async function generateAnalyticsCSV(startDate, endDate, columns = [], statuses = [], search = '', cabinId = '') {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  const filter = { requestedAt: { $gte: start, $lte: end } };
  
  if (cabinId) {
    filter.cabinId = new mongoose.Types.ObjectId(cabinId);
  }
  if (search) {
    filter.$or = [
      { 'mainStudent.name': { $regex: search, $options: 'i' } },
      { 'groupMembers.name': { $regex: search, $options: 'i' } },
    ];
  }

  const rawBookings = await Booking.find(filter)
    .populate('studentUserId', 'name email')
    .populate('cabinId', 'name code')
    .sort({ requestedAt: -1 })
    .lean();

  let bookings = expandBookings(rawBookings);

  if (statuses && statuses.length > 0 && !statuses.includes('total')) {
    bookings = bookings.filter(b => statuses.includes(b.status));
  }

  // Helper: format a Date to IST string for CSV
  const formatDateIST = (d) => {
    if (!d) return '';
    const date = new Date(d);
    return date.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  };

  // All possible columns and their extractors
  const COLUMN_MAP = {
    date: { header: 'Date', extract: (b) => b.bookingDate || '' },
    slot: { 
      header: 'Time Slot', 
      extract: (b) => {
        // For expanded bookings, show only the individual slot
        if (b.isExpanded) {
          return b.timeSlotId || '';
        }
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
    enrollment_no: { header: 'Enrollment No', extract: (b) => b.mainStudent?.enrollmentNumber || '' },
    phone: { header: 'Phone', extract: (b) => b.mainStudent?.phoneNumber || '' },
    email: { header: 'Email', extract: (b) => b.studentUserId?.email || '' },
    people_count: { header: 'People Count', extract: (b) => b.peopleCount != null ? String(b.peopleCount) : '' },
    group_members: {
      header: 'Group Members',
      extract: (b) => {
        // New flow: joinedMembers with name + email
        if (b.joinedMembers && b.joinedMembers.length > 0) {
          return b.joinedMembers.map((m) => `${m.name} (${m.email})`).join('; ');
        }
        // Old flow: groupMembers with name + enrollmentNumber
        if (b.groupMembers && b.groupMembers.length > 0) {
          return b.groupMembers.map((m) => {
            if (m.enrollmentNumber) {
              return `${m.name} (${m.enrollmentNumber})`;
            }
            return m.name;
          }).join('; ');
        }
        return '';
      },
    },
    status: {
      header: 'Status',
      extract: (b) =>
        (b.status || '').replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
    },
    requested_at: { header: 'Requested At', extract: (b) => formatDateIST(b.requestedAt) },
    approved_at: { header: 'Approved At', extract: (b) => formatDateIST(b.approvedAt) },
    checked_in_at: { header: 'Checked In At', extract: (b) => formatDateIST(b.checkedInAt) },
    completed_at: { header: 'Completed At', extract: (b) => formatDateIST(b.completedAt) },
    cancellation_reason: { header: 'Cancellation Reason', extract: (b) => b.cancellationReason || b.rejectionReason || '' },
  };

  // If no columns specified, use a sensible default set
  const selectedColumns = columns && columns.length > 0
    ? columns.filter((c) => COLUMN_MAP[c])
    : ['date', 'slot', 'cabin', 'student_name', 'enrollment_no', 'phone', 'status'];

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

  // Compute summary statistics (avoid double-counting people for expanded slots)
  const summaryCounts = {};
  const summaryStudents = {};
  let totalBookings = 0;
  let totalStudents = 0;

  for (const b of bookings) {
    const s = b.status || 'unknown';
    summaryCounts[s] = (summaryCounts[s] || 0) + 1;
    totalBookings++;
    // Only count students once per original booking (not per expanded slot)
    if (!b.isExpanded || b.expandedSlotIndex === 0) {
      const pc = b.peopleCount || 0;
      summaryStudents[s] = (summaryStudents[s] || 0) + pc;
      totalStudents += pc;
    } else {
      // Ensure key exists even if we don't add to the count
      summaryStudents[s] = summaryStudents[s] || 0;
    }
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
