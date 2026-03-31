import fp from 'fastify-plugin';
import cors from '@fastify/cors';

function corsPlugin(fastify, _opts, done) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  fastify.register(cors, {
    origin: [frontendUrl],
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  done();
}

export default fp(corsPlugin, { name: 'cors' });
