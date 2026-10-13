import { describe, expect, it, vi } from 'vitest';
import { emptyFactsProject, factsEnvelope, factsId } from '../../../../../test/fixtures/projectWorkDomainFacts';
import { loadProjectWorkDomainFacts } from './domainFactsRepository';

const ids = [factsId(1), factsId(2)];
const incomplete = { code: 'PROJECT_WORK_INVENTORY_INCOMPLETE' };
const success = (data: unknown) => ({ data, error: null });
const overflow = { data: null, error: { code: 'P0001', message: 'PROJECT_WORK_FACTS_BATCH_TOO_LARGE' } };

describe('bounded Project Work source facts', () => {
  it('accounts for inactive IDs, duplicates and empty scopes without reading unrelated projects', async () => {
    const rpc = vi.fn(async (_name, args) => success(factsEnvelope(args.p_project_ids, [emptyFactsProject(ids[0])])));
    const client = { rpc } as any;
    expect(await loadProjectWorkDomainFacts(client, [])).toEqual({ projects: [], confirmations: [] });
    expect(rpc).not.toHaveBeenCalled();
    const result = await loadProjectWorkDomainFacts(client, [ids[1], ids[0], ids[0]]);
    expect(result.projects.map((project) => project.id)).toEqual([ids[0]]);
    expect(rpc).toHaveBeenCalledWith('staff_project_work_domain_facts_v1', { p_project_ids: ids });
  });

  it('reads all 4,000 IDs before returning, in eight bounded batches', async () => {
    const allIds = Array.from({ length: 4000 }, (_, i) => factsId(i));
    const rpc = vi.fn(async (_name, args) => success(factsEnvelope(args.p_project_ids)));
    const result = await loadProjectWorkDomainFacts({ rpc } as any, allIds);
    expect(result.projects.map((project) => project.id)).toEqual(allIds);
    expect(rpc).toHaveBeenCalledTimes(8);
    expect(rpc.mock.calls.every(([, args]) => args.p_project_ids.length === 500)).toBe(true);
  });

  it('retains more than 1,000 confirmations including retractions and all commercial histories', async () => {
    const project = emptyFactsProject(ids[0]);
    project.estimates = [{ id: factsId(1, 2), project_id: ids[0], commercial_scope_id: null, created_at: null, status: 'unknown', version: null }];
    project.quotes = [{ id: factsId(1, 3), quote_ref: 'Q-1', commercial_scope_id: null, quoteVersions: [{
      id: factsId(1, 4), quote_id: factsId(1, 3), version_number: 1, status: 'DECLINED',
      source_estimate_version_id: factsId(1, 2), created_at: null, sent_at: null, accepted_at: null,
      total_inc_gst_cents: 120, sendLogs: Array.from({ length: 1001 }, () => ({ status: 'FAILED', created_at: null, sent_at: null })),
    }] }];
    const confirmations = Array.from({ length: 1001 }, (_, i) => ({ id: factsId(i, 5), project_id: ids[0],
      event_kind: i === 1000 ? 'RETRACTED' : 'CONFIRMED', confirmation_type: 'SITE_VISIT_COMPLETED',
      retracts_event_id: i === 1000 ? factsId(0, 5) : null }));
    const rpc = vi.fn().mockResolvedValue(success(factsEnvelope([ids[0]], [project], confirmations)));
    expect(await loadProjectWorkDomainFacts({ rpc } as any, [ids[0]])).toEqual({ projects: [project], confirmations });
  });

  it('bisects only explicit size overflow, sequentially, without losing facts', async () => {
    const calls: string[][] = [];
    const rpc = vi.fn(async (_name, args) => {
      calls.push(args.p_project_ids);
      return args.p_project_ids.length > 1 ? overflow : success(factsEnvelope(args.p_project_ids));
    });
    const result = await loadProjectWorkDomainFacts({ rpc } as any, ids);
    expect(calls).toEqual([ids, [ids[0]], [ids[1]]]);
    expect(result.projects.map((project) => project.id)).toEqual(ids);
  });

  it('fails closed on singleton overflow or the finite request budget', async () => {
    const singleton = vi.fn().mockResolvedValue(overflow);
    await expect(loadProjectWorkDomainFacts({ rpc: singleton } as any, [ids[0]])).rejects.toMatchObject(incomplete);
    expect(singleton).toHaveBeenCalledTimes(1);
    const rpc = vi.fn(async (_name, args) => args.p_project_ids.length > 1 ? overflow : success(factsEnvelope(args.p_project_ids)));
    await expect(loadProjectWorkDomainFacts({ rpc } as any, Array.from({ length: 500 }, (_, i) => factsId(i)))).rejects.toMatchObject(incomplete);
    expect(rpc).toHaveBeenCalledTimes(128);
  });

  it.each([
    ['missing ID', (payload: any) => { payload.rows.pop(); }],
    ['extra ID', (payload: any) => { payload.rows.push(payload.rows[0]); }],
    ['foreign ID', (payload: any) => { payload.rows[0].projectId = factsId(99); }],
    ['duplicate ID', (payload: any) => { payload.rows[1] = payload.rows[0]; }],
    ['wrong version', (payload: any) => { payload.version = 2; }],
    ['wrong requested count', (payload: any) => { payload.requestedCount = 1; }],
    ['wrong child count', (payload: any) => { payload.rows[0].counts.confirmations = 1; }],
    ['missing relation', (payload: any) => { delete payload.rows[0].project.estimates; }],
    ['malformed child', (payload: any) => { payload.rows[0].project.quotes = [null]; }],
    ['inactive facts', (payload: any) => { payload.rows[0].eligible = false; }],
    ['oversized bytes', (payload: any) => { payload.rows[0].project.name = 'x'.repeat(4 * 1024 * 1024); }],
  ])('rejects %s as unavailable, never partial success', async (_label, mutate) => {
    const payload = factsEnvelope(ids);
    mutate(payload);
    const rpc = vi.fn().mockResolvedValue(success(payload));
    await expect(loadProjectWorkDomainFacts({ rpc } as any, ids)).rejects.toMatchObject(incomplete);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it.each(['PGRST202', '42883'])('maps exact missing RPC %s without a legacy fallback', async (code) => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code, message: 'Missing staff_project_work_domain_facts_v1' } });
    const from = vi.fn();
    await expect(loadProjectWorkDomainFacts({ rpc, from } as any, ids)).rejects.toMatchObject(incomplete);
    expect(from).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it.each([
    { code: '42501', message: 'Access denied' },
    { code: '57014', message: 'Statement timeout' },
    { code: 'PGRST202', message: 'Missing another function' },
    { code: 'PGRST202', message: 'Missing staff_project_work_domain_facts_v10' },
    { code: 'P0001', message: 'Other failure' },
  ])('preserves $code errors without retrying or falling back', async (error) => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error });
    await expect(loadProjectWorkDomainFacts({ rpc } as any, ids)).rejects.toMatchObject(error);
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
