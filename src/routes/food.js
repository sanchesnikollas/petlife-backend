import { prisma } from '../lib/prisma.js';
import { updateFoodConfigSchema, createMealLogSchema, createWeightEntrySchema } from '../schemas/food.js';
import { AppError } from '../plugins/errorHandler.js';

export default async function foodRoutes(fastify) {
  const opts = { preHandler: [fastify.verifyPetOwnership] };

  // ─── Food Config ─────────────────────────────────────

  // GET /pets/:petId/food
  fastify.get('/pets/:petId/food', opts, async (request) => {
    let config = await prisma.foodConfig.findUnique({
      where: { petId: request.params.petId },
    });

    if (!config) {
      config = await prisma.foodConfig.create({
        data: { petId: request.params.petId },
      });
    }

    return { data: config };
  });

  // PATCH /pets/:petId/food
  fastify.patch('/pets/:petId/food', opts, async (request) => {
    const parsed = updateFoodConfigSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid input',
        parsed.error.flatten().fieldErrors);
    }

    let config = await prisma.foodConfig.findUnique({
      where: { petId: request.params.petId },
    });

    if (!config) {
      config = await prisma.foodConfig.create({
        data: { petId: request.params.petId, ...parsed.data },
      });
    } else {
      config = await prisma.foodConfig.update({
        where: { petId: request.params.petId },
        data: parsed.data,
      });
    }

    return { data: config };
  });

  // ─── Meal Logs ───────────────────────────────────────

  // GET /pets/:petId/meals?date=YYYY-MM-DD
  fastify.get('/pets/:petId/meals', opts, async (request) => {
    const { date } = request.query;

    const where = { petId: request.params.petId };

    if (date) {
      const start = new Date(`${date}T00:00:00.000Z`);
      const end = new Date(`${date}T23:59:59.999Z`);
      where.date = { gte: start, lte: end };
    }

    const meals = await prisma.mealLog.findMany({
      where,
      orderBy: { date: 'desc' },
    });

    return { data: meals };
  });

  // POST /pets/:petId/meals
  fastify.post('/pets/:petId/meals', opts, async (request, reply) => {
    const parsed = createMealLogSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid input',
        parsed.error.flatten().fieldErrors);
    }

    const meal = await prisma.mealLog.create({
      data: {
        petId: request.params.petId,
        date: new Date(parsed.data.date),
        time: parsed.data.time,
        given: parsed.data.given,
      },
    });

    return reply.status(201).send({ data: meal });
  });

  // ─── Weight ──────────────────────────────────────────

  // GET /pets/:petId/weight
  fastify.get('/pets/:petId/weight', opts, async (request) => {
    const plan = request.user.plan;

    const where = { petId: request.params.petId };

    // Freemium gate: FREE plan only gets last 3 months
    if (plan === 'FREE') {
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      where.date = { gte: threeMonthsAgo };
    }

    const entries = await prisma.weightEntry.findMany({
      where,
      orderBy: { date: 'desc' },
    });

    return {
      data: entries,
      meta: {
        limited: plan === 'FREE',
        plan,
      },
    };
  });

  // POST /pets/:petId/weight
  fastify.post('/pets/:petId/weight', opts, async (request, reply) => {
    const parsed = createWeightEntrySchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid input',
        parsed.error.flatten().fieldErrors);
    }

    const entry = await prisma.weightEntry.create({
      data: {
        petId: request.params.petId,
        date: new Date(parsed.data.date),
        value: parsed.data.value,
      },
    });

    // Also update pet's current weight
    await prisma.pet.update({
      where: { id: request.params.petId },
      data: { weight: parsed.data.value },
    });

    return reply.status(201).send({ data: entry });
  });
}
