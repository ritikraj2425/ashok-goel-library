const { z } = require('zod');

const groupMemberSchema = z.object({
  name: z.string().trim().regex(/^[a-zA-Z\s\.\-']+$/, 'Group member name should only contain letters').min(1, 'Group member name is required'),
});

const createBookingSchema = z.object({
  cabinId: z.string().min(1, 'Cabin ID is required'),
  timeSlotId: z.string().min(1, 'Time slot is required'),
  timeSlotIds: z.array(z.string().min(1)).max(2).optional(),
  slotCount: z.number().int().min(1).max(2).default(1),
  userType: z.enum(['student', 'faculty']).default('student'),
  mainStudent: z.object({
    name: z.string().trim().regex(/^[a-zA-Z\s\.\-']+$/, 'Name should only contain letters').min(1, 'Name is required'),
    phoneNumber: z.string().trim().regex(/^\d{10}$/, 'Phone number must be exactly 10 digits').min(1, 'Phone number is required'),
  }),
  groupMembers: z.array(groupMemberSchema).default([]).optional(),
  peopleCount: z.number().int().min(1, 'People count must be at least 1'),
});

const cancelBookingParamsSchema = z.object({
  id: z.string().min(1, 'Booking ID is required'),
});

module.exports = {
  createBookingSchema,
  cancelBookingParamsSchema,
};

