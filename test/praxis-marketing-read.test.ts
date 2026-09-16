// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('../apps/portal/lib/praxis/server', async importOriginal => ({ ...await importOriginal<typeof import('../apps/portal/lib/praxis/server')>(),
  withPraxisReadTransaction: (_config: unknown, callback: (query: unknown) => unknown) => callback(mocks.query) }));
import { parseMarketingQuery, readPraxisMarketing } from '../apps/portal/lib/praxis/marketing-read';
import type { ConnectorConfig } from '../apps/portal/lib/praxis/server';
const config = { sourceKey: 'sanctuary', connectionId: '10000000-0000-4000-8000-000000000001', environment: 'test' } as ConnectorConfig;
const query = { period: { start: '2020-09-16', end: '2020-09-16' }, comparison: { start: '2020-09-15', end: '2020-09-15' } };
let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create schema praxis_reporting;
    create table praxis_reporting.enquiry_requests_v1(resource text default 'enquiry_request', id uuid, project_id uuid, parent_id uuid, payload jsonb, omission_count integer default 0);
    create table praxis_reporting.quotes_v1(like praxis_reporting.enquiry_requests_v1 including all);
    create table praxis_reporting.quote_versions_v1(like praxis_reporting.enquiry_requests_v1 including all);`);
  mocks.query.mockImplementation(async (strings: TemplateStringsArray, ...values: unknown[]) =>
    (await db.query(strings.reduce((text, part, index) => text + (index ? `$${index}` : '') + part, ''), values)).rows);
});
beforeEach(async () => { await db.exec('truncate praxis_reporting.enquiry_requests_v1, praxis_reporting.quotes_v1, praxis_reporting.quote_versions_v1'); });
afterAll(async () => { await db.close(); });

describe('complete marketing aggregation through reporting views', () => {
  it('returns complete counts beyond 100 rows, NZ dates, exact test exclusion and distinct quote activity', async () => {
    await db.exec(`insert into praxis_reporting.enquiry_requests_v1(id,payload)
      select md5(i::text)::uuid, '{"createdAt":"2020-09-15T13:00:00Z","name":"test is not an exclusion rule"}'::jsonb from generate_series(1,1152) i;
      insert into praxis_reporting.enquiry_requests_v1(id,payload) values ('f3229ccf-6a1a-4e1a-bcf4-2edf5cc85e70','{"createdAt":"2020-09-16T00:00:00Z"}'),
      ('10000000-0000-4000-8000-000000000007','{"createdAt":"2020-09-15T00:00:00Z"}');
      insert into praxis_reporting.quotes_v1(resource,id,payload) values ('quote','10000000-0000-4000-8000-000000000010','{"createdAt":"2020-09-01T00:00:00Z"}');
      insert into praxis_reporting.quote_versions_v1(resource,id,parent_id,payload)
      select 'quote_version',md5(('version'||i)::text)::uuid,'10000000-0000-4000-8000-000000000010',
      '{"createdAt":"2020-09-16T00:00:00Z","sentAt":"2020-09-16T00:00:00Z","acceptedAt":"2020-09-16T01:00:00Z"}'::jsonb from generate_series(1,614) i;`);
    const result = await readPraxisMarketing(query, config, 'test');
    expect(result.counts.map(row => row.value)).toEqual([1152, 0, 1, 1]);
    expect(result.counts.map(row => row.previous)).toEqual([1, 0, 0, 0]);
    expect(result.excludedTestRecords).toBe(1);
    expect(JSON.stringify(result)).not.toContain('name');
    expect(result.coverage).toBe('complete_period_activity');
  });
  it('handles empty data and no comparison without inventing previous zeroes', async () => {
    const result = await readPraxisMarketing({ ...query, comparison: null }, config, 'test');
    expect(result.counts.every(row => row.value === 0 && row.previous === null)).toBe(true);
  });
  it('uses daylight-saving NZ dates and excludes the labelled project without name guessing', async () => {
    await db.exec(`insert into praxis_reporting.enquiry_requests_v1(id,project_id,payload) values
      (md5('before')::uuid,null,'{"createdAt":"2020-09-27T10:30:00Z"}'),
      (md5('after')::uuid,null,'{"createdAt":"2020-09-27T11:30:00Z"}'),
      (md5('test-project')::uuid,'10c5db1a-602c-4f0c-8193-855b186215bb','{"createdAt":"2020-09-27T11:30:00Z"}')`);
    const result = await readPraxisMarketing({ period: { start: '2020-09-28', end: '2020-09-28' }, comparison: { start: '2020-09-27', end: '2020-09-27' } }, config, 'test');
    expect(result.counts[0]).toMatchObject({ value: 1, previous: 1 });
    expect(result.excludedTestRecords).toBe(1);
  });
  it('withholds all totals for omitted or orphaned evidence', async () => {
    await db.exec(`insert into praxis_reporting.enquiry_requests_v1(id,payload,omission_count) values (md5('bad')::uuid,'{}',1)`);
    await expect(readPraxisMarketing(query, config, 'test')).rejects.toThrow('Complete marketing evidence');
    await db.exec(`truncate praxis_reporting.enquiry_requests_v1; insert into praxis_reporting.quote_versions_v1(resource,id,parent_id,payload) values ('quote_version',md5('bad')::uuid,md5('missing')::uuid,'{}')`);
    await expect(readPraxisMarketing(query, config, 'test')).rejects.toThrow('Complete marketing evidence');
  });
  it('rejects invalid, duplicate, future, oversized and unequal date requests', () => {
    const now = new Date('2020-09-17T00:00:00Z');
    expect(parseMarketingQuery(new URL('https://example.test/?start=2020-09-16&end=2020-09-16'), now).comparison).toBeNull();
    for (const params of ['start=2020-09-16&end=2020-09-17', 'start=2020-02-30&end=2020-03-01', 'start=2020-01-01&end=2020-09-16',
      'start=2020-09-16&end=2020-09-16&end=2020-09-16', 'start=2020-09-16&end=2020-09-16&comparisonStart=2020-09-14&comparisonEnd=2020-09-15',
      'start=2020-09-16&end=2020-09-16&limit=10000']) expect(() => parseMarketingQuery(new URL(`https://example.test/?${params}`), now)).toThrow();
  });
});
