import { prisma } from '../lib/prisma.js';
import { createVaccineSchema, updateVaccineSchema, calculateHealthStatus } from '../schemas/health.js';
import { AppError } from '../plugins/errorHandler.js';

export default async function vaccinesRoutes(fastify) {
  const opts = { preHandler: [fastify.verifyPetOwnership] };

  // GET /pets/:petId/vaccines
  fastify.get('/pets/:petId/vaccines', opts, async (request) => {
    const vaccines = await prisma.vaccine.findMany({
      where: { petId: request.params.petId },
      orderBy: { nextDue: 'asc' },
    });

    const withStatus = vaccines.map((v) => ({
      ...v,
      status: calculateHealthStatus(v.nextDue),
    }));

    return { data: withStatus };
  });

  // POST /pets/:petId/vaccines
  fastify.post('/pets/:petId/vaccines', opts, async (request, reply) => {
    const parsed = createVaccineSchema.safeParse(request.body);
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

    const vaccine = await prisma.vaccine.create({ data });

    // Auto-create record entry
    await prisma.record.create({
      data: {
        petId: request.params.petId,
        date: data.lastDone,
        type: 'VACCINE',
        title: `Vacina: ${data.name}`,
        description: data.clinic ? `Clinica: ${data.clinic}` : null,
      },
    });

    return reply.status(201).send({
      data: {
        ...vaccine,
        status: calculateHealthStatus(vaccine.nextDue),
      },
    });
  });

  // PATCH /pets/:petId/vaccines/:id
  fastify.patch('/pets/:petId/vaccines/:id', opts, async (request) => {
    const parsed = updateVaccineSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid input',
        parsed.error.flatten().fieldErrors);
    }

    const existing = await prisma.vaccine.findFirst({
      where: { id: request.params.id, petId: request.params.petId },
    });

    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Vaccine not found');
    }

    const data = { ...parsed.data };
    if (data.lastDone) data.lastDone = new Date(data.lastDone);
    if (data.nextDue) data.nextDue = new Date(data.nextDue);

    const vaccine = await prisma.vaccine.update({
      where: { id: request.params.id },
      data,
    });

    return {
      data: {
        ...vaccine,
        status: calculateHealthStatus(vaccine.nextDue),
      },
    };
  });

  // DELETE /pets/:petId/vaccines/:id
  fastify.delete('/pets/:petId/vaccines/:id', opts, async (request) => {
    const existing = await prisma.vaccine.findFirst({
      where: { id: request.params.id, petId: request.params.petId },
    });

    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Vaccine not found');
    }

    await prisma.vaccine.delete({ where: { id: request.params.id } });

    return { data: { message: 'Vaccine removed' } };
  });
}
