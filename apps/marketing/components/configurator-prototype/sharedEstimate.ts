import type { SimpleCoverPublicResult } from '../../lib/simpleCoverCalculator';
import type { ReviewPrice } from '../../lib/configuratorReviewPrice';
import type { ConfiguratorPublicPrice } from '../../lib/configuratorPublicPrice';

/** Untrusted display history only. Never use this to price or submit an enquiry. */
export type SharedEstimate = { amountIncGst: number; basis: 'published' | 'draft' };

export function parseSharedEstimate(value: string): SharedEstimate | null {
  const match = /^(published|draft):([0-9]{1,8})$/.exec(value);
  if (!match || Number(match[2]) <= 0) return null;
  return { basis: match[1] as SharedEstimate['basis'], amountIncGst: Number(match[2]) };
}

export function displayedEstimate(result: SimpleCoverPublicResult | null, review?: ReviewPrice | null, configured?: ConfiguratorPublicPrice | null): SharedEstimate | null {
  if (configured !== undefined && configured?.status !== 'disabled') return configured?.status === 'priced'
    ? parseSharedEstimate(`published:${configured.amountIncGst}`) : null;
  if (review !== undefined) return review?.status === 'priced' && !review.excluded.length
    ? parseSharedEstimate(`draft:${Math.round(review.amount)}`) : null;
  return result?.status === 'priced' ? parseSharedEstimate(`published:${Math.round(result.price.fromIncGst)}`) : null;
}

export function reopenedEstimateNotice(saved: SharedEstimate | null | undefined, current: SharedEstimate | null): string {
  if (!saved) return 'Design opened. Any estimate shown uses current pricing and may differ from when this link was saved.';
  if (!current) return 'Design opened. Any estimate shown will use current pricing. The estimate saved with this link is not a current quote.';
  if (saved.basis !== current.basis) return 'Design opened. The pricing basis has changed since this link was saved. Review the current estimate below.';
  if (saved.amountIncGst !== current.amountIncGst) return 'The current estimate differs from the estimate saved with this link. Review the updated price below.';
  return 'Design opened. The current estimate matches the estimate saved with this link, subject to site confirmation.';
}
