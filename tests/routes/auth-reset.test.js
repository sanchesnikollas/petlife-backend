import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildApp } from '../../src/server.js';
import { prisma } from '../setup.js';
import { createTestUser } from '../factories/user.js';
import crypto from 'node:crypto';

// Mock the email module
vi.mock('../../src/utils/email.js', () => ({
  sendResetEmail: vi.fn().mockResolvedValue({ id: 'mock-id' }),
  setResendClient: vi.fn(),
}));

describe('Auth Reset Routes', () => {
  let app;

  beforeEach(async () => {
    app = buildApp({ logger: false });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /auth/forgot', () => {
    it('should return 200 for existing email', async () => {
      await createTestUser({ email: 'forgot@example.com' });

      const res = await app.inject({
        method: 'POST',
        url: '/auth/forgot',
        payload: { email: 'forgot@example.com' },
      });

      expect(res.statusCode).toBe(200);

      const body = JSON.parse(res.payload);
      expect(body.data.message).toContain('reset link');
    });

    it('should return 200 for non-existent email (security)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/forgot',
        payload: { email: 'nobody@example.com' },
      });

      expect(res.statusCode).toBe(200);

      const body = JSON.parse(res.payload);
      expect(body.data.message).toContain('reset link');
    });

    it('should store a hashed reset token in the database', async () => {
      await createTestUser({ email: 'tokencheck@example.com' });

      await app.inject({
        method: 'POST',
        url: '/auth/forgot',
        payload: { email: 'tokencheck@example.com' },
      });

      const user = await prisma.user.findUnique({
        where: { email: 'tokencheck@example.com' },
      });

      expect(user.resetToken).toBeDefined();
      expect(user.resetToken).not.toBeNull();
      expect(user.resetTokenExpiry).toBeDefined();
      expect(new Date(user.resetTokenExpiry).getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('POST /auth/reset', () => {
    it('should reset password with valid token', async () => {
      const user = await createTestUser({ email: 'reset@example.com' });

      // Manually create a reset token
      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetToken: tokenHash,
          resetTokenExpiry: new Date(Date.now() + 3600000),
        },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/auth/reset',
        payload: {
          token,
          newPassword: 'NewSecurePass456',
        },
      });

      expect(res.statusCode).toBe(200);

      // Verify can login with new password
      const loginRes = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          email: 'reset@example.com',
          password: 'NewSecurePass456',
        },
      });

      expect(loginRes.statusCode).toBe(200);
    });

    it('should return 400 for expired token', async () => {
      const user = await createTestUser({ email: 'expired@example.com' });

      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetToken: tokenHash,
          resetTokenExpiry: new Date(Date.now() - 1000), // expired
        },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/auth/reset',
        payload: {
          token,
          newPassword: 'NewPassword123',
        },
      });

      expect(res.statusCode).toBe(400);

      const body = JSON.parse(res.payload);
      expect(body.error.code).toBe('INVALID_TOKEN');
    });

    it('should return 400 for invalid token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/reset',
        payload: {
          token: 'totally-invalid-token',
          newPassword: 'NewPassword123',
        },
      });

      expect(res.statusCode).toBe(400);

      const body = JSON.parse(res.payload);
      expect(body.error.code).toBe('INVALID_TOKEN');
    });
  });
});
