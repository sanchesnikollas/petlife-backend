import { z } from 'zod';

export const updateRoutineSchema = z.object({
  walksPerDay: z.number().int().min(0).max(10).optional().nullable(),
  walkDuration: z.number().int().min(0).max(360).optional().nullable(),
  daycare: z.boolean().optional(),
  daycareName: z.string().max(100).optional().nullable(),
  daycarePhone: z.string().max(30).optional().nullable(),
  bathFrequency: z.enum(['weekly', 'biweekly', 'monthly']).optional().nullable(),
  bathLocation: z.enum(['home', 'petshop']).optional().nullable(),
});
