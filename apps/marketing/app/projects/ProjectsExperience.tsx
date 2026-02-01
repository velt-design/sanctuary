'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { Project } from '@/data/projects';
import ProjectDetailContent from './ProjectDetailContent';
import ProjectsCarouselMobile from './ProjectsCarouselMobile';
import './projects.css';

const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');

export default function ProjectsExperience({ projects }: { projects: Project[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [detailLoading, setDetailLoading] = useState(false);
  const [isMobileList, setIsMobileList] = useState(false);
  const detailRef = useRef<HTMLElement | null>(null);
  const optionRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const initialSlug = useMemo(() => {
    const slugFromUrl = searchParams?.get('slug');
    if (slugFromUrl && projects.some(project => project.slug === slugFromUrl)) {
      return slugFromUrl;
    }
    return projects[0]?.slug || '';
  }, [projects, searchParams]);

  const [selectedSlug, setSelectedSlug] = useState(initialSlug);

  useEffect(() => {
    setSelectedSlug(initialSlug);
  }, [initialSlug]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 720px)');
    const setFromQuery = (event?: MediaQueryList | MediaQueryListEvent) => {
      const match = event?.matches ?? mq.matches;
      setIsMobileList(match);
    };
    setFromQuery(mq);
    mq.addEventListener('change', setFromQuery);
    return () => mq.removeEventListener('change', setFromQuery);
  }, []);

  // Lock root page scroll on desktop projects view so only the
  // left/right columns scroll, not the whole document.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const root = document.documentElement;
    const body = document.body;

    if (!isMobileList) {
      root.classList.add('scroll-locked');
      body.classList.add('scroll-locked');
    } else {
      root.classList.remove('scroll-locked');
      body.classList.remove('scroll-locked');
    }

    return () => {
      root.classList.remove('scroll-locked');
      body.classList.remove('scroll-locked');
    };
  }, [isMobileList]);

  const updateUrlSlug = useCallback((slug: string) => {
    if (!pathname) return;
    const current = searchParams ? searchParams.toString() : '';
    const params = new URLSearchParams(current);
    if (slug) params.set('slug', slug); else params.delete('slug');
    const query = params.toString();
    router.replace(`${pathname}${query ? `?${query}` : ''}`, { scroll: false });
  }, [pathname, router, searchParams]);

  const filteredProjects = projects;

  useEffect(() => {
    if (!filteredProjects.length) return;
    const existsInFiltered = filteredProjects.some(project => project.slug === selectedSlug);
    if (!existsInFiltered) {
      const fallbackSlug = filteredProjects[0]?.slug;
      if (fallbackSlug) {
        setSelectedSlug(fallbackSlug);
        updateUrlSlug(fallbackSlug);
      }
    }
  }, [filteredProjects, selectedSlug, updateUrlSlug]);

  useEffect(() => {
    if (!detailLoading) return;
    const timeout = window.setTimeout(() => setDetailLoading(false), 180);
    return () => window.clearTimeout(timeout);
  }, [detailLoading, selectedSlug]);

  const selectedProject = useMemo(() => {
    if (!selectedSlug) return filteredProjects[0] || null;
    return projects.find(project => project.slug === selectedSlug) || filteredProjects[0] || null;
  }, [filteredProjects, projects, selectedSlug]);

  const relatedProjects = useMemo(() => {
    if (!selectedProject?.related?.length) return [];
    return selectedProject.related
      .map(slug => projects.find(project => project.slug === slug))
      .filter((project): project is Project => Boolean(project));
  }, [projects, selectedProject]);

  const setSlug = useCallback((slug: string, options?: { scrollIntoView?: boolean }) => {
    if (!slug || slug === selectedSlug) return;
    setDetailLoading(true);
    setSelectedSlug(slug);
    if (!isMobileList) {
      updateUrlSlug(slug);
    }
    if (options?.scrollIntoView) {
      optionRefs.current[slug]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedSlug, isMobileList, updateUrlSlug]);

  const handleItemClick = (slug: string) => {
    if (isMobileList) {
      router.push(`/projects/${slug}`);
      return;
    }
    setSlug(slug);
  };

  const handleListKeyDown: React.KeyboardEventHandler<HTMLDivElement> = event => {
    if (!filteredProjects.length) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      const currentIndex = filteredProjects.findIndex(project => project.slug === selectedSlug);
      const nextIndex = ((currentIndex >= 0 ? currentIndex : 0) + direction + filteredProjects.length) % filteredProjects.length;
      const target = filteredProjects[nextIndex];
      if (!target) return;
      if (isMobileList) {
        router.push(`/projects/${target.slug}`);
      } else {
        setSlug(target.slug, { scrollIntoView: true });
      }
      return;
    }
    if (event.key === 'Enter' && detailRef.current) {
      event.preventDefault();
      detailRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (event.key === 'Home') {
      event.preventDefault();
      const first = filteredProjects[0];
      if (!first) return;
      if (isMobileList) {
        router.push(`/projects/${first.slug}`);
      } else {
        setSlug(first.slug, { scrollIntoView: true });
      }
    }
    if (event.key === 'End') {
      event.preventDefault();
      const last = filteredProjects[filteredProjects.length - 1];
      if (!last) return;
      if (isMobileList) {
        router.push(`/projects/${last.slug}`);
      } else {
        setSlug(last.slug, { scrollIntoView: true });
      }
    }
  };

  useEffect(() => {
    if (!selectedProject || !filteredProjects.length) return;
    const index = filteredProjects.findIndex(project => project.slug === selectedProject.slug);
    const neighbors = [filteredProjects[index - 1], filteredProjects[index + 1]].filter(Boolean) as Project[];
    neighbors.forEach(project => {
      router.prefetch(`/projects/${project.slug}`);
    });
  }, [filteredProjects, router, selectedProject]);

  if (isMobileList) {
    return (
      <main className="projects-experience projects-experience--mobile" aria-label="Projects">
        <header className="projects-mobile__header">
          <p className="projects-mobile__eyebrow">Projects</p>
          <h1 className="projects-mobile__title">Built pergolas across Auckland and beyond.</h1>
          <p className="projects-mobile__subtitle">
            Swipe across the cards below and tap a project for the full case study.
          </p>
        </header>
        <ProjectsCarouselMobile
          projects={filteredProjects}
          initialSlug={selectedSlug}
        />
      </main>
    );
  }

  return (
    <main className="projects-experience" aria-label="Projects">
      <h1 className="visually-hidden">Pergola projects and case studies</h1>
      <div className="projects-layout">
        <aside className="projects-rail" aria-label="Select a project">
          <div className="projects-rail__inner">
            <div className="projects-rail__header">
              <p className="projects-rail__eyebrow">Projects</p>
              <h2 className="projects-rail__title">{selectedProject?.title || 'Select a project'}</h2>
              {selectedProject?.location ? (
                <p className="projects-rail__meta">{selectedProject.location}</p>
              ) : null}
            </div>
            <div
              className="projects-list"
              role="listbox"
              tabIndex={0}
              aria-label="Projects list"
              aria-activedescendant={selectedSlug ? `project-option-${selectedSlug}` : undefined}
              onKeyDown={handleListKeyDown}
            >
              {filteredProjects.length ? (
                filteredProjects.map(project => {
                  const isActive = project.slug === selectedSlug;
                  return (
                    <button
                      key={project.slug}
                      id={`project-option-${project.slug}`}
                      ref={element => {
                        optionRefs.current[project.slug] = element;
                      }}
                      type="button"
                      className={cx('projects-list__item', isActive && 'is-active')}
                      role="option"
                      aria-selected={isActive}
                      onClick={() => handleItemClick(project.slug)}
                    >
                      <span className="projects-list__title">{project.title}</span>
                      <span className="projects-list__location">{project.location}</span>
                      <span className="projects-list__tag">{project.type} · {project.roof}</span>
                    </button>
                  );
                })
              ) : (
                <div className="projects-list__empty">
                  <p>No projects available.</p>
                </div>
              )}
            </div>
          </div>
        </aside>
        <section className="projects-detail" ref={detailRef} aria-live="polite">
          {isMobileList ? (
            <div className="projects-detail__mobile-note">
              <p>Select a project card to open the full detail page.</p>
            </div>
          ) : (
            <ProjectDetailContent
              project={selectedProject}
              isLoading={detailLoading}
              relatedProjects={relatedProjects}
              onSelectRelated={slug => setSlug(slug, { scrollIntoView: true })}
              relationMode="inline"
              variant="embedded"
            />
          )}
        </section>
      </div>
    </main>
  );
}
