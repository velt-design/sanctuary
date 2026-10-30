import type { SavedEstimateReview } from './savedReview';
import type { QuoteVersionDetail } from '@/lib/quotes/types';
import type { StudioOpeningPresentation, StudioOpeningScope, StudioOpeningPrice } from './studioOpening';

export const STUDIO_REVIEW_OPENING_TYPE = 'application/x-sanctuary-studio-review+json';
export const STUDIO_REVIEW_PRICE_OPENING_TYPE = 'application/x-sanctuary-studio-review+ndjson';
export const STUDIO_REVIEW_OPENING_ACCEPT = `${STUDIO_REVIEW_PRICE_OPENING_TYPE}, ${STUDIO_REVIEW_OPENING_TYPE}`;
/** Review-only transport budget. Larger valid documents use the protected reader. */
export const STUDIO_REVIEW_OPENING_BYTES = 8 * 1024 * 1024;
export type StudioReviewResponse = {
  review: SavedEstimateReview;
  relatedQuotes?: { id: string; status: string; label: string }[];
  quoteDocument?: QuoteVersionDetail;
  studioDraft?: { quoteVersionId: string };
};
export type StudioReviewOpening = { kind: 'review'; scope: StudioOpeningScope; quoteVersionId: string | null;
  presentation: StudioOpeningPresentation; response: StudioReviewResponse; openingPrice?: StudioOpeningPrice };
