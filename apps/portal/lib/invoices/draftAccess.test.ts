import { describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('../supabaseClient', () => ({ supabaseServiceRole: { from: h.from } }));

describe('draft access through issued-invoice readers', () => {
  it('denies staff artifact and PDF previews before creating payment content', async () => {
    const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(async () => ({
      data: { id: '10000000-0000-4000-8000-000000000001', status: 'DRAFT' }, error: null,
    })) };
    query.select.mockReturnValue(query); query.eq.mockReturnValue(query); h.from.mockReturnValue(query);
    const { getDepositInvoiceArtifactPreview, getDepositInvoicePdfPreview } = await import('./server');
    const id = 'inv_10000000-0000-4000-8000-000000000001';
    expect(await getDepositInvoiceArtifactPreview(id)).toBeNull();
    expect(await getDepositInvoicePdfPreview(id)).toBeNull();
    expect(h.from.mock.calls).toEqual([['deposit_invoices'], ['deposit_invoices']]);
  });
});
