import { createPetSchema, updatePetSchema } from '../schemas/pets.js';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../plugins/errorHandler.js';

export default async function petRoutes(fastify) {
  // GET /pets
  fastify.get('/pets', async (request) => {
    const pets = await prisma.pet.findMany({
      where: { userId: request.user.id, deletedAt: null },
      include: { foodConfig: true },
      orderBy: { createdAt: 'asc' },
    });
    return { data: pets };
  });

  // POST /pets (with freemium limit)
  fastify.post('/pets', async (request) => {
    const parsed = createPetSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid input', parsed.error.flatten().fieldErrors);
    }

    // Freemium: max 2 pets on FREE plan
    if (request.user.plan === 'FREE') {
      const count = await prisma.pet.count({ where: { userId: request.user.id, deletedAt: null } });
      if (count >= 2) {
        throw new AppError(403, 'PLAN_REQUIRED', 'Free plan allows up to 2 pets. Upgrade to Premium for unlimited pets.', { feature: 'unlimited_pets' });
      }
    }

    const data = { ...parsed.data, userId: request.user.id };
    if (data.birthDate) data.birthDate = new Date(data.birthDate);

    const pet = await prisma.pet.create({ data });

    // Auto-create food config
    await prisma.foodConfig.create({
      data: { petId: pet.id },
    });

    const fullPet = await prisma.pet.findUnique({
      where: { id: pet.id },
      include: { foodConfig: true },
    });

    return { data: fullPet };
  });

  // GET /pets/:petId
  fastify.get('/pets/:petId', { preHandler: [fastify.verifyPetOwnership] }, async (request) => {
    const pet = await prisma.pet.findUnique({
      where: { id: request.params.petId },
      include: {
        foodConfig: true,
        vaccines: true,
        medications: { where: { active: true } },
      },
    });
    return { data: pet };
  });

  // PATCH /pets/:petId
  fastify.patch('/pets/:petId', { preHandler: [fastify.verifyPetOwnership] }, async (request) => {
    const parsed = updatePetSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid input', parsed.error.flatten().fieldErrors);
    }

    const data = { ...parsed.data };
    if (data.birthDate) data.birthDate = new Date(data.birthDate);

    const pet = await prisma.pet.update({
      where: { id: request.params.petId },
      data,
      include: { foodConfig: true },
    });
    return { data: pet };
  });

  // DELETE /pets/:petId (soft delete)
  fastify.delete('/pets/:petId', { preHandler: [fastify.verifyPetOwnership] }, async (request) => {
    await prisma.pet.update({
      where: { id: request.params.petId },
      data: { deletedAt: new Date() },
    });
    return { data: { message: 'Pet removed' } };
  });
}
