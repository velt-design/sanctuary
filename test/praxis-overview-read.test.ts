// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('../apps/portal/lib/praxis/server', async importOriginal => ({ ...await importOriginal<typeof import('../apps/portal/lib/praxis/server')>(),
  withPraxisReadTransaction: (_config: unknown, callback: (query: unknown) => unknown) => callback(mocks.query) }));
import { parseOverviewLimit, readPraxisOverview } from '../apps/portal/lib/praxis/overview-read';
import type { ConnectorConfig } from '../apps/portal/lib/praxis/server';
const config = { sourceKey: 'sanctuary', connectionId: '10000000-0000-4000-8000-000000000001', environment: 'test' } as ConnectorConfig;
let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create schema praxis_reporting;
    create table praxis_reporting.projects_v1(id uuid, project_id uuid, parent_id uuid, payload jsonb, omission_count integer default 0, recorded_at timestamptz default '2026-09-01T00:00:00Z');
    create table praxis_reporting.contacts_v1(like praxis_reporting.projects_v1 including all);
    create table praxis_reporting.quotes_v1(like praxis_reporting.projects_v1 including all);
    create table praxis_reporting.quote_versions_v1(like praxis_reporting.projects_v1 including all);`);
  mocks.query.mockImplementation(async (strings: TemplateStringsArray, ...values: unknown[]) =>
    (await db.query(strings.reduce((text, part, index) => text + (index ? `$${index}` : '') + part, ''), values)).rows);
});
beforeEach(async () => { await db.exec('truncate praxis_reporting.projects_v1,praxis_reporting.contacts_v1,praxis_reporting.quotes_v1,praxis_reporting.quote_versions_v1'); });
afterAll(async () => { await db.close(); });
async function seed(size = 1) {
  await db.exec(`insert into praxis_reporting.contacts_v1(id,payload) values
    ('10000000-0000-4000-8000-000000000001','{"name":"Synthetic Customer","email":null}');
    insert into praxis_reporting.projects_v1(id,parent_id,payload)
      select ('20000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'10000000-0000-4000-8000-000000000001',
      '{"name":"Synthetic Project","contactId":"10000000-0000-4000-8000-000000000001","pipelineStage":"Deposit","archivedAt":null}' from generate_series(1,${size}) i;
    insert into praxis_reporting.quotes_v1(id,project_id,payload)
      select ('30000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('20000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'{"quoteRef":null}' from generate_series(1,${size}) i;
    insert into praxis_reporting.quote_versions_v1(id,project_id,parent_id,payload)
      select ('40000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('20000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
      ('30000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
      '{"status":"SENT","acceptedAt":null,"supersededAt":null,"sentAt":"2026-09-01T00:00:00Z","expiresAt":null,"versionNumber":1,"totalIncGstCents":12345}' from generate_series(1,${size}) i;`);
}
describe('business overview reporting SQL', () => {
  it('counts the complete population independent of row limit and preserves identity, dates and amount semantics', async () => {
    await seed(125);
    const result = await readPraxisOverview(2,config,'request');
    expect(result.pipeline).toEqual({ totalProjects:125, archivedProjects:0, activeProjects:125, stages:[{ stage:'Deposit', count:125 }] });
    expect(result.quoteAttention).toMatchObject({ total:125,returned:2,limit:2,truncated:true });
    expect(result.quoteAttention.items[0]).toMatchObject({ projectId:'20000000-0000-4000-8000-000000000001',contactId:'10000000-0000-4000-8000-000000000001',email:null,stage:'Deposit',totalIncGstCents:12345,recordedAt:'2026-09-01T00:00:00.000Z',status:'SENT',reason:'sent_unaccepted' });
    expect(result.source).toMatchObject({ sourceKey:config.sourceKey,connectionId:config.connectionId,environment:'test',authority:'canonical' });
    expect(Date.parse(result.source.asOf)).toBeLessThanOrEqual(Date.parse(result.source.retrievedAt));
    expect(result).not.toHaveProperty('cash');
    expect(result.limitations.join(' ')).toContain('not acceptance or payment evidence');
  });
  it('excludes accepted quotes even with stale SENT status, archived projects and exact labelled test project', async () => {
    await seed(4);
    await db.exec(`update praxis_reporting.quote_versions_v1 set payload=payload||'{"acceptedAt":"2026-09-02T00:00:00Z"}' where id='40000000-0000-4000-8000-000000000001';
      update praxis_reporting.projects_v1 set payload=payload||'{"archivedAt":"2026-09-02T00:00:00Z"}' where id='20000000-0000-4000-8000-000000000002';
      update praxis_reporting.quote_versions_v1 set payload=payload||'{"expiresAt":"2020-01-01T00:00:00Z"}' where id='40000000-0000-4000-8000-000000000003';
      insert into praxis_reporting.projects_v1(id,payload) values ('10c5db1a-602c-4f0c-8193-855b186215bb','{}');`);
    const result = await readPraxisOverview(20,config,'request');
    expect(result.pipeline).toMatchObject({ totalProjects:4,activeProjects:3,archivedProjects:1 });
    expect(result.excludedTestProjects).toBe(1);
    expect(result.quoteAttention.total).toBe(2);
    expect(result.quoteAttention.items[0].reason).toBe('sent_expired');
  });
  it.each(['projects_v1','contacts_v1','quotes_v1','quote_versions_v1'])('withholds all totals on %s omission',async table => {
    await seed(); await db.exec(`update praxis_reporting.${table} set omission_count=1`);
    await expect(readPraxisOverview(20,config,'request')).rejects.toThrow('Complete business overview');
  });
  it('fails closed for missing quote parents',async () => {
    await seed(); await db.exec('delete from praxis_reporting.quotes_v1');
    await expect(readPraxisOverview(20,config,'request')).rejects.toThrow('Complete business overview');
  });
  it('checks missing and invalid amount evidence beyond the returned row limit',async () => {
    await seed(2);
    await db.exec(`update praxis_reporting.quote_versions_v1 set payload=payload||'{"totalIncGstCents":null}' where id='40000000-0000-4000-8000-000000000002'`);
    await expect(readPraxisOverview(1,config,'request')).rejects.toThrow('Complete business overview');
    await db.exec(`update praxis_reporting.quote_versions_v1 set payload=payload||'{"totalIncGstCents":1.5}' where id='40000000-0000-4000-8000-000000000002'`);
    await expect(readPraxisOverview(1,config,'request')).rejects.toThrow('Complete business overview');
  });
  it('returns honest empty results and rejects unbounded or duplicate requests',async () => {
    expect((await readPraxisOverview(20,config,'request')).pipeline.totalProjects).toBe(0);
    expect(parseOverviewLimit(new URL('https://example.test/'))).toBe(20);
    for (const query of ['limit=0','limit=51','limit=2&limit=3','projectId=x','limit=1.5']) expect(() => parseOverviewLimit(new URL(`https://example.test/?${query}`))).toThrow();
  });
  it.each([
    ['projects_v1','name',null], ['projects_v1','name',''], ['projects_v1','name','x'.repeat(1025)],
    ['projects_v1','pipelineStage','x'.repeat(101)], ['projects_v1','pipelineStage',42],
    ['contacts_v1','name',''], ['contacts_v1','name','x'.repeat(1025)], ['contacts_v1','email','x'.repeat(255)],
    ['contacts_v1','email',42], ['quotes_v1','quoteRef','x'.repeat(101)], ['quotes_v1','quoteRef',42],
    ['quote_versions_v1','sentAt','2099-01-01T00:00:00Z'], ['quote_versions_v1','sentAt','invalid'],
    ['quote_versions_v1','expiresAt','infinity'],
  ])('withholds whole overview for invalid %s.%s beyond detail limit',async (table,field,value) => {
    await seed(21);
    // The last customer is separate so corrupting it cannot affect the first20.
    await db.exec(`insert into praxis_reporting.contacts_v1 select '10000000-0000-4000-8000-000000000021', project_id,parent_id,payload,omission_count,recorded_at from praxis_reporting.contacts_v1;
      update praxis_reporting.projects_v1 set parent_id='10000000-0000-4000-8000-000000000021',payload=payload||'{"contactId":"10000000-0000-4000-8000-000000000021"}' where id='20000000-0000-4000-8000-000000000021'`);
    await db.query(`update praxis_reporting.${table} set payload=payload||$1::jsonb where right(id::text,12)='000000000021'`,[JSON.stringify({ [field]:value })]);
    await expect(readPraxisOverview(20,config,'request')).rejects.toThrow();
  });
  it('withholds future source freshness beyond detail limit',async () => {
    await seed(21);
    await db.exec(`update praxis_reporting.projects_v1 set recorded_at='2099-01-01T00:00:00Z' where id='20000000-0000-4000-8000-000000000021'`);
    await expect(readPraxisOverview(20,config,'request')).rejects.toThrow('Complete business overview');
  });
});
