import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LocalFirstPortalMutations from './LocalFirstPortalMutations';
import { renderIntoDocument } from '../../../../test/reactHarness';
import { ApiError } from '@/lib/repo/apiClient';

const mocks = vi.hoisted(() => ({
  enqueueAndProcessLocalFirstMutation: vi.fn(),
  invalidateContactsIndexCaches: vi.fn(),
  invalidateProjectReadCaches: vi.fn(),
  queryClient: {
    invalidateQueries: vi.fn(),
    removeQueries: vi.fn(),
    setQueryData: vi.fn(),
  },
  registerLocalFirstIdAlias: vi.fn(),
  registerLocalFirstMutationHandler: vi.fn(),
  resolveLocalFirstId: vi.fn((value: string) => value),
  apiJson: vi.fn(),
  patchProjectDetailsCaches: vi.fn(),
  upsertContactCaches: vi.fn(),
}));

type RegisteredHandler = (item: { payload: unknown }) => Promise<unknown>;

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => mocks.queryClient,
}));

vi.mock('@/lib/supabase/browserClient', () => ({
  supabaseHostFromUrl: () => 'host',
  supabaseRuntimeUrl: () => 'https://example.supabase.co',
}));

vi.mock('@/lib/localFirst/queue', () => ({
  enqueueAndProcessLocalFirstMutation: mocks.enqueueAndProcessLocalFirstMutation,
  registerLocalFirstMutationHandler: mocks.registerLocalFirstMutationHandler,
}));

vi.mock('@/lib/repo/apiClient', () => ({
  apiJson: mocks.apiJson,
  ApiError: class ApiError extends Error {
    status: number;
    body: unknown;
    requestId: string | null;

    constructor(message: string, opts: { status: number; body: unknown; requestId?: string | null }) {
      super(message);
      this.name = 'ApiError';
      this.status = opts.status;
      this.body = opts.body;
      this.requestId = opts.requestId ?? null;
    }
  },
}));

vi.mock('@/lib/queries/projectCache', () => ({
  invalidateProjectReadCaches: mocks.invalidateProjectReadCaches,
  patchProjectSnapshot: vi.fn(),
  patchProjectListItem: vi.fn(),
}));

vi.mock('@/lib/localFirst/store', () => ({
  registerLocalFirstIdAlias: mocks.registerLocalFirstIdAlias,
  resolveLocalFirstId: mocks.resolveLocalFirstId,
}));

vi.mock('@/lib/queries/contactsIndex', () => ({
  invalidateContactsIndexCaches: mocks.invalidateContactsIndexCaches,
}));

vi.mock('@/lib/localFirst/portalEntities', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/localFirst/portalEntities')>();
  return {
    ...actual,
    upsertContactCaches: mocks.upsertContactCaches,
  };
});

vi.mock('@/lib/localFirst/projectDetails', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/localFirst/projectDetails')>();
  return {
    ...actual,
    patchProjectDetailsCaches: mocks.patchProjectDetailsCaches,
  };
});

function apiError(message: string, status: number, body: unknown): ApiError {
  return new ApiError(message, { status, body });
}

function minimalEstimateDetail(overrides: Record<string, unknown> = {}) {
  return {
    id: 'estimate-1',
    projectId: 'project-1',
    createdAt: '2026-05-03T00:00:00.000Z',
    status: 'draft',
    summary: {},
    createdBy: null,
    versionLabel: 'V1',
    isActiveDraft: true,
    hasSentQuote: false,
    jobPackEligible: false,
    jobPackGeneratedAt: null,
    jobPackQuoteVersionId: null,
    calculatorSnapshot: {},
    internalNotes: null,
    ...overrides,
  };
}

