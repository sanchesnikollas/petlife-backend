import { describe, it, expect } from 'vitest';
import { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken } from '../../src/utils/jwt.js';
import jwt from 'jsonwebtoken';

describe('JWT utils', () => {
  const payload = { id: 'user-123', email: 'test@example.com', plan: 'FREE' };

  it('should sign and verify access token', () => {
    const token = signAccessToken(payload);
    const decoded = verifyAccessToken(token);
    expect(decoded.id).toBe(payload.id);
    expect(decoded.email).toBe(payload.email);
    expect(decoded.exp).toBeDefined();
  });

  it('should sign and verify refresh token', () => {
    const token = signRefreshToken(payload);
    const decoded = verifyRefreshToken(token);
    expect(decoded.id).toBe(payload.id);
  });

  it('should reject expired token', () => {
    const secret = process.env.JWT_SECRET || 'dev-jwt-secret-change-me';
    const token = jwt.sign(payload, secret, { expiresIn: '0s' });
    expect(() => verifyAccessToken(token)).toThrow();
  });

  it('should reject wrong secret', () => {
    const token = jwt.sign(payload, 'wrong-secret-key-1234567890');
    expect(() => verifyAccessToken(token)).toThrow();
  });

  it('should reject cross-verification', () => {
    const accessToken = signAccessToken(payload);
    expect(() => verifyRefreshToken(accessToken)).toThrow();
  });

  it('should reject malformed token', () => {
    expect(() => verifyAccessToken('not.a.token')).toThrow();
    expect(() => verifyRefreshToken('garbage')).toThrow();
  });
});
