const { z } = require('zod');

const adminLoginSchema = z.object({
  username: z.string().trim().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

const createAdminSchema = z.object({
  username: z.string().trim().min(3, 'Username must be at least 3 characters').max(30),
  password: z.string().min(6, 'Password must be at least 6 characters').max(128),
});

const updateAdminSchema = z.object({
  isActive: z.boolean().optional(),
  password: z.string().min(6).max(128).optional(),
});

const adminBookingActionSchema = z.object({
  reason: z.string().trim().max(500).optional(),
  note: z.string().trim().max(500).optional(),
});

module.exports = {
  adminLoginSchema,
  createAdminSchema,
  updateAdminSchema,
  adminBookingActionSchema,
};
