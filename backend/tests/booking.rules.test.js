require('./helpers/setup');
const mongoose = require('mongoose');
const Booking = require('../src/models/Booking');
const Cabin = require('../src/models/Cabin');
const User = require('../src/models/User');
const bookingService = require('../src/services/booking.service');
const { getFutureSlotsForToday } = require('../src/utils/date.utils');

// Helper to create test data
async function createTestCabin(overrides = {}) {
  return Cabin.create({
    code: 'T1',
    name: 'Test Cabin',
    minPeople: 2,
    maxPeople: 6,
    isActive: true,
    ...overrides,
  });
}

async function createTestUser(overrides = {}) {
  return User.create({
    googleId: `google_${Date.now()}_${Math.random()}`,
    email: `test${Date.now()}@rishihood.edu.in`,
    name: 'Test User',
    ...overrides,
  });
}

describe('Booking Rules', () => {
  let cabin, user;

  beforeEach(async () => {
    cabin = await createTestCabin();
    user = await createTestUser();
  });

  test('Rule 9: People count must be within cabin min/max', async () => {
    await expect(
      bookingService.createBookingRequest(user._id, {
        cabinId: cabin._id.toString(),
        timeSlotId: getFutureSlotsForToday().slots.length > 0 ? getFutureSlotsForToday().slots[getFutureSlotsForToday().slots.length - 1].id : '21:30-22:30',
        mainStudent: { name: 'A', enrollmentNumber: '10001', phoneNumber: '9999999999' },
        groupMembers: [],
        peopleCount: 1, // below min of 2
      })
    ).rejects.toThrow(/People count must be between/);
  });

  test('Rule 10: 1 + groupMembers.length must equal peopleCount', async () => {
    await expect(
      bookingService.createBookingRequest(user._id, {
        cabinId: cabin._id.toString(),
        timeSlotId: getFutureSlotsForToday().slots.length > 0 ? getFutureSlotsForToday().slots[getFutureSlotsForToday().slots.length - 1].id : '21:30-22:30',
        mainStudent: { name: 'A', enrollmentNumber: '10001', phoneNumber: '9999999999' },
        groupMembers: [{ name: 'B', enrollmentNumber: '10002' }],
        peopleCount: 3, // should be 2
      })
    ).rejects.toThrow(/group members.*must equal people count/);
  });

  test('Rule 7: Main enrollment cannot be in group members', async () => {
    await expect(
      bookingService.createBookingRequest(user._id, {
        cabinId: cabin._id.toString(),
        timeSlotId: getFutureSlotsForToday().slots.length > 0 ? getFutureSlotsForToday().slots[getFutureSlotsForToday().slots.length - 1].id : '21:30-22:30',
        mainStudent: { name: 'A', enrollmentNumber: '10001', phoneNumber: '9999999999' },
        groupMembers: [{ name: 'B', enrollmentNumber: '10001' }],
        peopleCount: 2,
      })
    ).rejects.toThrow(/cannot also appear as a group member/);
  });

  test('Rule 6: No duplicate enrollment in group', async () => {
    await expect(
      bookingService.createBookingRequest(user._id, {
        cabinId: cabin._id.toString(),
        timeSlotId: getFutureSlotsForToday().slots.length > 0 ? getFutureSlotsForToday().slots[getFutureSlotsForToday().slots.length - 1].id : '21:30-22:30',
        mainStudent: { name: 'A', enrollmentNumber: '10001', phoneNumber: '9999999999' },
        groupMembers: [
          { name: 'B', enrollmentNumber: '10002' },
          { name: 'C', enrollmentNumber: '10002' },
        ],
        peopleCount: 3,
      })
    ).rejects.toThrow(/Duplicate enrollment/);
  });

  test('Rule 11: Cannot book inactive cabin', async () => {
    const inactiveCabin = await createTestCabin({ code: 'T2', isActive: false });
    await expect(
      bookingService.createBookingRequest(user._id, {
        cabinId: inactiveCabin._id.toString(),
        timeSlotId: getFutureSlotsForToday().slots.length > 0 ? getFutureSlotsForToday().slots[getFutureSlotsForToday().slots.length - 1].id : '21:30-22:30',
        mainStudent: { name: 'A', enrollmentNumber: '10001', phoneNumber: '9999999999' },
        groupMembers: [{ name: 'B', enrollmentNumber: '10002' }],
        peopleCount: 2,
      })
    ).rejects.toThrow(/inactive/);
  });

  test('Rule 3: Student can have only one active booking', async () => {
    // First booking succeeds
    await bookingService.createBookingRequest(user._id, {
      cabinId: cabin._id.toString(),
        timeSlotId: getFutureSlotsForToday().slots.length > 0 ? getFutureSlotsForToday().slots[getFutureSlotsForToday().slots.length - 1].id : '21:30-22:30',
      mainStudent: { name: 'A', enrollmentNumber: '10001', phoneNumber: '9999999999' },
      groupMembers: [{ name: 'B', enrollmentNumber: '10002' }],
      peopleCount: 2,
    });

    const cabin2 = await createTestCabin({ code: 'T3' });

    // Second booking fails
    await expect(
      bookingService.createBookingRequest(user._id, {
        cabinId: cabin2._id.toString(),
        timeSlotId: getFutureSlotsForToday().slots.length > 0 ? getFutureSlotsForToday().slots[getFutureSlotsForToday().slots.length - 1].id : '21:30-22:30',
        mainStudent: { name: 'A', enrollmentNumber: '10003', phoneNumber: '8888888888' },
        groupMembers: [{ name: 'C', enrollmentNumber: '10004' }],
        peopleCount: 2,
      })
    ).rejects.toThrow(/already have an active booking/);
  });

  test('Rule 2: Cabin can have only one active booking', async () => {
    const user2 = await createTestUser();

    await bookingService.createBookingRequest(user._id, {
      cabinId: cabin._id.toString(),
        timeSlotId: getFutureSlotsForToday().slots.length > 0 ? getFutureSlotsForToday().slots[getFutureSlotsForToday().slots.length - 1].id : '21:30-22:30',
      mainStudent: { name: 'A', enrollmentNumber: '10001', phoneNumber: '9999999999' },
      groupMembers: [{ name: 'B', enrollmentNumber: '10002' }],
      peopleCount: 2,
    });

    await expect(
      bookingService.createBookingRequest(user2._id, {
        cabinId: cabin._id.toString(),
        timeSlotId: getFutureSlotsForToday().slots.length > 0 ? getFutureSlotsForToday().slots[getFutureSlotsForToday().slots.length - 1].id : '21:30-22:30',
        mainStudent: { name: 'C', enrollmentNumber: '10003', phoneNumber: '8888888888' },
        groupMembers: [{ name: 'D', enrollmentNumber: '10004' }],
        peopleCount: 2,
      })
    ).rejects.toThrow(/already booked or requested for this specific time slot/);
  });

  test('Rules 4,5: Enrollment already in another active booking', async () => {
    const cabin2 = await createTestCabin({ code: 'T4' });
    const user2 = await createTestUser();

    // First booking with 10002 as group member
    await bookingService.createBookingRequest(user._id, {
      cabinId: cabin._id.toString(),
        timeSlotId: getFutureSlotsForToday().slots.length > 0 ? getFutureSlotsForToday().slots[getFutureSlotsForToday().slots.length - 1].id : '21:30-22:30',
      mainStudent: { name: 'A', enrollmentNumber: '10001', phoneNumber: '9999999999' },
      groupMembers: [{ name: 'B', enrollmentNumber: '10002' }],
      peopleCount: 2,
    });

    // Second booking tries to use 10002 as main student
    await expect(
      bookingService.createBookingRequest(user2._id, {
        cabinId: cabin2._id.toString(),
        timeSlotId: getFutureSlotsForToday().slots.length > 0 ? getFutureSlotsForToday().slots[getFutureSlotsForToday().slots.length - 1].id : '21:30-22:30',
        mainStudent: { name: 'B', enrollmentNumber: '10002', phoneNumber: '8888888888' },
        groupMembers: [{ name: 'C', enrollmentNumber: '10003' }],
        peopleCount: 2,
      })
    ).rejects.toThrow(/already part of an active booking/);
  });

  test('Rule 8: Phone already in another active booking', async () => {
    const cabin2 = await createTestCabin({ code: 'T5' });
    const user2 = await createTestUser();

    await bookingService.createBookingRequest(user._id, {
      cabinId: cabin._id.toString(),
        timeSlotId: getFutureSlotsForToday().slots.length > 0 ? getFutureSlotsForToday().slots[getFutureSlotsForToday().slots.length - 1].id : '21:30-22:30',
      mainStudent: { name: 'A', enrollmentNumber: '10001', phoneNumber: '9999999999' },
      groupMembers: [{ name: 'B', enrollmentNumber: '10002' }],
      peopleCount: 2,
    });

    await expect(
      bookingService.createBookingRequest(user2._id, {
        cabinId: cabin2._id.toString(),
        timeSlotId: getFutureSlotsForToday().slots.length > 0 ? getFutureSlotsForToday().slots[getFutureSlotsForToday().slots.length - 1].id : '21:30-22:30',
        mainStudent: { name: 'C', enrollmentNumber: '10003', phoneNumber: '9999999999' },
        groupMembers: [{ name: 'D', enrollmentNumber: '10004' }],
        peopleCount: 2,
      })
    ).rejects.toThrow(/phone number is already associated/);
  });

  test('Successful booking creates pending status', async () => {
    const booking = await bookingService.createBookingRequest(user._id, {
      cabinId: cabin._id.toString(),
        timeSlotId: getFutureSlotsForToday().slots.length > 0 ? getFutureSlotsForToday().slots[getFutureSlotsForToday().slots.length - 1].id : '21:30-22:30',
      mainStudent: { name: 'A', enrollmentNumber: '10001', phoneNumber: '9999999999' },
      groupMembers: [{ name: 'B', enrollmentNumber: '10002' }],
      peopleCount: 2,
    });

    expect(booking.status).toBe('pending');
    expect(booking.approvalDeadlineAt).toBeDefined();
    expect(booking.mainStudent.enrollmentNumber).toBe('10001');
  });
});
