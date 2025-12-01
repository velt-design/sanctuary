"use client";

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Project } from '@/data/projects';

const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');

type ProjectDetailContentProps = {
  project: Project | null;
  isLoading?: boolean;
  relatedProjects?: Project[];
  onSelectRelated?: (slug: string) => void;
  relationMode?: 'inline' | 'link';
  variant?: 'embedded' | 'standalone';
  titleAs?: 'h1' | 'h2' | 'h3';
};

export default function ProjectDetailContent({
  project,
  isLoading,
  relatedProjects = [],
  onSelectRelated,
  relationMode = 'inline',
  variant = 'embedded',
  titleAs = 'h2',
}: ProjectDetailContentProps) {
  const [activeSlide, setActiveSlide] = useState(0);
  const touchStartRef = useRef<number | null>(null);

  const heroSlides = useMemo(() => {
    if (!project) return [];
    const gallery = project.gallery?.length ? project.gallery : [];
    const hasHero = gallery.some(image => image.src === project.heroImage.src);
    const slides = hasHero ? gallery : [project.heroImage, ...gallery];
    return slides.length ? slides : [project.heroImage];
  }, [project]);

  useEffect(() => {
    if (project) setActiveSlide(0);
  }, [project]);

  const totalSlides = heroSlides.length;

  const goPrev = useCallback(() => {
    if (!totalSlides) return;
    setActiveSlide(prev => (prev - 1 + totalSlides) % totalSlides);
  }, [totalSlides]);

  const goNext = useCallback(() => {
    if (!totalSlides) return;
    setActiveSlide(prev => (prev + 1) % totalSlides);
  }, [totalSlides]);

  const handleTouchStart: React.TouchEventHandler<HTMLDivElement> = event => {
    touchStartRef.current = event.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd: React.TouchEventHandler<HTMLDivElement> = event => {
    const startX = touchStartRef.current;
    const endX = event.changedTouches[0]?.clientX ?? null;
    touchStartRef.current = null;
    if (startX === null || endX === null) return;
    const delta = endX - startX;
    if (Math.abs(delta) < 30) return;
    if (delta > 0) goPrev(); else goNext();
  };

  if (isLoading) {
    return <ProjectDetailSkeleton />;
  }

  if (!project) {
    return (
      <article className="project-detail project-detail--empty">
        <div className="project-detail__placeholder">
          <p className="project-detail__eyebrow">Projects</p>
          <h2>Select a project to see details</h2>
          <p>Filter or search on the left to load a pergola case study.</p>
        </div>
      </article>
    );
  }

  const factList = [
    { label: 'Type', value: project.type },
    { label: 'Roof', value: project.roof },
    { label: 'Year', value: project.year },
    { label: 'Region', value: project.region },
  ];

  const dimensionList = [
    { label: 'Width', value: project.stats.width },
    { label: 'Depth', value: project.stats.depth },
    { label: 'Height', value: project.stats.height },
    { label: 'Area', value: project.stats.area },
    { label: 'Pitch', value: project.stats.pitch },
  ].filter(item => item.value);

  const TitleTag = titleAs;

  return (
    <article
      className={cx('project-detail', variant === 'standalone' && 'project-detail--standalone')}
      aria-label={`${project.title} detail`}
    >
      <div
        className="project-detail__hero"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        aria-live="polite"
      >
        <div className="project-detail__media">
          <Image
            key={heroSlides[activeSlide]?.src}
            src={heroSlides[activeSlide]?.src || project.heroImage.src}
            alt={heroSlides[activeSlide]?.alt || project.heroImage.alt}
            fill
            priority={variant === 'standalone'}
            sizes="(max-width: 720px) 100vw, (max-width: 1280px) 66vw, 900px"
            style={{ objectFit: 'cover' }}
          />
          {totalSlides > 1 && (
            <>
              <div className="project-hero__badge">
                <span>{activeSlide + 1} / {totalSlides}</span>
              </div>
              <div className="project-hero__nav" aria-label="Project gallery navigation">
                <button type="button" onClick={goPrev} aria-label="Previous image">
                  <span aria-hidden>‹</span>
                </button>
                <button type="button" onClick={goNext} aria-label="Next image">
                  <span aria-hidden>›</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      <div className="project-detail__body">
        <p className="project-detail__location">{project.location}</p>
        <TitleTag className="project-detail__title">{project.title}</TitleTag>
        <p className="project-detail__blurb">{project.blurb}</p>

        <dl className="project-detail__stats">
          {factList.map(fact => (
            <div key={fact.label}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>

        {dimensionList.length ? (
          <dl className="project-detail__dimensions">
            {dimensionList.map(dim => (
              <div key={dim.label}>
                <dt>{dim.label}</dt>
                <dd>{dim.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        {project.tags.length ? (
          <div className="project-detail__tags" aria-label="Project tags">
            {project.tags.map(tag => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        ) : null}

        <div className="project-detail__copy">
          {project.description.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>

        <div className="project-detail__grid">
          <section>
            <h3>Scope of work</h3>
            <ul>
              {project.scope.map(item => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
          <section>
            <h3>Add-ons & services</h3>
            <ul>
              {project.extras.map(item => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        </div>

        {project.gallery.length ? (
          <section className="project-detail__gallery" aria-label="Gallery">
            {project.gallery.map(image => (
              <figure key={image.src}>
                <Image
                  src={image.src}
                  alt={image.alt}
                  fill
                  loading="lazy"
                  sizes="(max-width: 720px) 100vw, (max-width: 1280px) 30vw, 360px"
                  style={{ objectFit: 'cover' }}
                />
              </figure>
            ))}
          </section>
        ) : null}

        {relatedProjects.length ? (
          <section className="project-detail__related" aria-label="Related projects">
            <div className="project-detail__related-head">
              <h3>Related projects</h3>
              <p>Explore similar spans, finishes or briefs.</p>
            </div>
            <div className="project-detail__related-grid">
              {relatedProjects.map(related => {
                const body = (
                  <>
                    <span className="project-detail__related-kicker">{related.region}</span>
                    <span className="project-detail__related-title">{related.title}</span>
                    <span className="project-detail__related-meta">{related.type} · {related.roof}</span>
                  </>
                );

                if (relationMode === 'inline') {
                  return (
                    <button
                      type="button"
                      key={related.slug}
                      className="project-detail__related-card"
                      onClick={() => onSelectRelated?.(related.slug)}
                    >
                      {body}
                    </button>
                  );
                }

                return (
                  <Link
                    key={related.slug}
                    className="project-detail__related-card"
                    href={`/projects/${related.slug}`}
                  >
                    {body}
                  </Link>
                );
              })}
            </div>
          </section>
        ) : null}
      </div>
    </article>
  );
}

export function ProjectDetailSkeleton() {
  return (
    <article className="project-detail project-detail--skeleton" aria-live="polite" aria-busy="true">
      <div className="project-detail__hero">
        <div className="project-detail__media skeleton-box" />
      </div>
      <div className="project-detail__body">
        <div className="skeleton-line w-40" />
        <div className="skeleton-line w-60" />
        <div className="skeleton-line w-80" />
        <div className="project-detail__stats">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index}>
              <div className="skeleton-line w-30" />
              <div className="skeleton-line w-50" />
            </div>
          ))}
        </div>
        <div className="project-detail__grid">
          <section>
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="skeleton-line" />
            ))}
          </section>
          <section>
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="skeleton-line" />
            ))}
          </section>
        </div>
        <section className="project-detail__gallery">
          {Array.from({ length: 3 }).map((_, index) => (
            <figure key={index} className="skeleton-box" />
          ))}
        </section>
      </div>
    </article>
  );
}
