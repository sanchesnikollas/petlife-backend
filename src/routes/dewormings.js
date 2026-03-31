import { prisma } from '../lib/prisma.js';
import { createDewormingSchema, updateDewormingSchema, calculateHealthStatus } from '../schemas/health.js';
import { AppError } from '../plugins/errorHandler.js';

export default async function dewormingsRoutes(fastify) {
  const opts = { preHandler: [fastify.verifyPetOwnership] };

  // GET /pets/:petId/dewormings
  fastify.get('/pets/:petId/dewormings', opts, async (request) => {
    const dewormings = await prisma.deworming.findMany({
      where: { petId: request.params.petId },
      orderBy: { nextDue: 'asc' },
    });

    const withStatus = dewormings.map((d) => ({
      ...d,
      status: calculateHealthStatus(d.nextDue),
    }));

    return { data: withStatus };
  });

  // POST /pets/:petId/dewormings
  fastify.post('/pets/:petId/dewormings', opts, async (request, reply) => {
    const parsed = createDewormingSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid input',
        parsed.error.flatten().fieldErrors);
    }

    const data = {
      ...parsed.data,
      lastDone: new Date(parsed.data.lastDone),
      nextDue: parsed.data.nextDue ? new Date(parsed.data.nextDue) : null,
      petId: request.params.petId,
    };

    const deworming = await prisma.deworming.create({ data });

    await prisma.record.create({
      data: {
        petId: request.params.petId,
        date: data.lastDone,
        type: 'DEWORMING',
        title: `Vermifugo: ${data.name}`,
        description: data.product ? `Produto: ${data.product}` : null,
      },
    });

    return reply.status(201).send({
      data: {
        ...deworming,
        status: calculateHealthStatus(deworming.nextDue),
      },
    });
  });

  // PATCH /pets/:petId/dewormings/:id
  fastify.patch('/pets/:petId/dewormings/:id', opts, async (request) => {
    const parsed = updateDewormingSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid input',
        parsed.error.flatten().fieldErrors);
    }

    const existing = await prisma.deworming.findFirst({
      where: { id: request.params.id, petId: request.params.petId },
    });

    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Deworming not found');
    }

    const data = { ...parsed.data };
    if (data.lastDone) data.lastDone = new Date(data.lastDone);
    if (data.nextDue) data.nextDue = new Date(data.nextDue);

    const deworming = await prisma.deworming.update({
      where: { id: request.params.id },
      data,
    });

    return {
      data: {
        ...deworming,
        status: calculateHealthStatus(deworming.nextDue),
      },
    };
  });

  // DELETE /pets/:petId/dewormings/:id
  fastify.delete('/pets/:petId/dewormings/:id', opts, async (request) => {
    const existing = await prisma.deworming.findFirst({
      where: { id: request.params.id, petId: request.params.petId },
    });

    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Deworming not found');
    }

    await prisma.deworming.delete({ where: { id: request.params.id } });

    return { data: { message: 'Deworming removed' } };
  });
}
