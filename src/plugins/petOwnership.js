import fp from 'fastify-plugin';
import { prisma } from '../lib/prisma.js';

function petOwnershipPlugin(fastify, _opts, done) {
  fastify.decorate('verifyPetOwnership', async (request, reply) => {
    const petId = request.params.petId;
    if (!petId) return;

    const pet = await prisma.pet.findUnique({
      where: { id: petId },
      select: { userId: true, deletedAt: true },
    });

    if (!pet || pet.deletedAt) {
      reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Pet not found' } });
      return;
    }

    if (pet.userId !== request.user.id) {
      reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'You do not own this pet' } });
      return;
    }
  });
  done();
}

export default fp(petOwnershipPlugin, { name: 'pet-ownership' });
