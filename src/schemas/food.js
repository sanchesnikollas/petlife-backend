import { z } from 'zod';

export const updateFoodConfigSchema = z.object({
  brand: z.string().max(100).optional().nullable(),
  line: z.string().max(100).optional().nullable(),
  type: z.enum(['DRY', 'WET', 'RAW', 'HOMEMADE', 'MIXED']).optional(),
  portionGrams: z.number().positive().optional().nullable(),
  mealsPerDay: z.number().int().min(1).max(10).optional(),
  schedule: z.array(z.string()).optional(),
});

export const createMealLogSchema = z.object({
  date: z.string().datetime(),
  time: z.string().min(1, 'Time is required'), // e.g., "08:00"
  given: z.boolean().optional().default(true),
});

export const createWeightEntrySchema = z.object({
  date: z.string().datetime(),
  value: z.number().positive('Weight must be greater than 0'),
});
