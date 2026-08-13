import type {
  CommandCentreEstimateCandidate,
  CommandCentreQuoteCandidate,
  CommandCentreQuoteStatus,
  CommandCentreSelection,
  CommandCentreSource,
} from './types';
import { selectAuthoritativeAcceptedVersions } from '@/lib/commercial/authoritativeAcceptedVersions';

const QUOTE_PRECEDENCE: Array<{
  status: Exclude<CommandCentreQuoteStatus, 'DECLINED' | 'SUPERSEDED'>;
  source: Exclude<CommandCentreSource, 'estimate' | 'none'>;
}> = [
  { status: 'ACCEPTED', source: 'accepted_quote' },
  { status: 'SENT', source: 'sent_quote' },
  { status: 'DRAFT', source: 'draft_quote' },
];

function compareTimestampDesc(
  left: { createdAt: string | null; id: string },
  right: { createdAt: string | null; id: string },
): number {
  const timestamp = String(right.createdAt ?? '').localeCompare(String(left.createdAt ?? ''));
  return timestamp || right.id.localeCompare(left.id);
}

function newestEstimate(estimates: CommandCentreEstimateCandidate[]): CommandCentreEstimateCandidate | null {
  return estimates.slice().sort(compareTimestampDesc)[0] ?? null;
}

function findNewerEstimate(
  estimates: CommandCentreEstimateCandidate[],
  selected: CommandCentreEstimateCandidate | null,
): CommandCentreEstimateCandidate | null {
  if (!selected) return null;
  const eligible = estimates.filter((estimate) => {
    if ((estimate.commercialScopeId ?? null) !== (selected.commercialScopeId ?? null)) return false;
    if (estimate.status !== 'draft' || estimate.id === selected.id) return false;
    if (!estimate.createdAt) return false;
    if (!selected.createdAt) return true;
    return estimate.createdAt > selected.createdAt;
  });
  return newestEstimate(eligible);
}

/**
 * Selects the command-centre design source without applying presentation or
 * pricing fallbacks. Quote-backed selections may use only their exact source
 * estimate; declined and superseded quotes are historical outcomes and are never current.
 */
export function resolveCommandCentreSelection(args: {
  estimates: CommandCentreEstimateCandidate[];
  quoteVersions: CommandCentreQuoteCandidate[];
}): CommandCentreSelection {
  const estimates = Array.isArray(args.estimates) ? args.estimates : [];
  const quotes = Array.isArray(args.quoteVersions) ? args.quoteVersions : [];
  const latestDeclinedQuote = quotes
    .filter((quote) => quote.status === 'DECLINED')
    .sort(compareTimestampDesc)[0] ?? null;
  const acceptedQuotes = quotes.filter((quote) => quote.status === 'ACCEPTED');
  const acceptedByScope = new Map<string, CommandCentreQuoteCandidate[]>();
  for (const quote of acceptedQuotes) {
    const key = quote.commercialScopeId ?? 'base';
    const bucket = acceptedByScope.get(key) ?? [];
    bucket.push(quote);
    acceptedByScope.set(key, bucket);
  }
  const acceptedQuoteCount = Math.max(0, ...[...acceptedByScope.values()].map((bucket) => bucket.length));
  const acceptedScopeQuotes = selectAuthoritativeAcceptedVersions(quotes.map((quote) => ({
    ...quote,
    familyKey: quote.commercialScopeId ?? 'base',
    acceptedAt: quote.acceptedAt ?? null,
  })));
  const acceptedProjectTotalIncGstCents = acceptedScopeQuotes.some((quote) => quote?.totalIncGstCents === null)
    ? null
    : acceptedScopeQuotes.reduce((sum, quote) => sum + (quote?.totalIncGstCents ?? 0), 0);

  for (const precedence of QUOTE_PRECEDENCE) {
    const candidates = precedence.status === 'ACCEPTED'
      ? acceptedScopeQuotes
      : quotes.filter((candidate) => candidate.status === precedence.status);
    const quote = candidates
      .sort(compareTimestampDesc)[0];
    if (!quote) continue;

    const estimate = quote.sourceEstimateId
      ? estimates.find((candidate) => candidate.sourceId === quote.sourceEstimateId) ?? null
      : null;
    return {
      source: precedence.source,
      quote,
      estimate,
      newerEstimate: findNewerEstimate(estimates, estimate),
      latestDeclinedQuote,
      acceptedQuoteCount,
      acceptedProjectTotalIncGstCents,
      sourceEstimateMissing: estimate === null,
    };
  }

  const nonArchived = estimates.filter((estimate) => estimate.status === 'draft');
  const estimate = newestEstimate(nonArchived.filter((candidate) => !candidate.isLocked))
    ?? newestEstimate(nonArchived);

  if (estimate) {
    return {
      source: 'estimate',
      quote: null,
      estimate,
      newerEstimate: null,
      latestDeclinedQuote,
      acceptedQuoteCount,
      acceptedProjectTotalIncGstCents,
      sourceEstimateMissing: false,
    };
  }

  return {
    source: 'none',
    quote: null,
    estimate: null,
    newerEstimate: null,
    latestDeclinedQuote,
    acceptedQuoteCount,
    acceptedProjectTotalIncGstCents,
    sourceEstimateMissing: false,
  };
}
