import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import * as contextRoute from './context/route';
import * as healthRoute from './health/route';

afterEach(() => vi.restoreAllMocks());

describe('Praxis integration route surface', () => {
  it('exports GET only for context and health', () => {
    for (const route of [contextRoute, healthRoute]) {
      expect(typeof route.GET).toBe('function');
      expect(route).not.toHaveProperty('POST');
      expect(route).not.toHaveProperty('PUT');
      expect(route).not.toHaveProperty('PATCH');
      expect(route).not.toHaveProperty('DELETE');
      expect(route.runtime).toBe('nodejs');
      expect(route.dynamic).toBe('force-dynamic');
    }
  });

  it('fails dark with the stable error envelope when unconfigured', async () => {
    const prior = process.env.PRAXIS_SANCTUARY_DATABASE_URL;
    delete process.env.PRAXIS_SANCTUARY_DATABASE_URL;
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    try {
      const response = await contextRoute.GET(new Request('https://portal.example.test/api/integrations/praxis/v1/context'));
      expect(response.status).toBe(503);
      expect(response.headers.get('cache-control')).toBe('private, no-store');
      expect(await response.json()).toMatchObject({
        schemaVersion: 'sanctuary.praxis.error.v1',
        error: { code: 'CONNECTOR_NOT_CONFIGURED', retryable: false },
      });
    } finally {
      if (prior === undefined) delete process.env.PRAXIS_SANCTUARY_DATABASE_URL;
      else process.env.PRAXIS_SANCTUARY_DATABASE_URL = prior;
    }
  });
});
