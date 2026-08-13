import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../../test/reactHarness';
import type { ProjectInvoiceSchedule } from '@/lib/invoices/types';
import InvoicesTab from './InvoicesTab';

let admin = false;
const schedule: ProjectInvoiceSchedule = {
  acceptedQuoteVersionId: 'qv-current', acceptedQuoteRef: 'Q-100', acceptedQuoteVersionNumber: 2,
  acceptedQuoteTotalIncGstCents: 100000, invoicedIncGstCents: 0, paidIncGstCents: 20000,
  outstandingIncGstCents: 0, remainingToInvoiceIncGstCents: 80000, unallocatedCreditIncGstCents: 20000,
  overCommittedIncGstCents: 0,
  terms: [{ quoteVersionId: 'qv-current', quoteRef: 'Q-100', quoteVersionNumber: 2, paymentTermId: 'final', label: 'Final payment', position: 1, termCount: 1, amountIncGstCents: 80000, allocatedPaidIncGstCents: 0, remainingAmountIncGstCents: 80000, source: 'quote', invoice: null }],
  paymentEntries: [{ id: 'pmt-1', entryType: 'PAYMENT', amountIncGstCents: 20000, occurredAt: '2026-08-10', paymentMethod: 'bank transfer', reference: 'BANK-1', note: null, reason: null, sourceInvoiceId: null, sourceInvoiceRef: null, reversed: false, allocations: [], unallocatedIncGstCents: 20000 }],
};
let activeSchedule = schedule;

vi.mock('next/dynamic', () => ({ default: () => () => null }));
vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: any) => options?.queryKey?.[2] === 'scheduleByProject'
    ? { data: activeSchedule, isPending: false, isError: false, error: null, refetch: vi.fn() }
    : { data: [], isPending: false, isError: false, error: null, refetch: vi.fn() },
  useQueryClient: () => ({ invalidateQueries: vi.fn().mockResolvedValue(undefined) }),
}));
vi.mock('@/components/auth/PortalAuthProvider', () => ({ usePortalSession: () => ({ isAdmin: admin }) }));
vi.mock('@/components/ui/toast/ToastProvider', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }));
vi.mock('@/lib/queries/invoices', () => ({ depositInvoicesByProjectQueryOptions: () => ({ queryKey: ['invoices', 'host', 'byProject', 'proj-1'] }) }));
vi.mock('@/lib/supabase/browserClient', () => ({ supabaseHostFromUrl: () => 'host', supabaseRuntimeUrl: () => 'https://example.supabase.co' }));
vi.mock('@/lib/repo/invoicesRepo', () => ({
  createProjectInvoice: vi.fn(), loadProjectInvoiceSchedule: vi.fn(), markProjectInvoicePaid: vi.fn(),
  recordProjectPayment: vi.fn(), reverseProjectPayment: vi.fn(), sendProjectDepositInvoice: vi.fn(),
  updatePaymentAllocations: vi.fn(), voidProjectInvoice: vi.fn(),
}));

afterEach(() => { document.body.innerHTML = ''; admin = false; activeSchedule = schedule; });

describe('InvoicesTab reconciliation visibility', () => {
  it('shows accurate job totals to ordinary staff without admin ledger controls', () => {
    const rendered = renderIntoDocument(<InvoicesTab projectId="proj-1" />);
    expect(rendered.container.textContent).toContain('Job payment schedule');
    expect(rendered.container.textContent).toContain('$200.00');
    expect(rendered.container.textContent).not.toContain('Payments & credits');
    rendered.unmount();
  });

  it('shows payment reconciliation controls to admins', () => {
    admin = true;
    const rendered = renderIntoDocument(<InvoicesTab projectId="proj-1" />);
    expect(rendered.container.textContent).toContain('Payments & credits');
    expect(rendered.container.textContent).toContain('Record payment');
    expect(rendered.container.textContent).toContain('Unallocated credit: $200.00');
    rendered.unmount();
  });

  it('shows project-wide over-commitment instead of hiding it behind zero remaining', () => {
    activeSchedule = {
      ...schedule,
      paidIncGstCents: 90000,
      outstandingIncGstCents: 30000,
      remainingToInvoiceIncGstCents: 0,
      overCommittedIncGstCents: 20000,
    };
    const rendered = renderIntoDocument(<InvoicesTab projectId="proj-1" />);
    expect(rendered.container.textContent).toContain('Commercial total needs reconciliation');
    expect(rendered.container.textContent).toContain('exceed the current accepted scope by $200.00');
    rendered.unmount();
  });

  it('keeps historical money visible when no current accepted quote exists', () => {
    activeSchedule = {
      ...schedule,
      acceptedQuoteVersionId: null,
      acceptedQuoteRef: null,
      acceptedQuoteVersionNumber: null,
      acceptedQuoteTotalIncGstCents: 0,
      paidIncGstCents: 20000,
      outstandingIncGstCents: 10000,
      remainingToInvoiceIncGstCents: 0,
      terms: [],
    };
    const rendered = renderIntoDocument(<InvoicesTab projectId="proj-1" />);
    expect(rendered.container.textContent).toContain('Historical commercial record');
    expect(rendered.container.textContent).toContain('No current accepted commercial scope');
    expect(rendered.container.textContent).toContain('no new invoice can be created until a quote is accepted');
    rendered.unmount();
  });
});
