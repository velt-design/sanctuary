import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../../test/reactHarness';
import type { ProjectInvoiceSchedule, ProjectPaymentEntrySummary } from '@/lib/invoices/types';
import PaymentReconciliationDialogs from './PaymentReconciliationDialogs';

vi.mock('@/components/ui/modal/Modal', () => ({
  default: ({ open, ariaLabel, children }: any) => open ? <section role="dialog" aria-label={ariaLabel}>{children}</section> : null,
}));

function change(control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: string) {
  const prototype = control instanceof HTMLSelectElement
    ? HTMLSelectElement.prototype
    : control instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  act(() => {
    setter?.call(control, value);
    control.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

afterEach(() => { document.body.innerHTML = ''; });

describe('PaymentReconciliationDialogs', () => {
  it('allocates a payment to the selected add-on quote stage', () => {
    const schedule: ProjectInvoiceSchedule = {
      acceptedQuoteVersionId: 'qv-base', acceptedQuoteRef: 'Q-100', acceptedQuoteVersionNumber: 1,
      acceptedQuoteTotalIncGstCents: 140000, invoicedIncGstCents: 0, paidIncGstCents: 40000,
      outstandingIncGstCents: 0, remainingToInvoiceIncGstCents: 100000, unallocatedCreditIncGstCents: 40000,
      overCommittedIncGstCents: 0,
      terms: [{
        quoteVersionId: 'qv-addon', quoteRef: 'Q-101', quoteVersionNumber: 1, commercialScopeKind: 'add_on',
        paymentTermId: 'addon-payment', label: 'Add-on payment', position: 1, termCount: 1,
        amountIncGstCents: 40000, allocatedPaidIncGstCents: 0, remainingAmountIncGstCents: 40000,
        source: 'quote', invoice: null,
      }],
    };
    const payment: ProjectPaymentEntrySummary = {
      id: 'pmt-1', entryType: 'PAYMENT', amountIncGstCents: 40000, occurredAt: '2026-08-11T00:00:00.000Z',
      paymentMethod: 'bank transfer', reference: null, note: null, reason: null,
      sourceInvoiceId: null, sourceInvoiceRef: null, reversed: false, allocations: [], unallocatedIncGstCents: 40000,
    };
    const onAllocate = vi.fn();
    const rendered = renderIntoDocument(
      <PaymentReconciliationDialogs
        entryMode={null}
        allocationTarget={payment}
        reversalTarget={null}
        schedule={schedule}
        pending={false}
        onClose={() => {}}
        onRecord={() => {}}
        onAllocate={onAllocate}
        onReverse={() => {}}
      />,
    );
    change(rendered.container.querySelector('select') as HTMLSelectElement, 'qv-addon::addon-payment');
    change(rendered.container.querySelector('input') as HTMLInputElement, '400');
    change(rendered.container.querySelector('textarea') as HTMLTextAreaElement, 'Matched to add-on');
    act(() => {
      Array.from(rendered.container.querySelectorAll('button')).find((button) => button.textContent === 'Save allocation')?.click();
    });
    expect(onAllocate).toHaveBeenCalledWith({
      allocations: [{ quoteVersionId: 'qv-addon', paymentTermId: 'addon-payment', amountIncGstCents: 40000 }],
      reason: 'Matched to add-on',
    });
    rendered.unmount();
  });
});
