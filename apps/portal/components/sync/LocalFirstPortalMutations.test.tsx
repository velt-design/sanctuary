import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LocalFirstPortalMutations from './LocalFirstPortalMutations';
import { renderIntoDocument } from '../../../../test/reactHarness';
import { ApiError } from '@/lib/repo/apiClient';

const mocks = vi.hoisted(() => ({
  enqueueAndProcessLocalFirstMutation: vi.fn(),
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
}));

vi.mock('@/lib/localFirst/store', () => ({
  registerLocalFirstIdAlias: mocks.registerLocalFirstIdAlias,
  resolveLocalFirstId: mocks.resolveLocalFirstId,
}));

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
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('registers only the heavy-editor local-first handlers', () => {
    const rendered = renderIntoDocument(<LocalFirstPortalMutations />);

    const registeredKeys = mocks.registerLocalFirstMutationHandler.mock.calls.map(([key]) => key);

    expect(registeredKeys).toEqual(
      expect.arrayContaining([
        'portal.estimate.create',
        'portal.estimate.update',
        'portal.designRequest.create',
        'portal.quote.createFromEstimate',
        'portal.quote.updateDraft',
        'portal.estimate.notes.update',
      ]),
    );
    expect(registeredKeys).not.toContain('portal.project.details.update');
    expect(registeredKeys).not.toContain('portal.project.tasks.toggle');
    expect(registeredKeys).not.toContain('portal.contact.update');

    rendered.unmount();
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
});
