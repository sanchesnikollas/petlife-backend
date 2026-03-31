import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import errorHandler from './plugins/errorHandler.js';
import authPlugin from './plugins/auth.js';
import corsPlugin from './plugins/cors.js';
import rateLimitPlugin from './plugins/rateLimit.js';

export function buildApp(opts = {}) {
  const app = Fastify({
    logger: opts.logger ?? (process.env.NODE_ENV !== 'test'),
    ...opts,
  });

  app.register(errorHandler);
  app.register(corsPlugin);
  app.register(cookie, {
    secret: process.env.JWT_REFRESH_SECRET || 'dev-cookie-secret',
    parseOptions: {},
  });

  if (process.env.NODE_ENV !== 'test') {
    app.register(rateLimitPlugin);
  }

  app.register(authPlugin);

  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  return app;
}

async function start() {
  const port = parseInt(process.env.PORT || '3001', 10);
  const host = '0.0.0.0';
  const app = buildApp();

  try {
    await app.listen({ port, host });
    console.log(`PetLife API running on http://${host}:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

const isMainModule = process.argv[1] &&
  (process.argv[1] === new URL(import.meta.url).pathname ||
   process.argv[1].endsWith('/src/server.js'));

if (isMainModule) {
  start();
}
