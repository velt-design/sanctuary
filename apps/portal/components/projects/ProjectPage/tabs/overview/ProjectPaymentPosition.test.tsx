import { afterEach, describe, expect, it } from 'vitest';
import { renderIntoDocument } from '../../../../../../../test/reactHarness';
import type { ProjectInvoiceSchedule } from '@/lib/invoices/types';
import ProjectPaymentPosition from './ProjectPaymentPosition';

const schedule: ProjectInvoiceSchedule = {
  acceptedQuoteVersionId: 'accepted', acceptedQuoteRef: 'Q-100', acceptedQuoteVersionNumber: 3,
  acceptedQuoteTotalIncGstCents: 2665687, paidIncGstCents: 1332844,
  invoicedIncGstCents: 1332844, outstandingIncGstCents: 0, remainingToInvoiceIncGstCents: 1332843,
  overCommittedIncGstCents: 0, unallocatedCreditIncGstCents: 0, terms: [],
};
afterEach(() => { document.body.innerHTML = ''; });

describe('ProjectPaymentPosition', () => {
  it('keeps a part payment distinct from a zero open invoice balance and unbilled work', () => {
    const view = renderIntoDocument(<ProjectPaymentPosition projectId="proj_1" schedule={schedule} />);
    const text = view.container.textContent;
    expect(text).toContain('$13,328.44');
    expect(text).toContain('$13,328.43');
    expect(text).toContain('does not mean paid in full');
    expect(view.container.querySelector('details')?.open).toBe(false);
    expect(view.container.querySelector('a')?.getAttribute('href')).toBe('/staff/projects/proj_1?tab=invoices');
    view.unmount();
  });

  it('retains historical payments without inventing a current agreement', () => {
    const view = renderIntoDocument(<ProjectPaymentPosition projectId="proj_1" saved schedule={{ ...schedule, acceptedQuoteVersionId: null, acceptedQuoteTotalIncGstCents: 0, unallocatedCreditIncGstCents: 1332844 }} />);
    expect(view.container.textContent).toContain('Not recorded');
    expect(view.container.textContent).toContain('$13,328.44');
    expect(view.container.textContent).toContain('Saved payment position');
    expect(view.container.textContent).toContain('Payment allocation needs review');
    view.unmount();
  });
});
