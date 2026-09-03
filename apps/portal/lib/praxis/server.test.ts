import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  PraxisConnectorError,
  authorizePraxisRequest,
  canonicalRecordVersion,
  createPraxisErrorResponse,
  loadPraxisConnectorConfig,
  parsePraxisContextQuery,
  praxisResponseHeaders,
  readPraxisContext,
  readPraxisHealth,
  type PraxisServerDependencies,
} from './server';
import type { Sql, TransactionSql } from 'postgres';

const ORIGINAL_ENV = process.env;
const TOKEN = 'test-token-with-at-least-thirty-two-characters';

beforeEach(() => {
  process.env = {
    ...ORIGINAL_ENV,
    PRAXIS_SANCTUARY_DATABASE_URL: 'postgres://reader:secret@db.example.test/postgres',
    PRAXIS_SANCTUARY_READ_TOKEN: TOKEN,
    PRAXIS_SANCTUARY_SOURCE_KEY: 'sanctuary',
    PRAXIS_SANCTUARY_CONNECTION_ID: 'a0000000-0000-4000-8000-000000000001',
    PRAXIS_SANCTUARY_ENVIRONMENT: 'test',
  };
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
  vi.restoreAllMocks();
});

function request(headers: Record<string, string> = {}): Request {
  return new Request('https://portal.example.test/api/integrations/praxis/v1/context', {
    headers: {
      authorization: `Bearer ${TOKEN}`,
      'x-praxis-source-key': 'sanctuary',
      'x-praxis-connection-id': 'a0000000-0000-4000-8000-000000000001',
      'x-praxis-environment': 'test',
      ...headers,
    },
  });
}

const IDENTITY = {
  source_key: 'sanctuary',
  connection_id: 'a0000000-0000-4000-8000-000000000001',
  environment: 'test',
  projection_version: 'sanctuary.praxis.core.v1',
  runtime_role: 'sanctuary_praxis_reader_test',
  group_member: true,
  transaction_read_only: true,
  can_login: true,
  is_superuser: false,
  can_create_database: false,
  can_create_role: false,
  can_replicate: false,
  can_bypass_rls: false,
  only_reporting_membership: true,
  forbidden_schema_create: false,
  forbidden_table_privilege: false,
  forbidden_sequence_privilege: false,
};

function mockDatabase(options: {
  rows?: Array<Record<string, unknown>>;
  identity?: Record<string, unknown>;
  ready?: boolean;
  failure?: Error;
} = {}) {
  const transaction = vi.fn(async (strings: TemplateStringsArray) => {
    const sql = strings.join('?');
    if (options.failure && sql.includes('source_identity_v1')) throw options.failure;
    if (sql.startsWith('set local')) return [];
    if (sql.includes('from praxis_reporting.source_identity_v1')) return [options.identity ?? IDENTITY];
    if (sql.includes('has_schema_privilege')) return [{ ready: options.ready ?? true }];
    if (sql.includes('from praxis_reporting.context_page_v1')) return options.rows ?? [];
    throw new Error(`Unexpected SQL in test: ${sql}`);
  });
  const end = vi.fn(async () => undefined);
  const client = {
    begin: vi.fn(async (_mode: string, callback: (sql: TransactionSql) => unknown) => callback(transaction as unknown as TransactionSql)),
    end,
  } as unknown as Sql;
  const dependencies: PraxisServerDependencies = { createDatabase: vi.fn(() => client) };
  return { dependencies, transaction, client, end };
}

