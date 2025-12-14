'use client';

import { useEffect, useRef } from 'react';
import type React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { Project } from '@/data/projects';

type ProjectsCarouselMobileProps = {
  projects: Project[];
  seeMoreHref?: string;
  seeMoreLabel?: string;
  showNav?: boolean;
};

export default function ProjectsCarouselMobile({
  projects,
  seeMoreHref,
  seeMoreLabel = 'See more projects',
  showNav = true,
}: ProjectsCarouselMobileProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef({
    active: false,
    isDragging: false, // true when movement exceeds tap threshold
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
  });

  const startDrag = (x: number, y: number) => {
    const state = dragStateRef.current;
    state.active = true;
    state.isDragging = false;
    state.startX = x;
    state.startY = y;
    state.lastX = x;
    state.lastY = y;
  };

  const updateDrag = (x: number, y: number) => {
    const state = dragStateRef.current;
    if (!state.active) return;
    state.lastX = x;
    state.lastY = y;
  };

  const endDrag = () => {
    const state = dragStateRef.current;
    if (!state.active) return;
    const dx = state.lastX - state.startX;
    const dy = state.lastY - state.startY;
    const distance = Math.hypot(dx, dy);
    const TAP_THRESHOLD = 14; // px – small jitter allowed
    // If movement exceeds threshold, treat as swipe/scroll, not a tap
    state.isDragging = distance > TAP_THRESHOLD;
    state.active = false;
  };

  const handleTouchStart: React.TouchEventHandler<HTMLAnchorElement> = event => {
    const touch = event.touches[0] || event.changedTouches[0];
    if (!touch) return;
    startDrag(touch.clientX, touch.clientY);
  };

  const handleTouchMove: React.TouchEventHandler<HTMLAnchorElement> = event => {
    const touch = event.touches[0] || event.changedTouches[0];
    if (!touch) return;
    updateDrag(touch.clientX, touch.clientY);
  };

  const handleTouchEnd: React.TouchEventHandler<HTMLAnchorElement> = () => {
    endDrag();
  };

  const handleCardClick: React.MouseEventHandler<HTMLAnchorElement> = event => {
    if (dragStateRef.current.isDragging) {
      event.preventDefault();
      event.stopPropagation();
      dragStateRef.current.isDragging = false;
    }
  };

  useEffect(() => {
    if (!projects.length) return;
    if (typeof window === 'undefined') return;
    const isDesktop = window.matchMedia('(min-width: 961px)').matches;
    if (!isDesktop) return;

    const track = trackRef.current;
    if (!track) return;

    const firstCard = track.querySelector<HTMLElement>('[data-project-card]');
    if (!firstCard) return;

    // On desktop, pad the left side of the track so the first card
    // sits centered in the viewport with white space on the left at
    // scrollLeft = 0. This keeps Velskov Forest visible on the right.
    const cs = getComputedStyle(track);
    const currentRight = cs.paddingRight;
    const desired = Math.max(0, track.clientWidth / 2 - firstCard.offsetWidth / 2);
    track.style.paddingLeft = `${desired}px`;
    // Preserve whatever right padding was configured in CSS
    if (currentRight) {
      track.style.paddingRight = currentRight;
    }
    track.scrollLeft = 0;
  }, [projects.length]);

  if (!projects.length) return null;

  const scrollByCard = (direction: -1 | 1) => {
    const track = trackRef.current;
    if (!track) return;

    const firstCard = track.querySelector<HTMLElement>('[data-project-card]');
    let delta = track.clientWidth * 0.8;

    if (firstCard) {
      const secondCard = firstCard.nextElementSibling as HTMLElement | null;
      if (secondCard) {
        delta = Math.abs(secondCard.offsetLeft - firstCard.offsetLeft);
      } else {
        delta = firstCard.getBoundingClientRect().width;
      }
    }

    track.scrollBy({ left: direction * delta, behavior: 'smooth' });
  };

  return (
    <section className="projects-mobile-carousel" aria-label="Projects carousel">
      <div className="projects-mobile-carousel__track" ref={trackRef}>
        {projects.map((project, index) => (
          <Link
            key={project.slug}
            href={`/projects/${project.slug}`}
            className="projects-mobile-card"
            data-project-card
            aria-label={`${project.title} – ${project.location}`}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
            onClick={handleCardClick}
          >
            <div className="projects-mobile-card__image">
              <Image
                src={project.heroImage.src}
                alt={project.heroImage.alt}
                fill
                priority={index === 0}
                sizes="(max-width: 720px) 100vw, 480px"
                style={{ objectFit: 'cover' }}
              />
            </div>
            <div className="projects-mobile-card__panel">
              <p className="projects-mobile-card__eyebrow">Projects</p>
              <p className="projects-mobile-card__title">{project.title}</p>
              {project.location ? (
                <p className="projects-mobile-card__location">{project.location}</p>
              ) : null}
            </div>
          </Link>
        ))}
        {seeMoreHref ? (
          <Link
            href={seeMoreHref}
            className="projects-mobile-card projects-mobile-card--cta"
            aria-label={seeMoreLabel}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
            onClick={handleCardClick}
          >
            <div className="projects-mobile-card__panel">
              <p className="projects-mobile-card__title projects-mobile-card__title--cta">
                {seeMoreLabel}
              </p>
            </div>
          </Link>
        ) : null}
      </div>
      {projects.length > 1 && showNav !== false && (
        <div className="projects-mobile-carousel__nav" aria-label="Scroll projects">
          <button type="button" onClick={() => scrollByCard(-1)} aria-label="Previous project">
            <span aria-hidden>‹</span>
          </button>
          <button type="button" onClick={() => scrollByCard(1)} aria-label="Next project">
            <span aria-hidden>›</span>
          </button>
        </div>
      )}
    </section>
  );
}
