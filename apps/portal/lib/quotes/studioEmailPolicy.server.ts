import 'server-only';
import type { CommercialEmailIntent } from '@/lib/commercial/emailIntent';
import type { QuoteVersionDetail } from './types';

export const STUDIO_EMAIL_DISABLED_REASON = 'Sending is disabled during the Design Studio trial.';

/** Separate affirmative rollout. Package preparation never grants delivery. */
export function studioCustomerEmailEnabled(environment: Record<string, string | undefined> = process.env): boolean {
  return environment.STUDIO_CUSTOMER_EMAIL_ENABLED === '1' && environment.STUDIO_CLIENT_PACKAGE_PREPARE_ONLY !== '1';
}

/** studioDesign comes from the immutable quote/snapshot binding RPC. The frozen
 * package marker also fences recovery of an already prepared package intent. */
export function studioQuoteDeliveryBlocked(detail: Pick<QuoteVersionDetail, 'studioDesign'> | null | undefined, intent?: Pick<CommercialEmailIntent, 'protectedPayload'> | null): boolean {
  return !studioCustomerEmailEnabled() && Boolean(detail?.studioDesign || (intent && Object.hasOwn(intent.protectedPayload,'studioPackage')));
}
