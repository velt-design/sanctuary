import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  getServiceSupabase: vi.fn(),
  ensureDepositInvoiceForAcceptedQuote: vi.fn(),
}));

vi.mock('@/lib/supabaseService', () => ({
  getServiceSupabase: h.getServiceSupabase,
}));

vi.mock('../../portal/lib/invoices/server', () => ({
  ensureDepositInvoiceForAcceptedQuote: h.ensureDepositInvoiceForAcceptedQuote,
}));

const QUOTE_VERSION_ID = '11111111-1111-4111-8111-111111111111';
const INVOICE_ID = '22222222-2222-4222-8222-222222222222';
const EXPIRED_AT = '2000-01-01T00:00:00.000Z';

function queryResult(data: Record<string, unknown> | null) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(async () => ({ data, error: null })),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return query;
}

function expiredQuoteClient() {
  const quoteVersion = {
    id: QUOTE_VERSION_ID,
    quote_id: '33333333-3333-4333-8333-333333333333',
    status: 'SENT',
    version_number: 1,
    created_at: '2026-01-01T00:00:00.000Z',
    sent_at: '2026-01-02T00:00:00.000Z',
    expires_at: null,
    accept_token_expires_at: EXPIRED_AT,
    pdf_file_id: null,
    customer_name: 'Customer',
    intro_text: null,
    terms_text: null,
    total_inc_gst_cents: 100,
    total_ex_gst_cents: 87,
    gst_cents: 13,
  };
  const from = vi.fn((table: string) => {
    if (table !== 'quote_versions') {
      throw new Error(`Expired quote access crossed into ${table}`);
    }
    return queryResult(quoteVersion);
  });
  return { from };
}

function expiredInvoiceClient() {
  const invoice = {
    id: INVOICE_ID,
    status: 'OPEN',
    invoice_ref: 'INV-1',
    quote_ref: 'Q-1',
    quote_version_id: QUOTE_VERSION_ID,
    quote_version_number: 1,
    issue_date: '2026-01-01',
    due_date: '2026-01-10',
    reference: null,
    customer_name: 'Customer',
    project_name: 'Project',
    project_address: 'Address',
    payment_instructions: 'Pay',
    deposit_percent: 10,
    quote_total_inc_gst_cents: 100,
    total_inc_gst_cents: 10,
    total_ex_gst_cents: 9,
    gst_cents: 1,
    portal_token_expires_at: EXPIRED_AT,
    pdf_file_id: '44444444-4444-4444-8444-444444444444',
  };
  const from = vi.fn((table: string) => {
    if (table !== 'deposit_invoices') {
      throw new Error(`Expired invoice access crossed into ${table}`);
    }
    return queryResult(invoice);
  });
  return { from };
}

describe('expired public token domain boundaries', () => {
  beforeEach(() => {
    vi.resetModules();
    h.getServiceSupabase.mockReset();
    h.ensureDepositInvoiceForAcceptedQuote.mockReset();
  });

  it('blocks quote viewing, attachment reads, and acceptance before downstream access', async () => {
    h.getServiceSupabase.mockReturnValue(expiredQuoteClient());
    const {
      acceptPublicQuoteByToken,
      downloadPublicQuoteAttachmentByToken,
      loadPublicQuoteByToken,
    } = await import('./quotes/publicQuote');

    await expect(loadPublicQuoteByToken({ quoteId: QUOTE_VERSION_ID, token: 'expired' }))
      .resolves.toEqual({ quote: null, reason: 'expired' });
    await expect(downloadPublicQuoteAttachmentByToken({
      quoteId: QUOTE_VERSION_ID,
      token: 'expired',
      fileId: '55555555-5555-4555-8555-555555555555',
    })).resolves.toMatchObject({ ok: false, code: 'expired' });
    await expect(acceptPublicQuoteByToken({ quoteId: QUOTE_VERSION_ID, token: 'expired' }))
      .resolves.toMatchObject({ ok: false, code: 'expired' });
    expect(h.ensureDepositInvoiceForAcceptedQuote).not.toHaveBeenCalled();
  });

  it('blocks invoice viewing and both document downloads before artifact access', async () => {
    h.getServiceSupabase.mockReturnValue(expiredInvoiceClient());
    const {
      loadPublicDepositInvoiceByToken,
      loadPublicDepositInvoicePdfByToken,
      loadPublicSourceQuotePdfByInvoiceToken,
    } = await import('./invoices/publicInvoice');

    await expect(loadPublicDepositInvoiceByToken({ invoiceId: INVOICE_ID, token: 'expired' }))
      .resolves.toEqual({ invoice: null, reason: 'expired' });
    await expect(loadPublicDepositInvoicePdfByToken({ invoiceId: INVOICE_ID, token: 'expired' }))
      .resolves.toBeNull();
    await expect(loadPublicSourceQuotePdfByInvoiceToken({ invoiceId: INVOICE_ID, token: 'expired' }))
      .resolves.toBeNull();
  });
});
