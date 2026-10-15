import { featuredReviews } from '../../data/reviews';
import styles from './funnel.module.css';

export default function FunnelReview({ acrylic = false }: { acrylic?: boolean }) {
  const review = featuredReviews.find(item => item.author === (acrylic ? 'Rob Ebert' : 'Stuart Jones'))!;
  return <figure className={styles.review}><span aria-label="5 out of 5 stars">★★★★★</span><blockquote>{review.quote}</blockquote><figcaption>{review.author} · Google review</figcaption></figure>;
}
