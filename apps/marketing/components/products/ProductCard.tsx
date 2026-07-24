import Image from 'next/image';
import Link from 'next/link';
import type { ProductRecord } from '@/data/products';
import styles from './product-pages.module.css';

type ProductCardProps = {
  product: ProductRecord;
  priority?: boolean;
  compact?: boolean;
  number?: number;
};

export default function ProductCard({
  product,
  priority = false,
  compact = false,
  number,
}: ProductCardProps) {
  return (
    <article className={compact ? styles.productCardCompact : styles.productCard}>
      <Link
        href={product.route}
        className={styles.productCardLink}
        aria-label={`Explore ${product.name}`}
      >
        <div className={styles.productCardMedia}>
          <Image
            src={product.hero.src}
            alt={product.hero.alt}
            fill
            priority={priority}
            sizes={
              compact
                ? '(max-width: 640px) 112px, (max-width: 1100px) 50vw, 33vw'
                : '(max-width: 720px) 100vw, 50vw'
            }
            style={{ objectPosition: product.hero.objectPosition }}
          />
          {number ? (
            <span className={styles.productCardIndex} aria-hidden="true">
              {String(number).padStart(2, '0')}
            </span>
          ) : null}
        </div>
        <div className={styles.productCardBody}>
          <p className={styles.productCardGroup}>{product.categoryLabel}</p>
          <h3 className={styles.productCardTitle}>{product.name}</h3>
          <p className={styles.productCardSummary}>{product.indexSummary}</p>
          <span className={styles.productCardAction}>Explore this choice</span>
        </div>
      </Link>
    </article>
  );
}
