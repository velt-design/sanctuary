import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireStaffSession: vi.fn(),
  sendQuote: vi.fn(),
  resendQuote: vi.fn(),
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
  sendQuote: mocks.sendQuote,
  resendQuote: mocks.resendQuote,
}));

vi.mock('@/lib/commercial/emailIntent', () => ({
  COMMERCIAL_WORKFLOW_SCHEMA_NOT_READY_CODE:
    'COMMERCIAL_WORKFLOW_SCHEMA_NOT_READY',
  isCommercialWorkflowSchemaNotReadyError: (error: unknown) =>
    error instanceof commercialMocks.CommercialWorkflowSchemaNotReadyError,
}));

function request(body: Record<string, unknown>) {
  return new Request('http://localhost/api/quotes/qv_1/send', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const context = {
  params: Promise.resolve({ quoteVersionId: 'qv_1' }),
};

describe('quote delivery route owner', () => {
  beforeEach(() => {
    mocks.requireStaffSession.mockReset();
    mocks.sendQuote.mockReset();
    mocks.resendQuote.mockReset();
    mocks.requireStaffSession.mockResolvedValue({
      user: { email: 'ops@example.com' },
    });
  });

  it('passes the reviewed commercial revision and stable intent to send', async () => {
    mocks.sendQuote.mockResolvedValue({ id: 'qv_1', status: 'SENT' });
    const { handleQuoteDeliveryRequest } = await import(
      './quoteDeliveryRoute'
    );

    const response = await handleQuoteDeliveryRequest(
      request({
        intentId: 'quote-delivery:test-1',
        expectedCommercialRevision: 7,
        to: ['customer@example.com'],
        subject: 'Your quote',
      }),
      context,
      'send',
    );

    expect(response.status).toBe(200);
    expect(mocks.sendQuote).toHaveBeenCalledWith(
      'qv_1',
      expect.objectContaining({
        intentId: 'quote-delivery:test-1',
        expectedCommercialRevision: 7,
        to: ['customer@example.com'],
      }),
      'ops@example.com',
    );
    expect(mocks.resendQuote).not.toHaveBeenCalled();
  });

  it('fails closed when the reviewed commercial revision is absent', async () => {
    const { handleQuoteDeliveryRequest } = await import(
      './quoteDeliveryRoute'
    );
    const response = await handleQuoteDeliveryRequest(
      request({
        intentId: 'quote-delivery:test-1',
        to: ['customer@example.com'],
        subject: 'Your quote',
      }),
      context,
      'send',
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Quote commercial revision is required',
    });
    expect(mocks.sendQuote).not.toHaveBeenCalled();
  });

  it('returns a conflict when the reviewed quote is stale', async () => {
    mocks.resendQuote.mockRejectedValue(
      new Error(
        'Quote changed after this delivery review. Review it again before sending.',
      ),
    );
    const { handleQuoteDeliveryRequest } = await import(
      './quoteDeliveryRoute'
    );
    const response = await handleQuoteDeliveryRequest(
      request({
        intentId: 'quote-delivery:test-1',
        expectedCommercialRevision: 7,
        to: ['customer@example.com'],
        subject: 'Your quote',
      }),
      context,
      'resend',
    );

    expect(response.status).toBe(409);
  });

  it('reports schema readiness without attempting an unsafe fallback', async () => {
    mocks.sendQuote.mockRejectedValue(
      new commercialMocks.CommercialWorkflowSchemaNotReadyError(),
    );
    const { handleQuoteDeliveryRequest } = await import(
      './quoteDeliveryRoute'
    );
    const response = await handleQuoteDeliveryRequest(
      request({
        intentId: 'quote-delivery:test-1',
        expectedCommercialRevision: 7,
        to: ['customer@example.com'],
        subject: 'Your quote',
      }),
      context,
      'send',
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: 'Commercial workflow upgrade is not installed.',
      code: 'COMMERCIAL_WORKFLOW_SCHEMA_NOT_READY',
    });
  });
});
