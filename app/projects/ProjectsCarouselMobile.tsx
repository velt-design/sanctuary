'use client';

import { useRef } from 'react';
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
