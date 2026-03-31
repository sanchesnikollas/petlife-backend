import { z } from 'zod';

export const createRecordSchema = z.object({
  date: z.string().datetime(),
  type: z.enum(['VACCINE', 'DEWORMING', 'MEDICATION', 'CONSULTATION', 'EXAM', 'SURGERY', 'NOTE']),
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().optional().nullable(),
});

export const updateRecordSchema = z.object({
  date: z.string().datetime().optional(),
  type: z.enum(['VACCINE', 'DEWORMING', 'MEDICATION', 'CONSULTATION', 'EXAM', 'SURGERY', 'NOTE']).optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional().nullable(),
});

export const recordsQuerySchema = z.object({
  type: z.enum(['VACCINE', 'DEWORMING', 'MEDICATION', 'CONSULTATION', 'EXAM', 'SURGERY', 'NOTE']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
