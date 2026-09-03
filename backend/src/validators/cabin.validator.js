const { z } = require('zod');

const createCabinSchema = z.object({
  code: z.string().trim().min(1, 'Cabin code is required').max(10),
  name: z.string().trim().min(1, 'Cabin name is required').max(50),
  minPeople: z.number().int().min(1, 'Min people must be at least 1'),
  maxPeople: z.number().int().min(1, 'Max people must be at least 1'),
  isActive: z.boolean().optional().default(true),
});

const updateCabinSchema = z.object({
  code: z.string().trim().min(1).max(10).optional(),
  name: z.string().trim().min(1).max(50).optional(),
  minPeople: z.number().int().min(1).optional(),
  maxPeople: z.number().int().min(1).optional(),
  isActive: z.boolean().optional(),
});

module.exports = {
  createCabinSchema,
  updateCabinSchema,
};