describe('Praxis connector trust boundary', () => {
  it('fails dark when any dedicated credential or binding is absent', () => {
    delete process.env.PRAXIS_SANCTUARY_DATABASE_URL;
    expect(() => loadPraxisConnectorConfig()).toThrowError(
      expect.objectContaining({ code: 'CONNECTOR_NOT_CONFIGURED', status: 503 }),
    );
  });

  it('accepts only the exact bearer and source binding', () => {
    const config = loadPraxisConnectorConfig();
    expect(() => authorizePraxisRequest(request(), config)).not.toThrow();
    expect(() => authorizePraxisRequest(request({ authorization: 'Bearer wrong' }), config)).toThrowError(
      expect.objectContaining({ code: 'UNAUTHORIZED', status: 401 }),
    );
    expect(() => authorizePraxisRequest(request({ 'x-praxis-environment': 'production' }), config)).toThrowError(
      expect.objectContaining({ code: 'SOURCE_BINDING_MISMATCH', status: 403 }),
    );
  });

  it('bounds and normalizes context queries', () => {
    expect(parsePraxisContextQuery(new URL('https://portal.example.test/context'))).toEqual({
      resource: 'all', projectId: null, changedAfter: null, limit: 50, cursor: null,
    });
    expect(() => parsePraxisContextQuery(new URL('https://portal.example.test/context?limit=101'))).toThrowError(
      expect.objectContaining({ code: 'INVALID_QUERY', status: 400 }),
    );
    expect(() => parsePraxisContextQuery(new URL('https://portal.example.test/context?resource=secret'))).toThrowError(
      expect.objectContaining({ code: 'INVALID_QUERY', status: 400 }),
    );
  });

  it('uses the shared recursive canonical JSON SHA-256 algorithm', () => {
    const payload = { z: [{ b: 2, a: 1 }], a: { y: true, x: null } };
    const canonical = '{"a":{"x":null,"y":true},"z":[{"a":1,"b":2}]}';
    expect(canonicalRecordVersion(payload)).toBe(createHash('sha256').update(canonical).digest('hex'));
    expect(canonicalRecordVersion(payload)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('keeps response caching disabled with the exact shared header', () => {
    expect(new Headers(praxisResponseHeaders('request-id')).get('cache-control')).toBe('private, no-store');
    expect(new Headers(praxisResponseHeaders('request-id')).get('x-content-type-options')).toBe('nosniff');
  });

  it('returns stable body-free error metadata', async () => {
    const response = createPraxisErrorResponse(
      new PraxisConnectorError(403, 'SOURCE_BINDING_MISMATCH', 'The requested source binding is not allowed.'),
      '90000000-0000-4000-8000-000000000403',
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      schemaVersion: 'sanctuary.praxis.error.v1',
      requestId: '90000000-0000-4000-8000-000000000403',
      error: {
        code: 'SOURCE_BINDING_MISMATCH',
        message: 'The requested source binding is not allowed.',
        retryable: false,
      },
    });
    expect(console.info).toHaveBeenCalledWith(expect.not.stringContaining(TOKEN));
  });

  it('reads a sentinel page, maps canonical evidence, and preserves asOf through a source-bound cursor', async () => {
    const payload = { z: 2, a: { d: 4, c: 3 } };
    const firstDb = mockDatabase({ rows: [
      {
        resource: 'quote', id: '20000000-0000-4000-8000-000000000001',
        project_id: '10000000-0000-4000-8000-000000000001',
        parent_id: '10000000-0000-4000-8000-000000000001',
        recorded_at: '2026-09-03T00:01:00.000Z', record_version: 'a'.repeat(64), payload,
      },
      {
        resource: 'project_financial_truth', id: '10000000-0000-4000-8000-000000000001',
        project_id: '10000000-0000-4000-8000-000000000001',
        parent_id: '10000000-0000-4000-8000-000000000001',
        recorded_at: '2026-09-03T00:02:00.000Z', record_version: 'b'.repeat(64), payload: { projectId: '10000000-0000-4000-8000-000000000001' },
      },
    ] });
    const config = loadPraxisConnectorConfig();
    const query = {
      resource: 'all' as const,
      projectId: '10000000-0000-4000-8000-000000000001',
      changedAfter: null,
      limit: 1,
      cursor: null,
    };
    const first = await readPraxisContext(query, config, 'request-1', firstDb.dependencies);
    expect(first.records).toHaveLength(1);
    expect(first.records[0]?.recordVersion).toBe(canonicalRecordVersion(payload));
    expect(first.page.hasMore).toBe(true);
    expect(first.page.nextCursor).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(first.source.asOf).toBeTruthy();
    expect(firstDb.client.begin).toHaveBeenCalledWith('read only', expect.any(Function));
    expect(firstDb.end).toHaveBeenCalledOnce();
    expect(firstDb.transaction.mock.calls.filter(([strings]) => String(strings[0]).startsWith('set local'))).toHaveLength(2);
    const pageCall = firstDb.transaction.mock.calls.find(([strings]) => String(strings).includes('context_page_v1'));
    expect(pageCall?.at(-1)).toBe(2);

    const secondDb = mockDatabase();
    const second = await readPraxisContext(
      { ...query, cursor: first.page.nextCursor },
      config,
      'request-2',
      secondDb.dependencies,
    );
    expect(second.source.asOf).toBe(first.source.asOf);
    expect(second.page.hasMore).toBe(false);

    await expect(readPraxisContext(
      { ...query, resource: 'quote', cursor: first.page.nextCursor },
      config,
      'request-3',
      mockDatabase().dependencies,
    )).rejects.toMatchObject({ code: 'INVALID_CURSOR' });
    process.env.PRAXIS_SANCTUARY_CONNECTION_ID = 'a0000000-0000-4000-8000-000000000002';
    const changedConfig = loadPraxisConnectorConfig();
    await expect(readPraxisContext(
      { ...query, cursor: first.page.nextCursor },
      changedConfig,
      'request-4',
      mockDatabase().dependencies,
    )).rejects.toMatchObject({ code: 'INVALID_CURSOR' });
  });

  it('requires an exact DB-owned source identity and cleans up failures without leaking details', async () => {
    const mismatch = mockDatabase({ identity: { ...IDENTITY, environment: 'production' } });
    await expect(readPraxisContext(
      { resource: 'all', projectId: null, changedAfter: null, limit: 1, cursor: null },
      loadPraxisConnectorConfig(),
      'request-mismatch',
      mismatch.dependencies,
    )).rejects.toMatchObject({ code: 'PROJECTION_NOT_READY' });
    expect(mismatch.end).toHaveBeenCalledOnce();

    const secret = 'postgres://reader:password-that-must-not-leak@db.example.test/postgres';
    const failed = mockDatabase({ failure: new Error(secret) });
    let caught: unknown;
    try {
      await readPraxisContext(
        { resource: 'all', projectId: null, changedAfter: null, limit: 1, cursor: null },
        loadPraxisConnectorConfig(),
        'request-failed',
        failed.dependencies,
      );
    } catch (error) {
      caught = error;
    }
    expect(caught).toMatchObject({ code: 'SOURCE_UNAVAILABLE', message: 'The Sanctuary source is unavailable.' });
    expect(String(caught)).not.toContain(secret);
    expect(failed.end).toHaveBeenCalledOnce();
  });

  it('reports healthy only after exact DB identity, posture, and projection checks', async () => {
    const healthyDb = mockDatabase();
    const health = await readPraxisHealth(loadPraxisConnectorConfig(), 'health-request', healthyDb.dependencies);
    expect(health).toMatchObject({
      schemaVersion: 'sanctuary.praxis.health.v1',
      source: {
        sourceKey: 'sanctuary',
        connectionId: 'a0000000-0000-4000-8000-000000000001',
        environment: 'test',
        projectionVersion: 'sanctuary.praxis.core.v1',
      },
      status: { connector: 'ready', database: 'reachable', projection: 'ready' },
    });
    expect(healthyDb.end).toHaveBeenCalledOnce();

    const overGranted = mockDatabase({ identity: { ...IDENTITY, forbidden_table_privilege: true } });
    await expect(readPraxisHealth(loadPraxisConnectorConfig(), 'health-bad', overGranted.dependencies))
      .rejects.toMatchObject({ code: 'PROJECTION_NOT_READY' });
    expect(overGranted.end).toHaveBeenCalledOnce();
  });
});
