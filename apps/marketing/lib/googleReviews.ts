import 'server-only';

import { GOOGLE_PLACE } from '@/data/reviews';

export type RatingSummary = {
  rating: number;
  count: number;
  source: 'google' | 'fallback';
};

const PLACES_ENDPOINT = 'https://places.googleapis.com/v1/places';
const REVALIDATE_SECONDS = 86_400; // 24h ISR -> ~1 upstream call/day
const FETCH_TIMEOUT_MS = 2_500; // never hang a page render on Google

function fallback(): RatingSummary {
  return {
    rating: GOOGLE_PLACE.floorRating,
    count: GOOGLE_PLACE.floorCount,
    source: 'fallback',
  };
}

function clampRating(value: number): number {
  // One decimal place, e.g. 4.97 -> 5.0
  return Math.round(value * 10) / 10;
}

/**
 * Live Google rating + review count for the review badge.
 *
 * Never throws and never returns a count below the configured floor, so a
 * missing key (local/CI), a slow response, or a transient blip degrades to the
 * last-known-good numbers instead of breaking the page. The average rating is
 * reported as-is (clamped to one decimal) so the badge stays truthful if a
 * non-five-star review ever lands.
 */
export async function getGoogleRating(): Promise<RatingSummary> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!apiKey || !GOOGLE_PLACE.placeId) return fallback();

  try {
    const res = await fetch(`${PLACES_ENDPOINT}/${GOOGLE_PLACE.placeId}`, {
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'rating,userRatingCount',
      },
      next: { revalidate: REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return fallback();

    const json = (await res.json()) as { rating?: number; userRatingCount?: number };
    const apiRating = typeof json.rating === 'number' ? json.rating : null;
    const apiCount = typeof json.userRatingCount === 'number' ? json.userRatingCount : null;
    if (apiRating === null || apiCount === null) return fallback();

    return {
      rating: clampRating(apiRating),
      // Monotonic floor: never display fewer than the last-known-good count.
      count: Math.max(apiCount, GOOGLE_PLACE.floorCount),
      source: 'google',
    };
  } catch {
    return fallback();
  }
}
