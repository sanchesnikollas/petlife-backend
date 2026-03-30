import { describe, it, expect } from 'vitest';
import { buildApp } from '../../src/server.js';

describe('GET /health', () => {
  it('should return 200 with status ok', async () => {
    const app = buildApp({ logger: false });

    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.payload);
    expect(body.status).toBe('ok');
    expect(body.timestamp).toBeDefined();

    await app.close();
  });
});
