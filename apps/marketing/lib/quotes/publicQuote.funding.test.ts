import { beforeEach, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ getServiceSupabase: vi.fn(), accept: vi.fn() }));
vi.mock('@/lib/supabaseService', () => ({ getServiceSupabase: h.getServiceSupabase }));
vi.mock('../../../portal/lib/commercial/acceptQuote', () => ({ acceptQuoteAndEnsureDepositInvoice: h.accept }));
import { loadPublicQuoteByToken } from './publicQuote';
const version = '11111111-1111-4111-8111-111111111111';
function client(mode: string | null, error: object | null = null) {
  const from = vi.fn((table: string) => {
    const data = table === 'quote_versions' ? { id: version, quote_id: version, status: 'ACCEPTED', version_number: 2, created_at: '2026-01-01', accept_token_expires_at: null } : table === 'quotes' ? { id: version, quote_ref: 'Q-SYNTHETIC', project_id: null } : table === 'quote_line_items' ? [] : table === 'deposit_invoices' ? { id: version, sent_at: null } : null;
    const result = { data, error: null };
    const query: any = { then: (resolve: (value: unknown) => void) => resolve(result), maybeSingle: async () => result };
    for (const name of ['select','eq','order','limit']) query[name] = () => query;
    return query;
  });
  return { from, rpc: vi.fn(async () => ({ data: mode, error })) };
}
beforeEach(() => vi.clearAllMocks());
describe('public accepted revision reload', () => {
  it('retains manual acceptance even when a later progress invoice exists', async () => {
    const db = client('manual'); h.getServiceSupabase.mockReturnValue(db);
    expect((await loadPublicQuoteByToken({ quoteId: version, token: 'synthetic-token' })).quote?.depositInvoiceDelivery).toBe('not_required');
    expect(db.from.mock.calls.some(([table]) => table === 'deposit_invoices')).toBe(false);
  });
  it('does not claim an invoice is prepared when the acceptance receipt cannot be read', async () => {
    const db = client(null, { message: 'Synthetic unavailable' }); h.getServiceSupabase.mockReturnValue(db);
    expect((await loadPublicQuoteByToken({ quoteId: version, token: 'synthetic-token' })).quote?.depositInvoiceDelivery).toBe('not_prepared');
    expect(db.from.mock.calls.some(([table]) => table === 'deposit_invoices')).toBe(false);
  });
  it('continues scheduled invoice delivery lookup for historical acceptances', async () => {
    const db = client(null); h.getServiceSupabase.mockReturnValue(db);
    expect((await loadPublicQuoteByToken({ quoteId: version, token: 'synthetic-token' })).quote?.depositInvoiceDelivery).toBe('prepared');
  });
});
