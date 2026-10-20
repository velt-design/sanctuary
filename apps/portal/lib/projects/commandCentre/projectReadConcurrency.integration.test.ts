import { describe, expect, it, vi } from 'vitest';
import { createProjectCommandCentreRead, getProjectCommandCentre } from './getProjectCommandCentre';
import { getProjectPageSnapshot } from '../getProjectPageSnapshot';
import { loadProjectWorkProjectionFacts } from '../workItems/projectWorkProjectionFacts';
import { getProjectWorkProjection } from '../workItems/repository';

const projectUuid = '11111111-1111-4111-8111-111111111111';
const otherUuid = '22222222-2222-4222-8222-222222222222';
const estimateUuid = '33333333-3333-4333-8333-333333333333';
const projectId = `proj_${projectUuid}`;
type Row = Record<string, unknown>;

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

/** Auth-bound synthetic query source; gates model backend latency without timers. */
function fixture(options: { gates?: Record<string, Promise<void>>; errors?: Record<string, string> } = {}) {
  const estimate = { id: estimateUuid, project_id: projectUuid, status: 'draft', version: 1,
    created_at: '2026-10-01T00:00:00Z', inputs: {}, outputs: {} };
  const tables: Record<string, Row[]> = {
    projects: [{ id: projectUuid, name: 'Read concurrency fixture', pipeline_stage: 'NEW', archived_at: null,
      estimates: [estimate], quotes: [], ownerAssignment: [], emails: [], notes: [], jobPacks: [] }],
    estimates: [estimate],
    project_work_model_versions: [{ project_id: projectUuid, model_version: 2 }],
    project_owner_assignments: [],
    project_work_repair_signals: [],
    project_operational_states: [{ project_id: projectUuid, state: 'ACTIVE', row_version: 1 }],
    project_work_items: [],
    project_confirmation_events: [],
  };
  const started: string[] = [];
  const supabase = { from: vi.fn((table: string) => {
    let single = false;
    const filters: Array<[string, unknown[]]> = [];
    const query: any = {
      select: () => query, neq: () => query, is: () => query, order: () => query, limit: () => query,
      eq: (key: string, value: unknown) => { filters.push([key, [value]]); return query; },
      in: (key: string, values: unknown[]) => { filters.push([key, values]); return query; },
      maybeSingle: () => { single = true; return query; },
      then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => {
        started.push(table);
        return (async () => {
          await options.gates?.[table];
          if (!(table in tables)) throw new Error(`Unexpected query: ${table}`);
          const data = tables[table].filter(row => filters.every(([key, values]) => !(key in row) || values.includes(row[key])));
          return { data: single ? data[0] ?? null : data,
            error: options.errors?.[table] ? { code: '42501', message: options.errors[table] } : null };
        })().then(resolve, reject);
      },
    };
    return query;
  }) } as any;
  return { supabase, tables, started };
}

const workTables = ['project_work_repair_signals', 'project_operational_states', 'project_work_items', 'project_confirmation_events'];

