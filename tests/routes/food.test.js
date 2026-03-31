import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildApp } from '../../src/server.js';
import { prisma } from '../setup.js';
import { createTestUser } from '../factories/user.js';
import { createTestPet } from '../factories/pet.js';
import { signAccessToken } from '../../src/utils/jwt.js';

describe('Food & Weight Routes', () => {
  let app, user, pet;

  beforeEach(async () => {
    app = buildApp({ logger: false });
    await app.ready();
    user = await createTestUser({ email: 'food@example.com' });
    pet = await createTestPet(user.id, { name: 'Rex' });
  });

  afterEach(async () => {
    await app.close();
  });

  function headers(overrideUser) {
    const u = overrideUser || user;
    const token = signAccessToken({ id: u.id, email: u.email, plan: u.plan });
    return { authorization: `Bearer ${token}` };
  }

  describe('Food Config', () => {
    it('should get default food config', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/pets/${pet.id}/food`,
        headers: headers(),
      });

      expect(res.statusCode).toBe(200);

      const body = JSON.parse(res.payload);
      expect(body.data.petId).toBe(pet.id);
      expect(body.data.type).toBe('DRY');
      expect(body.data.mealsPerDay).toBe(2);
    });

    it('should update food config', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/pets/${pet.id}/food`,
        headers: headers(),
        payload: {
          brand: 'Royal Canin',
          line: 'Medium Adult',
          type: 'DRY',
          portionGrams: 250,
          mealsPerDay: 3,
          schedule: ['08:00', '13:00', '19:00'],
        },
      });

      expect(res.statusCode).toBe(200);

      const body = JSON.parse(res.payload);
      expect(body.data.brand).toBe('Royal Canin');
      expect(body.data.portionGrams).toBe(250);
      expect(body.data.mealsPerDay).toBe(3);
      expect(body.data.schedule).toEqual(['08:00', '13:00', '19:00']);
    });
  });

  describe('Meal Logs', () => {
    it('should log a meal', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/pets/${pet.id}/meals`,
        headers: headers(),
        payload: {
          date: '2026-03-30T08:00:00.000Z',
          time: '08:00',
          given: true,
        },
      });

      expect(res.statusCode).toBe(201);

      const body = JSON.parse(res.payload);
      expect(body.data.time).toBe('08:00');
      expect(body.data.given).toBe(true);
    });

    it('should list meals for a specific date', async () => {
      await prisma.mealLog.createMany({
        data: [
          { petId: pet.id, date: new Date('2026-03-30'), time: '08:00', given: true },
          { petId: pet.id, date: new Date('2026-03-30'), time: '13:00', given: true },
          { petId: pet.id, date: new Date('2026-03-29'), time: '08:00', given: true },
        ],
      });

      const res = await app.inject({
        method: 'GET',
        url: `/pets/${pet.id}/meals?date=2026-03-30`,
        headers: headers(),
      });

      expect(res.statusCode).toBe(200);

      const body = JSON.parse(res.payload);
      expect(body.data).toHaveLength(2);
    });
  });

  describe('Weight', () => {
    it('should add a weight entry and update pet weight', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/pets/${pet.id}/weight`,
        headers: headers(),
        payload: {
          date: '2026-03-30T10:00:00.000Z',
          value: 12.5,
        },
      });

      expect(res.statusCode).toBe(201);

      const body = JSON.parse(res.payload);
      expect(body.data.value).toBe(12.5);

      // Verify pet weight was updated
      const updatedPet = await prisma.pet.findUnique({ where: { id: pet.id } });
      expect(updatedPet.weight).toBe(12.5);
    });

    it('should return weight history', async () => {
      await prisma.weightEntry.createMany({
        data: [
          { petId: pet.id, date: new Date('2026-01-01'), value: 10 },
          { petId: pet.id, date: new Date('2026-02-01'), value: 11 },
          { petId: pet.id, date: new Date('2026-03-01'), value: 12 },
        ],
      });

      const res = await app.inject({
        method: 'GET',
        url: `/pets/${pet.id}/weight`,
        headers: headers(),
      });

      expect(res.statusCode).toBe(200);

      const body = JSON.parse(res.payload);
      expect(body.data).toHaveLength(3);
      expect(body.meta.plan).toBe('FREE');
    });

    it('should limit weight history to 3 months for FREE plan', async () => {
      await prisma.weightEntry.createMany({
        data: [
          { petId: pet.id, date: new Date('2025-06-01'), value: 8 },  // old
          { petId: pet.id, date: new Date('2025-09-01'), value: 9 },  // old
          { petId: pet.id, date: new Date('2026-02-01'), value: 11 }, // recent
          { petId: pet.id, date: new Date('2026-03-01'), value: 12 }, // recent
        ],
      });

      const res = await app.inject({
        method: 'GET',
        url: `/pets/${pet.id}/weight`,
        headers: headers(),
      });

      const body = JSON.parse(res.payload);
      // Only entries within last 3 months should be returned
      expect(body.data.length).toBeLessThanOrEqual(3);
      expect(body.meta.limited).toBe(true);
    });

    it('should return full weight history for PREMIUM plan', async () => {
      const premiumUser = await createTestUser({ email: 'premium-food@example.com', plan: 'PREMIUM' });
      const premiumPet = await createTestPet(premiumUser.id, { name: 'Luna' });

      await prisma.weightEntry.createMany({
        data: [
          { petId: premiumPet.id, date: new Date('2024-01-01'), value: 5 },
          { petId: premiumPet.id, date: new Date('2025-01-01'), value: 8 },
          { petId: premiumPet.id, date: new Date('2026-01-01'), value: 10 },
          { petId: premiumPet.id, date: new Date('2026-03-01'), value: 12 },
        ],
      });

      const res = await app.inject({
        method: 'GET',
        url: `/pets/${premiumPet.id}/weight`,
        headers: headers(premiumUser),
      });

      const body = JSON.parse(res.payload);
      expect(body.data).toHaveLength(4);
      expect(body.meta.limited).toBe(false);
    });
  });
});
