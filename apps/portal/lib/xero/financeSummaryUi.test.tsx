import { afterEach, expect, it, vi } from 'vitest';
import { act } from 'react';
import { renderIntoDocument } from '../../../../test/reactHarness';
import { renderToStaticMarkup } from 'react-dom/server';
import FinanceSummaryClient from '../../app/staff/payments/summary/FinanceSummaryClient';
import FinanceSummaryView from '../../app/staff/payments/summary/FinanceSummaryView';
import type { FinanceSummary } from './financeSummaryContract';
const mocks = vi.hoisted(() => ({ session: vi.fn() }));
vi.mock('./pilotAccess', () => ({ getPaymentPilotSession: mocks.session }));
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NOT_FOUND'); } }));
import Page from '../../app/staff/payments/summary/page';
import Fixture from '../../app/qa/xero-summary-fixture/page';
const period = { from: '2026-09-10', to: '2026-09-16' };
const result: FinanceSummary = { period, startedAt: '2026-09-17T00:00:00Z', checkedAt: '2026-09-17T00:00:01Z', complete: true,
  currencies: [{ currency: 'NZD', invoiced: { count: 1, excludingTaxCents: 10000, taxCents: 1500, includingTaxCents: 11500 },
    receipts: { count: 1, reconciledCents: 4000, unreconciledCents: 0, unknownReconciliationCents: 0 }, outstanding: { count: 1, amountDueCents: 4500 } }] };
let mounted: ReturnType<typeof renderIntoDocument> | undefined;
afterEach(() => { mounted?.unmount(); mounted = undefined; vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks(); });
it('makes the three bases visible rather than labelling them one revenue total', () => {
  const html = renderToStaticMarkup(<FinanceSummaryView summary={result} />);
  for (const text of ['Invoiced sales', 'Before credit notes', 'Customer invoice receipts', 'Outstanding now', 'not the period-end balance', 'reconciliation remains manual']) expect(html).toContain(text);
});
it('denies non-finance page access and disables synthetic fixtures in production', async () => {
  mocks.session.mockResolvedValue(null);
  await expect(Page()).rejects.toThrow('NOT_FOUND');
  vi.stubEnv('ENABLE_PORTAL_QA_FIXTURES', '1'); vi.stubEnv('NODE_ENV', 'production');
  expect(() => Fixture()).toThrow('NOT_FOUND');
});
it('does not read on mount; clears stale totals when dates change or a retry fails', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json(result)).mockResolvedValueOnce(new Response('private provider error', { status: 503 }));
  vi.stubGlobal('fetch', fetcher);
  mounted = renderIntoDocument(<FinanceSummaryClient initialPeriod={period} />);
  expect(fetcher).not.toHaveBeenCalled();
  await act(async () => { mounted!.container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
  expect(mounted.container.textContent).toContain('Outstanding now');
  act(() => { const field = mounted!.container.querySelector('input')!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, '2026-09-11');
    field.dispatchEvent(new Event('input', { bubbles: true })); });
  expect(mounted.container.textContent).not.toContain('Outstanding now');
  await act(async () => { mounted!.container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
  expect(mounted.container.querySelector('[role="alert"]')).not.toBeNull();
  expect(mounted.container.textContent).not.toContain('private provider error');
  expect(mounted.container.textContent).not.toContain('Outstanding now');
});
it('prevents overlapping reads and rejects mismatched or malformed response data', async () => {
  let finish!: (value: Response) => void;
  const fetcher = vi.fn().mockImplementation(() => new Promise<Response>(resolve => { finish = resolve; })); vi.stubGlobal('fetch', fetcher);
  mounted = renderIntoDocument(<FinanceSummaryClient initialPeriod={period} />);
  const form = mounted.container.querySelector('form')!;
  act(() => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(mounted.container.querySelector('fieldset')?.disabled).toBe(true);
  await act(async () => { finish(Response.json({ ...result, period: { ...period, from: '2026-09-09' } })); });
  expect(mounted.container.querySelector('[role="alert"]')).not.toBeNull();
  expect(mounted.container.textContent).not.toContain('Outstanding now');
});