function minimalQuoteDetail(overrides: Record<string, unknown> = {}) {
  return {
    id: 'quote-1',
    quoteId: 'quote-row-1',
    projectId: 'project-1',
    quoteRef: 'Q-001',
    versionNumber: 1,
    status: 'DRAFT',
    depositPercent: 50,
    sourceEstimateVersionId: 'estimate-1',
    sourceEstimateVersionLabel: 'V1',
    revisedFromQuoteVersionId: null,
    createdAt: '2026-05-03T00:00:00.000Z',
    createdBy: null,
    sentAt: null,
    sentBy: null,
    expiresAt: null,
    reference: null,
    customerName: null,
    introText: null,
    termsText: null,
    totals: { subtotalCents: 0, gstCents: 0, totalIncGstCents: 0 },
    pdfFileId: null,
    renderHash: null,
    lineItems: [],
    ...overrides,
  };
}

function renderAndGetHandler(mutationKey: string): { handler: RegisteredHandler; unmount: () => void } {
  const rendered = renderIntoDocument(<LocalFirstPortalMutations />);
  const call = mocks.registerLocalFirstMutationHandler.mock.calls.find(([key]) => key === mutationKey);
  expect(call).toBeTruthy();
  return { handler: call?.[1] as RegisteredHandler, unmount: rendered.unmount };
}

