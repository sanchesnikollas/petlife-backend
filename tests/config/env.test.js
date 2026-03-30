import { describe, it, expect } from 'vitest';
import { loadEnvFromValues } from '../../src/config/env.js';

describe('env config', () => {
  it('should load with valid defaults', () => {
    const env = loadEnvFromValues({
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://localhost:5432/petlife',
      FRONTEND_URL: 'http://localhost:5173',
    });

    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3001);
    expect(env.JWT_SECRET).toBe('dev-jwt-secret-change-me');
  });

  it('should throw on invalid DATABASE_URL', () => {
    expect(() => loadEnvFromValues({
      DATABASE_URL: 'not-a-url',
      FRONTEND_URL: 'http://localhost:5173',
    })).toThrow('Invalid environment variables');
  });

  it('should throw on JWT_SECRET too short', () => {
    expect(() => loadEnvFromValues({
      JWT_SECRET: 'short',
      DATABASE_URL: 'postgresql://localhost:5432/petlife',
      FRONTEND_URL: 'http://localhost:5173',
    })).toThrow('Invalid environment variables');
  });
});
