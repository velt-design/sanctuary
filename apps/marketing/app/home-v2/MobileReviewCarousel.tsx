'use client';

import { useState } from 'react';
import styles from './home-v2.module.css';

type Review = {
  author: string;
  quote: string;
};

export default function MobileReviewCarousel({
  count,
  rating,
  reviews,
  reviewsUrl,
}: {
  count: number;
  rating: string;
  reviews: Review[];
  reviewsUrl: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const reviewCount = reviews.length;

  const showPrevious = () => {
    setActiveIndex((current) => (current - 1 + reviewCount) % reviewCount);
  };

  const showNext = () => {
    setActiveIndex((current) => (current + 1) % reviewCount);
  };

  return (
    <div
      className={styles.mobileReviewCarousel}
      role="region"
      aria-roledescription="carousel"
      aria-label="Client reviews"
    >
      <div className={styles.mobileReviewViewport} aria-live="polite">
        {reviews.map((review, index) => (
          <figure
            className={styles.mobileReviewCard}
            key={review.author}
            hidden={index !== activeIndex}
            aria-label={`Review ${index + 1} of ${reviewCount}`}
          >
            <blockquote>&ldquo;{review.quote}&rdquo;</blockquote>
            <figcaption>{review.author} / Google review</figcaption>
          </figure>
        ))}
      </div>
      <div className={styles.mobileReviewControls}>
        <button
          type="button"
          onClick={showPrevious}
          aria-label="Previous review"
          data-homepage-event="review_previous_click"
        >
          <span aria-hidden="true">&larr;</span>
        </button>
        <span aria-live="polite">
          {String(activeIndex + 1).padStart(2, '0')} / {String(reviewCount).padStart(2, '0')}
        </span>
        <button
          type="button"
          onClick={showNext}
          aria-label="Next review"
          data-homepage-event="review_next_click"
        >
          <span aria-hidden="true">&rarr;</span>
        </button>
      </div>
      <div className={styles.mobileReviewSummary}>
        <span>Rated {rating} from {count} Google reviews</span>
        <a href={reviewsUrl} target="_blank" rel="noopener noreferrer">
          Read all reviews on Google
        </a>
      </div>
    </div>
  );
}
