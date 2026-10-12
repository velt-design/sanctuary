import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  find: vi.fn(),
  prepare: vi.fn(),
  dispatch: vi.fn(),
  accepted: vi.fn(),
  finalise: vi.fn(),
  send: vi.fn(),
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
  markCommercialEmailFailed: vi.fn(),
  commercialEmailFailure: vi.fn(),
}));
import { sendDepositInvoiceNow, deliverAcceptedDepositInvoiceById } from './server';
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
      then: (yes: any, no: any) => execute().then(yes, no),
    };
    async function execute() {
      if (table === 'deposit_invoices') {
        if (operation === 'update') {
          if (!filters.every((filter) => filter(invoice))) return { data: null, error: null };
          Object.assign(invoice, patch);
        }
        return { data: invoice, error: null };
      }
      if (table === 'file_artifacts')
        return { data: { filename: 'INV-TEST.pdf', content_base64: 'dGVzdA==' }, error: null };
      if (table === 'deposit_invoice_send_logs') {
        if (operation === 'insert') {
          logs.push({ ...patch, created_at: new Date().toISOString() });
          return { data: null, error: null };
        }
        return { data: [...logs].reverse().find((row) => filters.every((f) => f(row))) ?? null, error: null };
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
