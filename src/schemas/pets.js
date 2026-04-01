import { z } from 'zod';

export const createPetSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50),
  species: z.enum(['DOG', 'CAT']),
  breed: z.string().max(50).optional(),
  birthDate: z.string().datetime().optional().refine((val) => !val || new Date(val) <= new Date(), { message: 'Birth date cannot be in the future' }),
  sex: z.enum(['MALE', 'FEMALE']).optional(),
  weight: z.number().positive('Weight must be > 0').optional(),
  allergies: z.array(z.string()).optional().default([]),
  conditions: z.array(z.string()).optional().default([]),
  microchip: z.string().optional(),
  neutered: z.boolean().optional().default(false),
  neuteredDate: z.string().datetime().optional(),
  activityLevel: z.enum(['LOW', 'MODERATE', 'HIGH']).optional(),
  healthPlan: z.string().max(100).optional(),
  healthPlanNumber: z.string().max(50).optional(),
});

export const updatePetSchema = createPetSchema.partial();
