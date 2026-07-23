'use client';

import Link from 'next/link';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import type { Project } from '@/data/projects';
import { getProjectFormLabel } from './projectPresentation';

type ProjectNavigatorProps = {
  projects: Project[];
  activeProject: Project;
};

const ALL_FILTERS = 'all';

export default function ProjectNavigator({
  projects,
  activeProject,
}: ProjectNavigatorProps) {
  const [typeFilter, setTypeFilter] = useState(ALL_FILTERS);
  const [formFilter, setFormFilter] = useState(ALL_FILTERS);
  const [isOpen, setIsOpen] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const linkRefs = useRef(new Map<string, HTMLAnchorElement>());

  const activeIndex = projects.findIndex((project) => project.slug === activeProject.slug);
  const formOptions = useMemo(
    () => Array.from(new Set(projects.map(getProjectFormLabel))).sort(),
    [projects],
  );
  const filteredProjects = useMemo(
    () => projects.filter((project) => (
      (typeFilter === ALL_FILTERS || project.type === typeFilter)
      && (formFilter === ALL_FILTERS || getProjectFormLabel(project) === formFilter)
    )),
    [formFilter, projects, typeFilter],
  );

  useEffect(() => {
    const media = window.matchMedia('(max-width: 899px)');
    const update = () => {
      setIsCompact(media.matches);
      if (!media.matches) setIsOpen(false);
    };

    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!isCompact || !isOpen) return;

    const root = document.documentElement;
    const body = document.body;
    root.classList.add('projects-navigator-open');
    body.classList.add('projects-navigator-open');

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsOpen(false);
        return;
      }

      if (event.key !== 'Tab') return;
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), select:not([disabled]), a[href]',
      );
      if (!focusable?.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      root.classList.remove('projects-navigator-open');
      body.classList.remove('projects-navigator-open');
      triggerRef.current?.focus();
    };
  }, [isCompact, isOpen]);

  const closeNavigator = () => setIsOpen(false);
  const openNavigator = () => {
    setIsOpen(true);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        closeRef.current?.focus();
      });
    });
  };

  const handleListKeyDown = (event: KeyboardEvent<HTMLOListElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;

    const links = filteredProjects
      .map((project) => linkRefs.current.get(project.slug))
      .filter((link): link is HTMLAnchorElement => Boolean(link));
    if (!links.length) return;

    event.preventDefault();
    const currentIndex = links.findIndex((link) => link === document.activeElement);
    let nextIndex = currentIndex;

    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = links.length - 1;
    if (event.key === 'ArrowDown') {
      nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % links.length;
    }
    if (event.key === 'ArrowUp') {
      nextIndex = currentIndex < 0
        ? links.length - 1
        : (currentIndex - 1 + links.length) % links.length;
    }

    links[nextIndex]?.focus();
  };

  const navigatorPanel = (
    <div
      ref={panelRef}
      id="project-navigator-panel"
      className="project-navigator__panel"
      data-open={isOpen ? 'true' : 'false'}
      role={isCompact ? 'dialog' : undefined}
      aria-modal={isCompact ? true : undefined}
      aria-labelledby="project-navigator-title"
      aria-hidden={isCompact ? !isOpen : undefined}
      inert={isCompact && !isOpen}
    >
      <div className="project-navigator__header">
        <div>
          <p className="project-navigator__eyebrow">
            Project {String(activeIndex + 1).padStart(2, '0')} of {String(projects.length).padStart(2, '0')}
          </p>
          <h2 id="project-navigator-title">{activeProject.title}</h2>
          <p>{activeProject.location}</p>
          <span>{activeProject.type} / {getProjectFormLabel(activeProject)}</span>
        </div>
        <button
          ref={closeRef}
          type="button"
          className="project-navigator__close"
          aria-label="Close project navigator"
          onClick={closeNavigator}
        >
          Close
        </button>
      </div>

      <div className="project-navigator__filters" aria-label="Filter projects">
        <label>
          <span>Type</span>
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
          >
            <option value={ALL_FILTERS}>All types</option>
            <option value="Residential">Residential</option>
            <option value="Commercial">Commercial</option>
          </select>
        </label>
        <label>
          <span>Form</span>
          <select
            value={formFilter}
            onChange={(event) => setFormFilter(event.target.value)}
          >
            <option value={ALL_FILTERS}>All forms</option>
            {formOptions.map((form) => (
              <option key={form} value={form}>{form}</option>
            ))}
          </select>
        </label>
      </div>

      <p className="project-navigator__result-count" aria-live="polite">
        Showing {filteredProjects.length} of {projects.length}
      </p>

      <nav className="project-navigator__list-wrap" aria-label="Project case studies">
        {filteredProjects.length ? (
          <ol className="project-navigator__list" onKeyDown={handleListKeyDown}>
            {filteredProjects.map((project) => {
              const projectIndex = projects.findIndex((candidate) => candidate.slug === project.slug);
              const isActive = project.slug === activeProject.slug;
              return (
                <li key={project.slug}>
                  <Link
                    ref={(element) => {
                      if (element) linkRefs.current.set(project.slug, element);
                      else linkRefs.current.delete(project.slug);
                    }}
                    href={`/projects/${project.slug}`}
                    className={isActive ? 'is-active' : undefined}
                    aria-current={isActive ? 'page' : undefined}
                    onClick={closeNavigator}
                  >
                    <span className="project-navigator__item-number">
                      {String(projectIndex + 1).padStart(2, '0')}
                    </span>
                    <span className="project-navigator__item-copy">
                      <strong>{project.title}</strong>
                      <span>{project.region}</span>
                      <small>{project.type} / {getProjectFormLabel(project)}</small>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="project-navigator__empty">
            <p>No projects match both filters.</p>
            <button
              type="button"
              onClick={() => {
                setTypeFilter(ALL_FILTERS);
                setFormFilter(ALL_FILTERS);
              }}
            >
              Clear filters
            </button>
          </div>
        )}
      </nav>
    </div>
  );

  const mobileLayer = isCompact && typeof document !== 'undefined'
    ? createPortal(
      <div className="project-navigator-layer">
        {isOpen ? (
          <button
            type="button"
            className="project-navigator__backdrop"
            aria-label="Close project navigator"
            tabIndex={-1}
            onClick={closeNavigator}
          />
        ) : null}
        {navigatorPanel}
      </div>,
      document.body,
    )
    : null;

  return (
    <aside
      className="project-navigator"
      aria-label="Project navigator"
      data-project-navigator
    >
      <button
        ref={triggerRef}
        type="button"
        className="project-navigator__trigger"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls="project-navigator-panel"
        onClick={openNavigator}
      >
        <span className="project-navigator__trigger-count">
          {String(activeIndex + 1).padStart(2, '0')} / {String(projects.length).padStart(2, '0')}
        </span>
        <span className="project-navigator__trigger-title">{activeProject.title}</span>
        <span className="project-navigator__trigger-action">Browse</span>
      </button>
      {isCompact ? mobileLayer : navigatorPanel}
    </aside>
  );
}
