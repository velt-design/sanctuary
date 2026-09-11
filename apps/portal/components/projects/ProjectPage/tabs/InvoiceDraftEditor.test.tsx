import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../../test/reactHarness';
import InvoiceDraftEditor from './InvoiceDraftEditor';
import type { InvoiceDraft } from '@/lib/invoices/draftTypes';

const api = vi.hoisted(() => vi.fn());
vi.mock('@/lib/repo/apiClient', () => ({ apiJson: api }));
vi.mock('@/components/ui/PipelineModal', () => ({ PipelineModal: ({ children, actions }: any) => <section>{children}{actions}</section> }));
const draft: InvoiceDraft = { id: 'inv_40000000-0000-4000-8000-000000000001', projectId: 'proj_10000000-0000-4000-8000-000000000001',
  quoteVersionId: 'qv_30000000-0000-4000-8000-000000000001', revision: 3, scopeTotalIncGstCents: 11500, amountIncGstCents: 5750,
  options: { mode: 'custom', label: 'Deposit', amountIncGstCents: 5750, dueDate: '2026-09-30' },
  content: { version: 1, billingName: 'Customer', billingEmail: 'customer@example.invalid', billingAddress: '', notes: 'Saved note',
    items: [{ id: 'line-1', description: 'Saved item wording', qty: 2, unitPriceIncGstCents: 5750, lineTotalIncGstCents: 11500 }] } };
afterEach(() => { api.mockReset(); document.body.innerHTML = ''; });
function button(container: HTMLElement, label: string) {
  return [...container.querySelectorAll('button')].find((item) => item.textContent === label)!;
}
describe('InvoiceDraftEditor', () => {
  it('restores saved content, locks quoted prices and issues once without recreating after a send failure', async () => {
    const onIssued = vi.fn().mockResolvedValue(undefined); const onClose = vi.fn();
    api.mockResolvedValue({ issued: true, invoiceRef: 'INV-TEST', sendError: 'Provider unavailable' });
    const rendered = renderIntoDocument(<InvoiceDraftEditor initial={draft} onClose={onClose} onSaved={vi.fn()} onIssued={onIssued} />);
    expect([...rendered.container.querySelectorAll('textarea')].map((item) => item.value)).toContain('Saved item wording');
    const numeric = [...rendered.container.querySelectorAll<HTMLInputElement>('input[type="number"]')];
    expect(numeric[0].readOnly).toBe(true); expect(numeric[1].readOnly).toBe(true);
    await act(async () => { button(rendered.container, 'Issue and send').click(); button(rendered.container, 'Issue and send').click(); });
    expect(api).toHaveBeenCalledTimes(1);
    expect(JSON.parse(api.mock.calls[0][1].body)).toMatchObject({ action: 'issue', expectedRevision: 3, send: true });
    expect(onIssued).toHaveBeenCalledWith('Invoice INV-TEST issued.', 'Provider unavailable');
    expect(onClose).toHaveBeenCalledTimes(1);
    rendered.unmount();
  });
  it('requires saving item edits before issue and retains them when a stale revision is rejected', async () => {
    api.mockRejectedValue(new Error('Draft changed; reload before saving'));
    const rendered = renderIntoDocument(<InvoiceDraftEditor initial={{ ...draft, quoteVersionId: null }} onClose={vi.fn()} onSaved={vi.fn()} onIssued={vi.fn()} />);
    const numeric = rendered.container.querySelector<HTMLInputElement>('input[type="number"]')!;
    expect(numeric.readOnly).toBe(false);
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(numeric, '3');
      numeric.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(button(rendered.container, 'Issue invoice').disabled).toBe(true);
    await act(async () => { button(rendered.container, 'Save draft').click(); });
    expect(rendered.container.textContent).toContain('Draft changed; reload before saving');
    expect(numeric.value).toBe('3');
    expect(JSON.parse(api.mock.calls[0][1].body).content.items[0].lineTotalIncGstCents).toBe(17250);
    rendered.unmount();
  });
});