describe('authoritative project reads under latency', () => {
  it('starts independent facts while the selected estimate is pending, then keeps pricing recovery', async () => {
    const detail = deferred();
    const { supabase, started } = fixture({ gates: { estimates: detail.promise } });
    let settled = false;
    const pending = getProjectCommandCentre(projectId, supabase).finally(() => { settled = true; });
    await vi.waitFor(() => expect(started).toEqual(expect.arrayContaining(['estimates', ...workTables])));
    expect(settled).toBe(false);
    detail.resolve();
    await expect(pending).resolves.toMatchObject({ currentDesign: { warnings: ['estimate_price_unavailable'] },
      projectWork: { primaryAction: { kind: 'recovery', title: 'Resolve estimate pricing' } } });
  });

  it.each(['projects', 'project_work_model_versions'])('does not start operational reads before %s resolves', async table => {
    const boundary = deferred();
    const { supabase, started } = fixture({ gates: { [table]: boundary.promise } });
    const pending = getProjectCommandCentre(projectId, supabase);
    await vi.waitFor(() => expect(started).toContain(table));
    expect(started.some(source => workTables.includes(source))).toBe(false);
    boundary.resolve();
    await pending;
  });

  it.each(['invisible', 'model missing'])('keeps %s away from all operational reads', async mode => {
    const { supabase, tables, started } = fixture();
    tables[mode === 'invisible' ? 'projects' : 'project_work_model_versions'] = [];
    const result = await getProjectCommandCentre(projectId, supabase);
    if (mode === 'invisible') expect(result).toBeNull();
    else expect(result?.workModel).toBe('legacy');
    expect(started.some(table => workTables.includes(table))).toBe(false);
  });

  it.each(['estimates', ...workTables])('propagates %s failure rather than returning partial authoritative work', async table => {
    const { supabase } = fixture({ errors: { [table]: `Denied ${table}` } });
    await expect(getProjectCommandCentre(projectId, supabase)).rejects.toThrow(`Denied ${table}`);
  });

  it('observes a fact failure without waiting for an unrelated slow estimate', async () => {
    const detail = deferred();
    const { supabase } = fixture({ gates: { estimates: detail.promise }, errors: { project_work_items: 'Work unavailable' } });
    await expect(getProjectCommandCentre(projectId, supabase)).rejects.toThrow('Work unavailable');
    detail.resolve();
  });

  it('shares the snapshot model check, while retaining full current pricing recovery', async () => {
    const { supabase, started } = fixture();
    const snapshot = await getProjectPageSnapshot(projectId, undefined, supabase, 'synthetic-staff');
    expect(snapshot).toMatchObject({ workModel: 'v2', projectWork: {
      primaryAction: { kind: 'recovery', title: 'Resolve estimate pricing' }, stateRowVersion: 1,
    } });
    expect(started.filter(table => table === 'project_work_model_versions')).toHaveLength(1);
    expect(started.filter(table => table === 'projects')).toHaveLength(3);
  });

  it('does not reuse results across readers, clients or projects, and observes the next saved state', async () => {
    const first = fixture();
    const second = fixture();
    second.tables.project_operational_states[0] = { project_id: projectUuid, state: 'CLOSED', closed_outcome: 'CANCELLED', row_version: 7 };
    const firstReader = createProjectCommandCentreRead(projectId, first.supabase);
    await Promise.all([firstReader.readModel(), firstReader.readModel()]);
    const [active, closed, inaccessible] = await Promise.all([
      firstReader.read(), getProjectCommandCentre(projectId, second.supabase),
      getProjectCommandCentre(`proj_${otherUuid}`, first.supabase),
    ]);
    expect(active?.projectWork?.effectiveState).toBe('ACTIVE');
    expect(closed?.projectWork).toMatchObject({ effectiveState: 'CLOSED', stateRowVersion: 7,
      primaryAction: { kind: 'none', title: 'Project closed' } });
    expect(inaccessible).toBeNull();
    expect(first.started.filter(table => table === 'project_work_model_versions')).toHaveLength(2);
    first.tables.project_operational_states[0] = { project_id: projectUuid, state: 'CLOSED', closed_outcome: 'COMPLETE', row_version: 8 };
    const fresh = await getProjectCommandCentre(projectId, first.supabase);
    expect(fresh?.projectWork).toMatchObject({ effectiveState: 'CLOSED', stateRowVersion: 8, closedOutcome: 'COMPLETE' });
    expect(first.started.filter(table => table === 'project_work_model_versions')).toHaveLength(3);
  });

  it('rejects facts from another read context, project or client before composition', async () => {
    const { supabase } = fixture();
    const readContext = { supabase, projectUuid, archivedAt: null, modelVersion: 2 as const, projectOwnerKey: null };
    const facts = await loadProjectWorkProjectionFacts({ supabase, projectUuid, readContext });
    await expect(getProjectWorkProjection({ supabase, projectUuid, readContext: { ...readContext }, facts })).rejects.toThrow('do not match');
    await expect(getProjectWorkProjection({ supabase: fixture().supabase, projectUuid, readContext, facts })).rejects.toThrow('does not match');
    await expect(getProjectWorkProjection({ supabase, projectUuid: otherUuid, readContext, facts })).rejects.toThrow('does not match');
  });
});
