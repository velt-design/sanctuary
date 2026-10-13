import { z } from 'zod';
import { credentialAttention, credentialHealthMap } from '../metaCredentials/contract';
const counts = z.record(z.string().regex(/^[A-Z_]{1,80}$/), z.number().int().nonnegative());
export const metaSaleStatusSchema = z.object({ enabled: z.boolean(), mode: z.enum(['canary','routine','historical']),
  credentials: credentialHealthMap.optional(),
  deliveryAuthority: z.enum(['DISABLED','READY','ACTOR_UNAVAILABLE','CREDENTIAL_EXPIRED','SETUP_REQUIRED']),
  datasetId: z.string().regex(/^[1-9]\d{0,19}$/).nullable(), checkedAt: z.iso.datetime({ offset: true }),
  lastCompletedAt: z.iso.datetime({ offset: true }).nullable(), error: z.string().regex(/^[A-Z_]{1,80}$/).nullable(),
  pending: z.enum(['NONE','RUNNING','EXPIRED']), counts, reasons: counts, assessmentReasons: counts,
  assessedAt: z.iso.datetime({ offset: true }).nullable(), assessedCount: z.number().int().nonnegative(), warningCount: z.number().int().nonnegative() }).strict();
export type MetaSaleStatus = z.infer<typeof metaSaleStatusSchema>;
export async function loadMetaSaleStatus(signal: AbortSignal): Promise<MetaSaleStatus> {
  const response = await fetch('/api/staff/v1/marketing-performance/meta-sales', { signal, cache: 'no-store' });
  if (!response.ok) throw new Error('Meta sale evidence is unavailable');
  return metaSaleStatusSchema.parse((await response.json()).evidence);
}
export const metaSaleReasons: Record<string,string> = {
  NOT_CURRENT_PAID_SCOPE: 'No current paid scope', ORIGIN_ENQUIRY_MISSING: 'Original enquiry unavailable',
  CUSTOMER_SUPPRESSED: 'Customer requested no further reporting', MARKETING_CONSENT_NOT_GRANTED: 'Saved marketing setting does not permit reporting',
  META_DISCLOSURE_NOT_PRESENT: 'Saved enquiry did not include the Meta sale notice', CONTACT_POLICY_NOT_APPROVED: 'Contact-sharing authority needs review',
  SALE_DATE_UNVERIFIED: 'Sale date needs verification', META_EVENT_WINDOW_EXCEEDED: 'Sale is older than Meta’s seven-day event window',
  PERMITTED_MATCHING_ID_MISSING: 'No permitted matching identifier', SENT_SALE_NO_LONGER_ELIGIBLE: 'Previously sent sale changed or was withdrawn',
  SENT_SALE_SOURCE_CHANGED: 'Previously sent sale value or evidence changed', SOURCE_CHANGED_BEFORE_DISPATCH: 'Sale changed before sending',
  SOURCE_CHECK_FAILED: 'Sale or sending authority changed', RETRY_WINDOW_EXHAUSTED: 'Delivery could not be confirmed within the retry limit',
  TRANSPORT_UNCERTAIN: 'Connection ended before delivery was confirmed', DISPATCH_OUTCOME_UNCERTAIN: 'Previous sending attempt needs reconciliation',
  META_REJECTED: 'Meta rejected the event', AUTHORITY_CHANGED: 'Sending connection changed', SALE_NO_LONGER_ELIGIBLE: 'Sale was stopped before sending',
};
export function metaSaleAttention(status: MetaSaleStatus): string[] {
  const authority = { ACTOR_UNAVAILABLE: 'The authorized operator no longer has access. Review the sending connection before resuming.',
    CREDENTIAL_EXPIRED: 'The sending credential has expired or needs renewal. Delivery cannot run until it is renewed.',
    SETUP_REQUIRED: 'The sending connection setup needs review before delivery can run.', DISABLED: '', READY: '' };
  return [...credentialAttention(status.credentials), authority[status.deliveryAuthority], status.error ? 'The latest Meta sale run needs review.' : '', status.pending === 'EXPIRED' ? 'A Meta sale run ended without confirmation.' : '',
    status.counts.REVIEW_REQUIRED ? `${status.counts.REVIEW_REQUIRED} sale delivery records need review.` : '',
    status.warningCount ? `${status.warningCount} provider warnings need review.` : ''].filter(Boolean);
}
