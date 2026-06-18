import type { Estimate } from './estimate';

export type QuoteStatus = 'draft' | 'sent' | 'paid';

export type QuoteId = string;

export type QuotePricingSnapshot = {
  currency: 'NZD';
  totalExGst: number;
  totalIncGst: number;
  gstAmount: number;
};

export type QuoteContactSnapshot = {
  name: string;
  email: string;
  phone?: string;
  address?: string;
};

export type QuoteProjectSnapshot = {
  projectName: string;
  quoteRef?: string;
  region?: string;
  siteAddress?: string;
};

export type QuoteEstimateSnapshot = {
  summaryText: string;
  modulesSummary: string[];
  rawInputsJson: string;
  bomSummary: { lines: number; materialsExGst: number };
  installMinutesSummary: { actions: number; crewMinutes: number };
  derived: Estimate['derived'];
  outputs: Estimate['outputs'];
  configVersions: Estimate['configVersions'];
};

export type QuoteContent = {
  heading?: string;
  intro?: string;
  scope?: string;
  inclusions?: string;
  exclusions?: string;
  assumptions?: string;
  terms?: string;
};

export type Quote = {
  id: QuoteId;
  projectId: string;
  rootQuoteId: QuoteId;
  quoteNumber?: string;

  sourceEstimateId: string;
  sourceEstimateVersion: number | string;
  version: number;
  status: QuoteStatus;
  createdAt: string;
  updatedAt?: string;
  sentAt?: string;
  paidAt?: string;

  contactSnapshot: QuoteContactSnapshot;
  projectSnapshot: QuoteProjectSnapshot;
  pricingSnapshot: QuotePricingSnapshot;
  estimateSnapshot: QuoteEstimateSnapshot;
  estimateSnapshotFull?: Estimate;
  content: QuoteContent;

  customerTotalOverride: number | null;
  notes: string | null;
};

export type QuoteProjectActivityMeta = {
  quoteId: string;
  version: number;
  quoteNumber?: string;
  status: QuoteStatus;
  sourceEstimateId: string;
  sourceEstimateVersion: Quote['sourceEstimateVersion'];
  totalsExGst: number;
  totalsIncGst?: number;
};

export function quoteLabel(quote: Pick<Quote, 'version' | 'quoteNumber'>): string {
  const n = typeof quote.quoteNumber === 'string' ? quote.quoteNumber.trim() : '';
  if (n) return `Quote ${n} (v${quote.version})`;
  return `Quote v${quote.version}`;
}

export function quoteStatusLabel(status: QuoteStatus): string {
  switch (status) {
    case 'draft':
      return 'Draft';
    case 'sent':
      return 'Sent';
    case 'paid':
      return 'Paid';
    default:
      return status;
  }
}

export function quoteCustomerTotalIncGst(quote: Pick<Quote, 'customerTotalOverride' | 'pricingSnapshot'>): number {
  return typeof quote.customerTotalOverride === 'number' && Number.isFinite(quote.customerTotalOverride)
    ? quote.customerTotalOverride
    : quote.pricingSnapshot.totalIncGst;
}
