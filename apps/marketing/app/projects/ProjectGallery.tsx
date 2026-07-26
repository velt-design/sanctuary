'use client';

import Image from 'next/image';
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import type { Project } from '@/data/projects';
import styles from './ProjectGallery.module.css';

type ProjectGalleryImage = Project['gallery'][number];

type ProjectGalleryProps = {
  images: ProjectGalleryImage[];
  projectTitle: string;
};

export default function ProjectGallery({
  images,
  projectTitle,
}: ProjectGalleryProps) {
  const galleryRef = useRef<HTMLDivElement | null>(null);
  const indexUpdateFrameRef = useRef<number | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const positionId = useId();

  const updateCurrentIndex = useCallback(() => {
    const gallery = galleryRef.current;
    if (!gallery) return;

    const galleryBounds = gallery.getBoundingClientRect();
    const galleryCentre = galleryBounds.left + galleryBounds.width / 2;
    const figures = [
      ...gallery.querySelectorAll<HTMLElement>(':scope > figure'),
    ];
    let closestIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;

    figures.forEach((figure, index) => {
      const figureBounds = figure.getBoundingClientRect();
      const figureCentre = figureBounds.left + figureBounds.width / 2;
      const distance = Math.abs(figureCentre - galleryCentre);
      if (distance < closestDistance) {
        closestIndex = index;
        closestDistance = distance;
      }
    });

    setCurrentIndex(closestIndex);
  }, []);

  const scheduleIndexUpdate = useCallback(() => {
    if (indexUpdateFrameRef.current !== null) return;
    indexUpdateFrameRef.current = window.requestAnimationFrame(() => {
      indexUpdateFrameRef.current = null;
      updateCurrentIndex();
    });
  }, [updateCurrentIndex]);

  useEffect(() => {
    const gallery = galleryRef.current;
    if (!gallery || typeof ResizeObserver === 'undefined') return;

    const resizeObserver = new ResizeObserver(updateCurrentIndex);
    resizeObserver.observe(gallery);
    for (const figure of gallery.querySelectorAll(':scope > figure')) {
      resizeObserver.observe(figure);
    }
    return () => {
      resizeObserver.disconnect();
      if (indexUpdateFrameRef.current !== null) {
        window.cancelAnimationFrame(indexUpdateFrameRef.current);
        indexUpdateFrameRef.current = null;
      }
    };
  }, [images, updateCurrentIndex]);

  const scrollToIndex = useCallback(
    (index: number) => {
      const gallery = galleryRef.current;
      const figure = gallery?.querySelectorAll<HTMLElement>(
        ':scope > figure',
      )[index];
      if (!gallery || !figure) return;

      const galleryBounds = gallery.getBoundingClientRect();
      const figureBounds = figure.getBoundingClientRect();
      const centredLeft =
        gallery.scrollLeft
        + figureBounds.left
        - galleryBounds.left
        - (gallery.clientWidth - figureBounds.width) / 2;
      const reducedMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches;

      setCurrentIndex(index);
      gallery.scrollTo({
        behavior: reducedMotion ? 'auto' : 'smooth',
        left: Math.max(0, centredLeft),
      });
    },
    [],
  );

  const handleGalleryKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    let nextIndex: number | null = null;
    if (event.key === 'ArrowLeft') nextIndex = currentIndex - 1;
    if (event.key === 'ArrowRight') nextIndex = currentIndex + 1;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = images.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    scrollToIndex(Math.max(0, Math.min(images.length - 1, nextIndex)));
  };

  const atStart = currentIndex === 0;
  const atEnd = currentIndex === images.length - 1;

  return (
    <div className={styles.shell} data-project-gallery-shell>
      <div
        aria-describedby={positionId}
        aria-label={`${projectTitle} project gallery`}
        className="project-case-study__gallery"
        data-project-gallery-layout="responsive-strip"
        onKeyDown={handleGalleryKeyDown}
        onScroll={scheduleIndexUpdate}
        ref={galleryRef}
        role="region"
        tabIndex={0}
      >
        {images.map((image, index) => (
          <figure key={image.src}>
            <div className="project-case-study__gallery-media">
              <Image
                src={image.src}
                alt={image.alt}
                fill
                loading="lazy"
                sizes="(max-width: 640px) 74vw, (max-width: 899px) 84vw, (max-width: 1280px) 52vw, 720px"
                style={{ objectPosition: image.objectPosition ?? 'center' }}
              />
            </div>
            <figcaption>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <span>{image.alt}</span>
            </figcaption>
          </figure>
        ))}
      </div>

      <div className={styles.controls}>
        <button
          aria-disabled={atStart}
          aria-label={`Previous image in ${projectTitle} project gallery`}
          className={styles.control}
          onClick={() => {
            if (!atStart) scrollToIndex(currentIndex - 1);
          }}
          type="button"
        >
          <span aria-hidden="true">←</span>
          <span>Previous</span>
        </button>
        <p
          aria-atomic="true"
          aria-live="polite"
          className={styles.position}
          id={positionId}
        >
          Image {currentIndex + 1} of {images.length}
        </p>
        <button
          aria-disabled={atEnd}
          aria-label={`Next image in ${projectTitle} project gallery`}
          className={styles.control}
          onClick={() => {
            if (!atEnd) scrollToIndex(currentIndex + 1);
          }}
          type="button"
        >
          <span>Next</span>
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  );
}
