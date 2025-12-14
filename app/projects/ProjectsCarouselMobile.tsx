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
    isDragging: false,
    startX: 0,
    startY: 0,
  });

  const startDrag = (x: number, y: number) => {
    dragStateRef.current.active = true;
    dragStateRef.current.isDragging = false;
    dragStateRef.current.startX = x;
    dragStateRef.current.startY = y;
  };

  const updateDrag = (x: number, y: number) => {
    const state = dragStateRef.current;
    if (!state.active || state.isDragging) return;
    const dx = x - state.startX;
    const dy = y - state.startY;
    const distance = Math.hypot(dx, dy);
    if (distance > 10) {
      state.isDragging = true;
    }
  };

  const endDrag = () => {
    dragStateRef.current.active = false;
  };

  const handlePointerDown: React.PointerEventHandler<HTMLAnchorElement> = event => {
    startDrag(event.clientX, event.clientY);
  };

  const handlePointerMove: React.PointerEventHandler<HTMLAnchorElement> = event => {
    updateDrag(event.clientX, event.clientY);
  };

  const handlePointerUp: React.PointerEventHandler<HTMLAnchorElement> = () => {
    endDrag();
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
    const isHomepage = typeof document !== 'undefined' && document.body.classList.contains('homepage');
    if (!isDesktop || !isHomepage) return;

    const track = trackRef.current;
    if (!track) return;

    const firstCard = track.querySelector<HTMLElement>('[data-project-card]');
    if (!firstCard) return;

    // On desktop homepage, pad the left side of the track so
    // the first card sits centered in the viewport with white
    // space to the left at scrollLeft = 0.
    const cs = getComputedStyle(track);
    const basePaddingLeft = parseFloat(cs.paddingLeft || '0') || 0;
    const desired = track.clientWidth / 2 - firstCard.offsetWidth / 2;
    if (desired > basePaddingLeft) {
      track.style.paddingLeft = `${desired}px`;
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
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
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
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
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
