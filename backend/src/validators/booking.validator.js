const { z } = require('zod');

const groupMemberSchema = z.object({
  name: z.string().trim().regex(/^[a-zA-Z\s\.\-']+$/, 'Group member name should only contain letters').min(1, 'Group member name is required'),
  enrollmentNumber: z.string().trim().regex(/^\d+$/, 'Group member enrollment number must contain only numbers').min(1, 'Group member enrollment number is required'),
});

const createBookingSchema = z.object({
  cabinId: z.string().min(1, 'Cabin ID is required'),
  timeSlotId: z.string().min(1, 'Time slot is required'),
  mainStudent: z.object({
    name: z.string().trim().regex(/^[a-zA-Z\s\.\-']+$/, 'Main student name should only contain letters').min(1, 'Main student name is required'),
    enrollmentNumber: z.string().trim().regex(/^\d+$/, 'Main student enrollment number must contain only numbers').min(1, 'Main student enrollment number is required'),
    phoneNumber: z.string().trim().regex(/^\d{10}$/, 'Main student phone number must be exactly 10 digits').min(1, 'Main student phone number is required'),
  }),
  groupMembers: z.array(groupMemberSchema).default([]),
  peopleCount: z.number().int().min(1, 'People count must be at least 1'),
});

const cancelBookingParamsSchema = z.object({
  id: z.string().min(1, 'Booking ID is required'),
});

module.exports = {
  createBookingSchema,
  cancelBookingParamsSchema,
};
