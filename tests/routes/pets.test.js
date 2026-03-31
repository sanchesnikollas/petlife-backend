import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildApp } from '../../src/server.js';
import { createTestUser } from '../factories/user.js';
import { createTestPet } from '../factories/pet.js';
import { signAccessToken } from '../../src/utils/jwt.js';

describe('Pets Routes', () => {
  let app;
  beforeEach(async () => { app = buildApp({ logger: false }); await app.ready(); });
  afterEach(async () => { await app.close(); });

  async function auth(overrides = {}) {
    const user = await createTestUser(overrides);
    const token = signAccessToken({ id: user.id, email: user.email, plan: user.plan || 'FREE' });
    return { token, user, headers: { authorization: `Bearer ${token}` } };
  }

  describe('GET /pets', () => {
    it('should return empty list for new user', async () => {
      const { headers } = await auth();
      const res = await app.inject({ method: 'GET', url: '/pets', headers });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload).data).toEqual([]);
    });

    it('should return user pets', async () => {
      const { headers, user } = await auth();
      await createTestPet(user.id, { name: 'Luna' });
      const res = await app.inject({ method: 'GET', url: '/pets', headers });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].name).toBe('Luna');
    });
  });

  describe('POST /pets', () => {
    it('should create a pet', async () => {
      const { headers } = await auth();
      const res = await app.inject({
        method: 'POST', url: '/pets', headers,
        payload: { name: 'Thor', species: 'DOG', breed: 'Labrador', weight: 25 },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.data.name).toBe('Thor');
      expect(body.data.foodConfig).toBeDefined();
    });

    it('should enforce 2 pet limit on FREE plan', async () => {
      const { headers, user } = await auth();
      await createTestPet(user.id);
      await createTestPet(user.id);
      const res = await app.inject({
        method: 'POST', url: '/pets', headers,
        payload: { name: 'Third', species: 'CAT' },
      });
      expect(res.statusCode).toBe(403);
      expect(JSON.parse(res.payload).error.code).toBe('PLAN_REQUIRED');
    });
  });

  describe('GET /pets/:petId', () => {
    it('should return pet detail', async () => {
      const { headers, user } = await auth();
      const pet = await createTestPet(user.id, { name: 'Milo' });
      const res = await app.inject({ method: 'GET', url: `/pets/${pet.id}`, headers });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload).data.name).toBe('Milo');
    });

    it('should return 403 for other users pet', async () => {
      const { headers } = await auth({ email: 'owner1@test.com' });
      const other = await createTestUser({ email: 'owner2@test.com' });
      const pet = await createTestPet(other.id);
      const res = await app.inject({ method: 'GET', url: `/pets/${pet.id}`, headers });
      expect(res.statusCode).toBe(403);
    });
  });

  describe('PATCH /pets/:petId', () => {
    it('should update pet', async () => {
      const { headers, user } = await auth();
      const pet = await createTestPet(user.id);
      const res = await app.inject({
        method: 'PATCH', url: `/pets/${pet.id}`, headers,
        payload: { name: 'Updated Name', weight: 30 },
      });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.payload).data.name).toBe('Updated Name');
    });
  });

  describe('DELETE /pets/:petId', () => {
    it('should soft delete pet', async () => {
      const { headers, user } = await auth();
      const pet = await createTestPet(user.id);
      const res = await app.inject({ method: 'DELETE', url: `/pets/${pet.id}`, headers });
      expect(res.statusCode).toBe(200);
      // Verify soft deleted (not returned in list)
      const listRes = await app.inject({ method: 'GET', url: '/pets', headers });
      expect(JSON.parse(listRes.payload).data).toHaveLength(0);
    });
  });
});
