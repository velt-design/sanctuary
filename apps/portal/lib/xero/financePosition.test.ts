import { describe, expect, it, vi } from 'vitest';
import { readFinancePosition, type PositionDependencies } from './financePosition';
import { financePositionQuery, financePositionSchema } from './financePositionContract';
import { PositionReadError, type PositionRead } from './financePositionProvider';
const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const query = { from: '2026-09-01', to: '2026-09-23', basis: 'accrual' as const };
const rawInvoice = (n: number, type = 'ACCREC') => ({ InvoiceID: id(n), InvoiceNumber: `SYN-${n}`, Type: type, Status: 'AUTHORISED',
  Contact: { ContactID: id(2), Name: 'Synthetic contact' }, DateString: '2025-12-01', DueDateString: '2026-10-01', CurrencyCode: 'NZD',
  Total: 115.12, AmountDue: 100.12, AmountPaid: 10, AmountCredited: 5, UpdatedDateUTC: '/Date(1788998400000+0000)/',
  LineItems: [{ Description: 'Synthetic work', AccountCode: '200', LineAmount: 100.12, TaxAmount: 15 }] });
const rawReport = (name: string) => ({ ReportID: name, ReportName: name, ReportTitles: [name, 'Synthetic organisation'], ReportDate: '23 September 2026',
  Rows: [{ RowType: 'Header', Cells: [{ Value: '' }, { Value: '2026-09-01 to 2026-09-23' }] },
    { RowType: 'Section', Title: 'Income', Rows: [{ RowType: 'Row', Cells: [{ Value: 'Synthetic account', Attributes: [{ Id: 'account', Value: id(5) }] }, { Value: '123.45' }] }] },
    { RowType: 'SummaryRow', Cells: [{ Value: 'Net Profit' }, { Value: '123.45' }] }] });
