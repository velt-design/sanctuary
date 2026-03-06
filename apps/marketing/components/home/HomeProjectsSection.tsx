'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/cn';

export type HomeProjectCard = {
  slug: string;
  title: string;
  location: string;
  heroImage: { src: string; alt: string };
};

type HomeProjectsSectionProps = {
  projects: HomeProjectCard[];
  seeMoreHref?: string;
  seeMoreLabel?: string;
  className?: string;
};

function IconChevronLeft() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px]">
      <path d="M14.5 6.5L9 12l5.5 5.5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="square" />
    </svg>
  );
}

function IconChevronRight() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px]">
      <path d="M9.5 6.5L15 12l-5.5 5.5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="square" />
    </svg>
  );
}

export default function HomeProjectsSection({
  projects,
  seeMoreHref = '/projects',
  seeMoreLabel = 'See more projects',
  className,
}: HomeProjectsSectionProps) {
  const trackRef = React.useRef<HTMLDivElement | null>(null);

  const scrollByCard = React.useCallback((direction: -1 | 1) => {
    const track = trackRef.current;
    if (!track) return;

    const firstCard = track.querySelector<HTMLElement>('[data-home-project-card]');
    let delta = track.clientWidth * 0.84;

    if (firstCard) {
      const secondCard = firstCard.nextElementSibling as HTMLElement | null;
      if (secondCard) {
        delta = Math.abs(secondCard.offsetLeft - firstCard.offsetLeft);
      } else {
        delta = firstCard.getBoundingClientRect().width;
      }
    }

    track.scrollBy({ left: direction * delta, behavior: 'smooth' });
  }, []);

  if (!projects.length) return null;

  return (
    <section
      aria-labelledby="projects-home-heading"
      className={cn(
        'border-y border-page bg-page py-[clamp(56px,8vh,112px)] [border-top-width:var(--bw)] [border-bottom-width:var(--bw)]',
        className
      )}
    >
      <div className="mx-auto w-[min(88vw,1288px)]">
        <div className="flex items-end justify-between gap-6">
          <div className="max-w-[60ch]">
            <p className="text-[12px] uppercase tracking-[0.12em] text-muted">Projects</p>
            <h2
              id="projects-home-heading"
              className="mt-2 text-balance text-[clamp(28px,3.2vw,42px)] font-semibold leading-[1.08] tracking-[-0.015em] text-ink"
            >
              Built environments, resolved in detail.
            </h2>
            <p className="mt-3 text-[16px] leading-[1.6] text-muted">
              A selection of recent residential and commercial installs, each tuned to site, roof form, and how the space is actually used.
            </p>
          </div>

          {projects.length > 1 ? (
            <div className="hidden items-center gap-2 md:flex" aria-label="Projects carousel controls">
              <button
                type="button"
                onClick={() => scrollByCard(-1)}
                aria-label="Previous project"
                className="inline-flex h-10 w-10 items-center justify-center border border-page bg-card text-ink transition-colors hover:bg-page focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/35"
              >
                <IconChevronLeft />
              </button>
              <button
                type="button"
                onClick={() => scrollByCard(1)}
                aria-label="Next project"
                className="inline-flex h-10 w-10 items-center justify-center border border-page bg-card text-ink transition-colors hover:bg-page focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/35"
              >
                <IconChevronRight />
              </button>
            </div>
          ) : null}
        </div>

        <div ref={trackRef} className="mt-8 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex snap-x snap-mandatory gap-4 md:gap-6">
            {projects.map((project) => (
              <Link
                key={project.slug}
                href={`/projects?slug=${project.slug}`}
                data-home-project-card="true"
                className="group relative h-[clamp(345px,60vh,470px)] w-[min(86vw,560px)] shrink-0 snap-start overflow-hidden border border-page bg-card [border-width:var(--bw)]"
                aria-label={`${project.title} - ${project.location}`}
              >
                <Image
                  src={project.heroImage.src}
                  alt={project.heroImage.alt}
                  fill
                  sizes="(max-width: 768px) 86vw, (max-width: 1440px) 38vw, 560px"
                  quality={60}
                  className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,0.61,0.36,1)] group-hover:scale-[1.04]"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

                <div className="absolute inset-x-0 bottom-0 z-10 p-4 text-white md:p-6">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-white/80">Projects</p>
                  <h3 className="mt-2 text-[clamp(24px,2.6vw,34px)] font-semibold leading-[1.1] tracking-[-0.015em]">
                    {project.title}
                  </h3>
                  {project.location ? (
                    <p className="mt-2 max-w-[44ch] text-[15px] leading-[1.55] text-white/88">{project.location}</p>
                  ) : null}
                  <span className="mt-3 inline-flex border border-white/70 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]">
                    View project
                  </span>
                </div>
              </Link>
            ))}

            <Link
              href={seeMoreHref}
              className="group relative h-[clamp(345px,60vh,470px)] w-[min(70vw,420px)] shrink-0 snap-start overflow-hidden border border-page bg-[var(--accentRed)] [border-width:var(--bw)]"
              aria-label={seeMoreLabel}
            >
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.04),rgba(0,0,0,0.24))]" />
              <div className="relative z-10 flex h-full flex-col justify-end p-5 text-white md:p-6">
                <p className="text-[11px] uppercase tracking-[0.12em] text-white/82">Projects</p>
                <h3 className="mt-2 text-[clamp(22px,2.4vw,32px)] font-semibold leading-[1.1] tracking-[-0.015em]">
                  {seeMoreLabel}
                </h3>
                <span className="mt-3 inline-flex border border-white/70 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]">
                  Browse all
                </span>
              </div>
            </Link>
          </div>
        </div>

        {projects.length > 1 ? (
          <div className="mt-4 flex items-center justify-end gap-2 md:hidden" aria-label="Projects carousel controls">
            <button
              type="button"
              onClick={() => scrollByCard(-1)}
              aria-label="Previous project"
              className="inline-flex h-10 w-10 items-center justify-center border border-page bg-card text-ink transition-colors hover:bg-page focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/35"
            >
              <IconChevronLeft />
            </button>
            <button
              type="button"
              onClick={() => scrollByCard(1)}
              aria-label="Next project"
              className="inline-flex h-10 w-10 items-center justify-center border border-page bg-card text-ink transition-colors hover:bg-page focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/35"
            >
              <IconChevronRight />
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
