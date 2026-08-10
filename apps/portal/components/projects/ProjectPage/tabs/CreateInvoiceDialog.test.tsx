import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../../test/reactHarness';
import type { ProjectInvoiceSchedule } from '@/lib/invoices/types';
import CreateInvoiceDialog from './CreateInvoiceDialog';

vi.mock('@/components/ui/modal/Modal', () => ({
  default: ({ open, ariaLabel, children }: any) => open ? <section role="dialog" aria-label={ariaLabel}>{children}</section> : null,
}));

const schedule: ProjectInvoiceSchedule = {
  acceptedQuoteVersionId: 'qv-current', acceptedQuoteRef: 'Q-100', acceptedQuoteVersionNumber: 2,
  acceptedQuoteTotalIncGstCents: 100000, invoicedIncGstCents: 0, paidIncGstCents: 20000,
  outstandingIncGstCents: 0, remainingToInvoiceIncGstCents: 80000, unallocatedCreditIncGstCents: 0,
  terms: [{
    quoteVersionId: 'qv-current', quoteRef: 'Q-100', quoteVersionNumber: 2, paymentTermId: 'final',
    label: 'Final payment', position: 2, termCount: 2, amountIncGstCents: 50000,
    allocatedPaidIncGstCents: 0, remainingAmountIncGstCents: 50000, source: 'quote', invoice: null,
  }],
};

function change(control: HTMLInputElement | HTMLSelectElement, value: string) {
  const prototype = control instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  act(() => {
    setter?.call(control, value);
    control.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

afterEach(() => { document.body.innerHTML = ''; });

describe('CreateInvoiceDialog', () => {
  it('offers a full remaining invoice and previews the resolved amount before creation', () => {
    const onCreate = vi.fn();
    const rendered = renderIntoDocument(
      <CreateInvoiceDialog open projectId="proj-1" schedule={schedule} initialTerm={null} pending={false} result={null} onClose={() => {}} onCreate={onCreate} onPreview={() => {}} />,
    );
    const mode = rendered.container.querySelector('select') as HTMLSelectElement;
    change(mode, 'full_remaining');
    expect(rendered.container.textContent).toContain('Invoice amount: $800.00');
    act(() => {
      Array.from(rendered.container.querySelectorAll('button')).find((button) => button.textContent === 'Create invoice')?.click();
    });
    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'full_remaining', quoteVersionId: 'qv-current', label: 'Final payment', sendNow: false,
    }));
    rendered.unmount();
  });

  it('shows the post-creation remaining balance and preview action', () => {
    const onPreview = vi.fn();
    const result = {
      invoice: { invoiceRef: 'INV-0040', totalIncGstCents: 40000 },
      created: true, sent: false, alreadySent: false, sendError: null,
      remainingBeforeIncGstCents: 80000, remainingAfterIncGstCents: 40000,
    } as any;
    const rendered = renderIntoDocument(
      <CreateInvoiceDialog open projectId="proj-1" schedule={schedule} initialTerm={null} pending={false} result={result} onClose={() => {}} onCreate={() => {}} onPreview={onPreview} />,
    );
    expect(rendered.container.textContent).toContain('INV-0040 created');
    expect(rendered.container.textContent).toContain('Remaining after');
    act(() => {
      Array.from(rendered.container.querySelectorAll('button')).find((button) => button.textContent === 'Preview invoice')?.click();
    });
    expect(onPreview).toHaveBeenCalledWith(result);
    rendered.unmount();
  });
});
