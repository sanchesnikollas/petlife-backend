import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import errorHandler, { AppError } from '../../src/plugins/errorHandler.js';

describe('errorHandler plugin', () => {
  function buildTestApp() {
    const app = Fastify({ logger: false });
    app.register(errorHandler);
    return app;
  }

  it('should format AppError with custom code and status', async () => {
    const app = buildTestApp();
    app.get('/fail', async () => {
      throw new AppError(400, 'VALIDATION_ERROR', 'Email is required', { email: 'Required' });
    });

    const res = await app.inject({ method: 'GET', url: '/fail' });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toBe('Email is required');
    expect(body.error.fields).toEqual({ email: 'Required' });
    await app.close();
  });

  it('should handle generic Error as 500', async () => {
    const app = buildTestApp();
    app.get('/crash', async () => { throw new Error('Something broke'); });

    const res = await app.inject({ method: 'GET', url: '/crash' });
    expect(res.statusCode).toBe(500);
    const body = JSON.parse(res.payload);
    expect(body.error.code).toBe('INTERNAL_ERROR');
    await app.close();
  });

  it('should return standard JSON format for all errors', async () => {
    const app = buildTestApp();
    app.get('/not-found', async () => {
      throw new AppError(404, 'NOT_FOUND', 'Resource not found');
    });

    const res = await app.inject({ method: 'GET', url: '/not-found' });
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body).toHaveProperty('error');
    expect(body.error).toHaveProperty('code');
    expect(body.error).toHaveProperty('message');
    await app.close();
  });
});
