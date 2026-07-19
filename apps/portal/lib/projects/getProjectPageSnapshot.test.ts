import { beforeEach, describe, expect, it, vi } from 'vitest';

const fromMock = vi.fn();
const logPortalServerError = vi.fn();

vi.mock('@/lib/api/routeDiagnostics', () => ({
  logPortalServerError,
}));

type QueryResult = { data: any; error: any };

function createQuery(result: QueryResult | Promise<QueryResult>) {
  const query: any = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    is: vi.fn(() => query),
    limit: vi.fn(() => query),
    order: vi.fn(() => query),
    maybeSingle: vi.fn(async () => result),
    single: vi.fn(async () => result),
    then(onFulfilled: any, onRejected: any) {
      return Promise.resolve(result).then(onFulfilled, onRejected);
    },
  };
  return query;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

const fakeAuth = {
  auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'auth-user-1' } }, error: null })) },
};

describe('getProjectPageSnapshot', () => {
  beforeEach(() => {
    vi.resetModules();
    fromMock.mockReset();
    logPortalServerError.mockReset();
    fakeAuth.auth.getUser.mockClear();
  });

  it('returns a snapshot without scheduling invoice retries during read', async () => {
    const projectId = '11111111-1111-4111-8111-111111111111';
    const contactId = '22222222-2222-4222-8222-222222222222';
    const responses: Record<string, QueryResult> = {
      projects: {
        data: {
          id: projectId,
          name: 'Alpha Project',
          contact_id: contactId,
          contact: {
            id: contactId,
            name: 'Casey Contact',
            email: 'casey@example.com',
            phone: '021',
          },
          pipeline_stage: 'NEW',
          site_address: '123 Test St',
        },
        error: null,
      },
      site_visit_events: { data: null, error: null },
      estimates: { data: [], error: null },
      schedule_items: { data: [], error: null },
      quote_versions: { data: [], error: null },
      deposit_invoices: { data: { id: 'inv_1' }, error: null },
      project_task_checks: { data: [], error: null },
      email_outbox: { data: [], error: null },
      audit_events: { data: [], error: null },
      job_pack_generations: { data: null, error: null },
      project_notes: { data: [], error: null },
    };

    fromMock.mockImplementation((table: string) => {
      const result = responses[table];
      if (!result) throw new Error(`Unexpected table ${table}`);
      return createQuery(result);
    });

    const { getProjectPageSnapshot } = await import('./getProjectPageSnapshot');
    const snapshot = await getProjectPageSnapshot(
      `proj_${projectId}`,
      {
        route: '/api/projects/[projectId]/snapshot',
        method: 'GET',
        requestId: 'req_snapshot_read_only',
        startedAt: performance.now(),
      },
      { from: fromMock, ...fakeAuth } as any,
      'auth-user-1',
    );

    expect(snapshot).toMatchObject({
      project: {
        id: `proj_${projectId}`,
        name: 'Alpha Project',
        stage: 'new',
        contactId: `ct_${contactId}`,
        contactName: 'Casey Contact',
        contactEmail: 'casey@example.com',
        contactPhone: '021',
        siteAddress: '123 Test St',
      },
      pipeline: {
        stage: 'new',
      },
    });
    expect(Array.isArray(snapshot?.tasks.items)).toBe(true);
    expect(fromMock).not.toHaveBeenCalledWith('contacts');
    expect(fakeAuth.auth.getUser).not.toHaveBeenCalled();
    expect(logPortalServerError).not.toHaveBeenCalled();
  });

  it('starts project-scoped reads without waiting for the project row', async () => {
    const projectId = '11111111-1111-4111-8111-111111111111';
    const projectResult = deferred<QueryResult>();

    fromMock.mockImplementation((table: string) => {
      if (table === 'projects') return createQuery(projectResult.promise);
      return createQuery({ data: [], error: null });
    });

    const { getProjectPageSnapshot } = await import('./getProjectPageSnapshot');
    const pendingSnapshot = getProjectPageSnapshot(
      `proj_${projectId}`,
      undefined,
      { from: fromMock, ...fakeAuth } as any,
      'auth-user-1',
    );

    expect(fromMock).toHaveBeenCalledWith('projects');
    expect(fromMock).toHaveBeenCalledWith('project_notes');
    expect(fromMock).not.toHaveBeenCalledWith('contacts');

    projectResult.resolve({
      data: {
        id: projectId,
        name: 'Concurrent Project',
        pipeline_stage: 'NEW',
        contact: null,
      },
      error: null,
    });

    await expect(pendingSnapshot).resolves.toMatchObject({
      project: { id: `proj_${projectId}`, name: 'Concurrent Project' },
    });
  });

  it('tolerates subordinate query failures and logs them through structured diagnostics', async () => {
    const projectId = '11111111-1111-4111-8111-111111111111';
    const responses: Record<string, QueryResult> = {
      projects: {
        data: {
          id: projectId,
          name: 'Alpha Project',
          pipeline_stage: 'NEW',
        },
        error: null,
      },
      site_visit_events: { data: null, error: null },
      estimates: { data: [], error: null },
      schedule_items: { data: [], error: null },
      quote_versions: { data: [], error: null },
      deposit_invoices: { data: null, error: null },
      project_task_checks: { data: [], error: null },
      email_outbox: { data: null, error: { message: 'outbox unavailable' } },
      audit_events: { data: [], error: null },
      job_pack_generations: { data: null, error: null },
      project_notes: { data: [], error: null },
    };

    fromMock.mockImplementation((table: string) => {
      const result = responses[table];
      if (!result) throw new Error(`Unexpected table ${table}`);
      return createQuery(result);
    });

    const { getProjectPageSnapshot } = await import('./getProjectPageSnapshot');
    const snapshot = await getProjectPageSnapshot(
      `proj_${projectId}`,
      {
        route: '/api/projects/[projectId]/snapshot',
        method: 'GET',
        requestId: 'req_snapshot_subordinate_error',
        startedAt: performance.now(),
      },
      { from: fromMock, ...fakeAuth } as any,
      'auth-user-1',
    );

    expect(snapshot?.project).toMatchObject({
      id: `proj_${projectId}`,
      name: 'Alpha Project',
      stage: 'new',
    });
    expect(fakeAuth.auth.getUser).not.toHaveBeenCalled();
    expect(logPortalServerError).toHaveBeenCalledWith(
      expect.objectContaining({
        route: '/api/projects/[projectId]/snapshot',
        method: 'GET',
        requestId: 'req_snapshot_subordinate_error',
      }),
      expect.objectContaining({
        event: 'project_snapshot.query_failed',
        message: 'email_outbox query failed',
        error: responses.email_outbox.error,
        extra: { query: 'email_outbox' },
      }),
    );
  });
});
