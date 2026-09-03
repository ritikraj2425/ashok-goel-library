const mongoose = require('mongoose');
const { BOOKING_STATUS, ACTIVE_STATUSES } = require('../utils/constants');

const groupMemberSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    enrollmentNumber: { type: String, required: true, trim: true, uppercase: true },
  },
  { _id: false }
);

const bookingSchema = new mongoose.Schema({
  cabinId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cabin',
    required: true,
    index: true,
  },
  studentUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },

  mainStudent: {
    name: { type: String, required: true, trim: true },
    enrollmentNumber: { type: String, required: true, trim: true, uppercase: true },
    phoneNumber: { type: String, required: true, trim: true },
  },

  groupMembers: {
    type: [groupMemberSchema],
    default: [],
  },

  peopleCount: {
    type: Number,
    required: true,
    min: 1,
  },

  bookingDate: { type: String, required: true, index: true }, // YYYY-MM-DD
  timeSlotId: { type: String, required: true }, // e.g. 09:30-10:30
  startTime: { type: Date, required: true, index: true },
  endTime: { type: Date, required: true },

  status: {
    type: String,
    enum: Object.values(BOOKING_STATUS),
    default: BOOKING_STATUS.PENDING,
    required: true,
    index: true,
  },

  requestedAt: {
    type: Date,
    default: Date.now,
  },
  approvalDeadlineAt: {
    type: Date,
    index: true,
  },

  approvedAt: { type: Date },
  expiresAt: {
    type: Date,
    index: true,
  },

  rejectedAt: { type: Date },
  cancelledAt: { type: Date },
  completedAt: { type: Date },
  cancelRequestedAt: { type: Date },

  // Check-in system
  checkInDeadlineAt: {
    type: Date,
    index: true,
  },
  checkedInAt: { type: Date },
  checkedInBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
  },
  noShowAt: { type: Date },

  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
  },
  rejectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
  },
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
  },

  cancellationReason: { type: String, trim: true },
  rejectionReason: { type: String, trim: true },
  adminNote: { type: String, trim: true },
});

// Find active bookings for a cabin on a specific date
bookingSchema.index({ cabinId: 1, bookingDate: 1, status: 1 });

// Find active bookings for a student user
bookingSchema.index({ studentUserId: 1, status: 1 });

// Find active bookings by main student enrollment
bookingSchema.index({ 'mainStudent.enrollmentNumber': 1, status: 1 });

// Find active bookings by group member enrollment
bookingSchema.index({ 'groupMembers.enrollmentNumber': 1, status: 1 });

// Find active bookings by phone number
bookingSchema.index({ 'mainStudent.phoneNumber': 1, status: 1 });

// For cleanup queries
bookingSchema.index({ status: 1, approvalDeadlineAt: 1 });
bookingSchema.index({ status: 1, expiresAt: 1 });
bookingSchema.index({ status: 1, checkInDeadlineAt: 1 });
bookingSchema.index({ status: 1, startTime: 1 });

// For analytics
bookingSchema.index({ requestedAt: 1 });
bookingSchema.index({ approvedAt: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
