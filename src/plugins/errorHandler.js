import fp from 'fastify-plugin';

class AppError extends Error {
  constructor(statusCode, code, message, fields = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.fields = fields;
  }
}

function errorHandlerPlugin(fastify, _opts, done) {
  fastify.setErrorHandler((error, request, reply) => {
    const statusCode = error.statusCode || 500;
    const code = error.code || 'INTERNAL_ERROR';
    const message = statusCode === 500 && process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : error.message;

    const response = {
      error: {
        code,
        message,
      },
    };

    if (error.fields) {
      response.error.fields = error.fields;
    }

    if (statusCode === 500) {
      request.log.error(error);
    }

    reply.status(statusCode).send(response);
  });

  done();
}

export default fp(errorHandlerPlugin, { name: 'error-handler' });
export { AppError };
