import { beforeEach, describe, expect, it, vi } from 'vitest';

const fromMock = vi.fn();
const logPortalServerError = vi.fn();
const getAuthoritativeProjectWorkProjection = vi.fn();
const isProjectWorkModelV2 = vi.fn();

vi.mock('@/lib/api/routeDiagnostics', () => ({
  logPortalServerError,
}));

vi.mock('@/lib/projects/workItems/getAuthoritativeProjectWorkProjection', () => ({
  getAuthoritativeProjectWorkProjection,
}));

vi.mock('@/lib/projects/workItems/modelBoundary', () => ({
  isProjectWorkModelV2,
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
  rpc: vi.fn(async () => ({
    data: [{ user_id: 'auth-user-1', display_name: 'Alex Staff', email: 'alex@example.com', access_role: 'staff' }],
    error: null,
  })),
};

describe('getProjectPageSnapshot', () => {
  beforeEach(() => {
    vi.resetModules();
    fromMock.mockReset();
    logPortalServerError.mockReset();
    fakeAuth.auth.getUser.mockClear();
    fakeAuth.rpc.mockClear();
    getAuthoritativeProjectWorkProjection.mockReset();
    isProjectWorkModelV2.mockReset().mockResolvedValue(false);
  });

  it('returns a snapshot without scheduling invoice retries during read', async () => {
    const projectId = '11111111-1111-4111-8111-111111111111';
    const contactId = '22222222-2222-4222-8222-222222222222';
    const projectQuery = createQuery({
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
    });
    const relatedQuery = createQuery({
      data: {
        siteVisits: [],
        estimates: [],
        scheduleItems: [],
        quotes: [{ acceptedVersions: [{ id: 'quote_version_1', status: 'ACCEPTED' }] }],
        openInvoices: [{ id: 'inv_1', status: 'OPEN' }],
        manualChecks: [],
        emails: [{
          id: 'email_1',
          subject: 'Estimate ready',
          to_email: 'casey@example.com',
          status: 'SENT',
          sent_at: '2026-07-19T00:00:00.000Z',
          created_at: '2026-07-19T00:00:00.000Z',
          email_type: 'estimate',
        }],
        jobPacks: [{ id: 'job_pack_1' }],
        notes: [{
          id: 'note_1',
          body: 'Known note',
          author_id: 'auth-user-1',
          author_email: 'staff@example.com',
          created_at: '2026-07-19T00:00:00.000Z',
          updated_at: '2026-07-19T00:00:00.000Z',
        }],
      },
      error: null,
    });

    fromMock
      .mockReturnValueOnce(projectQuery)
      .mockReturnValueOnce(relatedQuery)
      .mockReturnValueOnce(createQuery({
        data: { owner_key: 'jordan' },
        error: null,
      }))
      .mockReturnValueOnce(createQuery({ data: [], error: null }));

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
        hasJobPacks: true,
        owner: { key: 'jordan', displayName: 'Jordan' },
      },
      pipeline: {
        stage: 'new',
      },
    });
    expect(Array.isArray(snapshot?.tasks.items)).toBe(true);
    expect(snapshot?.emails).toHaveLength(1);
    expect(snapshot?.notes).toMatchObject([{ id: 'note_1', isOwn: true }]);
    expect(snapshot?.activity).toHaveLength(1);
    expect(fromMock).toHaveBeenCalledTimes(4);
    expect(fromMock).toHaveBeenNthCalledWith(1, 'projects');
    expect(fromMock).toHaveBeenNthCalledWith(2, 'projects');
    expect(fromMock).toHaveBeenNthCalledWith(3, 'project_owner_assignments');
    expect(fromMock).toHaveBeenNthCalledWith(4, 'project_task_checks');
    expect(projectQuery.select).toHaveBeenCalledWith('*,contact:contacts(*)');
    expect(isProjectWorkModelV2).toHaveBeenCalledWith(expect.any(Object), projectId);
    expect(relatedQuery.eq).toHaveBeenCalledWith('quotes.acceptedVersions.status', 'ACCEPTED');
    expect(relatedQuery.eq).toHaveBeenCalledWith('openInvoices.status', 'OPEN');
    expect(relatedQuery.is).toHaveBeenCalledWith('notes.deleted_at', null);
    expect(relatedQuery.limit).toHaveBeenCalledWith(50, { referencedTable: 'notes' });
    expect(fakeAuth.auth.getUser).not.toHaveBeenCalled();
    expect(logPortalServerError).not.toHaveBeenCalled();
  });

  it('builds a direct-link summary from one auth-bound project/contact read', async () => {
    const projectId = '11111111-1111-4111-8111-111111111111';
    const contactId = '22222222-2222-4222-8222-222222222222';
    fromMock.mockReturnValueOnce(createQuery({
      data: {
        id: projectId,
        name: 'Direct Project',
        contact_id: contactId,
        contact: {
          id: contactId,
          name: 'Direct Contact',
          email: 'direct@example.com',
          phone: '022',
        },
        pipeline_stage: 'QUOTING',
        site_address: '5 Direct Road',
      },
      error: null,
    })).mockReturnValueOnce(createQuery({ data: [], error: null }));

    const { getProjectPageSummary } = await import('./getProjectPageSnapshot');
    const summary = await getProjectPageSummary(
      `proj_${projectId}`,
      undefined,
      { from: fromMock, ...fakeAuth } as any,
    );

    expect(summary).toMatchObject({
      project: {
        id: `proj_${projectId}`,
        name: 'Direct Project',
        contactId: `ct_${contactId}`,
        contactName: 'Direct Contact',
        siteAddress: '5 Direct Road',
      },
      pipeline: { stage: 'quoting' },
      tasks: { stage: 'quoting', items: [] },
      activity: [],
      emails: [],
      notes: [],
    });
    expect(fromMock).toHaveBeenCalledTimes(2);
    expect(fromMock).toHaveBeenNthCalledWith(1, 'projects');
    expect(fromMock).toHaveBeenNthCalledWith(2, 'project_owner_assignments');
    expect(isProjectWorkModelV2).toHaveBeenCalledWith(expect.any(Object), projectId);
    expect(fakeAuth.auth.getUser).not.toHaveBeenCalled();
  });

  it('starts the project and embedded-related reads without waiting for either result', async () => {
    const projectId = '11111111-1111-4111-8111-111111111111';
    const projectResult = deferred<QueryResult>();
    const relatedResult = deferred<QueryResult>();

    fromMock
      .mockReturnValueOnce(createQuery(projectResult.promise))
      .mockReturnValueOnce(createQuery(relatedResult.promise))
      .mockReturnValueOnce(createQuery({ data: [], error: null }))
      .mockReturnValueOnce(createQuery({ data: [], error: null }));

    const { getProjectPageSnapshot } = await import('./getProjectPageSnapshot');
    const pendingSnapshot = getProjectPageSnapshot(
      `proj_${projectId}`,
      undefined,
      { from: fromMock, ...fakeAuth } as any,
      'auth-user-1',
    );

    expect(fromMock).toHaveBeenCalledTimes(3);
    expect(fromMock).toHaveBeenNthCalledWith(1, 'projects');
    expect(fromMock).toHaveBeenNthCalledWith(2, 'projects');
    expect(fromMock).toHaveBeenNthCalledWith(3, 'project_owner_assignments');

    projectResult.resolve({
      data: {
        id: projectId,
        name: 'Concurrent Project',
        pipeline_stage: 'NEW',
        contact: null,
      },
      error: null,
    });
    relatedResult.resolve({
      data: {
        siteVisits: [],
        estimates: [],
        scheduleItems: [],
        quotes: [],
        openInvoices: [],
        manualChecks: [],
        emails: [],
        jobPacks: [],
        notes: [],
      },
      error: null,
    });

    await expect(pendingSnapshot).resolves.toMatchObject({
      project: { id: `proj_${projectId}`, name: 'Concurrent Project' },
    });
  });

  it('rejects an incomplete embedded related read and logs diagnostics', async () => {
    const projectId = '11111111-1111-4111-8111-111111111111';
    const relatedError = { message: 'related snapshot unavailable' };

    fromMock.mockReturnValueOnce(createQuery({
      data: {
        id: projectId,
        name: 'Alpha Project',
        pipeline_stage: 'NEW',
      },
      error: null,
    }))
      .mockReturnValueOnce(createQuery({ data: null, error: relatedError }))
      .mockReturnValueOnce(createQuery({ data: [], error: null }));

    const { getProjectPageSnapshot } = await import('./getProjectPageSnapshot');
    const snapshot = getProjectPageSnapshot(
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

    await expect(snapshot).rejects.toThrow('Failed to load complete project snapshot');
    expect(fakeAuth.auth.getUser).not.toHaveBeenCalled();
    expect(logPortalServerError).toHaveBeenCalledWith(
      expect.objectContaining({
        route: '/api/projects/[projectId]/snapshot',
        method: 'GET',
        requestId: 'req_snapshot_subordinate_error',
      }),
      expect.objectContaining({
        event: 'project_snapshot.query_failed',
        message: 'project related snapshot query failed',
        error: relatedError,
        extra: { query: 'projects+relations' },
      }),
    );
  });

  it('does not read legacy task checks for a V2 project', async () => {
    const projectId = '11111111-1111-4111-8111-111111111111';
    isProjectWorkModelV2.mockResolvedValueOnce(true);
    getAuthoritativeProjectWorkProjection.mockResolvedValue({
      projectId,
      modelVersion: 2,
      operationalState: 'ACTIVE',
      effectiveState: 'ACTIVE',
      waitingUntil: null,
      waitingReason: null,
      closedOutcome: null,
      stateRowVersion: 1,
      primaryAction: {
        kind: 'needsTriage',
        title: 'Needs triage',
        reason: 'No current staff work is recorded.',
      },
      openItems: [],
      blockedItems: [],
      confirmedFacts: [],
      generatedAt: '2026-07-29T00:00:00.000Z',
    });
    fromMock
      .mockReturnValueOnce(createQuery({
        data: {
          id: projectId,
          name: 'V2 project',
          pipeline_stage: 'NEW',
        },
        error: null,
      }))
      .mockReturnValueOnce(createQuery({
        data: {
          siteVisits: [],
          estimates: [],
          scheduleItems: [],
          quotes: [],
          openInvoices: [],
          emails: [],
          jobPacks: [],
          notes: [],
        },
        error: null,
      }))
      .mockReturnValueOnce(createQuery({ data: [], error: null }));

    const { getProjectPageSnapshot } = await import('./getProjectPageSnapshot');
    const snapshot = await getProjectPageSnapshot(
      `proj_${projectId}`,
      undefined,
      { from: fromMock, ...fakeAuth } as any,
      'auth-user-1',
    );

    expect(snapshot?.workModel).toBe('v2');
    expect(snapshot?.tasks.items).toEqual([]);
    expect(fromMock).toHaveBeenCalledTimes(3);
    expect(fromMock).not.toHaveBeenCalledWith('project_task_checks');
    expect(getAuthoritativeProjectWorkProjection).toHaveBeenCalledWith(
      `proj_${projectId}`,
      expect.any(Object),
    );
  });
});
