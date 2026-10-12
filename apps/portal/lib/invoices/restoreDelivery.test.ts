import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  find: vi.fn(),
  prepare: vi.fn(),
  dispatch: vi.fn(),
  accepted: vi.fn(),
  finalise: vi.fn(),
  send: vi.fn(),
  failed: vi.fn(),
  failure: vi.fn(),
}));
vi.mock('../supabaseClient', () => ({ supabaseServiceRole: { from: mocks.from } }));
vi.mock('../emails/sendTransactionalEmail', () => ({ sendTransactionalEmail: mocks.send }));
vi.mock('../emails/invoice', () => ({
  renderDepositInvoiceEmail: async () => ({ html: '<p>New customer link</p>', text: 'New customer link' }),
}));
vi.mock('../quotes/acceptToken', () => ({
  generateAcceptToken: () => ({ token: 'new-token', tokenHash: 'new-hash' }),
}));
vi.mock('../commercial/audit', () => ({ insertCommercialAuditEvent: async () => {} }));
vi.mock('../commercial/emailIntent', () => ({
  findCommercialEmailIntentByKey: mocks.find,
  prepareCommercialEmailIntent: mocks.prepare,
  markCommercialEmailDispatching: mocks.dispatch,
  markCommercialEmailProviderAccepted: mocks.accepted,
  markCommercialEmailFinalised: mocks.finalise,
  markCommercialEmailFailed: mocks.failed,
  commercialEmailFailure: mocks.failure,
}));
import { sendDepositInvoiceNow, deliverAcceptedDepositInvoiceById, listDepositInvoicesForProject } from './server';
const id = '40000000-0000-4000-8000-000000000001';
let invoice: any;
let logs: any[];
let current: any;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('PUBLIC_SITE_URL', 'https://example.invalid');
  invoice = {
    id,
    project_id: '10000000-0000-4000-8000-000000000001',
    status: 'OPEN',
    invoice_kind: 'STANDALONE',
    invoice_ref: 'INV-TEST',
    payment_term_label: 'Work',
    restored_at: '2026-10-12T00:00:00Z',
    restore_command_id: '50000000-0000-4000-8000-000000000001',
    sent_at: '2026-08-01T00:00:00Z',
    sent_by: 'original-sender',
    due_date: '2026-08-01',
    issue_date: '2026-07-01',
    total_inc_gst_cents: 11500,
    total_ex_gst_cents: 10000,
    gst_cents: 1500,
    pdf_file_id: 'file',
    portal_token_hash: null,
    content_snapshot: {
      version: 1,
      items: [{ id: 'line', description: 'Work', qty: 1, unitPriceIncGstCents: 11500, lineTotalIncGstCents: 11500 }],
      billingName: 'Sample',
      billingEmail: 'customer@example.invalid',
      billingAddress: '',
      notes: '',
    },
  };
  logs = [
    {
      id: 'old-log',
      deposit_invoice_id: id,
      project_id: invoice.project_id,
      delivery_intent_id: 'intent-old',
      status: 'SENT',
      created_at: '2026-08-01T00:00:00Z',
      sent_at: '2026-08-01T00:00:00Z',
      attempt_number: 1,
    },
  ];
  current = null;
  mocks.from.mockImplementation((table: string) => {
    let operation = 'read',
      patch: any,
      filters: Array<(r: any) => boolean> = [];
    const query: any = {
      select: () => query,
      eq: (key: string, value: unknown) => {
        filters.push((r) => r[key] === value);
        return query;
      },
      is: (key: string, value: unknown) => {
        filters.push((r) => r[key] === value);
        return query;
      },
      gte: (key: string, value: string) => {
        filters.push((r) => r[key] >= value);
        return query;
      },
      order: () => query,
      limit: () => query,
      update: (value: any) => {
        operation = 'update';
        patch = value;
        return query;
      },
      insert: (value: any) => {
        operation = 'insert';
        patch = value;
        return query;
      },
      single: () => execute(),
      maybeSingle: () => execute(),
      then: (yes: any, no: any) => execute(false).then(yes, no),
    };
    async function execute(single = true) {
      if (table === 'deposit_invoices') {
        if (operation === 'update') {
          if (!filters.every((filter) => filter(invoice))) return { data: null, error: null };
          Object.assign(invoice, patch);
        }
        return { data: single ? invoice : [invoice], error: null };
      }
      if (table === 'file_artifacts')
        return { data: { filename: 'INV-TEST.pdf', content_base64: 'dGVzdA==' }, error: null };
      if (table === 'deposit_invoice_send_logs') {
        if (operation === 'insert') {
          logs.push({ ...patch, created_at: new Date().toISOString() });
          return { data: null, error: null };
        }
        const matching = [...logs].reverse().filter((row) => filters.every((f) => f(row)));
        return { data: single ? matching[0] ?? null : matching, error: null };
      }
      return { data: null, error: null };
    }
    return query;
  });
  mocks.find.mockImplementation(async () => current);
  mocks.prepare.mockImplementation(
    async (input: any) =>
      (current = {
        id: 'intent-new',
        status: 'prepared',
        providerIdempotencyKey: 'provider-new',
        providerMessageId: null,
        ...input,
      }),
  );
  mocks.dispatch.mockImplementation(async () => ({ ...current, status: 'dispatching' }));
  mocks.accepted.mockImplementation(
    async () => (current = { ...current, status: 'provider_accepted', providerMessageId: 'message-new' }),
  );
  mocks.finalise.mockImplementation(async () => {
    current.status = 'finalised';
    return current;
  });
  mocks.send.mockResolvedValue({ providerMessageId: 'message-new' });
  mocks.failure.mockReturnValue({ code: 'RESEND_RATE_LIMITED', needsAttention: false });
  mocks.failed.mockImplementation(async () => (current = { ...current, status: 'failed', updatedAt: '2026-10-12T02:00:00Z' }));
});
afterEach(() => vi.unstubAllEnvs());
it('explicit send after restore uses fresh intent and token despite prior success, then replays without email', async () => {
  await sendDepositInvoiceNow(`inv_${id}`, 'admin');
  expect(mocks.prepare.mock.calls[0][0].intentKey).toBe(
    `deposit-invoice-send:${id}:restore:${invoice.restore_command_id}`,
  );
  expect(invoice.portal_token_hash).toBe('new-hash');
  expect(Date.parse(invoice.portal_token_expires_at)).toBeGreaterThan(Date.now());
  expect(logs).toHaveLength(2);
  expect(logs[0].id).toBe('old-log');
  await sendDepositInvoiceNow(`inv_${id}`, 'admin');
  expect(mocks.send).toHaveBeenCalledTimes(1);
  expect(mocks.prepare).toHaveBeenCalledTimes(1);
});
it('automatic acceptance retry cannot send a restored invoice', async () => {
  expect((await deliverAcceptedDepositInvoiceById({ invoiceUuid: id, actor: 'admin' })).sent).toBe(false);
  expect(mocks.send).not.toHaveBeenCalled();
  expect(mocks.prepare).not.toHaveBeenCalled();
});
it('a stale generation cannot overwrite the current public token during finalisation', async () => {
  mocks.send.mockImplementation(async () => {
    invoice.restore_command_id = 'later-restore';
    return { providerMessageId: 'message-new' };
  });
  await expect(sendDepositInvoiceNow(`inv_${id}`, 'admin')).rejects.toThrow(/changed during delivery/);
  expect(invoice.portal_token_hash).toBeNull();
  expect(mocks.finalise).not.toHaveBeenCalled();
});
it('provider-accepted retry finalises exact prepared token without sending twice', async () => {
  current = {
    id: 'intent-new',
    status: 'provider_accepted',
    providerMessageId: 'message-new',
    providerIdempotencyKey: 'provider-new',
    protectedPayload: {
      sentAt: '2026-10-12T01:00:00Z',
      tokenHash: 'prepared-hash',
      tokenExpiresAt: '2026-11-12T00:00:00Z',
      to: ['customer@example.invalid'],
      cc: [],
      bcc: [],
      subject: 'Invoice',
      html: 'Saved email',
      text: 'Saved email',
      attachmentFileIds: ['file'],
      actor: 'admin',
    },
  };
  await sendDepositInvoiceNow(`inv_${id}`, 'admin');
  expect(invoice.portal_token_hash).toBe('prepared-hash');
  expect(mocks.send).not.toHaveBeenCalled();
  expect(mocks.prepare).not.toHaveBeenCalled();
});

