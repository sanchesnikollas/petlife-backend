import { prisma } from '../lib/prisma.js';
import { createConsultationSchema, updateConsultationSchema } from '../schemas/health.js';
import { AppError } from '../plugins/errorHandler.js';

export default async function consultationsRoutes(fastify) {
  const opts = { preHandler: [fastify.verifyPetOwnership] };

  // GET /pets/:petId/consultations
  fastify.get('/pets/:petId/consultations', opts, async (request) => {
    const consultations = await prisma.consultation.findMany({
      where: { petId: request.params.petId },
      orderBy: { date: 'desc' },
    });

    return { data: consultations };
  });

  // POST /pets/:petId/consultations
  fastify.post('/pets/:petId/consultations', opts, async (request, reply) => {
    const parsed = createConsultationSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid input',
        parsed.error.flatten().fieldErrors);
    }

    const data = {
      ...parsed.data,
      date: new Date(parsed.data.date),
      petId: request.params.petId,
    };

    const consultation = await prisma.consultation.create({ data });

    await prisma.record.create({
      data: {
        petId: request.params.petId,
        date: data.date,
        type: 'CONSULTATION',
        title: `Consulta${data.type ? `: ${data.type}` : ''}`,
        description: data.notes || null,
      },
    });

    return reply.status(201).send({ data: consultation });
  });

  // PATCH /pets/:petId/consultations/:id
  fastify.patch('/pets/:petId/consultations/:id', opts, async (request) => {
    const parsed = updateConsultationSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid input',
        parsed.error.flatten().fieldErrors);
    }

    const existing = await prisma.consultation.findFirst({
      where: { id: request.params.id, petId: request.params.petId },
    });

    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Consultation not found');
    }

    const data = { ...parsed.data };
    if (data.date) data.date = new Date(data.date);

    const consultation = await prisma.consultation.update({
      where: { id: request.params.id },
      data,
    });

    return { data: consultation };
  });

  // DELETE /pets/:petId/consultations/:id
  fastify.delete('/pets/:petId/consultations/:id', opts, async (request) => {
    const existing = await prisma.consultation.findFirst({
      where: { id: request.params.id, petId: request.params.petId },
    });

    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Consultation not found');
    }

    await prisma.consultation.delete({ where: { id: request.params.id } });

    return { data: { message: 'Consultation removed' } };
  });
}
