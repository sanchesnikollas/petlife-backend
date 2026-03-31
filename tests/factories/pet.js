import { prisma } from '../setup.js';

let petCounter = 0;

export async function createTestPet(userId, overrides = {}) {
  petCounter++;
  const pet = await prisma.pet.create({
    data: {
      userId,
      name: overrides.name || `Pet ${petCounter}`,
      species: overrides.species || 'DOG',
      breed: overrides.breed || 'Golden Retriever',
      weight: overrides.weight || 10.0,
      ...overrides,
    },
  });

  await prisma.foodConfig.create({ data: { petId: pet.id } });
  return pet;
}
