import { z } from 'zod';
import { metaReportSchema } from '../marketingIntegrations/meta/report';

export const metaEvidenceSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('missing'), checkedAt: z.iso.datetime() }).strict(),
  z.object({ status: z.literal('available'), checkedAt: z.iso.datetime(), accountId: z.string().regex(/^[1-9]\d{0,19}$/),
    expiresAt: z.iso.datetime(), report: metaReportSchema }).strict(),
]);
export type MetaEvidence = z.infer<typeof metaEvidenceSchema>;
export type MetaEvidenceLoader = (signal: AbortSignal) => Promise<MetaEvidence>;

export async function loadMetaEvidence(signal: AbortSignal): Promise<MetaEvidence> {
  const response = await fetch('/api/staff/v1/marketing-performance/meta', { signal, cache: 'no-store' });
  if (!response.ok) throw new Error(response.status === 401 || response.status === 403
    ? 'Access is unavailable. Reload the page to restore your session.'
    : 'The saved Meta report could not be verified. Retry or check the source connection.');
  return metaEvidenceSchema.parse((await response.json()).evidence);
}

export function metaCoverage(evidence: Extract<MetaEvidence, { status: 'available' }>, now = new Date()) {
  const report = evidence.report;
  if (new Set(report.campaigns.map(c => c.id)).size !== report.campaigns.length) throw new Error('Duplicate campaign evidence.');
  const age = now.getTime() - Date.parse(report.fetchedAt);
  const reported = report.campaigns.filter(c => c.spend !== null);
  return {
    expired: Date.parse(evidence.expiresAt) <= now.getTime(),
    stale: age > 30 * 3600000,
    spendReported: reported.length,
    // An empty report or any missing value cannot establish a complete spend total.
    totalSpend: report.campaigns.length > 0 && reported.length === report.campaigns.length
      ? reported.reduce((sum, c) => sum + c.spend!, 0) : null,
  };
}
