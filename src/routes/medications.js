import { prisma } from '../lib/prisma.js';
import { createMedicationSchema, updateMedicationSchema, calculateHealthStatus } from '../schemas/health.js';
import { AppError } from '../plugins/errorHandler.js';

export default async function medicationsRoutes(fastify) {
  const opts = { preHandler: [fastify.verifyPetOwnership] };

  // GET /pets/:petId/medications
  fastify.get('/pets/:petId/medications', opts, async (request) => {
    const medications = await prisma.medication.findMany({
      where: { petId: request.params.petId },
      orderBy: { createdAt: 'desc' },
    });

    const withStatus = medications.map((m) => ({
      ...m,
      status: calculateHealthStatus(m.nextDue),
    }));

    return { data: withStatus };
  });

  // POST /pets/:petId/medications
  fastify.post('/pets/:petId/medications', opts, async (request, reply) => {
    const parsed = createMedicationSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid input',
        parsed.error.flatten().fieldErrors);
    }

    const data = {
      ...parsed.data,
      startDate: new Date(parsed.data.startDate),
      nextDue: parsed.data.nextDue ? new Date(parsed.data.nextDue) : null,
      petId: request.params.petId,
    };

    const medication = await prisma.medication.create({ data });

    await prisma.record.create({
      data: {
        petId: request.params.petId,
        date: data.startDate,
        type: 'MEDICATION',
        title: `Medicamento: ${data.name}`,
        description: data.dose ? `Dose: ${data.dose}` : null,
      },
    });

    return reply.status(201).send({
      data: {
        ...medication,
        status: calculateHealthStatus(medication.nextDue),
      },
    });
  });

  // PATCH /pets/:petId/medications/:id
  fastify.patch('/pets/:petId/medications/:id', opts, async (request) => {
    const parsed = updateMedicationSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid input',
        parsed.error.flatten().fieldErrors);
    }

    const existing = await prisma.medication.findFirst({
      where: { id: request.params.id, petId: request.params.petId },
    });

    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Medication not found');
    }

    const data = { ...parsed.data };
    if (data.startDate) data.startDate = new Date(data.startDate);
    if (data.nextDue) data.nextDue = new Date(data.nextDue);

    const medication = await prisma.medication.update({
      where: { id: request.params.id },
      data,
    });

    return {
      data: {
        ...medication,
        status: calculateHealthStatus(medication.nextDue),
      },
    };
  });

  // DELETE /pets/:petId/medications/:id
  fastify.delete('/pets/:petId/medications/:id', opts, async (request) => {
    const existing = await prisma.medication.findFirst({
      where: { id: request.params.id, petId: request.params.petId },
    });

    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Medication not found');
    }

    await prisma.medication.delete({ where: { id: request.params.id } });

    return { data: { message: 'Medication removed' } };
  });
}