describe('LocalFirstPortalMutations', () => {
  beforeEach(() => {
    mocks.enqueueAndProcessLocalFirstMutation.mockReset();
    mocks.invalidateContactsIndexCaches.mockReset().mockResolvedValue(undefined);
    mocks.invalidateProjectReadCaches.mockReset();
    mocks.queryClient.invalidateQueries.mockReset();
    mocks.queryClient.removeQueries.mockReset();
    mocks.queryClient.setQueryData.mockReset();
    mocks.registerLocalFirstIdAlias.mockReset();
    mocks.registerLocalFirstMutationHandler.mockReset();
    mocks.registerLocalFirstMutationHandler.mockImplementation(() => () => undefined);
    mocks.resolveLocalFirstId.mockReset();
    mocks.resolveLocalFirstId.mockImplementation((value: string) => value);
    mocks.apiJson.mockReset();
    mocks.patchProjectDetailsCaches.mockReset();
    mocks.upsertContactCaches.mockReset();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('registers the owned portal local-first handlers', () => {
    const rendered = renderIntoDocument(<LocalFirstPortalMutations />);

    const registeredKeys = mocks.registerLocalFirstMutationHandler.mock.calls.map(([key]) => key);

    expect(registeredKeys).toEqual(
      expect.arrayContaining([
        'portal.project.details.update',
        'portal.contact.details.update',
        'portal.estimate.create',
        'portal.estimate.update',
        'portal.designRequest.create',
        'portal.quote.createFromEstimate',
        'portal.quote.updateDraft',
        'portal.estimate.notes.update',
        'portal.project.note.create',
        'portal.project.note.update',
        'portal.project.note.delete',
      ]),
    );
    expect(registeredKeys).not.toContain('portal.project.tasks.toggle');

    rendered.unmount();
  });

  it('persists contact details through the local-first handler and accepts the server contact', async () => {
    const draft = {
      displayName: 'Updated Taylor',
      email: 'updated@example.com',
      phone: '0211111111',
    };
    const serverContact = {
      id: 'ct_1',
      ...draft,
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-20T00:00:00.000Z',
    };
    mocks.apiJson.mockResolvedValueOnce({ contact: serverContact });
    const { handler, unmount } = renderAndGetHandler('portal.contact.details.update');

    const result = await handler({
      payload: {
        contactId: 'ct_1',
        draft,
        previousContact: { ...serverContact, displayName: 'Taylor' },
      },
    });

    expect(result).toEqual({ kind: 'success', clearWorkingCopyIfMatches: draft });
    expect(mocks.apiJson).toHaveBeenCalledWith(
      '/api/contacts/ct_1',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify(draft),
        skipSaveTracking: true,
      }),
    );
    expect(mocks.upsertContactCaches).toHaveBeenCalledWith(mocks.queryClient, 'host', serverContact);
    unmount();
  });

  it('rolls contact details back and retains the rejected draft on terminal errors', async () => {
    const body = { error: 'Contact details are no longer writable.' };
    const draft = {
      displayName: 'Rejected Taylor',
      email: 'rejected@example.com',
      phone: '0219999999',
    };
    const previousContact = {
      id: 'ct_1',
      displayName: 'Taylor',
      email: 'taylor@example.com',
      phone: '0210000000',
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-02T00:00:00.000Z',
    };
    mocks.apiJson.mockRejectedValueOnce(apiError('Contact details are no longer writable.', 403, body));
    const { handler, unmount } = renderAndGetHandler('portal.contact.details.update');

    const result = await handler({ payload: { contactId: 'ct_1', draft, previousContact } });

    expect(result).toEqual({
      kind: 'conflict',
      message: 'Contact details are no longer writable.',
      serverSnapshot: body,
      clientSnapshot: draft,
    });
    expect(mocks.upsertContactCaches).toHaveBeenCalledWith(mocks.queryClient, 'host', previousContact);
    expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['contacts', 'host', 'detail', 'ct_1'],
    });
    expect(mocks.invalidateContactsIndexCaches).toHaveBeenCalledWith(mocks.queryClient, 'host');
    unmount();
  });

  it('persists project details through the local-first handler and clears only the matching draft', async () => {
    mocks.apiJson.mockResolvedValueOnce({ project: {}, contact: {} });
    mocks.invalidateProjectReadCaches.mockResolvedValueOnce(undefined);
    const { handler, unmount } = renderAndGetHandler('portal.project.details.update');
    const draft = {
      contactName: 'Taylor',
      contactEmail: 'taylor@example.com',
      contactPhone: '0210000000',
      projectName: 'Updated project',
      siteAddress: '2 Example St',
      region: 'North',
      quoteRef: 'Q-2',
      nextActionDate: '2026-07-21',
    };

    const result = await handler({
      payload: {
        projectId: 'proj_1',
        contactId: 'ct_1',
        draft,
        previousDraft: { ...draft, projectName: 'Original project' },
      },
    });

    expect(result).toEqual({ kind: 'success', clearWorkingCopyIfMatches: draft });
    expect(mocks.apiJson).toHaveBeenCalledWith(
      '/api/projects/proj_1/details',
      expect.objectContaining({ method: 'PATCH', skipSaveTracking: true }),
    );
    expect(JSON.parse(mocks.apiJson.mock.calls[0]?.[1]?.body as string)).toMatchObject({
      project: { name: 'Updated project', siteAddress: '2 Example St' },
      contact: { name: 'Taylor', email: 'taylor@example.com' },
      contactId: 'ct_1',
    });
    expect(mocks.invalidateProjectReadCaches).toHaveBeenCalledWith(mocks.queryClient, 'host', 'proj_1');
    unmount();
  });

  it('rolls project details back and retains the rejected draft on terminal errors', async () => {
    const body = { error: 'Project details are no longer writable.' };
    mocks.apiJson.mockRejectedValueOnce(apiError('Project details are no longer writable.', 403, body));
    const { handler, unmount } = renderAndGetHandler('portal.project.details.update');
    const previousDraft = {
      contactName: 'Taylor',
      contactEmail: 'taylor@example.com',
      contactPhone: '0210000000',
      projectName: 'Original project',
      siteAddress: '1 Example St',
      region: 'North',
      quoteRef: 'Q-1',
      nextActionDate: '2026-07-20',
    };
    const draft = { ...previousDraft, projectName: 'Rejected project' };

    const result = await handler({
      payload: { projectId: 'proj_1', contactId: 'ct_1', draft, previousDraft },
    });

    expect(result).toEqual({
      kind: 'conflict',
      message: 'Project details are no longer writable.',
      serverSnapshot: body,
      clientSnapshot: draft,
    });
    expect(mocks.patchProjectDetailsCaches).toHaveBeenCalledWith(mocks.queryClient, 'host', 'proj_1', previousDraft, {
      contactId: 'ct_1',
    });
    expect(mocks.invalidateProjectReadCaches).toHaveBeenCalledWith(mocks.queryClient, 'host', 'proj_1');
    unmount();
  });

  it('retries estimate updates until a provisional estimate id has a durable alias', async () => {
    mocks.resolveLocalFirstId.mockReturnValueOnce('local-estimate:1');
    const { handler, unmount } = renderAndGetHandler('portal.estimate.update');

    const result = await handler({
      payload: {
        estimateId: 'local-estimate:1',
        estimatePayload: { status: 'draft', inputs: {}, outputs: {} },
      },
    });

    expect(result).toMatchObject({ kind: 'retry', status: 'queued' });
    expect(mocks.apiJson).not.toHaveBeenCalled();
    unmount();
  });

  it('keeps locked estimate updates as local-first conflicts instead of retrying silently', async () => {
    const body = { code: 'ESTIMATE_LOCKED', lockedByQuoteRef: 'Q-001' };
    mocks.resolveLocalFirstId.mockReturnValueOnce('estimate-1');
    mocks.apiJson.mockRejectedValueOnce(apiError('Estimate is locked', 409, body));
    const { handler, unmount } = renderAndGetHandler('portal.estimate.update');

    const result = await handler({
      payload: {
        estimateId: 'estimate-1',
        estimatePayload: { status: 'draft', inputs: {}, outputs: {} },
      },
    });

    expect(result).toEqual({
      kind: 'conflict',
      message: 'Estimate is locked',
      serverSnapshot: body,
    });
    expect(result).not.toHaveProperty('clearWorkingCopy');
    expect(mocks.apiJson).toHaveBeenCalledWith('/api/estimates/estimate-1', expect.objectContaining({ method: 'PATCH' }));
    const updateBody = JSON.parse(mocks.apiJson.mock.calls[0]?.[1]?.body as string);
    expect(updateBody).toEqual({
      estimate_update: { status: 'draft', inputs: {}, outputs: {} },
    });
    expect(JSON.stringify(updateBody)).not.toContain('pricing_source');
    expect(JSON.stringify(updateBody)).not.toContain('workbench_solved');
    expect(JSON.stringify(updateBody)).not.toContain('readiness');
    expect(mocks.invalidateProjectReadCaches).not.toHaveBeenCalled();
    expect(mocks.queryClient.invalidateQueries).not.toHaveBeenCalled();
    expect(mocks.queryClient.setQueryData).not.toHaveBeenCalled();
    unmount();
  });

  it('keeps blocked workbench pricing estimate updates as visible conflicts', async () => {
    const body = { code: 'ESTIMATE_PRICING_SOURCE_BLOCKED', readinessReport: { blockingGateCodes: ['workbench_solved_ready'] } };
    mocks.resolveLocalFirstId.mockReturnValueOnce('estimate-1');
    mocks.apiJson.mockRejectedValueOnce(apiError('Workbench solved estimate pricing is not ready to save.', 409, body));
    const { handler, unmount } = renderAndGetHandler('portal.estimate.update');

    const result = await handler({
      payload: {
        estimateId: 'estimate-1',
        estimatePayload: { status: 'draft', inputs: {}, outputs: {} },
      },
    });

    expect(result).toEqual({
      kind: 'conflict',
      message: 'Workbench solved estimate pricing is not ready to save.',
      serverSnapshot: body,
    });
    expect(result).not.toHaveProperty('clearWorkingCopy');
    expect(mocks.apiJson).toHaveBeenCalledWith('/api/estimates/estimate-1', expect.objectContaining({ method: 'PATCH' }));
    expect(mocks.invalidateProjectReadCaches).not.toHaveBeenCalled();
    expect(mocks.queryClient.invalidateQueries).not.toHaveBeenCalled();
    expect(mocks.queryClient.setQueryData).not.toHaveBeenCalled();
    unmount();
  });

  it('aliases created estimates and queues dependent design requests with the durable estimate id', async () => {
    mocks.apiJson.mockResolvedValueOnce({ estimate: minimalEstimateDetail({ id: 'estimate-9' }) });
    const { handler, unmount } = renderAndGetHandler('portal.estimate.create');

    const result = await handler({
      payload: {
        localEstimateId: 'local-estimate:9',
        projectId: 'project-1',
        estimatePayload: { status: 'draft', inputs: {}, outputs: {} },
        createDesignRequest: {
          requestSource: 'estimate_flow',
          priorityTier: 'standard',
        },
      },
    });

    expect(result).toMatchObject({ kind: 'success', clearWorkingCopy: true });
    expect(mocks.registerLocalFirstIdAlias).toHaveBeenCalledWith('local-estimate:9', 'estimate-9');
    expect(mocks.enqueueAndProcessLocalFirstMutation).toHaveBeenCalledWith({
      entityKey: 'design-request:project-1:estimate-9',
      mutationKey: 'portal.designRequest.create',
      payload: {
        projectId: 'project-1',
        estimateId: 'estimate-9',
        requestSource: 'estimate_flow',
        priorityTier: 'standard',
      },
    });
    unmount();
  });

  it('keeps blocked workbench pricing estimate creates visible without aliasing or dependent actions', async () => {
    const body = { code: 'ESTIMATE_PRICING_SOURCE_BLOCKED', readinessReport: { blockingGateCodes: ['commercial_parity_stable'] } };
    mocks.apiJson.mockRejectedValueOnce(apiError('Workbench solved estimate pricing is not ready to save.', 409, body));
    const { handler, unmount } = renderAndGetHandler('portal.estimate.create');

    const result = await handler({
      payload: {
        localEstimateId: 'local-estimate:blocked',
        projectId: 'project-1',
        estimatePayload: { status: 'draft', inputs: {}, outputs: {} },
        createDesignRequest: {
          requestSource: 'estimate_flow',
          priorityTier: 'standard',
        },
      },
    });

    expect(result).toEqual({
      kind: 'conflict',
      message: 'Workbench solved estimate pricing is not ready to save.',
      serverSnapshot: body,
    });
    expect(result).not.toHaveProperty('clearWorkingCopy');
    expect(mocks.registerLocalFirstIdAlias).not.toHaveBeenCalled();
    expect(mocks.enqueueAndProcessLocalFirstMutation).not.toHaveBeenCalled();
    const createBody = JSON.parse(mocks.apiJson.mock.calls[0]?.[1]?.body as string);
    expect(createBody).toEqual({
      calculator_snapshot: {
        inputs: {},
        outputs: {
          derived: {},
          projectSnapshot: null,
          snapshot: null,
          configVersions: null,
        },
      },
    });
    expect(JSON.stringify(createBody)).not.toContain('pricing_source');
    expect(JSON.stringify(createBody)).not.toContain('workbench_solved');
    expect(JSON.stringify(createBody)).not.toContain('readiness');
    expect(mocks.invalidateProjectReadCaches).not.toHaveBeenCalled();
    expect(mocks.queryClient.setQueryData).not.toHaveBeenCalled();
    unmount();
  });

  it('retries quote creation until the source estimate id has synced', async () => {
    mocks.resolveLocalFirstId.mockReturnValueOnce('local-estimate:1');
    const { handler, unmount } = renderAndGetHandler('portal.quote.createFromEstimate');

    const result = await handler({
      payload: {
        localQuoteId: 'local-quote:1',
        projectId: 'project-1',
        estimateId: 'local-estimate:1',
      },
    });

    expect(result).toMatchObject({ kind: 'retry', status: 'queued' });
    expect(mocks.apiJson).not.toHaveBeenCalled();
    unmount();
  });

  it('aliases created quote drafts after the staff quote route returns a durable id', async () => {
    mocks.resolveLocalFirstId.mockReturnValueOnce('estimate-1');
    mocks.apiJson.mockResolvedValueOnce({ quoteVersion: minimalQuoteDetail({ id: 'quote-9' }) });
    const { handler, unmount } = renderAndGetHandler('portal.quote.createFromEstimate');

    const result = await handler({
      payload: {
        localQuoteId: 'local-quote:9',
        projectId: 'project-1',
        estimateId: 'local-estimate:1',
      },
    });

    expect(result).toMatchObject({ kind: 'success', clearWorkingCopy: true });
    expect(mocks.apiJson).toHaveBeenCalledWith('/api/projects/project-1/quotes', expect.objectContaining({ method: 'POST' }));
    expect(mocks.registerLocalFirstIdAlias).toHaveBeenCalledWith('local-quote:9', 'quote-9');
    unmount();
  });

  it('keeps blocked quote handoffs as local-first conflicts instead of retrying', async () => {
    const body = { error: 'Quote handoff blocked: Pool blind needs valid dimensions.' };
    mocks.resolveLocalFirstId.mockReturnValueOnce('estimate-1');
    mocks.apiJson.mockRejectedValueOnce(apiError(body.error, 422, body));
    const { handler, unmount } = renderAndGetHandler('portal.quote.createFromEstimate');

    const result = await handler({
      payload: {
        localQuoteId: 'local-quote:blocked',
        projectId: 'project-1',
        estimateId: 'local-estimate:1',
      },
    });

    expect(result).toEqual({
      kind: 'conflict',
      message: body.error,
      serverSnapshot: body,
    });
    expect(mocks.registerLocalFirstIdAlias).not.toHaveBeenCalled();
    unmount();
  });

  it('keeps locked quote draft updates as local-first conflicts', async () => {
    const body = { error: 'Quote is locked' };
    mocks.resolveLocalFirstId.mockReturnValueOnce('quote-1');
    mocks.apiJson.mockRejectedValueOnce(apiError('Quote is locked', 423, body));
    const { handler, unmount } = renderAndGetHandler('portal.quote.updateDraft');

    const result = await handler({
      payload: {
        quoteVersionId: 'quote-1',
        patch: { reference: 'Updated reference' },
      },
    });

    expect(result).toEqual({
      kind: 'conflict',
      message: 'Quote is locked',
      serverSnapshot: body,
    });
    expect(mocks.apiJson).toHaveBeenCalledWith('/api/quotes/quote-1', expect.objectContaining({ method: 'PATCH' }));
    unmount();
  });

  it('keeps terminal design request errors as conflicts after estimate aliases resolve', async () => {
    const body = { error: 'Estimate is locked' };
    mocks.resolveLocalFirstId.mockReturnValueOnce('estimate-1');
    mocks.apiJson.mockRejectedValueOnce(apiError('Estimate is locked', 423, body));
    const { handler, unmount } = renderAndGetHandler('portal.designRequest.create');

    const result = await handler({
      payload: {
        projectId: 'project-1',
        estimateId: 'local-estimate:1',
        requestSource: 'estimate_flow',
        priorityTier: null,
      },
    });

    expect(result).toEqual({
      kind: 'conflict',
      message: 'Estimate is locked',
      serverSnapshot: body,
    });
    expect(mocks.apiJson).toHaveBeenCalledWith(
      '/api/staff/v1/design-packages/request',
      expect.objectContaining({ method: 'POST' }),
    );
    unmount();
  });

  it('keeps estimate notes validation failures as conflicts', async () => {
    const body = { error: 'Notes are no longer editable' };
    mocks.resolveLocalFirstId.mockReturnValueOnce('estimate-1');
    mocks.apiJson.mockRejectedValueOnce(apiError('Notes are no longer editable', 400, body));
    const { handler, unmount } = renderAndGetHandler('portal.estimate.notes.update');

    const result = await handler({
      payload: {
        estimateId: 'estimate-1',
        projectId: 'project-1',
        internalNotes: 'Follow up',
      },
    });

    expect(result).toEqual({
      kind: 'conflict',
      message: 'Notes are no longer editable',
      serverSnapshot: body,
    });
    expect(mocks.apiJson).toHaveBeenCalledWith('/api/estimates/estimate-1', expect.objectContaining({ method: 'PATCH' }));
    unmount();
  });

  it('aliases created project notes to the durable id returned by the server', async () => {
    const note = {
      id: 'note-server-1',
      body: 'First note',
      authorId: 'user-1',
      authorEmail: 'a@b.test',
      authorDisplayName: null,
      createdAt: '2026-05-10T00:00:00Z',
      updatedAt: '2026-05-10T00:00:00Z',
      isOwn: true,
    };
    mocks.apiJson.mockResolvedValueOnce({ note });
    const { handler, unmount } = renderAndGetHandler('portal.project.note.create');

    const result = await handler({
      payload: {
        localNoteId: 'local-note:abc',
        projectId: 'proj_1',
        body: 'First note',
        authorOptimistic: { authorId: 'user-1', authorEmail: 'a@b.test', authorDisplayName: null },
      },
    });

    expect(result).toEqual({ kind: 'success', clearWorkingCopy: true });
    expect(mocks.apiJson).toHaveBeenCalledWith(
      '/api/staff/v1/projects/proj_1/notes',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(mocks.registerLocalFirstIdAlias).toHaveBeenCalledWith('local-note:abc', 'note-server-1');
    unmount();
  });

  it('treats forbidden project note creates as visible conflicts and rolls back the optimistic insert', async () => {
    const body = { error: 'Forbidden' };
    mocks.apiJson.mockRejectedValueOnce(apiError('Forbidden', 403, body));
    const { handler, unmount } = renderAndGetHandler('portal.project.note.create');

    const result = await handler({
      payload: {
        localNoteId: 'local-note:abc',
        projectId: 'proj_1',
        body: 'First note',
        authorOptimistic: { authorId: 'user-1', authorEmail: 'a@b.test', authorDisplayName: null },
      },
    });

    expect(result).toEqual({ kind: 'conflict', message: 'Forbidden', serverSnapshot: body });
    unmount();
  });

  it('retries project note updates until the durable note id has been aliased', async () => {
    mocks.resolveLocalFirstId.mockReturnValueOnce('local-note:pending');
    const { handler, unmount } = renderAndGetHandler('portal.project.note.update');

    const result = await handler({
      payload: { noteId: 'local-note:pending', projectId: 'proj_1', body: 'edited' },
    });

    expect((result as { kind: string }).kind).toBe('retry');
    expect(mocks.apiJson).not.toHaveBeenCalled();
    unmount();
  });

  it('treats not-found project note deletes as conflicts so the UI can resync', async () => {
    mocks.resolveLocalFirstId.mockReturnValueOnce('note-1');
    const body = { error: 'Note not found' };
    mocks.apiJson.mockRejectedValueOnce(apiError('Note not found', 404, body));
    const { handler, unmount } = renderAndGetHandler('portal.project.note.delete');

    const result = await handler({
      payload: { noteId: 'note-1', projectId: 'proj_1' },
    });

    expect(result).toEqual({ kind: 'conflict', message: 'Note not found', serverSnapshot: body });
    expect(mocks.apiJson).toHaveBeenCalledWith(
      '/api/staff/v1/projects/proj_1/notes/note-1',
      expect.objectContaining({ method: 'DELETE' }),
    );
    unmount();
  });
});
