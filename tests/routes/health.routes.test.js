import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildApp } from '../../src/server.js';
import { prisma } from '../setup.js';
import { createTestUser } from '../factories/user.js';
import { createTestPet } from '../factories/pet.js';
import { signAccessToken } from '../../src/utils/jwt.js';

describe('Health Routes', () => {
  let app, user, pet;

  beforeEach(async () => {
    app = buildApp({ logger: false });
    await app.ready();
    user = await createTestUser({ email: 'health@example.com' });
    pet = await createTestPet(user.id, { name: 'Rex' });
  });

  afterEach(async () => {
    await app.close();
  });

  function headers() {
    const token = signAccessToken({ id: user.id, email: user.email, plan: user.plan });
    return { authorization: `Bearer ${token}` };
  }

  // ─── Vaccines ──────────────────────────────────────────

  describe('Vaccines', () => {
    it('should create a vaccine and auto-create record', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/pets/${pet.id}/vaccines`,
        headers: headers(),
        payload: {
          name: 'V10',
          lastDone: '2026-01-15T10:00:00.000Z',
          nextDue: '2027-01-15T10:00:00.000Z',
          clinic: 'PetVet',
          vet: 'Dr. Ana',
        },
      });

      expect(res.statusCode).toBe(201);

      const body = JSON.parse(res.payload);
      expect(body.data.name).toBe('V10');
      expect(body.data.status).toBe('OK');

      // Verify record was auto-created
      const records = await prisma.record.findMany({
        where: { petId: pet.id, type: 'VACCINE' },
      });
      expect(records).toHaveLength(1);
      expect(records[0].title).toContain('V10');
    });

    it('should list vaccines with computed status', async () => {
      // Create an overdue vaccine
      await prisma.vaccine.create({
        data: {
          petId: pet.id,
          name: 'Rabies',
          lastDone: new Date('2025-01-01'),
          nextDue: new Date('2025-06-01'), // past date = overdue
        },
      });

      const res = await app.inject({
        method: 'GET',
        url: `/pets/${pet.id}/vaccines`,
        headers: headers(),
      });

      expect(res.statusCode).toBe(200);

      const body = JSON.parse(res.payload);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].status).toBe('OVERDUE');
    });

    it('should update a vaccine', async () => {
      const vaccine = await prisma.vaccine.create({
        data: {
          petId: pet.id,
          name: 'V8',
          lastDone: new Date('2026-01-01'),
        },
      });

      const res = await app.inject({
        method: 'PATCH',
        url: `/pets/${pet.id}/vaccines/${vaccine.id}`,
        headers: headers(),
        payload: { name: 'V10' },
      });

      expect(res.statusCode).toBe(200);

      const body = JSON.parse(res.payload);
      expect(body.data.name).toBe('V10');
    });

    it('should delete a vaccine', async () => {
      const vaccine = await prisma.vaccine.create({
        data: {
          petId: pet.id,
          name: 'V8',
          lastDone: new Date('2026-01-01'),
        },
      });

      const res = await app.inject({
        method: 'DELETE',
        url: `/pets/${pet.id}/vaccines/${vaccine.id}`,
        headers: headers(),
      });

      expect(res.statusCode).toBe(200);

      const count = await prisma.vaccine.count({ where: { petId: pet.id } });
      expect(count).toBe(0);
    });
  });

  // ─── Dewormings ────────────────────────────────────────

  describe('Dewormings', () => {
    it('should create a deworming and auto-create record', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/pets/${pet.id}/dewormings`,
        headers: headers(),
        payload: {
          name: 'Drontal',
          product: 'Drontal Plus',
          lastDone: '2026-03-01T10:00:00.000Z',
          nextDue: '2026-06-01T10:00:00.000Z',
        },
      });

      expect(res.statusCode).toBe(201);

      const body = JSON.parse(res.payload);
      expect(body.data.name).toBe('Drontal');
      expect(body.data.product).toBe('Drontal Plus');

      const records = await prisma.record.findMany({
        where: { petId: pet.id, type: 'DEWORMING' },
      });
      expect(records).toHaveLength(1);
    });

    it('should CRUD dewormings', async () => {
      const deworming = await prisma.deworming.create({
        data: {
          petId: pet.id,
          name: 'Milbemax',
          lastDone: new Date('2026-01-01'),
        },
      });

      // List
      const listRes = await app.inject({
        method: 'GET',
        url: `/pets/${pet.id}/dewormings`,
        headers: headers(),
      });
      expect(JSON.parse(listRes.payload).data).toHaveLength(1);

      // Update
      const updateRes = await app.inject({
        method: 'PATCH',
        url: `/pets/${pet.id}/dewormings/${deworming.id}`,
        headers: headers(),
        payload: { product: 'Milbemax Combo' },
      });
      expect(updateRes.statusCode).toBe(200);

      // Delete
      const deleteRes = await app.inject({
        method: 'DELETE',
        url: `/pets/${pet.id}/dewormings/${deworming.id}`,
        headers: headers(),
      });
      expect(deleteRes.statusCode).toBe(200);
    });
  });

  // ─── Medications ───────────────────────────────────────

  describe('Medications', () => {
    it('should create a medication and auto-create record', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/pets/${pet.id}/medications`,
        headers: headers(),
        payload: {
          name: 'Prednisolona',
          dose: '5mg',
          frequency: '1x/dia',
          startDate: '2026-03-01T10:00:00.000Z',
          duration: '7 dias',
          active: true,
        },
      });

      expect(res.statusCode).toBe(201);

      const body = JSON.parse(res.payload);
      expect(body.data.name).toBe('Prednisolona');
      expect(body.data.active).toBe(true);

      const records = await prisma.record.findMany({
        where: { petId: pet.id, type: 'MEDICATION' },
      });
      expect(records).toHaveLength(1);
    });

    it('should update medication active status', async () => {
      const med = await prisma.medication.create({
        data: {
          petId: pet.id,
          name: 'Amoxicilina',
          startDate: new Date('2026-03-01'),
          active: true,
        },
      });

      const res = await app.inject({
        method: 'PATCH',
        url: `/pets/${pet.id}/medications/${med.id}`,
        headers: headers(),
        payload: { active: false },
      });

      expect(res.statusCode).toBe(200);

      const body = JSON.parse(res.payload);
      expect(body.data.active).toBe(false);
    });
  });

  // ─── Consultations ────────────────────────────────────

  describe('Consultations', () => {
    it('should create a consultation and auto-create record', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/pets/${pet.id}/consultations`,
        headers: headers(),
        payload: {
          date: '2026-03-20T14:00:00.000Z',
          type: 'Rotina',
          clinic: 'PetVet',
          vet: 'Dr. Carlos',
          notes: 'Tudo normal, pet saudavel.',
        },
      });

      expect(res.statusCode).toBe(201);

      const body = JSON.parse(res.payload);
      expect(body.data.type).toBe('Rotina');
      expect(body.data.notes).toContain('saudavel');

      const records = await prisma.record.findMany({
        where: { petId: pet.id, type: 'CONSULTATION' },
      });
      expect(records).toHaveLength(1);
    });

    it('should CRUD consultations', async () => {
      const consult = await prisma.consultation.create({
        data: {
          petId: pet.id,
          date: new Date('2026-02-15'),
          clinic: 'PetShop',
        },
      });

      // Update
      const updateRes = await app.inject({
        method: 'PATCH',
        url: `/pets/${pet.id}/consultations/${consult.id}`,
        headers: headers(),
        payload: { notes: 'Updated notes' },
      });
      expect(updateRes.statusCode).toBe(200);
      expect(JSON.parse(updateRes.payload).data.notes).toBe('Updated notes');

      // Delete
      const deleteRes = await app.inject({
        method: 'DELETE',
        url: `/pets/${pet.id}/consultations/${consult.id}`,
        headers: headers(),
      });
      expect(deleteRes.statusCode).toBe(200);
    });
  });

  // ─── Status Calculation ────────────────────────────────

  describe('Status Calculation', () => {
    it('should mark as OVERDUE when nextDue is in the past', async () => {
      await prisma.vaccine.create({
        data: {
          petId: pet.id,
          name: 'Overdue Vaccine',
          lastDone: new Date('2024-01-01'),
          nextDue: new Date('2025-01-01'), // Past date
        },
      });

      const res = await app.inject({
        method: 'GET',
        url: `/pets/${pet.id}/vaccines`,
        headers: headers(),
      });

      const body = JSON.parse(res.payload);
      expect(body.data[0].status).toBe('OVERDUE');
    });

    it('should mark as DUE_SOON when nextDue is within 7 days', async () => {
      const inFiveDays = new Date();
      inFiveDays.setDate(inFiveDays.getDate() + 5);

      await prisma.vaccine.create({
        data: {
          petId: pet.id,
          name: 'Soon Vaccine',
          lastDone: new Date('2025-06-01'),
          nextDue: inFiveDays,
        },
      });

      const res = await app.inject({
        method: 'GET',
        url: `/pets/${pet.id}/vaccines`,
        headers: headers(),
      });

      const body = JSON.parse(res.payload);
      expect(body.data[0].status).toBe('DUE_SOON');
    });

    it('should mark as OK when nextDue is more than 7 days away', async () => {
      const inThirtyDays = new Date();
      inThirtyDays.setDate(inThirtyDays.getDate() + 30);

      await prisma.vaccine.create({
        data: {
          petId: pet.id,
          name: 'OK Vaccine',
          lastDone: new Date('2026-01-01'),
          nextDue: inThirtyDays,
        },
      });

      const res = await app.inject({
        method: 'GET',
        url: `/pets/${pet.id}/vaccines`,
        headers: headers(),
      });

      const body = JSON.parse(res.payload);
      expect(body.data[0].status).toBe('OK');
    });
  });
});
