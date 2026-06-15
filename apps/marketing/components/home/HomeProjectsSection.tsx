'use client';

import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/cn';
import CardCarousel from '@/components/ui/CardCarousel';

export type HomeProjectCard = {
  slug: string;
  title: string;
  location: string;
  heroImage: { src: string; alt: string; objectPosition?: string };
};

type HomeProjectsSectionProps = {
  projects: HomeProjectCard[];
  seeMoreHref?: string;
  seeMoreLabel?: string;
  className?: string;
};

export default function HomeProjectsSection({
  projects,
  seeMoreHref = '/projects',
  seeMoreLabel = 'See more projects',
  className,
}: HomeProjectsSectionProps) {
  if (!projects.length) return null;

  return (
    <section
      aria-labelledby="projects-home-heading"
      className={cn(
        'home-projects-section',
        'border-y border-page bg-page py-[clamp(56px,8vh,112px)] [border-top-width:var(--bw)] [border-bottom-width:var(--bw)]',
        className
      )}
    >
      <div className="home-projects-section__inner mx-auto w-[min(88vw,1288px)]">
        <div className="home-projects-section__head flex items-end justify-between gap-6">
          <div className="home-projects-section__copy max-w-[60ch]">
            <p className="home-projects-section__eyebrow text-[12px] uppercase tracking-[0.12em] text-muted">Projects</p>
            <h2
              id="projects-home-heading"
              className="home-projects-section__title mt-2 text-balance text-[clamp(28px,3.2vw,42px)] font-semibold leading-[1.08] tracking-[-0.015em] text-ink"
            >
              Built environments, resolved in detail.
            </h2>
            <p className="home-projects-section__intro mt-3 text-[16px] leading-[1.6] text-muted">
              A selection of recent residential and commercial installs, each tuned to site, roof form, and how the space is actually used.
            </p>
          </div>
        </div>
      </div>

      <CardCarousel
        ariaLabel="Projects"
        showArrows={projects.length > 1}
        className="mt-8"
        arrowsClassName="mx-auto w-[min(88vw,1288px)]"
        trackClassName="home-projects-section__track"
        railClassName="gap-4 md:gap-6"
      >
        {projects.map((project) => (
          <Link
            key={project.slug}
            href={`/projects?slug=${project.slug}`}
            className="home-projects-section__card group relative h-[clamp(345px,60vh,470px)] w-[min(86vw,560px)] overflow-hidden border border-page bg-card [border-width:var(--bw)]"
            aria-label={`${project.title} - ${project.location}`}
          >
            <Image
              src={project.heroImage.src}
              alt={project.heroImage.alt}
              fill
              sizes="(max-width: 768px) 82vw, 560px"
              quality={60}
              className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,0.61,0.36,1)] group-hover:scale-[1.04]"
              style={{ objectPosition: project.heroImage.objectPosition || 'center' }}
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
          className="home-projects-section__card home-projects-section__card--more group relative h-[clamp(345px,60vh,470px)] w-[min(70vw,420px)] overflow-hidden border border-page bg-[var(--accentRed)] [border-width:var(--bw)]"
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
      </CardCarousel>
    </section>
  );
}
