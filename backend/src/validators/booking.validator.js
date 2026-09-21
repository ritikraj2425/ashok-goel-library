const { z } = require('zod');

const groupMemberSchema = z.object({
  name: z.string().trim().regex(/^[a-zA-Z\s\.\-']+$/, 'Group member name should only contain letters').min(1, 'Group member name is required'),
  enrollmentNumber: z.string().trim().regex(/^\d+$/, 'Group member enrollment number must contain only numbers').min(1, 'Group member enrollment number is required'),
});

const createBookingSchema = z.object({
  cabinId: z.string().min(1, 'Cabin ID is required'),
  timeSlotId: z.string().min(1, 'Time slot is required'),
  timeSlotIds: z.array(z.string().min(1)).max(2).optional(),
  slotCount: z.number().int().min(1).max(2).default(1),
  userType: z.enum(['student', 'faculty']).default('student'),
  mainStudent: z.object({
    name: z.string().trim().regex(/^[a-zA-Z\s\.\-']+$/, 'Name should only contain letters').min(1, 'Name is required'),
    enrollmentNumber: z.string().trim().regex(/^\d+$/, 'Enrollment/ID must contain only numbers').min(1, 'Enrollment/ID is required'),
    phoneNumber: z.string().trim().regex(/^\d{10}$/, 'Phone number must be exactly 10 digits').min(1, 'Phone number is required'),
  }),
  groupMembers: z.array(groupMemberSchema).default([]),
  peopleCount: z.number().int().min(1, 'People count must be at least 1'),
}).superRefine((data, ctx) => {
  if (data.userType === 'student') {
    const validateEnrollment = (enrollment, path) => {
      if (enrollment.startsWith('23')) {
        if (enrollment.length !== 6) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enrollment must be exactly 6 digits', path });
        }
      } else if (enrollment.match(/^(2[4-9]|[3-9]\d)/)) {
        if (enrollment.length !== 10) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enrollment must be exactly 10 digits', path });
        }
      }
    };

    validateEnrollment(data.mainStudent.enrollmentNumber, ['mainStudent', 'enrollmentNumber']);
    data.groupMembers.forEach((member, idx) => {
      validateEnrollment(member.enrollmentNumber, ['groupMembers', idx, 'enrollmentNumber']);
    });
  }
});

const cancelBookingParamsSchema = z.object({
  id: z.string().min(1, 'Booking ID is required'),
});

module.exports = {
  createBookingSchema,
  cancelBookingParamsSchema,
};
