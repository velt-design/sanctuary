import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../../test/reactHarness';
import type { ProjectInvoiceSchedule } from '@/lib/invoices/types';
import InvoicesTab from './InvoicesTab';
import {ApiError} from '@/lib/repo/apiClient';
import { act } from 'react';
import { CommercialProjectNotice, ProjectCommercialProvider } from '../ProjectCommercialContext';
import type { ProjectWorkProjection } from '@/lib/projects/workItems/types';

let admin = false;
let draftAccess = false;
const schedule: ProjectInvoiceSchedule = {
  acceptedQuoteVersionId: 'qv-current', acceptedQuoteRef: 'Q-100', acceptedQuoteVersionNumber: 2,
  acceptedQuoteTotalIncGstCents: 100000, invoicedIncGstCents: 0, paidIncGstCents: 20000,
  outstandingIncGstCents: 0, remainingToInvoiceIncGstCents: 80000, unallocatedCreditIncGstCents: 20000,
  overCommittedIncGstCents: 0,
  terms: [{ quoteVersionId: 'qv-current', quoteRef: 'Q-100', quoteVersionNumber: 2, paymentTermId: 'final', label: 'Final payment', position: 1, termCount: 1, amountIncGstCents: 80000, allocatedPaidIncGstCents: 0, remainingAmountIncGstCents: 80000, source: 'quote', invoice: null }],
  paymentEntries: [{ id: 'pmt-1', entryType: 'PAYMENT', amountIncGstCents: 20000, occurredAt: '2026-08-10', paymentMethod: 'bank transfer', reference: 'BANK-1', note: null, reason: null, sourceInvoiceId: null, sourceInvoiceRef: null, reversed: false, allocations: [], unallocatedIncGstCents: 20000 }],
};
let activeSchedule = schedule;let readPhase:'ready'|'pending'|'error'|'denied'='ready';

vi.mock('next/dynamic', () => ({ default: () => () => null }));
vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: any) => readPhase==='denied'?{data:options?.queryKey?.[2]==='scheduleByProject'?activeSchedule:[],isPending:false,isError:true,error:new ApiError('Access ended',{status:403,body:null}),refetch:vi.fn()}:readPhase!=='ready'?{data:undefined,isPending:readPhase==='pending',isError:readPhase==='error',error:readPhase==='error'?new Error('Read failed'):null,refetch:vi.fn()}:options?.queryKey?.[2] === 'scheduleByProject'
    ? { data: activeSchedule, isPending: false, isError: false, error: null, refetch: vi.fn() }
    : { data: options?.queryKey?.[0] === 'invoiceDrafts' ? { enabled: draftAccess, drafts: [] } : [], isPending: false, isError: false, error: null, refetch: vi.fn() },
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

afterEach(() => { document.body.innerHTML = ''; admin = false; draftAccess = false; activeSchedule = schedule;readPhase='ready'; });

describe('InvoicesTab reconciliation visibility', () => {
  it('retains four essential owners and direct actions while complete schedule records use an explicit disclosure', () => {
    admin = true; draftAccess = true; readPhase = 'pending';
    const rendered = renderIntoDocument(<InvoicesTab projectId="proj-1" />);
    const table = rendered.container.querySelector('table');
    const metrics = rendered.container.querySelector('[aria-label="Accepted project quote payment totals"]')!;
    const cells = Array.from(metrics.children);
    const details = rendered.container.querySelector<HTMLDetailsElement>('details:has(> summary)')!;
    expect(cells).toHaveLength(4);
    expect(metrics.textContent).toContain('Accepted quote value');
    expect(metrics.textContent).toContain('Other invoiced work');
    expect(metrics.textContent).not.toContain('$0.00');
    expect(details.open).toBe(false);
    readPhase = 'ready'; activeSchedule = { ...schedule, billableTotalIncGstCents: 120000, standaloneTotalIncGstCents: 20000 };
    rendered.rerender(<InvoicesTab projectId="proj-1" />);
    expect(Array.from(metrics.children)).toEqual(cells);
    expect(metrics.textContent).toContain('$1,200.00');
    expect(metrics.textContent).toContain('$1,000.00');
    expect(metrics.textContent).toContain('$200.00');
    for (const label of ['New standalone invoice', 'Record payment', 'Add adjustment']) {
      const button = Array.from(rendered.container.querySelectorAll('button')).find(node => node.textContent === label)!;
      expect(button).toBeDefined(); expect(button.disabled).toBe(false); expect(button.closest('details')).toBeNull();
    }
    expect(details.textContent).toContain('Final payment');
    expect(details.textContent).toContain('BANK-1');
    act(() => { details.open = true; });
    expect(details.open).toBe(true);
    expect(rendered.container.querySelector('table')).toBe(table);
    readPhase = 'denied'; rendered.rerender(<InvoicesTab projectId="proj-1" />);
    expect(Array.from(metrics.children)).toEqual(cells);
    expect(metrics.textContent).toContain('Unavailable'); expect(metrics.textContent).not.toContain('$1,200.00');
    expect(details.textContent).not.toContain('BANK-1');
    expect(Array.from(rendered.container.querySelectorAll('button')).some(node => node.textContent === 'Record payment')).toBe(false);
    rendered.unmount();
  });
  it('keeps a closed accepted agreement and payment ledger visible while making billing a deliberate review', () => {
    admin = true;
    const before = JSON.stringify(activeSchedule);
    const work = { effectiveState: 'CLOSED', closedOutcome: 'CANCELLED', stateRowVersion: 1 } as ProjectWorkProjection;
    const rendered = renderIntoDocument(<ProjectCommercialProvider projectId="proj-1" work={work} ready>
      <CommercialProjectNotice projectId="proj-1" view="invoices" /><InvoicesTab projectId="proj-1" />
    </ProjectCommercialProvider>);
    expect(rendered.container.textContent).toContain('Recorded payment schedule');
    expect(rendered.container.textContent).toContain('Uncovered contract value');
    expect(rendered.container.textContent).toContain('$800.00');
    expect(rendered.container.textContent).toContain('Payments & credits');
    expect(rendered.container.textContent).not.toContain('Invoice final payment');
    expect(rendered.container.textContent).not.toContain('Record payment');
    act(() => [...rendered.container.querySelectorAll('button')].find((node) => node.textContent === 'Review commercial actions')!.click());
    expect(rendered.container.textContent).toContain('Record payment');
    expect(JSON.stringify(activeSchedule)).toBe(before);
    rendered.unmount();
  });
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
    expect(rendered.container.textContent).toContain('exceed the current billable project value by $200.00');
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
    expect(rendered.container.textContent).toContain('admins can create standalone invoice drafts separately');
    rendered.unmount();
  });
});

