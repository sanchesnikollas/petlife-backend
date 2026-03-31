import { describe, it, expect } from 'vitest';
import { hashPassword, comparePassword } from '../../src/utils/password.js';

describe('password utils', () => {
  it('should hash and verify correctly', async () => {
    const plain = 'MySecureP@ss123';
    const hash = await hashPassword(plain);
    expect(hash).not.toBe(plain);
    expect(hash).toMatch(/^\$2[aby]\$/);
    const isValid = await comparePassword(plain, hash);
    expect(isValid).toBe(true);
  });

  it('should reject wrong password', async () => {
    const hash = await hashPassword('correctPassword');
    const isValid = await comparePassword('wrongPassword', hash);
    expect(isValid).toBe(false);
  });

  it('should produce different hashes for same input', async () => {
    const hash1 = await hashPassword('samePassword123');
    const hash2 = await hashPassword('samePassword123');
    expect(hash1).not.toBe(hash2);
  });
});
