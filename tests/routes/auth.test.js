import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildApp } from '../../src/server.js';
import { prisma } from '../setup.js';
import { createTestUser } from '../factories/user.js';

describe('Auth Routes', () => {
  let app;

  beforeEach(async () => {
    app = buildApp({ logger: false });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /auth/register', () => {
    it('should register a new user and return tokens', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          name: 'Maria Silva',
          email: 'maria@example.com',
          password: 'SecurePass123',
        },
      });

      expect(res.statusCode).toBe(201);

      const body = JSON.parse(res.payload);
      expect(body.data.accessToken).toBeDefined();
      expect(body.data.user.name).toBe('Maria Silva');
      expect(body.data.user.email).toBe('maria@example.com');
      expect(body.data.user.plan).toBe('FREE');
      expect(body.data.user.passwordHash).toBeUndefined();

      // Check cookie was set
      const cookies = res.cookies;
      const refreshCookie = cookies.find(c => c.name === 'refreshToken');
      expect(refreshCookie).toBeDefined();
      expect(refreshCookie.httpOnly).toBe(true);
    });

    it('should return 409 when email already exists', async () => {
      await createTestUser({ email: 'taken@example.com' });

      const res = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          name: 'Another User',
          email: 'taken@example.com',
          password: 'SecurePass123',
        },
      });

      expect(res.statusCode).toBe(409);

      const body = JSON.parse(res.payload);
      expect(body.error.code).toBe('EMAIL_EXISTS');
    });

    it('should return 400 for invalid input', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          name: '',
          email: 'not-email',
          password: 'short',
        },
      });

      expect(res.statusCode).toBe(400);

      const body = JSON.parse(res.payload);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.fields).toBeDefined();
    });
  });

  describe('POST /auth/login', () => {
    it('should login with valid credentials', async () => {
      const user = await createTestUser({
        email: 'login@example.com',
        password: 'MyPassword123',
      });

      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          email: 'login@example.com',
          password: 'MyPassword123',
        },
      });

      expect(res.statusCode).toBe(200);

      const body = JSON.parse(res.payload);
      expect(body.data.accessToken).toBeDefined();
      expect(body.data.user.email).toBe('login@example.com');
    });

    it('should return 401 for wrong password', async () => {
      await createTestUser({
        email: 'login2@example.com',
        password: 'CorrectPass123',
      });

      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          email: 'login2@example.com',
          password: 'WrongPassword',
        },
      });

      expect(res.statusCode).toBe(401);

      const body = JSON.parse(res.payload);
      expect(body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should return 401 for non-existent email', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          email: 'nobody@example.com',
          password: 'SomePassword123',
        },
      });

      expect(res.statusCode).toBe(401);
    });
  });

  describe('POST /auth/refresh', () => {
    it('should rotate tokens when valid refresh cookie is sent', async () => {
      // First register to get a refresh token
      const registerRes = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          name: 'Refresh User',
          email: 'refresh@example.com',
          password: 'SecurePass123',
        },
      });

      const refreshCookie = registerRes.cookies.find(c => c.name === 'refreshToken');

      const res = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        cookies: {
          refreshToken: refreshCookie.value,
        },
      });

      expect(res.statusCode).toBe(200);

      const body = JSON.parse(res.payload);
      expect(body.data.accessToken).toBeDefined();

      // New refresh cookie should be set
      const newRefreshCookie = res.cookies.find(c => c.name === 'refreshToken');
      expect(newRefreshCookie).toBeDefined();
      expect(newRefreshCookie.value).not.toBe(refreshCookie.value);
    });

    it('should return 401 when no refresh cookie exists', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
      });

      expect(res.statusCode).toBe(401);
    });
  });

  describe('DELETE /auth/logout', () => {
    it('should clear refresh cookie', async () => {
      const registerRes = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          name: 'Logout User',
          email: 'logout@example.com',
          password: 'SecurePass123',
        },
      });

      const body = JSON.parse(registerRes.payload);

      const res = await app.inject({
        method: 'DELETE',
        url: '/auth/logout',
        headers: {
          authorization: `Bearer ${body.data.accessToken}`,
        },
      });

      expect(res.statusCode).toBe(200);

      // Verify refresh token cleared in DB
      const user = await prisma.user.findUnique({
        where: { email: 'logout@example.com' },
      });
      expect(user.refreshToken).toBeNull();
    });
  });
});