function fixture(): PositionDependencies & { read: ReturnType<typeof vi.fn> } {
  return { now: () => new Date('2026-09-23T01:00:00Z'), binding: vi.fn(async () => ({ tenantId: id(1), scope: 'organisation' as const })),
    read: vi.fn(async (input: PositionRead) => input.family === 'organisation'
      ? [{ OrganisationID: id(1), Name: 'Synthetic organisation', BaseCurrency: 'NZD', Timezone: 'NEWZEALANDSTANDARDTIME' }]
      : input.family === 'bankSummary' ? [rawReport('BankSummary')] : input.family === 'profitAndLoss' ? [rawReport('ProfitAndLoss')]
        : [rawInvoice(input.family === 'receivables' ? 10 : 11, input.family === 'receivables' ? 'ACCREC' : 'ACCPAY')]) };
}
const run = (deps = fixture()) => readFinancePosition(query, deps, new AbortController().signal);
describe('organisation finance position', () => {
  it('preserves separate current invoice populations and full dated report evidence without invented economic totals', async () => {
    const result = await run();
    expect(result.receivables).toMatchObject({ status: 'available', data: { count: 1, items: [{ date: '2025-12-01', amountDue: '100.12', amountCredited: '5' }] } });
    expect(result.payables).toMatchObject({ status: 'available', data: { items: [{ type: 'ACCPAY', dueDate: '2026-10-01' }] } });
    expect(result.bankSummary).toMatchObject({ data: { basis: 'bank_movements', interpretation: 'accounting_bank_balances_not_spendable_cash' } });
    expect(result.profitAndLoss).toMatchObject({ data: { basis: 'accrual', rows: rawReport('ProfitAndLoss').Rows.map(row => expect.objectContaining({ type: row.RowType })) } });
    expect(result).not.toHaveProperty('cashTotal');
  });
  it('supports annual periods and denies invalid/future dates', async () => {
    expect(financePositionQuery.safeParse({ ...query, from: '2026-01-01', to: '2026-12-31' }).success).toBe(true);
    expect(financePositionQuery.safeParse({ ...query, from: '2024-01-01' }).success).toBe(false);
    expect(financePositionQuery.safeParse({ ...query, from: '2026-02-30' }).success).toBe(false);
    await expect(readFinancePosition({ ...query, to: '2026-09-24' }, fixture(), new AbortController().signal)).rejects.toThrow('POSITION_INVALID_QUERY');
  });
  it('keeps missing report scopes unavailable without erasing verified balances', async () => {
    const deps = fixture(), original = deps.read;
    deps.read = vi.fn(async input => { if (input.family === 'profitAndLoss') throw new PositionReadError('missing_scope'); return original(input, new AbortController().signal); });
    const result = await run(deps); expect(result.profitAndLoss).toEqual({ status: 'unavailable', reason: 'missing_scope', requiredScopes: ['accounting.reports.profitandloss.read'] });
    expect(result.payables.status).toBe('available');
  });
  it('requires verified organisation metadata for report currency, while document currencies remain independently usable', async () => {
    const deps = fixture(), original = deps.read;
    deps.read = vi.fn(async input => input.family === 'organisation' ? [] : original(input, new AbortController().signal));
    const result = await run(deps); expect(result.bankSummary).toMatchObject({ reason: 'metadata_unavailable' }); expect(result.payables.status).toBe('available');
  });
  it('pages every outstanding record, rejects repeated IDs and never calls the first page complete', async () => {
    const deps = fixture(), original = deps.read;
    deps.read = vi.fn(async input => input.family === 'receivables' ? input.page === 1 ? Array.from({ length: 100 }, (_, n) => rawInvoice(n + 100)) : [rawInvoice(300)] : original(input, new AbortController().signal));
    expect((await run(deps)).receivables).toMatchObject({ data: { count: 101 } });
    deps.read = vi.fn(async input => input.family === 'receivables' ? [rawInvoice(1), rawInvoice(1)] : original(input, new AbortController().signal));
    expect((await run(deps)).receivables).toMatchObject({ reason: 'invalid_response' });
  });
  it('overflow rejects the whole family rather than advertising truncated completion', async () => {
    const deps = fixture(), original = deps.read;
    deps.read = vi.fn(async input => input.family === 'receivables' ? Array.from({ length: 100 }, (_, n) => rawInvoice(input.page * 100 + n)) : original(input, new AbortController().signal));
    expect((await run(deps)).receivables).toMatchObject({ status: 'unavailable', reason: 'limit_exceeded' });
  });
  it('denies malformed currency, wrong family, negative due, missing amounts and wrong organisation', async () => {
    for (const change of [{ CurrencyCode: '???' }, { Type: 'ACCPAY' }, { AmountDue: -2 }, { AmountPaid: undefined }]) {
      const deps = fixture(), original = deps.read;
      deps.read = vi.fn(async input => input.family === 'receivables' ? [{ ...rawInvoice(9), ...change }] : original(input, new AbortController().signal));
      expect((await run(deps)).receivables.status).toBe('unavailable');
    }
    const deps = fixture(), original = deps.read;
    deps.read = vi.fn(async input => input.family === 'organisation' ? [{ OrganisationID: id(9) }] : original(input, new AbortController().signal));
    expect((await run(deps)).organisation.status).toBe('unavailable');
  });
  it('checks authority before each family/page and after collection; revocation aborts everything', async () => {
    const deps = fixture(); const good = deps.binding;
    let calls = 0; deps.binding = vi.fn(async signal => { if (++calls === 7) throw new Error('REVOKED'); return good(signal); });
    await expect(run(deps)).rejects.toThrow('REVOKED'); expect(deps.read).toHaveBeenCalledTimes(5);
  });
  it('propagates caller abort and never publishes interrupted evidence', async () => {
    const abort = new AbortController(); abort.abort();
    await expect(readFinancePosition(query, fixture(), abort.signal)).rejects.toThrow();
  });
  it('bounds deeply nested retained report wire before recursive validation', async () => {
    const result = await run(); if (result.profitAndLoss.status !== 'available') throw new Error('fixture');
    let row = { type: 'Section', title: null, cells: [], rows: [] } as unknown as Record<string, unknown>;
    for (let n = 0; n < 10000; n++) row = { type: 'Section', title: null, cells: [], rows: [row] };
    result.profitAndLoss.data.rows = [row] as never;
    expect(financePositionSchema.safeParse(result).success).toBe(false);
  });
});
