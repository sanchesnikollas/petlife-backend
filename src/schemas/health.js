import { z } from 'zod';

export const createVaccineSchema = z.object({
  name: z.string().min(1, 'Vaccine name is required'),
  lastDone: z.string().datetime(),
  nextDue: z.string().datetime().optional().nullable(),
  clinic: z.string().optional().nullable(),
  vet: z.string().optional().nullable(),
});

export const updateVaccineSchema = z.object({
  name: z.string().min(1).optional(),
  lastDone: z.string().datetime().optional(),
  nextDue: z.string().datetime().optional().nullable(),
  clinic: z.string().optional().nullable(),
  vet: z.string().optional().nullable(),
});

export const createDewormingSchema = z.object({
  name: z.string().min(1, 'Deworming name is required'),
  product: z.string().optional().nullable(),
  lastDone: z.string().datetime(),
  nextDue: z.string().datetime().optional().nullable(),
});

export const updateDewormingSchema = z.object({
  name: z.string().min(1).optional(),
  product: z.string().optional().nullable(),
  lastDone: z.string().datetime().optional(),
  nextDue: z.string().datetime().optional().nullable(),
});

export const createMedicationSchema = z.object({
  name: z.string().min(1, 'Medication name is required'),
  dose: z.string().optional().nullable(),
  frequency: z.string().optional().nullable(),
  startDate: z.string().datetime(),
  duration: z.string().optional().nullable(),
  nextDue: z.string().datetime().optional().nullable(),
  active: z.boolean().optional().default(true),
});

export const updateMedicationSchema = z.object({
  name: z.string().min(1).optional(),
  dose: z.string().optional().nullable(),
  frequency: z.string().optional().nullable(),
  startDate: z.string().datetime().optional(),
  duration: z.string().optional().nullable(),
  nextDue: z.string().datetime().optional().nullable(),
  active: z.boolean().optional(),
});

export const createConsultationSchema = z.object({
  date: z.string().datetime(),
  type: z.string().optional().nullable(),
  clinic: z.string().optional().nullable(),
  vet: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const updateConsultationSchema = z.object({
  date: z.string().datetime().optional(),
  type: z.string().optional().nullable(),
  clinic: z.string().optional().nullable(),
  vet: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

/**
 * Calculate health status based on nextDue date.
 * - OVERDUE: nextDue < now
 * - DUE_SOON: nextDue within 7 days
 * - OK: nextDue > 7 days from now
 */
export function calculateHealthStatus(nextDue) {
  if (!nextDue) return 'OK';

  const now = new Date();
  const due = new Date(nextDue);
  const diffMs = due.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays < 0) return 'OVERDUE';
  if (diffDays <= 7) return 'DUE_SOON';
  return 'OK';
}
