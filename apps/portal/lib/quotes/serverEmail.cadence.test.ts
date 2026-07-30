import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommercialEmailIntent } from '@/lib/commercial/emailIntent';

const mocks = vi.hoisted(() => ({
  findCommercialEmailIntentByKey: vi.fn(),
  findUnfinishedCommercialEmailIntent: vi.fn(),
  markCommercialEmailDispatching: vi.fn(),
  markCommercialEmailFailed: vi.fn(),
  markCommercialEmailFinalised: vi.fn(),
  markCommercialEmailProviderAccepted: vi.fn(),
  prepareCommercialEmailIntent: vi.fn(),
  prepareQuoteDeliveryEmailIntent: vi.fn(),
  sendTransactionalEmail: vi.fn(),
  createFileArtifact: vi.fn(),
  ensurePdfForSend: vi.fn(),
  ensureQuoteArtifacts: vi.fn(),
  getQuoteVersionDetail: vi.fn(),
  insertAuditEvent: vi.fn(),
  insertSendLog: vi.fn(),
  updateProjectStage: vi.fn(),
  reconcileQuoteDeliveryCadence: vi.fn(),
  quoteVersionUpdateEq: vi.fn(),
  supabaseServiceRole: {
    from: vi.fn(),
  },
}));

vi.mock('@/lib/commercial/emailIntent', () => ({
  commercialEmailFailure: () => ({
    code: 'EMAIL_DELIVERY_FAILED',
    needsAttention: false,
  }),
  findCommercialEmailIntentByKey: mocks.findCommercialEmailIntentByKey,
  findUnfinishedCommercialEmailIntent:
    mocks.findUnfinishedCommercialEmailIntent,
  markCommercialEmailDispatching: mocks.markCommercialEmailDispatching,
  markCommercialEmailFailed: mocks.markCommercialEmailFailed,
  markCommercialEmailFinalised: mocks.markCommercialEmailFinalised,
  markCommercialEmailProviderAccepted:
    mocks.markCommercialEmailProviderAccepted,
  prepareCommercialEmailIntent: mocks.prepareCommercialEmailIntent,
  prepareQuoteDeliveryEmailIntent: mocks.prepareQuoteDeliveryEmailIntent,
}));

vi.mock('@/lib/emails/sendTransactionalEmail', () => ({
  sendTransactionalEmail: mocks.sendTransactionalEmail,
}));

vi.mock('@/lib/quotes/acceptToken', () => ({
  generateAcceptToken: () => ({ token: 'token', tokenHash: 'token-hash' }),
}));

vi.mock('@/lib/projects/workItems/quoteCadenceReconciliation', () => ({
  reconcileQuoteDeliveryCadence: mocks.reconcileQuoteDeliveryCadence,
}));

vi.mock('@/lib/supabaseClient', () => ({
  supabaseServiceRole: mocks.supabaseServiceRole,
}));

vi.mock('./serverCore', () => ({
  createFileArtifact: mocks.createFileArtifact,
  ensurePdfForSend: mocks.ensurePdfForSend,
  ensureQuoteArtifacts: mocks.ensureQuoteArtifacts,
  getQuoteVersionDetail: mocks.getQuoteVersionDetail,
  insertAuditEvent: mocks.insertAuditEvent,
  insertSendLog: mocks.insertSendLog,
  updateProjectStage: mocks.updateProjectStage,
}));

vi.mock('./renderArtifacts', () => ({
  buildQuotePreviewBasePayload: vi.fn(),
  isQuotePreviewBasePayload: () => false,
  quoteLogoUrl: () => 'https://example.test/logo.svg',
  quoteNumber: () => 'Q-1001',
  renderExpiresLabel: () => '31 July 2026',
  renderQuotePreviewFromBasePayload: vi.fn(),
}));

import { resendQuote, sendQuote } from './serverEmail';

const PROJECT_UUID = '11111111-1111-4111-8111-111111111111';
const QUOTE_VERSION_UUID = '22222222-2222-4222-8222-222222222222';
const PROJECT_ID = `proj_${PROJECT_UUID}`;
const QUOTE_VERSION_ID = `qv_${QUOTE_VERSION_UUID}`;

const DETAIL = {
  id: QUOTE_VERSION_ID,
  projectId: PROJECT_ID,
  status: 'SENT',
  sentAt: '2026-07-06T03:00:00.000Z',
  expiresAt: '2026-07-31',
  commercialRevision: 1,
} as any;