it.each(['FAILED', 'SENT'])('ignores a late old-generation %s log before and after the current send', async (status) => {
  const lateOld = { ...logs[0], id: 'late-old', status, created_at: '2099-01-01T00:00:00Z', final_failure: true };
  logs.push(lateOld);
  const projectId = `proj_${invoice.project_id}`;
  expect((await listDepositInvoicesForProject(projectId))[0].lastDeliveryStatus).toBe('NOT_SENT');
  await sendDepositInvoiceNow(`inv_${id}`, 'restored-sender');
  expect(mocks.send).toHaveBeenCalledOnce();
  logs.push({ ...lateOld, id: 'even-later-old' });
  const summary = (await listDepositInvoicesForProject(projectId))[0];
  expect(summary.lastDeliveryStatus).toBe('SENT');
  expect(summary.finalFailure).toBe(false);
  await sendDepositInvoiceNow(`inv_${id}`, 'retrying-other-sender');
  expect(mocks.send).toHaveBeenCalledOnce();
});
it('records the restored generation timestamp and frozen sender together on retries', async () => {
  const historical = { ...logs[0] };
  await sendDepositInvoiceNow(`inv_${id}`, 'restored-sender');
  expect(invoice.sent_at).toBe(current.protectedPayload.sentAt);
  expect(invoice.sent_at).not.toBe('2026-08-01T00:00:00Z');
  expect(invoice.sent_by).toBe('restored-sender');
  const pair = { at: invoice.sent_at, by: invoice.sent_by };
  await sendDepositInvoiceNow(`inv_${id}`, 'retrying-other-sender');
  expect({ at: invoice.sent_at, by: invoice.sent_by }).toEqual(pair);
  expect(logs[0]).toEqual(historical);
});

