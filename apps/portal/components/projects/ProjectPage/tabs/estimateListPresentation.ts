import type { EstimateMeta } from '@/lib/estimates/types';
import type { QuoteVersion } from '@/lib/quotes/types';
import { selectAuthoritativeAcceptedVersions } from '@/lib/commercial/authoritativeAcceptedVersions';
import { formatPortalDateTime } from '@/lib/format/portalDateTime';

export function estimateDisplayName(estimate: EstimateMeta, estimates: EstimateMeta[]): string {
  if (estimate.internalName) return estimate.internalName;
  const base = `Estimate ${estimate.versionLabel}`;
  if (estimates.filter((item) => !item.internalName && item.versionLabel === estimate.versionLabel).length < 2) return base;
  return `${base} · ${formatPortalDateTime(estimate.createdAt, { fallback: estimate.id })}`;
}

export function acceptedEstimateQuoteIds(quotes: QuoteVersion[]): Set<string> {
  return new Set(selectAuthoritativeAcceptedVersions(quotes.map((quote) => ({
    ...quote, familyKey: quote.quoteId, acceptedAt: quote.acceptedAt ?? null,
  }))).map((quote) => quote.id));
}

export function quotesForEstimate(estimateId: string, quotes: QuoteVersion[], accepted: Set<string>): QuoteVersion[] {
  return quotes.filter((quote) => quote.sourceEstimateVersionId === estimateId).sort((a, b) =>
    Number(accepted.has(b.id)) - Number(accepted.has(a.id)) || b.createdAt.localeCompare(a.createdAt) || b.versionNumber - a.versionNumber);
}
