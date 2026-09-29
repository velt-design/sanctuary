'use client';

import {
  type CSSProperties,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { cn } from '@/lib/cn';
import Image from 'next/image';
import {
  Figure,
  type MediaRatio,
} from './Primitives';
import styles from './Interactions.module.css';
import { useGalleryDirectManipulation } from './useGalleryDirectManipulation';

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
  swipe?: boolean;
  thumbnails?: boolean;
};

const ADJACENT_PRELOAD_ROOT_MARGIN = '160px 0px';

function clampInitialIndex(index: number, itemCount: number) {
  return Math.min(Math.max(index, 0), Math.max(itemCount - 1, 0));
}

export function ResponsiveGallery({
  className,
  initialIndex = 0,
  items,
  label,
  swipe = false,
  thumbnails = false,
}: ResponsiveGalleryProps) {
  const statusId = `${useId()}-gallery-status`;
  const galleryRef = useRef<HTMLElement>(null);
  const thumbnailStripRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(() => (
    clampInitialIndex(initialIndex, items.length)
  ));
  const [adjacentReady, setAdjacentReady] = useState(false);

  const safeIndex = clampInitialIndex(activeIndex, items.length);
  const positionLabel = `Image ${safeIndex + 1} of ${items.length}`;
  const hasMultipleItems = items.length > 1;
  const itemSignature = items
    .map((item) => item.id ?? item.image)
    .join('|');

  const activateAdjacentFrames = useCallback(() => {
    setAdjacentReady(true);
  }, []);

  const showRelativeItem = useCallback((offset: -1 | 1) => {
    if (swipe) activateAdjacentFrames();
    setActiveIndex((current) => (
      (clampInitialIndex(current, items.length) + offset + items.length) % items.length
    ));
  }, [activateAdjacentFrames, items.length, swipe]);

  const { handlers: directManipulationHandlers, viewportRef } = useGalleryDirectManipulation({
    activeIndex: safeIndex,
    enabled: swipe && hasMultipleItems,
    itemSignature,
    onActivate: activateAdjacentFrames,
    onCommit: showRelativeItem,
  });

  useEffect(() => {
    const gallery = galleryRef.current;
    if (!gallery || adjacentReady || !swipe || !hasMultipleItems) return;
    if (!('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      activateAdjacentFrames();
      observer.disconnect();
    }, { rootMargin: ADJACENT_PRELOAD_ROOT_MARGIN });
    observer.observe(gallery);
    return () => observer.disconnect();
  }, [activateAdjacentFrames, adjacentReady, hasMultipleItems, swipe]);

  useEffect(() => {
    setActiveIndex((current) => clampInitialIndex(current, items.length));
  }, [itemSignature, items.length]);

  useEffect(() => {
    const strip = thumbnailStripRef.current;
    const selected = strip?.children[safeIndex] as HTMLElement | undefined;
    if (!strip || !selected) return;
    const left = selected.offsetLeft - strip.offsetLeft;
    if (left < strip.scrollLeft) strip.scrollLeft = left;
    else if (left + selected.offsetWidth > strip.scrollLeft + strip.clientWidth) {
      strip.scrollLeft = left + selected.offsetWidth - strip.clientWidth;
    }
  }, [safeIndex]);

  if (items.length === 0) return null;

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
      if (swipe) activateAdjacentFrames();
      setActiveIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      if (swipe) activateAdjacentFrames();
      setActiveIndex(items.length - 1);
    }
  };

  const frameIndexes = adjacentReady && hasMultipleItems
    ? [
      { index: (safeIndex - 1 + items.length) % items.length, offset: -1 },
      { index: safeIndex, offset: 0 },
      { index: (safeIndex + 1) % items.length, offset: 1 },
    ]
    : [{ index: safeIndex, offset: 0 }];

  return (
    <section
      ref={galleryRef}
      className={cn(styles.gallery, className)}
      data-responsive-gallery
      data-gallery-position={`${safeIndex + 1}/${items.length}`}
      data-gallery-swipe={swipe || undefined}
      data-gallery-thumbnails={thumbnails || undefined}
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      aria-describedby={statusId}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div
        ref={viewportRef}
        className={styles.galleryViewport}
        data-gallery-adjacent-ready={adjacentReady || undefined}
        {...directManipulationHandlers}
      >
        {frameIndexes.map(({ index, offset }) => {
          const item = items[index];
          const isActive = offset === 0;
          const frameStyle = {
            '--gallery-frame-offset': `${offset * 100}%`,
          } as CSSProperties;

          return (
            <div
              key={`${offset}:${item.id ?? item.image}`}
              className={styles.gallerySlide}
              data-gallery-active-item={isActive ? (item.id ?? item.image) : undefined}
              data-gallery-frame={offset}
              data-gallery-frame-active={isActive || undefined}
              aria-hidden={isActive ? undefined : true}
              style={frameStyle}
            >
              <Figure
                image={item.image}
                alt={isActive ? item.alt : ''}
                caption={isActive ? item.caption : undefined}
                detail={isActive ? item.detail : undefined}
                ratio={item.ratio}
                mobileRatio={item.mobileRatio}
                sizes={item.sizes}
                objectPosition={item.objectPosition}
                mobileObjectPosition={item.mobileObjectPosition}
              />
            </div>
          );
        })}
      </div>
      {thumbnails && hasMultipleItems && (
        <div ref={thumbnailStripRef} className={styles.galleryThumbnails} role="group" aria-label={`${label} thumbnails`}>
          {items.map((item, index) => (
            <button
              key={item.id ?? item.image}
              type="button"
              className={styles.galleryThumbnail}
              aria-label={`Show image ${index + 1}: ${item.caption ?? item.alt}`}
              aria-pressed={index === safeIndex}
              onClick={() => { activateAdjacentFrames(); setActiveIndex(index); }}
              onKeyDown={(event) => {
                if (event.altKey || event.ctrlKey || event.metaKey) return;
                const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
                  : event.key === 'ArrowRight' ? (index + 1) % items.length
                    : event.key === 'ArrowLeft' ? (index - 1 + items.length) % items.length : null;
                if (next === null) return;
                event.preventDefault();
                event.stopPropagation();
                activateAdjacentFrames();
                setActiveIndex(next);
                (thumbnailStripRef.current?.children[next] as HTMLButtonElement | undefined)?.focus({ preventScroll: true });
              }}
            >
              <Image src={item.image} alt="" width={112} height={84} sizes="112px" loading="lazy" style={{ objectPosition: item.objectPosition }} />
              <span className={styles.galleryThumbnailNumber} aria-hidden="true">{index + 1}</span>
            </button>
          ))}
        </div>
      )}
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
