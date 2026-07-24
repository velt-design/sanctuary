'use client';

import {
  type KeyboardEvent,
  useId,
  useState,
} from 'react';
import { cn } from '@/lib/cn';
import {
  Figure,
  type MediaRatio,
} from './Primitives';
import styles from './Interactions.module.css';

export type ResponsiveGalleryItem = {
  alt: string;
  caption?: string;
  detail?: string;
  id?: string;
  image: string;
  mobileObjectPosition?: string;
  mobileRatio?: MediaRatio;
  objectPosition?: string;
  ratio?: MediaRatio;
  sizes?: string;
};

type ResponsiveGalleryProps = {
  className?: string;
  initialIndex?: number;
  items: ResponsiveGalleryItem[];
  label: string;
};

function clampInitialIndex(index: number, itemCount: number) {
  return Math.min(Math.max(index, 0), Math.max(itemCount - 1, 0));
}

export function ResponsiveGallery({
  className,
  initialIndex = 0,
  items,
  label,
}: ResponsiveGalleryProps) {
  const statusId = `${useId()}-gallery-status`;
  const [activeIndex, setActiveIndex] = useState(() => (
    clampInitialIndex(initialIndex, items.length)
  ));

  if (items.length === 0) return null;

  const safeIndex = clampInitialIndex(activeIndex, items.length);
  const activeItem = items[safeIndex];
  const positionLabel = `Image ${safeIndex + 1} of ${items.length}`;
  const hasMultipleItems = items.length > 1;

  const showRelativeItem = (offset: -1 | 1) => {
    setActiveIndex((current) => (
      (clampInitialIndex(current, items.length) + offset + items.length) % items.length
    ));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      showRelativeItem(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      showRelativeItem(1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setActiveIndex(items.length - 1);
    }
  };

  return (
    <section
      className={cn(styles.gallery, className)}
      data-responsive-gallery
      data-gallery-position={`${safeIndex + 1}/${items.length}`}
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      aria-describedby={statusId}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div className={styles.galleryViewport}>
        <div
          className={styles.gallerySlide}
          data-gallery-active-item={activeItem.id ?? activeItem.image}
        >
          <Figure
            image={activeItem.image}
            alt={activeItem.alt}
            caption={activeItem.caption}
            detail={activeItem.detail}
            ratio={activeItem.ratio}
            mobileRatio={activeItem.mobileRatio}
            sizes={activeItem.sizes}
            objectPosition={activeItem.objectPosition}
            mobileObjectPosition={activeItem.mobileObjectPosition}
          />
        </div>
      </div>
      <div className={styles.galleryControls} role="group" aria-label={`${label} controls`}>
        <button
          className={styles.galleryButton}
          type="button"
          disabled={!hasMultipleItems}
          aria-label={`Previous image in ${label}`}
          onClick={() => showRelativeItem(-1)}
        >
          <span aria-hidden="true">←</span>
          <span>Previous</span>
        </button>
        <p
          className={styles.galleryStatus}
          id={statusId}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {positionLabel}
        </p>
        <button
          className={styles.galleryButton}
          type="button"
          disabled={!hasMultipleItems}
          aria-label={`Next image in ${label}`}
          onClick={() => showRelativeItem(1)}
        >
          <span>Next</span>
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </section>
  );
}
