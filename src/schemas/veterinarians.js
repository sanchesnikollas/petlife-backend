import { z } from 'zod';

export const createVeterinarianSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  clinic: z.string().max(100).optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email().max(100).optional(),
  specialty: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
});

export const updateVeterinarianSchema = createVeterinarianSchema.partial();
