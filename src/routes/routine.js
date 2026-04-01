import { prisma } from '../lib/prisma.js';
import { updateRoutineSchema } from '../schemas/routine.js';
import { AppError } from '../plugins/errorHandler.js';

export default async function routineRoutes(fastify) {
  const opts = { preHandler: [fastify.verifyPetOwnership] };

  // GET /pets/:petId/routine
  fastify.get('/pets/:petId/routine', opts, async (request) => {
    let routine = await prisma.petRoutine.findUnique({
      where: { petId: request.params.petId },
    });

    if (!routine) {
      routine = await prisma.petRoutine.create({
        data: { petId: request.params.petId },
      });
    }

    return { data: routine };
  });

  // PATCH /pets/:petId/routine
  fastify.patch('/pets/:petId/routine', opts, async (request) => {
    const parsed = updateRoutineSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid input',
        parsed.error.flatten().fieldErrors);
    }

    let routine = await prisma.petRoutine.findUnique({
      where: { petId: request.params.petId },
    });

    if (!routine) {
      routine = await prisma.petRoutine.create({
        data: { petId: request.params.petId, ...parsed.data },
      });
    } else {
      routine = await prisma.petRoutine.update({
        where: { petId: request.params.petId },
        data: parsed.data,
      });
    }

    return { data: routine };
  });
}