it('shows retryable current intent failure without assigning its unbound log to another generation', async () => {
  mocks.send.mockRejectedValueOnce(new Error('Rate limited'));
  await expect(sendDepositInvoiceNow(`inv_${id}`, 'restored-sender')).rejects.toThrow('Rate limited');
  expect(logs.at(-1).delivery_intent_id).toBeNull();
  logs.push({ ...logs[0], status: 'FAILED', final_failure: true, created_at: '2099-01-01T00:00:00Z' });
  const projectId = `proj_${invoice.project_id}`;
  const failed = (await listDepositInvoicesForProject(projectId))[0];
  expect(failed.lastDeliveryStatus).toBe('FAILED');
  expect(failed.finalFailure).toBe(false);
  expect(failed.lastDeliveryAttemptAt).toBe(current.updatedAt);
  await sendDepositInvoiceNow(`inv_${id}`, 'retrying-other-sender');
  expect((await listDepositInvoicesForProject(projectId))[0].lastDeliveryStatus).toBe('SENT');
  expect(invoice.sent_by).toBe('restored-sender');
});
it('does not carry the previous restored generation into a later restore', async () => {
  await sendDepositInvoiceNow(`inv_${id}`, 'first-restored-sender');
  invoice.restore_command_id = '50000000-0000-4000-8000-000000000002';
  current = null;
  logs.push({ ...logs.at(-1), status: 'FAILED', final_failure: true, created_at: '2099-01-01T00:00:00Z' });
  const summary = (await listDepositInvoicesForProject(`proj_${invoice.project_id}`))[0];
  expect(summary.lastDeliveryStatus).toBe('NOT_SENT');
  expect(summary.finalFailure).toBe(false);
});
