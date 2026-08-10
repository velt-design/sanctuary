import type {
  DepositInvoiceSummary,
  ProjectInvoiceSchedule,
  ProjectPaymentEntrySummary,
} from './types';

type ScheduleQuoteTerm = { id: string; label: string; amountIncGstCents: number };
export type SchedulePlanItem = {
  id: string;
  paymentTermId: string;
  label: string;
  position: number;
  itemCount: number;
  amountIncGstCents: number;
};
export type ScheduleAllocation = {
  id: string;
  paymentEntryId: string;
  quoteVersionId: string;
  paymentTermId: string;
  amountIncGstCents: number;
};
export type SchedulePaymentEntry = Omit<ProjectPaymentEntrySummary, 'allocations' | 'unallocatedIncGstCents' | 'reversed'> & {
  reversed: boolean;
};

type ProjectionInput = {
  acceptedQuoteVersionId: string | null;
  acceptedQuoteRef: string | null;
  acceptedQuoteVersionNumber: number | null;
  acceptedQuoteTotalIncGstCents: number;
  quoteTerms: ScheduleQuoteTerm[];
  planItems: SchedulePlanItem[];
  invoices: DepositInvoiceSummary[];
  paymentEntries: SchedulePaymentEntry[];
  allocations: ScheduleAllocation[];
  includePaymentEntries: boolean;
};

export function projectInvoiceSchedule(input: ProjectionInput): ProjectInvoiceSchedule {
  const currentVersionId = input.acceptedQuoteVersionId;
  const activeInvoices = input.invoices.filter((invoice) => invoice.status !== 'VOID');
  const currentInvoices = activeInvoices.filter((invoice) => invoice.quoteVersionId === currentVersionId);
  const invoiceByTerm = new Map(currentInvoices.map((invoice) => [invoice.paymentTermId, invoice]));
  const activeAllocations = input.allocations;
  const allocatedByCurrentTerm = new Map<string, number>();
  for (const allocation of activeAllocations) {
    if (allocation.quoteVersionId !== currentVersionId) continue;
    allocatedByCurrentTerm.set(
      allocation.paymentTermId,
      (allocatedByCurrentTerm.get(allocation.paymentTermId) ?? 0) + allocation.amountIncGstCents,
    );
  }

  const allBaseTerms = input.quoteTerms.map((term, index) => ({
    paymentTermId: term.id,
    label: term.label,
    position: index + 1,
    termCount: input.quoteTerms.length,
    amountIncGstCents: term.amountIncGstCents,
    source: 'quote' as const,
  }));
  const planTerms = input.planItems.map((item) => ({
    paymentTermId: item.paymentTermId,
    label: item.label,
    position: item.position,
    termCount: item.itemCount,
    amountIncGstCents: item.amountIncGstCents,
    source: 'instalment' as const,
  }));
  const baseTerms = planTerms.length
    ? allBaseTerms.filter((term) => invoiceByTerm.has(term.paymentTermId) || allocatedByCurrentTerm.has(term.paymentTermId))
    : allBaseTerms;
  const knownTermIds = new Set([...baseTerms, ...planTerms].map((term) => term.paymentTermId));
  const customTerms = currentInvoices
    .filter((invoice) => !knownTermIds.has(invoice.paymentTermId))
    .map((invoice) => ({
      paymentTermId: invoice.paymentTermId,
      label: invoice.paymentTermLabel,
      position: invoice.paymentTermPosition,
      termCount: invoice.paymentTermCount,
      amountIncGstCents: invoice.totalIncGstCents,
      source: 'custom' as const,
    }));

  const projectedTerms = [...baseTerms, ...planTerms, ...customTerms];
  const terms = projectedTerms.map((term, index) => {
    const allocatedPaidIncGstCents = allocatedByCurrentTerm.get(term.paymentTermId) ?? 0;
    return {
      quoteVersionId: currentVersionId ?? '',
      quoteRef: input.acceptedQuoteRef ?? '',
      quoteVersionNumber: input.acceptedQuoteVersionNumber ?? 0,
      ...term,
      position: index + 1,
      termCount: projectedTerms.length,
      allocatedPaidIncGstCents,
      remainingAmountIncGstCents: Math.max(0, term.amountIncGstCents - allocatedPaidIncGstCents),
      invoice: invoiceByTerm.get(term.paymentTermId) ?? null,
    };
  });

  const paidIncGstCents = input.paymentEntries.reduce((sum, entry) => sum + entry.amountIncGstCents, 0);
  const outstandingIncGstCents = input.invoices
    .filter((invoice) => invoice.status === 'OPEN')
    .reduce((sum, invoice) => sum + invoice.totalIncGstCents, 0);
  const currentAllocated = [...allocatedByCurrentTerm.values()].reduce((sum, amount) => sum + amount, 0);
  const paymentEntries = input.paymentEntries.map((entry) => {
    const entryAllocations = activeAllocations.filter((allocation) => allocation.paymentEntryId === entry.id);
    const allocations = entryAllocations.map((allocation) => ({
      id: allocation.id,
      quoteVersionId: allocation.quoteVersionId,
      paymentTermId: allocation.paymentTermId,
      stageLabel: terms.find((term) => (
        term.quoteVersionId === allocation.quoteVersionId && term.paymentTermId === allocation.paymentTermId
      ))?.label ?? 'Historical payment stage',
      amountIncGstCents: allocation.amountIncGstCents,
      isCurrentSchedule: allocation.quoteVersionId === currentVersionId,
    }));
    const allocated = allocations.reduce((sum, allocation) => sum + allocation.amountIncGstCents, 0);
    return {
      ...entry,
      allocations,
      unallocatedIncGstCents: entry.reversed || entry.amountIncGstCents <= 0
        ? 0
        : Math.max(0, entry.amountIncGstCents - allocated),
    };
  });

  return {
    acceptedQuoteVersionId: currentVersionId,
    acceptedQuoteRef: input.acceptedQuoteRef,
    acceptedQuoteVersionNumber: input.acceptedQuoteVersionNumber,
    acceptedQuoteTotalIncGstCents: input.acceptedQuoteTotalIncGstCents,
    invoicedIncGstCents: activeInvoices.reduce((sum, invoice) => sum + invoice.totalIncGstCents, 0),
    paidIncGstCents,
    outstandingIncGstCents,
    remainingToInvoiceIncGstCents: Math.max(
      0,
      input.acceptedQuoteTotalIncGstCents - paidIncGstCents - outstandingIncGstCents,
    ),
    unallocatedCreditIncGstCents: Math.max(0, paidIncGstCents - currentAllocated),
    terms,
    ...(input.includePaymentEntries ? { paymentEntries } : {}),
  };
}
