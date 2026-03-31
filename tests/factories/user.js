import { prisma } from '../setup.js';
import { hashPassword } from '../../src/utils/password.js';

let userCounter = 0;

export async function createTestUser(overrides = {}) {
  userCounter++;
  const password = overrides.password || 'TestPass123';
  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      name: overrides.name || `Test User ${userCounter}`,
      email: overrides.email || `test${userCounter}@example.com`,
      passwordHash,
      plan: overrides.plan || 'FREE',
      ...overrides,
      password: undefined, // remove plain password from data
    },
  });

  return { ...user, plainPassword: password };
}
