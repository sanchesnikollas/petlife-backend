import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildApp } from '../../src/server.js';
import { createTestUser } from '../factories/user.js';
import { signAccessToken } from '../../src/utils/jwt.js';

describe('User Profile Routes', () => {
  let app;
  beforeEach(async () => { app = buildApp({ logger: false }); await app.ready(); });
  afterEach(async () => { await app.close(); });

  async function authHeader(overrides = {}) {
    const user = await createTestUser(overrides);
    const token = signAccessToken({ id: user.id, email: user.email, plan: user.plan || 'FREE' });
    return { headers: { authorization: `Bearer ${token}` }, user };
  }

  describe('GET /me', () => {
    it('should return current user profile', async () => {
      const { headers } = await authHeader({ name: 'Test User', email: 'me@test.com' });
      const res = await app.inject({ method: 'GET', url: '/me', headers: headers });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.data.name).toBe('Test User');
      expect(body.data.email).toBe('me@test.com');
      expect(body.data.passwordHash).toBeUndefined();
    });

    it('should return 401 without token', async () => {
      const res = await app.inject({ method: 'GET', url: '/me' });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('PATCH /me', () => {
    it('should update name and phone', async () => {
      const { headers } = await authHeader();
      const res = await app.inject({
        method: 'PATCH', url: '/me', headers: headers,
        payload: { name: 'New Name', phone: '11999999999' },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.data.name).toBe('New Name');
      expect(body.data.phone).toBe('11999999999');
    });
  });

  describe('DELETE /me', () => {
    it('should soft delete account', async () => {
      const { headers, user } = await authHeader({ email: 'delete@test.com' });
      const res = await app.inject({ method: 'DELETE', url: '/me', headers: headers });
      expect(res.statusCode).toBe(200);
    });
  });
});
