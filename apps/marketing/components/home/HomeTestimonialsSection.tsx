import type { CSSProperties } from 'react';
import { GOOGLE_PLACE, featuredReviews, type GoogleReview } from '@/data/reviews';
import { cn } from '@/lib/cn';
import CardCarousel from '@/components/ui/CardCarousel';

type HomeTestimonialsSectionProps = {
  rating: number;
  count: number;
};

function initials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((part) => part.toLowerCase() !== 'and');
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="h-[14px] w-[14px]">
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
    </svg>
  );
}

function ReviewCard({
  review,
  className,
  style,
}: {
  review: GoogleReview;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <figure
      style={style}
      className={cn(
        'relative flex flex-col gap-4 overflow-hidden border border-ink/10 bg-card p-7 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_10px_30px_-16px_rgba(0,0,0,0.18)]',
        className
      )}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-4 top-1 font-serif text-[clamp(64px,15vw,96px)] leading-none text-ink/[0.06]"
      >
        {'”'}
      </span>

      <span aria-hidden="true" className="text-[15px] tracking-[0.05em] text-[#FFB400]">
        {'★★★★★'}
      </span>

      <blockquote className="text-[20px] leading-[1.5] text-ink md:text-[18px] md:leading-[1.55]">
        {review.quote}
      </blockquote>

      <figcaption className="mt-auto flex items-center gap-3 pt-2">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink/[0.07] text-[13px] font-semibold text-ink">
          {initials(review.author)}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-[14px] font-medium text-ink">
            {review.author}
            {review.location ? `, ${review.location}` : ''}
          </span>
          <span className="mt-0.5 flex items-center gap-1.5 text-[12px] text-muted">
            <GoogleGlyph />
            Verified review
          </span>
        </span>
      </figcaption>
    </figure>
  );
}

export default function HomeTestimonialsSection({ rating, count }: HomeTestimonialsSectionProps) {
  // Show a tight set of six on the wall; the rest live behind "Read all on Google".
  const reviews = featuredReviews.slice(0, 6);
  if (reviews.length === 0) return null;
  const ratingText = rating.toFixed(1);

  return (
    <section aria-labelledby="home-reviews-heading" className="bg-page py-[var(--home-section-y)]">
      <div className="mx-auto w-[min(88vw,1288px)]">
        <p className="text-[12px] uppercase tracking-[0.14em] text-muted">Reviews</p>

        <div className="mt-3 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <h2
            id="home-reviews-heading"
            className="max-w-[22ch] text-balance text-[length:var(--home-h2)] font-semibold leading-[1.06] tracking-[-0.02em] text-ink"
          >
            Rated {ratingText} from {count} Google reviews.
          </h2>
          <a
            href={GOOGLE_PLACE.reviewsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-[13px] font-medium uppercase tracking-[0.12em] text-ink underline underline-offset-4 transition-opacity hover:opacity-70"
          >
            Read all reviews on Google
          </a>
        </div>

        {/* Desktop: grid */}
        <ul className="mt-10 hidden list-none grid-cols-2 gap-6 p-0 md:grid lg:grid-cols-3">
          {reviews.map((review) => (
            <li key={review.author}>
              <ReviewCard review={review} className="h-full" />
            </li>
          ))}
        </ul>
      </div>

      {/* Mobile: flick carousel matching the projects carousel footprint + movement */}
      <CardCarousel
        ariaLabel="Customer reviews"
        showArrows={reviews.length > 1}
        align="center"
        className="home-carousel--review mt-8 md:hidden"
        arrowsClassName="mx-auto w-[min(88vw,1288px)]"
        railClassName="gap-4"
      >
        {reviews.map((review) => (
          <ReviewCard
            key={review.author}
            review={review}
            className="h-[clamp(330px,58vh,440px)] w-[var(--cc-card)]"
          />
        ))}
      </CardCarousel>
    </section>
  );
}
