import type { EstimateMeta } from '@/lib/estimates/types';
import type { QuoteVersion } from '@/lib/quotes/types';

export type CurrentDesignSource =
  | 'accepted_quote'
  | 'sent_quote'
  | 'draft_quote'
  | 'estimate'
  | 'empty';

export type CurrentDesignStatus =
  | 'quote_accepted'
  | 'quote_sent'
  | 'quote_draft'
  | 'quotes_declined'
  | 'no_accepted_quote'
  | 'empty';

export type ResolvedCurrentDesign = {
  source: CurrentDesignSource;
  status: CurrentDesignStatus;
  quoteVersion: QuoteVersion | null;
  estimate: EstimateMeta | null;
  hasDeclinedQuotes: boolean;
};

function compareCreatedAtDesc(a: { createdAt: string }, b: { createdAt: string }): number {
  return String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? ''));
}

function findEstimateForQuote(estimates: EstimateMeta[], quote: QuoteVersion): EstimateMeta | null {
  const direct = estimates.find((entry) => entry.id === quote.sourceEstimateVersionId);
  if (direct) return direct;
  // Fallback: latest active draft, then latest by createdAt. Keeps the bar useful when
  // the source estimate row is archived or hasn't loaded into the same query yet.
  const activeDraft = estimates.find((entry) => entry.isActiveDraft);
  if (activeDraft) return activeDraft;
  const sorted = [...estimates].sort(compareCreatedAtDesc);
  return sorted[0] ?? null;
}

export function resolveProjectCurrentDesign(args: {
  estimates: EstimateMeta[];
  quoteVersions: QuoteVersion[];
}): ResolvedCurrentDesign {
  const estimates = Array.isArray(args.estimates) ? args.estimates : [];
  const quotes = Array.isArray(args.quoteVersions) ? args.quoteVersions : [];

  const accepted = quotes
    .filter((quote) => quote.status === 'ACCEPTED')
    .sort(compareCreatedAtDesc);
  const sent = quotes
    .filter((quote) => quote.status === 'SENT')
    .sort(compareCreatedAtDesc);
  const draft = quotes
    .filter((quote) => quote.status === 'DRAFT')
    .sort(compareCreatedAtDesc);
  const hasDeclinedQuotes = quotes.some((quote) => quote.status === 'DECLINED');

  if (accepted[0]) {
    return {
      source: 'accepted_quote',
      status: 'quote_accepted',
      quoteVersion: accepted[0],
      estimate: findEstimateForQuote(estimates, accepted[0]),
      hasDeclinedQuotes,
    };
  }

  if (sent[0]) {
    return {
      source: 'sent_quote',
      status: 'quote_sent',
      quoteVersion: sent[0],
      estimate: findEstimateForQuote(estimates, sent[0]),
      hasDeclinedQuotes,
    };
  }

  if (draft[0]) {
    return {
      source: 'draft_quote',
      status: 'quote_draft',
      quoteVersion: draft[0],
      estimate: findEstimateForQuote(estimates, draft[0]),
      hasDeclinedQuotes,
    };
  }

  if (estimates.length > 0) {
    const latestEstimate =
      estimates.find((entry) => entry.isActiveDraft) ??
      [...estimates].sort(compareCreatedAtDesc)[0] ??
      null;
    return {
      source: 'estimate',
      status: hasDeclinedQuotes ? 'quotes_declined' : 'no_accepted_quote',
      quoteVersion: null,
      estimate: latestEstimate,
      hasDeclinedQuotes,
    };
  }

  return {
    source: 'empty',
    status: 'empty',
    quoteVersion: null,
    estimate: null,
    hasDeclinedQuotes,
  };
}
