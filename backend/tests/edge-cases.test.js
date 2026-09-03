require('./helpers/setup');
const mongoose = require('mongoose');
const Booking = require('../src/models/Booking');
const Cabin = require('../src/models/Cabin');
const User = require('../src/models/User');
const Admin = require('../src/models/Admin');
const bookingService = require('../src/services/booking.service');
const { getFutureSlotsForToday } = require('../src/utils/date.utils');
const { BOOKING_STATUS, TIMING } = require('../src/utils/constants');

async function createTestCabin(overrides = {}) {
  return Cabin.create({ code: `C${Date.now()}`, name: 'Test', minPeople: 2, maxPeople: 6, isActive: true, ...overrides });
}

async function createTestUser(overrides = {}) {
  return User.create({ googleId: `g_${Date.now()}_${Math.random()}`, email: `t${Date.now()}@rishihood.edu.in`, name: 'Test', ...overrides });
}

async function createTestAdmin() {
  const admin = new Admin({ username: `admin${Date.now()}`, passwordHash: 'test123456', role: 'admin', isActive: true });
  await admin.save();
  return admin;
}

async function createPendingBooking(userId, cabinId, enrollment = '10001', phone = '9999999999') {
  const slots = getFutureSlotsForToday().slots;
  // Always use the last slot of the day to ensure it's in the future, or fallback if none exist
  const timeSlotId = slots.length > 0 ? slots[slots.length - 1].id : '21:30-22:30';
  
  return bookingService.createBookingRequest(userId, {
    cabinId: cabinId.toString(),
    timeSlotId,
    mainStudent: { name: 'Test', enrollmentNumber: enrollment, phoneNumber: phone },
    groupMembers: [{ name: 'Member', enrollmentNumber: `${enrollment}2` }],
    peopleCount: 2,
  });
}

