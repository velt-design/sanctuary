// data/reviews.ts
// Google review content + live-rating config.
//
// The aggregate numbers (average rating, review count) are fetched live via
// lib/googleReviews.ts. Review quotes are hand-curated here (added in a later
// pass) rather than synced from Google, so we keep editorial control of which
// quotes appear.

export type GoogleReview = {
  author: string;
  location?: string;
  quote: string;
  date?: string; // ISO date, for ordering / recency display
};

// Public Google Business Profile identity. None of this is secret.
export const GOOGLE_PLACE = {
  placeId: 'ChIJmbqE4PJ3yIoRS_OzDzK-EPI',
  // Public "all reviews" link used as the badge click target.
  reviewsUrl: 'https://search.google.com/local/reviews?placeid=ChIJmbqE4PJ3yIoRS_OzDzK-EPI',
  // Last-known-good baseline. Used as the fallback when the API key is absent
  // (local/CI) or a request fails, and as a monotonic floor on the count so a
  // transient blip can't make the displayed number visibly drop.
  floorRating: 5.0,
  floorCount: 61,
} as const;

// Hand-curated quotes for the testimonial section (populated in PR-2).
export const featuredReviews: GoogleReview[] = [];