function intent(
  status: CommercialEmailIntent['status'],
  mode: 'send' | 'resend',
): CommercialEmailIntent {
  return {
    id: `33333333-3333-4333-8333-33333333333${mode === 'send' ? '3' : '4'}`,
    intentKey: `${mode}:${QUOTE_VERSION_UUID}:intent-1`,
    kind: mode === 'send' ? 'quote_send' : 'quote_resend',
    subjectId: QUOTE_VERSION_UUID,
    projectId: PROJECT_UUID,
    payloadHash: 'payload-hash',
    protectedPayload: {
      mode,
      commercialRevision: 1,
      sentAt: '2026-07-06T03:00:00.000Z',
      expiresAt: '2026-07-31',
      acceptTokenHash: 'accept-token-hash',
      acceptTokenExpiresAt: '2026-07-31T23:59:59.999Z',
      to: ['customer@example.test'],
      cc: [],
      bcc: [],
      subject: 'Quote ready - Q-1001',
      html: '<p>Quote</p>',
      text: 'Quote',
      attachmentFileIds: [],
      actor: 'staff@example.test',
    },
    status,
    providerName: 'resend',
    providerIdempotencyKey: 'provider-key',
    providerIdempotencyExpiresAt: '2026-07-07T03:00:00.000Z',
    providerMessageId: 'provider-message-1',
    attemptCount: 1,
    lastErrorCode: null,
    createdAt: '2026-07-06T02:00:00.000Z',
    updatedAt: '2026-07-06T03:00:00.000Z',
  };
}

function payload(mode: 'send' | 'resend') {
  return {
    intentId: `${mode}-intent-1`,
    expectedCommercialRevision: 1,
    to: ['customer@example.test'],
  };
}

describe('quote delivery cadence reconciliation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.supabaseServiceRole.from.mockReturnValue({
      update: vi.fn(() => ({ eq: mocks.quoteVersionUpdateEq })),
    });
    mocks.quoteVersionUpdateEq.mockResolvedValue({ error: null });
    mocks.getQuoteVersionDetail.mockResolvedValue(DETAIL);
    mocks.insertSendLog.mockResolvedValue('send-log-1');
    mocks.ensureQuoteArtifacts.mockResolvedValue({});
    mocks.markCommercialEmailFinalised.mockImplementation(
      async (id: string) => ({ ...intent('finalised', 'send'), id }),
    );
    mocks.reconcileQuoteDeliveryCadence.mockResolvedValue({
      status: 'reconciled',
      workModel: 'v2',
      replayed: false,
    });
  });

  it.each([
    ['send', 'QUOTE_SENT'],
    ['resend', 'QUOTE_RESENT'],
  ] as const)(
    'retries %s reconciliation when the delivery intent is already finalised',
    async (mode, event) => {
      const finalised = intent('finalised', mode);
      mocks.findCommercialEmailIntentByKey.mockResolvedValue(finalised);

      const result = mode === 'send'
        ? await sendQuote(QUOTE_VERSION_ID, payload(mode), 'staff@example.test')
        : await resendQuote(QUOTE_VERSION_ID, payload(mode), 'staff@example.test');

      expect(result).toBe(DETAIL);
      expect(mocks.reconcileQuoteDeliveryCadence).toHaveBeenCalledWith({
        serviceClient: mocks.supabaseServiceRole,
        projectId: PROJECT_UUID,
        quoteVersionId: QUOTE_VERSION_UUID,
        deliveryIntentId: finalised.id,
        event,
      });
      expect(mocks.markCommercialEmailFinalised).not.toHaveBeenCalled();
      expect(mocks.insertSendLog).not.toHaveBeenCalled();
    },
  );

  it('reconciles only after the delivery intent is durably finalised', async () => {
    const providerAccepted = intent('provider_accepted', 'send');
    mocks.findCommercialEmailIntentByKey.mockResolvedValue(providerAccepted);
    mocks.reconcileQuoteDeliveryCadence.mockResolvedValueOnce({
      status: 'repair_required',
      workModel: 'v2',
      message: 'calendar unavailable',
    });

    await expect(
      sendQuote(QUOTE_VERSION_ID, payload('send'), 'staff@example.test'),
    ).resolves.toBe(DETAIL);
    expect(mocks.markCommercialEmailFinalised).toHaveBeenCalledWith(
      providerAccepted.id,
    );
    expect(
      mocks.markCommercialEmailFinalised.mock.invocationCallOrder[0],
    ).toBeLessThan(
      mocks.reconcileQuoteDeliveryCadence.mock.invocationCallOrder[0],
    );
    expect(mocks.reconcileQuoteDeliveryCadence).toHaveBeenCalledWith({
      serviceClient: mocks.supabaseServiceRole,
      projectId: PROJECT_UUID,
      quoteVersionId: QUOTE_VERSION_UUID,
      deliveryIntentId: providerAccepted.id,
      event: 'QUOTE_SENT',
    });
  });

  it('does not start cadence when durable finalisation fails', async () => {
    const providerAccepted = intent('provider_accepted', 'send');
    mocks.findCommercialEmailIntentByKey.mockResolvedValue(providerAccepted);
    mocks.markCommercialEmailFinalised.mockRejectedValueOnce(
      new Error('finalisation failed'),
    );

    await expect(
      sendQuote(QUOTE_VERSION_ID, payload('send'), 'staff@example.test'),
    ).rejects.toThrow('finalisation failed');
    expect(mocks.reconcileQuoteDeliveryCadence).not.toHaveBeenCalled();
  });
});