describe('Edge Cases', () => {
  test('Student cannot cancel someone else\'s request', async () => {
    const cabin = await createTestCabin();
    const user1 = await createTestUser();
    const user2 = await createTestUser();

    const booking = await createPendingBooking(user1._id, cabin._id);

    await expect(
      bookingService.cancelPendingByStudent(booking._id, user2._id)
    ).rejects.toThrow(/only cancel your own/);
  });

  test('Student cannot cancel approved booking', async () => {
    const cabin = await createTestCabin();
    const user = await createTestUser();
    const admin = await createTestAdmin();

    const booking = await createPendingBooking(user._id, cabin._id);
    await bookingService.approveBooking(booking._id, admin._id);

    await expect(
      bookingService.cancelPendingByStudent(booking._id, user._id)
    ).rejects.toThrow(/cannot be cancelled by students/);
  });

  test('Cannot approve after deadline', async () => {
    const cabin = await createTestCabin();
    const user = await createTestUser();
    const admin = await createTestAdmin();

    // Create booking with past deadline
    const booking = await Booking.create({
      cabinId: cabin._id,
      studentUserId: user._id,
      timeSlotId: '21:30-22:30',
      bookingDate: new Date().toISOString().split('T')[0],
      startTime: new Date(),
      endTime: new Date(),
      mainStudent: { name: 'Test', enrollmentNumber: '10001', phoneNumber: '9999999999' },
      groupMembers: [{ name: 'M', enrollmentNumber: '10002' }],
      peopleCount: 2,
      status: BOOKING_STATUS.PENDING,
      requestedAt: new Date(Date.now() - 20 * 60 * 1000),
      approvalDeadlineAt: new Date(Date.now() - 20 * 60 * 1000), // 20 min ago
    });

    await expect(
      bookingService.approveBooking(booking._id, admin._id)
    ).rejects.toThrow();
  });

  test('Cannot reject after auto-rejection', async () => {
    const cabin = await createTestCabin();
    const user = await createTestUser();
    const admin = await createTestAdmin();

    const booking = await Booking.create({
      cabinId: cabin._id,
      studentUserId: user._id,
      timeSlotId: '21:30-22:30',
      bookingDate: new Date().toISOString().split('T')[0],
      startTime: new Date(),
      endTime: new Date(),
      mainStudent: { name: 'Test', enrollmentNumber: '10001', phoneNumber: '9999999999' },
      groupMembers: [{ name: 'M', enrollmentNumber: '10002' }],
      peopleCount: 2,
      status: BOOKING_STATUS.AUTO_REJECTED,
      requestedAt: new Date(),
      approvalDeadlineAt: new Date(),
      rejectedAt: new Date(),
    });

    await expect(
      bookingService.rejectBooking(booking._id, admin._id, 'late')
    ).rejects.toThrow(/Cannot reject booking/);
  });

  test('Cancel pending by student works', async () => {
    const cabin = await createTestCabin();
    const user = await createTestUser();

    const booking = await createPendingBooking(user._id, cabin._id);
    const cancelled = await bookingService.cancelPendingByStudent(booking._id, user._id);

    expect(cancelled.status).toBe(BOOKING_STATUS.CANCELLED_BY_STUDENT);
    expect(cancelled.cancelledAt).toBeDefined();
  });

  test('Admin can cancel approved booking', async () => {
    const cabin = await createTestCabin();
    const user = await createTestUser();
    const admin = await createTestAdmin();

    const booking = await createPendingBooking(user._id, cabin._id);
    await bookingService.approveBooking(booking._id, admin._id);

    const cancelled = await bookingService.cancelBookingByAdmin(booking._id, admin._id, 'test');
    expect(cancelled.status).toBe(BOOKING_STATUS.CANCELLED_BY_ADMIN);
  });

  test('Enrollment normalization (whitespace trimming)', async () => {
    const cabin = await createTestCabin();
    const user = await createTestUser();

    const slots = getFutureSlotsForToday().slots;
    const timeSlotId = slots.length > 0 ? slots[slots.length - 1].id : '21:30-22:30';

    const booking = await bookingService.createBookingRequest(user._id, {
      cabinId: cabin._id.toString(),
      timeSlotId,
      mainStudent: { name: 'A', enrollmentNumber: '  10001  ', phoneNumber: '9999999999' },
      groupMembers: [{ name: 'B', enrollmentNumber: '10002' }],
      peopleCount: 2,
    });

    expect(booking.mainStudent.enrollmentNumber).toBe('10001');
    expect(booking.groupMembers[0].enrollmentNumber).toBe('10002');
  });

  test('Successful approve sets correct timestamps', async () => {
    const cabin = await createTestCabin();
    const user = await createTestUser();
    const admin = await createTestAdmin();

    const booking = await createPendingBooking(user._id, cabin._id);
    const approved = await bookingService.approveBooking(booking._id, admin._id);

    expect(approved.status).toBe(BOOKING_STATUS.APPROVED);
    expect(approved.approvedAt).toBeDefined();
    expect(approved.expiresAt).toBeDefined();
    expect(approved.approvedBy.toString()).toBe(admin._id.toString());

    // Expires matches slot end time
    expect(approved.expiresAt.getTime()).toBe(approved.endTime.getTime());
  });
});

describe('Email Validation', () => {
  const { isValidCollegeEmail } = require('../src/utils/email.utils');

  test('Valid emails', () => {
    expect(isValidCollegeEmail('abc@rishihood.edu.in')).toBe(true);
    expect(isValidCollegeEmail('abc@nst.rishihood.edu.in')).toBe(true);
    expect(isValidCollegeEmail('abc@school.rishihood.edu.in')).toBe(true);
    expect(isValidCollegeEmail('abc.def@rishihood.edu.in')).toBe(true);
  });

  test('Invalid emails', () => {
    expect(isValidCollegeEmail('abc@gmail.com')).toBe(false);
    expect(isValidCollegeEmail('abc@rishihood.edu.in.fake.com')).toBe(false);
    expect(isValidCollegeEmail('abc@rishihood.edu.com')).toBe(false);
    expect(isValidCollegeEmail('')).toBe(false);
    expect(isValidCollegeEmail(null)).toBe(false);
  });
});
