import { GOOGLE_PLACE, featuredReviews } from '@/data/reviews';

type HomeTestimonialsSectionProps = {
  rating: number;
  count: number;
};

export default function HomeTestimonialsSection({ rating, count }: HomeTestimonialsSectionProps) {
  // Show a tight set of six on the wall; the rest live behind "Read all on Google".
  const reviews = featuredReviews.slice(0, 6);
  if (reviews.length === 0) return null;
  const ratingText = rating.toFixed(1);

  return (
    <section
      aria-labelledby="home-reviews-heading"
      className="bg-page py-[clamp(48px,7vh,96px)]"
    >
      <div className="mx-auto w-[min(88vw,1288px)]">
        <p className="text-[12px] uppercase tracking-[0.12em] text-muted">Reviews</p>

        <div className="mt-3 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <h2
            id="home-reviews-heading"
            className="max-w-[22ch] text-balance text-[clamp(32px,4.4vw,62px)] font-semibold leading-[1.05] tracking-[-0.02em] text-ink"
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

        <ul className="mt-10 grid list-none gap-6 p-0 md:grid-cols-2 lg:grid-cols-3">
          {reviews.map((review) => (
            <li key={review.author}>
              <figure className="flex h-full flex-col gap-4 border border-ink/10 bg-card p-7 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_10px_30px_-16px_rgba(0,0,0,0.18)]">
                <span aria-hidden="true" className="text-[15px] tracking-[0.05em] text-[#FFB400]">
                  {'★★★★★'}
                </span>
                <blockquote className="text-[16px] leading-[1.6] text-ink">
                  {review.quote}
                </blockquote>
                <figcaption className="mt-auto pt-2 text-[14px] font-medium text-muted">
                  {review.author}
                  {review.location ? `, ${review.location}` : ''}
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
