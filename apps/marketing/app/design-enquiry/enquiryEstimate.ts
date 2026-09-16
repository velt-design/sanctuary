import type { ConfiguratorPublicPrice } from '../../lib/configuratorPublicPrice';
import type { ReviewPrice } from '../../lib/configuratorReviewPrice';

/** Display only. Draft prices must never become a signed customer calculation reference. */
export function enquiryEstimate(price: ConfiguratorPublicPrice | null, review: ReviewPrice | null, development: boolean) {
  if (price?.status === 'priced') return { amount: price.amountIncGst, breakdown: price.breakdown, draft: false, excluded: [] as string[] };
  if (!price) return { message: 'Updating estimate…' };
  if (price.status === 'custom') return { message: 'Your design needs a tailored quote.' };
  if (price.status === 'disabled' && development) {
    if (!review) return { message: 'Updating estimate…' };
    if (review.status === 'priced') return {
      amount: review.amount, draft: true, excluded: review.excluded,
      breakdown: review.breakdown?.map(line => ({ label: line.label + (line.provisional ? ' · provisional' : ''), amountIncGst: line.amount })) ?? [],
    };
    if (review.status === 'custom') return { message: 'Your design needs a tailored quote.' };
  }
  return { message: 'Estimate unavailable', retry: true };
}
