import fp from 'fastify-plugin';
import { verifyAccessToken } from '../utils/jwt.js';

function authPlugin(fastify, _opts, done) {
  fastify.decorate('authenticate', async (request, reply) => {
    if (request.url.startsWith('/auth/') || request.url === '/health') {
      return;
    }

    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      reply.status(401).send({
        error: { code: 'UNAUTHORIZED', message: 'Missing or invalid authorization header' },
      });
      return;
    }

    const token = authHeader.slice(7);
    try {
      const decoded = verifyAccessToken(token);
      request.user = { id: decoded.id, email: decoded.email, plan: decoded.plan };
    } catch (err) {
      reply.status(401).send({
        error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' },
      });
    }
  });

  fastify.addHook('onRequest', async (request, reply) => {
    if (request.url.startsWith('/auth/') || request.url === '/health') {
      return;
    }
    await fastify.authenticate(request, reply);
  });

  done();
}

export default fp(authPlugin, { name: 'auth' });
