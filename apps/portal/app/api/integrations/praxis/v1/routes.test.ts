import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import * as contextRoute from './context/route';
import * as healthRoute from './health/route';
import * as marketingRoute from './marketing/route';
import * as overviewRoute from './overview/route';
import * as workloadRoute from './workload/route';
import * as specialistRoute from './specialist-workload/route';
import * as briefingRoute from './briefing/route';

afterEach(() => vi.restoreAllMocks());

describe('Praxis integration route surface', () => {
  it('exports GET only for context and health', () => {
    for (const route of [contextRoute, healthRoute, marketingRoute, overviewRoute, workloadRoute, specialistRoute, briefingRoute]) {
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

  it.each([marketingRoute, overviewRoute, workloadRoute, specialistRoute, briefingRoute])('rejects aggregate reads before database work without exact bearer and source identity', async route => {
    const prior = process.env;
    process.env = { ...prior, PRAXIS_SANCTUARY_DATABASE_URL: 'postgres://reader:synthetic@db.example.test/postgres?sslmode=verify-full',
      PRAXIS_SANCTUARY_READ_TOKEN: 'synthetic-token-at-least-thirty-two-characters', PRAXIS_SANCTUARY_SOURCE_KEY: 'sanctuary',
      PRAXIS_SANCTUARY_CONNECTION_ID: '10000000-0000-4000-8000-000000000001', PRAXIS_SANCTUARY_ENVIRONMENT: 'test' };
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    try {
      const url = 'https://portal.example.test/api/integrations/praxis/v1/marketing?start=2020-09-16&end=2020-09-16';
      const absent = await route.GET(new Request(url));
      expect(absent.status).toBe(401);
      const mismatch = await route.GET(new Request(url, { headers: { authorization: `Bearer ${process.env.PRAXIS_SANCTUARY_READ_TOKEN}` } }));
      expect(mismatch.status).toBe(403);
      const invalid = await route.GET(new Request(url + '&limit=10000', { headers: {
        authorization: `Bearer ${process.env.PRAXIS_SANCTUARY_READ_TOKEN}`, 'x-praxis-source-key': 'sanctuary',
        'x-praxis-connection-id': '10000000-0000-4000-8000-000000000001', 'x-praxis-environment': 'test',
      } }));
      expect(invalid.status).toBe(400);
      expect(invalid.headers.get('cache-control')).toBe('private, no-store');
      expect(await invalid.text()).not.toContain('synthetic-token');
    } finally { process.env = prior; }
  });
});
