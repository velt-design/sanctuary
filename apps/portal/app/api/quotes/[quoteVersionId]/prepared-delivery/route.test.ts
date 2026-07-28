import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireStaffSession: vi.fn(),
  getPreparedQuoteDelivery: vi.fn(),
  retryPreparedQuoteDelivery: vi.fn(),
}));
const commercialMocks = vi.hoisted(() => {
  class CommercialWorkflowSchemaNotReadyError extends Error {
    constructor() {
      super('Commercial workflow upgrade is not installed.');
    }
  }
  return { CommercialWorkflowSchemaNotReadyError };
});

vi.mock('@/lib/api/staffApi', () => ({
  jsonError: (
    error: string,
    status: number,
    _diagnostics?: unknown,
    extra?: Record<string, unknown>,
  ) => Response.json({ error, ...(extra ?? {}) }, { status }),
  jsonOk: (body: unknown, status = 200) => Response.json(body, { status }),
  parseJsonBody: async (request: Request) => ({
    ok: true,
    body: await request.json(),
  }),
  requireStaffSession: mocks.requireStaffSession,
}));

vi.mock('@/lib/quotes/server', () => ({
  EmailProviderConfigError: class EmailProviderConfigError extends Error {
    status = 503;
  },
  getPreparedQuoteDelivery: mocks.getPreparedQuoteDelivery,
  retryPreparedQuoteDelivery: mocks.retryPreparedQuoteDelivery,
}));

vi.mock('@/lib/commercial/emailIntent', () => ({
  COMMERCIAL_WORKFLOW_SCHEMA_NOT_READY_CODE:
    'COMMERCIAL_WORKFLOW_SCHEMA_NOT_READY',
  isCommercialWorkflowSchemaNotReadyError: (error: unknown) =>
    error instanceof commercialMocks.CommercialWorkflowSchemaNotReadyError,
}));

const context = {
  params: Promise.resolve({ quoteVersionId: 'qv_1' }),
};

describe('prepared quote delivery route', () => {
  beforeEach(() => {
    mocks.requireStaffSession.mockReset();
    mocks.getPreparedQuoteDelivery.mockReset();
    mocks.retryPreparedQuoteDelivery.mockReset();
    mocks.requireStaffSession.mockResolvedValue({
      user: { email: 'ops@example.com' },
    });
  });

  it('returns only the safe prepared-delivery summary', async () => {
    const delivery = {
      mode: 'send',
      status: 'failed',
      to: ['customer@example.com'],
      cc: [],
      bcc: [],
      subject: 'Quote Q-001',
      bodyText: 'Prepared body with token=[redacted]',
      attachmentNames: ['Q-001.pdf'],
      preparedAt: '2026-07-28T00:00:00.000Z',
      attemptCount: 1,
      lastErrorCode: 'EMAIL_PROVIDER_TIMEOUT',
      canRetry: true,
    };
    mocks.getPreparedQuoteDelivery.mockResolvedValue(delivery);
    const { GET } = await import('./route');

    const response = await GET(
      new Request(
        'http://localhost/api/quotes/qv_1/prepared-delivery?mode=send',
      ),
      context,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ delivery });
    expect(mocks.getPreparedQuoteDelivery).toHaveBeenCalledWith(
      'qv_1',
      'send',
    );
  });

  it('retries only the frozen delivery at the expected revision', async () => {
    mocks.retryPreparedQuoteDelivery.mockResolvedValue({
      id: 'qv_1',
      status: 'SENT',
    });
    const { POST } = await import('./route');

    const response = await POST(
      new Request(
        'http://localhost/api/quotes/qv_1/prepared-delivery?mode=send',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ expectedCommercialRevision: 7 }),
        },
      ),
      context,
    );

    expect(response.status).toBe(200);
    expect(mocks.retryPreparedQuoteDelivery).toHaveBeenCalledWith(
      'qv_1',
      'send',
      7,
      'ops@example.com',
    );
  });

  it('rejects a retry without the reviewed revision', async () => {
    const { POST } = await import('./route');
    const response = await POST(
      new Request(
        'http://localhost/api/quotes/qv_1/prepared-delivery?mode=send',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}',
        },
      ),
      context,
    );

    expect(response.status).toBe(400);
    expect(mocks.retryPreparedQuoteDelivery).not.toHaveBeenCalled();
  });

  it('reports the missing commercial migration as unavailable', async () => {
    mocks.getPreparedQuoteDelivery.mockRejectedValue(
      new commercialMocks.CommercialWorkflowSchemaNotReadyError(),
    );
    const { GET } = await import('./route');

    const response = await GET(
      new Request(
        'http://localhost/api/quotes/qv_1/prepared-delivery?mode=send',
      ),
      context,
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: 'Commercial workflow upgrade is not installed.',
      code: 'COMMERCIAL_WORKFLOW_SCHEMA_NOT_READY',
    });
  });
});
