import { GOOGLE_PLACE } from '@/data/reviews';

type ReviewBadgeProps = {
  rating: number;
  count: number;
  // `onDark` for placement over imagery / dark surfaces (hero, footer);
  // `default` for light surfaces.
  variant?: 'onDark' | 'default';
  className?: string;
};

// Presentational only — receives the live numbers as props so it can render in
// either a server or client tree. The fetch lives in lib/googleReviews.ts.
export default function ReviewBadge({
  rating,
  count,
  variant = 'default',
  className = '',
}: ReviewBadgeProps) {
  const ratingText = rating.toFixed(1);
  const tone =
    variant === 'onDark' ? 'text-white/90' : 'text-ink/80';

  return (
    <a
      href={GOOGLE_PLACE.reviewsUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-2 text-[14px] font-medium leading-none no-underline ${tone} ${className}`}
    >
      <span aria-hidden="true" className="text-[15px] tracking-[0.05em] text-[#FFB400]">
        {'★★★★★'}
      </span>
      <span>
        {ratingText} &middot; {count} Google reviews
      </span>
    </a>
  );
}