it('keeps actual invoice schedule metrics, search and history headers pending and failed, then fills them without replacement',()=>{
 readPhase='pending';const view=renderIntoDocument(<InvoicesTab projectId="proj-1"/>),table=view.container.querySelector('table'),search=view.container.querySelector('input');expect(table?.textContent).toContain('Amount inc GST');expect(view.container.textContent).toContain('Recorded payments');expect(view.container.textContent).toContain('Reading');expect(view.container.textContent).not.toContain('No invoices yet');expect(view.container.textContent).not.toContain('$0.00');readPhase='error';view.rerender(<InvoicesTab projectId="proj-1"/>);expect(view.container.querySelector('table')).toBe(table);expect(view.container.textContent).toContain('Could not load the job payment schedule');act(()=>{Array.from(view.container.querySelectorAll('button')).find(button=>button.textContent==='Details')!.click();});expect(document.querySelector('[role=dialog]')?.textContent).toContain('Could not load invoices');act(()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));readPhase='ready';view.rerender(<InvoicesTab projectId="proj-1"/>);expect(view.container.querySelector('table')).toBe(table);expect(view.container.querySelector('input')).toBe(search);expect(view.container.textContent).toContain('$200.00');expect(Array.from(table!.querySelectorAll('tbody tr')).every(row=>Boolean(row.textContent?.trim()))).toBe(true);view.unmount();
});

it('clears cached payment evidence when its read authority ends while keeping the real table and metric labels',()=>{const view=renderIntoDocument(<InvoicesTab projectId="proj-1"/>),table=view.container.querySelector('table');expect(view.container.textContent).toContain('$200.00');readPhase='denied';view.rerender(<InvoicesTab projectId="proj-1"/>);expect(view.container.querySelector('table')).toBe(table);expect(view.container.textContent).not.toContain('$200.00');expect(view.container.textContent).toContain('Recorded payments');expect(view.container.textContent).toContain('Unavailable');expect(view.container.textContent).not.toContain('No invoices yet');view.unmount();});


it('publishes verified invoice emptiness in the actual history table, never only inside closed payment details', () => {
  readPhase='pending'; const rendered=renderIntoDocument(<InvoicesTab projectId="proj-1"/>);
  try {
    const table=rendered.container.querySelector('table')!;
    const details=rendered.container.querySelector('details')!;
    expect(details.open).toBe(false);
    expect(table.textContent).not.toContain('No invoices yet');
    readPhase='error'; rendered.rerender(<InvoicesTab projectId="proj-1"/>);
    expect(table.textContent).toContain('Invoices unavailable');
    expect(table.textContent).not.toContain('No invoices yet');
    readPhase='ready'; rendered.rerender(<InvoicesTab projectId="proj-1"/>);
    expect(rendered.container.querySelector('table')).toBe(table);
    expect(details.open).toBe(false);
    expect(table.textContent).toContain('No invoices yet');
    expect(table.textContent).toContain('The first invoice is created when a quote is accepted.');
    expect(details.textContent).not.toContain('No invoices yet');
    readPhase='denied'; rendered.rerender(<InvoicesTab projectId="proj-1"/>);
    expect(table.textContent).not.toContain('No invoices yet');
    expect(table.textContent).toContain('Invoices unavailable');
  } finally { rendered.unmount(); }
});
