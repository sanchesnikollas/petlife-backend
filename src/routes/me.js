import { updateProfileSchema } from '../schemas/me.js';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../plugins/errorHandler.js';

export default async function meRoutes(fastify) {
  // GET /me
  fastify.get('/me', async (request) => {
    const user = await prisma.user.findUnique({
      where: { id: request.user.id },
      select: { id: true, name: true, email: true, phone: true, avatarUrl: true, plan: true, createdAt: true },
    });
    if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found');
    return { data: user };
  });

  // PATCH /me
  fastify.patch('/me', async (request) => {
    const parsed = updateProfileSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid input', parsed.error.flatten().fieldErrors);
    }
    const user = await prisma.user.update({
      where: { id: request.user.id },
      data: parsed.data,
      select: { id: true, name: true, email: true, phone: true, avatarUrl: true, plan: true },
    });
    return { data: user };
  });

  // DELETE /me (soft delete)
  fastify.delete('/me', async (request) => {
    await prisma.user.update({
      where: { id: request.user.id },
      data: { deletedAt: new Date() },
    });
    return { data: { message: 'Account deleted' } };
  });
}
