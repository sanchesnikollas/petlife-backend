import { describe, it, expect } from 'vitest';
import { buildApp } from '../../src/server.js';
import { signAccessToken } from '../../src/utils/jwt.js';

describe('auth plugin', () => {
  function createApp() {
    const app = buildApp({ logger: false });
    app.get('/protected', async (request) => {
      return { user: request.user };
    });
    return app;
  }

  it('should allow access with valid token', async () => {
    const app = createApp();
    const token = signAccessToken({ id: 'user-1', email: 'test@example.com', plan: 'FREE' });

    const res = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.user.id).toBe('user-1');
    await app.close();
  });

  it('should return 401 when no token', async () => {
    const app = createApp();
    const res = await app.inject({ method: 'GET', url: '/protected' });
    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.payload);
    expect(body.error.code).toBe('UNAUTHORIZED');
    await app.close();
  });

  it('should return 401 for invalid token', async () => {
    const app = createApp();
    const res = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { authorization: 'Bearer invalid-token' },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('should skip auth for /health', async () => {
    const app = createApp();
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it('should skip auth for /auth/* routes', async () => {
    const app = buildApp({ logger: false });
    app.post('/auth/test', async () => ({ ok: true }));
    const res = await app.inject({ method: 'POST', url: '/auth/test' });
    expect(res.statusCode).toBe(200);
    await app.close();
  });
});
