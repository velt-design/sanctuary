import type {
  DepositInvoiceSummary,
  ProjectInvoiceSchedule,
  ProjectPaymentEntrySummary,
} from './types';

type ScheduleQuoteTerm = { id: string; label: string; amountIncGstCents: number };
type ScheduleAcceptedQuote = {
  quoteVersionId: string;
  quoteRef: string;
  quoteVersionNumber: number;
  commercialScopeKind: 'base' | 'add_on';
  totalIncGstCents: number;
  terms: ScheduleQuoteTerm[];
};
export type SchedulePlanItem = {
  id: string;
  quoteVersionId?: string;
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
  acceptedQuotes?: ScheduleAcceptedQuote[];
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
  const acceptedQuotes: ScheduleAcceptedQuote[] = input.acceptedQuotes?.length
    ? input.acceptedQuotes
    : input.acceptedQuoteVersionId
      ? [{
          quoteVersionId: input.acceptedQuoteVersionId,
          quoteRef: input.acceptedQuoteRef ?? '',
          quoteVersionNumber: input.acceptedQuoteVersionNumber ?? 0,
          commercialScopeKind: 'base',
          totalIncGstCents: input.acceptedQuoteTotalIncGstCents,
          terms: input.quoteTerms,
        }]
      : [];
  const currentVersionId = input.acceptedQuoteVersionId ?? acceptedQuotes[0]?.quoteVersionId ?? null;
  const acceptedVersionIds = new Set(acceptedQuotes.map((quote) => quote.quoteVersionId));
  const activeInvoices = input.invoices.filter((invoice) => invoice.status !== 'VOID');
  const invoiceByTerm = new Map(activeInvoices.map((invoice) => [`${invoice.quoteVersionId}:${invoice.paymentTermId}`, invoice]));
  const activeAllocations = input.allocations;
  const allocatedByCurrentTerm = new Map<string, number>();
  for (const allocation of activeAllocations) {
    if (!acceptedVersionIds.has(allocation.quoteVersionId)) continue;
    const key = `${allocation.quoteVersionId}:${allocation.paymentTermId}`;
    allocatedByCurrentTerm.set(
      key,
      (allocatedByCurrentTerm.get(key) ?? 0) + allocation.amountIncGstCents,
    );
  }

  const terms = acceptedQuotes.flatMap((quote) => {
    const quotePlans = input.planItems.filter((item) =>
      item.quoteVersionId === quote.quoteVersionId
      || (!item.quoteVersionId && acceptedQuotes.length === 1),
    );
    const allBaseTerms = quote.terms.map((term, index) => ({
      paymentTermId: term.id,
      label: term.label,
      position: index + 1,
      termCount: quote.terms.length,
      amountIncGstCents: term.amountIncGstCents,
      source: 'quote' as const,
    }));
    const planTerms = quotePlans.map((item) => ({
      paymentTermId: item.paymentTermId,
      label: item.label,
      position: item.position,
      termCount: item.itemCount,
      amountIncGstCents: item.amountIncGstCents,
      source: 'instalment' as const,
    }));
    const baseTerms = planTerms.length
      ? allBaseTerms.filter((term) => {
          const key = `${quote.quoteVersionId}:${term.paymentTermId}`;
          return invoiceByTerm.has(key) || allocatedByCurrentTerm.has(key);
        })
      : allBaseTerms;
    const knownTermIds = new Set([...baseTerms, ...planTerms].map((term) => term.paymentTermId));
    const customTerms = activeInvoices
      .filter((invoice) => invoice.quoteVersionId === quote.quoteVersionId && !knownTermIds.has(invoice.paymentTermId))
      .map((invoice) => ({
        paymentTermId: invoice.paymentTermId,
        label: invoice.paymentTermLabel,
        position: invoice.paymentTermPosition,
        termCount: invoice.paymentTermCount,
        amountIncGstCents: invoice.totalIncGstCents,
        source: 'custom' as const,
      }));
    const projectedTerms = [...baseTerms, ...planTerms, ...customTerms];
    return projectedTerms.map((term, index) => {
      const key = `${quote.quoteVersionId}:${term.paymentTermId}`;
      const allocatedPaidIncGstCents = allocatedByCurrentTerm.get(key) ?? 0;
      return {
        quoteVersionId: quote.quoteVersionId,
        quoteRef: quote.quoteRef,
        quoteVersionNumber: quote.quoteVersionNumber,
        commercialScopeKind: quote.commercialScopeKind,
        ...term,
        position: index + 1,
        termCount: projectedTerms.length,
        allocatedPaidIncGstCents,
        remainingAmountIncGstCents: Math.max(0, term.amountIncGstCents - allocatedPaidIncGstCents),
        invoice: invoiceByTerm.get(key) ?? null,
      };
    });
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
      isCurrentSchedule: acceptedVersionIds.has(allocation.quoteVersionId),
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
    acceptedQuoteTotalIncGstCents: acceptedQuotes.reduce((sum, quote) => sum + quote.totalIncGstCents, 0),
    invoicedIncGstCents: activeInvoices.reduce((sum, invoice) => sum + invoice.totalIncGstCents, 0),
    paidIncGstCents,
    outstandingIncGstCents,
    remainingToInvoiceIncGstCents: Math.max(
      0,
      acceptedQuotes.reduce((sum, quote) => sum + quote.totalIncGstCents, 0) - paidIncGstCents - outstandingIncGstCents,
    ),
    unallocatedCreditIncGstCents: Math.max(0, paidIncGstCents - currentAllocated),
    acceptedQuotes: acceptedQuotes.map((quote) => {
      const allocated = activeAllocations
        .filter((allocation) => allocation.quoteVersionId === quote.quoteVersionId)
        .reduce((sum, allocation) => sum + allocation.amountIncGstCents, 0);
      const open = input.invoices
        .filter((invoice) => invoice.quoteVersionId === quote.quoteVersionId && invoice.status === 'OPEN')
        .reduce((sum, invoice) => sum + invoice.totalIncGstCents, 0);
      return {
        quoteVersionId: quote.quoteVersionId,
        quoteRef: quote.quoteRef,
        quoteVersionNumber: quote.quoteVersionNumber,
        commercialScopeKind: quote.commercialScopeKind,
        totalIncGstCents: quote.totalIncGstCents,
        remainingToInvoiceIncGstCents: Math.max(0, quote.totalIncGstCents - allocated - open),
      };
    }),
    terms,
    ...(input.includePaymentEntries ? { paymentEntries } : {}),
  };
}
