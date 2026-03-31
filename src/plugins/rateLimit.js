import fp from 'fastify-plugin';
import rateLimit from '@fastify/rate-limit';

function rateLimitPlugin(fastify, _opts, done) {
  fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    keyGenerator: (request) => request.ip,
    errorResponseBuilder: () => ({
      error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests. Please try again later.' },
    }),
  });
  done();
}

export default fp(rateLimitPlugin, { name: 'rate-limit' });
