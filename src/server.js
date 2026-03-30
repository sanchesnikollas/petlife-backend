import Fastify from 'fastify';

export function buildApp(opts = {}) {
  const app = Fastify({
    logger: opts.logger ?? (process.env.NODE_ENV !== 'test'),
    ...opts,
  });

  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  return app;
}

async function start() {
  const app = buildApp();
  const port = parseInt(process.env.PORT || '3001', 10);
  const host = '0.0.0.0';

  try {
    await app.listen({ port, host });
    console.log(`PetLife API running on http://${host}:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

const currentFile = new URL(import.meta.url).pathname;
if (process.argv[1] === currentFile) {
  start();
}
