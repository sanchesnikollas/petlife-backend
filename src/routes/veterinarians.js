import { prisma } from '../lib/prisma.js';
import { createVeterinarianSchema, updateVeterinarianSchema } from '../schemas/veterinarians.js';
import { AppError } from '../plugins/errorHandler.js';

export default async function veterinariansRoutes(fastify) {
  // GET /veterinarians
  fastify.get('/veterinarians', async (request) => {
    const vets = await prisma.veterinarian.findMany({
      where: { userId: request.user.id },
      orderBy: { name: 'asc' },
    });

    return { data: vets };
  });

  // POST /veterinarians
  fastify.post('/veterinarians', async (request, reply) => {
    const parsed = createVeterinarianSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid input',
        parsed.error.flatten().fieldErrors);
    }

    const vet = await prisma.veterinarian.create({
      data: {
        userId: request.user.id,
        ...parsed.data,
      },
    });

    return reply.status(201).send({ data: vet });
  });

  // PATCH /veterinarians/:id
  fastify.patch('/veterinarians/:id', async (request) => {
    const parsed = updateVeterinarianSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid input',
        parsed.error.flatten().fieldErrors);
    }

    const existing = await prisma.veterinarian.findUnique({
      where: { id: request.params.id },
    });

    if (!existing || existing.userId !== request.user.id) {
      throw new AppError(404, 'NOT_FOUND', 'Veterinarian not found');
    }

    const vet = await prisma.veterinarian.update({
      where: { id: request.params.id },
      data: parsed.data,
    });

    return { data: vet };
  });

  // DELETE /veterinarians/:id
  fastify.delete('/veterinarians/:id', async (request, reply) => {
    const existing = await prisma.veterinarian.findUnique({
      where: { id: request.params.id },
    });

    if (!existing || existing.userId !== request.user.id) {
      throw new AppError(404, 'NOT_FOUND', 'Veterinarian not found');
    }

    await prisma.veterinarian.delete({
      where: { id: request.params.id },
    });

    return reply.status(204).send();
  });
}
